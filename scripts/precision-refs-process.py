"""
Reference value generation for test/precision-process.js (issue #1223).

Stochastic processes in src/process/ had no equivalent of the distribution precision gates
(scripts/precision-refs-continuous.py / -discrete.py): their pdf/marginal densities were
checked against scipy doubles at a uniform 1e-10, over a handful of hand-picked points.
This script closes that gap with the same standard the distributions get.

All pdf/cdf values are computed with mpmath at mp.dps = 50, then rounded to the nearest
float64 (shortest round-tripping decimal) and emitted as JS literals. For each process
three parameter sets are checked at three times each; for every (params, t) pair the five
probe x-values are obtained by inverting the high-precision marginal CDF at
p in {0.1, 0.3, 0.53, 0.72, 0.9}, so every probe lands strictly inside the support
(pdf > 0, 0 < cdf < 1). The discrete Poisson process is probed at the integer k-values
those same p-levels select.

Reference math is INDEPENDENT of ranjs: every marginal law below is re-derived from the
process's own SDE / update rule (see the derivations in the per-process comments), never
read off the JavaScript implementation. A self-check block re-derives the scipy values
already vetted in test/process.js and aborts on any mismatch, guarding against a
parameterization slip silently baking a wrong convention into every emitted literal.

Requires: pip install mpmath
Usage:    python3 scripts/precision-refs-process.py            # recompute everything (~7 min)
          python3 scripts/precision-refs-process.py --render   # re-emit from cache, no recompute

CompoundPoisson dominates the runtime: locating each probe means bisecting a CDF that is
itself a Poisson-weighted sum of ~100 regularized incomplete gammas at mp.dps = 50. Every run
caches its computed points to /tmp/precision-process-cache.json, and --render rebuilds the
test file from that cache alone -- enough for a tolerance or template edit, which is the
common reason to re-run this. Points absent from the cache are always recomputed.
"""
import json
import os
import sys
from mpmath import (mp, mpf, exp, expm1, log, sqrt, pi, erfc, power, factorial,
                    binomial, loggamma, gammainc, quad)

mp.dps = 50

HALF = mpf(1) / 2
SQRT2 = sqrt(2)
SQRT2PI = sqrt(2 * pi)

# Probe levels of the marginal CDF. Deliberately off the exact centre (0.53 rather than 0.5)
# so a symmetric process's median -- where several of these laws have an exactly-representable
# value -- never becomes the probe (same rationale as the continuous-distribution gate).
PLEVELS = [mpf('0.1'), mpf('0.3'), mpf('0.53'), mpf('0.72'), mpf('0.9')]


# --- elementary laws ---------------------------------------------------------------------

def norm_pdf(x, m, s):
    z = (mpf(x) - m) / s
    return exp(-z * z / 2) / (s * SQRT2PI)


def norm_cdf(x, m, s):
    # erfc form keeps the far-left tail free of the 1 - Phi cancellation that (1+erf)/2 suffers.
    return HALF * erfc(-(mpf(x) - m) / (s * SQRT2))


def norm_q(p, m, s):
    # Bisection on the exact CDF: no dependence on an inverse-erf implementation, and at
    # mp.dps = 50 the bracket below is squeezed to ~1e-60 relative, far past float64.
    return m + s * bisect(lambda z: norm_cdf(z, mpf(0), mpf(1)), mpf(-40), mpf(40), p)


def lognorm_pdf(x, m, s):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    return norm_pdf(log(x), m, s) / x


def lognorm_cdf(x, m, s):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    return norm_cdf(log(x), m, s)


def lognorm_q(p, m, s):
    return exp(norm_q(p, m, s))


def gamma_pdf(x, alpha, scale):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    # Log form: alpha reaches 12 here, and x**(alpha-1) / scale**alpha overflows the
    # intermediate range long before the ratio does.
    return exp((alpha - 1) * log(x) - x / scale - loggamma(alpha) - alpha * log(scale))


def gamma_cdf(x, alpha, scale):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    return gammainc(alpha, 0, x / scale, regularized=True)


def gamma_q(p, alpha, scale):
    # Bracket generously in units of the mean (alpha*scale); the shapes used here are all
    # alpha >= 2, so p = 0.9 never reaches 20 means.
    return bisect(lambda z: gamma_cdf(z, alpha, scale), mpf(0), 40 * alpha * scale, p)


