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
Usage:    python3 scripts/precision-refs-continuous.py                        # rewrites the test file
          python3 scripts/precision-refs-continuous.py --check                # self-check only
          python3 scripts/precision-refs-continuous.py --emit --only Name1,Name2
              # recompute only the named distributions, reusing the previous run's cached
              # points (/tmp/precision-continuous-cache.json) for everything else -- avoids
              # unconditionally re-paying DoublyNoncentralBeta[2,2,1200,1200]'s ~65-minute
              # cost (issue #1149) when regenerating references for an unrelated distribution
          python3 scripts/precision-refs-continuous.py --emit --allow-prune
              # by default, render() (below) preserves any existing group verbatim when the
              # fresh cache doesn't reproduce it (e.g. TruncatedExponential, which has no
              # PARAM_SETS entry at all) instead of silently deleting it -- pass --allow-prune
              # to actually let such a group be dropped when that removal is deliberate
"""
import json
import os
import re
import subprocess
import sys
from collections import Counter
from mpmath import (mp, mpf, pi, sqrt, exp, log, expm1, log1p, cosh, tanh,
                    atan, atan2, asin, asinh, acos, sin, cos, gamma as gammafn, loggamma,
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
    a = mpf(a)
    if x < 0 or x > 1:
        return mpf(0)
    l2 = mpf(lam) / 2
    if x == 0:
        # Only the j=0 term (aj=a) can be nonzero at x=0: every j>=1 term has aj=a+j>1 once
        # a>=0, so x^(aj-1) vanishes. a==1 leaves the finite e^(-lam/2)/B(1,b) = e^(-lam/2)*b;
        # a<1 diverges (all terms nonnegative, j=0 term alone -> inf); a>1 -> 0 (issue #1116).
        if a > 1:
            return mpf(0)
        if a == 1:
            return pois_w(l2, 0) / betafn(1, mpf(b))
        return inf
    if x == 1:
        # Right edge (1-x)^(b-1): a blanket 0 here silently understated the b<=1 boundary (#1121).
        # b<1 diverges (dominated by the j=0 Poisson term regardless of a); b==1 is the finite
        # Poisson mean a+lambda/2 (Beta(a+j,1) pdf at x=1 is a+j); b>1 vanishes.
        b = mpf(b)
        if b < 1:
            return inf
        if b == 1:
            return a + mpf(lam) / 2
        return mpf(0)
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
    #
    # Ireg(a+r, b+si, x) itself is ALSO tracked via an exact recurrence (issue #1194) instead of
    # a fresh betainc() call per (r, si) pair -- the true cost driver at large lambda (e.g.
    # lambda1=lambda2=1200: ~800k-1M betainc() calls per cdf() call, 20-44 minutes, vs.
    # dncbeta_pdf's ~30s, which never calls betainc() at all and was never the bottleneck).
    # Contiguous relations for the regularized incomplete beta function (DLMF 8.17.20-style):
    #   I_x(a, b+1) = I_x(a, b) + x^a (1-x)^b / (b B(a,b))      [b-direction, si loop]
    #   I_x(a+1, b) = I_x(a, b) - x^a (1-x)^b / (a B(a,b))      [a-direction, r loop]
    # verified to 0 relative error against direct betainc() calls at both small scale (a,b in
    # 1-5) and at the actual production scale (a,b in the hundreds, matching lambda=1200) before
    # use here. The JS side's #1102 fix attempted (and abandoned) the same idea for its relocated
    # walk due to an unresolved sign error -- the signs above were independently re-derived and
    # numerically verified, not carried over from that attempt; see
    # solutions/performance/2026-07-30-dncbeta-self-check-incremental-ireg.md for the derivation,
    # the verification method, and why this makes peak relocation unnecessary: eliminating the
    # per-term betainc() cost (not repositioning the walk) is what removes the hang, so the
    # original forward-from-0 walk and its floor/convergence logic are otherwise unchanged.
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
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
    xp_r0 = a * logx + b * log1mx
    I_r0 = Ireg(a, b, x)
    while True:
        inner = mpf(0)
        log_ws = mpf(0) if h2 == 0 else -h2
        logB = logB_r0
        xp = xp_r0
        I_val = I_r0
        si = 0
        while True:
            # Convergence must track the actual accumulated term (Poisson weight * Ireg), not the
            # raw Poisson-weight product alone: for r far from its Poisson mean r0, log_wr is
            # already enormously negative, so wr_ws < 1e-55 trivially regardless of whether the
            # Ireg-weighted term has converged, silently truncating real probability mass whenever
            # the joint (r,s) peak shifts far from the nominal center (#1108). Same relative
            # term-vs-running-sum check as recursiveSum's useFloor=False branch in
            # src/algorithms/recursive-sum.js, the precedent from #1086's JS-side fix.
            term = exp(log_wr + log_ws) * I_val
            inner += term
            if si > h2 + 5 and fabs(term) < fabs(inner) * mpf('1e-55'):
                break
            I_val = I_val + exp(xp - logB) / (b + si)
            logB = logB + log(b + si) - log(a + r + b + si)
            xp = xp + log1mx
            if h2 != 0:
                log_ws = log_ws + log_h2 - log(si + 1)
            si += 1
            if si > 5000:
                break
        s += inner
        if r > h1 + 5 and fabs(inner) < fabs(s) * mpf('1e-55'):
            break
        I_r0 = I_r0 - exp(xp_r0 - logB_r0) / (a + r)
        logB_r0 = logB_r0 + log(a + r) - log(a + r + b)
        xp_r0 = xp_r0 + logx
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


# ---- Tweedie helpers (compound Poisson-Gamma EDM, 1 < p < 2; Dunn & Smyth 2005) ----

def tweedie_lambda(mu, phi, p):
    return power(mu, 2 - p) / (phi * (2 - p))


def tweedie_gamma_shape(p):
    return (2 - p) / (p - 1)


def tweedie_gamma_rate(mu, phi, p):
    return 1 / (phi * (p - 1) * power(mu, p - 1))


def tweedie_log_wj(y, phi, p, alpha, j):
    j = mpf(j)
    return ((-j * alpha) * log(y) + (alpha * j) * log(p - 1) - (j * (1 - alpha)) * log(phi)
            - j * log(2 - p) - loggamma(j + 1) - loggamma(-j * alpha))


def tweedie_pdf(mu, phi, p, y):
    mu, phi, p, y = mpf(mu), mpf(phi), mpf(p), mpf(y)
    lam = tweedie_lambda(mu, phi, p)
    if y < 0:
        return mpf(0)
    if y == 0:
        return exp(-lam)
    alpha = (2 - p) / (1 - p)
    theta = power(mu, 1 - p) / (1 - p)
    kappa = power(mu, 2 - p) / (2 - p)
    jpeak = power(y, 2 - p) / ((2 - p) * phi)
    s = mpf(0)
    j = 1
    while True:
        term = exp(tweedie_log_wj(y, phi, p, alpha, j))
        s += term
        if j > jpeak + 10 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return (s / y) * exp((y * theta - kappa) / phi)


def tweedie_cdf(mu, phi, p, y):
    mu, phi, p, y = mpf(mu), mpf(phi), mpf(p), mpf(y)
    lam = tweedie_lambda(mu, phi, p)
    if y < 0:
        return mpf(0)
    if y == 0:
        return exp(-lam)
    shape = tweedie_gamma_shape(p)
    rate = tweedie_gamma_rate(mu, phi, p)
    # j=0 term: Gamma(shape=0) is a point mass at 0, so its CDF is exactly 1 for any y>0 --
    # NOT what Preg(0, x) would give (shape-0 regularized incomplete gamma is not the point-mass
    # CDF), so it is added directly as the Poisson(N=0) weight rather than routed through Preg.
    s = pois_w(lam, 0)
    j = 1
    while True:
        term = pois_w(lam, j) * Preg(j * shape, rate * y)
        s += term
        if j > lam + 10 and term < s * mpf('1e-55'):
            break
        j += 1
        if j > 200000:
            break
    return s


def chi2_pdf(df, v):
    v = mpf(v)
    df = mpf(df)
    if v < 0:
        return mpf(0)
    if v == 0:
        # v=0 is a genuine density pole for df<2 (e.g. df=1 -> +inf), not a finite value: the
        # finite sqrt(2/pi) some callers expect belongs to Chi's pdf (via the 2*x*chi2_pdf(k,x^2)
        # limit as x->0), not to chi2_pdf in isolation -- see the 'Chi' dispatch branch below.
        return mpf(0) if df > 2 else (HALF if df == 2 else inf)
    return exp((df / 2 - 1) * log(v) - v / 2 - (df / 2) * log(2) - loggamma(df / 2))


def nct_cdf(nu, mu, t):
    nu = mpf(nu)
    mu = mpf(mu)
    t = mpf(t)
    # F(t) = integral_0^inf Phi(t*sqrt(v/nu) - mu) * chi2_pdf(nu, v) dv.
    # 35 working digits keep the quadrature ~1e-30 accurate (far below float64) while
    # roughly halving the adaptive-subdivision cost that dominates the (doubly-)noncentral-t runs.
    # Relies on nu >= 2 so chi2_pdf(nu, v) stays finite as v->0 (chi2_pdf returns +inf for
    # df<2, which quad()'s tanh-sinh rule never literally samples at the v=0 endpoint anyway,
    # but a future nu<2 param set or a quadrature-rule change would feed +inf into f() directly).
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
        if x == 0:
            # 2*x*chi2_pdf(k,x^2) can't be evaluated literally at x=0 once chi2_pdf(1,0)=inf
            # (fixed above): mpf(0)*inf is nan in mpmath, not the true 0*inf limit. k is always
            # a positive integer here (Chi's invalidParams reject k<=0), so k<1 (-> inf) is
            # unreachable and intentionally omitted.
            # See solutions/testing/2026-07-24-1456-chi-noncentralbeta-pdf0-zero-times-inf-boundary.md
            return mpf(0) if k > 1 else sqrt(2 / pi)
        return 2 * x * pdf('Chi2', [k], x * x)
    if name == 'Chi2':
        k = int(round(p[0]))
        # Unlike 'Chi' above, no x==0 special case is needed here: chi2_pdf(k,0) returning
        # +inf for k<2 *is* the correct chi-squared density at its pole, not a 0*inf artifact
        # to unwrap. Currently unreached in practice because xvalues()/invcdf() never probe the
        # literal left support edge (see invcdf()'s "never evaluate cdf at the lower boundary"
        # comment) -- a manual x-value override at x=0 would exercise this branch directly.
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
    if name == 'ExponentiallyModifiedGaussian':
        mu, sigma, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        # textbook form (mpmath's arbitrary exponent range avoids the overflow/underflow
        # that motivates ranjs's erfcx-based rewrite in the production implementation)
        return (lam / 2) * exp(lam / 2 * (2 * mu + lam * sigma * sigma - 2 * x)) * \
            erfc((mu + lam * sigma * sigma - x) / (SQRT2 * sigma))
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
        if x == 0:
            # k=1: only the j=0 Poisson term of ncx2_pdf diverges as v^(-1/2) near
            # v=0, so 2*x*ncx2_pdf(1, lam^2, x^2) has a finite 0*inf limit as x->0.
            return 2 * exp(-lam * lam / 2) / SQRT2PI if k == 1 else mpf(0)
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
    if name == 'Tweedie':
        # Local var named 'disp' (not 'phi') -- Python's lexical scoping would otherwise
        # shadow the module-level phi() Gaussian-density helper for this entire dispatcher
        # function, breaking every other branch that calls phi() (BirnbaumSaunders, JohnsonSU,
        # JohnsonSB) with UnboundLocalError.
        mu, disp, pw = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return tweedie_pdf(mu, disp, pw, x)
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
        mu, kappa = mpf(p[0]), mpf(p[1])
        return exp(kappa * cos(x - mu)) / (2 * pi * besseli(0, kappa))
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        t = x / lam
        return k / lam * power(t, k - 1) * exp(-power(t, k))
    if name == 'Wigner':
        R = mpf(p[0])
        r = R * R
        return 2 * sqrt(r - x * x) / (pi * r)
    if name == 'WrappedCauchy':
        mu, rho = mpf(p[0]), mpf(p[1])
        return (1 - rho * rho) / (2 * pi * (1 + rho * rho - 2 * rho * cos(x - mu)))
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
    if name == 'ExponentiallyModifiedGaussian':
        mu, sigma, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return Phi((x - mu) / sigma) - HALF * \
            exp(lam / 2 * (2 * mu + lam * sigma * sigma - 2 * x)) * \
            erfc((mu + lam * sigma * sigma - x) / (SQRT2 * sigma))
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
    if name == 'Tweedie':
        # See the matching comment in pdf() -- 'disp' avoids shadowing the module-level
        # phi() helper (this cdf() dispatcher calls it directly in the Slash branch).
        mu, disp, pw = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return tweedie_cdf(mu, disp, pw, x)
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
        mu = mpf(p[0])
        return quad(lambda t: pdf('VonMises', p, t), [mu - pi, x])
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        return -expm1(-power(x / lam, k))
    if name == 'Wigner':
        R = mpf(p[0])
        r = R * R
        return HALF + x * sqrt(r - x * x) / (pi * r) + asin(x / R) / pi
    if name == 'WrappedCauchy':
        mu, rho = mpf(p[0]), mpf(p[1])
        d = atan2(sin(x - mu), cos(x - mu))
        return HALF + atan2((1 + rho) * sin(d / 2), (1 - rho) * cos(d / 2)) / pi
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
    # A MISMATCH here does not by itself mean this script's mpmath formula is wrong: it means
    # this script's "got" and dist-cases-continuous.js's frozen "want" disagree, and either side
    # could be the stale one. Normal[0,2].cdf(-14) mismatched (issue #1193) because dist-cases-
    # continuous.js's far-tail refVals predated the cancellation-safe fix already applied to
    # test/precision-continuous.js (issue #808) and were never back-ported; this script's plain
    # erf-based formula was already correct (mpmath computes erf to full mp.dps precision
    # regardless of how close the result sits to +-1, so there is no cancellation loss at
    # mp.dps=50 the way there would be at float64) -- independently reconfirmed against an
    # erfc-based reformulation and mpmath's built-in ncdf, both agreeing to ~44 digits. Each
    # mismatch should be independently re-derived before deciding which side to correct.
    #
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
#
# NoncentralChi/NoncentralChi2/Rice get extra sets approaching marcumQ's x<30
# series/asymptotic dispatch threshold (src/special/marcum-q.js) -- every prior set for
# these three left the dispatched x well under 30 (0.03-2), so this crossover had zero
# precision-gate coverage (issue #1143). NoncentralChi2 gets both a below-30 and an
# above-30 set (both pass); NoncentralChi/Rice get only the below-30 set -- their
# above-30 sets ([5, 8] / [8, 1]) hit a genuine _zetaxy() cancellation bug in the
# quadrature branch (2*eps/d2 vs eps^2/(d1*d2) near-cancel once d2 underflows for
# y << 1), filed separately rather than papered over here.
#
# NoncentralChi/NoncentralChi2 also get sets straddling besselISpherical(order>=1,x)'s
# Taylor/closed-form dispatch at |x|=1 (src/special/bessel.js:171-192, order=floor((k-3)/2)
# is >=1 at the lowest odd k>=5) -- this threshold had zero precision-gate coverage before
# this (issue #1143).
#
# besselI(0,x)'s OWN Taylor/backward-recurrence dispatch at |x|=10 (bessel.js:122-127) was
# also attempted for Rice/NoncentralChi/NoncentralChi2/Skellam/VonMises, straddling the
# threshold via nu*x/sigma^2 (Rice), lambda*x (NoncentralChi), sqrt(lambda*x)
# (NoncentralChi2), twoSqrtProd (Skellam, see precision-refs-discrete.py) and kappa itself
# (VonMises). Every probe landing in roughly (10, 14] surfaced a genuine ~1e-9-1e-10
# relative-error warm-up gap in _besselIBackward's Miller recurrence, caused by the n=0
# margin term degenerating to 0 (sqrt(40*0)=0) -- filed separately as issue #1185 rather
# than masked with a tolerance far looser than this file's usual cap. Fixed by #1185
# (_besselIBackward now uses sqrt(40*max(n,1))); the Rice[3.16,1]/NoncentralChi[2,3.5]/
# NoncentralChi2[2,8] sets above are the ones that surfaced it and are now included.
# VonMises at kappa>=9 additionally surfaced an unrelated, more severe bug: _cdf's
# Fourier series (recursiveSum over besselI(i,kappa)*sin(i*x)) returns out-of-[0,1] values
# (e.g. VonMises(9).cdf(-pi/4) = -0.0074) for sufficiently concentrated kappa, which corrupts
# the general quantile root-finder for arbitrary p -- filed and fixed separately (see
# solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md).
# Both fixes have since landed, so the VonMises[11] set below (in PARAM_SETS/VONMISES_XVALS)
# is now included -- its three k*pi/4 x-values directly regression-test the oscillating-term
# envelope fix, and kappa=11 keeps it inside the besselI(0,x) dispatch band #1185 fixed.
#
# Gamma/Chi2/InverseGamma/GeneralizedGamma get sets straddling gammaLowerIncompleteInv's
# a>=1 initial-guess dispatch (Wilson-Hilferty rational approximation vs. leading-term-series
# inversion, src/special/gamma-incomplete.js:123,144-156) -- this crossover had zero
# boundary-adjacent precision-gate coverage before this (issue #1188, continuation of #1143).
# These four cover distinct call patterns onto the same primitive: Gamma calls it directly
# (this.p.alpha, p); Chi2 derives a half-integer shape (round(k)/2) and post-scales the
# result by 2; InverseGamma complements the probability (1-p) and reciprocates the result;
# GeneralizedGamma derives a composite shape (d/p) and post-transforms by a power law
# (1/p). Erlang/Chi share Gamma's/Chi2's own call shape (Chi is literally Chi2's this.c.alpha
# reused under a sqrt), and LogGamma/GeneralizedNormal/HalfGeneralizedNormal/DoubleGamma only
# add a further monotonic wrapper (exp/abs-sign/power) around the same GeneralizedGamma-family
# dispatch already covered here, so a representative subset was judged sufficient rather than
# giving every family member (see #1188's own out-of-scope note) its own boundary set.
# MaxwellBoltzmann is excluded outright: its shape is pinned to alpha=1.5 regardless of the
# sigma parameter (src/dist/maxwell-boltzmann.js), so no parameterization can move it across
# a=1.
# Gamma[0.9,1]/[1.1,1] and InverseGamma[0.9,2]/[1.1,2] straddle the boundary directly (0.9
# dispatches the series-inversion branch, 1.1 the Wilson-Hilferty branch). Chi2 already had
# an a>=1 set (k=2 -> alpha=1.0, exactly the boundary) but nothing below it, so only the
# below-boundary partner (k=1 -> alpha=0.5) is added. GeneralizedGamma already had two sets
# landing exactly on alpha=d/p=1 ([2,2,2] and [0.5,0.5,0.5]) but nothing below it either, so
# its below-boundary partner (alpha=0.9, via d=1.8/p=2) is added -- p=2 keeps the power-law
# post-transform (1/p) non-trivial, unlike p=1 which would degenerate the call into a plain
# Gamma(alpha, beta) and add no coverage beyond the Gamma[0.9,1] set above.
#
# Lindley/Muth/GeneralizedExponential/Makeham/BenktanderII/Logarithmic get sets straddling
# lambertW0/lambertW1m's initial-guess dispatch (src/special/lambert-w.js:35,62 --
# lambertW1m switches Laurent-vs-branch-point series at z=-0.1, lambertW0 switches
# w0=0-vs-log(z) at z=1), which had zero precision-gate coverage before this (issue #1187,
# continuing #1143). This crossover only picks the Halley refinement's starting point, not
# its convergence target, so every set below round-trips to full float64 precision on both
# sides of the threshold -- no bug, unlike besselI/marcumQ's real track record at their own
# thresholds. lambertW1m's argument in Lindley[1.5]/Muth[0.35]'s _q() call is
# -(1-p)*expFactor, spanning roughly -0.18 to -0.02 across P_GRID and crossing -0.1 between
# p=0.3 and p=0.53. Makeham[1,2,3]/BenktanderII[0.1,0.6]'s lambertW0 argument spans roughly
# 0.5-2.2 / 0.4-10, crossing 1 between p=0.53 and p=0.72. Logarithmic[1,6.25]'s raw argument
# (passed to lambertW0 as z/e) spans roughly -0.4 to 4.6, crossing e=2.71828... between
# p=0.53 and p=0.72. GeneralizedExponential has NO set here: its lambertW0 argument
# -b*exp((c*ln(1-p)-b)/(a+b))/(a+b) factors as z0*(1-p)^(c/(a+b)) with z0 = -b/(a+b) *
# exp(-b/(a+b)) confined to the open interval (-1/e, 0) for every a,b>0 -- it can never reach the z>=1
# threshold for any valid parameters, so this crossover is provably unreachable via this
# distribution's _q(p) and is omitted rather than faked with an unreachable-in-practice set.
#
# NoncentralChi2 gets two sets straddling marcumQ's transition-band mu=135 dispatch
# (src/special/marcum-q.js, _transitionBand: three-term backward recurrence below 135, section 4.2
# large-mu uniform asymptotic expansion at/above it) -- issue #1190, continuation of #1143. This is
# a DIFFERENT threshold from the x<30 series/asymptotic dispatch #1143's first PR covered, and it
# had zero boundary-adjacent coverage. mu=k/2 for this distribution, so [268, 64] gives mu=134 and
# [270, 64] gives mu=135 -- the tightest even-k straddle available. x-values are pinned in
# NONCENTRAL_CHI2_XVALS (see the reasoning there and in MANUAL_XVALS, added by #1178).
#
# Of the four marcumQ-family distributions, only three can reach this threshold at all: Rice's _cdf
# is marcumP(1, ...), so its mu is structurally pinned at 1 for every (nu, sigma) and no set can be
# constructed. NoncentralChi reaches it via marcumP(k/2, lambda^2/2, x^2/2) -- the identical
# internal regime as NoncentralChi2, differing only in squaring the distribution-level arguments --
# so it is omitted as redundant rather than given two more groups for no new branch coverage.
# Skellam covers the same threshold from the other side, through marcumQ (upper tail) rather than
# marcumP, and is the only family member whose marcum order is the evaluation point rather than a
# parameter, so one param set straddles inside its own k grid -- see scripts/precision-refs-discrete.py.
#
# A large-x set was originally withheld here. Probing the recurrence branch across the band
# showed it silently lost up to eight significant digits once the marcum x grew past a few
# hundred (worst measured 6.9e-05 relative at x=2000), because _fc's modified-Lentz continued
# fraction needed ~192 iterations at those arguments but was capped at MAX_ITER=100 and returned
# the unconverged value with no signal. That produced a six-orders-of-magnitude accuracy
# discontinuity across mu=135 at x=1000 (2.55e-09 at mu=134 vs 2.02e-15 at mu=135, since _largeMu
# does not call _fc). Filed as issue #1286 rather than papered over with a loosened tolerance
# here, following the same precedent as #1179 (_zetaxy) and #1185 (_besselIBackward).
#
# [76, 692] is the withheld set, added now that #1286 landed a regime-aware iteration budget for
# _fc, following the same precedent as #1185's own withheld sets. mu=38 (not the reproduction
# issue's mu=100) is deliberate: NoncentralChi2._pdf independently overflows to Infinity once
# besselI's argument sqrt(lambda*x) crosses ~715-720 (a separate, already-filed defect out of
# #1286's scope), and at mu=100 every marcum-x large enough to exercise _fc's old bug also pushes
# sqrt(lambda*x) past that overflow floor -- there is no window satisfying both simultaneously at
# that mu. mu=38 is the smallest order for which marcumQ's own dispatch (mu^2 >= 2*xi) still
# routes through _transitionBand's recurrence rather than the large-xi asymptotic expansion at
# xi close to the overflow ceiling, which maximizes how large a _fc depth this set can exercise
# (125-131 iterations, vs. the old 100 cap) while keeping pdf finite at every probed x. See
# NONCENTRAL_CHI2_XVALS for the exact x-values and their derivation.
PARAM_SETS = {
    'Alpha': [[2, 2], [0.5, 0.5], [3, 1]],
    'Anglit': [[0, 2], [3, 0.5], [-1, 4]],
    'Arcsine': [[5, 25], [0, 1], [-2, 2]],
    'AsymmetricLaplace': [[0, 1, 1], [1, 1, 2], [2, 0.5, 0.5]],
    'BaldingNichols': [[0.5, 0.5], [0.1, 0.1], [0.3, 0.7]],
    'Bates': [[10, 5, 25], [3, 0, 1], [5, -2, 2]],
    'Benini': [[2, 2, 2], [0.5, 0.5, 1], [1, 3, 2]],
    # [0.1, 0.6]: lambertW0 argument in _q() spans ~0.38-10.15, straddling the z=1
    # initial-guess dispatch (issue #1187).
    'BenktanderII': [[2, 0.9995], [2, 1], [2, 0.5], [0.1, 0.6]],
    # [4, 3]: x straddles regularizedBetaIncomplete's direct/complementary continued-fraction
    # dispatch at x=(a+1)/(a+b+2)=5/9 (src/special/beta-incomplete.js) -- unprobed before
    # this (issue #1178).
    'Beta': [[2, 2], [0.5, 0.5], [3, 5], [4, 3]],
    'BetaPrime': [[2, 2], [0.5, 4], [3, 3]],
    'BetaRectangular': [[2, 2, 0.5, 5, 25], [0.5, 0.5, 0.9, 5, 25], [3, 2, 0.3, 0, 10]],
    'BirnbaumSaunders': [[0, 2, 2], [0, 0.5, 0.5], [1, 1, 1]],
    'BoundedPareto': [[5, 25, 2], [1, 10, 0.5], [2, 8, 3]],
    'Bradford': [[2], [0.5], [5]],
    'Burr': [[2, 2], [0.5, 4], [3, 1]],
    'Cauchy': [[0, 2], [3, 0.5], [-1, 1]],
    'Champernowne': [[2, 0.5, 1], [1, 0, 0], [3, 0.8, -1]],
    'Chi': [[1], [5], [3]],
    'Chi2': [[5], [2], [9], [1]],
    'Dagum': [[2, 2, 2], [0.5, 0.5, 2], [1, 3, 1]],
    'Davis': [[1, 1, 2], [1, 2, 3], [2, 1, 4]],
    'DoubleGamma': [[2, 2], [0.5, 2], [3, 1]],
    'DoubleWeibull': [[2, 2], [2, 0.5], [1, 3]],
    'DoublyNoncentralBeta': [[2, 2, 2, 2], [2, 2, 1, 3], [3, 4, 2, 2], [2, 2, 1200, 1200]],
    'DoublyNoncentralChi2': [[3, 4, 2, 3], [2, 4, 1, 2], [2, 3, 1, 1]],
    'DoublyNoncentralF': [[5, 5, 2, 2], [5, 5, 1, 2], [4, 6, 2, 1]],
    'DoublyNoncentralT': [[5, 1, 2], [5, 0, 2], [6, 2, 1], [5, 0, 120], [5, 5, 120], [5, 2, 120]],
    'Erlang': [[5, 2], [2, 0.5], [3, 1]],
    'Exponential': [[2], [0.5], [1]],
    'ExponentialLogarithmic': [[0.5, 2], [0.9, 0.5], [0.3, 1]],
    'ExponentiallyModifiedGaussian': [[0, 1, 1], [1, 0.3, 5], [-1, 2, 0.2]],
    'ExponentiatedWeibull': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 2, 3]],
    # [6, 8]: x straddles regularizedBetaIncomplete's direct/complementary continued-fraction
    # dispatch, here at internal beta-argument z=d1*x/(d1*x+d2)=(a+1)/(a+b+2)=4/9 -- unprobed
    # before this (issue #1178).
    'F': [[5, 5], [2, 20], [10, 4], [6, 8]],
    'FisherZ': [[5, 5], [1, 1], [8, 4]],
    'Frechet': [[2, 2, 0], [0.5, 1, 0], [3, 2, 1]],
    'Gamma': [[2, 2], [0.5, 0.5], [3, 1], [0.9, 1], [1.1, 1]],
    'GammaGompertz': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 3, 2]],
    'GeneralizedExponential': [[2, 2, 2], [2, 0.5, 4], [1, 3, 2]],
    'GeneralizedExtremeValue': [[2], [-2], [0.5]],
    'GeneralizedGamma': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 3, 2], [1, 1.8, 2]],
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
    'InverseGamma': [[2, 2], [0.5, 0.5], [3, 1], [0.9, 2], [1.1, 2]],
    # [2, 3]: x straddles _cdf's erfc(-a) series/continued-fraction dispatch at -a=1
    # (src/special/error.js's erfc: x<=1 series, x>1 CF) -- unprobed before this (issue #1178).
    'InverseGaussian': [[2, 2], [1, 0.5], [3, 1], [2, 3]],
    'InvertedWeibull': [[2], [0.5], [3]],
    'IrwinHall': [[10], [3], [5]],
    'JohnsonSU': [[0, 2, 2, 0], [1, 0.5, 0.5, 1], [-1, 1.5, 2, 0]],
    'JohnsonSB': [[0, 2, 2, 0], [1, 0.5, 0.5, 1], [-0.5, 1.5, 3, 0]],
    'Kolmogorov': [[]],
    'Kumaraswamy': [[2, 2], [0.5, 0.5], [3, 1]],
    'Laplace': [[0, 2], [3, 0.5], [-1, 1]],
    # [2, 3]: x straddles _cdf's erfc series/continued-fraction dispatch at z=1
    # (src/special/error.js) -- Normal/LogNormal's far-tail crossover coverage (issue #808)
    # never probed this close to z=1 for Levy; unprobed before this (issue #1178).
    'Levy': [[0, 2], [1, 0.5], [-1, 1], [2, 3]],
    # [1.5]: lambertW1m argument in _q() spans ~-0.18 to -0.02, straddling the z=-0.1
    # initial-guess dispatch (issue #1187).
    'Lindley': [[2], [0.5], [1], [1.5]],
    'LogCauchy': [[0, 2], [1, 0.5], [-1, 1]],
    'LogGamma': [[2, 2, 2], [0.5, 0.5, 1], [3, 1, 0]],
    'LogLaplace': [[0, 2], [1, 0.5], [-1, 1]],
    'LogLogistic': [[2, 2], [0.5, 0.5], [3, 1]],
    'LogNormal': [[0, 2], [1, 0.5], [-1, 1]],
    # [1, 6.25]: raw argument passed to lambertW0 as z/e in _q() spans ~-0.4 to 4.6,
    # straddling the z/e=1 (raw z=e) initial-guess dispatch (issue #1187).
    'Logarithmic': [[6, 30], [2, 10], [1, 5], [1, 6.25]],
    'Logistic': [[0, 2], [3, 0.5], [-1, 1]],
    'LogisticExponential': [[2, 2], [0.5, 0.5], [1, 3]],
    'LogitNormal': [[0, 2], [1, 0.5], [-1, 1]],
    'Lomax': [[2, 2], [0.5, 0.5], [3, 1]],
    # [1, 2, 3]: lambertW0 argument in _q() spans ~0.5-2.2, straddling the z=1
    # initial-guess dispatch (issue #1187).
    'Makeham': [[2, 2, 2], [0.5, 0.5, 0.5], [1, 1, 3], [1, 2, 3]],
    'MaxwellBoltzmann': [[2], [0.5], [1]],
    'Mielke': [[2, 2], [0.5, 4], [3, 1]],
    'Moyal': [[0, 2], [3, 0.5], [-1, 1]],
    # [0.35]: lambertW1m argument in _q() spans ~-0.15 to -0.02, straddling the z=-0.1
    # initial-guess dispatch (issue #1187).
    'Muth': [[0.5], [0.1], [1], [0.35]],
    'Nakagami': [[2.5, 2], [0.5, 0.5], [1, 3]],
    # [2, 3, 4]: x straddles _cdf's regularizedBetaIncomplete(iAlpha0, beta, x) direct/
    # complementary continued-fraction dispatch at x=(iAlpha0+1)/(iAlpha0+beta+2)=5/9, where
    # iAlpha0=alpha+round(lambda/2)=4 -- unprobed before this (issue #1178).
    'NoncentralBeta': [[2, 2, 2], [0.5, 5, 10], [0.1, 2, 10], [2, 3, 4]],
    # [5, 0.5]: besselISpherical(1, lambda*x) argument spans ~0.65-1.56, straddling the
    # |x|=1 Taylor/closed-form dispatch (order = floor((k-3)/2) = 1 at the lowest odd k>=5).
    # [2, 3.5]: besselI(0, lambda*x) argument spans into (10, 14], straddling
    # _besselIBackward's n=0 warm-up margin gap (issue #1185; previously withheld here
    # during #1143's boundary-grid work, see the comment above PARAM_SETS).
    'NoncentralChi': [[5, 2], [2, 0.5], [3, 1], [5, 7.5], [5, 0.5], [2, 3.5]],
    # [5, 0.5]: besselISpherical(1, sqrt(lambda*x)) argument spans ~0.94-2.25, straddling
    # the |x|=1 Taylor/closed-form dispatch (order = floor((k-3)/2) = 1 at the lowest odd k>=5).
    # [2, 8]: besselI(0, sqrt(lambda*x)) argument spans into (10, 14], straddling
    # _besselIBackward's n=0 warm-up margin gap (issue #1185; previously withheld here
    # during #1143's boundary-grid work, see the comment above PARAM_SETS).
    # [268, 64] / [270, 64]: straddle marcumQ's transition-band mu=135 dispatch -- k=268 gives
    # mu=k/2=134 (three-term recurrence), k=270 gives mu=135 (section 4.2 large-mu asymptotic
    # expansion). See the mu=135 paragraph in the comment above PARAM_SETS (issue #1190).
    # [76, 692]: the large-x recurrence set withheld by #1190/#1143 until #1286 fixed _fc's
    # under-convergence. See the "large-x recurrence regime" paragraph above PARAM_SETS.
    'NoncentralChi2': [[11, 2], [5, 3], [2, 1], [5, 58], [5, 62], [5, 0.5], [2, 8],
                       [268, 64], [270, 64], [76, 692]],
    # [6, 8, 4]: x straddles the underlying NoncentralBeta._cdf's regularizedBetaIncomplete
    # direct/complementary dispatch, here at internal beta-argument
    # z=d1*x/(d1*x+d2)=(iAlpha0+1)/(iAlpha0+beta+2)=6/11, where iAlpha0=alpha+round(lambda/2)=5
    # -- unprobed before this (issue #1178).
    'NoncentralF': [[5, 5, 2], [2, 10, 0.5], [4, 6, 3], [6, 8, 4]],
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
    # [3.16, 1]: besselI(0, nu*x/sigma^2) argument spans into (10, 14], straddling
    # _besselIBackward's n=0 warm-up margin gap (issue #1185; previously withheld here
    # during #1143's boundary-grid work, see the comment above PARAM_SETS).
    'Rice': [[2, 2], [0.5, 2], [1, 1], [7, 1], [3.16, 1]],
    'ShiftedLogLogistic': [[0, 2, 2], [0, 2, -2], [0, 2, 0]],
    # [0, 1, 1] and [0, 1, 2] straddle owenT's own |a|=1 and |h|=0.67 dispatch boundaries
    # (src/special/owen-t.js:303-311) -- every prior SkewNormal set here has |alpha| in {2, 3},
    # so owenT always took its aAbs>1 branches and the |a|<=1 branch had zero precision-gate
    # coverage (issue #1186). alpha=1 forces the exact aAbs<=1 edge; alpha=2 with x values
    # 0.66/0.67/0.68 straddles the |h|<=0.67 edge from both sides. Both matched mpmath to
    # ~1e-16 relative error (no bug surfaced), so no PDFCDF_TOL/Q_TOL/NOTES override is needed.
    'SkewNormal': [[0, 2, 2], [0, 2, -2], [1, 1, 3], [0, 1, 1], [0, 1, 2]],
    'Slash': [[]],
    'StudentT': [[2], [0.5], [5]],
    'StudentZ': [[3], [2], [5]],
    'Trapezoidal': [[-3, -1, 1, 3], [0, 0.3, 0.7, 1], [1, 2, 4, 6]],
    'Triangular': [[5, 25, 15], [0, 1, 0.1], [-2, 2, 0]],
    'TruncatedNormal': [[2.5, 2, 0, 5], [0, 1, -2, 2], [1, 2, -1, 4]],
    'TukeyLambda': [[0], [2], [-2]],
    'Tweedie': [[5, 1, 1.5], [3, 0.5, 1.2], [10, 2, 1.8], [5, 0.5, 1.02], [5, 0.5, 1.98]],
    'UQuadratic': [[5, 25], [0, 1], [-2, 2]],
    'Uniform': [[5, 25], [0, 1], [-2, 2]],
    'UniformProduct': [[6], [2], [4]],
    'UniformRatio': [[]],
    'VonMises': [[0, 2], [0, 0.5], [0, 1], [0, 11], [1.5, 2]],
    'Weibull': [[2, 2], [0.5, 0.5], [1, 3]],
    'Wigner': [[2], [0.5], [1]],
    'WrappedCauchy': [[0, 0.3], [1.0, 0.7], [-2.0, 0.05]],
}

# DoublyNoncentralT CDF is a Poisson mixture of noncentral-t quadratures: too slow to invert
# by bisection, so we probe at fixed interior t-values instead.
# (5, 0, 120) (issue #1189, continuation of #1143): straddles f11's |z|=50 dispatch threshold
# (src/special/hypergeometric.js), exercised through DoublyNoncentralT._pdf's internal argument
# z = theta/(2*(1+x^2/nu)). mu=0 deliberately keeps _pdf on its "mu=0" fast path (a single
# f11(kj0, nu/2, z) call with the small fixed kj0=(nu+1)/2=3, matching the near-x=0 special case)
# rather than the general mu != 0 path's forward/backward series over growing kj -- an earlier
# mu=5 attempt at the same theta pushed kj into the 10-30 range and surfaced a genuine ~13%
# _pdf error there (see solutions/correctness/2026-07-28-1024-doubly-noncentral-t-cdf-recursivesum-absolute-floor-truncation.md's
# "Fix" section), which is a separate, unrelated bug filed independently rather than papered over
# here. x=1 lands exactly on z=50; x in {0.5, 0.8} give z > 50 (asymptotic-series minimum-term
# branch), x in {1.1, 1.2} give z < 50 (Taylor-series branch). Kept close to x=1 (rather than
# ranging further, e.g. x=1.8) because pdf(x) -- the quantile round-trip's local sensitivity
# 1/pdf(x) -- collapses fast away from the peak at this theta; x=1.8's pdf ~2e-11 amplifies the
# ~1e-13-relative mpmath-vs-ranjs cdf gap into a ~1e-5 quantile round-trip error, swamping any
# meaningful qtol. This range keeps that amplification within a documentable qtol below.
#
# WARNING (issue #1200): every param tuple added to DoublyNoncentralT's PARAM_SETS entry must
# have a matching entry below -- xvalues()'s MANUAL_XVALS guard (see #1178) silently falls
# through to the slow standard P_GRID/invcdf() bisection path instead of raising if a tuple is
# missing here. The same hazard is far more expensive for DoublyNoncentralBeta, whose
# dncbeta_cdf alone can take up to ~44 minutes per call at large lambda, with one param set's
# calls totaling ~65 minutes (see DNCBETA_XVALS and issue #1149) -- keep every fully-manual dict
# in this file complete for its PARAM_SETS entry.
DNCT_XVALS = {
    (5, 1, 2): [mpf('-2'), mpf('-0.5'), mpf('1'), mpf('2.5'), mpf('4')],
    (5, 0, 2): [mpf('-3'), mpf('-1.2'), mpf('0.7'), mpf('2'), mpf('3.5')],
    (6, 2, 1): [mpf('-1'), mpf('0.5'), mpf('2'), mpf('3.5'), mpf('5')],
    (5, 0, 120): [mpf('0.5'), mpf('0.8'), mpf('1'), mpf('1.1'), mpf('1.2')],
    # (5, 5, 120) (issue #1207): non-zero mu combined with theta=120 drives _pdf's general
    # (mu != 0) branch's peak index j0 into the 17-30+ range, the regime where the ₁F₁ recurrence
    # (formerly _f11Forward/_f11Backward) was numerically unstable in both directions. x in
    # {0.7, 1.0, 1.3, 1.8} are the exact points confirmed wrong in the issue; x=2.2 extends one
    # point further into the tail while still landing well inside the quantile round-trip's
    # sensitivity range (unlike (5, 0, 120) above, this group's mu != 0 so it does not need the
    # same tight peak-adjacent x-range).
    # x=-0.7 (issue #1250's own reported point) is deliberately NOT added here: _cdf's own
    # saturation there (see CDF_TOL comment removed -- _cdf is out of scope for #1250) makes
    # q(cdf(-0.7)) return NaN on both the unfixed and #1250-fixed code (cdf is untouched), so it
    # cannot join this group's shared pdf/cdf/quantile points array. Covered instead by a
    # hand-written pdf-only assertion in test/precision-continuous.js (see #1250).
    (5, 5, 120): [mpf('0.7'), mpf('1.0'), mpf('1.3'), mpf('1.8'), mpf('2.2')],
    # (5, 2, 120) (issue #1235): covers the x*mu<0 branch of _pdf (the wynnEpsilon-based
    # alternating series, replaced by a cancellation-free Poisson-mixture sum -- see
    # solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md).
    # mu=2 (not the issue's own mu=5) is deliberate: at mu=5 (same theta=120), the fix's own
    # NoncentralT.fnm(nu0, mu, z) building block saturates to exactly 1.0 near the Poisson(60)
    # peak (nu0 ~ 105-145), because the true tail probability being represented is far below
    # Number.EPSILON there -- a separate, deeper double-precision floor inside NoncentralT.fnm,
    # not fixable from DoublyNoncentralT._pdf. mu=2 keeps that saturation from reaching the
    # Poisson weight's significant region, letting these 5 points demonstrate the actual fix
    # (wynnEpsilon cancellation, previously up to ~130x relative pdf error at x=-1.0) to near
    # full float64 precision instead.
    (5, 2, 120): [mpf('-0.1'), mpf('-0.2'), mpf('-0.3'), mpf('-0.5'), mpf('-0.7')],
}

# WARNING (issue #1200): every param tuple added to DoublyNoncentralBeta's PARAM_SETS entry
# must have a matching entry in DNCBETA_XVALS below, and likewise for DoublyNoncentralF /
# DNCF_XVALS -- xvalues()'s "name in MANUAL_XVALS and tuple(p) in MANUAL_XVALS[name]" guard
# (added in #1178 to let a few distributions mix P_GRID-driven and manually-pinned param sets)
# silently falls through to the slow standard P_GRID/invcdf() bisection path if a tuple is
# missing here, no error is raised. This is not hypothetical: dncbeta_cdf alone can take up to
# ~44 minutes per call at large lambda, with the full set of calls for one param set totaling
# ~65 minutes (see the (2, 2, 1200, 1200) case below and issue #1149) -- a PARAM_SETS entry
# added without a matching DNCBETA_XVALS entry would silently trigger that ~65-minute --emit
# run instead of failing fast.
#
# Doubly-noncentral Beta/F CDFs are double Poisson sums: too slow to invert by bisection,
# so we probe at fixed interior values (strictly inside the support, 0 < cdf < 1).
# (2, 2, 1200, 1200) (issue #1086) additionally avoids x close to 0/1: at this lambda scale the
# summand's peak shifts by hundreds of Poisson-index steps as x moves away from 0.5 (e.g. ~360
# steps at x=0.1), which the fixed 500-step series cap in doubly-noncentral-beta.js's _seriesSum
# does not fully reach that far out — x in [0.3, 0.5] stays within the range that cap does reach,
# matching this file's own convention of probing "near and away from 0.5", not the extreme tail.
# Only 2 points (not the usual 5): dncbeta_cdf's double Poisson loop is tens of minutes per
# call at this lambda scale, dominated by its per-(r, si) mpmath incomplete-regularized-beta
# evaluation (Ireg), so test/precision-continuous.js's entry for this case was generated by a
# faster standalone script using the same formula (mathematically identical, verified against
# this file's dncbeta_pdf/dncbeta_cdf at the existing small-lambda cases) rather than this
# pipeline directly.
# Confirmed non-pathological, not an infinite loop (issue #1149): an instrumented run of
# dncbeta_cdf(2, 2, 1200, 1200, x) terminates well inside the 5000x5000 (r, si) cap in both
# cases -- x=0.3: r_final=764, ~827k Ireg() calls, ~1235s (~20.6 min); x=0.5: r_final=961,
# ~992k Ireg() calls, ~2659s (~44.3 min). dncbeta_pdf has no Ireg call in its inner loop and is
# far cheaper: ~41s per call at the same params. Both results matched the values already frozen
# in LARGE_LAMBDA_ANCHORS bit-for-bit. Every --emit run paid this ~65-minute cost
# unconditionally regardless of which distribution was actually being regenerated, since
# compute_cache() had no way to skip unrelated distributions -- see --only above.
DNCBETA_XVALS = {
    (2, 2, 2, 2): [mpf('0.25'), mpf('0.4'), mpf('0.55'), mpf('0.7'), mpf('0.85')],
    (2, 2, 1, 3): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
    (3, 4, 2, 2): [mpf('0.2'), mpf('0.35'), mpf('0.5'), mpf('0.65'), mpf('0.8')],
    (2, 2, 1200, 1200): [mpf('0.3'), mpf('0.5')],
}
# WARNING (issue #1200): same fallthrough hazard as DNCBETA_XVALS above applies here -- every
# param tuple added to DoublyNoncentralF's PARAM_SETS entry needs a matching entry below, or
# xvalues() silently falls through to slow P_GRID bisection instead of raising.
DNCF_XVALS = {
    (5, 5, 2, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (5, 5, 1, 2): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
    (4, 6, 2, 1): [mpf('0.5'), mpf('1'), mpf('1.5'), mpf('2.5'), mpf('4')],
}

# erfc-family and incomplete-beta-family boundary-crossover probes (issue #1178, continuation
# of #1143). P_GRID's probability-driven inversion cannot pin the internal special-function
# argument to a specific value, so these fixed x-values were solved (in plain float64, then
# evaluated here at mp.dps=50) to place the internal argument at 1%/0.1%/exactly the crossover
# on each side, mirroring #1143's marcumQ boundary-grid intent but for erfc (x<=1 series/CF,
# src/special/error.js) and regularizedBetaIncomplete (x<(a+1)/(a+b+2) direct/complementary CF,
# src/special/beta-incomplete.js).
LEVY_XVALS = {
    # z = sqrt(0.5*c/(x-mu)) crosses erfc's x<=1 dispatch at z=1 <=> x=mu+0.5*c=3.5.
    (2, 3): [mpf('3.5304560759106214'), mpf('3.503004506007509'), mpf('3.5'),
             mpf('3.4970044940074914'), mpf('3.4704440741103815')],
}
INVERSE_GAUSSIAN_XVALS = {
    # erfc(-a) crosses its x<=1 dispatch at -a=1 <=> a=-1, where
    # a = (sqrt(lambda*x)/mu - sqrt(lambda/x)) / sqrt(2).
    (2, 3): [mpf('0.6600414797517227'), mpf('0.6660004164792253'), mpf('0.6666666666666665'),
             mpf('0.6673337501875585'), mpf('0.6733751880868137')],
}
BETA_XVALS = {
    # x crosses regularizedBetaIncomplete's dispatch directly at x=(alpha+1)/(alpha+beta+2)=5/9.
    (4, 3): [mpf('0.55'), mpf('0.555'), mpf('0.5555555555555556'),
             mpf('0.5561111111111111'), mpf('0.5611111111111111')],
}
F_XVALS = {
    # internal beta-argument z=d1*x/(d1*x+d2) crosses the dispatch at z=(alpha+1)/(alpha+beta+2)=4/9.
    (6, 8): [mpf('1.0476190476190474'), mpf('1.0647482014388487'), mpf('1.0666666666666667'),
             mpf('1.0685882038964503'), mpf('1.086021505376344')],
}
NONCENTRAL_BETA_XVALS = {
    # x crosses regularizedBetaIncomplete(iAlpha0, beta, x)'s dispatch directly at
    # x=(iAlpha0+1)/(iAlpha0+beta+2)=5/9, where iAlpha0=alpha+round(lambda/2)=4.
    (2, 3, 4): [mpf('0.55'), mpf('0.555'), mpf('0.5555555555555556'),
                mpf('0.5561111111111111'), mpf('0.5611111111111111')],
}
NONCENTRAL_F_XVALS = {
    # internal beta-argument z=d1*x/(d1*x+d2) crosses the underlying NoncentralBeta dispatch at
    # z=(iAlpha0+1)/(iAlpha0+beta+2)=6/11, where iAlpha0=alpha+round(lambda/2)=5.
    (6, 8, 4): [mpf('1.5652173913043472'), mpf('1.596484218937275'), mpf('1.5999999999999996'),
                mpf('1.6035242290748895'), mpf('1.6356275303643726')],
}
# marcumQ transition-band mu=135 dispatch (issue #1190). _cdf is marcumP(k/2, lambda/2, x/2), so
# mu=k/2 and the marcum arguments are x_m=lambda/2=32, y=x/2. P_GRID's probability-driven inversion
# cannot place y inside the band y = x_m + mu +/- sqrt(4*x_m + 2*mu), so these are pinned instead.
# lambda=64 puts x_m=32 clearly above marcumQ's x<30 series threshold (deliberately NOT at 30,
# which is #1143's already-covered boundary) and far below the x >~ 300 region where the recurrence
# branch degrades (issue #1286). Band for mu=135 is y in (147.05, 186.95), i.e. x in (294.1, 373.9);
# for mu=134, x in (292.2, 371.8). Both k are even so _pdf takes the same besselI path in both
# groups and cannot confound the cdf comparison.
# The [270, 64] grid additionally spans both sign branches of _largeMu's expansion
# (qPrimary = zeta < 0 <=> y > x_m + mu = 167): x=296,320 are P-primary, x=334 sits exactly on the
# transition line (zeta=0, eta=0, erfc(0)=1), and x=350,372 are Q-primary -- so the odd-j sign flip
# between Eq. 75 and Eq. 79 in _expansionSum is covered.
NONCENTRAL_CHI2_XVALS = {
    (268, 64): [mpf('294'), mpf('318'), mpf('332'), mpf('348'), mpf('370')],
    (270, 64): [mpf('296'), mpf('320'), mpf('334'), mpf('350'), mpf('372')],
    # (76, 692) (issue #1286): the large-x recurrence set withheld until _fc's under-convergence
    # was fixed. mu=k/2=38, x_m=lambda/2=346; the transition band is y in (345.8, 422.2), i.e.
    # x in (691.6, 844.4). x is capped at 735 (well short of the band's own upper edge) because
    # NoncentralChi2._pdf independently overflows to Infinity for x >~ 738 at this lambda
    # (besselI(37, sqrt(lambda*x)) overflows once sqrt(lambda*x) exceeds ~715-720) -- a separate,
    # already-filed defect (see the marcumQ severity table in #1286's issue body), not something
    # this set should paper over by avoiding it silently without comment. x=695 is the closest
    # sample to the band's lower edge that still routes through _recurrence (not the plain
    # quadrature _pqTrap) with a non-trivial fc() depth; x in {695, 705, 715, 725, 735} keeps
    # every sample strictly inside the finite-pdf sub-window (691.6, 738) while still calling
    # _fc(nu=42, z~694-706) at 125-131 continued-fraction iterations, comfortably past the old
    # MAX_ITER=100 cap this issue fixed (confirmed via an instrumented run: pre-fix and post-fix
    # cdf values differ starting at the 12th-13th significant digit at every point here).
    (76, 692): [mpf('695'), mpf('705'), mpf('715'), mpf('725'), mpf('735')],
}

# Quadrature-based CDFs (Davis, noncentral-t, SkewNormal, VonMises): inverting by bisection
# would re-run the integral 70x per point, so we probe at fixed interior values instead.
#
# WARNING (issue #1200): NCT_XVALS, SKEWNORMAL_XVALS and VONMISES_XVALS below are fully-manual
# like DNCT_XVALS/DNCBETA_XVALS/DNCF_XVALS above -- every param tuple added to NoncentralT's,
# SkewNormal's or VonMises's PARAM_SETS entry must have a matching entry in its dict here, or
# xvalues()'s MANUAL_XVALS guard (#1178) silently falls through to slow P_GRID bisection instead
# of raising. The worst case of this hazard is DoublyNoncentralBeta, whose dncbeta_cdf alone can
# take up to ~44 minutes per call at large lambda, with one param set's calls totaling ~65
# minutes (see DNCBETA_XVALS and issue #1149) -- a missing entry for any of these fully-manual
# distributions risks the same kind of silent, expensive --emit run.
NCT_XVALS = {
    (5, 1): [mpf('-1'), mpf('0.5'), mpf('1.5'), mpf('2.8'), mpf('4.5')],
    (5, 0): [mpf('-2.5'), mpf('-1'), mpf('0.3'), mpf('1.5'), mpf('3')],
    (8, 2): [mpf('0.5'), mpf('1.5'), mpf('2.5'), mpf('3.5'), mpf('5')],
}
# WARNING (issue #1200): see the fallthrough-hazard note above NCT_XVALS -- every param tuple
# added to SkewNormal's PARAM_SETS entry needs a matching entry below, or xvalues() silently
# falls through to slow P_GRID bisection instead of raising.
SKEWNORMAL_XVALS = {
    (0, 2, 2): [mpf('-1'), mpf('0.5'), mpf('2'), mpf('4'), mpf('6')],
    (0, 2, -2): [mpf('-6'), mpf('-4'), mpf('-2'), mpf('-0.5'), mpf('1')],
    (1, 1, 3): [mpf('0.2'), mpf('0.7'), mpf('1.3'), mpf('2'), mpf('3')],
    # alpha=1 forces owenT's aAbs<=1 branch for every point regardless of h; spread across
    # the support rather than clustering near h=0.67 since that boundary is irrelevant here.
    (0, 1, 1): [mpf('-2'), mpf('-0.5'), mpf('0.4'), mpf('1.2'), mpf('2.5')],
    # alpha=2 keeps aAbs>1 fixed; 0.66/0.67/0.68 straddle owenT's |h|<=0.67 dispatch edge
    # (h = x/omega = x here) from both sides, with 0.67 landing exactly on the cut value.
    (0, 1, 2): [mpf('0.3'), mpf('0.66'), mpf('0.67'), mpf('0.68'), mpf('1.5')],
}
# WARNING (issue #1200): see the fallthrough-hazard note above NCT_XVALS -- every param tuple
# added to VonMises's PARAM_SETS entry needs a matching entry below, or xvalues() silently
# falls through to slow P_GRID bisection instead of raising.
VONMISES_XVALS = {
    (0, 2): [mpf('-2'), mpf('-0.8'), mpf('0.4'), mpf('1.2'), mpf('2.5')],
    (0, 0.5): [mpf('-2.5'), mpf('-1'), mpf('0.4'), mpf('1.4'), mpf('2.5')],
    (0, 1): [mpf('-2.5'), mpf('-1'), mpf('0.4'), mpf('1.4'), mpf('2.5')],
    # kappa=11 straddles besselI(0,x)'s Miller-recurrence dispatch band (10, 14] (bessel.js)
    # and includes three k*pi/4 phase points (-pi/4, pi/4, pi/2) where _cdf's Fourier-series
    # envelope convergence check (see src/dist/von-mises.js) was previously fooled by sin(i*x)
    # coincidentally vanishing at those exact phases -- see the withheld-set note above. The
    # remaining two points, -1 and 0.15, are generic interior probes (one moderate-tail, one
    # near-mode) added to round the group out to this file's standard 5-points-per-group shape,
    # matching how other groups here combine targeted boundary probes with generic coverage.
    (0, 11): [mpf('-1'), -pi / 4, mpf('0.15'), pi / 4, pi / 2],
    # mu=1.5 exercises the location-shift parameterization added alongside kappa; the same
    # kappa=2 x-values above, translated by mu, since f(x; mu, kappa) = f(x-mu; 0, kappa).
    (1.5, 2): [mpf('-0.5'), mpf('0.7'), mpf('1.9'), mpf('2.7'), mpf('4')],
}
# Davis is inverted by bisection like the rest (its quadrature CDF is slow but tolerable for
# one distribution) so its probes span the full support {0.1..0.9} rather than fixed points.
#
# WARNING (issue #1200): xvalues() below indexes this assembly dict with
# "name in MANUAL_XVALS and tuple(p) in MANUAL_XVALS[name]" (guard added in #1178 so a few
# distributions -- Levy, InverseGaussian, Beta, F, NoncentralBeta, NoncentralF -- can mix
# standard P_GRID-driven param sets with one manually-pinned boundary-crossover set in the same
# PARAM_SETS entry). For the six *fully*-manual entries here (DoublyNoncentralT, DoublyNoncentralBeta,
# DoublyNoncentralF, NoncentralT, SkewNormal, VonMises), every param tuple in that distribution's
# PARAM_SETS entry must still be present in its dict above -- the guard does not raise on a
# missing tuple, it silently falls through to the slow standard P_GRID/invcdf() bisection path.
# The concrete hazard: DoublyNoncentralBeta's dncbeta_cdf alone can take up to ~44 minutes per
# call at large lambda, with one param set's full set of calls totaling ~65 minutes (see
# DNCBETA_XVALS's (2, 2, 1200, 1200) case and issue #1149) -- adding a PARAM_SETS entry for it
# (or for any of the other five) without a matching entry in its manual dict would silently
# trigger that ~65-minute --emit run instead of failing fast.
MANUAL_XVALS = {
    'DoublyNoncentralT': DNCT_XVALS,
    'DoublyNoncentralBeta': DNCBETA_XVALS,
    'DoublyNoncentralF': DNCF_XVALS,
    'NoncentralT': NCT_XVALS,
    'SkewNormal': SKEWNORMAL_XVALS,
    'VonMises': VONMISES_XVALS,
    'Levy': LEVY_XVALS,
    'InverseGaussian': INVERSE_GAUSSIAN_XVALS,
    'Beta': BETA_XVALS,
    'F': F_XVALS,
    'NoncentralBeta': NONCENTRAL_BETA_XVALS,
    'NoncentralF': NONCENTRAL_F_XVALS,
    'NoncentralChi2': NONCENTRAL_CHI2_XVALS,
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

# DoublyNoncentralT[5, 5, 120] negative-x probes (issue #1252): same structural reason as
# NORMAL_FAR_TAIL_XVALS above -- DNCT_XVALS holds one x-list per (nu, mu, theta) tuple and
# (5, 5, 120) is already claimed by the positive-x group (issue #1207). This dict is NEVER wired
# into compute_cache() (same as NORMAL_FAR_TAIL_XVALS); the test/precision-continuous.js group is
# hand-maintained and not regenerated by --emit. Values computed via dnct_pdf/dnct_cdf above at
# mp.dps=50. Candidates x=-0.1, -0.2, -0.25, -0.45, -0.5, -0.7 were also measured and rejected --
# see the comment above the corresponding group in test/precision-continuous.js for the full
# accounting (x=-0.1/-0.2/-0.25: pdf wrong by 6-18 orders of magnitude, a broader manifestation of
# #1250's fnm-near-boundary floor; x=-0.45/-0.5/-0.7: errors climb to 1e-3-1.5, and x=-0.7's
# quantile round-trip returns exactly NaN).
# DoublyNoncentralT(5,5,120): x=-0.3  => pdf=1.8266462385869508e-9  cdf=6.076899024084247e-11
#                             x=-0.35 => pdf=4.075330583218124e-10  cdf=1.3380441248733746e-11
#                             x=-0.4  => pdf=8.905303105662145e-11  cdf=2.8946422024934806e-12
DNCT_NEGX_XVALS = {
    (5, 5, 120): [mpf('-0.3'), mpf('-0.35'), mpf('-0.4')],
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
                'Rice', 'UniformRatio', 'Weibull', 'DoublyNoncentralChi2', 'DoublyNoncentralF',
                'Tweedie'):
        return (mpf(0), NONE)
    if name in ('Beta', 'BaldingNichols', 'Bradford', 'Kumaraswamy', 'LogitNormal',
                'PowerLaw', 'UniformProduct', 'DoublyNoncentralBeta', 'NoncentralBeta'):
        return (mpf(0), mpf(1))
    if name in ('AsymmetricLaplace', 'Cauchy', 'Champernowne', 'DoubleGamma', 'DoubleWeibull',
                'ExponentiallyModifiedGaussian', 'FisherZ', 'Gumbel', 'GeneralizedLogistic',
                'GeneralizedNormal', 'HyperbolicSecant', 'Laplace', 'Logistic', 'Moyal',
                'Normal', 'SkewNormal', 'Slash', 'StudentT', 'StudentZ', 'NoncentralT',
                'DoublyNoncentralT'):
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
        mu = mpf(p[0])
        return (mu - pi, mu + pi)
    if name == 'Wigner':
        return (-mpf(p[0]), mpf(p[0]))
    if name == 'WrappedCauchy':
        mu = mpf(p[0])
        return (mu - pi, mu + pi)
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
    # Some distributions only have manual overrides for the boundary-crossover set added
    # in #1178, alongside other param sets that still use the standard P_GRID inversion below
    # -- fall through instead of unconditionally indexing when the specific tuple isn't listed.
    if name in MANUAL_XVALS and tuple(p) in MANUAL_XVALS[name]:
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
    ('NoncentralChi', '[2, 3.5]'): '2e-14',
    ('Tweedie', '[3, 0.5, 1.2]'): '2e-14',
    ('Tweedie', '[5, 0.5, 1.02]'): '1e-12',
    ('Tweedie', '[5, 0.5, 1.98]'): '3e-14',
    ('NoncentralT', '[5, 0]'): '2e-14',
    ('NoncentralT', '[5, 1]'): '1e-12',
    ('NoncentralT', '[8, 2]'): '2e-14',
    ('DoublyNoncentralT', '[5, 0, 2]'): '1e-13',
    ('DoublyNoncentralT', '[5, 1, 2]'): '1e-12',
    ('DoublyNoncentralT', '[6, 2, 1]'): '1e-12',
    # These three (and DoublyNoncentralBeta[2,2,1200,1200] below) are documentation only --
    # PRESERVE_VERBATIM controls their actual tol/qtol/cdfTol/comment output (see PRESERVE_VERBATIM
    # for why), but the correct measured values are recorded here too so this table stays an
    # accurate reference for every group regardless of which mechanism emits it.
    ('DoublyNoncentralT', '[5, 0, 120]'): '1e-13',
    ('DoublyNoncentralT', '[5, 5, 120]'): '1e-11',
    ('DoublyNoncentralT', '[5, 2, 120]'): '3e-9',
    ('DoublyNoncentralBeta', '[2, 2, 1200, 1200]'): '1e-11',
    ('SkewNormal', '[1, 1, 3]'): '1e-12',
    ('Rice', '[0.5, 2]'): '1e-13',
    ('Rice', '[7, 1]'): '5e-13',
    ('Rice', '[3.16, 1]'): '2e-14',
    ('NoncentralChi', '[5, 7.5]'): '5e-13',
    ('NoncentralChi2', '[5, 58]'): '5e-13',
    ('NoncentralChi2', '[5, 62]'): '5e-13',
    ('NoncentralChi2', '[268, 64]'): '5e-13',
    # [270, 64] is a pdf-only gate: its cdf floor is an order of magnitude looser (CDF_TOL below).
    ('NoncentralChi2', '[270, 64]'): '2e-14',
    # [76, 692] is a pdf-only gate: its cdf floor is an order of magnitude looser (CDF_TOL below).
    ('NoncentralChi2', '[76, 692]'): '2e-13',
    ('R', '[0.5]'): '1e-13',
    ('VonMises', '[0, 11]'): '1e-13',
}
# Per-(name, json-params) cdf-only tolerance override, for the rare group where pdf and cdf
# hit genuinely different floors and sharing PDFCDF_TOL's single value would either loosen
# the tight method's gate or fail the loose one. Only emitted (as `cdfTol:`, alongside `tol:`
# which stays pdf-facing) when present here; every other group keeps the single shared `tol`.
CDF_TOL = {
    ('DoublyNoncentralT', '[5, 2, 120]'): '1e-7',
    ('NoncentralChi2', '[270, 64]'): '3e-12',
    ('NoncentralChi2', '[76, 692]'): '2e-12',
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
    ('NoncentralChi2', '[5, 58]'): '5e-13',
    ('NoncentralChi2', '[5, 62]'): '5e-13',
    ('NoncentralChi2', '[268, 64]'): '5e-13',
    ('NoncentralChi2', '[270, 64]'): '5e-13',
    ('NoncentralChi2', '[76, 692]'): '5e-14',
    ('NoncentralChi', '[5, 7.5]'): '5e-13',
    ('Rice', '[7, 1]'): '5e-13',
    ('DoublyNoncentralT', '[5, 1, 2]'): '1e-12',
    ('DoublyNoncentralT', '[6, 2, 1]'): '1e-12',
    # Documentation only, per the PDFCDF_TOL comment above -- PRESERVE_VERBATIM controls output.
    ('DoublyNoncentralT', '[5, 0, 120]'): '5e-10',
    ('DoublyNoncentralT', '[5, 5, 120]'): '1e-11',
    ('DoublyNoncentralT', '[5, 2, 120]'): '1e-8',
    ('DoublyNoncentralBeta', '[2, 2, 1200, 1200]'): '1e-13',
    ('WrappedCauchy', '[1.0, 0.7]'): '1e-13',
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
    ('Tweedie', '[5, 0.5, 1.02]'): '4e-14',
    ('Tweedie', '[5, 0.5, 1.98]'): '1e-13',
    ('SkewNormal', '[1, 1, 3]'): '1e-13',
    ('StudentT', '[2]'): '1e-12',
    ('StudentT', '[5]'): '1e-12',
    ('StudentZ', '[3]'): '1e-13',
    ('StudentZ', '[5]'): '1e-12',
    ('UniformProduct', '[2]'): '1e-13',
    ('UniformProduct', '[4]'): '5e-13',
    ('UniformProduct', '[6]'): '1e-11',
    ('LogGamma', '[0.5, 0.5, 1]'): '2e-14',
    ('VonMises', '[0, 11]'): '1e-11',
}
# Per-(name, json-params) one-line justification comment emitted above a loosened group.
_N_SERIES = 'series/transform accumulates a few ULPs beyond 1e-14'
_N_ERFC = 'cdf uses erfc; its rounding caps relative accuracy just below 1e-13'
_N_NCT = 'pdf/cdf are noncentral-t (Poisson) mixtures; accumulated rounding caps accuracy near 1e-13'
_N_POLY = 'piecewise-polynomial Neumaier sum loses ~1 ULP beyond 1e-14'
_N_ROOT = 'q() has no closed form (numerical root-finding), so the round-trip is accurate to a few ULPs beyond 1e-14'
_N_BENK = 'q() switches to a Lambert-W asymptotic branch as b->1 (here b=0.9995); round-trip accurate to ~1e-9'
_N_HALLEY = 'q() is a Cornish-Fisher/Halley approximation; the cdf-round-trip loses a few ULPs beyond 1e-14'
_N_MARCUM = ('x sits near marcumQ\'s series/asymptotic dispatch threshold (x=30); pdf/cdf/quantile '
             'measured up to ~1.2e-13 in JIT-order-dependent full-suite runs (V8 rounding differs '
             'from an isolated run) -- gate at 5e-13')
_N_MARCUM_RECURRENCE = ('cdf routes through marcumQ\'s transition band just BELOW its mu=135 '
                        'dispatch (mu=k/2=134), i.e. the three-term backward recurrence seeded by '
                        'quadrature; the seed rounding plus ~2.9x per-step amplification caps '
                        'relative accuracy near 1e-13 (measured 1.8e-13 worst case, cdf). The '
                        'q(cdf(x)) round-trip at x=370 inherits that same floor plus the quantile '
                        'solver\'s own rounding and, like the [5,58]/[5,62] groups above, measured '
                        'over 1e-13 in JIT-order-dependent full-suite runs (two separate full-suite '
                        'CI runs measured 1.075e-13 and 1.663e-13; both pass in isolation) -- gate '
                        'at 5e-13 (issue #1304)')
_N_MARCUM_LARGEMU = ('cdf routes through marcumQ\'s transition band at exactly its mu=135 dispatch '
                     'boundary (mu=k/2=135), where the section 4.2 large-mu uniform asymptotic '
                     'expansion takes over. That expansion is truncated at (J=9, K=4), a depth '
                     'chosen offline so worst-case relative error at this very boundary is <=1e-11 '
                     '(see solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md); '
                     'its residual is largest here and at the band\'s lower edge, measuring 1.5e-12 '
                     'at x=296. cdfTol: 3e-12 gates that documented truncation floor -- it is a '
                     'deliberate design depth, not a defect -- while tol stays at 2e-14 for pdf, '
                     'which does not go through marcumQ at all and measures ~6e-15. The ~2x margin '
                     'is measured, not assumed: cdfTol: 1.6e-12 (1.04x over the isolated value) '
                     'also passes the full parallel suite, so unlike the _N_MARCUM groups this one '
                     'shows no JIT-order inflation')
# DoublyNoncentralT[5, 0, 120]/[5, 2, 120]/[5, 5, 120] each carry a much longer, hand-expanded
# investigation writeup in test/precision-continuous.js than a one-line NOTES entry can hold
# without becoming an unreadable wall of text -- see PRESERVE_VERBATIM below, which preserves
# those comments (and the DoublyNoncentralBeta[2,2,1200,1200] comment) verbatim instead. The
# three constants that used to back those three NOTES entries (_N_F11_BOUNDARY,
# _N_F11_RECURRENCE, _N_PDF_CANCELLATION) were deleted for the same reason: PRESERVE_VERBATIM
# reads the on-disk comment directly and never consults NOTES for these keys.
_N_MARCUM_RECURRENCE_LARGEX = ('cdf routes through marcumQ\'s transition band well below its mu=135 '
                     'dispatch (mu=k/2=38), at a large enough xi=sqrt(lambda*x)~694-706 that _fc\'s '
                     'modified-Lentz continued fraction previously truncated at the shared MAX_ITER=100 '
                     'before converging (needing 125-131 iterations here) -- issue #1286, the large-x '
                     'coverage withheld by #1190/#1143 until that fix landed. Now that _fc uses a '
                     'regime-aware iteration budget, its own contribution is negligible; the residual '
                     'gated here is the pre-existing seed/amplification floor _N_MARCUM_RECURRENCE '
                     'already documents for this same branch, measured at ~9e-14 (pdf) / ~6e-13 (cdf) '
                     'worst case across this group. x is capped at 735 (not the transition band\'s own '
                     'upper edge, 844) because NoncentralChi2._pdf independently overflows to Infinity '
                     'for x >~ 738 at this lambda (besselI\'s argument sqrt(lambda*x) crosses double\'s '
                     'overflow threshold ~715-720) -- a separate, already-filed defect, not something '
                     'this fix touches')
# Not wired into NOTES/PDFCDF_TOL below -- this constant documents the hand-maintained
# DoublyNoncentralT[5, 5, 120] negative-x group (see DNCT_NEGX_XVALS above), whose comment in
# test/precision-continuous.js is the actual source of truth (render() never touches that group).
_N_FNM_SATURATION = ('negative-x probes at mu=5, theta=120 (issue #1252): NoncentralT.fnm '
                     'saturates near its phi = 0.5*(1+erf(-mu/sqrt2)) plateau for the entire '
                     'Poisson(60)-significant nu0 range at small |x| (issue #1250) -- x=-0.1/'
                     '-0.2/-0.25 were measured and rejected (pdf wrong by 6-18 orders of '
                     'magnitude, not merely imprecise); x=-0.3/-0.35/-0.4 were kept (worst-case '
                     'measured error: pdf 8.9e-6, cdf 1.3e-4, quantile round-trip 1.2e-5, each '
                     'with 5-9x margin at tol: 5e-5 / cdfTol: 1e-3 / qtol: 1e-4); x=-0.45/-0.5/'
                     '-0.7 were rejected as the errors climb further (x=-0.7 reproduces the '
                     '#1235 solution doc\'s documented ~1.7x pdf floor and its quantile '
                     'round-trip returns exactly NaN)')
NOTES = {
    ('Bates', '[10, 5, 25]'): _N_POLY,
    ('Bates', '[5, -2, 2]'): _N_POLY,
    ('IrwinHall', '[10]'): _N_POLY,
    ('Levy', '[0, 2]'): _N_ERFC,
    ('Levy', '[1, 0.5]'): _N_ERFC,
    ('Levy', '[-1, 1]'): _N_ERFC,
    ('NoncentralBeta', '[0.1, 2, 10]'): _N_SERIES,
    ('NoncentralChi', '[5, 2]'): _N_SERIES,
    ('NoncentralChi', '[2, 3.5]'): _N_SERIES,
    ('Tweedie', '[3, 0.5, 1.2]'): _N_SERIES,
    ('Tweedie', '[5, 0.5, 1.02]'): 'series peaks nearest the Gamma(-j*alpha) pole (p->1) here, accumulating a few ULPs beyond 1e-14',
    ('Tweedie', '[5, 0.5, 1.98]'): _N_SERIES,
    ('NoncentralT', '[5, 0]'): _N_NCT,
    ('NoncentralT', '[5, 1]'): _N_NCT,
    ('NoncentralT', '[8, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[5, 0, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[5, 1, 2]'): _N_NCT,
    ('DoublyNoncentralT', '[6, 2, 1]'): _N_NCT,
    # [5, 0, 120] / [5, 5, 120] / [5, 2, 120] intentionally absent here -- see PRESERVE_VERBATIM.
    ('SkewNormal', '[1, 1, 3]'): 'cdf uses Owen T and q() root-finds on it; both lose a few ULPs beyond 1e-14',
    ('Rice', '[0.5, 2]'): _N_SERIES,
    ('Rice', '[3.16, 1]'): _N_SERIES,
    ('Rice', '[7, 1]'): _N_MARCUM,
    ('NoncentralChi', '[5, 7.5]'): _N_MARCUM,
    ('NoncentralChi2', '[5, 58]'): _N_MARCUM,
    ('NoncentralChi2', '[5, 62]'): _N_MARCUM,
    ('NoncentralChi2', '[268, 64]'): _N_MARCUM_RECURRENCE,
    ('NoncentralChi2', '[270, 64]'): _N_MARCUM_LARGEMU,
    ('NoncentralChi2', '[76, 692]'): _N_MARCUM_RECURRENCE_LARGEX,
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
    ('VonMises', '[0, 11]'): 'series/transform accumulates a few ULPs beyond 1e-14; q() has no closed form (numerical root-finding), which loosens the round-trip further',
    ('Beta', '[4, 3]'): "x straddles regularizedBetaIncomplete's direct/complementary continued-fraction dispatch at x=(alpha+1)/(alpha+beta+2)=5/9 (issue #1178)",
    ('F', '[6, 8]'): "internal beta-argument z=d1*x/(d1*x+d2) straddles regularizedBetaIncomplete's direct/complementary continued-fraction dispatch at z=(alpha+1)/(alpha+beta+2)=4/9 (issue #1178)",
    ('InverseGaussian', '[2, 3]'): "x straddles _cdf's erfc(-a) series/continued-fraction dispatch at -a=1 (issue #1178)",
    ('Levy', '[2, 3]'): "x straddles _cdf's erfc series/continued-fraction dispatch at z=sqrt(0.5*c/(x-mu))=1 (issue #1178)",
    ('NoncentralBeta', '[2, 3, 4]'): "x straddles regularizedBetaIncomplete(iAlpha0, beta, x)'s direct/complementary continued-fraction dispatch at x=(iAlpha0+1)/(iAlpha0+beta+2)=5/9, where iAlpha0=alpha+round(lambda/2)=4 (issue #1178)",
    ('NoncentralF', '[6, 8, 4]'): 'internal beta-argument z=d1*x/(d1*x+d2) straddles the underlying NoncentralBeta dispatch at z=(iAlpha0+1)/(iAlpha0+beta+2)=6/11, where iAlpha0=alpha+round(lambda/2)=5 (issue #1178)',
    ('SkewNormal', '[0, 1, 1]'): "straddles owenT's own |a|=1 dispatch boundary (SkewNormal[0, 1, 2] straddles its |h|=0.67 boundary) (src/special/owen-t.js:303-311, issue #1186); both matched mpmath to ~1e-16 relative error, so the default tol/qtol apply",
    ('ExponentiallyModifiedGaussian', '[1, 0.3, 5]'): 'params chosen so the 0.9-quantile point crosses mu + lambda*sigma^2 = 1.45, the _erfcTerm branch boundary -- unlike a wider-spread stress case, this exercises both the erfcx(arg>0) and naive-erfc(arg<=0) branches at 1e-14 tolerance',
    ('WrappedCauchy', '[-2.0, 0.05]'): "support is the mu-centred window [mu-pi, mu+pi] (matching scipy's vonmises(loc=mu) convention), so these x-values fall outside the canonical [-pi,pi] range -- expected here",
    ('WrappedCauchy', '[1.0, 0.7]'): 'qtol loosened to 1e-13: the p=0.1 quantile lands at x~=0.0049 for this parameter set, and the atan2-based cdf / atan-based quantile round-trip differs by ~1 ULP in absolute terms -- ~6e-14 relative error once amplified by x being this close to zero',
}
# Keys whose on-disk comment in test/precision-continuous.js is too long (multi-paragraph
# empirical writeups) or too structurally different (per-point provenance comments inside
# points:) for the single-line-above-`{` NOTES convention to reproduce without becoming either
# an unreadable wall of text or losing content entirely. render() skips fresh emission for these
# keys (see the `if key in PRESERVE_VERBATIM: continue` below) so their exact on-disk text --
# comment, tol, qtol, cdfTol and all -- is preserved verbatim on every regeneration via the same
# occurrence-counting mechanism that already preserves TruncatedExponential and the Normal/
# LogNormal far-tail groups (issue #1287).
PRESERVE_VERBATIM = {
    ('DoublyNoncentralBeta', '[2, 2, 1200, 1200]'),
    ('DoublyNoncentralT', '[5, 0, 120]'),
    ('DoublyNoncentralT', '[5, 2, 120]'),
    ('DoublyNoncentralT', '[5, 5, 120]'),
}


CACHE = '/tmp/precision-continuous-cache.json'


def compute_cache(only=None):
    # --only reuses the previous run's cached groups for every distribution not named, instead
    # of recomputing everything: DoublyNoncentralBeta[2,2,1200,1200] alone costs ~65 minutes
    # (issue #1149) via dncbeta_cdf/dncbeta_pdf, which every --emit paid unconditionally even
    # when regenerating an unrelated distribution added in the same PR. Falls back to computing
    # everything (only has no effect) if there is no prior CACHE to reuse from. Grouped by name
    # only (not by individual params, which are plain lists for most distributions but nested
    # lists of dicts for e.g. Hyperexponential -- unhashable, so params can never be a dict key);
    # a name/set-count mismatch against the live PARAM_SETS (e.g. a param set was added since the
    # cache was built) falls back to recomputing that distribution rather than reusing stale data.
    # This produces exactly one cache entry per PARAM_SETS (name, params) pair, in PARAM_SETS's own
    # order -- render()'s preserve-vs-fresh logic depends on that one-entry-per-key structure. A
    # hand-built cache for verification purposes (e.g. seeded from the checked-in output instead of
    # recomputing via mpmath) must mirror it, not just dump every on-disk REFS group 1:1, or
    # duplicate-key hand-maintained groups get double-counted and JSON serialization can silently
    # collapse float literals like `1.0` to `1`. See
    # solutions/testing/2026-08-02-1213-naive-cache-seed-false-positive-round-trip-corruption.md
    prev_by_name = {}
    if only:
        if os.path.exists(CACHE):
            with open(CACHE) as fh:
                for g in json.load(fh):
                    prev_by_name.setdefault(g['name'], []).append(g)
        else:
            # --only scopes cache REUSE, not computation -- with no prior cache this recomputes
            # every distribution, including the ~65-minute DoublyNoncentralBeta[1200,1200] set.
            # See solutions/tooling/2026-07-26-2200-precision-refs-only-flag-cache-scope-not-compute-scope.md
            print(f'  --only given but no cache at {CACHE} yet; computing everything', flush=True)

    cache = []
    for name, sets in PARAM_SETS.items():
        cached = prev_by_name.get(name)
        if only and name not in only and cached is not None and len(cached) == len(sets):
            cache.extend(cached)
            print(f'  reused cached {name} ({len(cached)} sets)', flush=True)
            continue
        for p in sets:
            pts = []
            for x in xvalues(name, p):
                print(f'    computing {name}{p} at x={x}...', flush=True)
                pts.append([num(x), num(pdf(name, p, x)), num(cdf(name, p, x))])
            cache.append({'name': name, 'params': p, 'points': pts})
            print(f'  computed {name}{p}', flush=True)
    with open(CACHE, 'w') as fh:
        json.dump(cache, fh)
    print(f'cached {len(cache)} groups to {CACHE}', flush=True)
    return cache


OUTPUT_PATH = 'test/precision-continuous.js'


def existing_groups(path):
    # A handful of groups in the output file (e.g. TruncatedExponential, and the
    # Normal/LogNormal far-tail sets in NORMAL_FAR_TAIL_XVALS) are hand-maintained and
    # intentionally outside PARAM_SETS's scope -- see the comments near PARAM_SETS and
    # NORMAL_FAR_TAIL_XVALS. compute_cache() can NEVER reproduce them (TruncatedExponential
    # has no PARAM_SETS entry at all; NORMAL_FAR_TAIL_XVALS is never wired into compute_cache),
    # so a plain "would this run drop an existing group" check trips on every real invocation
    # -- render() below instead preserves each group's ORIGINAL raw text (including any
    # leading comment) whenever the fresh cache doesn't reproduce it, rather than erroring
    # (issue #1186 follow-up). Returns an ordered list of (key, raw_group_text); key is a
    # (name, params-literal-text) pair matching how render() below builds js_lit(p) keys --
    # NOT js_params()/json.dumps, which can't match nested-object params like
    # Hyperexponential's [[{ weight: 1, ... }]] (unquoted JS keys, not JSON).
    if not os.path.exists(path):
        return []
    with open(path) as fh:
        src = fh.read()
    m = re.search(r'const REFS = \[', src)
    if not m:
        return []
    start = m.end() - 1
    # Justification comments (e.g. DoublyNoncentralT[5, 0, 120]'s reference to
    # `{ useFloor: false }`, or set notation like `{1, 2}`) can contain literal brace
    # characters; scanning `src` itself would desync the depth counter on them, misreading a
    # balanced brace pair INSIDE a comment as a whole group span and corrupting every span
    # after it. `masked` blanks `//`-to-end-of-line text while preserving every character's
    # index (and all newlines), so span boundaries found in `masked` line up exactly with the
    # real text extracted from `src` below.
    masked = re.sub(r'//[^\n]*', lambda cm: ' ' * len(cm.group(0)), src)
    depth = 0
    spans = []
    span_start = None
    for i in range(start, len(src)):
        if masked[i] == '[' or masked[i] == '{':
            if masked[i] == '{' and depth == 1:
                span_start = i
            depth += 1
        elif masked[i] == ']' or masked[i] == '}':
            depth -= 1
            if masked[i] == '}' and depth == 1:
                spans.append((span_start, i + 1))
            if depth == 0:
                break
    groups = []
    prev_end = start
    for span_start, span_end in spans:
        # Attach any comment lines directly above this group (e.g. the SkewNormal[1, 1, 3]
        # tolerance-justification comments) so they travel with a preserved group verbatim.
        gap = src[prev_end:span_start]
        comment_lines = [ln for ln in gap.splitlines() if ln.strip().startswith('//')]
        comment = ('\n'.join(comment_lines) + '\n') if comment_lines else ''
        # span_start points at the `{` itself, not its line's leading indent (which the
        # comment-capture above intentionally skips too, since it only keeps `//` lines) --
        # without re-adding it here, every preserved group's `{` loses the 2-space indent
        # every freshly-generated group gets from render()'s f-string below, and the loss is
        # normally masked by `npm run standard --fix` silently re-indenting it after any
        # regeneration, hiding a real byte-identical-output gap. See
        # solutions/tooling/2026-08-02-1214-preserved-group-indent-loss-masked-by-standard-fix.md
        text = comment + '  ' + src[span_start:span_end]
        gm = re.search(r"name:\s*'([^']+)',\s*params:\s*([\s\S]*?),\n\s*tol:", text)
        if gm:
            key = (gm.group(1), re.sub(r'\s+', ' ', gm.group(2).strip()))
            groups.append((key, text))
        else:
            # Silently dropping an unparseable span here would defeat the whole point of
            # existing_groups(): render() relies on its return value to decide what counts as
            # "already preserved", so a group that fails to parse would be neither reproduced
            # by compute_cache() nor preserved by render() -- the exact silent-data-loss failure
            # mode this mechanism exists to prevent (issue #1186). Fail loud instead.
            snippet = text.strip()[:80]
            raise RuntimeError(
                f'existing_groups(): could not parse a REFS group in {path!r} -- expected a '
                f"name: '...', params: ..., tol: ... shape; got: {snippet!r}")
        prev_end = span_end
    return groups


def render(cache, allow_prune=False):
    groups = []
    new_keys = Counter()
    for g in cache:
        name, p = g['name'], g['params']
        jp = js_params(p)
        key = (name, jp)
        if key in PRESERVE_VERBATIM:
            # Skip fresh emission entirely (not just tolerance/comment lookup) so this key
            # never enters new_keys -- the preserve walk below then treats every one of its
            # on-disk occurrences as unreproduced-by-cache surplus, same as a group with no
            # PARAM_SETS entry at all, and carries its exact text (comment, tol, qtol, cdfTol)
            # forward unchanged.
            continue
        # existing_groups() reads the on-disk JS literal (unquoted keys, e.g.
        # Hyperexponential's [[{ weight: 1, ... }]]), which json.dumps-based jp can never
        # match for nested-object params -- js_lit(p) is what actually gets written to disk.
        new_keys[(name, re.sub(r'\s+', ' ', js_lit(p)))] += 1
        tol = PDFCDF_TOL.get(key, '1e-14')
        # cdfTol is only emitted for the rare group in CDF_TOL whose cdf floor genuinely
        # diverges from pdf's; every other group keeps the single shared `tol` line so this
        # change is a no-op for the ~200 other groups (test/precision-continuous.js defaults
        # cdfTol to tol when the field is absent).
        cdf_tol = CDF_TOL.get(key)
        cdf_tol_line = f'    cdfTol: {cdf_tol},\n' if cdf_tol else ''
        qtol = Q_TOL.get(key, '1e-14')
        note = NOTES.get(key)
        comment = f'  // {name}{jp}: {note}\n' if note else ''
        pts = ',\n      '.join(
            f'{{ x: {x}, pdf: {pv}, cdf: {cv} }}' for x, pv, cv in g['points'])
        groups.append(
            f"{comment}  {{\n    name: '{name}',\n    params: {js_lit(p)},\n"
            f"    tol: {tol},\n{cdf_tol_line}    qtol: {qtol},\n    points: [\n      {pts}\n    ]\n  }}")

    if not allow_prune:
        # Walk existing groups in file order, "consuming" one occurrence of new_keys[key] per
        # group seen; any group beyond what the fresh cache reproduces for its key (e.g. the
        # far-tail Normal/LogNormal groups, which come right after their same-key standard
        # sibling in the file) is preserved verbatim instead of silently dropped.
        remaining = Counter(new_keys)
        preserved = []
        for key, text in existing_groups(OUTPUT_PATH):
            if remaining[key] > 0:
                remaining[key] -= 1
            else:
                preserved.append(text.rstrip('\n'))
        if preserved:
            groups.extend(preserved)
            print(f'preserved {len(preserved)} hand-maintained group(s) not reproduced by '
                  'PARAM_SETS (pass --allow-prune to actually remove them)', flush=True)

    data = '[\n' + ',\n'.join(groups) + '\n]'
    with open(OUTPUT_PATH, 'w') as fh:
        fh.write(TEMPLATE.format(data=data))
    print(f'wrote {OUTPUT_PATH} with {len(groups)} groups', flush=True)


def emit(only=None, allow_prune=False):
    render(compute_cache(only), allow_prune)


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

  // pdfTol/cdfTol default to the group's shared tol so the vast majority of groups (which
  // hit the same double-precision floor for both methods) are unaffected; only a group whose
  // pdf and cdf floors genuinely diverge (e.g. DoublyNoncentralT[5, 2, 120], issue #1235 --
  // pdf is gated tight while cdf keeps a pre-existing, out-of-scope looser floor) needs to
  // set them explicitly.
  REFS.forEach(({{ name, params, tol, qtol, pdfTol = tol, cdfTol = tol, points }}) => {{
    describe(`${{name}}(${{JSON.stringify(params)}})`, () => {{
      // Construct in a before() hook so a constructor regression surfaces as a failing
      // hook rather than silently skipping every assertion in this group.
      let d
      before(() => {{ d = new dist[name](...params) }})
      // One test per method (not per point): the message pinpoints the failing x, while
      // pdf/cdf/quantile stay isolated so a regression in one does not mask the others.
      it(`pdf to ${{pdfTol}} relative error`, () => {{
        points.forEach(({{ x, pdf }}) => {{
          // Guard the relative form against an exact-zero reference (pdf can vanish at an
          // interior point, e.g. UQuadratic at its centre).
          if (pdf === 0) assert.strictEqual(d.pdf(x), 0, `pdf at x=${{x}}`)
          else assert.approximately(d.pdf(x) / pdf, 1, pdfTol, `pdf at x=${{x}}`)
        }})
      }})
      it(`cdf to ${{cdfTol}} relative error`, () => {{
        points.forEach(({{ x, cdf }}) => {{
          // Guard the relative form against an exact-zero reference (defensive: all current
          // probes have cdf >= 0.1, but a future grid change could include a near-zero p).
          if (cdf === 0) assert.strictEqual(d.cdf(x), 0, `cdf at x=${{x}}`)
          else assert.approximately(d.cdf(x) / cdf, 1, cdfTol, `cdf at x=${{x}}`)
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
    allow_prune = '--allow-prune' in sys.argv
    if len(sys.argv) > 1 and sys.argv[1] == '--emit':
        emit_only = None
        if '--only' in sys.argv:
            idx = sys.argv.index('--only')
            emit_only = set(sys.argv[idx + 1].split(','))
        emit(emit_only, allow_prune)
    elif len(sys.argv) > 1 and sys.argv[1] == '--render':
        # Fast re-render from the cached mpmath values (no recomputation) after editing tolerances.
        with open(CACHE) as fh:
            render(json.load(fh), allow_prune)
    else:
        only = None
        if '--only' in sys.argv:
            idx = sys.argv.index('--only')
            only = set(sys.argv[idx + 1].split(','))
        self_check(only)
