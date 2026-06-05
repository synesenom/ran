"""
Compute externally-sourced reference values for the secondary `cases` entries
in test/dist-cases-continuous.js for distributions Pareto → Wigner (issue #560).

All values computed with mpmath at mp.dps = 50, using the same formulas as
scripts/precision-refs-continuous.py.  Output is printed as JS literals ready
to paste into the cases entries.

Usage:
    python3 scripts/gen-cases-refs-O-W.py
"""

from mpmath import (mp, mpf, pi, sqrt, exp, log, expm1, log1p, cosh, tanh,
                    atan, asin, asinh, acos, sin, cos, gamma as gammafn,
                    loggamma, beta as betafn, erf, erfc, besseli, power,
                    fsum, factorial, zeta, quad, inf, fabs, sign, nsum,
                    gammainc, betainc)

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
    if x <= 0:
        return mpf(0)
    return gammainc(s, 0, x, regularized=True)


def Ireg(a, b, x):
    x = mpf(x)
    if x <= 0:
        return mpf(0)
    if x >= 1:
        return mpf(1)
    return betainc(a, b, 0, x, regularized=True)


def ig_pdf(mu, lam, x):
    """Inverse-Gaussian pdf."""
    mu, lam, x = mpf(mu), mpf(lam), mpf(x)
    return sqrt(lam / (2 * pi * x ** 3)) * exp(-lam * (x - mu) ** 2 / (2 * mu ** 2 * x))


def ig_cdf(mu, lam, x):
    """Inverse-Gaussian CDF."""
    mu, lam, x = mpf(mu), mpf(lam), mpf(x)
    sq = sqrt(lam / x)
    return Phi(sq * (x / mu - 1)) + exp(2 * lam / mu) * Phi(-sq * (x / mu + 1))


# ── pdf and cdf functions (same as precision-refs-continuous.py) ──────────────

def pdf(name, p, x):
    x = mpf(x)
    if name == 'Pareto':
        xmin, alpha = mpf(p[0]), mpf(p[1])
        return alpha * power(xmin / x, alpha) / x
    if name == 'PERT':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        alpha = (4 * b + c - 5 * a) / (c - a)
        beta  = (5 * c - a - 4 * b) / (c - a)
        return pdf('Beta', [alpha, beta], (x - a) / (c - a)) / (c - a)
    if name == 'Beta':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return power(x, alpha - 1) * power(1 - x, beta - 1) / betafn(alpha, beta)
    if name == 'PowerLaw':
        a = mpf(p[0])
        return a * power(x, a - 1)
    if name == 'QExponential':
        q, lam = mpf(p[0]), mpf(p[1])
        return pdf('GeneralizedPareto', [0, 1 / (lam * (2 - q)), (q - 1) / (2 - q)], x)
    if name == 'GeneralizedPareto':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if xi == 0:
            return exp(-(x - mu) / sigma) / sigma
        z = (x - mu) / sigma
        return power(1 + xi * z, -(1 / xi + 1)) / sigma
    if name == 'R':
        c = mpf(p[0])
        return HALF * pdf('Beta', [c / 2, c / 2], (x + 1) / 2)
    if name == 'RaisedCosine':
        mu, s = mpf(p[0]), mpf(p[1])
        return HALF * (1 + cos(pi * (x - mu) / s)) / s
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        t = x / lam
        return k / lam * power(t, k - 1) * exp(-power(t, k))
    if name == 'Rayleigh':
        sigma = mpf(p[0])
        return pdf('Weibull', [sigma * SQRT2, 2], x)
    if name == 'Reciprocal':
        a, b = mpf(p[0]), mpf(p[1])
        return 1 / (x * (log(b) - log(a)))
    if name == 'ReciprocalInverseGaussian':
        mu, lam = mpf(p[0]), mpf(p[1])
        return ig_pdf(mu, lam, 1 / x) / (x * x)
    if name == 'Rice':
        nu, sigma = mpf(p[0]), mpf(p[1])
        return x * exp(-HALF * (x * x + nu * nu) / (sigma * sigma)) * besseli(0, x * nu / (sigma * sigma)) / (sigma * sigma)
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
    if name == 'Normal':
        mu, sigma = mpf(p[0]), mpf(p[1])
        return exp(-HALF * ((x - mu) / sigma) ** 2) / (sigma * SQRT2PI)
    if name == 'UQuadratic':
        a, b = mpf(p[0]), mpf(p[1])
        alpha = 12 / power(b - a, 3)
        beta  = (a + b) / 2
        return alpha * power(x - beta, 2)
    if name == 'Uniform':
        a, b = mpf(p[0]), mpf(p[1])
        return 1 / (b - a)
    if name == 'UniformProduct':
        n = int(round(p[0]))
        return power(-log(x), n - 1) / gammafn(n)
    if name == 'VonMises':
        kappa = mpf(p[0])
        return exp(kappa * cos(x)) / (2 * pi * besseli(0, kappa))
    if name == 'Wigner':
        R = mpf(p[0])
        return 2 * sqrt(R * R - x * x) / (pi * R * R)
    raise ValueError('pdf: ' + name)


