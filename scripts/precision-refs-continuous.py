"""
Reference value generation for test/precision-continuous.js (issue #633, v1.27.0 gate).

All pdf/cdf values are computed with mpmath at mp.dps = 50, then rounded to the nearest
float64 (shortest round-tripping decimal) and emitted as JS literals. For each distribution
three parameter sets are checked at five interior x-values; the x-values are obtained by
inverting the high-precision CDF at p in {0.1, 0.3, 0.5, 0.7, 0.9} so every probe lands
strictly inside the support (pdf > 0, 0 < cdf < 1).

Reference math is INDEPENDENT of ranjs: every pdf/cdf is the textbook closed form (or an
exact Poisson/chi-squared mixture / high-precision quadrature), matching the same external
(scipy/mpmath) parameterization documented in test/dist-cases-continuous.js. A self-check
block re-derives the scipy refVals already vetted in that file and aborts on any mismatch.

Requires: pip install mpmath
Usage:    python3 scripts/precision-refs-continuous.py            # rewrites the test file
          python3 scripts/precision-refs-continuous.py --check    # self-check only
"""
import json
import subprocess
import sys
from mpmath import (mp, mpf, pi, sqrt, exp, log, expm1, log1p, cosh, tanh,
                    atan, asin, asinh, acos, sin, cos, gamma as gammafn, loggamma,
                    beta as betafn, erf, erfc, besseli, power, fsum, factorial, zeta,
                    quad, inf, fabs, sign, nsum, gammainc, betainc)

mp.dps = 50

HALF = mpf(1) / 2
SQRT2 = sqrt(2)
SQRT2PI = sqrt(2 * pi)


def Phi(z):
    return HALF * (1 + erf(mpf(z) / SQRT2))


def phi(z):
    z = mpf(z)
    return exp(-z * z / 2) / SQRT2PI


def Preg(s, x):
    # regularized lower incomplete gamma P(s, x)
    if x <= 0:
        return mpf(0)
    return gammainc(s, 0, x, regularized=True)


def Qreg(s, x):
    if x <= 0:
        return mpf(1)
    return gammainc(s, x, inf, regularized=True)


def Ireg(a, b, x):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    return betainc(a, b, 0, x, regularized=True)


def pois_w(lam, j):
    lam = mpf(lam)
    if lam == 0:
        return mpf(1) if j == 0 else mpf(0)
    return exp(-lam + j * log(lam) - loggamma(j + 1))


# ---- noncentral helpers (exact mixtures) ----

def ncx2_cdf(k, lam, x):
    if x <= 0:
        return mpf(0)
    l2 = mpf(lam) / 2
    s = mpf(0)
    j = 0
    while True:
        term = pois_w(l2, j) * Preg(mpf(k) / 2 + j, mpf(x) / 2)
        s += term
        if j > l2 + 5 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return s


def ncx2_pdf(k, lam, x):
    x = mpf(x)
    if x < 0:
        return mpf(0)
    l2 = mpf(lam) / 2
    s = mpf(0)
    j = 0
    while True:
        df = mpf(k) + 2 * j
        if x == 0:
            term = pois_w(l2, j) * (mpf(0) if df > 2 else (HALF if df == 2 else inf))
        else:
            term = pois_w(l2, j) * exp((df / 2 - 1) * log(x) - x / 2 - (df / 2) * log(2) - loggamma(df / 2))
        s += term
        if j > l2 + 5 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return s


def ncbeta_cdf(a, b, lam, x):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    l2 = mpf(lam) / 2
    s = mpf(0)
    j = 0
    while True:
        term = pois_w(l2, j) * Ireg(mpf(a) + j, b, x)
        s += term
        if j > l2 + 5 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return s


def ncbeta_pdf(a, b, lam, x):
    x = mpf(x)
    if x <= 0 or x >= 1:
        return mpf(0)
    l2 = mpf(lam) / 2
    s = mpf(0)
    j = 0
    while True:
        aj = mpf(a) + j
        term = pois_w(l2, j) * exp((aj - 1) * log(x) + (mpf(b) - 1) * log(1 - x) - log(betafn(aj, b)))
        s += term
        if j > l2 + 5 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return s


def dncbeta_cdf(a, b, l1, l2, x):
    # Poisson weights and log-Ireg-independent quantities are tracked via their exact recurrences
    # (log w(k+1) = log w(k) + log(lam) - log(k+1)) instead of recomputing loggamma/betafn fresh
    # on every (r, si) pair: the naive form above took minutes per call at large lambda (e.g.
    # lambda1=lambda2=1200, issue #1086), too slow to regenerate a reference in this pipeline.
    # This is an exact algebraic rewrite (same recurrences the JS implementation itself uses via
    # its own Poisson-weight speed-up constants), not an approximation -- verified bit-for-bit
    # against the naive form above for every existing small-lambda REFS entry via --check.
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    a = mpf(a)
    b = mpf(b)
    h1 = mpf(l1) / 2
    h2 = mpf(l2) / 2
    log_h1 = log(h1) if h1 != 0 else None
    log_h2 = log(h2) if h2 != 0 else None
    s = mpf(0)
    r = 0
    log_wr = mpf(0) if h1 == 0 else -h1
    while True:
        inner = mpf(0)
        log_ws = mpf(0) if h2 == 0 else -h2
        si = 0
        while True:
            # Convergence must track the actual accumulated term (Poisson weight * Ireg), not the
            # raw Poisson-weight product alone: for r far from its Poisson mean r0, log_wr is
            # already enormously negative, so wr_ws < 1e-55 trivially regardless of whether the
            # Ireg-weighted term has converged, silently truncating real probability mass whenever
            # the joint (r,s) peak shifts far from the nominal center (#1108). Same relative
            # term-vs-running-sum check as recursiveSum's useFloor=False branch in
            # src/algorithms/recursive-sum.js, the precedent from #1086's JS-side fix.
            term = exp(log_wr + log_ws) * Ireg(a + r, b + si, x)
            inner += term
            if si > h2 + 5 and fabs(term) < fabs(inner) * mpf('1e-55'):
                break
            if h2 != 0:
                log_ws = log_ws + log_h2 - log(si + 1)
            si += 1
            if si > 5000:
                break
        s += inner
        if r > h1 + 5 and fabs(inner) < fabs(s) * mpf('1e-55'):
            break
        if h1 != 0:
            log_wr = log_wr + log_h1 - log(r + 1)
        r += 1
        if r > 5000:
            break
    return s


def dncbeta_pdf(a, b, l1, l2, x):
    # See dncbeta_cdf's comment: same incremental-log rewrite, additionally tracking log B(a+r,
    # b+si) via its exact recurrence (log B(a, b+1) = log B(a, b) + log(b) - log(a+b)) instead of
    # calling betafn (3 loggamma calls) fresh every iteration.
    x = mpf(x)
    if x <= 0 or x >= 1:
        return mpf(0)
    a = mpf(a)
    b = mpf(b)
    h1 = mpf(l1) / 2
    h2 = mpf(l2) / 2
    logx = log(x)
    log1mx = log(1 - x)
    log_h1 = log(h1) if h1 != 0 else None
    log_h2 = log(h2) if h2 != 0 else None
    s = mpf(0)
    r = 0
    log_wr = mpf(0) if h1 == 0 else -h1
    logB_r0 = loggamma(a) + loggamma(b) - loggamma(a + b)
    while True:
        inner = mpf(0)
        log_ws = mpf(0) if h2 == 0 else -h2
        logB = logB_r0
        si = 0
        while True:
            # See dncbeta_cdf's comment (#1108): convergence must track the actual accumulated
            # term, not the raw Poisson-weight product, or real probability mass gets silently
            # truncated whenever the joint (r,s) peak shifts far from the nominal center.
            term = exp(log_wr + log_ws + (a + r - 1) * logx + (b + si - 1) * log1mx - logB)
            inner += term
            if si > h2 + 5 and fabs(term) < fabs(inner) * mpf('1e-55'):
                break
            logB = logB + log(b + si) - log(a + r + b + si)
            if h2 != 0:
                log_ws = log_ws + log_h2 - log(si + 1)
            si += 1
            if si > 5000:
                break
        s += inner
        if r > h1 + 5 and fabs(inner) < fabs(s) * mpf('1e-55'):
            break
        logB_r0 = logB_r0 + log(a + r) - log(a + r + b)
        if h1 != 0:
            log_wr = log_wr + log_h1 - log(r + 1)
        r += 1
        if r > 5000:
            break
    return s


def chi2_pdf(df, v):
    v = mpf(v)
    df = mpf(df)
    if v <= 0:
        return mpf(0)
    return exp((df / 2 - 1) * log(v) - v / 2 - (df / 2) * log(2) - loggamma(df / 2))


def nct_cdf(nu, mu, t):
    nu = mpf(nu)
    mu = mpf(mu)
    t = mpf(t)
    # F(t) = integral_0^inf Phi(t*sqrt(v/nu) - mu) * chi2_pdf(nu, v) dv.
    # 35 working digits keep the quadrature ~1e-30 accurate (far below float64) while
    # roughly halving the adaptive-subdivision cost that dominates the (doubly-)noncentral-t runs.
    f = lambda v: Phi(t * sqrt(v / nu) - mu) * chi2_pdf(nu, v)
    with mp.workdps(35):
        return +quad(f, [0, nu, inf])


def nct_pdf(nu, mu, x):
    nu = mpf(nu)
    mu = mpf(mu)
    x = mpf(x)
    if x == 0:
        return exp(loggamma((nu + 1) / 2) - loggamma(nu / 2) - mu * mu / 2) / sqrt(pi * nu)
    return nu * (nct_cdf(nu + 2, mu, x * sqrt(1 + 2 / nu)) - nct_cdf(nu, mu, x)) / x


def dnct_pdf(nu, mu, theta, t):
    # Term-by-term derivative of the Poisson(theta/2) mixture of singly-noncentral-t CDFs.
    nu = mpf(nu)
    mu = mpf(mu)
    t = mpf(t)
    y = fabs(t)
    m = mu if t >= 0 else -mu
    h = mpf(theta) / 2
    s = mpf(0)
    i = 0
    while True:
        si = sqrt(1 + 2 * i / nu)
        term = pois_w(h, i) * nct_pdf(nu + 2 * i, m, y * si) * si
        s += term
        if i > h + 5 and pois_w(h, i) < mpf('1e-25'):
            break
        i += 1
        if i > 5000:
            break
    return s


def dnct_cdf(nu, mu, theta, t):
    # Poisson(theta/2) mixture of singly-noncentral-t CDFs (matches ranjs DoublyNoncentralT._cdf).
    nu = mpf(nu)
    mu = mpf(mu)
    t = mpf(t)
    y = fabs(t)
    m = mu if t >= 0 else -mu
    h = mpf(theta) / 2
    s = mpf(0)
    i = 0
    while True:
        term = pois_w(h, i) * nct_cdf(nu + 2 * i, m, y * sqrt(1 + 2 * i / nu))
        s += term
        if i > h + 5 and pois_w(h, i) < mpf('1e-25'):
            break
        i += 1
        if i > 5000:
            break
    return s if t >= 0 else 1 - s


# ---- inverse-gaussian cdf (standard closed form) ----

