#!/usr/bin/env python3
"""
gen-dist-refs.py — Generate high-precision mpmath reference values for all ranjs
distributions. Output is JavaScript fragments ready to paste into
test/dist-cases-continuous.js and test/dist-cases-discrete.js.

Spot-checks verified against Wolfram Alpha / scipy:
  Normal(0,1)     pdf(0)   = 1/sqrt(2*pi) ≈ 0.3989422804014327
  Exponential(1)  cdf(1)   = 1 - e^{-1}   ≈ 0.6321205588285578
  Beta(2,3)       cdf(0.5) = I_{0.5}(2,3) = 0.6875 (exact)
  Poisson(5)      pmf(5)   = e^{-5}5^5/5! ≈ 0.1754673697678507
  Gamma(2,1)      pdf(1)   = 1*e^{-1}     ≈ 0.3678794411714423

Requires: mpmath>=1.3
Usage:
    python3 scripts/gen-dist-refs.py               # all distributions
    python3 scripts/gen-dist-refs.py Normal        # one distribution
    python3 scripts/gen-dist-refs.py --discrete    # all discrete only
    python3 scripts/gen-dist-refs.py --continuous  # all continuous only
"""
import sys
from mpmath import (mp, mpf, pi, sqrt, exp, log, expm1, log1p, cosh, tanh,
                    atan, asin, asinh, acos, sin, cos, gamma as gammafn, loggamma,
                    beta as betafn, erf, erfc, besseli, power, fsum, factorial, zeta,
                    quad, inf, fabs, sign, nsum, gammainc, betainc, binomial)

mp.dps = 50

HALF = mpf(1) / 2
SQRT2 = sqrt(2)
SQRT2PI = sqrt(2 * pi)
P_GRID = [mpf('0.1'), mpf('0.3'), mpf('0.5'), mpf('0.7'), mpf('0.9')]
NONE = None


# ---- standard normal helpers ----

def Phi(z):
    return HALF * (1 + erf(mpf(z) / SQRT2))


def phi(z):
    z = mpf(z)
    return exp(-z * z / 2) / SQRT2PI


def Preg(s, x):
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
    # Poisson weight P(Poisson(lam) = j), log-space for stability
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
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    h1 = mpf(l1) / 2
    h2 = mpf(l2) / 2
    s = mpf(0)
    r = 0
    while True:
        wr = pois_w(h1, r)
        inner = mpf(0)
        si = 0
        while True:
            term = wr * pois_w(h2, si) * Ireg(mpf(a) + r, mpf(b) + si, x)
            inner += term
            if si > h2 + 5 and (wr * pois_w(h2, si)) < mpf('1e-55'):
                break
            si += 1
            if si > 5000:
                break
        s += inner
        if r > h1 + 5 and wr < mpf('1e-55'):
            break
        r += 1
        if r > 5000:
            break
    return s


def dncbeta_pdf(a, b, l1, l2, x):
    x = mpf(x)
    if x <= 0 or x >= 1:
        return mpf(0)
    h1 = mpf(l1) / 2
    h2 = mpf(l2) / 2
    s = mpf(0)
    r = 0
    while True:
        wr = pois_w(h1, r)
        inner = mpf(0)
        si = 0
        while True:
            aj = mpf(a) + r
            bj = mpf(b) + si
            term = wr * pois_w(h2, si) * exp((aj - 1) * log(x) + (bj - 1) * log(1 - x) - log(betafn(aj, bj)))
            inner += term
            if si > h2 + 5 and (wr * pois_w(h2, si)) < mpf('1e-55'):
                break
            si += 1
            if si > 5000:
                break
        s += inner
        if r > h1 + 5 and wr < mpf('1e-55'):
            break
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


def ih_pdf(n, x):
    n = int(round(n))
    x = mpf(x)
    if x < 0 or x > n:
        return mpf(0)
    kmax = int(x)
    s = mpf(0)
    for k in range(kmax + 1):
        s += (1 if k % 2 == 0 else -1) * binomial(n, k) * power(x - k, n - 1)
    return s / factorial(n - 1)


def ih_cdf(n, x):
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


# ---- discrete helper (arg order: k first, lam second) ----

def pois(k, lam):
    if lam == 0:
        return mpf(1) if k == 0 else mpf(0)
    return exp(-lam) * power(lam, k) / factorial(k)


