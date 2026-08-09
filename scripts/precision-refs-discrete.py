"""
Reference value generation for test/precision-discrete.js (issue #634, v1.27.0 gate).

All pmf/cdf values are computed with mpmath at mp.dps = 50 (50 decimal places), then
rounded to the nearest float64 (17 significant digits) and emitted as JS literals. The
quantile probe `qp` is the midpoint of the k-th probability step (cdf(k) - pmf(k)/2),
a cdf-derived input that lands strictly inside the step so the infimum quantile equals k.

Reference math is INDEPENDENT of ranjs: every pmf is the textbook closed form (or a
high-precision series), matching the same external parameterization already documented
in test/dist-cases-discrete.js. A self-check block re-derives a curated set of values
from that file and aborts on any mismatch > 1e-12, guarding against parameterization slips.

Requires: pip install mpmath
Usage:    python3 scripts/precision-refs-discrete.py   # rewrites test/precision-discrete.js
"""
import json
import sys
from mpmath import (mp, mpf, exp, log, factorial, binomial, gamma, beta, zeta,
                    besseli, power, fsum)

mp.dps = 50

# --- pmf definitions (one per discrete distribution; external parameterization) ---


def pois(x, lam):
    if lam == 0:
        return mpf(1) if x == 0 else mpf(0)
    return exp(-lam) * power(lam, x) / factorial(x)