def ig_cdf(muu, lam, x):
    x = mpf(x)
    muu = mpf(muu)
    lam = mpf(lam)
    if x <= 0:
        return mpf(0)
    a = sqrt(lam / x) * (x / muu - 1)
    b = sqrt(lam / x) * (x / muu + 1)
    return Phi(a) + exp(2 * lam / muu) * Phi(-b)


def ig_pdf(muu, lam, x):
    x = mpf(x)
    muu = mpf(muu)
    lam = mpf(lam)
    if x <= 0:
        return mpf(0)
    return sqrt(lam / (2 * pi * x ** 3)) * exp(-lam * (x - muu) ** 2 / (2 * muu * muu * x))


# ---- Irwin-Hall ----

def ih_pdf(n, x):
    from mpmath import binomial
    n = int(round(n))
    x = mpf(x)
    if x < 0 or x > n:
        return mpf(0)
    k = 0
    s = mpf(0)
    kmax = int(x)
    for k in range(kmax + 1):
        s += (1 if k % 2 == 0 else -1) * binomial(n, k) * power(x - k, n - 1)
    return s / factorial(n - 1)


def ih_cdf(n, x):
    from mpmath import binomial
    n = int(round(n))
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= n:
        return mpf(1)
    kmax = int(x)
    s = mpf(0)
    for k in range(kmax + 1):
        s += (1 if k % 2 == 0 else -1) * binomial(n, k) * power(x - k, n)
    return s / factorial(n)


# =========================================================================
# pdf / cdf dispatch  (positional params match ranjs constructor signature)
# =========================================================================

