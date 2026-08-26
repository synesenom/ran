"""
Differential-testing harness core for src/special/ (issue #1264).

Sweeps randomized (seeded, reproducible) input grids far denser than the committed
precision gate (scripts/precision-refs-special.py -> test/precision-special.js),
evaluates both mpmath (mp.dps=50, live) and ranjs at every point via the existing
scripts/eval-special.js bridge, and reports the error distribution in ULP.

Unlike the committed precision gate, this harness evaluates mpmath LIVE on every run
and commits no reference literals -- infeasible at 10,000+ points/function, and a
frozen fixture could never detect drift if mpmath itself changed its answer. It also
runs entirely out-of-band from `npm test`: it needs a Python+mpmath environment and
takes minutes, neither of which belongs in the fast, always-green unit-test gate. It
is a non-blocking diagnostic/audit layer -- the committed test/precision-*.js files
remain the sole CI-enforced correctness contract. See
decisions/0052-differential-testing-harness-live-mpmath-out-of-band.md -- differential-testing
harness evaluates mpmath live and runs out-of-band from npm test.

This script is deliberately fully standalone (does not import from
precision-refs-special.py) -- that file's hyphenated name isn't a valid Python module
identifier, and every existing scripts/*.py file in this repo is independently
self-contained with no cross-script imports. The half-dozen one-line mpmath reference
wrappers this script needs are duplicated from precision-refs-special.py rather than
shared.

Requires: pip install mpmath (already in scripts/requirements.txt)
Usage: npm run difftest:special
       python3 scripts/difftest-special.py [--seed N] [--out PATH] [--N COUNT]
"""
import json
import math
import random
import statistics
import struct
import subprocess
import sys

import mpmath
from mpmath import mp, besseli, besselk
from mpmath import digamma as mp_digamma
from mpmath import gamma as mp_gamma, beta as mp_beta, gammainc, betainc
from mpmath import binomial as mp_binomial, inf, mpf, log

mp.dps = 50

DEFAULT_SEED = 42
DEFAULT_OUT = '/tmp/difftest-special-report.json'
EVAL_SCRIPT = 'scripts/eval-special.js'


# ─── ULP METRIC ───

def ulp_diff(a, b):
    """Float64 ULP distance between a and b.

    NaN vs NaN is treated as trivially equal (0) rather than propagating IEEE's
    NaN != NaN, since two NaN reference/ranjs values agreeing that a point diverges
    is not itself a reportable error; exactly one side being NaN is a real
    divergence, reported as +inf rather than an arbitrary large integer so it always
    dominates a function's max ULP and cannot be quietly out-ranked by a merely large
    finite count.
    """
    a = float(a)
    b = float(b)
    a_nan = a != a
    b_nan = b != b
    if a_nan and b_nan:
        return 0
    if a_nan or b_nan:
        return float('inf')
    if a == b:
        # Covers +0.0 == -0.0, whose bit patterns otherwise differ.
        return 0
    a_inf = math.isinf(a)
    b_inf = math.isinf(b)
    if a_inf or b_inf:
        # a == b above already caught same-signed infinities.
        return float('inf')
    return abs(_monotonic_bits(a) - _monotonic_bits(b))


def _monotonic_bits(x):
    # IEEE 754 float64 is sign-magnitude, not two's complement: the raw unsigned
    # bit pattern is NOT monotonically ordered across the zero crossing (e.g. -1.0's
    # bits are numerically larger than 1.0's). Remapping negative values via
    # 2**63 - bits mirrors the negative range back around 2**63 (rather than folding
    # it into the top of the unsigned range via 2**64 - bits, which would collide two
    # equal-magnitude opposite-sign values onto the same monotonic value and make
    # ulp_diff silently return 0 for a sign mismatch) -- the standard trick for
    # computing ULP distance as a simple integer subtraction. Subnormals need no
    # special case -- IEEE 754 defines their bit pattern to continue the same
    # ordering right through zero. See
    # solutions/testing/2026-08-09-1444-ulp-diff-sign-remap-same-sign-blind-self-check.md
    bits, = struct.unpack('>Q', struct.pack('>d', x))
    return bits if bits < 2**63 else 2**63 - bits