def pois_pmf(k, lam):
    if k < 0:
        return mpf(0)
    return exp(-lam) * power(lam, k) / factorial(k)


def pois_cdf(k, lam):
    if k < 0:
        return mpf(0)
    return sum((pois_pmf(j, lam) for j in range(0, int(k) + 1)), mpf(0))


def pois_q(p, lam):
    # Infimum quantile: the smallest k with cdf(k) >= p.
    k = 0
    while pois_cdf(k, lam) < p:
        k += 1
    return k


def binom_pmf(k, n, pp):
    if k < 0 or k > n:
        return mpf(0)
    return binomial(n, k) * power(pp, k) * power(1 - pp, n - k)


def binom_cdf(k, n, pp):
    return sum((binom_pmf(j, n, pp) for j in range(0, int(k) + 1)), mpf(0))


def binom_q(p, n, pp):
    k = 0
    while binom_cdf(k, n, pp) < p:
        k += 1
    return k


# Compound Poisson-Gamma total S = sum_{i=1}^N J_i with N ~ Poisson(lam), J_i ~ Gamma(a, rate b).
# Conditional on N = n >= 1 the sum of n independent Gamma(a, b) is exactly Gamma(n*a, b), so the
# law is a point mass exp(-lam) at 0 plus a Poisson-weighted mixture of Gammas. Summing that
# mixture directly is what makes this an INDEPENDENT reference: it never touches the
# compound-Poisson -> Tweedie(mu, phi, p) parameter mapping that CompoundPoisson.marginal()
# applies, so agreement checks the mapping and Tweedie's own series at the same time.
# All terms are positive for a > 0, so the sums carry no cancellation.

def _cpg_terms(lam, a, b, y, term_fn):
    total = mpf(0)
    n = 1
    while True:
        term = pois_pmf(n, lam) * term_fn(n)
        total += term
        # Terms peak near n = lam; only start testing for convergence past the peak, or the
        # first few (still-growing) terms would trip the threshold immediately.
        if n > lam + 5 and term < total * mpf('1e-55'):
            break
        n += 1
        if n > 100000:
            break
    return total


def cpg_pdf(y, lam, a, b):
    y = mpf(y)
    if y <= 0:
        return mpf(0)
    return _cpg_terms(lam, a, b, y, lambda n: exp(
        n * a * log(b) + (n * a - 1) * log(y) - b * y - loggamma(n * a)))


def cpg_cdf(y, lam, a, b):
    y = mpf(y)
    if y < 0:
        return mpf(0)
    # The exp(-lam) atom at 0 is part of the CDF everywhere on y >= 0.
    return exp(-lam) + _cpg_terms(lam, a, b, y,
                                  lambda n: gammainc(n * a, 0, b * y, regularized=True))


def cpg_q(p, lam, a, b):
    # Every probe level used here exceeds the atom exp(-lam), so the quantile lies strictly
    # inside the continuous part and the bracket may start just above 0.
    mean = lam * a / b
    return bisect(lambda z: cpg_cdf(z, lam, a, b), mpf(0), 60 * mean + 60, p)


def bisect(cdf, lo, hi, p):
    # 300 halvings of an O(1)-wide bracket lands ~1e-90, well inside mp.dps = 50's working
    # precision, so the returned x is exact to every digit the emitted float64 can hold.
    for _ in range(300):
        mid = (lo + hi) / 2
        if cdf(mid) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# --- process marginals -------------------------------------------------------------------