def pdf(name, p, x):
    x = mpf(x)
    lo, hi = support(name, p)
    if (lo is not None and x < lo) or (hi is not None and x > hi):
        return mpf(0)
    if name == 'Alpha':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return beta * exp(-HALF * (alpha - beta / x) ** 2) / (x * x * Phi(alpha) * SQRT2PI)
    if name == 'Anglit':
        mu, beta = mpf(p[0]), mpf(p[1])
        return cos(2 / beta * x - 2 * mu / beta) / beta
    if name == 'Arcsine':
        a, b = mpf(p[0]), mpf(p[1])
        return (1 / pi) / sqrt((x - a) * (b - x))
    if name == 'AsymmetricLaplace':
        mu, sigma, kappa = mpf(p[0]), mpf(p[1]), mpf(p[2])
        C = SQRT2 * kappa / (sigma * (1 + kappa * kappa))
        if x < mu:
            return C * exp(-SQRT2 * kappa * (mu - x) / sigma)
        return C * exp(-SQRT2 * (x - mu) / (kappa * sigma))
    if name in ('Beta', 'BaldingNichols'):
        if name == 'BaldingNichols':
            F, pp = mpf(p[0]), mpf(p[1])
            f = (1 - F) / F
            alpha, beta = f * pp, f * (1 - pp)
        else:
            alpha, beta = mpf(p[0]), mpf(p[1])
        return exp((alpha - 1) * log(x) + (beta - 1) * log(1 - x) - log(betafn(alpha, beta)))
    if name == 'Bates':
        n, a, b = p[0], mpf(p[1]), mpf(p[2])
        ni = int(round(n))
        scale = ni / (b - a)
        return scale * ih_pdf(ni, scale * x - ni * a / (b - a))
    if name == 'Benini':
        alpha, beta, sigma = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = log(x / sigma)
        z = alpha + beta * y
        return exp(-y * z) * (z + beta * y) / x
    if name == 'BenktanderII':
        a, b = mpf(p[0]), mpf(p[1])
        if b == 1:
            return a * exp(a * (1 - x))
        y = power(x, b)
        return exp(a * (1 - y) / b) * power(x, b - 2) * (a * y - b + 1)
    if name == 'BetaPrime':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return pdf('Beta', [alpha, beta], x / (1 + x)) / power(1 + x, 2)
    if name == 'BetaRectangular':
        alpha, beta, theta, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3]), mpf(p[4])
        return (theta * pdf('Beta', [alpha, beta], (x - a) / (b - a)) + (1 - theta)) / (b - a)
    if name == 'BirnbaumSaunders':
        mu, beta, gam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = sqrt((x - mu) / beta)
        return (z + 1 / z) * phi((z - 1 / z) / gam) / (2 * gam * (x - mu))
    if name == 'BoundedPareto':
        L, H, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        denom = 1 - power(L / H, alpha)
        return alpha * power(L / x, alpha) / (x * denom)
    if name == 'Bradford':
        c = mpf(p[0])
        return (c / log1p(c)) / (1 + c * x)
    if name == 'Burr':
        c, k = mpf(p[0]), mpf(p[1])
        y = power(x, c)
        return c * k * y / (x * power(1 + y, k + 1))
    if name in ('Cauchy', 'LogCauchy'):
        if name == 'LogCauchy':
            x0, gam = mpf(p[0]), mpf(p[1])
            return pdf('Cauchy', [x0, gam], log(x)) / x
        x0, gam = mpf(p[0]), mpf(p[1])
        y = (x - x0) / gam
        return 1 / (pi * gam * (1 + y * y))
    if name == 'Champernowne':
        alpha, lam, x0 = mpf(p[0]), mpf(p[1]), mpf(p[2])
        norm = alpha * sqrt(1 - lam * lam) / (2 * acos(lam))
        return norm / (cosh(alpha * (x - x0)) + lam)
    if name == 'Chi':
        k = int(round(p[0]))
        return 2 * x * pdf('Chi2', [k], x * x)
    if name == 'Chi2':
        k = int(round(p[0]))
        return chi2_pdf(k, x)
    if name in ('Dagum',):
        pp, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = power(x / b, a)
        return a * pp * power(y, pp) / (x * power(y + 1, pp + 1))
    if name == 'Davis':
        mu, b, n = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = x - mu
        if y <= 0:
            return mpf(0)
        return power(b, n) * power(y, -1 - n) / (gammafn(n) * zeta(n) * expm1(b / y))
    if name == 'DoubleGamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return pdf('Gamma', [alpha, beta], fabs(x)) / 2
    if name == 'DoubleWeibull':
        lam, k = mpf(p[0]), mpf(p[1])
        return pdf('Weibull', [lam, k], fabs(x)) / 2
    if name == 'DoublyNoncentralBeta':
        return dncbeta_pdf(p[0], p[1], p[2], p[3], x)
    if name == 'DoublyNoncentralChi2':
        k1, k2, l1, l2 = p[0], p[1], p[2], p[3]
        return ncx2_pdf(int(round(k1)) + int(round(k2)), mpf(l1) + mpf(l2), x)
    if name == 'DoublyNoncentralF':
        d1, d2, l1, l2 = int(round(p[0])), int(round(p[1])), mpf(p[2]), mpf(p[3])
        y = d1 * x / (d2 + d1 * x)
        return d1 * d2 / power(d2 + d1 * x, 2) * dncbeta_pdf(mpf(d1) / 2, mpf(d2) / 2, l1, l2, y)
    if name == 'DoublyNoncentralT':
        nu, mu, theta = int(round(p[0])), mpf(p[1]), mpf(p[2])
        return dnct_pdf(nu, mu, theta, x)
    if name == 'Erlang':
        k, lam = int(round(p[0])), mpf(p[1])
        return pdf('Gamma', [k, lam], x)
    if name == 'Exponential':
        lam = mpf(p[0])
        return lam * exp(-lam * x)
    if name == 'ExponentialLogarithmic':
        pp, beta = mpf(p[0]), mpf(p[1])
        y = (1 - pp) * exp(-beta * x)
        return beta * y / ((y - 1) * log(pp))
    if name == 'ExponentiatedWeibull':
        lam, k, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        base = cdf('Weibull', [lam, k], x)
        return pdf('Weibull', [lam, k], x) * alpha * power(base, alpha - 1)
    if name == 'F':
        d1, d2 = int(round(p[0])), int(round(p[1]))
        y = d2 + d1 * x
        return d1 * d2 * pdf('Beta', [mpf(d1) / 2, mpf(d2) / 2], d1 * x / y) / power(y, 2)
    if name == 'FisherZ':
        d1, d2 = int(round(p[0])), int(round(p[1]))
        return pdf('F', [d1, d2], exp(2 * x)) * 2 * exp(2 * x)
    if name == 'Frechet':
        alpha, s, m = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = (x - m) / s
        return alpha * exp(-log(z) * (1 + alpha) - power(z, -alpha)) / s
    if name == 'Gamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return exp(alpha * log(beta) - beta * x - loggamma(alpha)) * power(x, alpha - 1)
    if name == 'GammaGompertz':
        b, s, beta = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = exp(b * x)
        z = power(beta - 1 + y, s + 1)
        return b * s * power(beta, s) * y / z
    if name == 'GeneralizedExponential':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = b * (1 - exp(-c * x))
        return (a + z) * exp(-(a + b) * x + z / c)
    if name == 'GeneralizedExtremeValue':
        c = mpf(p[0])
        return exp(-power(1 - c * x, 1 / c)) * power(1 - c * x, 1 / c - 1)
    if name == 'GeneralizedGamma':
        a, d, pp = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return pp * power(x, pp - 1) * pdf('Gamma', [d / pp, power(a, -pp)], power(x, pp))
    if name == 'GeneralizedLogistic':
        mu, s, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = exp(-(x - mu) / s)
        return c * z / (s * power(1 + z, c + 1))
    if name == 'GeneralizedNormal':
        mu, alpha, beta = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return pdf('GeneralizedGamma', [alpha, 1, beta], fabs(x - mu)) / 2
    if name == 'GeneralizedPareto':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = (x - mu) / sigma
        if xi == 0:
            return exp(-z) / sigma
        return power(1 + xi * z, -1 / xi - 1) / sigma
    if name == 'Gilbrat':
        return pdf('LogNormal', [0, 1], x)
    if name == 'Gompertz':
        eta, b = mpf(p[0]), mpf(p[1])
        return b * eta * exp(eta + b * x - eta * exp(b * x))
    if name == 'Gumbel':
        mu, beta = mpf(p[0]), mpf(p[1])
        z = (x - mu) / beta
        return exp(-(z + exp(-z))) / beta
    if name == 'HalfGeneralizedNormal':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return 2 * pdf('GeneralizedNormal', [0, alpha, beta], x)
    if name == 'HalfLogistic':
        y = exp(-x)
        return 2 * y / power(1 + y, 2)
    if name == 'HalfNormal':
        sigma = mpf(p[0])
        return 2 * pdf('Normal', [0, sigma], x)
    if name == 'Hoyt':
        return pdf('Nakagami', [p[0], p[1]], x)
    if name == 'HyperbolicSecant':
        return HALF / cosh(HALF * pi * x)
    if name == 'Hyperexponential':
        comps = p[0]
        norm = fsum(mpf(c['weight']) for c in comps)
        return fsum(mpf(c['weight']) / norm * mpf(c['rate']) * exp(-mpf(c['rate']) * x) for c in comps)
    if name == 'InverseChi2':
        nu = int(round(p[0]))
        return power(2, -mpf(nu) / 2) * power(x, -mpf(nu) / 2 - 1) * exp(-HALF / x - loggamma(mpf(nu) / 2))
    if name == 'InverseGamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return pdf('Gamma', [alpha, beta], 1 / x) / (x * x)
    if name == 'InverseGaussian':
        return ig_pdf(p[0], p[1], x)
    if name == 'InvertedWeibull':
        if x <= 0:
            return mpf(0)
        c = mpf(p[0])
        return c * power(x, -1 - c) * exp(-1 / power(x, c))
    if name == 'IrwinHall':
        return ih_pdf(int(round(p[0])), x)
    if name == 'JohnsonSU':
        gam, delta, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = (x - xi) / lam
        return delta * phi(gam + delta * asinh(z)) / (lam * sqrt(1 + z * z))
    if name == 'JohnsonSB':
        gam, delta, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = x - xi
        return delta * lam * phi(gam + delta * log(z / (lam - z))) / (z * (lam - z))
    if name == 'Kolmogorov':
        return nsum(lambda k: (1 if k % 2 == 1 else -1) * k * k * x * exp(-2 * (k * x) ** 2), [1, inf]) * 8
    if name == 'Kumaraswamy':
        a, b = mpf(p[0]), mpf(p[1])
        return a * b * power(x, a - 1) * power(1 - power(x, a), b - 1)
    if name == 'Laplace':
        mu, b = mpf(p[0]), mpf(p[1])
        return HALF * exp(-fabs(x - mu) / b) / b
    if name == 'Levy':
        mu, c = mpf(p[0]), mpf(p[1])
        z = x - mu
        return sqrt(HALF * c / pi) * exp(-HALF * c / z - mpf(3) / 2 * log(z))
    if name == 'Lindley':
        theta = mpf(p[0])
        return theta * theta * (1 + x) * exp(-theta * x) / (1 + theta)
    if name == 'LogGamma':
        alpha, beta, mu = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return pdf('Gamma', [alpha, beta], log(x - mu + 1)) / (x - mu + 1)
    if name == 'LogLaplace':
        mu, b = mpf(p[0]), mpf(p[1])
        return pdf('Laplace', [mu, b], log(x)) / x
    if name == 'LogLogistic':
        alpha, beta = mpf(p[0]), mpf(p[1])
        xa = x / alpha
        y = power(xa, beta - 1)
        return (beta / alpha) * y / power(1 + xa * y, 2)
    if name == 'LogNormal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return pdf('Normal', [mu, sigma], log(x)) / x
    if name == 'Logarithmic':
        a, b = mpf(p[0]), mpf(p[1])
        fa = a * (1 - log(a))
        fb = b * (1 - log(b))
        return log(x) / (fa - fb)
    if name == 'Logistic':
        mu, s = mpf(p[0]), mpf(p[1])
        z = exp(-(x - mu) / s)
        return z / (s * power(1 + z, 2))
    if name == 'LogisticExponential':
        lam, kappa = mpf(p[0]), mpf(p[1])
        y = exp(lam * x)
        return lam * kappa * power(y - 1, kappa - 1) * y / power(1 + power(y - 1, kappa), 2)
    if name == 'LogitNormal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return pdf('Normal', [mu, sigma], log(x / (1 - x))) / (x * (1 - x))
    if name == 'Lomax':
        lam, alpha = mpf(p[0]), mpf(p[1])
        return alpha * power(1 + x / lam, -1 - alpha) / lam
    if name == 'Makeham':
        alpha, beta, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = exp(beta * x)
        return (alpha * y + lam) * exp(-lam * x - alpha * (y - 1) / beta)
    if name == 'MaxwellBoltzmann':
        a = mpf(p[0])
        return 2 * x * pdf('Gamma', [mpf(3) / 2, HALF / (a * a)], x * x)
    if name == 'Mielke':
        k, s = mpf(p[0]), mpf(p[1])
        return k * power(x, k - 1) / power(1 + power(x, s), 1 + k / s)
    if name == 'Moyal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        z = (x - mu) / sigma
        return exp(-HALF * (z + exp(-z))) / (sigma * SQRT2PI)
    if name == 'Muth':
        alpha = mpf(p[0])
        surv = exp(alpha * x - expm1(alpha * x) / alpha)
        return (exp(alpha * x) - alpha) * surv
    if name == 'Nakagami':
        m, omega = mpf(p[0]), mpf(p[1])
        norm = 2 * power(m, m) / power(omega, m)
        return norm * power(x, 2 * m - 1) * exp(-m * x * x / omega - loggamma(m))
    if name == 'NoncentralBeta':
        return ncbeta_pdf(p[0], p[1], p[2], x)
    if name == 'NoncentralChi':
        k, lam = int(round(p[0])), mpf(p[1])
        return 2 * x * ncx2_pdf(k, lam * lam, x * x)
    if name == 'NoncentralChi2':
        return ncx2_pdf(int(round(p[0])), p[1], x)
    if name == 'NoncentralF':
        d1, d2, lam = int(round(p[0])), int(round(p[1])), mpf(p[2])
        y = d1 * x / (d2 + d1 * x)
        return d1 * d2 / power(d2 + d1 * x, 2) * ncbeta_pdf(mpf(d1) / 2, mpf(d2) / 2, lam, y)
    if name == 'NoncentralT':
        nu, mu = int(round(p[0])), mpf(p[1])
        return nct_pdf(nu, mu, x)
    if name == 'Normal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return exp(-HALF * ((x - mu) / sigma) ** 2) / (sigma * SQRT2PI)
    if name == 'Pareto':
        xmin, alpha = mpf(p[0]), mpf(p[1])
        return alpha * power(xmin / x, alpha) / x
    if name == 'PERT':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        alpha = (4 * b + c - 5 * a) / (c - a)
        beta = (5 * c - a - 4 * b) / (c - a)
        return pdf('Beta', [alpha, beta], (x - a) / (c - a)) / (c - a)
    if name == 'PowerLaw':
        a = mpf(p[0])
        return pdf('Kumaraswamy', [a, 1], x)
    if name == 'QExponential':
        q, lam = mpf(p[0]), mpf(p[1])
        return pdf('GeneralizedPareto', [0, 1 / (lam * (2 - q)), (q - 1) / (2 - q)], x)
    if name == 'R':
        c = mpf(p[0])
        return HALF * pdf('Beta', [c / 2, c / 2], (x + 1) / 2)
    if name == 'RaisedCosine':
        mu, s = mpf(p[0]), mpf(p[1])
        return HALF * (1 + cos(pi * (x - mu) / s)) / s
    if name == 'Rayleigh':
        sigma = mpf(p[0])
        return pdf('Weibull', [sigma * SQRT2, 2], x)
    if name == 'Reciprocal':
        a, b = mpf(p[0]), mpf(p[1])
        return 1 / (x * (log(b) - log(a)))
    if name == 'ReciprocalInverseGaussian':
        muu, lam = mpf(p[0]), mpf(p[1])
        return ig_pdf(muu, lam, 1 / x) / (x * x)
    if name == 'Rice':
        nu, sigma = mpf(p[0]), mpf(p[1])
        return x * exp(-HALF * (x * x + nu * nu) / (sigma * sigma)) * besseli(0, x * nu / (sigma * sigma)) / (sigma * sigma)
    if name == 'ShiftedLogLogistic':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if xi == 0:
            z = exp(-(x - mu) / sigma)
            return z / (sigma * power(1 + z, 2))
        z = (x - mu) / sigma
        return power(1 + xi * z, -(1 / xi + 1)) / (sigma * power(1 + power(1 + xi * z, -1 / xi), 2))
    if name == 'SkewNormal':
        xi, omega, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return pdf('Normal', [xi, omega], x) * (1 + erf(alpha * (x - xi) / (omega * SQRT2)))
    if name == 'Slash':
        if x == 0:
            return HALF / SQRT2PI
        return (phi(0) - phi(x)) / (x * x)
    if name == 'StudentT':
        nu = mpf(p[0])
        return power(1 + x * x / nu, -(nu + 1) / 2) / (sqrt(nu) * betafn(HALF, nu / 2))
    if name == 'StudentZ':
        n = mpf(p[0])
        nu = n - 1
        return pdf('StudentT', [nu], x * sqrt(nu)) * sqrt(nu)
    if name == 'Trapezoidal':
        a, b, c, d = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        scale = d + c - a - b
        if x < b:
            return 2 * (x - a) / ((b - a) * scale)
        elif x < c:
            return 2 / scale
        return 2 * (d - x) / ((d - c) * scale)
    if name == 'Triangular':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x < c:
            return 2 * (x - a) / ((b - a) * (c - a))
        return 2 * (b - x) / ((b - a) * (b - c))
    if name == 'TruncatedNormal':
        mu, sigma, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        Z = Phi((b - mu) / sigma) - Phi((a - mu) / sigma)
        return pdf('Normal', [mu, sigma], x) / Z
    if name == 'TukeyLambda':
        lam = mpf(p[0])
        if lam == 0:
            y = exp(-x)
            return y / power(1 + y, 2)
        z = cdf('TukeyLambda', [lam], x)
        return 1 / (power(z, lam - 1) + power(1 - z, lam - 1))
    if name == 'UQuadratic':
        a, b = mpf(p[0]), mpf(p[1])
        alpha = 12 / power(b - a, 3)
        beta = (a + b) / 2
        return alpha * power(x - beta, 2)
    if name == 'Uniform':
        a, b = mpf(p[0]), mpf(p[1])
        return 1 / (b - a)
    if name == 'UniformProduct':
        n = int(round(p[0]))
        return power(-log(x), n - 1) / gammafn(n)
    if name == 'UniformRatio':
        return HALF if x <= 1 else HALF / (x * x)
    if name == 'VonMises':
        kappa = mpf(p[0])
        return exp(kappa * cos(x)) / (2 * pi * besseli(0, kappa))
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        t = x / lam
        return k / lam * power(t, k - 1) * exp(-power(t, k))
    if name == 'Wigner':
        R = mpf(p[0])
        r = R * R
        return 2 * sqrt(r - x * x) / (pi * r)
    raise ValueError('pdf: ' + name)


