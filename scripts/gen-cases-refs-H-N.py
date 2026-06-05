"""
Compute externally-sourced reference values for the secondary `cases` entries
in test/dist-cases-continuous.js for distributions HalfGeneralizedNormal →
Normal (issue #559).

All values computed with mpmath at mp.dps = 50, using the same formulas as
scripts/precision-refs-continuous.py.  Output is printed as JS literals ready
to paste into the cases entries.

Usage:
    python3 scripts/gen-cases-refs-H-N.py
"""

from mpmath import (mp, mpf, pi, sqrt, exp, log, expm1, log1p, cosh, tanh,
                    atan, asin, asinh, acos, sin, cos, gamma as gammafn,
                    loggamma, beta as betafn, erf, erfc, besseli, power,
                    fsum, factorial, zeta, quad, inf, fabs, sign, nsum,
                    gammainc, betainc, floor, binomial, e, diff)

mp.dps = 50

HALF = mpf(1) / 2
SQRT2 = sqrt(2)
SQRT2PI = sqrt(2 * pi)
SQRTPI = sqrt(pi)


def Phi(z):
    """Standard normal CDF."""
    return HALF * (1 + erf(mpf(z) / SQRT2))


def phi(z):
    """Standard normal PDF."""
    z = mpf(z)
    return exp(-z * z / 2) / SQRT2PI


def Preg(s, x):
    """Regularized lower incomplete gamma."""
    if x <= 0:
        return mpf(0)
    return gammainc(s, 0, x, regularized=True)


def Ireg(a, b, x):
    """Regularized incomplete beta."""
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    return betainc(a, b, 0, x, regularized=True)


def ncbeta_pdf(a, b, lam, x):
    """Non-central beta PDF via Poisson mixture."""
    a, b, lam, x = mpf(a), mpf(b), mpf(lam), mpf(x)
    if x <= 0 or x >= 1:
        return mpf(0)
    halfLam = lam / 2
    return nsum(lambda j: exp(-halfLam) * power(halfLam, j) / factorial(j) *
                power(x, a + j - 1) * power(1 - x, b - 1) / betafn(a + j, b),
                [0, inf])


def ncbeta_cdf(a, b, lam, x):
    """Non-central beta CDF via Poisson mixture."""
    a, b, lam, x = mpf(a), mpf(b), mpf(lam), mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    halfLam = lam / 2
    return nsum(lambda j: exp(-halfLam) * power(halfLam, j) / factorial(j) *
                Ireg(a + j, b, x),
                [0, inf])


def ncx2_pdf(k, lam, x):
    """Non-central chi2 PDF via stable log-space direct summation.

    Uses direct loop instead of nsum to avoid convergence-acceleration
    artifacts when the Poisson peak is at large j (large lambda).
    """
    k, lam, x = mpf(k), mpf(lam), mpf(x)
    if x <= 0:
        return mpf(0)
    halfLam = lam / 2
    halfx = x / 2
    log_halfLam = log(halfLam)
    log_halfx = log(halfx)
    # Poisson mean ± 8 standard deviations spans nearly all weight
    j_lo = max(0, int(float(halfLam - 8 * sqrt(halfLam))) - int(float(k)) - 10)
    j_hi = int(float(halfLam + 8 * sqrt(halfLam))) + int(float(k)) + 100
    # find max log-term (for numerical stability)
    max_lt = -mpf('inf')
    for j in range(j_lo, j_hi + 1):
        lt = -halfLam + j * log_halfLam - loggamma(j + 1) + (k / 2 + j - 1) * log_halfx - halfx - log(2) - loggamma(k / 2 + j)
        if lt > max_lt:
            max_lt = lt
    s = mpf(0)
    for j in range(j_lo, j_hi + 1):
        lt = -halfLam + j * log_halfLam - loggamma(j + 1) + (k / 2 + j - 1) * log_halfx - halfx - log(2) - loggamma(k / 2 + j)
        s += exp(lt - max_lt)
    return s * exp(max_lt)


def ncx2_cdf(k, lam, x):
    """Non-central chi2 CDF via Poisson mixture (log-space direct summation)."""
    k, lam, x = mpf(k), mpf(lam), mpf(x)
    if x <= 0:
        return mpf(0)
    halfLam = lam / 2
    halfx = x / 2
    log_halfLam = log(halfLam)
    j_lo = max(0, int(float(halfLam - 8 * sqrt(halfLam))) - int(float(k)) - 10)
    j_hi = int(float(halfLam + 8 * sqrt(halfLam))) + int(float(k)) + 100
    # Compute Poisson log-weights; combine with Preg
    # Use log-weight normalization to avoid cancellation
    log_w = []
    for j in range(j_lo, j_hi + 1):
        lw = -halfLam + j * log_halfLam - loggamma(j + 1)
        log_w.append(lw)
    max_lw = max(log_w)
    s = mpf(0)
    for i, j in enumerate(range(j_lo, j_hi + 1)):
        w = exp(log_w[i] - max_lw)
        s += w * Preg(k / 2 + j, halfx)
    return s * exp(max_lw)