def cdf(name, p, x):
    x = mpf(x)
    if name == 'Pareto':
        xmin, alpha = mpf(p[0]), mpf(p[1])
        return 1 - power(xmin / x, alpha)
    if name == 'PERT':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        alpha = (4 * b + c - 5 * a) / (c - a)
        beta  = (5 * c - a - 4 * b) / (c - a)
        return cdf('Beta', [alpha, beta], (x - a) / (c - a))
    if name == 'Beta':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Ireg(alpha, beta, x)
    if name == 'PowerLaw':
        a = mpf(p[0])
        return power(x, a)
    if name == 'QExponential':
        q, lam = mpf(p[0]), mpf(p[1])
        return cdf('GeneralizedPareto', [0, 1 / (lam * (2 - q)), (q - 1) / (2 - q)], x)
    if name == 'GeneralizedPareto':
        mu, sigma, xi = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if xi == 0:
            return -expm1(-(x - mu) / sigma)
        z = (x - mu) / sigma
        return 1 - power(1 + xi * z, -1 / xi)
    if name == 'R':
        c = mpf(p[0])
        return cdf('Beta', [c / 2, c / 2], (x + 1) / 2)
    if name == 'Beta':
        alpha, beta = mpf(p[0]), mpf(p[1])
        return Ireg(alpha, beta, x)
    if name == 'RaisedCosine':
        mu, s = mpf(p[0]), mpf(p[1])
        z = (x - mu) / s
        return HALF * (1 + z + sin(pi * z) / pi)
    if name == 'Weibull':
        lam, k = mpf(p[0]), mpf(p[1])
        return -expm1(-power(x / lam, k))
    if name == 'Rayleigh':
        sigma = mpf(p[0])
        return cdf('Weibull', [sigma * SQRT2, 2], x)
    if name == 'Reciprocal':
        a, b = mpf(p[0]), mpf(p[1])
        return (log(x) - log(a)) / (log(b) - log(a))
    if name == 'ReciprocalInverseGaussian':
        mu, lam = mpf(p[0]), mpf(p[1])
        return 1 - ig_cdf(mu, lam, 1 / x)
    if name == 'Rice':
        nu, sigma = mpf(p[0]), mpf(p[1])
        # CDF via quadrature (Marcum-Q)
        return quad(lambda t: pdf('Rice', p, t), [0, x])
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
        if x < a:
            return mpf(0)
        if x < b:
            return power(x - a, 2) / ((b - a) * scale)
        if x < c:
            return (2 * x - a - b) / scale
        if x < d:
            return 1 - power(d - x, 2) / ((d - c) * scale)
        return mpf(1)
    if name == 'Triangular':
        a, b, c = mpf(p[0]), mpf(p[1]), mpf(p[2])
        if x < a:
            return mpf(0)
        if x < c:
            return power(x - a, 2) / ((b - a) * (c - a))
        if x < b:
            return 1 - power(b - x, 2) / ((b - a) * (b - c))
        return mpf(1)
    if name == 'TruncatedNormal':
        mu, sigma, a, b = mpf(p[0]), mpf(p[1]), mpf(p[2]), mpf(p[3])
        Z = Phi((b - mu) / sigma) - Phi((a - mu) / sigma)
        return (Phi((x - mu) / sigma) - Phi((a - mu) / sigma)) / Z
    if name == 'UQuadratic':
        a, b = mpf(p[0]), mpf(p[1])
        alpha = 12 / power(b - a, 3)
        beta  = (a + b) / 2
        return alpha * (power(x - beta, 3) - power(a - beta, 3)) / 3
    if name == 'Uniform':
        a, b = mpf(p[0]), mpf(p[1])
        return (x - a) / (b - a)
    if name == 'UniformProduct':
        n = int(round(p[0]))
        return 1 - Preg(n, -log(x))
    if name == 'VonMises':
        kappa = mpf(p[0])
        return quad(lambda t: pdf('VonMises', p, t), [-pi, x])
    if name == 'Wigner':
        R = mpf(p[0])
        z = x / R
        return HALF + (z * sqrt(1 - z * z) + asin(z)) / pi
    raise ValueError('cdf: ' + name)


def num(x):
    """Float64 shortest-round-trip decimal repr."""
    return repr(float(x))


# ── Cases to update: (dist_name, case_name, params, x_values) ─────────────────