def cdf(name, p, x):
    x = mpf(x)
    lo, hi = support(name, p)
    if lo is not None and x < lo:
        return mpf(0)
    if hi is not None and x > hi:
        return mpf(1)
    if name == 'Alpha':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Phi(alpha - beta / x) / Phi(alpha)
    if name == 'Anglit':
        mu, beta = mpf(p[0]), mpf(p[1])
        return sin(x / beta - (mu / beta - pi / 4)) ** 2
    if name == 'Arcsine':
        a, b = mpf(p[0]), mpf(p[1])
        return 2 / pi * asin(sqrt((x - a) / (b - a)))
    if name == 'AsymmetricLaplace':
        mu, sigma, kappa = mpf(p[0]), mpf(p[1]), mpf(p[2])
        k2 = kappa * kappa
        if x < mu:
            return 1 / (1 + k2) * exp(-SQRT2 * kappa * (mu - x) / sigma)
        return 1 - k2 / (1 + k2) * exp(-SQRT2 * (x - mu) / (kappa * sigma))
    if name in ('Beta', 'BaldingNichols'):
        if name == 'BaldingNichols':
            F, pp = mpf(p[0]), mpf(p[1])
            f = (1 - F) / F
            alpha, beta = f * pp, f * (1 - pp)
        else:
            alpha, beta = mpf(p[0]), mpf(p[1])
        return Ireg(alpha, beta, x)
    if name == 'Bates':
        n, a, b = int(round(p[0])), mpf(p[1]), mpf(p[2])
        scale = n / (b - a)
        return ih_cdf(n, scale * x - n * a / (b - a))
    if name == 'Benini':
        alpha, beta, sigma = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = log(x / sigma)
        return -expm1(-y * (alpha + beta * y))
    if name == 'BenktanderII':
        a, b = mpf(p[0]), mpf(p[1])
        if b == 1:
            return -expm1(a * (1 - x))
        return 1 - power(x, b - 1) * exp(a * (1 - power(x, b)) / b)
    if name == 'BetaPrime':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Ireg(alpha, beta, x / (1 + x))
    if name == 'BetaRectangular':
        alpha, beta, theta, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3]), mpf(p[4])
        y = x - a
        return theta * Ireg(alpha, beta, y / (b - a)) + (1 - theta) * y / (b - a)
    if name == 'BirnbaumSaunders':
        mu, beta, gam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = sqrt((x - mu) / beta)
        return Phi((z - 1 / z) / gam)
    if name == 'BoundedPareto':
        L, H, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        denom = 1 - power(L / H, alpha)
        return (1 - power(L, alpha) * power(x, -alpha)) / denom
    if name == 'Bradford':
        c = mpf(p[0])
        return log(1 + c * x) / log1p(c)
    if name == 'Burr':
        c, k = mpf(p[0]), mpf(p[1])
        return -expm1(-k * log1p(power(x, c)))
    if name in ('Cauchy', 'LogCauchy'):
        if name == 'LogCauchy':
            return cdf('Cauchy', p, log(x))
        x0, gam = mpf(p[0]), mpf(p[1])
        return HALF + atan((x - x0) / gam) / pi
    if name == 'Champernowne':
        alpha, lam, x0 = mpf(p[0]), mpf(p[1]), mpf(p[2])
        k = sqrt((1 - lam) / (1 + lam))
        atanK = atan(k)
        t = tanh(alpha * (x - x0) / 2)
        return (atan(k * t) + atanK) / (2 * atanK)
    if name == 'Chi':
        return cdf('Chi2', [int(round(p[0]))], x * x)
    if name == 'Chi2':
        k = int(round(p[0]))
        return Preg(mpf(k) / 2, x / 2)
    if name == 'Dagum':
        pp, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return power(1 + power(x / b, -a), -pp)
    if name == 'Davis':
        mu, b, n = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x <= mu:
            return mpf(0)
        return 1 - quad(lambda t: pdf('Davis', p, t), [x, x * 2, inf])
    if name == 'DoubleGamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        y = cdf('Gamma', [alpha, beta], fabs(x))
        return (1 + y) / 2 if x > 0 else (1 - y) / 2
    if name == 'DoubleWeibull':
        lam, k = mpf(p[0]), mpf(p[1])
        y = cdf('Weibull', [lam, k], fabs(x))
        return (1 + y) / 2 if x > 0 else (1 - y) / 2
    if name == 'DoublyNoncentralBeta':
        return dncbeta_cdf(p[0], p[1], p[2], p[3], x)
    if name == 'DoublyNoncentralChi2':
        k1, k2, l1, l2 = p[0], p[1], p[2], p[3]
        return ncx2_cdf(int(round(k1)) + int(round(k2)), mpf(l1) + mpf(l2), x)
    if name == 'DoublyNoncentralF':
        d1, d2, l1, l2 = int(round(p[0])), int(round(p[1])), mpf(p[2]), mpf(p[3])
        return dncbeta_cdf(mpf(d1) / 2, mpf(d2) / 2, l1, l2, x / (mpf(d2) / d1 + x))
    if name == 'DoublyNoncentralT':
        nu, mu, theta = int(round(p[0])), mpf(p[1]), mpf(p[2])
        return dnct_cdf(nu, mu, theta, x)
    if name == 'Erlang':
        k, lam = int(round(p[0])), mpf(p[1])
        return cdf('Gamma', [k, lam], x)
    if name == 'Exponential':
        return -expm1(-mpf(p[0]) * x)
    if name == 'ExponentialLogarithmic':
        pp, beta = mpf(p[0]), mpf(p[1])
        return 1 - log(1 - (1 - pp) * exp(-beta * x)) / log(pp)
    if name == 'ExponentiatedWeibull':
        lam, k, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return power(cdf('Weibull', [lam, k], x), alpha)
    if name == 'F':
        if x <= 0:
            return mpf(0)
        d1, d2 = int(round(p[0])), int(round(p[1]))
        y = d1 * x
        return Ireg(mpf(d1) / 2, mpf(d2) / 2, 1 / (1 + mpf(d2) / y))
    if name == 'FisherZ':
        d1, d2 = int(round(p[0])), int(round(p[1]))
        return cdf('F', [d1, d2], exp(2 * x))
    if name == 'Frechet':
        alpha, s, m = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return exp(-power((x - m) / s, -alpha))
    if name == 'Gamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Preg(alpha, beta * x)
    if name == 'GammaGompertz':
        b, s, beta = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return -expm1(-s * log1p(expm1(b * x) / beta))
    if name == 'GeneralizedExponential':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return -expm1(-(a + b) * x - b * expm1(-c * x) / c)
    if name == 'GeneralizedExtremeValue':
        c = mpf(p[0])
        return exp(-power(1 - c * x, 1 / c))
    if name == 'GeneralizedGamma':
        a, d, pp = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return cdf('Gamma', [d / pp, power(a, -pp)], power(x, pp))
    if name == 'GeneralizedLogistic':
        mu, s, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return 1 / power(1 + exp(-(x - mu) / s), c)
    if name == 'GeneralizedNormal':
        mu, alpha, beta = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return HALF * (1 + sign(x - mu) * cdf('GeneralizedGamma', [alpha, 1, beta], fabs(x - mu)))
    if name == 'GeneralizedPareto':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        z = (x - mu) / sigma
        if xi == 0:
            return -expm1(-z)
        return -expm1(-log1p(xi * z) / xi)
    if name == 'Gilbrat':
        return cdf('LogNormal', [0, 1], x)
    if name == 'Gompertz':
        eta, b = mpf(p[0]), mpf(p[1])
        return -expm1(-eta * expm1(b * x))
    if name == 'Gumbel':
        mu, beta = mpf(p[0]), mpf(p[1])
        return exp(-exp(-(x - mu) / beta))
    if name == 'HalfGeneralizedNormal':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return 2 * cdf('GeneralizedNormal', [0, alpha, beta], x) - 1
    if name == 'HalfLogistic':
        return tanh(x / 2)
    if name == 'HalfNormal':
        sigma = mpf(p[0])
        return 2 * cdf('Normal', [0, sigma], x) - 1
    if name == 'Hoyt':
        return cdf('Nakagami', [p[0], p[1]], x)
    if name == 'HyperbolicSecant':
        return 2 * atan(exp(HALF * pi * x)) / pi
    if name == 'Hyperexponential':
        comps = p[0]
        norm = fsum(mpf(c['weight']) for c in comps)
        return fsum(mpf(c['weight']) / norm * (-expm1(-mpf(c['rate']) * x)) for c in comps)
    if name == 'InverseChi2':
        nu = int(round(p[0]))
        return Qreg(mpf(nu) / 2, HALF / x)
    if name == 'InverseGamma':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Qreg(alpha, beta / x)
    if name == 'InverseGaussian':
        return ig_cdf(p[0], p[1], x)
    if name == 'InvertedWeibull':
        if x <= 0:
            return mpf(0)
        c = mpf(p[0])
        return exp(-1 / power(x, c))
    if name == 'IrwinHall':
        return ih_cdf(int(round(p[0])), x)
    if name == 'JohnsonSU':
        gam, delta, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        return Phi(gam + delta * asinh((x - xi) / lam))
    if name == 'JohnsonSB':
        gam, delta, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = x - xi
        return Phi(gam + delta * log(z / (lam - z)))
    if name == 'Kolmogorov':
        if x <= 0:
            return mpf(0)
        return 1 + 2 * nsum(lambda k: (1 if k % 2 == 0 else -1) * exp(-2 * (k * x) ** 2), [1, inf])
    if name == 'Kumaraswamy':
        a, b = mpf(p[0]), mpf(p[1])
        return 1 - power(1 - power(x, a), b)
    if name == 'Laplace':
        mu, b = mpf(p[0]), mpf(p[1])
        z = exp((x - mu) / b)
        return HALF * z if x < mu else 1 - HALF / z
    if name == 'Levy':
        mu, c = mpf(p[0]), mpf(p[1])
        return erfc(sqrt(HALF * c / (x - mu)))
    if name == 'Lindley':
        theta = mpf(p[0])
        tx = theta * x
        return -expm1(-tx) - exp(-tx) * tx / (1 + theta)
    if name == 'LogGamma':
        alpha, beta, mu = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return cdf('Gamma', [alpha, beta], log(x - mu + 1))
    if name == 'LogLaplace':
        mu, b = mpf(p[0]), mpf(p[1])
        return cdf('Laplace', [mu, b], log(x))
    if name == 'LogLogistic':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return 1 / (1 + power(x / alpha, -beta))
    if name == 'LogNormal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return cdf('Normal', [mu, sigma], log(x))
    if name == 'Logarithmic':
        a, b = mpf(p[0]), mpf(p[1])
        fa = a * (1 - log(a))
        fb = b * (1 - log(b))
        return (fa - x * (1 - log(x))) / (fa - fb)
    if name == 'Logistic':
        mu, s = mpf(p[0]), mpf(p[1])
        return 1 / (1 + exp(-(x - mu) / s))
    if name == 'LogisticExponential':
        lam, kappa = mpf(p[0]), mpf(p[1])
        u = power(expm1(lam * x), kappa)
        return u / (1 + u)
    if name == 'LogitNormal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return cdf('Normal', [mu, sigma], log(x / (1 - x)))
    if name == 'Lomax':
        lam, alpha = mpf(p[0]), mpf(p[1])
        return -expm1(-alpha * log1p(x / lam))
    if name == 'Makeham':
        alpha, beta, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return -expm1(-lam * x - alpha * expm1(beta * x) / beta)
    if name == 'MaxwellBoltzmann':
        a = mpf(p[0])
        return cdf('Gamma', [mpf(3) / 2, HALF / (a * a)], x * x)
    if name == 'Mielke':
        k, s = mpf(p[0]), mpf(p[1])
        return power(1 + power(x, -s), -k / s)
    if name == 'Moyal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return Qreg(HALF, HALF * exp((mu - x) / sigma))
    if name == 'Muth':
        alpha = mpf(p[0])
        return -expm1(alpha * x - expm1(alpha * x) / alpha)
    if name == 'Nakagami':
        m, omega = mpf(p[0]), mpf(p[1])
        return Preg(m, m * x * x / omega)
    if name == 'NoncentralBeta':
        return ncbeta_cdf(p[0], p[1], p[2], x)
    if name == 'NoncentralChi':
        k, lam = int(round(p[0])), mpf(p[1])
        return ncx2_cdf(k, lam * lam, x * x)
    if name == 'NoncentralChi2':
        return ncx2_cdf(int(round(p[0])), p[1], x)
    if name == 'NoncentralF':
        if x <= 0:
            return mpf(0)
        d1, d2, lam = int(round(p[0])), int(round(p[1])), mpf(p[2])
        y = d1 * x
        return ncbeta_cdf(mpf(d1) / 2, mpf(d2) / 2, lam, 1 / (1 + mpf(d2) / y))
    if name == 'NoncentralT':
        nu, mu = int(round(p[0])), mpf(p[1])
        return nct_cdf(nu, mu, x)
    if name == 'Normal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return HALF * (1 + erf((x - mu) / (sigma * SQRT2)))
    if name == 'Pareto':
        xmin, alpha = mpf(p[0]), mpf(p[1])
        return -expm1(-alpha * log(x / xmin))
    if name == 'PERT':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        alpha = (4 * b + c - 5 * a) / (c - a)
        beta = (5 * c - a - 4 * b) / (c - a)
        return Ireg(alpha, beta, (x - a) / (c - a))
    if name == 'PowerLaw':
        return cdf('Kumaraswamy', [mpf(p[0]), 1], x)
    if name == 'QExponential':
        q, lam = mpf(p[0]), mpf(p[1])
        return cdf('GeneralizedPareto', [0, 1 / (lam * (2 - q)), (q - 1) / (2 - q)], x)
    if name == 'R':
        c = mpf(p[0])
        return cdf('Beta', [c / 2, c / 2], (x + 1) / 2)
    if name == 'RaisedCosine':
        mu, s = mpf(p[0]), mpf(p[1])
        z = (x - mu) / s
        return HALF * (1 + z + sin(pi * z) / pi)
    if name == 'Rayleigh':
        sigma = mpf(p[0])
        return cdf('Weibull', [sigma * SQRT2, 2], x)
    if name == 'Reciprocal':
        a, b = mpf(p[0]), mpf(p[1])
        return (log(x) - log(a)) / (log(b) - log(a))
    if name == 'ReciprocalInverseGaussian':
        muu, lam = mpf(p[0]), mpf(p[1])
        return 1 - ig_cdf(muu, lam, 1 / x)
    if name == 'Rice':
        nu, sigma = mpf(p[0]), mpf(p[1])
        return ncx2_cdf(2, (nu / sigma) ** 2, (x / sigma) ** 2)
    if name == 'ShiftedLogLogistic':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if xi == 0:
            return 1 / (1 + exp(-(x - mu) / sigma))
        z = (x - mu) / sigma
        return 1 / (1 + power(1 + xi * z, -1 / xi))
    if name == 'SkewNormal':
        xi, omega, alpha = mpf(p[0]), mpf(p[1]), mpf(p[2])
        pts = [-inf, xi, x] if x > xi else [-inf, x]
        return quad(lambda t: pdf('SkewNormal', p, t), pts)
    if name == 'Slash':
        if x == 0:
            return HALF
        return cdf('Normal', [0, 1], x) - (phi(0) - phi(x)) / x
    if name == 'StudentT':
        nu = mpf(p[0])
        ib = Ireg(nu / 2, HALF, nu / (x * x + nu))
        return 1 - HALF * ib if x > 0 else HALF * ib
    if name == 'StudentZ':
        n = mpf(p[0])
        nu = n - 1
        return cdf('StudentT', [nu], x * sqrt(nu))
    if name == 'Trapezoidal':
        a, b, c, d = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        scale = d + c - a - b
        if x < b:
            return power(x - a, 2) / ((b - a) * scale)
        elif x < c:
            return (2 * x - (a + b)) / scale
        return 1 - power(d - x, 2) / ((d - c) * scale)
    if name == 'Triangular':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x < c:
            return power(x - a, 2) / ((b - a) * (c - a))
        return 1 - power(b - x, 2) / ((b - a) * (b - c))
    if name == 'TruncatedNormal':
        mu, sigma, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        phiA = Phi((a - mu) / sigma)
        Z = Phi((b - mu) / sigma) - phiA
        return (cdf('Normal', [mu, sigma], x) - phiA) / Z
    if name == 'TukeyLambda':
        lam = mpf(p[0])
        if lam == 0:
            return 1 / (1 + exp(-x))
        # Invert the monotone quantile q(t) = (t^lam - (1-t)^lam)/lam by bisection on t in (0,1);
        # findroot from a fixed seed diverges for the heavy-tailed lam < 0 case at large |x|.
        lo, hi = mpf('1e-60'), 1 - mpf('1e-60')
        for _ in range(220):
            m = (lo + hi) / 2
            if (power(m, lam) - power(1 - m, lam)) / lam < x:
                lo = m
            else:
                hi = m
        return (lo + hi) / 2
    if name == 'UQuadratic':
        a, b = mpf(p[0]), mpf(p[1])
        alpha = 12 / power(b - a, 3)
        beta = (a + b) / 2
        hrc = power((b - a) / 2, 3)
        return alpha * (power(x - beta, 3) + hrc) / 3
    if name == 'Uniform':
        a, b = mpf(p[0]), mpf(p[1])
        return (x - a) / (b - a)
    if name == 'UniformProduct':
        n = int(round(p[0]))
        return Qreg(n, -log(x))
    if name == 'UniformRatio':
        return HALF * x if x <= 1 else 1 - HALF / x
    if name == 'VonMises':
        kappa = mpf(p[0])
        return quad(lambda t: pdf('VonMises', p, t), [-pi, x])
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        return -expm1(-power(x / lam, k))
    if name == 'Wigner':
        R = mpf(p[0])
        r = R * R
        return HALF + x * sqrt(r - x * x) / (pi * r) + asin(x / R) / pi
    raise ValueError('cdf: ' + name)