def pdf(name, p, x):
    x = mpf(x)
    if name == 'HalfGeneralizedNormal':
        # pdf(x; alpha, beta) = beta / (alpha * Gamma(1/beta)) * exp(-(x/alpha)^beta)
        alpha, beta = mpf(p[0]), mpf(p[1])
        return beta / (alpha * gammafn(1 / beta)) * exp(-power(x / alpha, beta))

    if name == 'HalfNormal':
        # pdf(x; sigma) = sqrt(2/pi) / sigma * exp(-x^2 / (2*sigma^2))
        sigma = mpf(p[0])
        return SQRT2 / (sigma * SQRTPI) * exp(-x * x / (2 * sigma * sigma))

    if name == 'Hyperexponential':
        # p[0] = [{weight, rate}, ...]
        components = p[0]
        total_w = sum(c['weight'] for c in components)
        return sum(mpf(c['weight']) / total_w * mpf(c['rate']) * exp(-mpf(c['rate']) * x)
                   for c in components)

    if name == 'InverseChi2':
        # pdf(x; nu) = 2^(-nu/2) / Gamma(nu/2) * x^(-nu/2-1) * exp(-1/(2x))
        nu = mpf(p[0])
        return power(2, -nu / 2) / gammafn(nu / 2) * power(x, -nu / 2 - 1) * exp(-1 / (2 * x))

    if name == 'InverseGamma':
        # pdf(x; alpha, beta) = beta^alpha / Gamma(alpha) * x^(-alpha-1) * exp(-beta/x)
        alpha, beta = mpf(p[0]), mpf(p[1])
        return power(beta, alpha) / gammafn(alpha) * power(x, -alpha - 1) * exp(-beta / x)

    if name == 'InverseGaussian':
        # pdf(x; mu, lam) = sqrt(lam/(2*pi*x^3)) * exp(-lam*(x-mu)^2 / (2*mu^2*x))
        mu, lam = mpf(p[0]), mpf(p[1])
        return sqrt(lam / (2 * pi * x ** 3)) * exp(-lam * (x - mu) ** 2 / (2 * mu ** 2 * x))

    if name == 'InvertedWeibull':
        # pdf(x; c) = c * x^(-c-1) * exp(-x^(-c))
        c = mpf(p[0])
        return c * power(x, -c - 1) * exp(-power(x, -c))

    if name == 'IrwinHall':
        # pdf(x; n) = (1/(n-1)!) * sum_{k=0}^{floor(x)} (-1)^k * C(n,k) * (x-k)^(n-1)
        n = int(round(p[0]))
        fx = int(floor(x))
        s = sum(int((-1) ** k) * int(binomial(n, k)) * power(x - k, n - 1) for k in range(fx + 1))
        return s / gammafn(n)

    if name == 'JohnsonSU':
        # params: gamma, delta, lambda, xi
        # pdf = delta / (lambda * sqrt(2pi)) * exp(-0.5*(gamma + delta*arcsinh(z))^2) / sqrt(1+z^2)
        # z = (x - xi) / lambda
        g, d, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = (x - xi) / lam
        w = g + d * asinh(z)
        return d / (lam * SQRT2PI) * exp(-HALF * w * w) / sqrt(1 + z * z)

    if name == 'JohnsonSB':
        # params: gamma, delta, lambda, xi
        # z = x - xi, support: xi < x < xi + lambda
        # pdf = delta * lambda / (sqrt(2pi) * z * (lambda - z)) * exp(-0.5*(gamma + delta*log(z/(lambda-z)))^2)
        g, d, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = x - xi
        if z <= 0 or z >= lam:
            return mpf(0)
        w = g + d * log(z / (lam - z))
        return d * lam / (SQRT2PI * z * (lam - z)) * exp(-HALF * w * w)

    if name == 'Kumaraswamy':
        # pdf(x; a, b) = a*b * x^(a-1) * (1-x^a)^(b-1)
        a, b = mpf(p[0]), mpf(p[1])
        return a * b * power(x, a - 1) * power(1 - power(x, a), b - 1)

    if name == 'Laplace':
        # pdf(x; mu, b) = 1/(2b) * exp(-|x-mu|/b)
        mu, b = mpf(p[0]), mpf(p[1])
        return exp(-fabs(x - mu) / b) / (2 * b)

    if name == 'Levy':
        # pdf(x; mu, c) = sqrt(c/(2pi)) * exp(-c/(2*(x-mu))) / (x-mu)^(3/2)
        mu, c = mpf(p[0]), mpf(p[1])
        t = x - mu
        if t <= 0:
            return mpf(0)
        return sqrt(c / (2 * pi)) * exp(-c / (2 * t)) / power(t, mpf(3) / 2)

    if name == 'Lindley':
        # pdf(x; theta) = theta^2 / (1+theta) * (1+x) * exp(-theta*x)
        theta = mpf(p[0])
        return theta ** 2 / (1 + theta) * (1 + x) * exp(-theta * x)

    if name == 'LogCauchy':
        # pdf(x; mu, sigma) = 1/(pi*x) * sigma / ((log(x)-mu)^2 + sigma^2)
        mu, sigma = mpf(p[0]), mpf(p[1])
        t = log(x) - mu
        return sigma / (pi * x * (t * t + sigma * sigma))

    if name == 'LogGamma':
        # pdf(x; alpha, beta, mu): Y = log(x-mu+1) ~ Gamma(alpha, beta)
        # pdf_X(x) = pdf_Gamma(log(x-mu+1)) / (x-mu+1)
        alpha, beta, mu = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = log(x - mu + 1)
        # Gamma pdf: beta^alpha / Gamma(alpha) * y^(alpha-1) * exp(-beta*y)
        gamma_pdf = power(beta, alpha) / gammafn(alpha) * power(y, alpha - 1) * exp(-beta * y)
        return gamma_pdf / (x - mu + 1)

    if name == 'LogLaplace':
        # pdf(x; mu, b) = 1/(2*b*x) * exp(-|log(x)-mu|/b)
        mu, b = mpf(p[0]), mpf(p[1])
        return exp(-fabs(log(x) - mu) / b) / (2 * b * x)

    if name == 'LogLogistic':
        # pdf(x; alpha, beta) = (beta/alpha) * (x/alpha)^(beta-1) / (1+(x/alpha)^beta)^2
        alpha, beta = mpf(p[0]), mpf(p[1])
        t = power(x / alpha, beta)
        return beta / alpha * power(x / alpha, beta - 1) / (1 + t) ** 2

    if name == 'LogNormal':
        # pdf(x; mu, sigma) = 1/(x*sigma*sqrt(2pi)) * exp(-(log(x)-mu)^2/(2*sigma^2))
        mu, sigma = mpf(p[0]), mpf(p[1])
        return exp(-HALF * ((log(x) - mu) / sigma) ** 2) / (x * sigma * SQRT2PI)

    if name == 'Logarithmic':
        # pdf(x; a, b) = log(x) / (a*(1-log(a)) - b*(1-log(b)))
        a, b = mpf(p[0]), mpf(p[1])
        Z = a * (1 - log(a)) - b * (1 - log(b))
        return log(x) / Z

    if name == 'Logistic':
        # pdf(x; mu, s) = exp(-(x-mu)/s) / (s*(1+exp(-(x-mu)/s))^2)
        mu, s = mpf(p[0]), mpf(p[1])
        t = exp(-(x - mu) / s)
        return t / (s * (1 + t) ** 2)

    if name == 'LogisticExponential':
        # pdf(x; lambda, kappa) = lambda*kappa*(e^(lam*x)-1)^(kappa-1)*e^(lam*x) / (1+(e^(lam*x)-1)^kappa)^2
        lam, kap = mpf(p[0]), mpf(p[1])
        e_lx = exp(lam * x)
        u = e_lx - 1
        return lam * kap * power(u, kap - 1) * e_lx / (1 + power(u, kap)) ** 2

    if name == 'LogitNormal':
        # pdf(x; mu, sigma) = 1/(sigma*sqrt(2pi)*x*(1-x)) * exp(-(logit(x)-mu)^2/(2*sigma^2))
        mu, sigma = mpf(p[0]), mpf(p[1])
        logit_x = log(x / (1 - x))
        return exp(-HALF * ((logit_x - mu) / sigma) ** 2) / (sigma * SQRT2PI * x * (1 - x))

    if name == 'Lomax':
        # pdf(x; lambda, alpha) = alpha/lambda * (1 + x/lambda)^(-alpha-1)
        lam, alpha = mpf(p[0]), mpf(p[1])
        return alpha / lam * power(1 + x / lam, -alpha - 1)

    if name == 'Makeham':
        # pdf(x; alpha, beta, lambda) = (alpha*e^(beta*x) + lambda) * exp(-lambda*x - alpha/beta*(e^(beta*x)-1))
        alpha, beta, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        e_bx = exp(beta * x)
        return (alpha * e_bx + lam) * exp(-lam * x - alpha / beta * (e_bx - 1))

    if name == 'MaxwellBoltzmann':
        # pdf(x; a) = sqrt(2/pi) * x^2 * exp(-x^2/(2*a^2)) / a^3
        a = mpf(p[0])
        return SQRT2 / (SQRTPI * a ** 3) * x * x * exp(-x * x / (2 * a * a))

    if name == 'Mielke':
        # pdf(x; k, s) = k*x^(k-1) / (1+x^s)^(1+k/s)
        k, s = mpf(p[0]), mpf(p[1])
        return k * power(x, k - 1) / power(1 + power(x, s), 1 + k / s)

    if name == 'Moyal':
        # pdf(x; mu, sigma) = 1/sqrt(2pi) * exp(-0.5*(z+exp(-z))) / sigma
        # z = (x - mu) / sigma
        mu, sigma = mpf(p[0]), mpf(p[1])
        z = (x - mu) / sigma
        return exp(-HALF * (z + exp(-z))) / (sigma * SQRT2PI)

    if name == 'Muth':
        # pdf(x; alpha) = (exp(alpha*x) - alpha) * exp(alpha*x - 1/alpha*(exp(alpha*x)-1))
        alpha = mpf(p[0])
        e_ax = exp(alpha * x)
        return (e_ax - alpha) * exp(alpha * x - (e_ax - 1) / alpha)

    if name == 'Nakagami':
        # pdf(x; m, omega) = 2*m^m / (Gamma(m)*omega^m) * x^(2m-1) * exp(-m*x^2/omega)
        m, omega = mpf(p[0]), mpf(p[1])
        return (2 * power(m, m) / (gammafn(m) * power(omega, m))) * power(x, 2 * m - 1) * exp(-m * x * x / omega)

    if name == 'NoncentralBeta':
        # pdf via Poisson mixture
        a, b, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return ncbeta_pdf(a, b, lam, x)

    if name == 'NoncentralChi':
        # pdf(x; k, lambda) = x * exp(-0.5*(x^2+lambda^2)) * (x*lambda)^(-k/2+1) * (x*lambda)^(k/2) * I_{k/2-1}(lambda*x)
        # Simplified: x * exp(-0.5*(x^2+lambda^2) + (k/4-0.5)*log(x^2/lambda^2)) * I_{k/2-1}(lambda*x)
        k, lam = mpf(p[0]), mpf(p[1])
        lambda2 = lam * lam
        if x <= 0:
            return mpf(0)
        order = k / 2 - 1
        return x * exp(-HALF * (x * x + lambda2)) * power(x * x / lambda2, k / 4 - HALF) * besseli(order, lam * x)

    if name == 'NoncentralChi2':
        # pdf via Poisson mixture
        k, lam = mpf(p[0]), mpf(p[1])
        return ncx2_pdf(k, lam, x)

    if name == 'NoncentralF':
        # via NoncentralBeta: x -> u = d1*x/(d1*x+d2), with Jacobian
        d1, d2, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x <= 0:
            return mpf(0)
        u = d1 * x / (d1 * x + d2)
        beta_pdf_val = ncbeta_pdf(d1 / 2, d2 / 2, lam, u)
        return d1 * d2 / (d1 * x + d2) ** 2 * beta_pdf_val

    if name == 'Normal':
        # pdf(x; mu, sigma) = 1/(sigma*sqrt(2pi)) * exp(-0.5*((x-mu)/sigma)^2)
        mu, sigma = mpf(p[0]), mpf(p[1])
        return exp(-HALF * ((x - mu) / sigma) ** 2) / (sigma * SQRT2PI)

    raise ValueError('pdf: ' + name)