CASES = [
    ('Pareto', 'near-zero alpha, unit xm', [1, 0.5],
     [1.01, 1.1, 1.5, 2.0, 5.0, 15.0, 50.0],
     '// mpmath: alpha*(xm/x)^alpha/x, 1-(xm/x)^alpha  (xm=1, alpha=0.5)'),

    ('PERT', 'unit interval, symmetric center', [0, 0.5, 1],
     [0.05, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95],
     '// mpmath: Beta(alpha,beta) reparameterised (a=0,b=0.5,c=1 -> alpha=3,beta=3)'),

    ('PowerLaw', 'near-zero a', [0.5],
     [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.95],
     '// mpmath: a*x^(a-1), x^a  (a=0.5)'),

    ('QExponential', 'positive q, small lambda', [0.5, 0.5],
     [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
     '// mpmath: GeneralizedPareto(0, 1/(lambda*(2-q)), (q-1)/(2-q))  (q=0.5, lambda=0.5)'),

    ('R', 'near-zero c (U-shaped)', [0.5],
     [-0.9, -0.5, -0.2, 0, 0.2, 0.5, 0.9],
     '// mpmath: Beta(c/2,c/2) reparameterised on [-1,1]  (c=0.5)'),

    ('RaisedCosine', 'shifted location, small scale', [3, 0.5],
     [2.55, 2.65, 2.8, 3.0, 3.2, 3.35, 3.45],
     '// mpmath: (1+cos(pi*(x-mu)/s))/(2s), (1+z+sin(pi*z)/pi)/2 where z=(x-mu)/s  (mu=3,s=0.5)'),

    ('Rayleigh', 'small sigma', [0.5],
     [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0],
     '// mpmath: Weibull(sigma*sqrt(2), 2)  (sigma=0.5)'),

    ('Reciprocal', 'smaller range', [1, 10],
     [1.05, 1.5, 2.0, 3.0, 5.0, 7.0, 9.5],
     '// mpmath: 1/(x*log(b/a)), log(x/a)/log(b/a)  (a=1, b=10)'),

    ('ReciprocalInverseGaussian', 'small mu, large lambda', [0.5, 4],
     [0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0],
     '// mpmath: ig_pdf(mu,lam,1/x)/x^2, 1-IG_CDF(mu,lam,1/x)  (mu=0.5, lambda=4)'),

    ('Rice', 'small nu, large sigma', [0.5, 2],
     [0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 10.0],
     '// mpmath: x*exp(-(x^2+nu^2)/(2s^2))*besseli(0,x*nu/s^2)/s^2, quadrature CDF  (nu=0.5, sigma=2)'),

    ('StudentT', 'near-zero nu (heavy tail)', [0.5],
     [-5.0, -2.0, -1.0, 0, 1.0, 2.0, 5.0],
     '// mpmath: (1+x^2/nu)^(-(nu+1)/2)/(sqrt(nu)*B(1/2,nu/2)), I_reg CDF  (nu=0.5)'),

    ('StudentZ', 'small df', [2],
     [-3.0, -1.0, -0.5, 0, 0.5, 1.0, 3.0],
     '// mpmath: StudentT(nu=n-1=1) reparameterised: f(x;n)=f_t(x*sqrt(n-1))*sqrt(n-1)  (n=2)'),

    ('Trapezoidal', 'unit interval, asymmetric plateau', [0, 0.3, 0.7, 1],
     [0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95],
     '// mpmath: piecewise linear PDF/CDF  (a=0,b=0.3,c=0.7,d=1)'),

    ('Triangular', 'unit interval, left-skewed mode', [0, 1, 0.1],
     [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95],
     '// mpmath: piecewise linear PDF/CDF  (a=0,b=1,c=0.1)'),

    ('TruncatedNormal', 'standard normal, symmetric truncation', [0, 1, -2, 2],
     [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5],
     '// mpmath: phi(x)/Z, (Phi(x)-Phi(a))/Z where Z=Phi(b)-Phi(a)  (mu=0,sigma=1,a=-2,b=2)'),

    ('UQuadratic', 'unit interval', [0, 1],
     [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98],
     '// mpmath: 12/(b-a)^3 * (x-beta)^2, alpha*((x-beta)^3-(-0.5)^3)/3  (a=0,b=1)'),

    ('Uniform', 'unit interval', [0, 1],
     [0.1, 0.25, 0.5, 0.75, 0.9],
     '// mpmath: 1/(b-a), (x-a)/(b-a)  (a=0, b=1)'),

    ('UniformProduct', 'small n', [2],
     [0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.98],
     '// mpmath: (-ln x)^(n-1)/Gamma(n), 1-P(n,-ln x)  (n=2)'),

    ('VonMises', 'near-zero kappa (near-uniform)', [0.5],
     [-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0],
     '// mpmath: exp(kappa*cos(x))/(2*pi*I_0(kappa)), quadrature CDF  (kappa=0.5)'),

    ('Weibull', 'near-zero shapes', [0.5, 0.5],
     [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 3.0],
     '// mpmath: k/lam*(x/lam)^(k-1)*exp(-(x/lam)^k), 1-exp(-(x/lam)^k)  (lambda=0.5, k=0.5)'),

    ('Wigner', 'small R', [0.5],
     [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45],
     '// mpmath: 2*sqrt(R^2-x^2)/(pi*R^2), 1/2+(x*sqrt(1-z^2)+arcsin(z))/pi  (R=0.5)'),
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
            except Exception as e:
                print(f'      // ERROR at x={x}: {e}')
        print('    ]')


if __name__ == '__main__':
    main()