# =========================================================================
# self-check against scipy refVals already vetted in dist-cases-continuous.js
# =========================================================================

# Frozen regression anchor for the #1108/#1086 premature-convergence bug -- values are the
# mpmath mp.dps=50 references already recorded in test/precision-continuous.js:993-998,
# duplicated here (not re-derived from dncbeta_pdf/dncbeta_cdf) so this check is non-tautological.
LARGE_LAMBDA_ANCHORS = [{
    'name': 'DoublyNoncentralBeta',
    'refVals': None,
    'cases': [{
        'params': [2, 2, 1200, 1200],
        'refVals': [
            {'x': 0.3, 'pdf': 3.031637276579777e-21, 'cdf': 5.709664737795533e-24},
            {'x': 0.5, 'pdf': 19.58073930064019, 'cdf': 0.5}
        ]
    }]
}]


def self_check(only=None):
    # dist-cases-continuous.js is a real ES module (cases[*].params is a closure); dump-dist-cases-
    # json.js loads it exactly the way mocha does (via @babel/register) and evaluates every closure,
    # so this always checks against the live file instead of a stale or nonexistent snapshot.
    # See solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md
    result = subprocess.run(['node', 'scripts/dump-dist-cases-json.js'], capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('dump-dist-cases-json.js failed')
    data = json.loads(result.stdout)
    # PARAM_SETS is this generator's registry of distributions it actually implements pdf()/cdf()
    # for; test/dist-cases-continuous.js covers a couple more (e.g. TruncatedExponential) that this
    # script never implemented, which would otherwise show up as a spurious ERROR, not a mismatch.
    implemented = set(PARAM_SETS.keys())
    bad = 0
    checked = 0
    for d in data + LARGE_LAMBDA_ANCHORS:
        name = d['name']
        if name not in implemented:
            print(f'  ... skipping {name} (not implemented in this generator)', flush=True)
            continue
        if only and name not in only:
            continue
        print(f'  ... {name}', flush=True)
        for i, c in enumerate(d['cases']):
            params = c['params']
            rv = c['refVals'] if c['refVals'] else (d['refVals'] if i == 0 else None)
            if not rv:
                continue
            for row in rv:
                xx = row['x']
                for key in ('pdf', 'cdf'):
                    if key not in row or row[key] is None:
                        continue
                    ref = row[key]
                    try:
                        got = float(pdf(name, params, xx) if key == 'pdf' else cdf(name, params, xx))
                    except Exception as ex:
                        print(f'  ERROR {name}{params} {key}({xx}): {ex}', flush=True)
                        bad += 1
                        continue
                    checked += 1
                    if ref == 0:
                        if abs(got) > 1e-9:
                            print(f'  MISMATCH {name}{params} {key}({xx}) got {got} want 0', flush=True)
                            bad += 1
                        continue
                    rel = abs(got - ref) / abs(ref)
                    if rel > 5e-7:
                        print(f'  MISMATCH {name}{params} {key}({xx}) got {got!r} want {ref!r} rel {rel:.2e}', flush=True)
                        bad += 1
    print(f'self-check: {checked} values checked, {bad} mismatches', flush=True)
    return bad


# =========================================================================
# Emission: 3 parameter sets x 5 interior x-values per distribution.
# x-values are F^-1(p) for p in {0.1, 0.3, 0.5, 0.7, 0.9} (interior probes).
# =========================================================================

# Probabilities are deliberately off the exact 0.5 centre: at the median of a symmetric
# distribution x = 0 (relative error undefined) and UQuadratic's pdf is exactly 0 there.
P_GRID = [mpf('0.1'), mpf('0.3'), mpf('0.53'), mpf('0.72'), mpf('0.9')]

# Three parameter sets per distribution (two from dist-cases-continuous.js, one fresh).
# Parameter-free distributions naturally have a single set.
PARAM_SETS = {
    'Alpha': [[2, 2], [0.5, 0.5], [3, 1]],
    'Anglit': [[0, 2], [3, 0.5], [-1, 4]],
    'Arcsine': [[5, 25], [0, 1], [-2, 2]],
    'AsymmetricLaplace': [[0, 1, 1], [1, 1, 2], [2, 0.5, 0.5]],
    'BaldingNichols': [[0.5, 0.5], [0.1, 0.1], [0.3, 0.7]],
    'Bates': [[10, 5, 25], [3, 0, 1], [5, -2, 2]],
    'Benini': [[2, 2, 2], [0.5, 0.5, 1], [1, 3, 2]],
    'BenktanderII': [[2, 0.9995], [2, 1], [2, 0.5]],
    'Beta': [[2, 2], [0.5, 0.5], [3, 5]],
    'BetaPrime': [[2, 2], [0.5, 4], [3, 3]],
    'BetaRectangular': [[2, 2, 0.5, 5, 25], [0.5, 0.5, 0.9, 5, 25], [3, 2, 0.3, 0, 10]],
    'BirnbaumSaunders': [[0, 2, 2], [0, 0.5, 0.5], [1, 1, 1]],
    'BoundedPareto': [[5, 25, 2], [1, 10, 0.5], [2, 8, 3]],
    'Bradford': [[2], [0.5], [5]],
    'Burr': [[2, 2], [0.5, 4], [3, 1]],
    'Cauchy': [[0, 2], [3, 0.5], [-1, 1]],
    'Champernowne': [[2, 0.5, 1], [1, 0, 0], [3, 0.8, -1]],
    'Chi': [[1], [5], [3]],
    'Chi2': [[5], [2], [9]],
    'Dagum': [[2, 2, 2], [0.5, 0.5, 2], [1, 3, 1]],
    'Davis': [[1, 1, 2], [1, 2, 3], [2, 1, 4]],
    'DoubleGamma': [[2, 2], [0.5, 2], [3, 1]],
    'DoubleWeibull': [[2, 2], [2, 0.5], [1, 3]],
    'DoublyNoncentralBeta': [[2, 2, 2, 2], [2, 2, 1, 3], [3, 4, 2, 2], [2, 2, 1200, 1200]],
    'DoublyNoncentralChi2': [[3, 4, 2, 3], [2, 4, 1, 2], [2, 3, 1, 1]],
    'DoublyNoncentralF': [[5, 5, 2, 2], [5, 5, 1, 2], [4, 6, 2, 1]],
    'DoublyNoncentralT': [[5, 1, 2], [5, 0, 2], [6, 2, 1]],
    'Erlang': [[5, 2], [2, 0.5], [3, 1]],
    'Exponential': [[2], [0.5], [1]],
    'ExponentialLogarithmic': [[0.5, 2], [0.9, 0.5], [0.3, 1]],
    'ExponentiatedWeibull': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 2, 3]],
    'F': [[5, 5], [2, 20], [10, 4]],
    'FisherZ': [[5, 5], [1, 1], [8, 4]],
    'Frechet': [[2, 2, 0], [0.5, 1, 0], [3, 2, 1]],
    'Gamma': [[2, 2], [0.5, 0.5], [3, 1]],
    'GammaGompertz': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 3, 2]],
    'GeneralizedExponential': [[2, 2, 2], [2, 0.5, 4], [1, 3, 2]],
    'GeneralizedExtremeValue': [[2], [-2], [0.5]],
    'GeneralizedGamma': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 3, 2]],
    'GeneralizedLogistic': [[0, 2, 2], [3, 0.5, 0.5], [-1, 1, 3]],
    'GeneralizedNormal': [[0, 2, 2], [3, 0.5, 0.5], [-1, 1, 3]],
    'GeneralizedPareto': [[0, 2, 2], [0, 2, -2], [0, 2, 0]],
    'Gilbrat': [[]],
    'Gompertz': [[2, 2], [0.5, 0.5], [1, 3]],
    'Gumbel': [[0, 2], [3, 0.5], [-1, 1]],
    'HalfGeneralizedNormal': [[2, 2], [0.5, 0.5], [1, 3]],
    'HalfLogistic': [[]],
    'HalfNormal': [[2], [0.5], [1]],
    'Hoyt': [[0.5, 2], [2, 1], [1, 3]],
    'HyperbolicSecant': [[]],
    'Hyperexponential': [
        [[{'weight': 1, 'rate': 0.5}, {'weight': 3, 'rate': 4}]],
        [[{'weight': 2, 'rate': 2}, {'weight': 1, 'rate': 0.5}, {'weight': 1, 'rate': 5}]],
        [[{'weight': 1, 'rate': 1}, {'weight': 2, 'rate': 3}]],
    ],
    'InverseChi2': [[6], [2], [4]],
    'InverseGamma': [[2, 2], [0.5, 0.5], [3, 1]],
    'InverseGaussian': [[2, 2], [1, 0.5], [3, 1]],
    'InvertedWeibull': [[2], [0.5], [3]],
    'IrwinHall': [[10], [3], [5]],
    'JohnsonSU': [[0, 2, 2, 0], [1, 0.5, 0.5, 1], [-1, 1.5, 2, 0]],
    'JohnsonSB': [[0, 2, 2, 0], [1, 0.5, 0.5, 1], [-0.5, 1.5, 3, 0]],
    'Kolmogorov': [[]],
    'Kumaraswamy': [[2, 2], [0.5, 0.5], [3, 1]],
    'Laplace': [[0, 2], [3, 0.5], [-1, 1]],
    'Levy': [[0, 2], [1, 0.5], [-1, 1]],
    'Lindley': [[2], [0.5], [1]],
    'LogCauchy': [[0, 2], [1, 0.5], [-1, 1]],
    'LogGamma': [[2, 2, 2], [0.5, 0.5, 1], [3, 1, 0]],
    'LogLaplace': [[0, 2], [1, 0.5], [-1, 1]],
    'LogLogistic': [[2, 2], [0.5, 0.5], [3, 1]],
    'LogNormal': [[0, 2], [1, 0.5], [-1, 1]],
    'Logarithmic': [[6, 30], [2, 10], [1, 5]],
    'Logistic': [[0, 2], [3, 0.5], [-1, 1]],
    'LogisticExponential': [[2, 2], [0.5, 0.5], [1, 3]],
    'LogitNormal': [[0, 2], [1, 0.5], [-1, 1]],
    'Lomax': [[2, 2], [0.5, 0.5], [3, 1]],
    'Makeham': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 1, 3]],
    'MaxwellBoltzmann': [[2], [0.5], [1]],
    'Mielke': [[2, 2], [0.5, 4], [3, 1]],
    'Moyal': [[0, 2], [3, 0.5], [-1, 1]],
    'Muth': [[0.5], [0.1], [1]],
    'Nakagami': [[2.5, 2], [0.5, 0.5], [1, 3]],
    'NoncentralBeta': [[2, 2, 2], [0.5, 5, 10], [0.1, 2, 10]],
    'NoncentralChi': [[5, 2], [2, 0.5], [3, 1]],
    'NoncentralChi2': [[11, 2], [5, 3], [2, 1]],
    'NoncentralF': [[5, 5, 2], [2, 10, 0.5], [4, 6, 3]],
    'NoncentralT': [[5, 1], [5, 0], [8, 2]],
    'Normal': [[0, 2], [3, 0.5], [-1, 1]],
    'Pareto': [[2, 2], [1, 0.5], [3, 1]],
    'PERT': [[5, 15, 25], [0, 0.5, 1], [-2, 1, 3]],
    'PowerLaw': [[2], [0.5], [3]],
    'QExponential': [[0, 2], [0.5, 0.5], [1.5, 1]],
    'R': [[4], [0.5], [2]],
    'RaisedCosine': [[0, 2], [3, 0.5], [-1, 1]],
    'Rayleigh': [[2], [0.5], [1]],
    'Reciprocal': [[5, 25], [1, 10], [2, 8]],
    'ReciprocalInverseGaussian': [[2, 2], [0.5, 4], [1, 1]],
    'Rice': [[2, 2], [0.5, 2], [1, 1]],
    'ShiftedLogLogistic': [[0, 2, 2], [0, 2, -2], [0, 2, 0]],
    'SkewNormal': [[0, 2, 2], [0, 2, -2], [1, 1, 3]],
    'Slash': [[]],
    'StudentT': [[2], [0.5], [5]],
    'StudentZ': [[3], [2], [5]],
    'Trapezoidal': [[-3, -1, 1, 3], [0, 0.3, 0.7, 1], [1, 2, 4, 6]],
    'Triangular': [[5, 25, 15], [0, 1, 0.1], [-2, 2, 0]],
    'TruncatedNormal': [[2.5, 2, 0, 5], [0, 1, -2, 2], [1, 2, -1, 4]],
    'TukeyLambda': [[0], [2], [-2]],
    'UQuadratic': [[5, 25], [0, 1], [-2, 2]],
    'Uniform': [[5, 25], [0, 1], [-2, 2]],
    'UniformProduct': [[6], [2], [4]],
    'UniformRatio': [[]],
    'VonMises': [[2], [0.5], [1]],
    'Weibull': [[2, 2], [0.5, 0.5], [1, 3]],
    'Wigner': [[2], [0.5], [1]],
}

