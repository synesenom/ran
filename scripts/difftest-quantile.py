"""
Differential-testing harness for quantile accuracy (issue #1269), extending #1264's src/special/
sweep and #1265's src/dist/ pdf/cdf sweep (difftest-dist.py) to a third dimension: q(p). Two
independent metrics, both mandatory per #1269's acceptance criteria:

  - Round-trip: |cdf(q(p)) - p| over ALL distributions in test/dist-cases-*.js (~146), for p drawn
    log-uniformly toward both tails -- exactly where numerical inversion is weakest. Needs no
    external reference (cdf and q are both ranjs's own methods): measures internal consistency, not
    absolute correctness. Also the only place closed-form _q(p) can be told apart from the base
    class's numerical inversion (typeof instance._q === 'function', read from eval-quantile.js's
    catalog mode -- Python has no visibility into a JS method's presence).

  - Absolute ULP accuracy: q(p) vs. an independent mpmath inverse-CDF reference at mp.dps=50, for the
    #1265 pilot family (Gamma, Beta, Chi2, F, StudentT, InverseGamma) only -- an independent mpmath
    reference for all ~146 distributions is out of scope (#1265's own scope boundary).

Live mpmath, out-of-band from `npm test`, same rationale as #1264/#1265 (decisions/0052). Standalone,
no cross-script imports: ulp_diff/_self_check and the pilot family's cdf reference formulas are
duplicated verbatim from difftest-dist.py (same no-cross-import convention that file establishes).

Usage: npm run difftest:quantile | python3 scripts/difftest-quantile.py
       [--seed N] [--out PATH] [--n N] [--roundtrip-only] [--pilot-only]
"""
import json
import math
import random
import statistics
import struct
import subprocess
import sys

import mpmath
from mpmath import mp, mpf, gammainc, betainc

mp.dps = 50

DEFAULT_SEED = 42
DEFAULT_OUT = '/tmp/difftest-quantile-report.json'
EVAL_SCRIPT = 'scripts/eval-quantile.js'

# ─── ULP METRIC ─── (duplicated verbatim from difftest-dist.py, see module docstring)
def ulp_diff(a, b):
    """Float64 ULP distance between a and b. NaN vs NaN is 0 (not a reportable error);
    exactly one side NaN, or a finite/infinite mismatch, is +inf (dominates max ULP)."""
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
    # Sign-magnitude float64 bits aren't monotonic across zero; remap negatives via
    # 2**63 - bits (not 2**64 - bits, which would collide opposite-sign equal-magnitude
    # values onto the same value). See solutions/testing/2026-08-09-1444-ulp-diff-sign-
    # remap-same-sign-blind-self-check.md.
    bits, = struct.unpack('>Q', struct.pack('>d', x))
    return bits if bits < 2**63 else 2**63 - bits

def _self_check():
    """Unconditional self-validation of ulp_diff -- a broken metric must never silently
    produce a bogus report."""
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
    # Cross-sign pair -- same-sign cases above can't catch a wrong sign-remap constant.
    assert ulp_diff(2.0, -2.0) > 2**62, \
        'same-magnitude opposite-sign values must not collide to a small ULP distance'

def decode(value):  # undoes eval-quantile.js's Infinity/NaN string tagging (JSON has no such literal).
    return {'Infinity': float('inf'), '-Infinity': float('-inf'), 'NaN': float('nan')}.get(value, value)

def _sanitize_for_json(value):  # json.dump has no Infinity/NaN literal -- tag them as strings.
    if isinstance(value, float):
        if value != value:
            return 'NaN'
        return {float('inf'): 'Infinity', float('-inf'): '-Infinity'}.get(value, value)
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    return value