#
# Each entry returns (kind, law-parameters) for the marginal of X_t started from the
# process's own fixed initial state x0 (0 everywhere except GeometricBrownianMotion's 1;
# neither is settable through the public API, so the references must use those defaults).
#
# Derivations, from each process's SDE / update rule -- NOT from src/process/*.js:
#
#   BrownianMotion         dX = mu dt + sigma dW, X_0 = 0
#                          => X_t ~ N(mu*t, sigma^2*t).
#
#   OrnsteinUhlenbeck      dX = theta(mu - X)dt + sigma dW, X_0 = 0. Solving the linear SDE,
#                          X_t = mu(1 - e^{-theta t}) + sigma * int_0^t e^{-theta(t-s)} dW_s;
#                          the Ito integral is Gaussian with variance
#                          sigma^2 * int_0^t e^{-2 theta (t-s)} ds = sigma^2 (1-e^{-2 theta t})/(2 theta).
#
#   BrownianBridge         Cov(X_s, X_t) = sigma^2 min(s,t)(T - max(s,t))/T for the bridge
#                          pinned at 0 on both ends, so X_t ~ N(0, sigma^2 t(T-t)/T), 0 < t < T.
#
#   GeometricBrownianMotion  dX = mu X dt + sigma X dW, X_0 = 1. By Ito,
#                          d log X = (mu - sigma^2/2)dt + sigma dW, so
#                          log X_t ~ N(log x0 + (mu - sigma^2/2)t, sigma^2 t), i.e. X_t is
#                          lognormal with that underlying normal.
#
#   CoxIngersollRoss       dX = kappa(theta - X)dt + sigma sqrt(X) dW. The exact transition is
#                          X_t | X_0 = c * chi'^2(d, lam) with c = sigma^2(1-e^{-kappa t})/(4 kappa),
#                          d = 4 kappa theta / sigma^2 and lam = 4 kappa e^{-kappa t} X_0 /
#                          (sigma^2 (1-e^{-kappa t})). At X_0 = 0 the noncentrality lam vanishes,
#                          and c * chi^2_d is exactly Gamma(shape = d/2 = 2 kappa theta / sigma^2,
#                          scale = 2c = sigma^2(1-e^{-kappa t})/(2 kappa)).
#
#   Poisson                Independent increments with rate lambda => X_t ~ Poisson(lambda*t).
#
#   AR1                    X_n = phi X_{n-1} + sigma Z, X_0 = 0 => X_n = sigma * sum_{j<n} phi^j Z_{n-j},
#                          so X_n ~ N(0, sigma^2 * sum_{j=0}^{n-1} phi^{2j}) = N(0, sigma^2 (1-phi^{2n})/(1-phi^2)).
#                          t is a step count, hence integer-valued.
#
#   RandomWalk             X_n = X_{n-1} +- 1 with P(+1) = p, X_0 = 0. If K of the n steps are +1
#                          then X_n = K - (n - K) = 2K - n with K ~ Binomial(n, p), so X_n is that
#                          binomial pushed forward through x = 2k - n: supported on the |x| <= n
#                          integers sharing n's parity, with pmf C(n, (n+x)/2) p^{(n+x)/2} (1-p)^{(n-x)/2}.
#
#   CompoundPoisson        X_t = sum_{i=1}^{N} J_i with N ~ Poisson(lambda*t) and Gamma(a, rate b)
#                          jumps. Conditional on N = n >= 1 the sum is exactly Gamma(n*a, b), so
#                          X_t is a point mass exp(-lambda*t) at 0 plus a Poisson-weighted mixture
#                          of Gammas -- see _cpg_terms above.


def marginal(name, params, t):
    t = mpf(t)
    if name == 'BrownianMotion':
        mu, sigma = mpf(params[0]), mpf(params[1])
        return ('normal', mu * t, sigma * sqrt(t))
    if name == 'OrnsteinUhlenbeck':
        theta, mu, sigma = mpf(params[0]), mpf(params[1]), mpf(params[2])
        e = exp(-theta * t)
        return ('normal', mu * (1 - e), sigma * sqrt(-expm1(-2 * theta * t) / (2 * theta)))
    if name == 'BrownianBridge':
        sigma, T = mpf(params[0]), mpf(params[1])
        return ('normal', mpf(0), sigma * sqrt(t * (T - t) / T))
    if name == 'GeometricBrownianMotion':
        mu, sigma = mpf(params[0]), mpf(params[1])
        # x0 = 1, so log(x0) drops out of the underlying normal's mean.
        return ('lognormal', (mu - sigma * sigma / 2) * t, sigma * sqrt(t))
    if name == 'CoxIngersollRoss':
        kappa, theta, sigma = mpf(params[0]), mpf(params[1]), mpf(params[2])
        alpha = 2 * kappa * theta / (sigma * sigma)
        scale = sigma * sigma * (-expm1(-kappa * t)) / (2 * kappa)
        return ('gamma', alpha, scale)
    if name == 'Poisson':
        lam = mpf(params[0])
        return ('poisson', lam * t)
    if name == 'AR1':
        phi, sigma = mpf(params[0]), mpf(params[1])
        phi2 = phi * phi
        return ('normal', mpf(0), sigma * sqrt(-expm1(t * log(phi2)) / (1 - phi2)))
    if name == 'RandomWalk':
        return ('shiftedbinom', int(t), mpf(params[0]))
    if name == 'CompoundPoisson':
        # params is (jump-Gamma shape, jump-Gamma rate, lambda, dt) -- the jump distribution's
        # own parameters are flattened in so a spec entry stays a plain list of numbers.
        a, b, lam = mpf(params[0]), mpf(params[1]), mpf(params[2])
        return ('cpg', lam * t, a, b)
    raise ValueError(f'no marginal defined for {name}')