# =========================================================================
# Continuous pdf / cdf dispatch
# =========================================================================

def pdf(name, p, x):
    x = mpf(x)
    if name == 'Alpha':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return beta * exp(-HALF * (alpha - beta / x) ** 2) / (x * x * Phi(alpha) * SQRT2PI)
    if name == 'Anglit':
        mu, beta = mpf(p[0]), mpf(p[1])
        return cos(2 / beta * x - 2 * mu / beta) / beta
    if name == 'Arcsine':
        a, b = mpf(p[0]), mpf(p[1])
        return (1 / pi) / sqrt((x - a) * (b - x))
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
    if name == 'Dagum':
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
        if x == 0:
            from mpmath import diff
            return diff(lambda t: nct_cdf(nu, mu, t), mpf('1e-30'))
        return mpf(nu) * (nct_cdf(nu + 2, mu, x * sqrt(1 + mpf(2) / nu)) - nct_cdf(nu, mu, x)) / x
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
    if name == 'Alpha':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Phi(alpha - beta / x) / Phi(alpha)
    if name == 'Anglit':
        mu, beta = mpf(p[0]), mpf(p[1])
        return sin(x / beta - (mu / beta - pi / 4)) ** 2
    if name == 'Arcsine':
        a, b = mpf(p[0]), mpf(p[1])
        return 2 / pi * asin(sqrt((x - a) / (b - a)))
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
# Discrete pmf dispatch
# =========================================================================

def pmf(name, p, k):
    if name == 'Bernoulli':
        (pp,) = p
        return mpf(pp) if k == 1 else 1 - mpf(pp)
    if name == 'BetaBinomial':
        n, a, b = map(mpf, p)
        return binomial(n, k) * betafn(k + a, n - k + b) / betafn(a, b)
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
            gammafn(a + i) * power(b, i) / (gammafn(a) * power(1 + b, a + i) * factorial(i))
            * exp(-lam) * power(lam, k - i) / factorial(k - i)
            for i in range(0, k + 1))
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
        lam, phi_p = mpf(p[0]), mpf(p[1])
        s = mpf(0)
        j = 0
        while True:
            term = pois(j, lam) * pois(k, j * phi_p)
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
        return rho * betafn(mpf(k), rho + 1)
    if name == 'Zeta':
        s = mpf(p[0])
        return power(k, -s) / zeta(s)
    if name == 'Zipf':
        s, N = mpf(p[0]), int(p[1])
        return power(k, -s) / fsum(power(i, -s) for i in range(1, N + 1))
    if name == 'ZipfMandelbrot':
        N, s, q = int(p[0]), mpf(p[1]), mpf(p[2])
        return power(k + q, -s) / fsum(power(i + q, -s) for i in range(1, N + 1))
    raise ValueError('pmf: ' + name)


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
    if name == 'Skellam':
        return -200
    return 0


def step(name):
    return 2 if name in ('HeadsMinusTails', 'Rademacher') else 1


def dcdf(name, p, k):
    lo = support_lo(name, p)
    st = step(name)
    return fsum(pmf(name, p, j) for j in range(lo, k + 1, st))


# =========================================================================
# Continuous support / inverse CDF
# =========================================================================

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
    if name in ('Cauchy', 'Champernowne', 'DoubleGamma', 'DoubleWeibull', 'FisherZ', 'Gumbel',
                'GeneralizedLogistic', 'GeneralizedNormal', 'HyperbolicSecant', 'Laplace',
                'Logistic', 'Moyal', 'Normal', 'SkewNormal', 'Slash', 'StudentT', 'StudentZ',
                'NoncentralT', 'DoublyNoncentralT'):
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


# =========================================================================
# Manual x-values for distributions where bisection is too slow
# =========================================================================

