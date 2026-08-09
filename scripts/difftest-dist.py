"""
Differential-testing harness for the gamma/beta pilot family (issue #1265), extending #1264's
src/special/ sweep (difftest-special.py) to (distribution, params, x) points for Gamma, Beta,
Chi2, F, StudentT, InverseGamma -- they share the special-function chains #1264 already sweeps
(gammaLowerIncomplete/gammaUpperIncomplete; regularizedBetaIncomplete).

x = ranjs's own q(p) for p ~ Uniform(0.001, 0.999), via the batched eval-dist.js bridge which then
evaluates pdf(x)/cdf(x) on the same instance -- not a fixed x-domain (wastes draws in the tail for
parameter-scale-dependent supports) or an mpmath-side CDF inversion (~10-50x slower); see the
"x-sampling" decision in thoughts/plans/2026-08-09-1705-distribution-difftest-harness-pilot.md.

Live mpmath, out-of-band from `npm test`, same rationale as #1264 (decisions/0052). Standalone, no
cross-script imports: ulp_diff/_monotonic_bits/_self_check are duplicated verbatim from difftest-
special.py (fixed for the sign-remap bug in solutions/testing/2026-08-09-1444-ulp-diff-sign-remap-
same-sign-blind-self-check.md). pdf/cdf reference formulas are freshly written from textbook closed
forms (DLMF/A&S, cited per formula), independent of ranjs's src/dist/, guarded by
_formula_self_check() against a future transcription error.

Usage: npm run difftest:dist | python3 scripts/difftest-dist.py [--seed N] [--out PATH] [--N N]
"""
import json
import math
import random
import statistics
import struct
import subprocess
import sys

import mpmath
from mpmath import mp, mpf, loggamma, beta as betafn, gammainc, betainc, sqrt

mp.dps = 50

DEFAULT_SEED = 42
DEFAULT_OUT = '/tmp/difftest-dist-report.json'
EVAL_SCRIPT = 'scripts/eval-dist.js'

# ─── ULP METRIC ─── (duplicated verbatim from difftest-special.py:51-129, see module docstring)
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

# ─── REFERENCE FORMULAS ─── independent textbook closed forms, DLMF/A&S cited per function.
def Preg(a, x):  # DLMF 8.2.4: regularized lower incomplete gamma P(a, x).
    return mpf(0) if x <= 0 else gammainc(a, 0, x, regularized=True)

def Qreg(a, x):  # DLMF 8.2.4: regularized upper incomplete gamma Q(a, x) = 1 - P(a, x).
    return mpf(1) if x <= 0 else gammainc(a, x, mpmath.inf, regularized=True)

def Ireg(a, b, x):  # DLMF 8.17.1: regularized incomplete beta I_x(a, b).
    x = mpf(x)
    return mpf(0) if x <= 0 else mpf(1) if x >= 1 else betainc(a, b, 0, x, regularized=True)

def gamma_pdf(params, x):  # DLMF 8.2: f(x) = beta^alpha/Gamma(alpha) x^(alpha-1) exp(-beta*x).
    alpha, beta = mpf(params[0]), mpf(params[1])
    x = mpf(x)
    return mpf(0) if x <= 0 else mpmath.exp(
        alpha * mpmath.log(beta) - beta * x - loggamma(alpha) + (alpha - 1) * mpmath.log(x))

def gamma_cdf(params, x):  # DLMF 8.2.4: F(x) = P(alpha, beta*x).
    alpha, beta = mpf(params[0]), mpf(params[1])
    return Preg(alpha, beta * mpf(x))

def beta_pdf(params, x):  # DLMF 8.17.3-style beta density: x^(a-1)(1-x)^(b-1) / B(a,b).
    alpha, beta = mpf(params[0]), mpf(params[1])
    x = mpf(x)
    return mpf(0) if x <= 0 or x >= 1 else mpmath.exp(
        (alpha - 1) * mpmath.log(x) + (beta - 1) * mpmath.log(1 - x) - mpmath.log(betafn(alpha, beta)))

def beta_cdf(params, x):  # DLMF 8.17.1: F(x) = I_x(alpha, beta).
    alpha, beta = mpf(params[0]), mpf(params[1])
    return Ireg(alpha, beta, x)

