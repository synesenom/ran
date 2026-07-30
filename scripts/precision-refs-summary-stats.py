"""
Reference value generation for test/precision-summary-stats.js (issue #1230).

All reference values are mpmath (mp.dps = 50) evaluations of the summary-statistics
functions in src/location/, src/dispersion/, src/shape/, src/dependence/, rounded to
the nearest float64 (shortest round-tripping decimal) and emitted as JS literals.
`shape/max` and `shape/min` are excluded -- they exist as files but are not re-exported
by src/shape/index.js, so they are not part of the public ran.shape surface.

Reference math is INDEPENDENT of ranjs's own implementation: every formula below is the
textbook statistical definition (sample variance with Bessel's correction, R-7 quantile
interpolation, tau-b concordant/discordant pair counting, Szekely-Rizzo double-centered
distance-covariance, the Bickel-Fruehwirth half-sample mode algorithm, etc.), re-derived
from first principles rather than transcribed from src/. mpmath's arbitrary-precision
arithmetic (mp.dps=50) is itself what makes this an independent check against ranjs's
float64 computation, even where the two share the same well-known formula -- there is no
second textbook formula for e.g. "sample mean".

Most functions here take a full array and return a single scalar (unlike src/dist/'s
pdf(x)/cdf(x), which naturally give five x-probes per parameter set). To keep the
"3-5 parameter sets x 5+ points" structure meaningful for this shape of function, points
are grouped as:
  - functions with an extra scalar/array argument (quantile's p, moment's (k, c), rank's
    element index, entropy's log base): parameter set = one fixed sample array, points =
    5 distinct argument values evaluated against that same array (mirrors the pdf/cdf
    x-probe pattern).
  - pure array-in, scalar-out functions (mean, variance, gini, kendall, pearson, ...):
    parameter set = one generation profile (sample size + value range), points = 5
    independently-drawn arrays (or array pairs / probability tuples) from that profile.
Sample arrays are generated with Python's stdlib `random.Random(seed)` -- deterministic,
reproducible, and independent of ranjs's own xoshiro128+ PRNG. Points are interior /
well-conditioned by construction (nonzero variance, no exact ties forced except in the
dedicated tie profile, contingency tables bounded away from the p01=0/p10=0 divergence
already covered by the existing behavioral tests in test/dependence.js) -- boundary and
NaN-producing edge cases stay in the behavioral test suite, matching the interior-point-only
convention already used by precision-refs-continuous.py / -discrete.py.

Requires: pip install mpmath (already in scripts/requirements.txt)
Usage: python3 scripts/precision-refs-summary-stats.py --check   # report mismatches only
       python3 scripts/precision-refs-summary-stats.py --emit    # write test/precision-summary-stats.js
"""
import json
import math
import os
import random
import subprocess
import sys
from collections import Counter

from mpmath import mp, mpf, sqrt, log

mp.dps = 50

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'test', 'precision-summary-stats.js')
EVAL_SCRIPT = os.path.join(REPO_ROOT, 'scripts', 'eval-summary-stats.js')

DEFAULT_TOL = 1e-12


# ─── independent mpmath reference formulas ───

def _mp(values):
    return [mpf(v) for v in values]


def mean_ref(values):
    v = _mp(values)
    return sum(v) / len(v)