def cdf(name, p, x):
    x = mpf(x)
    if name == 'HalfGeneralizedNormal':
        # cdf(x; alpha, beta) = Preg(1/beta, (x/alpha)^beta)
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Preg(1 / beta, power(x / alpha, beta))

    if name == 'HalfNormal':
        # cdf(x; sigma) = erf(x/(sigma*sqrt(2)))
        sigma = mpf(p[0])
        return erf(x / (sigma * SQRT2))

    if name == 'Hyperexponential':
        components = p[0]
        total_w = sum(c['weight'] for c in components)
        return 1 - sum(mpf(c['weight']) / total_w * exp(-mpf(c['rate']) * x)
                       for c in components)

    if name == 'InverseChi2':
        # cdf(x; nu) = 1 - Preg(nu/2, 1/(2x)) = Qreg(nu/2, 1/(2x)) = upper incomplete gamma
        nu = mpf(p[0])
        return 1 - Preg(nu / 2, 1 / (2 * x))

    if name == 'InverseGamma':
        # cdf(x; alpha, beta) = 1 - Preg(alpha, beta/x) = upper incomplete gamma
        alpha, beta = mpf(p[0]), mpf(p[1])
        return 1 - Preg(alpha, beta / x)

    if name == 'InverseGaussian':
        # cdf(x; mu, lam) = Phi(sqrt(lam/x)*(x/mu-1)) + exp(2*lam/mu)*Phi(-sqrt(lam/x)*(x/mu+1))
        mu, lam = mpf(p[0]), mpf(p[1])
        sq = sqrt(lam / x)
        return Phi(sq * (x / mu - 1)) + exp(2 * lam / mu) * Phi(-sq * (x / mu + 1))

    if name == 'InvertedWeibull':
        # cdf(x; c) = exp(-x^(-c))
        c = mpf(p[0])
        return exp(-power(x, -c))

    if name == 'IrwinHall':
        # cdf(x; n) = (1/n!) * sum_{k=0}^{floor(x)} (-1)^k * C(n,k) * (x-k)^n
        n = int(round(p[0]))
        fx = int(floor(x))
        s = sum(int((-1) ** k) * int(binomial(n, k)) * power(x - k, n) for k in range(fx + 1))
        return s / gammafn(n + 1)

    if name == 'JohnsonSU':
        g, d, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = (x - xi) / lam
        return Phi(g + d * asinh(z))

    if name == 'JohnsonSB':
        g, d, lam, xi = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        z = x - xi
        if z <= 0:
            return mpf(0)
        if z >= lam:
            return mpf(1)
        return Phi(g + d * log(z / (lam - z)))

    if name == 'Kumaraswamy':
        # cdf(x; a, b) = 1 - (1 - x^a)^b
        a, b = mpf(p[0]), mpf(p[1])
        return 1 - power(1 - power(x, a), b)

    if name == 'Laplace':
        # cdf(x; mu, b) = 0.5*exp((x-mu)/b) if x<mu, 1-0.5*exp(-(x-mu)/b) if x>=mu
        mu, b = mpf(p[0]), mpf(p[1])
        t = (x - mu) / b
        if t < 0:
            return HALF * exp(t)
        return 1 - HALF * exp(-t)

    if name == 'Levy':
        # cdf(x; mu, c) = erfc(sqrt(c/(2*(x-mu))))
        mu, c = mpf(p[0]), mpf(p[1])
        t = x - mu
        if t <= 0:
            return mpf(0)
        return erfc(sqrt(c / (2 * t)))

    if name == 'Lindley':
        # cdf(x; theta) = 1 - exp(-theta*x)*(1 + theta*x/(1+theta))
        theta = mpf(p[0])
        return 1 - exp(-theta * x) * (1 + theta * x / (1 + theta))

    if name == 'LogCauchy':
        # cdf(x; mu, sigma) = 0.5 + 1/pi * atan((log(x)-mu)/sigma)
        mu, sigma = mpf(p[0]), mpf(p[1])
        return HALF + atan((log(x) - mu) / sigma) / pi

    if name == 'LogGamma':
        # cdf(x; alpha, beta, mu) = Preg(alpha, beta*log(x-mu+1))
        alpha, beta, mu = mpf(p[0]), mpf(p[1]), mpf(p[2])
        y = log(x - mu + 1)
        return Preg(alpha, beta * y)

    if name == 'LogLaplace':
        # cdf(x; mu, b) = Laplace CDF of log(x)
        mu, b = mpf(p[0]), mpf(p[1])
        return cdf('Laplace', [mu, b], log(x))

    if name == 'LogLogistic':
        # cdf(x; alpha, beta) = 1/(1+(x/alpha)^(-beta))
        alpha, beta = mpf(p[0]), mpf(p[1])
        return 1 / (1 + power(x / alpha, -beta))

    if name == 'LogNormal':
        # cdf(x; mu, sigma) = Phi((log(x)-mu)/sigma)
        mu, sigma = mpf(p[0]), mpf(p[1])
        return Phi((log(x) - mu) / sigma)

    if name == 'Logarithmic':
        # cdf(x; a, b) = (a*(1-log(a)) - x*(1-log(x))) / (a*(1-log(a)) - b*(1-log(b)))
        a, b = mpf(p[0]), mpf(p[1])
        Z = a * (1 - log(a)) - b * (1 - log(b))
        return (a * (1 - log(a)) - x * (1 - log(x))) / Z

    if name == 'Logistic':
        # cdf(x; mu, s) = 1/(1+exp(-(x-mu)/s))
        mu, s = mpf(p[0]), mpf(p[1])
        return 1 / (1 + exp(-(x - mu) / s))

    if name == 'LogisticExponential':
        # cdf(x; lambda, kappa) = u/(1+u) where u = (e^(lambda*x)-1)^kappa
        lam, kap = mpf(p[0]), mpf(p[1])
        u = power(expm1(lam * x), kap)
        return u / (1 + u)

    if name == 'LogitNormal':
        # cdf(x; mu, sigma) = Phi((logit(x)-mu)/sigma)
        mu, sigma = mpf(p[0]), mpf(p[1])
        logit_x = log(x / (1 - x))
        return Phi((logit_x - mu) / sigma)

    if name == 'Lomax':
        # cdf(x; lambda, alpha) = 1 - (1 + x/lambda)^(-alpha)
        lam, alpha = mpf(p[0]), mpf(p[1])
        return 1 - power(1 + x / lam, -alpha)

    if name == 'Makeham':
        # cdf(x; alpha, beta, lambda) = 1 - exp(-lambda*x - alpha/beta*(e^(beta*x)-1))
        alpha, beta, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        e_bx = exp(beta * x)
        return 1 - exp(-lam * x - alpha / beta * (e_bx - 1))

    if name == 'MaxwellBoltzmann':
        # cdf(x; a) = Preg(3/2, x^2/(2*a^2))
        a = mpf(p[0])
        return Preg(mpf(3) / 2, x * x / (2 * a * a))

    if name == 'Mielke':
        # cdf(x; k, s) = (1 + x^(-s))^(-k/s) = x^k / (1+x^s)^(k/s)
        k, s = mpf(p[0]), mpf(p[1])
        return power(1 + power(x, -s), -k / s)

    if name == 'Moyal':
        # cdf(x; mu, sigma) = erfc(exp((mu-x)/(2*sigma)) / sqrt(2))
        # = 1 - erf(exp((mu-x)/(2*sigma)) / sqrt(2))
        # = Q(0.5, 0.5*exp((mu-x)/sigma))  where Q is upper incomplete gamma
        # In mpmath: erfc(sqrt(z)) where z = 0.5*exp((mu-x)/sigma)
        mu, sigma = mpf(p[0]), mpf(p[1])
        z = HALF * exp((mu - x) / sigma)
        return erfc(sqrt(z))

    if name == 'Muth':
        # cdf(x; alpha) = 1 - exp(alpha*x - 1/alpha*(e^(alpha*x)-1))
        alpha = mpf(p[0])
        e_ax = exp(alpha * x)
        return 1 - exp(alpha * x - (e_ax - 1) / alpha)

    if name == 'Nakagami':
        # cdf(x; m, omega) = Preg(m, m*x^2/omega)
        m, omega = mpf(p[0]), mpf(p[1])
        return Preg(m, m * x * x / omega)

    if name == 'NoncentralBeta':
        a, b, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        return ncbeta_cdf(a, b, lam, x)

    if name == 'NoncentralChi':
        # CDF(x; k, lambda) = NoncentralChi2 CDF(x^2; k, lambda^2)
        k, lam = mpf(p[0]), mpf(p[1])
        return ncx2_cdf(k, lam * lam, x * x)

    if name == 'NoncentralChi2':
        k, lam = mpf(p[0]), mpf(p[1])
        return ncx2_cdf(k, lam, x)

    if name == 'NoncentralF':
        # CDF via NoncentralBeta: u = d1*x/(d1*x+d2)
        d1, d2, lam = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x <= 0:
            return mpf(0)
        u = d1 * x / (d1 * x + d2)
        return ncbeta_cdf(d1 / 2, d2 / 2, lam, u)

    if name == 'Normal':
        # cdf(x; mu, sigma) = Phi((x-mu)/sigma)
        mu, sigma = mpf(p[0]), mpf(p[1])
        return Phi((x - mu) / sigma)

    raise ValueError('cdf: ' + name)