def chi2_pdf(params, x):  # Chi-squared with k df is Gamma(k/2, 1/2) (DLMF 8.2).
    k = mpf(round(params[0]))
    return gamma_pdf([k / 2, mpf('0.5')], x)

def chi2_cdf(params, x):  # DLMF 8.2.4: F(x) = P(k/2, x/2).
    k = mpf(round(params[0]))
    return Preg(k / 2, mpf(x) / 2)

def f_pdf(params, x):  # F density via the incomplete-beta relation (NIST/DLMF 8.17).
    d1, d2 = mpf(round(params[0])), mpf(round(params[1]))
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    a, b = d1 / 2, d2 / 2
    return mpmath.exp(a * mpmath.log(d1 / d2) + (a - 1) * mpmath.log(x) - mpmath.log(betafn(a, b))
                       - (a + b) * mpmath.log(1 + d1 * x / d2))

def f_cdf(params, x):  # F(x) = I_{d1*x/(d1*x+d2)}(d1/2, d2/2) -- incomplete-beta identity.
    d1, d2 = mpf(round(params[0])), mpf(round(params[1]))
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    return Ireg(d1 / 2, d2 / 2, d1 * x / (d1 * x + d2))

def studentt_pdf(params, x):  # Abramowitz & Stegun 26.7.1.
    nu, x = mpf(params[0]), mpf(x)
    return mpmath.exp(-(nu + 1) / 2 * mpmath.log(1 + x * x / nu)) / (sqrt(nu) * betafn(mpf('0.5'), nu / 2))

def studentt_cdf(params, x):  # Abramowitz & Stegun 26.7.1, z = nu/(nu+x^2).
    nu, x = mpf(params[0]), mpf(x)
    ib = Ireg(nu / 2, mpf('0.5'), nu / (nu + x * x))
    return 1 - ib / 2 if x >= 0 else ib / 2

def inversegamma_pdf(params, x):  # 1/x transform of the gamma density (DLMF 8.2).
    alpha, beta = mpf(params[0]), mpf(params[1])
    x = mpf(x)
    return mpf(0) if x <= 0 else mpmath.exp(
        alpha * mpmath.log(beta) - beta / x - loggamma(alpha) - (alpha + 1) * mpmath.log(x))

def inversegamma_cdf(params, x):  # DLMF 8.2.4: F(x) = Q(alpha, beta/x), gamma CDF under x->1/x.
    alpha, beta = mpf(params[0]), mpf(params[1])
    x = mpf(x)
    return mpf(0) if x <= 0 else Qreg(alpha, beta / x)

REF_FN = {
    'Gamma': {'pdf': gamma_pdf, 'cdf': gamma_cdf}, 'Beta': {'pdf': beta_pdf, 'cdf': beta_cdf},
    'Chi2': {'pdf': chi2_pdf, 'cdf': chi2_cdf}, 'F': {'pdf': f_pdf, 'cdf': f_cdf},
    'StudentT': {'pdf': studentt_pdf, 'cdf': studentt_cdf},
    'InverseGamma': {'pdf': inversegamma_pdf, 'cdf': inversegamma_cdf},
}
# ─── FORMULA SELF-CHECK ─── catches a future transcription error via exact closed-form identities.
def _formula_self_check():
    tol = mpf('1e-45')
    assert mpmath.almosteq(gamma_pdf([1, 1], 1), mpmath.exp(-1), rel_eps=tol), \
        'Gamma(1,1) is Exponential(1): gamma_pdf(1,1; 1) should equal e^-1'
    assert mpmath.almosteq(beta_pdf([1, 1], mpf('0.5')), 1, rel_eps=tol), \
        'Beta(1,1) is Uniform(0,1): beta_pdf(1,1; x) should be constant 1'
    assert mpmath.almosteq(chi2_pdf([2], mpf(3)), mpf('0.5') * mpmath.exp(mpf('-1.5')), rel_eps=tol), \
        'Chi2(2) is Exponential(rate=0.5): chi2_pdf should match the textbook pdf directly'
    assert mpmath.almosteq(studentt_pdf([1], mpf(2)), 1 / (mpmath.pi * 5), rel_eps=tol), \
        'StudentT(nu=1) is standard Cauchy: studentt_pdf should match 1/(pi*(1+x^2))'
    d1, d2, xf = mpf(5), mpf(7), mpf('1.3')
    assert mpmath.almosteq(f_cdf([d1, d2], xf), beta_cdf([d1 / 2, d2 / 2], d1 * xf / (d1 * xf + d2)), rel_eps=tol), \
        'DLMF 8.17: f_cdf should equal beta_cdf at the shared incomplete-beta parameterization'