def _run_bridge(args, payload=None):
    result = subprocess.run(['node', EVAL_SCRIPT] + args, input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError(f'scripts/eval-quantile.js {" ".join(args)} failed')
    return json.loads(result.stdout)

def catalog():
    """One valid parameter tuple, type, closed-form-vs-numerical status, and support per
    distribution, read from test/dist-cases-*.js via eval-quantile.js's catalog mode -- never a
    hand-maintained Python-side list, so the population can't drift from what's actually tested."""
    entries = _run_bridge(['catalog'])
    ok = [e for e in entries if 'error' not in e]
    failed = [e for e in entries if 'error' in e]
    if failed:
        print(f'catalog: {len(failed)} distribution(s) failed to construct from their own test '
              f'params, excluded from the sweep: {[e["name"] for e in failed]}', flush=True)
    return ok

# ─── ROUND-TRIP SWEEP ───────────────────────────────────────────────────────────────────────────
# p bounded away from machine-epsilon neighborhoods (bug #338: absolute tolerance at extreme tails
# is vacuous -- solutions/testing/2026-05-22-1200-quantile-refvals-scipy-naming-traps-extreme-tail-
# tolerance.md), and away from 1e-12: several discrete _cdf (src/dist/*.js) are O(k) recurrence sums
# whose double-precision summation saturates before reaching within 1e-12 of 1 (e.g.
# BetaNegativeBinomial(3,2,4).cdf(k) plateaus at 1-3.6e-11 for every k >= ~1e7). Probing q(1-1e-12)
# against a cdf that can never get there sends _qTableBracket's geometric bracket expansion through
# all MAX_ITER=100 iterations hunting for a k that doesn't exist at that precision, and the final
# O(k) cdf() call at k~1.618^100 never completes -- confirmed empirically: {1e-6, 1-1e-6} sweeps the
# whole catalog in ~2s; {1e-12, 1-1e-12} hangs on BetaNegativeBinomial alone. 1e-6 is still far
# deeper than the existing pdf/cdf sweep's P_LO/P_HI=0.001/0.999 (difftest-dist.py).
# See solutions/tooling/2026-08-11-2026-quantile-sweep-tail-depth-hang-beta-negative-binomial.md
P_TAIL_LO, P_TAIL_HI = 1e-6, 1e-1
N_ROUNDTRIP_DEFAULT = 300
MONOTONICITY_TOL = 1e-9
BOUNDARY_P_TOL = 1e-9

def generate_roundtrip_ps(rng, n):
    """Log-uniform toward both tails, plus one interior anchor. Sorted ascending so a single pass
    over the per-distribution results can check monotonicity without re-sorting."""
    log_lo, log_hi = math.log10(P_TAIL_LO), math.log10(P_TAIL_HI)
    ps = [0.5]
    for _ in range(n):
        tail_p = 10 ** rng.uniform(log_lo, log_hi)
        ps.append(tail_p if rng.random() < 0.5 else 1 - tail_p)
    ps.sort()
    return ps

def _hard_failures(name, params, ps, xs, cdf_of_qs, support, dist_type):
    lo_closed, lo_value = support[0]['closed'], decode(support[0]['value'])
    hi_closed, hi_value = support[1]['closed'], decode(support[1]['value'])
    non_convergence = 0
    out_of_support = 0
    non_monotonicity = 0
    worst = None  # (roundtrip_error, p, x, cdf_of_q)
    errors = []
    prev_x = None
    for p, x, cdf_of_q in zip(ps, xs, cdf_of_qs):
        if x != x:  # NaN
            non_convergence += 1
            prev_x = None
            continue
        # A finite x landing exactly on a support boundary while p is interior is suspicious -- a
        # clamp-masked non-convergence, or (discrete) a legitimate point mass. The closed/open flag
        # alone doesn't settle it: a CONTINUOUS distribution assigns zero probability to any single
        # point, so landing on a boundary is suspicious even if marked closed (Beta's closed-but-
        # continuous lower bound at 0 flagged a real underflow-to-0 defect here) -- except a mixed
        # distribution with a genuine atom there (Tweedie), which this can't tell apart from a
        # defect and reports as a candidate, mirroring difftest-ci-gate.js's KNOWN_ISSUES pattern.
        # A DISCRETE distribution's CLOSED boundary is excluded (e.g. Bernoulli at 0 is the norm).
        interior_p = BOUNDARY_P_TOL < p < 1 - BOUNDARY_P_TOL
        lo_suspicious = dist_type == 'continuous' or not lo_closed
        hi_suspicious = dist_type == 'continuous' or not hi_closed
        at_lo = math.isfinite(lo_value) and lo_suspicious and x == lo_value
        at_hi = math.isfinite(hi_value) and hi_suspicious and x == hi_value
        strictly_outside = (math.isfinite(lo_value) and x < lo_value) or \
            (math.isfinite(hi_value) and x > hi_value)
        if strictly_outside or (interior_p and (at_lo or at_hi)):
            out_of_support += 1
        if prev_x is not None and prev_x - x > MONOTONICITY_TOL * max(1, abs(x)):
            non_monotonicity += 1
        prev_x = x
        if cdf_of_q == cdf_of_q:  # not NaN
            err = abs(cdf_of_q - p)
            errors.append(err)
            if worst is None or err > worst[0]:
                worst = (err, p, x, cdf_of_q)
    return {
        'errors': errors,
        'hard_failures': {
            'non_convergence': non_convergence,
            'out_of_support': out_of_support,
            'non_monotonicity': non_monotonicity,
        },
        'worst': worst,
    }

def sweep_roundtrip(entries, ps, seed):
    points = [{'name': e['name'], 'params': e['params'], 'p': p} for e in entries for p in ps]
    results = _run_bridge(['eval'], json.dumps(points))
    n = len(ps)
    report = {}
    for i, e in enumerate(entries):
        chunk = results[i * n:(i + 1) * n]
        bridge_errors = sum(1 for r in chunk if 'error' in r)
        xs = [decode(r['x']) if 'error' not in r else float('nan') for r in chunk]
        cdf_of_qs = [decode(r['cdfOfQ']) if 'error' not in r else float('nan') for r in chunk]
        hf = _hard_failures(e['name'], e['params'], ps, xs, cdf_of_qs, e['support'], e['type'])
        finite_errors = hf['errors']
        report[e['name']] = {
            'n': n,
            'type': e['type'],
            'has_closed_form_q': e['hasClosedFormQ'],
            'errors': bridge_errors,
            'max_roundtrip_error': max(finite_errors) if finite_errors else None,
            'median_roundtrip_error': statistics.median(finite_errors) if finite_errors else None,
            'worst_case': None if hf['worst'] is None else {
                'params': e['params'], 'p': hf['worst'][1], 'x': hf['worst'][2],
                'cdf_of_q': hf['worst'][3], 'roundtrip_error': hf['worst'][0],
            },
            'hard_failures': hf['hard_failures'],
        }
    return report

def build_roundtrip_report(entries, seed, n):
    ps = generate_roundtrip_ps(random.Random(seed), n)
    roundtrip = sweep_roundtrip(entries, ps, seed)
    return {
        'seed': seed,
        'n_per_distribution': n,
        # Acceptance criterion: "report states smallest p and largest 1-p probed".
        'probe_range': {'p_min': min(ps), 'p_max': max(ps), 'one_minus_p_min': 1 - max(ps)},
        'entries': roundtrip,
    }

# ─── PILOT-FAMILY ABSOLUTE ULP ACCURACY ─────────────────────────────────────────────────────────
# Forward cdf reference formulas, duplicated verbatim from difftest-dist.py's REF_FN (same no-cross-
# import convention as ulp_diff above) -- needed here as the function mpmath_quantile() inverts.
def Preg(a, x):  # DLMF 8.2.4: regularized lower incomplete gamma P(a, x).
    return mpf(0) if x <= 0 else gammainc(a, 0, x, regularized=True)

def Qreg(a, x):  # DLMF 8.2.4: regularized upper incomplete gamma Q(a, x) = 1 - P(a, x).
    return mpf(1) if x <= 0 else gammainc(a, x, mpmath.inf, regularized=True)

def Ireg(a, b, x):  # DLMF 8.17.1: regularized incomplete beta I_x(a, b).
    x = mpf(x)
    return mpf(0) if x <= 0 else mpf(1) if x >= 1 else betainc(a, b, 0, x, regularized=True)

def gamma_cdf(params, x):  # DLMF 8.2.4: F(x) = P(alpha, beta*x).
    alpha, beta = mpf(params[0]), mpf(params[1])
    return Preg(alpha, beta * mpf(x))

def beta_cdf(params, x):  # DLMF 8.17.1: F(x) = I_x(alpha, beta).
    alpha, beta = mpf(params[0]), mpf(params[1])
    return Ireg(alpha, beta, x)

def chi2_cdf(params, x):  # Chi-squared with k df is Gamma(k/2, 1/2) (DLMF 8.2.4): F(x) = P(k/2, x/2).
    k = mpf(round(params[0]))
    return Preg(k / 2, mpf(x) / 2)

def f_cdf(params, x):  # F(x) = I_{d1*x/(d1*x+d2)}(d1/2, d2/2) -- incomplete-beta identity.
    d1, d2 = mpf(round(params[0])), mpf(round(params[1]))
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    return Ireg(d1 / 2, d2 / 2, d1 * x / (d1 * x + d2))

def studentt_cdf(params, x):  # Abramowitz & Stegun 26.7.1, z = nu/(nu+x^2).
    nu, x = mpf(params[0]), mpf(x)
    ib = Ireg(nu / 2, mpf('0.5'), nu / (nu + x * x))
    return 1 - ib / 2 if x >= 0 else ib / 2

def inversegamma_cdf(params, x):  # DLMF 8.2.4: F(x) = Q(alpha, beta/x), gamma CDF under x->1/x.
    alpha, beta = mpf(params[0]), mpf(params[1])
    x = mpf(x)
    return mpf(0) if x <= 0 else Qreg(alpha, beta / x)

CDF_FN = {
    'Gamma': gamma_cdf, 'Beta': beta_cdf, 'Chi2': chi2_cdf, 'F': f_cdf,
    'StudentT': studentt_cdf, 'InverseGamma': inversegamma_cdf,
}

# Duplicated verbatim from difftest-dist.py's DIST_SPEC helpers (same no-cross-import convention).
def _shape_params(*names):
    return [{'name': n, 'lo': 0.01, 'hi': 100, 'log_uniform': True} for n in names]

def _df_params(*names):
    return [{'name': n, 'lo': 1, 'hi': 200, 'log_uniform': True} for n in names]

def _draw_param(rng, arg):
    if arg['log_uniform']:
        lo, hi = math.log(arg['lo']), math.log(arg['hi'])
        return math.exp(rng.uniform(lo, hi))
    return rng.uniform(arg['lo'], arg['hi'])

def _formula_self_check_quantile():
    tol = mpf('1e-45')
    assert mpmath.almosteq(gamma_cdf([1, 1], mpmath.log(2)), mpf('0.5'), rel_eps=tol), \
        'Gamma(1,1) is Exponential(1): median should be ln(2)'
    assert mpmath.almosteq(beta_cdf([1, 1], mpf('0.5')), mpf('0.5'), rel_eps=tol), \
        'Beta(1,1) is Uniform(0,1): cdf(p) should equal p'
    assert mpmath.almosteq(chi2_cdf([2], -2 * mpmath.log(1 - mpf('0.3'))), mpf('0.3'), rel_eps=tol), \
        'Chi2(2) is Exponential(rate=0.5): quantile(p) should equal -2*ln(1-p)'
    assert mpmath.almosteq(studentt_cdf([1], 1), mpf('0.75'), rel_eps=tol), \
        'StudentT(nu=1) is standard Cauchy: cdf(1) should equal 0.75 (quantile(0.75)=tan(pi/4)=1)'
    assert mpmath.almosteq(f_cdf([1, 1], mpf(1)), 2 / mpmath.pi * mpmath.atan(mpmath.sqrt(mpf(1))), rel_eps=tol), \
        'F(1,1) is squared-Cauchy: cdf(x) should equal 2/pi*atan(sqrt(x))'
    assert mpmath.almosteq(inversegamma_cdf([2, 3], mpf(2)), 1 - gamma_cdf([2, 3], mpf(1) / mpf(2)), rel_eps=tol), \
        'InverseGamma(alpha,beta) cdf(x) should equal 1 - Gamma(alpha,beta) cdf(1/x)'
    # The six checks above only exercise the forward cdf closed-form identities -- none of them
    # calls mpmath_quantile() itself, the bracket-expansion + bisection inverter its three branches
    # (log-space, logit-space, linear) below actually implement. Round-trip each branch through its
    # own cdf, with x0 chosen meaningfully far from the true root so the bracket-expansion while-loop
    # in _expand_and_bisect actually iterates rather than falling through to a single bisection.
    log_r = mpmath_quantile(gamma_cdf, [2, 1], mpf('0.001'), mpf(1), mpf(0), None)
    assert mpmath.almosteq(gamma_cdf([2, 1], log_r), mpf('0.001'), rel_eps=tol), \
        'mpmath_quantile log-space branch: gamma_cdf(quantile(p)) should round-trip to p'
    logit_r = mpmath_quantile(beta_cdf, [2, 3], mpf('0.001'), mpf('0.5'), mpf(0), mpf(1))
    assert mpmath.almosteq(beta_cdf([2, 3], logit_r), mpf('0.001'), rel_eps=tol), \
        'mpmath_quantile logit-space branch: beta_cdf(quantile(p)) should round-trip to p'
    lin_r = mpmath_quantile(studentt_cdf, [5], mpf('0.001'), mpf(100), None, None)
    assert mpmath.almosteq(studentt_cdf([5], lin_r), mpf('0.001'), rel_eps=tol), \
        'mpmath_quantile linear branch: studentt_cdf(quantile(p)) should round-trip to p'

def _expand_and_bisect(g, y0, gy0, iters=300):
    """g is f reparameterized so a fixed additive step in y is meaningful (see mpmath_quantile's
    three branches below); this shared bracket-expansion + bisection core is the only thing that
    differs between them. 300 iterations comfortably covers even a several-hundred-order-of-
    magnitude-wide bracket at mp.dps=50 (each iteration halves the interval; log2 of the widest
    bracket this harness can produce is nowhere near 300)."""
    step = mpf(2)
    if gy0 > 0:
        ya, yb = y0 - step, y0
        while g(ya) > 0:
            step *= 2
            ya = y0 - step
    else:
        ya, yb = y0, y0 + step
        while g(yb) < 0:
            step *= 2
            yb = y0 + step
    for _ in range(iters):
        ym = (ya + yb) / 2
        if g(ym) > 0:
            yb = ym
        else:
            ya = ym
    return (ya + yb) / 2

def mpmath_quantile(cdf_fn, params, p, x0, lo_bound, hi_bound):
    """Inverts cdf_fn via bracket expansion + bisection at mp.dps=50 (mirroring _qEstimateRoot's
    own bracketing strategy in src/dist/_distribution.js) -- not naked Newton, which can overshoot
    into an underflowed-pdf region for the heavy-tailed pilot members and never recover.

    A domain bounded at 0 (Gamma/Chi2/F/InverseGamma) or to (0,1) (Beta) bisects in log-space /
    logit-space, not on x directly: an additive x-step is meaningless once the true root can sit
    hundreds of orders of magnitude from x0 (e.g. Gamma(alpha=0.02) at small p roots within a few
    ULP of 1e-221) -- a linear search there overshoots past x<=0 (cdf is identically 0 there, a
    valid-but-wrong sign change) or needs an infeasible iteration count on a linear scale. Confirmed
    empirically: a first linear-bisection attempt returned negative references for Gamma/Beta at
    extreme shape parameters. See solutions/tooling/2026-08-11-2026-mpmath-quantile-reference-
    linear-bracket-magnitude-collapse.md"""
    p = mpf(p)

    def f(x):
        return cdf_fn(params, x) - p

    x0 = mpf(x0) if x0 == x0 and mpmath.isfinite(x0) else mpf(1)  # NaN/Infinity seed -> safe fallback

    if lo_bound == mpf(0) and hi_bound is None:
        y0 = mpmath.log(x0) if x0 > 0 else mpf('-700')
        g = lambda y: f(mpmath.e ** y)
        gy0 = g(y0)
        return mpmath.e ** y0 if gy0 == 0 else mpmath.e ** _expand_and_bisect(g, y0, gy0)

    if lo_bound == mpf(0) and hi_bound == mpf(1):
        # 1e-40, not 1e-300: mp.dps=50 only carries ~50 significant decimal digits, so
        # 1 - mpf('1e-300') silently rounds back to exactly 1 (dividing by 1-x0c below would then
        # raise ZeroDivisionError) -- the clamp epsilon must stay within the working precision.
        x0c = min(max(x0, mpf('1e-40')), 1 - mpf('1e-40'))
        y0 = mpmath.log(x0c / (1 - x0c))
        g = lambda y: f(1 / (1 + mpmath.e ** (-y)))
        gy0 = g(y0)
        yr = y0 if gy0 == 0 else _expand_and_bisect(g, y0, gy0)
        return 1 / (1 + mpmath.e ** (-yr))

    # Unbounded / not-bounded-at-a-finite-edge domain (StudentT): the root doesn't need to span
    # hundreds of orders of magnitude away from x0, so a plain additive bracket search is safe.
    fx0 = f(x0)
    return x0 if fx0 == 0 else _expand_and_bisect(f, x0, fx0)

PILOT_SPEC = {
    'Gamma': {'params': _shape_params('alpha', 'beta'), 'lo_bound': mpf(0), 'hi_bound': None},
    'Beta': {'params': _shape_params('alpha', 'beta'), 'lo_bound': mpf(0), 'hi_bound': mpf(1)},
    'Chi2': {'params': _df_params('k'), 'lo_bound': mpf(0), 'hi_bound': None},
    'F': {'params': _df_params('d1', 'd2'), 'lo_bound': mpf(0), 'hi_bound': None},
    'StudentT': {'params': [{'name': 'nu', 'lo': 0.1, 'hi': 200, 'log_uniform': True}],
                 'lo_bound': None, 'hi_bound': None},
    'InverseGamma': {'params': _shape_params('alpha', 'beta'), 'lo_bound': mpf(0), 'hi_bound': None},
}
N_PILOT_DEFAULT = 100
# Calibrated from the n=150/seed=42 run (mpmath 1.4.1) at ~3-5x headroom over each distribution's
# typical (non-defect) max_ulp, same convention as difftest-dist.py's ulp_ceiling comment. Left at
# the healthy level rather than inflated above a known defect (unlike that file, no CI gate consumes
# these values here): Beta, F, and StudentT genuinely exceed theirs on real accuracy defects this
# harness surfaced during implementation, left unfixed per #1269's explicit scope and routed to
# follow-up issues instead.
PILOT_ULP_CEILING = {
    'Gamma': 65536, 'Beta': 65536, 'Chi2': 32768, 'F': 100000, 'StudentT': 65536,
    'InverseGamma': 65536,
}

def sweep_pilot_absolute(seed, n):
    rng = random.Random(seed)
    ps = generate_roundtrip_ps(rng, n)
    draws = []
    for name, spec in PILOT_SPEC.items():
        for p in ps:
            params = [_draw_param(rng, arg) for arg in spec['params']]
            draws.append((name, params, p))
    points = [{'name': name, 'params': params, 'p': p} for name, params, p in draws]
    bridged = _run_bridge(['eval'], json.dumps(points))
    results = {name: {'ulps': [], 'errors': 0} for name in PILOT_SPEC}
    for (name, params, p), got in zip(draws, bridged):
        if 'error' in got:
            results[name]['errors'] += 1
            continue
        x = decode(got['x'])
        if x != x:  # a NaN q(p) is a round-trip-detected non-convergence, not an ULP-accuracy point
            results[name]['errors'] += 1
            continue
        spec = PILOT_SPEC[name]
        ref = float(mpmath_quantile(CDF_FN[name], params, p, x, spec['lo_bound'], spec['hi_bound']))
        results[name]['ulps'].append((ulp_diff(ref, x), name, params, p, ref, x))
    return results

def build_pilot_report(seed, n):
    results = sweep_pilot_absolute(seed, n)
    entries = {}
    for name, data in results.items():
        rows = data['ulps']
        finite = [r[0] for r in rows if r[0] != float('inf')]
        worst = max(rows, key=lambda r: r[0]) if rows else None
        max_ulp = worst[0] if worst else None
        ceiling = PILOT_ULP_CEILING[name]
        entries[f'{name}.quantile'] = {
            'n': len(rows),
            'errors': data['errors'],
            'divergences': len(rows) - len(finite),
            'max_ulp': max_ulp,
            'median_ulp': statistics.median(finite) if finite else None,
            'p99_ulp': (statistics.quantiles(finite, n=100)[98] if len(finite) >= 2
                        else (finite[0] if finite else None)),
            'ulp_ceiling': ceiling,
            'ceiling_exceeded': ceiling is not None and max_ulp not in (None, float('inf')) and max_ulp > ceiling,
            'domain': {'params': PILOT_SPEC[name]['params'], 'p_range': [P_TAIL_LO, 1 - P_TAIL_LO]},
            'worst_case': None if worst is None else {
                'params': worst[2], 'p': worst[3], 'mpmath_ref': worst[4], 'ranjs_value': worst[5],
            },
        }
    return entries

def _parse_argv():
    def flag_value(name, default, cast):
        return cast(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
    return (
        flag_value('--seed', DEFAULT_SEED, int),
        flag_value('--out', DEFAULT_OUT, str),
        flag_value('--n', N_ROUNDTRIP_DEFAULT, int),
        flag_value('--pilot-n', N_PILOT_DEFAULT, int),
        '--pilot-only' in sys.argv,
        '--roundtrip-only' in sys.argv,
    )

def main():
    _self_check()
    print('ulp_diff self-check passed')
    _formula_self_check_quantile()
    print('quantile reference-formula self-check passed')
    seed, out_path, n, pilot_n, pilot_only, roundtrip_only = _parse_argv()

    report = {'seed': seed, 'mpmath_version': mpmath.__version__, 'mp_dps': mp.dps}

    if not pilot_only:
        entries = catalog()
        report['roundtrip'] = build_roundtrip_report(entries, seed, n)
        rt = report['roundtrip']['entries']
        n_hard = sum(sum(e['hard_failures'].values()) for e in rt.values())
        print(f'roundtrip: {len(rt)} distributions, probe range {report["roundtrip"]["probe_range"]}, '
              f'{n_hard} hard-failure point(s) across all distributions')

    if not roundtrip_only:
        report['pilot'] = build_pilot_report(seed, pilot_n)
        for key, data in report['pilot'].items():
            flag = ' CEILING EXCEEDED' if data['ceiling_exceeded'] else ''
            print(f'  {key}: n={data["n"]} errors={data["errors"]} divergences={data["divergences"]} '
                  f'max={data["max_ulp"]} median={data["median_ulp"]}{flag}')

    with open(out_path, 'w') as f:
        json.dump(_sanitize_for_json(report), f, indent=2)
    print(f'Wrote {out_path}')

if __name__ == '__main__':
    main()