def num(x):
    """Float64 shortest-round-trip decimal repr."""
    return repr(float(x))


# ── Cases to update: (dist_name, case_name, params, x_values, comment) ──────────

CASES = [
    ('HalfGeneralizedNormal', 'small shapes', [0.5, 0.5],
     [0.01, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0],
     '// mpmath: beta/(alpha*Gamma(1/beta))*exp(-(x/alpha)^beta), Preg(1/beta,(x/alpha)^beta)  (alpha=0.5,beta=0.5)'),

    ('HalfNormal', 'small sigma', [0.5],
     [0.05, 0.1, 0.3, 0.5, 1.0, 1.5, 2.5],
     '// mpmath: sqrt(2/pi)/sigma*exp(-x^2/(2*sigma^2)), erf(x/(sigma*sqrt(2)))  (sigma=0.5)'),

    ('Hyperexponential', 'asymmetric mixture',
     [[{'weight': 1, 'rate': 0.5}, {'weight': 3, 'rate': 4}]],
     [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0],
     '// mpmath: sum(p_i*lam_i*exp(-lam_i*x)), 1-sum(p_i*exp(-lam_i*x))  (weights=[1,3],rates=[0.5,4])'),

    ('InverseChi2', 'small nu', [2],
     [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0],
     '// mpmath: 2^(-nu/2)/Gamma(nu/2)*x^(-nu/2-1)*exp(-1/(2x)), 1-Preg(nu/2,1/(2x))  (nu=2)'),

    ('InverseGamma', 'near-zero shapes', [0.5, 0.5],
     [0.05, 0.1, 0.3, 0.5, 1.0, 3.0, 8.0],
     '// mpmath: beta^alpha/Gamma(alpha)*x^(-alpha-1)*exp(-beta/x), 1-Preg(alpha,beta/x)  (alpha=0.5,beta=0.5)'),

    ('InverseGaussian', 'large mu, small lambda', [1, 0.5],
     [0.2, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0],
     '// mpmath: sqrt(lam/(2pi*x^3))*exp(-lam*(x-mu)^2/(2*mu^2*x)), Phi+exp(2lam/mu)*Phi  (mu=1,lam=0.5)'),

    ('InvertedWeibull', 'near-zero c', [0.5],
     [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 15.0],
     '// mpmath: c*x^(-c-1)*exp(-x^(-c)), exp(-x^(-c))  (c=0.5)'),

    ('IrwinHall', 'small n', [3],
     [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 2.9],
     '// mpmath: piecewise polynomial PDF/CDF, n=3'),

    ('JohnsonSU', 'shifted, small delta and lambda', [1, 0.5, 0.5, 1],
     [-1.0, 0, 0.5, 1.0, 1.5, 2.0, 3.0],
     '// mpmath: Phi(gamma+delta*arcsinh((x-xi)/lambda)), normal transform  (gamma=1,delta=0.5,lambda=0.5,xi=1)'),

    ('JohnsonSB', 'shifted, small delta and lambda', [1, 0.5, 0.5, 1],
     [1.05, 1.1, 1.2, 1.3, 1.4, 1.45, 1.49],
     '// mpmath: delta*lambda/(sqrt(2pi)*z*(lam-z))*exp(-0.5*w^2), Phi(w)  (gamma=1,delta=0.5,lambda=0.5,xi=1)'),

    ('Kumaraswamy', 'near-zero shapes (U-shape)', [0.5, 0.5],
     [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99],
     '// mpmath: a*b*x^(a-1)*(1-x^a)^(b-1), 1-(1-x^a)^b  (a=0.5,b=0.5)'),

    ('Laplace', 'shifted location, small scale', [3, 0.5],
     [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0],
     '// mpmath: exp(-|x-mu|/b)/(2b), piecewise CDF  (mu=3,b=0.5)'),

    ('Levy', 'shifted location, small scale', [1, 0.5],
     [1.05, 1.1, 1.3, 1.5, 2.0, 4.0, 8.0],
     '// mpmath: sqrt(c/(2pi))*exp(-c/(2t))/t^(3/2), erfc(sqrt(c/(2t)))  (mu=1,c=0.5)'),

    ('Lindley', 'small theta', [0.5],
     [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0],
     '// mpmath: theta^2/(1+theta)*(1+x)*exp(-theta*x), 1-exp(-theta*x)*(1+theta*x/(1+theta))  (theta=0.5)'),

    ('LogCauchy', 'positive mu, small sigma', [1, 0.5],
     [0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0],
     '// mpmath: sigma/(pi*x*((log(x)-mu)^2+sigma^2)), 0.5+atan((log(x)-mu)/sigma)/pi  (mu=1,sigma=0.5)'),

    ('LogGamma', 'small shape/rate, unit mu', [0.5, 0.5, 1],
     [1.1, 1.3, 2.0, 5.0, 10.0, 20.0],
     '// mpmath: Gamma(alpha,beta) on Y=log(x-mu+1); pdf=Gamma_pdf(Y)/(x-mu+1), cdf=Preg(alpha,beta*Y)  (alpha=0.5,beta=0.5,mu=1)'),

    ('LogLaplace', 'positive mu, small b', [1, 0.5],
     [0.3, 0.7, 1.5, 2.7, 5.0, 10.0, 20.0],
     '// mpmath: exp(-|log(x)-mu|/b)/(2bx), Laplace CDF of log(x)  (mu=1,b=0.5)'),

    ('LogLogistic', 'near-zero shapes', [0.5, 0.5],
     [0.01, 0.1, 0.5, 1.0, 5.0, 20.0, 100.0],
     '// mpmath: (beta/alpha)*(x/alpha)^(beta-1)/(1+(x/alpha)^beta)^2, 1/(1+(x/alpha)^(-beta))  (alpha=0.5,beta=0.5)'),

    ('LogNormal', 'positive mu, small sigma', [1, 0.5],
     [0.5, 1.0, 2.0, 4.0, 7.0, 12.0, 20.0],
     '// mpmath: exp(-0.5*((log(x)-mu)/sigma)^2)/(x*sigma*sqrt(2pi)), Phi((log(x)-mu)/sigma)  (mu=1,sigma=0.5)'),

    ('Logarithmic', 'small range', [2, 10],
     [2.1, 3.0, 4.0, 5.5, 7.0, 9.0, 9.9],
     '// mpmath: log(x)/Z, (a(1-log(a))-x(1-log(x)))/Z  (a=2,b=10)'),

    ('Logistic', 'shifted location, small scale', [3, 0.5],
     [0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0],
     '// mpmath: exp(-(x-mu)/s)/(s*(1+exp(-(x-mu)/s))^2), 1/(1+exp(-(x-mu)/s))  (mu=3,s=0.5)'),

    ('LogisticExponential', 'small lambda and kappa', [0.5, 0.5],
     [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0],
     '// mpmath: lambda*kappa*(e^(lam*x)-1)^(kap-1)*e^(lam*x)/(1+(e^(lam*x)-1)^kap)^2  (lambda=0.5,kappa=0.5)'),

    ('LogitNormal', 'positive mu, small sigma', [1, 0.5],
     [0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 0.98],
     '// mpmath: Normal applied to logit(x); pdf=phi(logit)/(x(1-x)*sigma), cdf=Phi((logit-mu)/sigma)  (mu=1,sigma=0.5)'),

    ('Lomax', 'near-zero shapes', [0.5, 0.5],
     [0.01, 0.1, 0.5, 1.0, 5.0, 20.0, 100.0],
     '// mpmath: alpha/lambda*(1+x/lambda)^(-alpha-1), 1-(1+x/lambda)^(-alpha)  (lambda=0.5,alpha=0.5)'),

    ('Makeham', 'small parameters', [0.5, 0.5, 0.5],
     [0.1, 0.5, 1.0, 2.0, 4.0, 7.0],
     '// mpmath: (alpha*e^(beta*x)+lambda)*exp(-lambda*x-alpha/beta*(e^(beta*x)-1))  (alpha=0.5,beta=0.5,lambda=0.5)'),

    ('MaxwellBoltzmann', 'small a', [0.5],
     [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0],
     '// mpmath: sqrt(2/pi)*x^2*exp(-x^2/(2a^2))/a^3, Preg(3/2,x^2/(2a^2))  (a=0.5)'),

    ('Mielke', 'small k, large s', [0.5, 4],
     [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0],
     '// mpmath: k*x^(k-1)/(1+x^s)^(1+k/s), (1+x^(-s))^(-k/s)  (k=0.5,s=4)'),

    ('Moyal', 'shifted location, small scale', [3, 0.5],
     [3.0, 3.2, 3.5, 4.0, 5.0, 7.0, 10.0],
     '// mpmath: exp(-0.5*(z+exp(-z)))/(sigma*sqrt(2pi)), erfc(sqrt(0.5*exp((mu-x)/sigma)))  (mu=3,sigma=0.5)'),

    ('Muth', 'near-zero kappa', [0.1],
     [0.1, 1.0, 3.0, 6.0, 10.0, 15.0, 22.0],
     '// mpmath: (exp(alpha*x)-alpha)*exp(alpha*x-(exp(alpha*x)-1)/alpha), 1-survival  (alpha=0.1)'),

    ('Nakagami', 'near-zero m, small omega', [0.5, 0.5],
     [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0],
     '// mpmath: 2*m^m/(Gamma(m)*omega^m)*x^(2m-1)*exp(-m*x^2/omega), Preg(m,m*x^2/omega)  (m=0.5,omega=0.5)'),

    ('NoncentralBeta', 'large lambda', [2, 2, 100],
     [0.9, 0.95, 0.99],
     '// mpmath dps=50: Poisson mixture of Beta(alpha+j,beta) for alpha=2,beta=2,lambda=100'),

    ('NoncentralBeta', 'asymmetric shapes', [0.5, 5, 10],
     [0.3, 0.5, 0.7],
     '// mpmath dps=50: Poisson mixture of Beta(alpha+j,beta) for alpha=0.5,beta=5,lambda=10'),

    ('NoncentralBeta', 'alpha=0.1 lower-tail and mid-range', [0.1, 2, 10],
     [1e-4, 1e-3, 0.01, 0.05, 0.5, 0.9],
     '// mpmath dps=50: Poisson mixture of Beta(alpha+j,beta) for alpha=0.1,beta=2,lambda=10'),

    ('NoncentralChi', 'small df and lambda', [2, 0.5],
     [0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0],
     '// mpmath: x*exp(-0.5*(x^2+lam^2))*(x/lam)^(k/2-1)*I_{k/2-1}(lam*x), NcX2_CDF(x^2;k,lam^2)  (k=2,lam=0.5)'),

    ('NoncentralChi2', 'large lambda', [11, 200],
     [150, 180, 211, 240, 270],
     '// mpmath dps=50: Poisson mixture CDF/PDF for k=11, lambda=200'),

    ('NoncentralF', 'asymmetric df, small lambda', [2, 10, 0.5],
     [0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
     '// mpmath: NcBeta(d1/2,d2/2,lambda) transform; CDF(u) where u=d1*x/(d1*x+d2)  (d1=2,d2=10,lam=0.5)'),

    ('Normal', 'shifted location, small sigma', [3, 0.5],
     [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
     '// mpmath: exp(-0.5*((x-mu)/sigma)^2)/(sigma*sqrt(2pi)), Phi((x-mu)/sigma)  (mu=3,sigma=0.5)'),
]


def fmt_entry(x_val, pdf_val, cdf_val):
    return f'      {{ x: {num(x_val)}, pdf: {num(pdf_val)}, cdf: {num(cdf_val)} }}'


def main():
    for (name, case_name, params, xs, comment) in CASES:
        print(f'\n// {name} — {case_name}  params={params}')
        print(f'    {comment}')
        print('    refVals: [')
        for x in xs:
            try:
                pv = pdf(name, params, x)
                cv = cdf(name, params, x)
                print(fmt_entry(x, pv, cv) + ',')
            except Exception as ex:
                print(f'      // ERROR at x={x}: {ex}')
        print('    ]')


if __name__ == '__main__':
    main()