def _self_check():
    """Inline self-validation of ulp_diff, run unconditionally before every sweep --
    a broken ULP metric must never silently produce a bogus report."""
    one_up = math.nextafter(1.0, 2.0)
    assert ulp_diff(1.0, one_up) == 1, 'adjacent normals should be 1 ULP apart'
    assert ulp_diff(1.0, 1.0) == 0, 'identical values should be 0 ULP apart'
    assert ulp_diff(0.0, -0.0) == 0, 'signed zeros should be 0 ULP apart'
    assert 0 < ulp_diff(-1e-300, 1e-300) < float('inf'), \
        'zero-crossing pair should be a large but finite ULP distance'
    assert ulp_diff(5e-324, 1e-323) == 1, 'adjacent subnormals should be 1 ULP apart'
    assert ulp_diff(-5e-324, 5e-324) == 2, \
        'adjacent subnormals straddling zero should be 2 ULP apart'
    dbl_max = 1.7976931348623157e+308
    assert ulp_diff(dbl_max, math.nextafter(dbl_max, 0)) == 1, \
        'adjacent normals near DBL_MAX should be 1 ULP apart'
    assert ulp_diff(float('inf'), float('inf')) == 0, 'equal infinities should be 0 ULP apart'
    assert ulp_diff(float('inf'), float('-inf')) == float('inf'), \
        'opposite-signed infinities should diverge'
    assert ulp_diff(1.0, float('inf')) == float('inf'), \
        'finite vs infinite should diverge'
    assert ulp_diff(float('nan'), float('nan')) == 0, 'NaN vs NaN should be treated as equal'
    assert ulp_diff(float('nan'), 1.0) == float('inf'), \
        'NaN vs finite should diverge'
    assert ulp_diff(-1.0, -1.0) == 0, 'identical negative values should be 0 ULP apart'
    neg_one_down = math.nextafter(-1.0, -2.0)
    assert ulp_diff(-1.0, neg_one_down) == 1, \
        'adjacent negative normals should be 1 ULP apart'
    # Same-magnitude, opposite-sign pair: same-sign adjacency (above) can't catch a
    # wrong sign-remapping constant in _monotonic_bits, since a wrong-but-consistent
    # constant cancels out in the subtraction for two values on the same side of zero.
    # This is the case that actually exercises it -- it must be a large, easily
    # distinguishable distance, never 0.
    assert ulp_diff(2.0, -2.0) > 2**62, \
        'same-magnitude opposite-sign values must not collide to a small ULP distance'


# ─── REFERENCE FORMULAS ───
# Duplicated one-line mpmath wrappers from precision-refs-special.py:91-147 rather than
# imported -- that file's hyphenated name isn't a valid Python module identifier, and
# every scripts/*.py file in this repo is independently self-contained.

def besselI_ref(n, x):
    return besseli(n, x)


def besselISpherical_ref(n, x):
    # i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x) (DLMF 10.47.9), independent of ranjs's own
    # Taylor/Wronskian-recurrence implementation. Kept even though the sweep domain
    # below never samples exactly x=0, for parity with the source formula's own guard.
    from mpmath import mpf, pi, sqrt
    if x == 0:
        if n == 0:
            return mpf(1)
        return mpf(0) if n > 0 else mpf('inf')
    return sqrt(pi / (2 * x)) * besseli(n + mpf('0.5'), x)


def besselInu_ref(nu, x):
    return besseli(nu, x)


def besselK_ref(n, x):
    return besselk(n, x)


def besselKnu_ref(nu, x):
    return besselk(nu, x)


def digamma_ref(z):
    return mp_digamma(z)


def gamma_ref(z):
    # mpmath's gamma() raises ValueError at a pole instead of returning Infinity --
    # translate to match ranjs's own non-positive-integer pole guard (gamma.js:27-29).
    # A random float sweep essentially never lands on an exact integer, but the guard is
    # kept for parity with precision-refs-special.py's own gamma_ref.
    if z <= 0 and z == int(z):
        return mpf('inf')
    return mp_gamma(z)