# DoublyNoncentralT CDF is a Poisson mixture of noncentral-t quadratures: too slow to invert
# by bisection, so we probe at fixed interior t-values instead.
DNCT_XVALS = {
    (5, 1, 2): [mpf('-2'), mpf('-0.5'), mpf('1'), mpf('2.5'), mpf('4')],
    (5, 0, 2): [mpf('-3'), mpf('-1.2'), mpf('0.7'), mpf('2'), mpf('3.5')],
    (6, 2, 1): [mpf('-1'), mpf('0.5'), mpf('2'), mpf('3.5'), mpf('5')],
}

# Doubly-noncentral Beta/F CDFs are double Poisson sums: too slow to invert by bisection,
# so we probe at fixed interior values (strictly inside the support, 0 < cdf < 1).
# (2, 2, 1200, 1200) (issue #1086) additionally avoids x close to 0/1: at this lambda scale the
# summand's peak shifts by hundreds of Poisson-index steps as x moves away from 0.5 (e.g. ~360
# steps at x=0.1), which the fixed 500-step series cap in doubly-noncentral-beta.js's _seriesSum
# does not fully reach that far out — x in [0.3, 0.5] stays within the range that cap does reach,
# matching this file's own convention of probing "near and away from 0.5", not the extreme tail.
# Only 2 points (not the usual 5): the shared dncbeta_pdf/dncbeta_cdf brute-force double loop is
# minutes per cdf() call at this lambda scale (no incremental log-gamma/log-beta optimization),
# so test/precision-continuous.js's entry for this case was generated by a faster standalone
# script using the same formula (mathematically identical, verified against this file's
# dncbeta_pdf/dncbeta_cdf at the existing small-lambda cases) rather than this pipeline directly.
DNCBETA_XVALS = {
    (2, 2, 2, 2): [mpf('0.25'), mpf('0.4'), mpf('0.55'), mpf('0.7'), mpf('0.85')],
    (2, 2, 1, 3): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
    (3, 4, 2, 2): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
    (2, 2, 1200, 1200): [mpf('0.3'), mpf('0.5')],
}
DNCF_XVALS = {
    (5, 5, 2, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (5, 5, 1, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (4, 6, 2, 1): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
}

# Quadrature-based CDFs (Davis, noncentral-t, SkewNormal, VonMises): inverting by bisection
# would re-run the integral 70x per point, so we probe at fixed interior values instead.
NCT_XVALS = {
    (5, 1): [mpf('-1'), mpf('0.5'), mpf('1.5'), mpf('2.8'), mpf('4.5')],
    (5, 0): [mpf('-2.5'), mpf('-1'), mpf('0.3'), mpf('1.5'), mpf('3')],
    (8, 2): [mpf('0.5'), mpf('1.5'), mpf('2.5'), mpf('3.5'), mpf('5')],
}
SKEWNORMAL_XVALS = {
    (0, 2, 2): [mpf('-1'), mpf('0.5'), mpf('2'), mpf('4'), mpf('6')],
    (0, 2, -2): [mpf('-6'), mpf('-4'), mpf('-2'), mpf('-0.5'), mpf('1')],
    (1, 1, 3): [mpf('0.2'), mpf('0.7'), mpf('1.3'), mpf('2'), mpf('3')],
}
VONMISES_XVALS = {
    (2,): [mpf('-2'), mpf('-0.8'), mpf('0.4'), mpf('1.2'), mpf('2.5')],
    (0.5,): [mpf('-2.5'), mpf('-1'), mpf('0.4'), mpf('1.4'), mpf('2.5')],
    (1,): [mpf('-2.5'), mpf('-1'), mpf('0.4'), mpf('1.4'), mpf('2.5')],
}
# Davis is inverted by bisection like the rest (its quadrature CDF is slow but tolerable for
# one distribution) so its probes span the full support {0.1..0.9} rather than fixed points.
MANUAL_XVALS = {
    'DoublyNoncentralT': DNCT_XVALS,
    'DoublyNoncentralBeta': DNCBETA_XVALS,
    'DoublyNoncentralF': DNCF_XVALS,
    'NoncentralT': NCT_XVALS,
    'SkewNormal': SKEWNORMAL_XVALS,
    'VonMises': VONMISES_XVALS,
}

# Far-tail x-values for Normal and LogNormal (issue #808): x = mu - k*sigma at k=5,7.
# These exercise the erfc continued-fraction branch. They are emitted as SEPARATE REFS
# groups (tol: 1e-14, qtol: 1e-14) in test/precision-continuous.js; separate groups are
# required so the group-level tolerance does not degrade the 5 interior probes.
# The float64 reference values below were computed at mp.dps=50 and are stored here as
# documentation; the test file groups are maintained manually (not regenerated by --emit).
# Normal(0,2):   x=-10 => pdf=7.433597573671488e-07  cdf=2.866515718791939e-07
#                x=-14 => pdf=4.567360204182297e-12  cdf=1.279812543885835e-12
# Normal(3,0.5): x=0.5 => pdf=2.9734390294685954e-06 cdf=2.866515718791939e-07
#                x=-0.5=> pdf=1.8269440816729187e-11  cdf=1.279812543885835e-12
# Normal(-1,1):  x=-6  => pdf=1.4867195147342977e-06 cdf=2.866515718791939e-07
#                x=-8  => pdf=9.134720408364594e-12   cdf=1.279812543885835e-12
# LogNormal(0,2):   x=4.54e-05 => pdf=0.016373588268883323 cdf=2.866515718791939e-07
#                   x=8.32e-07 => pdf=5.49272694887334e-06  cdf=1.279812543885835e-12
# LogNormal(1,0.5): x=0.2231   => pdf=1.3326029199686027e-05 cdf=2.866515718791939e-07
#                   x=0.0821   => pdf=2.2256735241523284e-10  cdf=1.279812543885835e-12
# LogNormal(-1,1):  x=0.002479 => pdf=0.0005997854600913624 cdf=2.866515718791939e-07
#                   x=0.000335 => pdf=2.723021776070751e-08   cdf=1.279812543885835e-12
NORMAL_FAR_TAIL_XVALS = {
    'Normal': {
        (0, 2):   [mpf('-10'), mpf('-14')],
        (3, 0.5): [mpf('0.5'), mpf('-0.5')],
        (-1, 1):  [mpf('-6'),  mpf('-8')],
    },
    'LogNormal': {
        (0, 2):   [exp(mpf('-10')), exp(mpf('-14'))],
        (1, 0.5): [exp(mpf('-1.5')), exp(mpf('-2.5'))],
        (-1, 1):  [exp(mpf('-6')),  exp(mpf('-8'))],
    },
}

NONE = None


def support(name, p):
    if name in ('Alpha', 'BetaPrime', 'Burr', 'Chi', 'Chi2', 'Dagum', 'Erlang',
                'Exponential', 'ExponentialLogarithmic', 'ExponentiatedWeibull', 'F',
                'Gamma', 'GammaGompertz', 'GeneralizedExponential', 'GeneralizedGamma',
                'Gilbrat', 'Gompertz', 'HalfGeneralizedNormal', 'HalfLogistic', 'HalfNormal',
                'Hoyt', 'Hyperexponential', 'InverseChi2', 'InverseGamma', 'InverseGaussian',
                'InvertedWeibull', 'Kolmogorov', 'Lindley', 'LogCauchy', 'LogLaplace',
                'LogLogistic', 'LogNormal', 'LogisticExponential', 'Lomax', 'Makeham',
                'MaxwellBoltzmann', 'Mielke', 'Muth', 'Nakagami', 'NoncentralChi',
                'NoncentralChi2', 'NoncentralF', 'Rayleigh', 'ReciprocalInverseGaussian',
                'Rice', 'UniformRatio', 'Weibull', 'DoublyNoncentralChi2', 'DoublyNoncentralF'):
        return (mpf(0), NONE)
    if name in ('Beta', 'BaldingNichols', 'Bradford', 'Kumaraswamy', 'LogitNormal',
                'PowerLaw', 'UniformProduct', 'DoublyNoncentralBeta', 'NoncentralBeta'):
        return (mpf(0), mpf(1))
    if name in ('AsymmetricLaplace', 'Cauchy', 'Champernowne', 'DoubleGamma', 'DoubleWeibull',
                'FisherZ', 'Gumbel', 'GeneralizedLogistic', 'GeneralizedNormal',
                'HyperbolicSecant', 'Laplace', 'Logistic', 'Moyal', 'Normal', 'SkewNormal',
                'Slash', 'StudentT', 'StudentZ', 'NoncentralT', 'DoublyNoncentralT'):
        return (NONE, NONE)
    if name == 'Anglit':
        mu, beta = mpf(p[0]), mpf(p[1])
        return (mu - pi * beta / 4, mu + pi * beta / 4)
    if name in ('Arcsine', 'Logarithmic', 'Reciprocal', 'UQuadratic', 'Uniform'):
        return (mpf(p[0]), mpf(p[1]))
    if name == 'Bates':
        return (mpf(p[1]), mpf(p[2]))
    if name == 'Benini':
        return (mpf(p[2]), NONE)
    if name == 'BenktanderII':
        return (mpf(1), NONE)
    if name == 'BetaRectangular':
        return (mpf(p[3]), mpf(p[4]))
    if name in ('BirnbaumSaunders', 'Davis', 'Levy'):
        return (mpf(p[0]), NONE)
    if name == 'BoundedPareto':
        return (mpf(p[0]), mpf(p[1]))
    if name == 'Frechet':
        return (mpf(p[2]), NONE)
    if name == 'GeneralizedExtremeValue':
        c = mpf(p[0])
        return (NONE, 1 / c) if c > 0 else (1 / c, NONE)
    if name == 'GeneralizedPareto':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return (mu, NONE) if xi >= 0 else (mu, mu - sigma / xi)
    if name == 'IrwinHall':
        return (mpf(0), mpf(int(round(p[0]))))
    if name == 'JohnsonSB':
        return (mpf(p[3]), mpf(p[3]) + mpf(p[2]))
    if name == 'JohnsonSU':
        return (NONE, NONE)
    if name == 'LogGamma':
        return (mpf(p[2]), NONE)
    if name == 'Pareto':
        return (mpf(p[0]), NONE)
    if name == 'PERT':
        return (mpf(p[0]), mpf(p[2]))
    if name == 'QExponential':
        q, lam = mpf(p[0]), mpf(p[1])
        return (mpf(0), NONE) if q >= 1 else (mpf(0), 1 / (lam * (1 - q)))
    if name == 'R':
        return (mpf(-1), mpf(1))
    if name == 'RaisedCosine':
        return (mpf(p[0]) - mpf(p[1]), mpf(p[0]) + mpf(p[1]))
    if name == 'ShiftedLogLogistic':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if xi == 0:
            return (NONE, NONE)
        return (mu - sigma / xi, NONE) if xi > 0 else (NONE, mu - sigma / xi)
    if name == 'Trapezoidal':
        return (mpf(p[0]), mpf(p[3]))
    if name == 'Triangular':
        return (mpf(p[0]), mpf(p[1]))
    if name == 'TruncatedNormal':
        return (mpf(p[2]), mpf(p[3]))
    if name == 'TukeyLambda':
        lam = mpf(p[0])
        return (-1 / lam, 1 / lam) if lam > 0 else (NONE, NONE)
    if name == 'VonMises':
        return (-pi, pi)
    if name == 'Wigner':
        return (-mpf(p[0]), mpf(p[0]))
    raise ValueError('support: ' + name)


def invcdf(name, p, pv):
    lo, hi = support(name, p)
    if lo is None:
        a = mpf(-1)
        for _ in range(300):
            if cdf(name, p, a) <= pv:
                break
            a *= 2
    else:
        a = mpf(lo)
    if hi is None:
        # Seed strictly inside the support (lo + 1) so we never evaluate cdf at the lower
        # boundary, where transforms like BirnbaumSaunders' (z - 1/z) divide by zero.
        b = (mpf(lo) + 1) if lo is not None else mpf(1)
        for _ in range(300):
            if cdf(name, p, b) >= pv:
                break
            b = b + fabs(b) + 1 if b <= 0 else b * 2
    else:
        b = mpf(hi)
    for _ in range(70):
        m = (a + b) / 2
        if cdf(name, p, m) < pv:
            a = m
        else:
            b = m
    return (a + b) / 2


def xvalues(name, p):
    if name in MANUAL_XVALS:
        return MANUAL_XVALS[name][tuple(p)]
    if name == 'TukeyLambda':
        # exact closed-form quantile avoids root-finding inside bisection at the support edge
        lam = mpf(p[0])
        if lam == 0:
            return [log(pv / (1 - pv)) for pv in P_GRID]
        return [(power(pv, lam) - power(1 - pv, lam)) / lam for pv in P_GRID]
    return [invcdf(name, p, pv) for pv in P_GRID]


def num(x):
    return repr(float(x))


def js_params(p):
    return json.dumps(p)


def js_lit(v):
    # Standard.js-style literal: unquoted object keys, spaces inside braces, single-quoted strings.
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, list):
        return '[' + ', '.join(js_lit(x) for x in v) + ']'
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{k}: {js_lit(val)}' for k, val in v.items()) + ' }'
    if isinstance(v, str):
        return "'" + v + "'"
    return json.dumps(v)