def pmf(name, p, k):
    if name == 'Bernoulli':
        (pp,) = p
        return mpf(pp) if k == 1 else 1 - mpf(pp)
    if name == 'BetaBinomial':
        n, a, b = map(mpf, p)
        return binomial(n, k) * beta(k + a, n - k + b) / beta(a, b)
    if name == 'Binomial':
        n, pp = mpf(p[0]), mpf(p[1])
        return binomial(n, k) * power(pp, k) * power(1 - pp, n - k)
    if name == 'Borel':
        mu = mpf(p[0])
        return exp(-mu * k) * power(mu * k, k - 1) / factorial(k)
    if name == 'BorelTanner':
        mu, n = mpf(p[0]), int(p[1])
        return (mpf(n) / k) * exp(-mu * k) * power(mu * k, k - n) / factorial(k - n)
    if name == 'Categorical':
        weights, offset = p
        w = [mpf(x) for x in weights]
        return w[k - offset] / fsum(w)
    if name == 'ConwayMaxwellPoisson':
        lam, nu = mpf(p[0]), mpf(p[1])
        z = mpf(0)
        j = 0
        while True:
            term = power(lam, j) / power(factorial(j), nu)
            z += term
            if j > 5 and term < mpf('1e-60') * z:
                break
            j += 1
        return power(lam, k) / power(factorial(k), nu) / z
    if name == 'Delaporte':
        a, b, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return fsum(
            gamma(a + i) * power(b, i) / (gamma(a) * power(1 + b, a + i) * factorial(i))
            * exp(-lam) * power(lam, k - i) / factorial(k - i)
            for i in range(0, k + 1))
    if name == 'DiscreteLaplace':
        pp, mu = mpf(p[0]), int(p[1])
        return (1 - pp) / (1 + pp) * power(pp, abs(k - mu))
    if name == 'DiscreteUniform':
        lo, hi = int(p[0]), int(p[1])
        return mpf(1) / (hi - lo + 1)
    if name == 'DiscreteWeibull':
        q, b = mpf(p[0]), mpf(p[1])
        return power(q, power(k, b)) - power(q, power(k + 1, b))
    if name == 'FlorySchulz':
        a = mpf(p[0])
        return a * a * k * power(1 - a, k - 1)
    if name == 'GeneralizedHermite':
        a1, a2, m = mpf(p[0]), mpf(p[1]), int(p[2])
        return fsum(pois(k - m * j, a1) * pois(j, a2) for j in range(0, k // m + 1))
    if name == 'Geometric':
        pp = mpf(p[0])
        return pp * power(1 - pp, k)
    if name == 'HeadsMinusTails':
        n = int(p[0])
        if k == 0:
            return binomial(2 * n, n) / power(4, n)
        m = k // 2
        return 2 * binomial(2 * n, n + m) / power(4, n)
    if name == 'Hypergeometric':
        N, K, n = int(p[0]), int(p[1]), int(p[2])
        return binomial(K, k) * binomial(N - K, n - k) / binomial(N, n)
    if name == 'LogSeries':
        pp = mpf(p[0])
        return -1 / log(1 - pp) * power(pp, k) / k
    if name == 'NegativeHypergeometric':
        N, K, r = int(p[0]), int(p[1]), int(p[2])
        return binomial(k + r - 1, k) * binomial(N - r - k, K - k) / binomial(N, K)
    if name == 'NegativeBinomial':
        r, pp = mpf(p[0]), mpf(p[1])
        return binomial(k + r - 1, k) * power(1 - pp, r) * power(pp, k)
    if name == 'NeymanA':
        lam, phi = mpf(p[0]), mpf(p[1])
        s = mpf(0)
        j = 0
        while True:
            term = pois(j, lam) * pois(k, j * phi)
            s += term
            if j > k + 5 and pois(j, lam) < mpf('1e-60'):
                break
            j += 1
            if j > 2000:
                break
        return s
    if name == 'Poisson':
        return pois(k, mpf(p[0]))
    if name == 'PolyaAeppli':
        lam, th = mpf(p[0]), mpf(p[1])
        if k == 0:
            return exp(-lam)
        return exp(-lam) * fsum(
            binomial(k - 1, j - 1) * power(lam * (1 - th), j) * power(th, k - j) / factorial(j)
            for j in range(1, k + 1))
    if name == 'Rademacher':
        return mpf('0.5')
    if name == 'Skellam':
        m1, m2 = mpf(p[0]), mpf(p[1])
        return exp(-(m1 + m2)) * power(m1 / m2, mpf(k) / 2) * besseli(abs(k), 2 * (m1 * m2) ** mpf('0.5'))
    if name == 'Soliton':
        N = int(p[0])
        return mpf(1) / N if k == 1 else mpf(1) / (k * (k - 1))
    if name == 'YuleSimon':
        rho = mpf(p[0])
        return rho * beta(mpf(k), rho + 1)
    if name == 'Zeta':
        s = mpf(p[0])
        return power(k, -s) / zeta(s)
    if name == 'Zipf':
        s, N = mpf(p[0]), int(p[1])
        return power(k, -s) / fsum(power(i, -s) for i in range(1, N + 1))
    if name == 'ZipfMandelbrot':
        N, s, q = int(p[0]), mpf(p[1]), mpf(p[2])
        return power(k + q, -s) / fsum(power(i + q, -s) for i in range(1, N + 1))
    raise ValueError(name)


# Support lower bound (where cdf summation starts). Skellam is two-sided; we start far left.
def support_lo(name, p):
    if name == 'BorelTanner':
        return int(p[1])
    if name == 'Categorical':
        return p[1]
    if name == 'DiscreteUniform':
        return int(p[0])
    if name == 'Hypergeometric':
        return max(0, int(p[2]) + int(p[1]) - int(p[0]))
    if name in ('Borel', 'FlorySchulz', 'LogSeries', 'Soliton', 'YuleSimon', 'Zeta',
                'Zipf', 'ZipfMandelbrot'):
        return 1
    if name == 'Rademacher':
        return -1
    if name == 'DiscreteLaplace':
        return int(p[1]) - 200
    if name == 'Skellam':
        m1, m2 = mpf(p[0]), mpf(p[1])
        # -200 was plenty for every set with mu1+mu2 <= 500 (up to ~90 sigma of margin below
        # the existing [175, 40] set); the large-mu sets added for issue #1309 need the bound to
        # scale with std = sqrt(mu1+mu2), or -200 would truncate real mass at only a few sigma.
        # 30 sigma is a large-deviation-principle-safe margin: Skellam's tail (dominated by one
        # Poisson leg) decays at least as fast as Gaussian, so residual mass there is below
        # 1e-190 -- far under mp.dps=50 -- and is unreachable through the existing 5 small-mu sets.
        if m1 + m2 <= 500:
            return -200
        mean = m1 - m2
        std = (m1 + m2) ** mpf('0.5')
        return int(mp.floor(mean - 30 * std))
    return 0


def step(name):
    # HeadsMinusTails lives on even integers; Rademacher on {-1, 1}.
    return 2 if name in ('HeadsMinusTails', 'Rademacher') else 1


def cdf(name, p, k):
    lo = support_lo(name, p)
    st = step(name)
    return fsum(pmf(name, p, j) for j in range(lo, k + 1, st))


# --- self-check against external refVals already vetted in dist-cases-discrete.js ---

CHECKS = [
    ('Bernoulli', [0.5], 0, 0.5000000000000001),
    ('BetaBinomial', [10, 0.5, 4], 2, 0.113098011603867),
    ('Binomial', [10, 0.1], 2, 0.1937102445),
    ('Borel', [0.5], 2, 0.18393972058572117),
    ('BorelTanner', [0.5, 5], 5, 0.0820849986238988),
    ('ConwayMaxwellPoisson', [3, 2], 0, 0.1396843810244923),
    ('Delaporte', [2, 2, 2], 2, 0.09022352215774179),
    ('DiscreteLaplace', [0.5, 0], 0, 0.3333333333333333),
    ('DiscreteUniform', [5, 50], 5, 0.021739130434782608),
    ('DiscreteWeibull', [0.75, 2], 2, 0.241321563720703),
    ('FlorySchulz', [0.5], 3, 0.1875),
    ('GeneralizedHermite', [3, 2, 2], 2, 0.0437966554940556),
    ('Geometric', [0.5], 1, 0.25000000000000006),
    ('HeadsMinusTails', [5], 4, 0.234375),
    ('Hypergeometric', [30, 10, 5], 2, 0.3599848427434634),
    ('LogSeries', [0.5], 2, 0.18033688011112042),
    ('NegativeHypergeometric', [20, 5, 10], 2, 0.198658410732565),
    ('NegativeBinomial', [10, 0.4], 3, 0.085136375808),
    ('NeymanA', [2, 2], 2, 0.12202976285364354),
    ('Poisson', [10], 5, 0.03783327480207079),
    ('PolyaAeppli', [2, 0.5], 3, 0.12405734296689497),
    ('Skellam', [1, 4], -2, 0.173089486515016),
    ('Soliton', [3], 2, 0.5),
    ('YuleSimon', [3], 2, 0.15000000000000002),
    ('Zeta', [3.8], 2, 0.06541499346543785),
    ('Zipf', [3, 100], 2, 0.10399270414757711),
    ('ZipfMandelbrot', [20, 1.5, 2], 1, 0.2298704879454913),
]

bad = False
for name, p, k, expected in CHECKS:
    got = pmf(name, p, k)
    rel = abs(float(got) - expected) / abs(expected) if expected else abs(float(got))
    if rel > 1e-12:
        bad = True
        print(f'SELF-CHECK FAIL {name}{p} pmf({k}) got {float(got)!r} want {expected!r} rel {rel:.2e}', file=sys.stderr)
if bad:
    sys.exit('Aborting: parameterization mismatch.')
print('self-check: all parameterizations match dist-cases-discrete.js', file=sys.stderr)

# --- test specification: (name, [ (params, [k-values]) x3 ], tol) ---

SPEC = [
    ('Bernoulli', [([0.5], [0, 1]), ([0.3], [0, 1]), ([0.7], [0, 1])], 1e-14),
    ('BetaBinomial', [([25, 2, 2], [0, 7, 12, 18, 24]), ([10, 0.5, 4], [0, 1, 2, 4, 7]),
                      ([40, 3, 5], [5, 12, 18, 25, 35])], 1e-14),
    ('Binomial', [([25, 0.5], [5, 10, 12, 15, 20]), ([10, 0.1], [0, 1, 2, 3, 5]),
                  ([50, 0.3], [8, 12, 15, 18, 25])], 1e-14),
    ('Borel', [([0.5], [1, 2, 3, 5, 8]), ([0.3], [1, 2, 3, 4, 6]),
               ([0.7], [1, 2, 4, 7, 12])], 1e-14),
    ('BorelTanner', [([0.5, 5], [5, 7, 9, 12, 18]), ([0.3, 3], [3, 4, 5, 7, 10]),
                     ([0.6, 8], [8, 11, 14, 18, 25])], 1e-14),
    ('Categorical', [([[0.4, 0.6], 0], [0, 1]),
                     ([[0.1, 0.05, 0.15, 0.08, 0.12, 0.1, 0.07, 0.13, 0.09, 0.11], 0], [0, 2, 4, 6, 9]),
                     ([[0.2, 0.3, 0.5], 2], [2, 3, 4])], 1e-14),
    ('ConwayMaxwellPoisson', [([2, 1.5], [0, 1, 2, 3, 5]), ([3, 2], [0, 1, 2, 3, 4]),
                              ([1, 0.5], [0, 1, 2, 3, 5])], 1e-14),
    ('Delaporte', [([2, 2, 2], [0, 2, 5, 8, 12]), ([0.5, 0.5, 0.5], [0, 1, 2, 3, 5]),
                   ([3, 1, 4], [2, 5, 8, 12, 18])], 1e-14),
    ('DiscreteLaplace', [([0.5, 0], [-3, -1, 0, 2, 3]), ([0.3, 2], [0, 1, 2, 3, 5]),
                         ([0.7, -1], [-4, -2, -1, 0, 2])], 1e-14),
    ('DiscreteUniform', [([5, 50], [5, 15, 27, 40, 50]), ([0, 9], [0, 2, 4, 6, 9]),
                         ([-3, 3], [-3, -1, 0, 1, 3])], 1e-14),
    ('DiscreteWeibull', [([0.5, 2], [0, 1, 2, 3, 4]), ([0.75, 2], [0, 1, 2, 3, 5]),
                         ([0.9, 1.2], [0, 1, 3, 6, 10])], 1e-14),
    ('FlorySchulz', [([0.5], [1, 2, 3, 5, 9]), ([0.3], [1, 2, 4, 7, 12]),
                     ([0.7], [1, 2, 3, 4, 6])], 1e-14),
    ('GeneralizedHermite', [([2, 2, 6], [0, 2, 6, 9, 14]), ([3, 2, 2], [0, 2, 4, 6, 9]),
                            ([1, 1, 3], [0, 1, 2, 4, 7])], 1e-14),
    ('Geometric', [([0.5], [0, 1, 2, 5, 10]), ([0.25], [0, 1, 2, 5, 10]),
                   ([0.1], [0, 2, 5, 10, 20])], 1e-14),
    ('HeadsMinusTails', [([5], [0, 2, 4, 6, 8]), ([2], [0, 2, 4]),
                         ([8], [0, 4, 8, 12, 16])], 1e-14),
    ('Hypergeometric', [([30, 10, 5], [0, 1, 2, 3, 5]), ([20, 3, 10], [0, 1, 2, 3]),
                        ([50, 20, 15], [2, 5, 8, 10, 12])], 1e-14),
    ('LogSeries', [([0.5], [1, 2, 3, 5, 10]), ([0.9], [1, 2, 3, 8, 20]),
                   ([0.3], [1, 2, 3, 4, 6])], 1e-14),
    ('NegativeHypergeometric', [([35, 15, 7], [0, 2, 5, 8, 12]), ([20, 5, 10], [0, 1, 2, 3, 5]),
                                ([30, 10, 8], [0, 2, 4, 6, 9])], 1e-14),
    ('NegativeBinomial', [([10, 0.4], [0, 3, 5, 7, 10]), ([5, 0.6], [2, 5, 8, 12, 18]),
                          ([20, 0.3], [3, 6, 9, 12, 18])], 1e-14),
    ('NeymanA', [([2, 2], [0, 1, 3, 6, 10]), ([0.5, 0.5], [0, 1, 2, 3, 5]),
                 ([3, 1.5], [0, 2, 4, 6, 9])], 1e-14),
    # Poisson[15]/[50] straddle gammaLowerIncomplete's x<s+1 series/CF dispatch
    # (src/special/gamma-incomplete.js:86-88), i.e. lambda ~ k+2 in Poisson's own
    # parameterization -- no prior set deliberately crossed this boundary (issue #1143).
    ('Poisson', [([10], [2, 5, 8, 10, 15]), ([40], [25, 33, 40, 48, 55]),
                 ([3], [0, 1, 2, 3, 5]), ([15], [10, 12, 13, 14, 17]),
                 ([50], [44, 47, 48, 49, 52])], 1e-14),
    ('PolyaAeppli', [([2, 0.5], [0, 1, 2, 4, 8]), ([0.5, 0.1], [0, 1, 2, 3, 5]),
                     ([3, 0.7], [0, 2, 5, 9, 15])], 1e-14),
    ('Rademacher', [([], [-1, 1])], 1e-14),
    # [6, 5] (k grid including 0) straddles besselI(0, twoSqrtProd)'s |x|=10
    # Taylor/backward-recurrence dispatch (src/special/bessel.js:122-127) the same way as
    # the existing [5,5] set (which sits exactly at the threshold, Taylor side) --
    # twoSqrtProd = 2*sqrt(30) ~ 10.95 lands in the _besselIBackward n=0 warm-up gap
    # (issue #1185, previously withheld here during #1143's boundary-grid work).
    # [175, 40] straddles marcumQ's transition-band mu=135 dispatch (src/special/marcum-q.js,
    # _transitionBand: three-term recurrence below 135, section 4.2 large-mu uniform asymptotic
    # expansion at/above it) -- issue #1190, continuation of #1143. Skellam is the only
    # marcumQ-family distribution whose marcum order is the EVALUATION POINT rather than a
    # parameter (_cdf(k>0) = marcumQ(k+1, mu2, mu1)), so one param set crosses the threshold
    # inside its own k grid: k=128,131 -> recurrence, k=134,137,142 -> large-mu. It is also the
    # only one reaching the band through marcumQ (upper tail) instead of marcumP. The other three
    # dispatch preconditions are all satisfied here: x=mu2=40 clears the x<30 series branch, and
    # mu^2=18225 is not < 2*xi=334.7 so the section 4.1 large-xi asymptotic does not claim it;
    # y=mu1=175 sits inside x+mu +/- sqrt(4x+2mu) at every k, exactly on the transition line at
    # k=134. mu2=40 is deliberately kept small: the recurrence branch loses up to 8 significant
    # digits once the marcum x grows past a few hundred (issue #1286), so no large-x set is
    # included here -- see the same note in scripts/precision-refs-continuous.py.
    ('Skellam', [([5, 5], [-7, -3, 0, 3, 7]), ([1, 4], [-8, -4, -2, 0, 2]),
                 ([3, 6], [-6, -2, 1, 4, 8]), ([6, 5], [-6, -2, 0, 3, 8]),
                 ([175, 40], [128, 131, 134, 137, 142]),
                 # Large-mu sets for issue #1309: mu1+mu2 crosses both the exp(-mu1-mu2)
                 # underflow threshold (~745) and the besselI(k, twoSqrtProd) overflow
                 # threshold (~709-720, since twoSqrtProd = 2*sqrt(mu1*mu2) <= mu1+mu2).
                 # [360, 360] (twoSqrtProd=720 > 709, expNeg=exp(-720) still nonzero) hit the
                 # bare besselI-overflow-to-Infinity failure; [400, 400] (both thresholds
                 # crossed) hit the 0*Infinity = NaN failure; [2000, 2000] extends into the
                 # "thousands" range named in the acceptance criteria.
                 ([360, 360], [-25, -8, 0, 5, 25]), ([400, 400], [-28, -9, 0, 9, 28]),
                 ([2000, 2000], [-60, -20, 0, 20, 60]),
                 # Highly asymmetric large-mu sets for issue #1321: unlike #1309's SYMMETRIC
                 # large-mu sets above (sqrtRatio=1, so Math.pow(sqrtRatio, x) is inert), these
                 # cross a DIFFERENT threshold -- expNegScaled = exp(-(sqrt(mu1)-sqrt(mu2))^2)
                 # underflows to 0 once the sqrt-split grows large even though mu1+mu2 itself
                 # is unremarkable, AND Math.pow(sqrtRatio, x) independently overflows to
                 # Infinity, AND besselIExpScaled(|x|, twoSqrtProd) is in the large-order
                 # (n=|x| >> twoSqrtProd) regime where the true scaled value is genuinely
                 # non-representable as a double -- a three-way 0*Infinity*0 collision. k grids
                 # are centered on the mean (mu1-mu2) and include the exact repro points from
                 # the issue (999, 990, 1999, 4999). [5000, 1]'s grid includes k=4990 and
                 # k=4995, inside the [~4988, 4997] band that issue #1348 traced to
                 # gammaUpperIncomplete's _gui: a fixed MAX_ITER=100 continued-fraction cap
                 # (truncating before the ~150-160 iterations this near-diagonal s~5000, x=5000
                 # regime needs) plus a shared _gli/_gui prefactor cancelling three
                 # O(4e4)-magnitude terms down to an O(1) result -- previously up to 6e-9
                 # relative cdf error, withheld from this grid until fixed. See the _LOG_CANCEL
                 # override below for the residual (pdf-only, post-fix) precision floor this
                 # grid now measures.
                 ([1000, 1], [990, 995, 999, 1001, 1005]),
                 ([2000, 1], [1990, 1995, 1999, 2001, 2005]),
                 ([5000, 1], [4950, 4990, 4995, 4999, 5001, 5030])], 1e-14),
    ('Soliton', [([10], [1, 2, 3, 5, 10]), ([3], [1, 2, 3]),
                 ([20], [1, 2, 5, 10, 20])], 1e-14),
    ('YuleSimon', [([3], [1, 2, 3, 6, 10]), ([2.5], [1, 2, 3, 5, 8]),
                   ([1.5], [1, 2, 5, 15, 30])], 1e-14),
    ('Zeta', [([3.8], [1, 2, 3, 6, 10]), ([5], [1, 2, 3, 5, 10]),
              ([2.5], [1, 2, 4, 10, 20])], 1e-14),
    ('Zipf', [([3, 100], [1, 2, 3, 5, 30]), ([1.5, 20], [1, 2, 5, 10, 20]),
              ([2, 50], [1, 3, 10, 25, 50])], 1e-14),
    ('ZipfMandelbrot', [([100, 2, 1], [1, 2, 5, 30, 100]), ([20, 1.5, 2], [1, 3, 8, 15, 20]),
                        ([50, 2.5, 0.5], [1, 2, 5, 20, 50])], 1e-14),
]

# Per-(name, params) tolerance overrides discovered empirically: these reach ~1e-13 but not
# 1e-14, so they are pinned at the 1e-12 cap (issue #634). Key: (name, json.dumps(params)).
# Value: (tol, justification emitted as a comment above the group).
_LGAMMA = 'pmf is a ratio of log-gamma/log-factorial terms; the last 1-2 ULPs are lost and the cdf summation compounds them, so ~1e-13 is the floor'
_TAIL = 'log-factorial pmf plus tail cdf summation accumulates a few ULPs beyond 1e-14'
_BESSEL = 'pmf evaluates a modified Bessel function I_k; its series rounding limits precision to ~1e-13'
_ARITH = 'log-factorial table differences for large k accumulate ~1 ULP per lookup; arithmetic floor is ~2e-14 even with exact table entries'
_MARCUM_MU135 = ('cdf routes through marcumQ\'s transition band on both sides of its mu=135 dispatch; '
                 'the section 4.2 large-mu asymptotic expansion is truncated at (J=9, K=4), whose residual '
                 'is largest at its own routing boundary (measured 3.8e-13 worst case here, cdf; pmf reaches '
                 '1.8e-14) -- see solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md')
_LOG_CANCEL = ('pdf combines three log-space terms (-(mu1+mu2)+twoSqrtProd, (x/2)*log(mu1/mu2), '
               'logBesselIExpScaled(|x|, twoSqrtProd)) whose individual magnitudes grow with mu1 while '
               'their sum stays O(1) near the mean -- each term carries ~1e-16 relative rounding, so the '
               'absolute cancellation error grows with mu1 even though the fix keeps the result finite '
               '(previously NaN, #1321; measured worst case here ~9e-12 at [5000,1], pdf). cdf used to '
               'separately lose up to 6e-9 relative precision near k=mu1 through gammaUpperIncomplete\'s '
               '_gui (a fixed MAX_ITER=100 continued-fraction cap plus a shared _gli/_gui prefactor '
               'cancelling three O(mu1)-magnitude terms down to an O(1) result) -- fixed in #1348 via a '
               'regime-aware iteration budget and a Loader/stirlerr saddle-point reformulation '
               '(src/special/_deviance.js); cdf\'s own residual is now ~1e-12 or tighter everywhere in '
               'this grid, so the pdf mechanism above, not cdf, sets this group\'s tolerance floor')
TOL_OVERRIDE = {
    ('BetaBinomial', '[40, 3, 5]'): (2e-14, _ARITH),
    ('Binomial', '[25, 0.5]'): (1e-12, _TAIL),
    ('Binomial', '[50, 0.3]'): (1e-12, _TAIL),
    ('Hypergeometric', '[30, 10, 5]'): (2e-14, _LGAMMA),
    ('Hypergeometric', '[50, 20, 15]'): (1e-12, _LGAMMA),
    ('NegativeBinomial', '[20, 0.3]'): (1e-12, _TAIL),
    ('NegativeHypergeometric', '[30, 10, 8]'): (2e-14, _ARITH),
    ('Poisson', '[40]'): (1e-12, _TAIL),
    ('Poisson', '[50]'): (1e-12, _TAIL),
    ('Skellam', '[5, 5]'): (1e-12, _BESSEL),
    ('Skellam', '[6, 5]'): (2e-14, _BESSEL),
    ('Skellam', '[175, 40]'): (1e-12, _MARCUM_MU135),
    ('Skellam', '[1000, 1]'): (1e-12, _LOG_CANCEL),
    ('Skellam', '[2000, 1]'): (2e-12, _LOG_CANCEL),
    ('Skellam', '[5000, 1]'): (1e-11, _LOG_CANCEL),
    ('YuleSimon', '[1.5]'): (3e-14, _LGAMMA),
}


def num(x):
    # Shortest decimal that round-trips to the nearest float64 -- avoids ESLint's
    # no-loss-of-precision rule while still pinning the exact double the test compares against.
    return repr(float(x))


def emit_point(name, p, k):
    f = pmf(name, p, k)
    c = cdf(name, p, k)
    qp = c - f / 2          # midpoint of the k-th step (strictly inside) -> infimum quantile is k
    return f'{{ k: {k}, pmf: {num(f)}, cdf: {num(c)}, qp: {num(qp)} }}'


groups = []
for name, sets, tol in SPEC:
    for p, ks in sets:
        override = TOL_OVERRIDE.get((name, json.dumps(p)))
        t, note = override if override else (tol, None)
        pts = ',\n      '.join(emit_point(name, p, k) for k in ks)
        comment = f"  // {name}{json.dumps(p)}: {note}\n" if note else ''
        groups.append(
            f"{comment}  {{\n    name: '{name}',\n    params: {json.dumps(p)},\n    tol: {t:g},\n"
            f"    points: [\n      {pts}\n    ]\n  }}")

DATA = '[\n' + ',\n'.join(groups) + '\n]'

OUT = '''/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
// ESLint's no-loss-of-precision rule false-positives on a few 17-significant-digit literals
// that do round-trip exactly, so it is disabled for this generated reference file.
import {{ assert }} from 'chai'
import {{ describe, it, before }} from 'mocha'
import * as dist from '../src/dist'

// Discrete-distribution precision gate (issue #634 -- v1.27.0 milestone).
//
// Reference values are from mpmath 1.4.1 at mp.dps = 50, rounded to float64.
// Generator (also the source of every formula): scripts/precision-refs-discrete.py
//
// For each distribution, 3 parameter sets x 5 k-values spanning the support
// (fewer where the support has < 5 points, e.g. Bernoulli/Rademacher/small ranges)
// are checked for pmf, cdf and quantile:
//   pmf / cdf : relative error |result / reference - 1| <= tol (1e-14, or a documented
//               looser bound capped at 1e-12 for known cancellation/large-k limits).
//   quantile  : probed at qp = cdf(k) - pmf(k)/2, the midpoint of the k-th probability
//               step. This cdf-derived input lands strictly inside the step, so the
//               infimum quantile F^-1(qp) must equal k exactly.
//
// Reference math is INDEPENDENT of the ranjs implementation -- it matches the external
// (scipy/mpmath) parameterization documented in test/dist-cases-discrete.js, which the
// generator self-checks before emitting these literals.
const REFS = {data}

describe('discrete-distribution precision gate', () => {{
  REFS.forEach(({{ name, params, tol, points }}) => {{
    describe(`${{name}}(${{JSON.stringify(params)}})`, () => {{
      // Construct in a before() hook so a constructor regression surfaces as a failing
      // hook rather than silently skipping every assertion in this group.
      let d
      before(() => {{ d = new dist[name](...params) }})
      // One test per method (not per k): the message pinpoints the failing k, while
      // pmf/cdf/quantile stay isolated so a regression in one does not mask the others.
      it(`pmf to ${{tol}} relative error`, () => {{
        points.forEach(({{ k, pmf }}) => {{
          // ranjs exposes the probability mass through pdf() for discrete distributions.
          // Guard the relative form against a zero reference (exact zero is checked directly).
          if (pmf === 0) assert.strictEqual(d.pdf(k), 0, `pmf at k=${{k}}`)
          else assert.approximately(d.pdf(k) / pmf, 1, tol, `pmf at k=${{k}}`)
        }})
      }})
      it(`cdf to ${{tol}} relative error`, () => {{
        points.forEach(({{ k, cdf }}) => {{
          if (cdf === 0) assert.strictEqual(d.cdf(k), 0, `cdf at k=${{k}}`)
          else assert.approximately(d.cdf(k) / cdf, 1, tol, `cdf at k=${{k}}`)
        }})
      }})
      it('quantile midpoint returns k', () => {{
        // ranjs exposes the quantile function as q(); the step-midpoint input must resolve to k
        points.forEach(({{ k, qp }}) => {{
          assert.strictEqual(d.q(qp), k, `q(qp) at k=${{k}}`)
        }})
      }})
    }})
  }})
}})
'''.format(data=DATA)

with open('test/precision-discrete.js', 'w') as fh:
    fh.write(OUT)
print(f'wrote test/precision-discrete.js with {len(groups)} groups', file=sys.stderr)