DNCT_XVALS = {
    (5, 1, 2): [mpf('-2'), mpf('-0.5'), mpf('1'), mpf('2.5'), mpf('4')],
    (5, 0, 2): [mpf('-3'), mpf('-1.2'), mpf('0.7'), mpf('2'), mpf('3.5')],
    (6, 2, 1): [mpf('-1'), mpf('0.5'), mpf('2'), mpf('3.5'), mpf('5')],
}
DNCBETA_XVALS = {
    (2, 2, 2, 2): [mpf('0.25'), mpf('0.4'), mpf('0.55'), mpf('0.7'), mpf('0.85')],
    (2, 2, 1, 3): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
    (3, 4, 2, 2): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
}
DNCF_XVALS = {
    (5, 5, 2, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (5, 5, 1, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (4, 6, 2, 1): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
}
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
MANUAL_XVALS = {
    'DoublyNoncentralT': DNCT_XVALS,
    'DoublyNoncentralBeta': DNCBETA_XVALS,
    'DoublyNoncentralF': DNCF_XVALS,
    'NoncentralT': NCT_XVALS,
    'SkewNormal': SKEWNORMAL_XVALS,
    'VonMises': VONMISES_XVALS,
}


def xvalues(name, p):
    if name in MANUAL_XVALS:
        return MANUAL_XVALS[name][tuple(p)]
    if name == 'TukeyLambda':
        lam = mpf(p[0])
        if lam == 0:
            return [log(pv / (1 - pv)) for pv in P_GRID]
        return [(power(pv, lam) - power(1 - pv, lam)) / lam for pv in P_GRID]
    return [invcdf(name, p, pv) for pv in P_GRID]


# =========================================================================
# Parameter sets (2 per continuous distribution, 3 for MANUAL_XVALS dists)
# =========================================================================

PARAM_SETS = {
    'Alpha': [[2, 2], [0.5, 0.5]],
    'Anglit': [[0, 2], [3, 0.5]],
    'Arcsine': [[5, 25], [0, 1]],
    'BaldingNichols': [[0.5, 0.5], [0.1, 0.1]],
    'Bates': [[10, 5, 25], [3, 0, 1]],
    'Benini': [[2, 2, 2], [0.5, 0.5, 1]],
    'BenktanderII': [[2, 0.9995], [2, 1]],
    'Beta': [[2, 2], [0.5, 0.5]],
    'BetaPrime': [[2, 2], [0.5, 4]],
    'BetaRectangular': [[2, 2, 0.5, 5, 25], [0.5, 0.5, 0.9, 5, 25]],
    'BirnbaumSaunders': [[0, 2, 2], [0, 0.5, 0.5]],
    'BoundedPareto': [[5, 25, 2], [1, 10, 0.5]],
    'Bradford': [[2], [0.5]],
    'Burr': [[2, 2], [0.5, 4]],
    'Cauchy': [[0, 2], [3, 0.5]],
    'Champernowne': [[2, 0.5, 1], [1, 0, 0]],
    'Chi': [[1], [5]],
    'Chi2': [[5], [2]],
    'Dagum': [[2, 2, 2], [0.5, 0.5, 2]],
    'Davis': [[1, 1, 2], [1, 2, 3]],
    'DoubleGamma': [[2, 2], [0.5, 2]],
    'DoubleWeibull': [[2, 2], [2, 0.5]],
    'DoublyNoncentralBeta': [[2, 2, 2, 2], [2, 2, 1, 3], [3, 4, 2, 2]],
    'DoublyNoncentralChi2': [[3, 4, 2, 3], [2, 4, 1, 2]],
    'DoublyNoncentralF': [[5, 5, 2, 2], [5, 5, 1, 2], [4, 6, 2, 1]],
    'DoublyNoncentralT': [[5, 1, 2], [5, 0, 2], [6, 2, 1]],
    'Erlang': [[5, 2], [2, 0.5]],
    'Exponential': [[2], [0.5]],
    'ExponentialLogarithmic': [[0.5, 2], [0.9, 0.5]],
    'ExponentiatedWeibull': [[2, 2, 2], [0.5, 0.5, 0.5]],
    'F': [[5, 5], [2, 20]],
    'FisherZ': [[5, 5], [1, 1]],
    'Frechet': [[2, 2, 0], [0.5, 1, 0]],
    'Gamma': [[2, 2], [0.5, 0.5]],
    'GammaGompertz': [[2, 2, 2], [0.5, 0.5, 0.5]],
    'GeneralizedExponential': [[2, 2, 2], [2, 0.5, 4]],
    'GeneralizedExtremeValue': [[2], [-2]],
    'GeneralizedGamma': [[2, 2, 2], [0.5, 0.5, 0.5]],
    'GeneralizedLogistic': [[0, 2, 2], [3, 0.5, 0.5]],
    'GeneralizedNormal': [[0, 2, 2], [3, 0.5, 0.5]],
    'GeneralizedPareto': [[0, 2, 2], [0, 2, -2]],
    'Gilbrat': [[]],
    'Gompertz': [[2, 2], [0.5, 0.5]],
    'Gumbel': [[0, 2], [3, 0.5]],
    'HalfGeneralizedNormal': [[2, 2], [0.5, 0.5]],
    'HalfLogistic': [[]],
    'HalfNormal': [[2], [0.5]],
    'Hoyt': [[0.5, 2], [2, 1]],
    'HyperbolicSecant': [[]],
    'Hyperexponential': [
        [[{'weight': 1, 'rate': 0.5}, {'weight': 3, 'rate': 4}]],
        [[{'weight': 2, 'rate': 2}, {'weight': 1, 'rate': 0.5}, {'weight': 1, 'rate': 5}]],
    ],
    'InverseChi2': [[6], [2]],
    'InverseGamma': [[2, 2], [0.5, 0.5]],
    'InverseGaussian': [[2, 2], [1, 0.5]],
    'InvertedWeibull': [[2], [0.5]],
    'IrwinHall': [[10], [3]],
    'JohnsonSU': [[0, 2, 2, 0], [1, 0.5, 0.5, 1]],
    'JohnsonSB': [[0, 2, 2, 0], [1, 0.5, 0.5, 1]],
    'Kolmogorov': [[]],
    'Kumaraswamy': [[2, 2], [0.5, 0.5]],
    'Laplace': [[0, 2], [3, 0.5]],
    'Levy': [[0, 2], [1, 0.5]],
    'Lindley': [[2], [0.5]],
    'LogCauchy': [[0, 2], [1, 0.5]],
    'LogGamma': [[2, 2, 2], [0.5, 0.5, 1]],
    'LogLaplace': [[0, 2], [1, 0.5]],
    'LogLogistic': [[2, 2], [0.5, 0.5]],
    'LogNormal': [[0, 2], [1, 0.5]],
    'Logarithmic': [[6, 30], [2, 10]],
    'Logistic': [[0, 2], [3, 0.5]],
    'LogisticExponential': [[2, 2], [0.5, 0.5]],
    'LogitNormal': [[0, 2], [1, 0.5]],
    'Lomax': [[2, 2], [0.5, 0.5]],
    'Makeham': [[2, 2, 2], [0.5, 0.5, 0.5]],
    'MaxwellBoltzmann': [[2], [0.5]],
    'Mielke': [[2, 2], [0.5, 4]],
    'Moyal': [[0, 2], [3, 0.5]],
    'Muth': [[0.5], [0.1]],
    'Nakagami': [[2.5, 2], [0.5, 0.5]],
    'NoncentralBeta': [[2, 2, 2], [0.5, 5, 10]],
    'NoncentralChi': [[5, 2], [2, 0.5]],
    'NoncentralChi2': [[11, 2], [5, 3]],
    'NoncentralF': [[5, 5, 2], [2, 10, 0.5]],
    'NoncentralT': [[5, 1], [5, 0], [8, 2]],
    'Normal': [[0, 2], [3, 0.5]],
    'Pareto': [[2, 2], [1, 0.5]],
    'PERT': [[5, 15, 25], [0, 0.5, 1]],
    'PowerLaw': [[2], [0.5]],
    'QExponential': [[0, 2], [0.5, 0.5]],
    'R': [[4], [0.5]],
    'RaisedCosine': [[0, 2], [3, 0.5]],
    'Rayleigh': [[2], [0.5]],
    'Reciprocal': [[5, 25], [1, 10]],
    'ReciprocalInverseGaussian': [[2, 2], [0.5, 4]],
    'Rice': [[2, 2], [0.5, 2]],
    'ShiftedLogLogistic': [[0, 2, 2], [0, 2, -2]],
    'SkewNormal': [[0, 2, 2], [0, 2, -2], [1, 1, 3]],
    'Slash': [[]],
    'StudentT': [[2], [0.5]],
    'StudentZ': [[3], [2]],
    'Trapezoidal': [[-3, -1, 1, 3], [0, 0.3, 0.7, 1]],
    'Triangular': [[5, 25, 15], [0, 1, 0.1]],
    'TruncatedNormal': [[2.5, 2, 0, 5], [0, 1, -2, 2]],
    'TukeyLambda': [[0], [2]],
    'UQuadratic': [[5, 25], [0, 1]],
    'Uniform': [[5, 25], [0, 1]],
    'UniformProduct': [[6], [2]],
    'UniformRatio': [[]],
    'VonMises': [[2], [0.5], [1]],
    'Weibull': [[2, 2], [0.5, 0.5]],
    'Wigner': [[2], [0.5]],
}

# =========================================================================
# Discrete spec: (name, params, k_values)
# =========================================================================

DISCRETE_SPEC = [
    ('Bernoulli', [0.5], [0, 1]),
    ('Bernoulli', [0.3], [0, 1]),
    ('BetaBinomial', [25, 2, 2], [0, 7, 12, 18, 24]),
    ('BetaBinomial', [10, 0.5, 4], [0, 1, 2, 4, 7]),
    ('Binomial', [25, 0.5], [5, 10, 12, 15, 20]),
    ('Binomial', [10, 0.1], [0, 1, 2, 3, 5]),
    ('Borel', [0.5], [1, 2, 3, 5, 8]),
    ('Borel', [0.3], [1, 2, 3, 4, 6]),
    ('BorelTanner', [0.5, 5], [5, 7, 9, 12, 18]),
    ('BorelTanner', [0.3, 3], [3, 4, 5, 7, 10]),
    ('Categorical', [[0.4, 0.6], 0], [0, 1]),
    ('Categorical', [[0.1, 0.05, 0.15, 0.08, 0.12, 0.1, 0.07, 0.13, 0.09, 0.11], 0], [0, 2, 4, 6, 9]),
    ('ConwayMaxwellPoisson', [2, 1.5], [0, 1, 2, 3, 5]),
    ('ConwayMaxwellPoisson', [3, 2], [0, 1, 2, 3, 4]),
    ('Delaporte', [2, 2, 2], [0, 2, 5, 8, 12]),
    ('Delaporte', [0.5, 0.5, 0.5], [0, 1, 2, 3, 5]),
    ('DiscreteUniform', [5, 50], [5, 15, 27, 40, 50]),
    ('DiscreteUniform', [0, 9], [0, 2, 4, 6, 9]),
    ('DiscreteWeibull', [0.5, 2], [0, 1, 2, 3, 4]),
    ('DiscreteWeibull', [0.75, 2], [0, 1, 2, 3, 5]),
    ('FlorySchulz', [0.5], [1, 2, 3, 5, 9]),
    ('FlorySchulz', [0.3], [1, 2, 4, 7, 12]),
    ('GeneralizedHermite', [2, 2, 6], [0, 2, 6, 9, 14]),
    ('GeneralizedHermite', [3, 2, 2], [0, 2, 4, 6, 9]),
    ('Geometric', [0.5], [0, 1, 2, 5, 10]),
    ('Geometric', [0.25], [0, 1, 2, 5, 10]),
    ('HeadsMinusTails', [5], [0, 2, 4, 6, 8]),
    ('HeadsMinusTails', [2], [0, 2, 4]),
    ('Hypergeometric', [30, 10, 5], [0, 1, 2, 3, 5]),
    ('Hypergeometric', [20, 3, 10], [0, 1, 2, 3]),
    ('LogSeries', [0.5], [1, 2, 3, 5, 10]),
    ('LogSeries', [0.9], [1, 2, 3, 8, 20]),
    ('NegativeHypergeometric', [35, 15, 7], [0, 2, 5, 8, 12]),
    ('NegativeHypergeometric', [20, 5, 10], [0, 1, 2, 3, 5]),
    ('NegativeBinomial', [10, 0.4], [0, 3, 5, 7, 10]),
    ('NegativeBinomial', [5, 0.6], [2, 5, 8, 12, 18]),
    ('NeymanA', [2, 2], [0, 1, 3, 6, 10]),
    ('NeymanA', [0.5, 0.5], [0, 1, 2, 3, 5]),
    ('Poisson', [10], [2, 5, 8, 10, 15]),
    ('Poisson', [40], [25, 33, 40, 48, 55]),
    ('PolyaAeppli', [2, 0.5], [0, 1, 2, 4, 8]),
    ('PolyaAeppli', [0.5, 0.1], [0, 1, 2, 3, 5]),
    ('Rademacher', [], [-1, 1]),
    ('Skellam', [5, 5], [-7, -3, 0, 3, 7]),
    ('Skellam', [1, 4], [-8, -4, -2, 0, 2]),
    ('Soliton', [10], [1, 2, 3, 5, 10]),
    ('Soliton', [3], [1, 2, 3]),
    ('YuleSimon', [3], [1, 2, 3, 6, 10]),
    ('YuleSimon', [2.5], [1, 2, 3, 5, 8]),
    ('Zeta', [3.8], [1, 2, 3, 6, 10]),
    ('Zeta', [5], [1, 2, 3, 5, 10]),
    ('Zipf', [3, 100], [1, 2, 3, 5, 30]),
    ('Zipf', [1.5, 20], [1, 2, 5, 10, 20]),
    ('ZipfMandelbrot', [100, 2, 1], [1, 2, 5, 30, 100]),
    ('ZipfMandelbrot', [20, 1.5, 2], [1, 3, 8, 15, 20]),
]


# =========================================================================
# Output helpers
# =========================================================================

def num(x):
    return repr(float(x))


def fmt_cont_entry(x, pdfv, cdfv):
    return '{ x: ' + num(x) + ', pdf: ' + num(pdfv) + ', cdf: ' + num(cdfv) + ' }'


def fmt_disc_entry(k, pmfv, cdfv):
    return '{ x: ' + str(k) + ', pmf: ' + num(pmfv) + ', cdf: ' + num(cdfv) + ' }'


def fmt_qv_entry(p_val, x_val):
    return '{ p: ' + num(p_val) + ', x: ' + num(x_val) + ' }'


def print_block(ref_lines, qv_lines):
    ref_body = ',\n      '.join(ref_lines)
    print('    refVals: [\n      ' + ref_body + '\n    ],')
    qv_body = ',\n      '.join(qv_lines)
    print('    quantileVals: [\n      ' + qv_body + '\n    ]')


def gen_continuous(name, p):
    xs = xvalues(name, p)
    ref_lines = []
    qv_lines = []
    for x in xs:
        pdfv = pdf(name, p, x)
        cdfv = cdf(name, p, x)
        ref_lines.append(fmt_cont_entry(x, pdfv, cdfv))
        qv_lines.append(fmt_qv_entry(cdfv, x))
    return ref_lines, qv_lines


def gen_discrete(name, p, ks):
    ref_lines = []
    qv_lines = []
    for k in ks:
        pmfv = pmf(name, p, k)
        cdfv = dcdf(name, p, k)
        qp = cdfv - pmfv / 2  # midpoint of k-th step -> quantile resolves to k
        ref_lines.append(fmt_disc_entry(k, pmfv, cdfv))
        qv_lines.append(fmt_qv_entry(qp, mpf(k)))
    return ref_lines, qv_lines


def p_repr(p):
    import json
    return json.dumps(p)


def run_continuous(filter_name):
    print('// ============ CONTINUOUS DISTRIBUTIONS ============')
    for name, sets in PARAM_SETS.items():
        if filter_name and name != filter_name:
            continue
        for p in sets:
            label = p_repr(p)
            print(f'  // {name}({label})', flush=True, file=sys.stderr)
            print(f'  // {name}({label})')
            try:
                ref_lines, qv_lines = gen_continuous(name, p)
                print_block(ref_lines, qv_lines)
            except Exception as e:
                print(f'    // ERROR: {e}')
            print()


def run_discrete(filter_name):
    print('// ============ DISCRETE DISTRIBUTIONS ============')
    for name, p, ks in DISCRETE_SPEC:
        if filter_name and name != filter_name:
            continue
        label = p_repr(p)
        print(f'  // {name}({label})', flush=True, file=sys.stderr)
        print(f'  // {name}({label})')
        try:
            ref_lines, qv_lines = gen_discrete(name, p, ks)
            print_block(ref_lines, qv_lines)
        except Exception as e:
            print(f'    // ERROR: {e}')
        print()


if __name__ == '__main__':
    args = sys.argv[1:]
    do_cont = True
    do_disc = True
    filter_name = None

    for a in args:
        if a == '--discrete':
            do_cont = False
        elif a == '--continuous':
            do_disc = False
        else:
            filter_name = a

    if do_cont:
        run_continuous(filter_name)
    if do_disc:
        run_discrete(filter_name)