def logGamma_ref(z):
    if z <= 0 and z == int(z):
        return mpf('inf')
    return log(abs(mp_gamma(z)))


def gammaLowerIncomplete_ref(s, x):
    # See precision-refs-special.py's gammaLowerIncomplete_ref: x<0 matches _gli's own
    # explicit guard, kept in sync even though this file's SWEEP_SPEC domain for x is
    # positive-only.
    if x < 0:
        return mpf(0)
    return gammainc(s, 0, x, regularized=True)


def gammaUpperIncomplete_ref(s, x):
    return gammainc(s, x, inf, regularized=True)


def gammaLowerIncompleteInv_ref(a, p):
    # See precision-refs-special.py's gammaLowerIncompleteInv_ref for the full rationale
    # (plain bisection -- a Newton/derivative step can overshoot into gammainc's unstable
    # x<0 region and crash with RecursionError) -- duplicated here rather than imported,
    # per this file's own no-cross-script-import convention.
    if p <= 0:
        return mpf(0)
    if p >= 1:
        return mpf('inf')

    def f(x):
        return gammainc(a, 0, x, regularized=True) - p

    lo = mpf(a) / 1000 if a > 1000 else mpf('1e-10')
    hi = mpf(a) * 10 + 10
    while f(lo) > 0:
        lo /= 10
    while f(hi) < 0:
        hi *= 10
    for _ in range(800):
        mid = (lo + hi) / 2
        if mid == lo or mid == hi:
            break
        if f(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def beta_ref(x, y):
    return mp_beta(x, y)


def logBeta_ref(x, y):
    return log(abs(mp_beta(x, y)))


def betaIncomplete_ref(a, b, x):
    # See precision-refs-special.py's betaIncomplete_ref: a=0 (x>0) is a genuine pole of
    # the unnormalized integral, and mpmath's betainc() divides by a and raises
    # ZeroDivisionError there instead of returning Infinity -- translate explicitly, kept
    # in sync even though this file's continuous random sweep essentially never samples
    # exactly a=0.
    if a == 0 and 0 < x < 1:
        return mpf('inf')
    return betainc(a, b, 0, x, regularized=False)


def regularizedBetaIncomplete_ref(a, b, x):
    return betainc(a, b, 0, x, regularized=True)


def logBinomial_ref(n, k):
    return log(abs(mp_binomial(n, k)))


REF_FN = {
    'besselI': besselI_ref,
    'besselISpherical': besselISpherical_ref,
    'besselInu': besselInu_ref,
    'besselK': besselK_ref,
    'besselKnu': besselKnu_ref,
    'digamma': digamma_ref,
    'gamma': gamma_ref,
    'logGamma': logGamma_ref,
    'gammaLowerIncomplete': gammaLowerIncomplete_ref,
    'gammaUpperIncomplete': gammaUpperIncomplete_ref,
    'gammaLowerIncompleteInv': gammaLowerIncompleteInv_ref,
    'beta': beta_ref,
    'logBeta': logBeta_ref,
    'betaIncomplete': betaIncomplete_ref,
    'regularizedBetaIncomplete': regularizedBetaIncomplete_ref,
    'logBinomial': logBinomial_ref,
}


# ─── SWEEP CONFIGURATION ───
# Declarative per-function domain: adding sweep coverage for a new function is a config
# entry here, not new driver code. Domains are chosen from the thresholds
# precision-refs-special.py's own grid builders already document (crossover x-values,
# overflow boundaries), so the random sweep straddles the same regions the fixed grid
# hand-targets, but densely and without needing to know exactly where to look.
#
# ulp_ceiling values below are calibrated from the 2026-08-09 n=10000/function
# calibration run (seed=42, mpmath 1.4.1) at roughly >=2x (besselI/besselISpherical/
# besselInu/digamma) or >=5x (besselK/besselKnu) headroom over that run's measured
# max_ulp -- never a blind number (CLAUDE.md).
SWEEP_SPEC = {
    'besselI': {
        # Straddles the documented x=10 _I0/_besselIBackward crossover.
        'args': [
            {'name': 'n', 'kind': 'int', 'lo': 0, 'hi': 10},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 500, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 1024,  # measured max 256 ULP (n=2, x=458.6)
    },
    'besselISpherical': {
        # Straddles the documented |x|=1 Taylor/closed-form crossover.
        'args': [
            {'name': 'n', 'kind': 'int', 'lo': -3, 'hi': 5},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 50, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 2048,  # measured max 843 ULP (n=-2, x=1.199 -- the |x|=1 crossover)
    },
    'besselInu': {
        # x stays under the documented ~710 series overflow boundary so the mpmath
        # reference stays finite; nu can be negative and near zero, so it is sampled
        # uniformly rather than log-uniformly.
        'args': [
            {'name': 'nu', 'kind': 'float', 'lo': -5, 'hi': 5, 'log_uniform': False},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 700, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 2048,  # measured max 654 ULP (nu=0.498, x=686.2 -- near the ~710 overflow boundary)
    },
    'besselK': {
        # Straddles the documented x=6 _X_K_SERIES crossover -- the region the
        # acceptance criteria require to show up as elevated max-ULP.
        'args': [
            {'name': 'n', 'kind': 'int', 'lo': 0, 'hi': 5},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 100, 'log_uniform': True},
        ],
        'n': 10000,
        # measured max ~3.78e9 ULP (n=1, x=6.05 -- the known _X_K_SERIES=6 crossover,
        # already documented/accepted in precision-refs-special.py's tiered tolerances).
        # #1264's own calibration requirement: this must stay elevated, not tightened.
        'ulp_ceiling': 20_000_000_000,
    },
    'besselKnu': {
        # Same x=6 crossover as besselK, reached via the connection-formula/asymptotic
        # dispatch instead.
        'args': [
            {'name': 'nu', 'kind': 'float', 'lo': -5, 'hi': 5, 'log_uniform': False},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 100, 'log_uniform': True},
        ],
        'n': 10000,
        # measured max ~1.11e16 ULP (nu=4.94, x=6.21 -- the same x=6 crossover as besselK,
        # here at a larger |nu| than the fixed grid's own probes (which stop at 3.3),
        # confirming the random sweep reaches combinations the fixed grid does not cover.
        'ulp_ceiling': 60_000_000_000_000_000,
    },
    'digamma': {
        # Positive domain only for this initial pass: negative z requires excluding an
        # unbounded set of poles at negative integers via rejection sampling, which adds
        # real complexity for a function that isn't central to this issue's acceptance
        # criteria (the besselK/besselKnu x=6 crossover is). Negative-z coverage is left
        # to the extend-to-remaining-functions follow-up (#1271).
        'args': [
            {'name': 'z', 'kind': 'float', 'lo': 1e-3, 'hi': 500, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 8192,  # measured max 2095 ULP (z=1.465)
    },
    # ─── Issue #1271, gamma/beta cluster ───
    'gamma': {
        # Straddles the documented z=0.5 reflection/Lanczos crossover; a random float
        # sweep essentially never lands on an exact non-positive-integer pole.
        'args': [
            {'name': 'z', 'kind': 'float', 'lo': -20, 'hi': 170, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'logGamma': {
        # Straddles the LOG_FACTORIAL integer-table boundary (z<=171) and the z=0.5
        # reflection crossover across a much wider magnitude range than gamma() itself,
        # since logGamma doesn't overflow anywhere near as quickly.
        'args': [
            {'name': 'z', 'kind': 'float', 'lo': -500, 'hi': 1000, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'gammaLowerIncomplete': {
        # Straddles the top-level x<s+1 series/CF crossover and the _deviance.js
        # stirlerr(s=15)/bd0(t=x/s in {0.5,2}) thresholds across a broad (s,x) domain;
        # the #1348 near-diagonal large-s extreme is left to the fixed precision gate.
        'args': [
            {'name': 's', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 250, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'gammaUpperIncomplete': {
        # Same domain/crossover as gammaLowerIncomplete, reached via the complementary
        # 1-_gli / _gui dispatch.
        'args': [
            {'name': 's', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 250, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'gammaLowerIncompleteInv': {
        # Straddles the a>=1 Wilson-Hilferty-seeded vs a<1 series-inversion-seeded
        # crossover; p kept away from the exact {0,1} boundaries (asserted directly, not
        # swept) since those are already exact-return fast paths, not iterative ones.
        'args': [
            {'name': 'a', 'kind': 'float', 'lo': 1e-2, 'hi': 500, 'log_uniform': True},
            {'name': 'p', 'kind': 'float', 'lo': 1e-3, 'hi': 0.999, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'beta': {
        # Continuous (x,y) interior coverage; the integer min(x,y)<=30 exact-recurrence
        # fast path is exercised by the fixed precision gate instead, since a continuous
        # random sweep essentially never lands on exact integers.
        'args': [
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 200, 'log_uniform': True},
            {'name': 'y', 'kind': 'float', 'lo': 1e-3, 'hi': 200, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'logBeta': {
        # Wider magnitude range than beta() itself, straddling logGamma's inherited
        # thresholds via x, y, or x+y.
        'args': [
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 1000, 'log_uniform': True},
            {'name': 'y', 'kind': 'float', 'lo': 1e-3, 'hi': 1000, 'log_uniform': True},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'betaIncomplete': {
        # x spans the full (0,1) domain (plain uniform, not log-uniform, so both the
        # near-0 and near-1 cancellation-prone regions get comparable density); a,b span
        # several orders of magnitude to straddle the parameter-dependent forward/
        # backward x<(a+1)/(a+b+2) crossover broadly.
        'args': [
            {'name': 'a', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'b', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 0.999, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'regularizedBetaIncomplete': {
        # Same domain as betaIncomplete, reached via the normalized I_x(a,b) dispatch.
        'args': [
            {'name': 'a', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'b', 'kind': 'float', 'lo': 1e-2, 'hi': 200, 'log_uniform': True},
            {'name': 'x', 'kind': 'float', 'lo': 1e-3, 'hi': 0.999, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
    'logBinomial': {
        # k allowed to exceed n (uniform, not tied to n) to exercise logGamma's inherited
        # reflection formula via n-k+1 going non-positive, in addition to the ordinary
        # 0<=k<=n regime.
        'args': [
            {'name': 'n', 'kind': 'float', 'lo': 1, 'hi': 1000, 'log_uniform': True},
            {'name': 'k', 'kind': 'float', 'lo': -0.5, 'hi': 1000, 'log_uniform': False},
        ],
        'n': 10000,
        'ulp_ceiling': 1_000_000,  # placeholder pending calibration run
    },
}


def generate_points(spec, seed, n_override=None):
    """Seeded, reproducible random (fn, args) point generation -- same seed, same
    points, satisfying the harness's reproducibility requirement."""
    rng = random.Random(seed)
    points = []
    for fn, fn_spec in spec.items():
        n = n_override if n_override is not None else fn_spec['n']
        for _ in range(n):
            args = []
            for arg in fn_spec['args']:
                if arg['kind'] == 'int':
                    args.append(rng.randint(arg['lo'], arg['hi']))
                elif arg.get('log_uniform'):
                    lo, hi = math.log(arg['lo']), math.log(arg['hi'])
                    args.append(math.exp(rng.uniform(lo, hi)))
                else:
                    args.append(rng.uniform(arg['lo'], arg['hi']))
            points.append((fn, args))
    return points


# ─── SWEEP ORCHESTRATION ───

def compute_ranjs_values(points):
    # Batches ALL points into a single node scripts/eval-special.js invocation (not one
    # subprocess per point), mirroring precision-refs-special.py:374-380.
    payload = json.dumps([{'fn': fn, 'args': args} for fn, args in points])
    result = subprocess.run(['node', EVAL_SCRIPT], input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('scripts/eval-special.js failed')
    return json.loads(result.stdout)


def decode(value):
    # Undoes eval-special.js's Infinity/NaN string tagging (JSON has no such literals),
    # mirroring precision-refs-special.py:383-391.
    if value == 'Infinity':
        return float('inf')
    if value == '-Infinity':
        return float('-inf')
    if value == 'NaN':
        return float('nan')
    return value


def sweep(spec, seed, n_override=None):
    points = generate_points(spec, seed, n_override)
    refs = [REF_FN[fn](*args) for fn, args in points]
    ranjs_values = compute_ranjs_values(points)

    results = {fn: {'ulps': [], 'errors': 0} for fn in spec}
    for (fn, args), ref, got in zip(points, refs, ranjs_values):
        if 'error' in got:
            results[fn]['errors'] += 1
            continue
        value = decode(got['value'])
        ulp = ulp_diff(float(ref), value)
        results[fn]['ulps'].append((ulp, args, float(ref), value))
    return results


def build_report(sweep_results, spec, seed):
    functions = {}
    for fn, data in sweep_results.items():
        entries = data['ulps']
        n = len(entries)
        ulps = [e[0] for e in entries]
        # inf entries (NaN/divergence mismatches) would break median/p99 statistics --
        # report them via a dedicated count instead of poisoning the finite-ULP summary.
        finite = [u for u in ulps if u != float('inf')]
        divergences = n - len(finite)
        worst = max(entries, key=lambda e: e[0]) if entries else None
        max_ulp = worst[0] if worst else None
        median_ulp = statistics.median(finite) if finite else None
        p99_ulp = statistics.quantiles(finite, n=100)[98] if len(finite) >= 2 else (finite[0] if finite else None)
        ceiling = spec[fn]['ulp_ceiling']
        functions[fn] = {
            'n': n,
            'errors': data['errors'],
            'divergences': divergences,
            'max_ulp': max_ulp,
            'median_ulp': median_ulp,
            'p99_ulp': p99_ulp,
            'ulp_ceiling': ceiling,
            'ceiling_exceeded': max_ulp is not None and max_ulp != float('inf') and max_ulp > ceiling,
            # Read straight from SWEEP_SPEC (the same dict generate_points() draws from), so
            # the reported domain can never drift from what was actually sampled -- #1266
            # requires "the input domain actually swept ... must reflect what was measured".
            'domain': spec[fn]['args'],
            'worst_case': None if worst is None else {
                'args': worst[1],
                'mpmath_ref': worst[2],
                'ranjs_value': worst[3],
            },
        }
    return {
        'seed': seed,
        'mpmath_version': mpmath.__version__,
        'mp_dps': mp.dps,
        'functions': functions,
    }


def _sanitize_for_json(value):
    # json.dump has no Infinity/NaN literal by default (it emits the non-standard
    # Infinity/NaN tokens unless allow_nan=False) -- tag them as strings instead so the
    # report is valid, portable JSON a downstream consumer (e.g. #1266) can parse
    # without a custom decoder, mirroring eval-special.js's own encode() convention.
    if isinstance(value, float):
        if value != value:
            return 'NaN'
        if value == float('inf'):
            return 'Infinity'
        if value == float('-inf'):
            return '-Infinity'
        return value
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    return value


def _parse_argv():
    def flag_value(name, default, cast):
        if name in sys.argv:
            idx = sys.argv.index(name)
            return cast(sys.argv[idx + 1])
        return default

    seed = flag_value('--seed', DEFAULT_SEED, int)
    out = flag_value('--out', DEFAULT_OUT, str)
    n_override = flag_value('--N', None, int)
    return seed, out, n_override


def main():
    _self_check()
    print('ulp_diff self-check passed')

    seed, out_path, n_override = _parse_argv()
    results = sweep(SWEEP_SPEC, seed, n_override)
    report = build_report(results, SWEEP_SPEC, seed)

    with open(out_path, 'w') as f:
        json.dump(_sanitize_for_json(report), f, indent=2)

    print(f'mpmath {report["mpmath_version"]}, seed {seed}')
    for fn, data in report['functions'].items():
        flag = ' CEILING EXCEEDED' if data['ceiling_exceeded'] else ''
        print(f'  {fn}: n={data["n"]} errors={data["errors"]} divergences={data["divergences"]} '
              f'max={data["max_ulp"]} median={data["median_ulp"]} p99={data["p99_ulp"]} '
              f'ceiling={data["ulp_ceiling"]}{flag}')
    print(f'Wrote {out_path}')


if __name__ == '__main__':
    main()