# ─── SWEEP CONFIGURATION ─── declarative: adding a distribution is a config entry, not driver code.
# ulp_ceiling values are calibrated from the 2026-08-09 n=10000/distribution run (seed=42, mpmath
# 1.4.1) at ~2-5x headroom over the measured max_ulp -- never a blind number (CLAUDE.md).
# Gamma.pdf/InverseGamma.pdf absorb two real defects the run found (CHANGELOG.md), unfixed per #1265.
def _shape_params(*names):
    return [{'name': n, 'lo': 0.01, 'hi': 100, 'log_uniform': True} for n in names]

def _df_params(*names):
    return [{'name': n, 'lo': 1, 'hi': 200, 'log_uniform': True} for n in names]

DIST_SPEC = {
    'Gamma': {  # ulp measured: pdf 1841 (alpha=81.2,beta=0.0495,x=1879.8); cdf 83 (alpha=14.27,beta=86.84,x=0.129).
        'params': _shape_params('alpha', 'beta'), 'methods': ['pdf', 'cdf'], 'n': 10000,
        'ulp_ceiling': {'pdf': 4096, 'cdf': 256},
    },
    'Beta': {  # ulp measured: pdf 1709 (alpha=89.8,beta=0.0292,x~1); cdf 31044 (alpha=68.2,beta=0.0301,x=0.9906).
        'params': _shape_params('alpha', 'beta'), 'methods': ['pdf', 'cdf'], 'n': 10000,
        'ulp_ceiling': {'pdf': 4096, 'cdf': 100000},
    },
    'Chi2': {  # ulp measured: pdf 1424 (k=159.2,x=141.5); cdf 50 (k=20.6,x=12.0).
        'params': _df_params('k'), 'methods': ['pdf', 'cdf'], 'n': 10000,
        'ulp_ceiling': {'pdf': 4096, 'cdf': 256},
    },
    'F': {  # ulp measured: pdf 479662 (d1=10,d2=1,x=522179.3); cdf 32148 (d1=116,d2=1,x=473304.0).
        'params': _df_params('d1', 'd2'), 'methods': ['pdf', 'cdf'], 'n': 10000,
        'ulp_ceiling': {'pdf': 1_500_000, 'cdf': 100000},
    },
    'StudentT': {  # ulp measured: pdf 1083 (nu=161.7,x=-1.571); cdf 43248 (nu=128.6,x=-4.06e-4).
        'params': [{'name': 'nu', 'lo': 0.1, 'hi': 200, 'log_uniform': True}], 'methods': ['pdf', 'cdf'],
        'n': 10000, 'ulp_ceiling': {'pdf': 4096, 'cdf': 150000},
    },
    'InverseGamma': {
        # ulp measured: pdf ~2.1e18 (alpha=0.0102,beta=0.230,x=7.58e162), from the x*x-overflow defect
        # (see CHANGELOG.md); cdf 2672 (alpha=0.0119,beta=3.635,x=4.596).
        'params': _shape_params('alpha', 'beta'), 'methods': ['pdf', 'cdf'], 'n': 10000,
        'ulp_ceiling': {'pdf': 5_000_000_000_000_000_000, 'cdf': 8192},
    },
}

# p bounded away from {0,1}: x lands inside the support, never at a singularity or tail.
P_LO, P_HI = 0.001, 0.999

def _draw_param(rng, arg):
    if arg['log_uniform']:
        lo, hi = math.log(arg['lo']), math.log(arg['hi'])
        return math.exp(rng.uniform(lo, hi))
    return rng.uniform(arg['lo'], arg['hi'])

def generate_points(spec, seed, n_override=None):
    """Seeded, reproducible (dist, params, p) draws. p is shared by every method in
    spec[dist]['methods'] so pdf/cdf compare at the same x, not independently-sampled points."""
    rng = random.Random(seed)
    draws = []
    for name, dist_spec in spec.items():
        n = n_override if n_override is not None else dist_spec['n']
        for _ in range(n):
            params = [_draw_param(rng, arg) for arg in dist_spec['params']]
            draws.append((name, params, rng.uniform(P_LO, P_HI)))
    return draws