LAWS = {
    #  kind          pdf/pmf     cdf         quantile
    'normal': (norm_pdf, norm_cdf, norm_q),
    'lognormal': (lognorm_pdf, lognorm_cdf, lognorm_q),
    'gamma': (gamma_pdf, gamma_cdf, gamma_q),
    'poisson': (pois_pmf, pois_cdf, pois_q),
    'shiftedbinom': (None, None, None),   # filled below: needs the 2k-n reparameterization
    'cpg': (cpg_pdf, cpg_cdf, cpg_q),
}

# RandomWalk's marginal is Binomial(n, p) pushed through x = 2k - n, so its three functions
# are the binomial's evaluated at k = (n + x)/2 (and inverted back through x = 2k - n).
LAWS['shiftedbinom'] = (
    lambda x, n, pp: binom_pmf((n + int(x)) // 2, n, pp) if (n + int(x)) % 2 == 0 else mpf(0),
    lambda x, n, pp: binom_cdf((n + int(x)) // 2, n, pp),
    lambda p, n, pp: 2 * binom_q(p, n, pp) - n,
)

# Discrete laws are probed at lattice points rather than at an inverted continuous quantile,
# so duplicate probes must be collapsed when several p-levels select the same point.
DISCRETE = ('poisson', 'shiftedbinom')

# Processes that expose only marginal(t), with no pdf(x, t) of their own.
NO_PROCESS_PDF = ('CompoundPoisson',)


def law_pdf(law, x):
    return LAWS[law[0]][0](x, *law[1:])


def law_cdf(law, x):
    return LAWS[law[0]][1](x, *law[1:])


def law_q(law, p):
    return LAWS[law[0]][2](p, *law[1:])


# --- self-check against the scipy values already vetted in test/process.js -----------------
#
# (name, params, t, x, expected pdf). Every one of these is quoted with its scipy/Python
# derivation in test/process.js, so agreement here proves this script's parameterization
# matches the one the library is already tested against.

CHECKS = [
    ('BrownianMotion', [0, 1, 1], 1, 0, 0.3989422804014327),
    ('BrownianMotion', [0.5, 2, 1], 2, 1, 0.1410473958869391),
    ('BrownianMotion', [-0.2, 1.5, 1], 3, 0, 0.1495123243667221),
    ('GeometricBrownianMotion', [0.1, 0.3, 1], 1, 1.0, 1.3076461848524421),
    ('GeometricBrownianMotion', [0.05, 0.2, 1], 2, 1.5, 0.4459926977250626),
    ('GeometricBrownianMotion', [0, 0.5, 1], 0.5, 0.8, 1.2721398281078873),
    ('OrnsteinUhlenbeck', [1, 2, 1, 0.1], 1, 1, 0.5596687594392821),
    ('OrnsteinUhlenbeck', [2, 0, 0.5, 0.1], 0.5, 0, 1.7161142135258760),
    ('OrnsteinUhlenbeck', [0.5, 3, 2, 0.1], 2, 2, 0.2141814469689605),
    ('BrownianBridge', [1, 2, 0.1], 1, 0, 0.5641895835477563),
    ('BrownianBridge', [1, 2, 0.1], 1, 1, 0.20755374871029736),
    ('BrownianBridge', [2, 4, 0.1], 2, 0, 0.19947114020071635),
    ('AR1', [0.5, 1], 1, 0, 0.3989422804014327),
    ('AR1', [0.5, 1], 2, 0, 0.3568248232305543),
    ('AR1', [0.5, 1], 3, 1, 0.2379112029210874),
    ('Poisson', [2, 1], 1, 2, 0.2706705664732255),
    ('Poisson', [0.5, 1], 3, 1, 0.3346952402226447),
    ('Poisson', [3, 1], 2, 5, 0.1606231410479798),
    ('CoxIngersollRoss', [2, 3, 1, 0.1], 0.5, 0.5, 0.002130824749883),
    ('CoxIngersollRoss', [2, 3, 1, 0.1], 0.5, 2.0, 0.674442782399143),
    ('CoxIngersollRoss', [2, 3, 1, 0.1], 1, 1.5, 0.201734321913609),
    # Exact rationals quoted in test/process.js's RandomWalk .pdf() block, e.g.
    # C(4,2)*0.5^4 = 6/16 and C(5,4)*0.7^4*0.3 = 5*0.2401*0.3.
    ('RandomWalk', [0.5], 4, 0, 0.375),
    ('RandomWalk', [0.5], 4, 2, 0.25),
    ('RandomWalk', [0.6], 3, 1, 0.432),
    ('RandomWalk', [0.7], 5, 3, 0.36015),
]


def check_cpg(params, t):
    # CompoundPoisson has no single vetted pdf literal in test/process.js to anchor against,
    # so the mixture is instead pinned by three properties that jointly determine all three of
    # (lambda*t, a, b) and are independent of both ranjs and the Tweedie parameter mapping:
    #   * the atom at 0 is exactly P(N=0) = exp(-lambda*t)   -- vetted in test/process.js
    #   * the law normalizes to 1                            -- Poisson weights sum correctly
    #   * E[X_t] = lambda*t*E[J] = lambda*t*a/b (Wald)       -- vetted in test/process.js
    law = marginal('CompoundPoisson', params, t)
    lam, a, b = law[1], law[2], law[3]
    failures = []
    atom = law_cdf(law, 0)
    if abs(atom - exp(-lam)) > mpf('1e-40'):
        failures.append(f'atom {atom} != exp(-lambda*t) {exp(-lam)}')
    # 200 means is far enough into the tail that the survival function is below 1e-40 for
    # every shape used here.
    total = law_cdf(law, 200 * lam * a / b)
    if abs(total - 1) > mpf('1e-30'):
        failures.append(f'cdf(inf) {total} != 1')
    mean = quad(lambda y: y * law_pdf(law, y), [0, lam * a / b, 200 * lam * a / b])
    if abs(mean / (lam * a / b) - 1) > mpf('1e-20'):
        failures.append(f'mean {mean} != lambda*t*a/b {lam * a / b}')
    return failures


def self_check():
    bad = False
    for name, params, t, x, expected in CHECKS:
        got = law_pdf(marginal(name, params, t), x)
        rel = abs(float(got) - expected) / abs(expected)
        # 1e-12 rather than 1e-14: three of the CIR references in test/process.js are quoted
        # to only 15 significant digits ("Python3 math: gamma_pdf = 0.002130824749883"),
        # so they cannot pin more than ~1e-13 by construction.
        if rel > 1e-12:
            bad = True
            print(f'SELF-CHECK FAIL {name}{params} pdf({x}, {t}) got {float(got)!r} '
                  f'want {expected!r} rel {rel:.2e}', file=sys.stderr)
    n_cpg = 0
    for name, sets, _ in SPEC:
        if name != 'CompoundPoisson':
            continue
        for params, times in sets:
            for t in times:
                n_cpg += 1
                for msg in check_cpg(params, t):
                    bad = True
                    print(f'SELF-CHECK FAIL CompoundPoisson{params} t={t}: {msg}', file=sys.stderr)
    if bad:
        sys.exit('Aborting: parameterization mismatch with test/process.js.')
    print(f'self-check: {len(CHECKS)} parameterizations match test/process.js, '
          f'{n_cpg} compound Poisson-gamma mixtures normalize and match Wald\'s mean',
          file=sys.stderr)


# --- test specification: (name, [ (params, [times]) x3 ], tol) -----------------------------
#
# Times are chosen per parameter set to span short/medium/long horizons on that set's own
# scale (e.g. relative to 1/theta for the mean-reverting processes, and strictly inside
# (0, T) for the bridge). AR1's t is a step count, so its times are integers.

SPEC = [
    ('AR1', [([0.5, 1], [1, 3, 10]),
             ([0.9, 0.5], [2, 5, 20]),
             ([-0.3, 2], [1, 4, 12])], 1e-14),
    ('BrownianBridge', [([1, 2, 0.1], [0.25, 1, 1.75]),
                        ([2, 4, 0.1], [0.5, 2, 3.5]),
                        ([0.5, 1, 0.1], [0.1, 0.5, 0.9])], 1e-14),
    ('BrownianMotion', [([0, 1, 1], [0.5, 1, 3]),
                        ([0.5, 2, 1], [0.25, 2, 5]),
                        ([-0.2, 1.5, 1], [1, 3, 10])], 1e-14),
    # All three sets satisfy the Feller condition 2*kappa*theta > sigma^2, so the constructor
    # stays silent; the shapes span alpha = 12, 8 and a non-integer 25/6 so the Gamma density's
    # log-gamma path is exercised away from integer shape parameters.
    ('CoxIngersollRoss', [([2, 3, 1, 0.1], [0.25, 1, 4]),
                          ([1, 1, 0.5, 0.1], [0.5, 2, 6]),
                          ([1.5, 2, 1.2, 0.1], [0.3, 1.5, 5])], 1e-14),
    ('GeometricBrownianMotion', [([0.1, 0.3, 1], [0.5, 1, 3]),
                                 ([0.05, 0.2, 1], [0.25, 2, 5]),
                                 ([0, 0.5, 1], [0.5, 1, 4])], 1e-14),
    ('OrnsteinUhlenbeck', [([1, 2, 1, 0.1], [0.25, 1, 4]),
                           ([2, 0, 0.5, 0.1], [0.1, 0.5, 3]),
                           ([0.5, 3, 2, 0.1], [0.5, 2, 8])], 1e-14),
    ('Poisson', [([2, 1], [0.5, 1, 3]),
                 ([0.5, 1], [1, 3, 10]),
                 ([3, 1], [0.5, 2, 5])], 1e-14),
    # t is a step count, so the times are integers and the probes land on the |x| <= t
    # integers sharing t's parity.
    ('RandomWalk', [([0.5], [4, 10, 25]),
                    ([0.3], [5, 12, 30]),
                    ([0.7], [3, 8, 20])], 1e-14),
    # params are (jump-Gamma shape, jump-Gamma rate, lambda, dt). Every (params, t) pair keeps
    # lambda*t >= 3, so the atom exp(-lambda*t) at 0 stays below 0.05 and all five probe levels
    # (the lowest is 0.1) land strictly inside the continuous part of the mixture.
    ('CompoundPoisson', [([2, 1, 3, 1], [1, 2, 4]),
                         ([1.5, 2, 4, 1], [1, 2, 5]),
                         ([3, 0.5, 2, 1], [2, 4, 8])], 1e-14),
]

# Per-(name, params) tolerance overrides discovered empirically, as (pdfTol, cdfTol, note);
# either may be None to keep the group's base tol. Each carries a named mechanism -- never a
# blanket loosening -- and every value is pinned just above its MEASURED worst case rather
# than at the 1e-12 cap, so a real regression still fails.
#
# pdf and cdf are loosened separately because their floors genuinely diverge here: the
# compound Poisson-gamma cdf stays at ~4e-15 while its pdf reaches 4.2e-14, and collapsing
# both into one loose bound would let a cdf regression hide behind the pdf's floor.
_LGAMMA = ('pmf is exp() of a three-term log-gamma difference; each logGamma loses ~1 ULP and '
           'exponentiating amplifies the absolute log error. Measured worst case at t=30: '
           'pdf 1.8e-14, cdf 9.9e-15')
_SERIES = ('marginal() is a Tweedie whose density is the Dunn & Smyth infinite series, summed '
           'in log-space over hundreds of exp()-of-log-gamma terms. Measured worst case: pdf '
           '4.2e-14; the cdf series converges far better (4.0e-15) and stays gated at 1e-14')
TOL_OVERRIDE = {
    ('RandomWalk', '[0.3]'): (3e-14, 2e-14, _LGAMMA),
    ('CompoundPoisson', '[2, 1, 3, 1]'): (6e-14, None, _SERIES),
    ('CompoundPoisson', '[1.5, 2, 4, 1]'): (6e-14, None, _SERIES),
    ('CompoundPoisson', '[3, 0.5, 2, 1]'): (6e-14, None, _SERIES),
}


def num(x):
    # Shortest decimal that round-trips to the nearest float64 -- avoids ESLint's
    # no-loss-of-precision rule while still pinning the exact double the test compares against.
    return repr(float(x))


def points_for(name, params, t):
    law = marginal(name, params, t)
    out = []
    seen = set()
    for p in PLEVELS:
        x = law_q(law, p)
        # Poisson and RandomWalk are discrete: distinct p-levels can select the same lattice
        # point when the spread is small, so collapse duplicates rather than asserting twice.
        if law[0] in DISCRETE:
            if x in seen:
                continue
            seen.add(x)
            # Lattice points are exact integers, so no float round-trip is needed and they are
            # rendered as integers (matching the discrete distribution gate) rather than "7.0".
            xs, lattice = x, True
        else:
            # Round-trip through float64 first: the test calls pdf() with the emitted literal,
            # so the reference must be the density at that double, not at the exact quantile.
            # mpf(float(...)) converts the double exactly; mpf(repr(...)) would instead parse
            # the printed decimal at 50 digits, landing up to half an ULP away from it.
            xs, lattice = mpf(float(x)), False
        # Cached as plain numbers, never as the rendered line: Python's float repr round-trips
        # exactly through JSON, so a formatting or tolerance change re-renders from cache
        # instead of re-paying the CompoundPoisson bisection.
        out.append({'t': t, 'x': float(xs), 'lattice': lattice,
                    'pdf': float(law_pdf(law, xs)), 'cdf': float(law_cdf(law, xs))})
    return out


def render_point(pt):
    x = int(pt['x']) if pt['lattice'] else num(pt['x'])
    return (f'{{ t: {json.dumps(pt["t"])}, x: {x}, '
            f'pdf: {num(pt["pdf"])}, cdf: {num(pt["cdf"])} }}')


CACHE = '/tmp/precision-process-cache.json'


def build_groups(cache):
    groups = []
    for name, sets, tol in SPEC:
        for params, times in sets:
            pdf_tol, cdf_tol, note = TOL_OVERRIDE.get((name, json.dumps(params)),
                                                      (None, None, None))
            pts = []
            for t in times:
                key = f'{name}|{json.dumps(params)}|{json.dumps(t)}'
                if key not in cache:
                    cache[key] = points_for(name, params, t)
                pts.extend(render_point(pt) for pt in cache[key])
            comment = f'  // {name}{json.dumps(params)}: {note}\n' if note else ''
            body = ',\n      '.join(pts)
            # CompoundPoisson's first constructor argument is a Distribution instance, not a
            # number, so its spec params carry the jump Gamma's (shape, rate) up front and the
            # emitted group splits them out for the test to rebuild.
            if name == 'CompoundPoisson':
                head = (f"    jump: {json.dumps(params[:2])},\n"
                        f"    params: {json.dumps(params[2:])},\n")
            else:
                head = f'    params: {json.dumps(params)},\n'
            # Emitted only when false, so the field stays absent for the seven processes that
            # do implement pdf(x, t) and the generated file does not carry a redundant `true`.
            no_pdf = '    procPdf: false,\n' if name in NO_PROCESS_PDF else ''
            # pdfTol/cdfTol default to the group's tol in the test, so they are emitted only
            # for the handful of groups whose two floors genuinely diverge.
            extra = ''.join(f'    {k}: {v:g},\n'
                            for k, v in (('pdfTol', pdf_tol), ('cdfTol', cdf_tol)) if v)
            groups.append(
                f"{comment}  {{\n    name: '{name}',\n{head}{no_pdf}"
                f"    tol: {tol:g},\n{extra}    points: [\n      {body}\n    ]\n  }}")
    return groups


TEMPLATE = '''/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
// ESLint's no-loss-of-precision rule false-positives on a few 17-significant-digit literals
// that do round-trip exactly, so it is disabled for this generated reference file.
import {{ assert }} from 'chai'
import {{ describe, it, before }} from 'mocha'
import * as proc from '../src/process'
import {{ Gamma }} from '../src/dist'

// Stochastic-process precision gate (issue #1223).
//
// Reference values are from mpmath 1.4.1 at mp.dps = 50, rounded to float64.
// Generator (also the source of every formula): scripts/precision-refs-process.py
//
// Before this gate, process densities were checked against scipy doubles at a uniform 1e-10
// over a handful of hand-picked points -- a materially looser standard than the mpmath
// arbitrary-precision gate src/dist/ gets. This file applies that same standard to every
// process with a closed-form time-t marginal.
//
// For each process, 3 parameter sets x 3 times x 5 interior x-values (the F_t^-1(p) for
// p in {{0.1, 0.3, 0.53, 0.72, 0.9}}, off the exact centre so a symmetric process's median
// never becomes the probe) are checked at `tol` relative error (1e-14, or a documented
// looser bound capped at 1e-12). Poisson is discrete, so its probes are the integer
// k-values those p-levels select, deduplicated where a small lambda*t repeats one.
//
// Each reference gates three independent code paths:
//   pdf           : proc.pdf(x, t), the process's own density
//   marginal pdf  : proc.marginal(t).pdf(x) -- marginal() re-derives the law's parameters
//                   separately from pdf(), so checking it only against pdf() (as
//                   test/process.js does) would let a shared parameterization slip cancel out
//   marginal cdf  : proc.marginal(t).cdf(x), which had no external reference at any tolerance
//
// A group carrying `procPdf: false` has no pdf(x, t) of its own (CompoundPoisson exposes only
// marginal(t)), so only the latter two run for it.
//
// Reference math is INDEPENDENT of the ranjs implementation -- every marginal law is
// re-derived from the process's SDE in the generator, which self-checks against the scipy
// values already vetted in test/process.js before emitting these literals. CompoundPoisson's
// reference in particular is summed directly as a Poisson-weighted mixture of Gammas, never
// through the compound-Poisson -> Tweedie parameter mapping that marginal() applies, so it
// gates that mapping as well as Tweedie's own series.
//
// Densities are evaluated from each process's fixed initial state x0 (0 everywhere except
// GeometricBrownianMotion's 1), which has no public setter.
const REFS = {data}

describe('stochastic-process precision gate', () => {{
  // pdfTol/cdfTol default to the group's shared tol, so the vast majority of groups (which hit
  // the same float64 floor on both) are unaffected; only a group whose two floors genuinely
  // diverge -- CompoundPoisson, whose Tweedie density series is an order of magnitude noisier
  // than its cdf series -- sets them explicitly.
  REFS.forEach(({{ name, params, jump, procPdf = true, tol, pdfTol = tol, cdfTol = tol, points }}) => {{
    describe(`${{name}}(${{JSON.stringify(params)}})`, () => {{
      // Construct in a before() hook so a constructor regression surfaces as a failing
      // hook rather than silently skipping every assertion in this group.
      let p
      // CompoundPoisson takes its jump distribution as a Distribution instance rather than
      // as numbers, so its group carries the jump Gamma's (shape, rate) separately.
      before(() => {{ p = jump ? new proc[name](new Gamma(...jump), ...params) : new proc[name](...params) }})
      // One test per code path (not per point): the message pinpoints the failing (x, t),
      // while pdf/marginal stay isolated so a regression in one does not mask the others.
      if (procPdf) {{
        it(`pdf(x, t) to ${{pdfTol}} relative error`, () => {{
          points.forEach(({{ t, x, pdf }}) => {{
            assert.approximately(p.pdf(x, t) / pdf, 1, pdfTol, `pdf at x=${{x}}, t=${{t}}`)
          }})
        }})
      }}
      it(`marginal(t).pdf(x) to ${{pdfTol}} relative error`, () => {{
        points.forEach(({{ t, x, pdf }}) => {{
          assert.approximately(p.marginal(t).pdf(x) / pdf, 1, pdfTol, `marginal pdf at x=${{x}}, t=${{t}}`)
        }})
      }})
      it(`marginal(t).cdf(x) to ${{cdfTol}} relative error`, () => {{
        points.forEach(({{ t, x, cdf }}) => {{
          assert.approximately(p.marginal(t).cdf(x) / cdf, 1, cdfTol, `marginal cdf at x=${{x}}, t=${{t}}`)
        }})
      }})
    }})
  }})
}})
'''


if __name__ == '__main__':
    render_only = '--render' in sys.argv
    cache = {}
    if render_only:
        if not os.path.exists(CACHE):
            sys.exit(f'--render needs {CACHE}; run without it once to populate the cache.')
        with open(CACHE) as fh:
            cache = json.load(fh)
    else:
        # The self-check re-derives every law from scratch, so it is the recompute path's
        # guard; --render trusts the cache the earlier full run already validated.
        self_check()
    groups = build_groups(cache)
    with open(CACHE, 'w') as fh:
        json.dump(cache, fh)
    with open('test/precision-process.js', 'w') as fh:
        fh.write(TEMPLATE.format(data='[\n' + ',\n'.join(groups) + '\n]'))
    print(f'wrote test/precision-process.js with {len(groups)} groups', file=sys.stderr)