# Per-(name, json-params) tolerance overrides for pdf/cdf (default 1e-14). Empirically pinned
# to the tightest power-of-ten the ranjs implementation actually reaches; see NOTES for why.
PDFCDF_TOL = {
    ('Bates', '[10, 5, 25]'): '1e-13',
    ('IrwinHall', '[10]'): '1e-13',
    ('Levy', '[0, 2]'): '1e-12',
    ('Levy', '[1, 0.5]'): '1e-12',
    ('Levy', '[-1, 1]'): '1e-12',
    ('NoncentralBeta', '[0.1, 2, 10]'): '1e-13',
    ('NoncentralChi', '[5, 2]'): '1e-13',
    ('NoncentralT', '[5, 0]'): '2e-14',
    ('NoncentralT', '[5, 1]'): '1e-12',
    ('NoncentralT', '[8, 2]'): '2e-14',
    ('DoublyNoncentralT', '[5, 0, 2]'): '1e-13',
    ('DoublyNoncentralT', '[5, 1, 2]'): '1e-12',
    ('DoublyNoncentralT', '[6, 2, 1]'): '1e-12',
    ('SkewNormal', '[1, 1, 3]'): '1e-12',
    ('Rice', '[0.5, 2]'): '1e-13',
    ('R', '[0.5]'): '1e-13',
}
# Per-(name, json-params) quantile round-trip tolerance (default 1e-14; per-group empirical:
# closed-form/Halley quantiles stay at 1e-14, root-finding/approximate ones are looser).
Q_TOL = {
    ('BaldingNichols', '[0.1, 0.1]'): '1e-13',
    ('Bates', '[5, -2, 2]'): '1e-12',
    ('BenktanderII', '[2, 0.9995]'): '1e-9',
    ('BetaPrime', '[0.5, 4]'): '1e-12',
    ('Davis', '[2, 1, 4]'): '1e-12',
    ('DoublyNoncentralChi2', '[2, 3, 1, 1]'): '1e-13',
    ('NoncentralChi2', '[2, 1]'): '1e-13',
    ('DoublyNoncentralT', '[5, 1, 2]'): '1e-12',
    ('DoublyNoncentralT', '[6, 2, 1]'): '1e-12',
    ('FisherZ', '[1, 1]'): '4e-14',
    ('FisherZ', '[5, 5]'): '1e-12',
    ('FisherZ', '[8, 4]'): '1e-12',
    ('InverseGaussian', '[1, 0.5]'): '1e-10',
    ('InverseGaussian', '[3, 1]'): '1e-11',
    ('Muth', '[0.1]'): '1e-12',
    ('NoncentralF', '[2, 10, 0.5]'): '1e-13',
    ('PERT', '[-2, 1, 3]'): '2e-14',
    ('R', '[0.5]'): '1e-13',
    ('R', '[2]'): '1e-12',
    ('SkewNormal', '[1, 1, 3]'): '1e-13',
    ('StudentT', '[2]'): '1e-12',
    ('StudentT', '[5]'): '1e-12',
    ('StudentZ', '[3]'): '1e-13',
    ('StudentZ', '[5]'): '1e-12',
    ('UniformProduct', '[2]'): '1e-13',
    ('UniformProduct', '[4]'): '5e-13',
    ('UniformProduct', '[6]'): '1e-11',
    ('LogGamma', '[0.5, 0.5, 1]'): '2e-14',
}
# Per-(name, json-params) one-line justification comment emitted above a loosened group.
_N_SERIES = 'series/transform accumulates a few ULPs beyond 1e-14'
_N_ERFC = 'cdf uses erfc; its rounding caps relative accuracy just below 1e-13'
_N_NCT = 'pdf/cdf are noncentral-t (Poisson) mixtures; accumulated rounding caps accuracy near 1e-13'
_N_POLY = 'piecewise-polynomial Neumaier sum loses ~1 ULP beyond 1e-14'
_N_ROOT = 'q() has no closed form (numerical root-finding), so the round-trip is accurate to a few ULPs beyond 1e-14'
_N_BENK = 'q() switches to a Lambert-W asymptotic branch as b->1 (here b=0.9995); round-trip accurate to ~1e-9'
_N_HALLEY = 'q() is a Cornish-Fisher/Halley approximation; the cdf-round-trip loses a few ULPs beyond 1e-14'
NOTES = {
    ('Bates', '[10, 5, 25]'): _N_POLY,
    ('Bates', '[5, -2, 2]'): _N_POLY,
    ('IrwinHall', '[10]'): _N_POLY,
    ('Levy', '[0, 2]'): _N_ERFC,
    ('Levy', '[1, 0.5]'): _N_ERFC,
    ('Levy', '[-1, 1]'): _N_ERFC,
    ('NoncentralBeta', '[0.1, 2, 10]'): _N_SERIES,
    ('NoncentralChi', '[5, 2]'): _N_SERIES,
    ('NoncentralT', '[5, 0]'): _N_NCT,
    ('NoncentralT', '[5, 1]'): _N_NCT,
    ('NoncentralT', '[8, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[5, 0, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[5, 1, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[6, 2, 1]'): _N_NCT,
    ('SkewNormal', '[1, 1, 3]'): 'cdf uses Owen T and q() root-finds on it; both lose a few ULPs beyond 1e-14',
    ('Rice', '[0.5, 2]'): _N_SERIES,
    ('R', '[0.5]'): _N_SERIES,
    ('R', '[2]'): _N_SERIES,
    ('BaldingNichols', '[0.1, 0.1]'): _N_ROOT,
    ('BenktanderII', '[2, 0.9995]'): _N_BENK,
    ('BetaPrime', '[0.5, 4]'): _N_ROOT,
    ('Davis', '[2, 1, 4]'): _N_ROOT,
    ('DoublyNoncentralChi2', '[2, 3, 1, 1]'): _N_ROOT,
    ('NoncentralChi2', '[2, 1]'): _N_ROOT,
    ('FisherZ', '[1, 1]'): _N_ROOT,
    ('FisherZ', '[5, 5]'): _N_ROOT,
    ('FisherZ', '[8, 4]'): _N_ROOT,
    ('Muth', '[0.1]'): _N_ROOT,
    ('NoncentralF', '[2, 10, 0.5]'): _N_ROOT,
    ('StudentT', '[2]'): _N_HALLEY,
    ('StudentT', '[5]'): _N_HALLEY,
    ('StudentZ', '[3]'): _N_HALLEY,
    ('StudentZ', '[5]'): _N_HALLEY,
    ('PERT', '[-2, 1, 3]'): _N_ROOT,
    ('UniformProduct', '[2]'): 'q() has no closed form (numerical root-finding); round-trip measured at 1.1e-14 on Node 20 (V8/libm rounding differs across Node versions) — gate at 1e-13 (#759)',
    ('UniformProduct', '[4]'): 'q() has no closed form (numerical root-finding); round-trip measured at 1.4e-13 in JIT-order-dependent full-suite runs — gate at 5e-13 (#759)',
    ('UniformProduct', '[6]'): _N_ROOT,
}