# ─── SWEEP ORCHESTRATION ───
def compute_ranjs_values(draws):  # batches ALL draws into a single node subprocess call.
    payload = json.dumps([{'dist': name, 'params': params, 'p': p} for name, params, p in draws])
    result = subprocess.run(['node', EVAL_SCRIPT], input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('scripts/eval-dist.js failed')
    return json.loads(result.stdout)

def decode(value):  # undoes eval-dist.js's Infinity/NaN string tagging (JSON has no such literal).
    return {'Infinity': float('inf'), '-Infinity': float('-inf'), 'NaN': float('nan')}.get(value, value)

def _init_results(spec):
    return {f'{name}.{method}': {'ulps': [], 'errors': 0}
            for name, dist_spec in spec.items() for method in dist_spec['methods']}

def _record_error(results, spec, name):
    for method in spec[name]['methods']:
        results[f'{name}.{method}']['errors'] += 1

def _record_point(results, spec, name, params, x, got):
    for method in spec[name]['methods']:
        ref = float(REF_FN[name][method](params, x))
        value = decode(got[method])
        results[f'{name}.{method}']['ulps'].append((ulp_diff(ref, value), name, params, x, ref, value))

def sweep(spec, seed, n_override=None):
    draws = generate_points(spec, seed, n_override)
    bridged = compute_ranjs_values(draws)
    results = _init_results(spec)
    for (name, params, p), got in zip(draws, bridged):
        if 'error' in got:
            _record_error(results, spec, name)
            continue
        _record_point(results, spec, name, params, decode(got['x']), got)
    return results

def build_report(sweep_results, spec, seed):
    entries = {}
    for key, data in sweep_results.items():
        name, method = key.split('.')
        rows = data['ulps']
        # inf entries (NaN/divergence mismatches) would poison median/p99 -- tracked separately.
        finite = [r[0] for r in rows if r[0] != float('inf')]
        worst = max(rows, key=lambda r: r[0]) if rows else None
        max_ulp = worst[0] if worst else None
        ceiling = spec[name]['ulp_ceiling'][method]
        entries[key] = {
            'n': len(rows),
            'errors': data['errors'],
            'divergences': len(rows) - len(finite),
            'max_ulp': max_ulp,
            'median_ulp': statistics.median(finite) if finite else None,
            'p99_ulp': (statistics.quantiles(finite, n=100)[98] if len(finite) >= 2
                        else (finite[0] if finite else None)),
            'ulp_ceiling': ceiling,
            'ceiling_exceeded': ceiling is not None and max_ulp not in (None, float('inf')) and max_ulp > ceiling,
            'worst_case': None if worst is None else {
                'dist': worst[1], 'params': worst[2], 'x': worst[3],
                'mpmath_ref': worst[4], 'ranjs_value': worst[5],
            },
        }
    return {'seed': seed, 'mpmath_version': mpmath.__version__, 'entries': entries}

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

def _parse_argv():
    def flag_value(name, default, cast):
        return cast(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
    return (flag_value('--seed', DEFAULT_SEED, int), flag_value('--out', DEFAULT_OUT, str),
            flag_value('--N', None, int))

def main():
    _self_check()
    print('ulp_diff self-check passed')
    _formula_self_check()
    print('reference-formula self-check passed')
    seed, out_path, n_override = _parse_argv()
    report = build_report(sweep(DIST_SPEC, seed, n_override), DIST_SPEC, seed)
    with open(out_path, 'w') as f:
        json.dump(_sanitize_for_json(report), f, indent=2)
    print(f'mpmath {report["mpmath_version"]}, seed {seed}')
    for key, data in report['entries'].items():
        flag = ' CEILING EXCEEDED' if data['ceiling_exceeded'] else ''
        print(f'  {key}: n={data["n"]} errors={data["errors"]} divergences={data["divergences"]} '
              f'max={data["max_ulp"]} median={data["median_ulp"]} p99={data["p99_ulp"]} '
              f'ceiling={data["ulp_ceiling"]}{flag}')
    print(f'Wrote {out_path}')

if __name__ == '__main__':
    main()