def median_ref(values):
    v = sorted(_mp(values))
    n = len(v)
    if n % 2 == 1:
        return v[(n - 1) // 2]
    return (v[n // 2 - 1] + v[n // 2]) / 2


def quantile_ref(values, p):
    v = sorted(_mp(values))
    n = len(v)
    h = (n - 1) * mpf(p)
    h0 = int(mp.floor(h))
    if h0 < n - 1:
        return v[h0] + (h - h0) * (v[h0 + 1] - v[h0])
    return v[h0]


def variance_ref(values):
    v = _mp(values)
    n = len(v)
    m = mean_ref(values)
    return sum((x - m) ** 2 for x in v) / (n - 1)


def stdev_ref(values):
    return sqrt(variance_ref(values))


def moment_ref(values, k, c):
    v = _mp(values)
    n = len(v)
    return sum((x - mpf(c)) ** mpf(k) for x in v) / n


def geometric_mean_ref(values):
    if any(x == 0 for x in values):
        return mpf(0)
    v = _mp(values)
    n = len(v)
    return mp.e ** (sum(log(abs(x)) for x in v) / n)


def harmonic_mean_ref(values):
    v = _mp(values)
    n = len(v)
    return mpf(n) / sum(1 / x for x in v)


def midrange_ref(values):
    return (min(values) + max(values)) / mpf(2)


def _sign(d):
    if d > 0:
        return 1
    if d < 0:
        return -1
    return 0


def continuous_mode_ref(values):
    v = sorted(values)
    n = len(v)
    if n == 1:
        return mpf(v[0])
    if n == 2:
        return mpf(v[0] + v[1]) / 2
    if n == 3:
        left = v[1] - v[0]
        right = v[2] - v[1]
        if left < right:
            return mpf(v[0] + v[1]) / 2
        if left > right:
            return mpf(v[1] + v[2]) / 2
        return mpf(v[1])
    width = math.ceil(n / 2)
    best_i = 0
    best_range = v[width - 1] - v[0]
    for i in range(1, n - width + 1):
        r = v[i + width - 1] - v[i]
        if r < best_range:
            best_range = r
            best_i = i
    return continuous_mode_ref(v[best_i:best_i + width])


def trimean_ref(values):
    return (quantile_ref(values, 0.25) + 2 * median_ref(values) + quantile_ref(values, 0.75)) / 4


def rank_ref(values, at):
    v = values[at]
    less = sum(1 for x in values if x < v)
    equal = sum(1 for x in values if x == v)
    return mpf(less) + mpf(equal + 1) / 2


def rank_full_ref(values):
    return [rank_ref(values, i) for i in range(len(values))]


def skewness_ref(values):
    n = len(values)
    m = mean_ref(values)
    m2 = moment_ref(values, 2, m)
    m3 = moment_ref(values, 3, m)
    return sqrt(mpf(n * (n - 1))) * m3 / (mpf(n - 2) * m2 ** mpf('1.5'))


def kurtosis_ref(values):
    n = len(values)
    m = mean_ref(values)
    m2 = moment_ref(values, 2, m)
    m4 = moment_ref(values, 4, m)
    return mpf(n - 1) * (mpf(n + 1) * m4 / m2 ** 2 - 3 * mpf(n - 1)) / (mpf(n - 2) * mpf(n - 3))


def yule_ref(values):
    q1 = quantile_ref(values, 0.25)
    q3 = quantile_ref(values, 0.75)
    return (q1 + q3 - 2 * median_ref(values)) / (q3 - q1)


def cv_ref(values):
    return stdev_ref(values) / mean_ref(values)


def vmr_ref(values):
    return variance_ref(values) / mean_ref(values)


def md_ref(values):
    v = _mp(values)
    n = len(v)
    total = sum(abs(v[i] - v[j]) for i in range(n) for j in range(n))
    return total / mpf(n * n)


def rmd_ref(values):
    return md_ref(values) / mean_ref(values)


def gini_ref(values):
    return rmd_ref(values) / 2


def range_ref(values):
    return mpf(max(values) - min(values))


def iqr_ref(values):
    return quantile_ref(values, 0.75) - quantile_ref(values, 0.25)


def midhinge_ref(values):
    return (quantile_ref(values, 0.25) + quantile_ref(values, 0.75)) / 2


def qcd_ref(values):
    q1 = quantile_ref(values, 0.25)
    q3 = quantile_ref(values, 0.75)
    return (q3 - q1) / (q3 + q1)


def _distance_matrix(x):
    v = _mp(x)
    n = len(v)
    a = [[abs(v[i] - v[j]) for j in range(n)] for i in range(n)]
    row_mean = [sum(a[i]) / n for i in range(n)]
    grand_mean = sum(row_mean) / n
    return [[a[i][j] - row_mean[i] - row_mean[j] + grand_mean for j in range(n)] for i in range(n)]


def dvar_ref(x):
    n = len(x)
    a = _distance_matrix(x)
    total = sum(a[i][j] ** 2 for i in range(n) for j in range(n))
    return sqrt(total / mpf(n * n))


def dcov_ref(x, y):
    n = len(x)
    a = _distance_matrix(x)
    b = _distance_matrix(y)
    total = sum(a[i][j] * b[i][j] for i in range(n) for j in range(n))
    return sqrt(total / mpf(n * n))


def dcor_ref(x, y):
    return dcov_ref(x, y) / sqrt(dvar_ref(x) * dvar_ref(y))


def entropy_ref(probabilities, base):
    logdiv = mpf(1) if base is None else log(mpf(base))
    return -sum(mpf(p) * log(mpf(p)) / logdiv for p in probabilities)


def kullback_leibler_ref(p, q):
    return sum(mpf(pi) * log(mpf(pi) / mpf(qi)) for pi, qi in zip(p, q) if pi > 0)


def covariance_ref(x, y):
    xv, yv = _mp(x), _mp(y)
    n = len(xv)
    mx, my = mean_ref(x), mean_ref(y)
    return sum((xv[i] - mx) * (yv[i] - my) for i in range(n)) / (n - 1)


def pearson_ref(x, y):
    return covariance_ref(x, y) / (stdev_ref(x) * stdev_ref(y))


def spearman_ref(x, y):
    n = len(x)
    rx = [rank_ref(x, i) for i in range(n)]
    ry = [rank_ref(y, i) for i in range(n)]
    return pearson_ref(rx, ry)


def _ties_correction(v):
    counts = Counter(v)
    return sum(t * (t - 1) // 2 for t in counts.values() if t > 1)


def kendall_ref(x, y):
    n = len(x)
    nc = nd = 0
    for i in range(n):
        for j in range(i):
            p = _sign(x[i] - x[j]) * _sign(y[i] - y[j])
            if p > 0:
                nc += 1
            elif p < 0:
                nd += 1
    n0 = n * (n - 1) // 2
    n1 = _ties_correction(x)
    n2 = _ties_correction(y)
    return mpf(nc - nd) / sqrt(mpf((n0 - n1) * (n0 - n2)))


def somers_d_ref(x, y):
    n = len(x)
    nc = nd = tx = 0
    for i in range(n):
        for j in range(i):
            dx = x[i] - x[j]
            dy = y[i] - y[j]
            if dx == 0:
                tx += 1
            p = _sign(dx) * _sign(dy)
            if p > 0:
                nc += 1
            elif p < 0:
                nd += 1
    denom = n * (n - 1) // 2 - tx
    return mpf(nc - nd) / mpf(denom)


def point_biserial_ref(x, y):
    n = len(x)
    x1 = [x[i] for i in range(n) if y[i] == 1]
    x0 = [x[i] for i in range(n) if y[i] == 0]
    n1, n0 = len(x1), len(x0)
    m1 = sum(_mp(x1)) / n1
    m0 = sum(_mp(x0)) / n0
    s = stdev_ref(x)
    return (m1 - m0) * sqrt(mpf(n0 * n1) / mpf(n * (n - 1))) / s


def odds_ratio_ref(p00, p01, p10, p11):
    return (mpf(p00) * mpf(p11)) / (mpf(p01) * mpf(p10))


def yule_q_ref(p00, p01, p10, p11):
    orr = odds_ratio_ref(p00, p01, p10, p11)
    return (orr - 1) / (orr + 1)


def yule_y_ref(p00, p01, p10, p11):
    orr = sqrt(odds_ratio_ref(p00, p01, p10, p11))
    return (orr - 1) / (orr + 1)


REF_FN = {
    'mean': lambda values: mean_ref(values),
    'median': lambda values: median_ref(values),
    'geometricMean': lambda values: geometric_mean_ref(values),
    'harmonicMean': lambda values: harmonic_mean_ref(values),
    'midrange': lambda values: midrange_ref(values),
    'mode': lambda values: continuous_mode_ref(values),
    'trimean': lambda values: trimean_ref(values),
    'quantile': lambda values, p: quantile_ref(values, p),
    'moment': lambda values, k, c: moment_ref(values, k, c),
    'rank': lambda values: rank_full_ref(values),
    'skewness': lambda values: skewness_ref(values),
    'kurtosis': lambda values: kurtosis_ref(values),
    'yule': lambda values: yule_ref(values),
    'cv': lambda values: cv_ref(values),
    'vmr': lambda values: vmr_ref(values),
    'md': lambda values: md_ref(values),
    'rmd': lambda values: rmd_ref(values),
    'gini': lambda values: gini_ref(values),
    'range': lambda values: range_ref(values),
    'iqr': lambda values: iqr_ref(values),
    'midhinge': lambda values: midhinge_ref(values),
    'qcd': lambda values: qcd_ref(values),
    'stdev': lambda values: stdev_ref(values),
    'variance': lambda values: variance_ref(values),
    'dVar': lambda x: dvar_ref(x),
    'entropy': lambda probabilities, base=None: entropy_ref(probabilities, base),
    'kullbackLeibler': lambda p, q: kullback_leibler_ref(p, q),
    'covariance': lambda x, y: covariance_ref(x, y),
    'pearson': lambda x, y: pearson_ref(x, y),
    'spearman': lambda x, y: spearman_ref(x, y),
    'kendall': lambda x, y: kendall_ref(x, y),
    'somersD': lambda x, y: somers_d_ref(x, y),
    'pointBiserial': lambda x, y: point_biserial_ref(x, y),
    'dCov': lambda x, y: dcov_ref(x, y),
    'dCor': lambda x, y: dcor_ref(x, y),
    'oddsRatio': lambda p00, p01, p10, p11: odds_ratio_ref(p00, p01, p10, p11),
    'yuleQ': lambda p00, p01, p10, p11: yule_q_ref(p00, p01, p10, p11),
    'yuleY': lambda p00, p01, p10, p11: yule_y_ref(p00, p01, p10, p11),
}


# ─── deterministic sample generation (independent of ranjs's own PRNG) ───

def _gen_real(seed, n, lo, hi):
    r = random.Random(seed)
    return [r.uniform(lo, hi) for _ in range(n)]


def _gen_ties(seed, n, lo, hi):
    r = random.Random(seed)
    return [float(r.randint(lo, hi)) for _ in range(n)]


def _gen_binary(seed, n, n_ones):
    r = random.Random(seed)
    idx = list(range(n))
    r.shuffle(idx)
    ones = set(idx[:n_ones])
    return [1 if i in ones else 0 for i in range(n)]


def _gen_prob(seed, n):
    r = random.Random(seed)
    return [r.uniform(0.05, 1.0) for _ in range(n)]


def _gen_contingency(seed):
    r = random.Random(seed)
    w = [r.uniform(0.05, 1.0) for _ in range(4)]
    s = sum(w)
    return [x / s for x in w]


REAL_PROFILES = [
    {'key': 'small_ties', 'n': 6, 'note': 'small n=6 with duplicate integer values (ties)',
     'gen': lambda seed: _gen_ties(seed, 6, 0, 5)},
    {'key': 'medium_mixed', 'n': 10, 'note': 'medium n=10, mixed positive/negative floats',
     'gen': lambda seed: _gen_real(seed, 10, -20, 30)},
    {'key': 'large_spread', 'n': 16, 'note': 'larger n=16, wide spread',
     'gen': lambda seed: _gen_real(seed, 16, -100, 100)},
]

POS_PROFILES = [
    {'key': 'pos_small', 'n': 6, 'note': 'small n=6, strictly positive',
     'gen': lambda seed: _gen_real(seed, 6, 0.5, 20)},
    {'key': 'pos_medium', 'n': 10, 'note': 'medium n=10, strictly positive',
     'gen': lambda seed: _gen_real(seed, 10, 0.5, 50)},
    {'key': 'pos_large', 'n': 16, 'note': 'larger n=16, strictly positive',
     'gen': lambda seed: _gen_real(seed, 16, 0.5, 80)},
]

PAIR_PROFILES = [
    {'key': 'pair_small', 'n': 6, 'note': 'small n=6 array pair'},
    {'key': 'pair_medium', 'n': 10, 'note': 'medium n=10 array pair'},
    {'key': 'pair_large', 'n': 16, 'note': 'larger n=16 array pair'},
]

BINARY_PROFILES = [
    {'key': 'bin_small', 'n': 6, 'n_ones': 3, 'note': 'small n=6, y in {0,1}'},
    {'key': 'bin_medium', 'n': 10, 'n_ones': 4, 'note': 'medium n=10, y in {0,1}'},
    {'key': 'bin_large', 'n': 14, 'n_ones': 6, 'note': 'larger n=14, y in {0,1}'},
]

PROB_PAIR_PROFILES = [
    {'key': 'prob_small', 'n': 5, 'note': 'small n=5 positive probability-like pair'},
    {'key': 'prob_medium', 'n': 8, 'note': 'medium n=8 positive probability-like pair'},
    {'key': 'prob_large', 'n': 12, 'note': 'larger n=12 positive probability-like pair'},
]

# `mode`'s continuous (Bickel-Fruehwirth half-sample) branch only fires when at least one
# array element is non-integer -- REAL_PROFILES['small_ties'] uses whole-number floats
# (Number.isInteger(3.0) is true in JS) and would silently dispatch to the discrete branch
# instead, so `mode` gets its own always-continuous small-n profile.
MODE_SMALL_PROFILE = {'key': 'mode_small', 'n': 6, 'note': 'small n=6, continuous values',
                       'gen': lambda seed: _gen_real(seed, 6, 0, 5)}

PROB_PROFILES = [
    {'key': 'entropy_small', 'n': 5, 'note': 'small n=5 probability array'},
    {'key': 'entropy_medium', 'n': 8, 'note': 'medium n=8 probability array'},
    {'key': 'entropy_large', 'n': 12, 'note': 'larger n=12 probability array'},
]


def _real_arrays(profile, seed_base):
    return [profile['gen'](seed_base + i) for i in range(5)]


def _pos_arrays(profile, seed_base):
    n = profile['n']
    return [_gen_real(seed_base + i, n, *_POS_RANGE[profile['key']]) for i in range(5)]


_POS_RANGE = {'pos_small': (0.5, 20), 'pos_medium': (0.5, 50), 'pos_large': (0.5, 80)}


def _pair_arrays(profile, seed_base):
    n = profile['n']
    pairs = []
    for i in range(5):
        x = _gen_real(seed_base + 2 * i, n, -10, 10)
        y = _gen_real(seed_base + 2 * i + 1, n, -10, 10)
        pairs.append((x, y))
    return pairs


def _binary_pairs(profile, seed_base):
    n = profile['n']
    pairs = []
    for i in range(5):
        x = _gen_real(seed_base + 2 * i, n, -10, 10)
        y = _gen_binary(seed_base + 2 * i + 1, n, profile['n_ones'])
        pairs.append((x, y))
    return pairs


def _prob_pairs(profile, seed_base):
    n = profile['n']
    pairs = []
    for i in range(5):
        p = _gen_prob(seed_base + 2 * i, n)
        q = _gen_prob(seed_base + 2 * i + 1, n)
        pairs.append((p, q))
    return pairs


def _contingency_tuples(seed_base):
    return [_gen_contingency(seed_base + i) for i in range(5)]


def grid():
    """Threshold-focused (fn, args, note, tol, at) tuples. See the module docstring for the
    "parameter set = profile, point = replicate draw (or argument variation)" rationale."""
    points = []

    def add(fn, args, note, tol=DEFAULT_TOL, at=None):
        points.append((fn, list(args), note, tol, at))

    # ─── location ───
    for i, profile in enumerate(REAL_PROFILES):
        for arr in _real_arrays(profile, 1000 + 100 * i):
            add('mean', [arr], f'mean: {profile["note"]}')
            add('median', [arr], f'median: {profile["note"]}')
            add('geometricMean', [arr], f'geometricMean: {profile["note"]} (abs before log)')
            add('midrange', [arr], f'midrange: {profile["note"]}')
            add('trimean', [arr], f'trimean: {profile["note"]}')

    for i, profile in enumerate([MODE_SMALL_PROFILE, REAL_PROFILES[1], REAL_PROFILES[2]]):
        for arr in _real_arrays(profile, 1500 + 100 * i):
            add('mode', [arr], f'mode: {profile["note"]} (continuous half-sample mode)', tol=1e-14)

    for i, profile in enumerate(POS_PROFILES):
        for arr in _pos_arrays(profile, 4000 + 100 * i):
            add('harmonicMean', [arr], f'harmonicMean: {profile["note"]}')

    # ─── shape: parameterized (fixed array, vary the extra argument) ───
    for i, profile in enumerate(REAL_PROFILES):
        arr = profile['gen'](5000 + 100 * i)
        m = mean_ref(arr)
        for p in [0.1, 0.25, 0.4, 0.6, 0.9]:
            add('quantile', [arr, p], f'quantile: {profile["note"]}, p={p}')
        for k, c in [(1, 0), (2, 0), (3, 0), (4, 0), (2, float(m))]:
            add('moment', [arr, k, c], f'moment: {profile["note"]}, k={k} c={"mean" if c else 0}')
        for at in range(5):
            add('rank', [arr], f'rank: {profile["note"]}, index={at}', tol=1e-14, at=at)

    # ─── shape / dispersion: pure array-in, scalar-out ───
    for i, profile in enumerate(REAL_PROFILES):
        for arr in _real_arrays(profile, 6000 + 100 * i):
            add('skewness', [arr], f'skewness: {profile["note"]}')
            add('kurtosis', [arr], f'kurtosis: {profile["note"]}')
            add('yule', [arr], f'yule: {profile["note"]}')
            add('cv', [arr], f'cv: {profile["note"]}')
            add('vmr', [arr], f'vmr: {profile["note"]}')
            add('md', [arr], f'md: {profile["note"]}')
            add('rmd', [arr], f'rmd: {profile["note"]}')
            add('gini', [arr], f'gini: {profile["note"]}')
            add('range', [arr], f'range: {profile["note"]}')
            add('iqr', [arr], f'iqr: {profile["note"]}')
            add('midhinge', [arr], f'midhinge: {profile["note"]}')
            add('qcd', [arr], f'qcd: {profile["note"]}')
            add('stdev', [arr], f'stdev: {profile["note"]}')
            add('variance', [arr], f'variance: {profile["note"]}')
            add('dVar', [arr], f'dVar: {profile["note"]}', tol=1e-10)

    # ─── dependence: two-array general pairs ───
    for i, profile in enumerate(PAIR_PROFILES):
        for x, y in _pair_arrays(profile, 7000 + 100 * i):
            add('covariance', [x, y], f'covariance: {profile["note"]}')
            add('pearson', [x, y], f'pearson: {profile["note"]}')
            add('spearman', [x, y], f'spearman: {profile["note"]}', tol=1e-13)
            add('kendall', [x, y], f'kendall: {profile["note"]}', tol=1e-13)
            add('somersD', [x, y], f'somersD: {profile["note"]}', tol=1e-13)
            add('dCov', [x, y], f'dCov: {profile["note"]}', tol=1e-10)
            add('dCor', [x, y], f'dCor: {profile["note"]}', tol=1e-10)

    # ─── dependence: domain-constrained pairs ───
    for i, profile in enumerate(BINARY_PROFILES):
        for x, y in _binary_pairs(profile, 8000 + 100 * i):
            add('pointBiserial', [x, y], f'pointBiserial: {profile["note"]}')

    for i, profile in enumerate(PROB_PAIR_PROFILES):
        for p, q in _prob_pairs(profile, 9000 + 100 * i):
            add('kullbackLeibler', [p, q], f'kullbackLeibler: {profile["note"]}')

    for i, profile in enumerate(PROB_PROFILES):
        probs = profile['gen'](10000 + 100 * i) if 'gen' in profile else _gen_prob(10000 + 100 * i, profile['n'])
        for base in [None, 2, 10, math.e, 5]:
            add('entropy', [probs] if base is None else [probs, base],
                f'entropy: {profile["note"]}, base={"natural" if base is None else base}')

    # ─── dependence: contingency-table scalars ───
    for i in range(3):
        for p00, p01, p10, p11 in _contingency_tuples(11000 + 100 * i):
            add('oddsRatio', [p00, p01, p10, p11], f'oddsRatio: contingency set {i}')
            add('yuleQ', [p00, p01, p10, p11], f'yuleQ: contingency set {i}')
            add('yuleY', [p00, p01, p10, p11], f'yuleY: contingency set {i}')

    return points


def num(x):
    # repr(float('inf')) is the Python literal 'inf', which is not valid JS (it would parse as
    # a ReferenceError to an undefined identifier) -- emit the JS spellings instead.
    x = float(x)
    if x != x:
        return 'NaN'
    if x == float('inf'):
        return 'Infinity'
    if x == float('-inf'):
        return '-Infinity'
    return repr(x)


def compute_refs(points):
    refs = []
    for fn, args, note, tol, at in points:
        val = REF_FN[fn](*args)
        if at is not None:
            val = val[at]
        refs.append(float(val))
    return refs


def compute_ranjs_values(points):
    payload = json.dumps([{'fn': fn, 'args': args} for fn, args, _, _, _ in points])
    result = subprocess.run(['node', EVAL_SCRIPT], input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('scripts/eval-summary-stats.js failed')
    return json.loads(result.stdout)


def decode(value, at):
    # Undoes eval-summary-stats.js's Infinity/NaN string tagging (JSON itself has no such
    # literals). `rank` returns an array -- index it here, mirroring the `at` field.
    if at is not None:
        value = value[at]
    if value == 'Infinity':
        return float('inf')
    if value == '-Infinity':
        return float('-inf')
    if value == 'NaN':
        return float('nan')
    return value


def _is_divergent(x):
    return x != x or x in (float('inf'), float('-inf'))


def _mismatch_message(fn, args, ref, value, tol, note):
    if _is_divergent(ref):
        if value == ref or (value != value and ref != ref):
            return None
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} (divergent reference) ({note})'
    if _is_divergent(value):
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} (ranjs diverges, reference does not) ({note})'
    if ref == 0:
        if abs(value) > tol:
            return f'  MISMATCH {fn}{args} got {value!r} want 0 ({note})'
        return None
    rel = abs(value - ref) / abs(ref)
    if rel > tol:
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} rel {rel:.2e} tol {tol:.0e} ({note})'
    return None


def check(points, refs, ranjs_values):
    bad = 0
    checked = 0
    for (fn, args, note, tol, at), ref, got in zip(points, refs, ranjs_values):
        if 'error' in got:
            print(f'  ERROR {fn}{args}: {got["error"]}', flush=True)
            bad += 1
            continue
        checked += 1
        message = _mismatch_message(fn, args, ref, decode(got['value'], at), tol, note)
        if message:
            print(message, flush=True)
            bad += 1
    print(f'Checked {checked} points, {bad} mismatches', flush=True)
    return bad


TEMPLATE = """/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
// ESLint's no-loss-of-precision rule false-positives on a few 17-significant-digit literals
// that do round-trip exactly, so it is disabled for this generated reference file.
import {{ assert }} from 'chai'
import {{ describe, it }} from 'mocha'
import * as location from '../src/location/index.js'
import * as dispersion from '../src/dispersion/index.js'
import * as shape from '../src/shape/index.js'
import * as dependence from '../src/dependence/index.js'

// Summary-statistics precision gate (issue #1230).
//
// Reference values are from mpmath 1.4.1 at mp.dps = 50, rounded to float64.
// Generator (also the source of every reference formula): scripts/precision-refs-summary-stats.py
//
// Covers src/location/, src/dispersion/, src/shape/, src/dependence/ (excluding shape/max and
// shape/min, which are not re-exported by src/shape/index.js). Reference math is INDEPENDENT
// of ranjs -- see the generator's module docstring for the "parameter set = profile, point =
// replicate draw (or argument variation)" grid design and its interior-point-only scope.
const FN = {{
  geometricMean: location.geometricMean,
  harmonicMean: location.harmonicMean,
  mean: location.mean,
  median: location.median,
  midrange: location.midrange,
  mode: location.mode,
  trimean: location.trimean,
  cv: dispersion.cv,
  dVar: dispersion.dVar,
  entropy: dispersion.entropy,
  gini: dispersion.gini,
  iqr: dispersion.iqr,
  md: dispersion.md,
  midhinge: dispersion.midhinge,
  qcd: dispersion.qcd,
  range: dispersion.range,
  rmd: dispersion.rmd,
  stdev: dispersion.stdev,
  variance: dispersion.variance,
  vmr: dispersion.vmr,
  kurtosis: shape.kurtosis,
  moment: shape.moment,
  quantile: shape.quantile,
  rank: shape.rank,
  skewness: shape.skewness,
  yule: shape.yule,
  covariance: dependence.covariance,
  dCov: dependence.dCov,
  dCor: dependence.dCor,
  kendall: dependence.kendall,
  kullbackLeibler: dependence.kullbackLeibler,
  oddsRatio: dependence.oddsRatio,
  pearson: dependence.pearson,
  pointBiserial: dependence.pointBiserial,
  somersD: dependence.somersD,
  spearman: dependence.spearman,
  yuleQ: dependence.yuleQ,
  yuleY: dependence.yuleY
}}

const REFS = [
{entries}
]

describe('summary statistics precision gate', () => {{
  REFS.forEach(({{ fn, args, ref, tol, note, at }}) => {{
    it(`${{fn}}(${{args.join(', ')}})${{at === null ? '' : `[${{at}}]`}} should match the mpmath mp.dps=50 reference (${{note}})`, () => {{
      let got = FN[fn](...args)
      if (at !== null) got = got[at]
      if (!isFinite(ref)) {{
        assert(Object.is(got, ref))
      }} else if (ref === 0) {{
        assert.approximately(got, 0, tol)
      }} else {{
        assert.approximately(got / ref, 1, tol)
      }}
    }})
  }})
}})
"""


def render(points, refs):
    lines = []
    for (fn, args, note, tol, at), ref in zip(points, refs):
        args_js = '[' + ', '.join(num(a) if not isinstance(a, list) else
                                   '[' + ', '.join(num(x) for x in a) + ']'
                                   for a in args) + ']'
        at_js = 'null' if at is None else str(at)
        lines.append(
            f"  {{ fn: '{fn}', args: {args_js}, ref: {num(ref)}, tol: {tol!r}, "
            f"note: '{note}', at: {at_js} }},"
        )
    content = TEMPLATE.format(entries='\n'.join(lines))
    with open(OUTPUT_PATH, 'w') as f:
        f.write(content)
    print(f'Wrote {OUTPUT_PATH} ({len(lines)} points)', flush=True)


def main():
    points = grid()
    refs = compute_refs(points)
    ranjs_values = compute_ranjs_values(points)
    bad = check(points, refs, ranjs_values)

    if '--emit' in sys.argv:
        if bad:
            print(f'Refusing to emit: {bad} mismatch(es) unresolved -- either the mechanism is '
                  f'understood (add a tol= override with a named-mechanism comment in grid()) or '
                  f'it is a genuine bug (file separately).', flush=True)
            sys.exit(1)
        render(points, refs)
        return

    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