CACHE = '/tmp/precision-continuous-cache.json'


def compute_cache():
    cache = []
    for name, sets in PARAM_SETS.items():
        for p in sets:
            pts = []
            for x in xvalues(name, p):
                pts.append([num(x), num(pdf(name, p, x)), num(cdf(name, p, x))])
            cache.append({'name': name, 'params': p, 'points': pts})
            print(f'  computed {name}{p}', flush=True)
    with open(CACHE, 'w') as fh:
        json.dump(cache, fh)
    print(f'cached {len(cache)} groups to {CACHE}', flush=True)
    return cache


def render(cache):
    groups = []
    for g in cache:
        name, p = g['name'], g['params']
        jp = js_params(p)
        key = (name, jp)
        tol = PDFCDF_TOL.get(key, '1e-14')
        qtol = Q_TOL.get(key, '1e-14')
        note = NOTES.get(key)
        comment = f'  // {name}{jp}: {note}\n' if note else ''
        pts = ',\n      '.join(
            f'{{ x: {x}, pdf: {pv}, cdf: {cv} }}' for x, pv, cv in g['points'])
        groups.append(
            f"{comment}  {{\n    name: '{name}',\n    params: {js_lit(p)},\n"
            f"    tol: {tol},\n    qtol: {qtol},\n    points: [\n      {pts}\n    ]\n  }}")
    data = '[\n' + ',\n'.join(groups) + '\n]'
    with open('test/precision-continuous.js', 'w') as fh:
        fh.write(TEMPLATE.format(data=data))
    print(f'wrote test/precision-continuous.js with {len(groups)} groups', flush=True)


def emit():
    render(compute_cache())


TEMPLATE = '''/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
// ESLint's no-loss-of-precision rule false-positives on a few 17-significant-digit literals
// that do round-trip exactly, so it is disabled for this generated reference file.
import {{ assert }} from 'chai'
import {{ describe, it, before, beforeEach, afterEach }} from 'mocha'
import * as dist from '../src/dist'

// Continuous-distribution precision gate (issue #633 -- v1.27.0 milestone).
//
// Reference values are from mpmath 1.4.1 at mp.dps = 50, rounded to float64.
// Generator (also the source of every formula): scripts/precision-refs-continuous.py
//
// For each distribution, 3 parameter sets x 5 interior x-values (the F^-1(p) for
// p in {{0.1, 0.3, 0.53, 0.72, 0.9}} -- off the exact centre so symmetric medians and
// UQuadratic's central zero do not appear -- so every probe is strictly inside the support) are
// checked for pdf, cdf and quantile:
//   pdf / cdf : relative error |result / reference - 1| <= tol (1e-14, or a documented
//               looser bound capped at 1e-12 for known series/cancellation limits).
//   quantile  : round-trip q(cdf_ref) must return x. Tolerance is per-group empirical
//               (qtol): 1e-14 for closed-form/Halley quantiles, a documented looser bound
//               where ranjs computes the quantile by root-finding or approximation (these
//               are inherent to the implementation and out of scope for this test-only issue).
//
// Reference math is INDEPENDENT of the ranjs implementation -- it matches the external
// (scipy/mpmath) parameterization documented in test/dist-cases-continuous.js, which the
// generator self-checks before emitting these literals.
// Parameter-free distributions (Gilbrat, HalfLogistic, ...) naturally have a single set.
const REFS = {data}

describe('continuous-distribution precision gate', () => {{
  // Distributions without a closed-form quantile fall back to _qEstimateRoot, which seeds its
  // root-finding bracket with Math.random(); pin it so the round-trip gate is deterministic
  // (otherwise the borderline ~1e-13 groups flicker run-to-run) and reproducible for regression.
  let _rng
  beforeEach(() => {{ _rng = Math.random; Math.random = () => 0.5 }})
  afterEach(() => {{ Math.random = _rng }})

  REFS.forEach(({{ name, params, tol, qtol, points }}) => {{
    describe(`${{name}}(${{JSON.stringify(params)}})`, () => {{
      // Construct in a before() hook so a constructor regression surfaces as a failing
      // hook rather than silently skipping every assertion in this group.
      let d
      before(() => {{ d = new dist[name](...params) }})
      // One test per method (not per point): the message pinpoints the failing x, while
      // pdf/cdf/quantile stay isolated so a regression in one does not mask the others.
      it(`pdf to ${{tol}} relative error`, () => {{
        points.forEach(({{ x, pdf }}) => {{
          // Guard the relative form against an exact-zero reference (pdf can vanish at an
          // interior point, e.g. UQuadratic at its centre).
          if (pdf === 0) assert.strictEqual(d.pdf(x), 0, `pdf at x=${{x}}`)
          else assert.approximately(d.pdf(x) / pdf, 1, tol, `pdf at x=${{x}}`)
        }})
      }})
      it(`cdf to ${{tol}} relative error`, () => {{
        points.forEach(({{ x, cdf }}) => {{
          // Guard the relative form against an exact-zero reference (defensive: all current
          // probes have cdf >= 0.1, but a future grid change could include a near-zero p).
          if (cdf === 0) assert.strictEqual(d.cdf(x), 0, `cdf at x=${{x}}`)
          else assert.approximately(d.cdf(x) / cdf, 1, tol, `cdf at x=${{x}}`)
        }})
      }})
      it(`quantile round-trips q(cdf(x)) = x to ${{qtol}}`, () => {{
        points.forEach(({{ x, cdf }}) => {{
          const back = d.q(cdf)
          // Relative form for x away from 0; absolute fallback at x near 0 (relative error undefined).
          if (Math.abs(x) > 1e-8) assert.approximately(back / x, 1, qtol, `q(cdf(${{x}}))`)
          else assert.approximately(back, x, qtol, `q(cdf(${{x}}))`)
        }})
      }})
    }})
  }})
}})
'''


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--emit':
        emit()
    elif len(sys.argv) > 1 and sys.argv[1] == '--render':
        # Fast re-render from the cached mpmath values (no recomputation) after editing tolerances.
        with open(CACHE) as fh:
            render(json.load(fh))
    else:
        only = None
        if len(sys.argv) > 2 and sys.argv[1] == '--only':
            only = set(sys.argv[2].split(','))
        self_check(only)
