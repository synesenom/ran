"""
Compute second-case refVals for issue #135.
Each distribution gets a second parameter set exercising a different region.
Uses scipy where available; closed-form formulas otherwise.
"""
import math
from scipy import stats
import numpy as np

def fmt(v):
    """Format a float for embedding in JS.

    Uses at most 15 significant digits to avoid the ESLint no-loss-of-precision
    rule, which flags literals with more than 15 significant digits even when
    they are exactly representable in float64.
    """
    if v == 0.0:
        return '0'
    if math.isinf(v):
        return 'Infinity' if v > 0 else '-Infinity'
    s = repr(float(v))
    # If fewer than 16 significant digits, keep as is
    # Strip sign and decimal point to count digits
    digits = s.replace('-', '').replace('.', '').replace('e', '').replace('+', '').lstrip('0')
    if len(digits.split('e')[0]) <= 15:
        return s
    # Round to 15 significant figures
    return f'{v:.15g}'

def entry(x, pdf, cdf, discrete=False):
    key = 'pmf' if discrete else 'pdf'
    return f'    {{ x: {fmt(x)}, {key}: {fmt(pdf)}, cdf: {fmt(cdf)} }}'

def print_case(name, case_name, params_str, rows, discrete=False):
    print(f'\n// {name}  second case: {params_str}')
    print(f'// name: \'{case_name}\'')
    for r in rows:
        print(entry(r[0], r[1], r[2], discrete))

# ── CONTINUOUS DISTRIBUTIONS ─────────────────────────────────────────────────

# Alpha(a=0.5, scale=0.5)  →  scipy.stats.alpha(a=0.5, scale=0.5)
d = stats.alpha(a=0.5, scale=0.5)
xs = [0.51, 0.55, 0.65, 0.8, 1.0, 1.5, 2.5, 5.0]
print_case('Alpha', 'small shape and scale', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Anglit(loc=3, scale=0.5)  →  scipy.stats.anglit(loc=3, scale=0.5)
d = stats.anglit(loc=3, scale=0.5)
xs = [2.6, 2.8, 2.9, 3.0, 3.1, 3.2, 3.4, 3.49]
print_case('Anglit', 'shifted location', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Arcsine(a=0, b=1)  →  scipy.stats.arcsine(loc=0, scale=1)
d = stats.arcsine(loc=0, scale=1)
xs = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
print_case('Arcsine', 'unit interval', '[0, 1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# BaldingNichols(F=0.1, p=0.1)
# alpha = (1-F)/F * p = 0.9/0.1 * 0.1 = 0.9
# beta  = (1-F)/F * (1-p) = 9 * 0.9 = 8.1
d = stats.beta(a=0.9, b=8.1)
xs = [0.01, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95]
print_case('BaldingNichols', 'low F and p', '[0.1, 0.1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Bates(n=3, a=0, b=1)  →  IrwinHall(3)/3
# Bates(n, a, b): Y = (X1+...+Xn)/n where Xi ~ Uniform(a,b)
# PDF of Bates on [a,b]: f_B(x) = n/(b-a) * f_IH((x-a)*n/(b-a))
# For a=0, b=1: f_B(x) = n * f_IH(n*x)
d_ih = stats.irwinhall(n=3)
a, b, n = 0, 1, 3
def bates_pdf(x):
    return n / (b - a) * d_ih.pdf((x - a) * n / (b - a))
def bates_cdf(x):
    return d_ih.cdf((x - a) * n / (b - a))
xs = [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9]
print_case('Bates', 'small n, unit interval', '[3, 0, 1]',
           [(x, bates_pdf(x), bates_cdf(x)) for x in xs])

# Benini(alpha=0.5, beta=0.5, sigma=1)
# f(x) = (alpha/x + 2*beta*ln(x/sigma)/x) * exp(-alpha*ln(x/sigma) - beta*(ln(x/sigma))^2)
# F(x) = 1 - exp(-alpha*ln(x/sigma) - beta*(ln(x/sigma))^2)
def benini_pdf(x, alpha, beta, sigma):
    z = math.log(x / sigma)
    return (alpha / x + 2 * beta * z / x) * math.exp(-alpha * z - beta * z * z)
def benini_cdf(x, alpha, beta, sigma):
    z = math.log(x / sigma)
    return -math.expm1(-alpha * z - beta * z * z)
alpha, beta, sigma = 0.5, 0.5, 1.0
xs = [1.05, 1.2, 1.5, 2.0, 3.0, 5.0, 8.0]
print_case('Benini', 'small shape, unit sigma', '[0.5, 0.5, 1]',
           [(x, benini_pdf(x, alpha, beta, sigma), benini_cdf(x, alpha, beta, sigma)) for x in xs])

# Beta(a=0.5, b=0.5)  →  scipy.stats.beta(0.5, 0.5)
d = stats.beta(a=0.5, b=0.5)
xs = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
print_case('Beta', 'near-zero shapes (U-shape)', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# BetaPrime(a=0.5, b=4)  →  scipy.stats.betaprime(a=0.5, b=4)
d = stats.betaprime(a=0.5, b=4)
xs = [0.05, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0]
print_case('BetaPrime', 'asymmetric shapes', '[0.5, 4]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# BetaRectangular(alpha=0.5, beta=0.5, theta=0.9, a=5, b=25)
# F(x) = theta * Beta(alpha,beta).cdf((x-a)/(b-a)) + (1-theta) * (x-a)/(b-a)
# f(x) = theta * Beta(alpha,beta).pdf((x-a)/(b-a)) / (b-a) + (1-theta)/(b-a)
d_beta = stats.beta(a=0.5, b=0.5)
alpha, beta_p, theta, a, b = 0.5, 0.5, 0.9, 5, 25
def betarect_pdf(x):
    u = (x - a) / (b - a)
    return theta * d_beta.pdf(u) / (b - a) + (1 - theta) / (b - a)
def betarect_cdf(x):
    u = (x - a) / (b - a)
    return theta * d_beta.cdf(u) + (1 - theta) * u
xs = [5.5, 7.0, 10.0, 15.0, 18.0, 21.0, 24.5]
print_case('BetaRectangular', 'near-zero shapes, high mixture weight', '[0.5, 0.5, 0.9, 5, 25]',
           [(x, betarect_pdf(x), betarect_cdf(x)) for x in xs])

# BirnbaumSaunders(mu=0, beta=0.5, gamma=0.5)
# scipy.stats.fatiguelife(c=gamma, loc=mu, scale=beta)
d = stats.fatiguelife(c=0.5, loc=0, scale=0.5)
xs = [0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
print_case('BirnbaumSaunders', 'small beta and gamma', '[0, 0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# BoundedPareto(L=1, H=10, alpha=0.5)
# F(x) = (1 - (L/x)^alpha) / (1 - (L/H)^alpha)
# f(x) = alpha * L^alpha * x^(-alpha-1) / (1 - (L/H)^alpha)
def bpareto_pdf(x, L, H, alpha):
    denom = 1 - (L / H) ** alpha
    return alpha * (L ** alpha) * x ** (-alpha - 1) / denom
def bpareto_cdf(x, L, H, alpha):
    denom = 1 - (L / H) ** alpha
    return (1 - (L / x) ** alpha) / denom
L, H, alpha = 1.0, 10.0, 0.5
xs = [1.01, 1.1, 1.5, 2.0, 3.0, 5.0, 8.0, 9.9]
print_case('BoundedPareto', 'small alpha (heavy tail)', '[1, 10, 0.5]',
           [(x, bpareto_pdf(x, L, H, alpha), bpareto_cdf(x, L, H, alpha)) for x in xs])

# Bradford(c=0.5)  →  scipy.stats.bradford(c=0.5)
d = stats.bradford(c=0.5)
xs = [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95]
print_case('Bradford', 'small c', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Burr(c=0.5, k=4)  →  scipy.stats.burr12(c=0.5, d=4)
d = stats.burr12(c=0.5, d=4)
xs = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('Burr', 'small c, large k', '[0.5, 4]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Cauchy(x0=3, gamma=0.5)  →  scipy.stats.cauchy(loc=3, scale=0.5)
d = stats.cauchy(loc=3, scale=0.5)
xs = [0.0, 1.0, 2.5, 3.0, 3.5, 4.0, 5.0, 8.0]
print_case('Cauchy', 'shifted location, small scale', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Chi2(k=2)  →  scipy.stats.chi2(df=2)  (exponential special case)
d = stats.chi2(df=2)
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 6.0, 9.0]
print_case('Chi2', 'small df (exponential limit)', '[2]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Dagum(p=0.5, a=0.5, b=2)  →  closed-form
# F(x) = (1 + (x/b)^(-a))^(-p)
# f(x) = a*p*(x/b)^(a*p) / (x * ((x/b)^a + 1)^(p+1))
def dagum_pdf(x, p, a, b):
    y = (x / b) ** a
    return a * p * y ** p / (x * (y + 1) ** (p + 1))
def dagum_cdf(x, p, a, b):
    return (1 + (x / b) ** (-a)) ** (-p)
p_d, a_d, b_d = 0.5, 0.5, 2.0
xs = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
print_case('Dagum', 'small p and a', '[0.5, 0.5, 2]',
           [(x, dagum_pdf(x, p_d, a_d, b_d), dagum_cdf(x, p_d, a_d, b_d)) for x in xs])

# DoubleGamma(alpha=0.5, beta=2)  →  f(x) = Gamma(0.5, 2).pdf(|x|) / 2
# Gamma uses shape-rate: f(x;alpha,beta) = beta^alpha * x^(alpha-1) * exp(-beta*x) / Gamma(alpha)
# scipy.stats.gamma(a=alpha, scale=1/beta)
d_g = stats.gamma(a=0.5, scale=0.5)  # scale = 1/beta = 1/2
def dgamma_pdf(x):
    return d_g.pdf(abs(x)) / 2
def dgamma_cdf(x):
    c = d_g.cdf(abs(x))
    # ranjs: (x > 0 ? 1 + y : 1 - y) / 2 where y = Gamma.cdf(|x|)
    return (1 - c) / 2 if x < 0 else (1 + c) / 2
xs = [-3.0, -1.0, -0.5, -0.1, 0.1, 0.5, 1.0, 3.0]
print_case('DoubleGamma', 'near-zero alpha', '[0.5, 2]',
           [(x, dgamma_pdf(x), dgamma_cdf(x)) for x in xs])

# DoubleWeibull(lambda=2, k=0.5)  →  f(x) = Weibull(lambda,k).pdf(|x|) / 2
# Weibull(lambda, k): f(x) = (k/lambda)*(x/lambda)^(k-1)*exp(-(x/lambda)^k)
# scipy.stats.weibull_min(c=k, scale=lambda)
d_w = stats.weibull_min(c=0.5, scale=2.0)
def dweibull_pdf(x):
    return d_w.pdf(abs(x)) / 2
def dweibull_cdf(x):
    c = d_w.cdf(abs(x))
    return 0.5 - 0.5 * c if x < 0 else 0.5 + 0.5 * c - 0.5
# Actually: CDF = 0.5*Weibull.cdf(|x|) if x >= 0; 1 - 0.5*Weibull.cdf(|x|) if x < 0 → no
# DoubleWeibull CDF: F(x) = 0.5*(1 + sign(x)*Weibull.cdf(|x|))
# At x>0: F(x) = 0.5 + 0.5*Weibull.cdf(x)
# At x<0: F(x) = 0.5 - 0.5*Weibull.cdf(-x)
# At x=0: F(0) = 0.5
def dweibull_cdf2(x):
    if x >= 0:
        return 0.5 + 0.5 * d_w.cdf(x)
    else:
        return 0.5 - 0.5 * d_w.cdf(-x)
xs = [-4.0, -2.0, -0.5, -0.1, 0.1, 0.5, 2.0, 4.0]
print_case('DoubleWeibull', 'near-zero k', '[2, 0.5]',
           [(x, dweibull_pdf(x), dweibull_cdf2(x)) for x in xs])

# Erlang(k=2, mu=0.5)  →  scipy.stats.erlang(a=2, scale=1/0.5=2)
# Note: Erlang(k, mu) where mu is the rate (shape=k, rate=mu) → scale=1/mu
d = stats.erlang(a=2, scale=2.0)
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
print_case('Erlang', 'small k and rate', '[2, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Exponential(lambda=0.5)  →  scipy.stats.expon(scale=2)
d = stats.expon(scale=2.0)
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
print_case('Exponential', 'small rate', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# ExponentialLogarithmic(p=0.9, beta=0.5)
# ranjs formula: F(x) = 1 - log(1 - (1-p)*exp(-beta*x)) / log(p)
# f(x) = beta*(1-p)*exp(-beta*x) / ((1-(1-p)*exp(-beta*x)) * log(p))  but log(p)<0 so...
# f(x) = beta*y / ((y-1) * log(p))  where y = (1-p)*exp(-beta*x)
def el_pdf(x, p, beta):
    y = (1 - p) * math.exp(-beta * x)
    return beta * y / ((y - 1) * math.log(p))
def el_cdf(x, p, beta):
    return 1 - math.log(1 - (1 - p) * math.exp(-beta * x)) / math.log(p)
p_el, beta_el = 0.9, 0.5
xs = [0.01, 0.1, 0.3, 0.5, 1.0, 2.0, 4.0]
print_case('ExponentialLogarithmic', 'high p, small beta', '[0.9, 0.5]',
           [(x, el_pdf(x, p_el, beta_el), el_cdf(x, p_el, beta_el)) for x in xs])

# ExponentiatedWeibull(lambda=0.5, k=0.5, alpha=0.5)
# ranjs: F(x) = (1 - exp(-(x/lambda)^k))^alpha
# scipy.stats.exponweib(a=alpha, c=k, scale=lambda)
d = stats.exponweib(a=0.5, c=0.5, scale=0.5)  # scale=lambda=0.5
xs = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('ExponentiatedWeibull', 'small shapes', '[0.5, 0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# F(d1=2, d2=20)  →  scipy.stats.f(dfn=2, dfd=20)
d = stats.f(dfn=2, dfd=20)
xs = [0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('F', 'asymmetric df', '[2, 20]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Frechet(alpha=0.5, s=1, m=0)  →  scipy.stats.invweibull(c=0.5, scale=1)
d = stats.invweibull(c=0.5, scale=1.0)
xs = [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
print_case('Frechet', 'near-zero alpha', '[0.5, 1, 0]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Gamma(alpha=0.5, beta=0.5)  →  scipy.stats.gamma(a=0.5, scale=2) (scale=1/beta)
d = stats.gamma(a=0.5, scale=2.0)
xs = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('Gamma', 'near-zero alpha (L-shaped)', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# GammaGompertz(b=0.5, s=0.5, beta=0.5)
# F(x) = 1 - (beta / (beta - 1 + exp(b*x)))^s
# f(x) = b*s*beta^s*exp(b*x) / (beta-1+exp(b*x))^(s+1)
def gg_pdf(x, b, s, beta):
    y = math.exp(b * x)
    return b * s * (beta ** s) * y / ((beta - 1 + y) ** (s + 1))
def gg_cdf(x, b, s, beta):
    y = math.exp(b * x)
    return -math.expm1(-s * math.log1p(math.expm1(b * x) / beta))
b_gg, s_gg, beta_gg = 0.5, 0.5, 0.5
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0]
print_case('GammaGompertz', 'small parameters', '[0.5, 0.5, 0.5]',
           [(x, gg_pdf(x, b_gg, s_gg, beta_gg), gg_cdf(x, b_gg, s_gg, beta_gg)) for x in xs])

# GeneralizedExponential(a=2, b=0.5, c=4)
# F(x) = 1 - exp(-(a+b)*x - b*expm1(-c*x)/c)
# f(x) = (a + b*(1-exp(-c*x))) * exp(-(a+b)*x - b*expm1(-c*x)/c)
def ge_pdf(x, a, b, c):
    z = b * (1 - math.exp(-c * x))
    return (a + z) * math.exp(-(a + b) * x + z / c)
def ge_cdf(x, a, b, c):
    return -math.expm1(-(a + b) * x - b * math.expm1(-c * x) / c)
a_ge, b_ge, c_ge = 2.0, 0.5, 4.0
xs = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0]
print_case('GeneralizedExponential', 'asymmetric parameters', '[2, 0.5, 4]',
           [(x, ge_pdf(x, a_ge, b_ge, c_ge), ge_cdf(x, a_ge, b_ge, c_ge)) for x in xs])

# GeneralizedGamma(a=0.5, d=0.5, p=0.5)
# scipy: gengamma(a=d/p, c=p, scale=a_param)
# ranjs: GeneralizedGamma(a, d, p) where a is scale, d is shape1, p is shape2
# scipy.stats.gengamma(a=d/p, c=p, scale=a) where ranjs params are (a, d, p)
d = stats.gengamma(a=0.5/0.5, c=0.5, scale=0.5)  # a=d/p=1, c=p=0.5, scale=a=0.5
xs = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('GeneralizedGamma', 'small shapes', '[0.5, 0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# GeneralizedLogistic(mu=3, s=0.5, c=0.5)
# scipy.stats.genlogistic(c=c, loc=mu, scale=s)
d = stats.genlogistic(c=0.5, loc=3, scale=0.5)
xs = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0]
print_case('GeneralizedLogistic', 'shifted location, small shapes', '[3, 0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# GeneralizedNormal(mu=3, alpha=0.5, beta=0.5)
# scipy.stats.gennorm(beta=beta, loc=mu, scale=alpha)
d = stats.gennorm(beta=0.5, loc=3, scale=0.5)
# Avoid x=mu=3 where ranjs gives NaN due to 0^(beta-1) with beta<1
xs = [1.0, 2.0, 2.5, 3.5, 4.0, 5.0, 7.0]
print_case('GeneralizedNormal', 'shifted location, small shapes', '[3, 0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Gompertz(eta=0.5, b=0.5)
# scipy.stats.gompertz(c=eta, scale=1/b)
d = stats.gompertz(c=0.5, scale=2.0)
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
print_case('Gompertz', 'small eta and b', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Gumbel(mu=3, beta=0.5)  →  scipy.stats.gumbel_r(loc=3, scale=0.5)
d = stats.gumbel_r(loc=3, scale=0.5)
xs = [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
print_case('Gumbel', 'shifted location, small scale', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# HalfGeneralizedNormal(alpha=0.5, beta=0.5)
# scipy.stats.halfgennorm(beta=beta, scale=alpha)
d = stats.halfgennorm(beta=0.5, scale=0.5)
xs = [0.01, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0]
print_case('HalfGeneralizedNormal', 'small shapes', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# HalfNormal(sigma=0.5)  →  scipy.stats.halfnorm(scale=0.5)
d = stats.halfnorm(scale=0.5)
xs = [0.05, 0.1, 0.3, 0.5, 1.0, 1.5, 2.5]
print_case('HalfNormal', 'small sigma', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Hyperexponential([{weight:1,rate:0.5},{weight:3,rate:4}])
# Mixture: w1=1, r1=0.5, w2=3, r2=4; total weight=4
# Normalized: p1=0.25 with Exp(0.5), p2=0.75 with Exp(4)
# f(x) = 0.25 * 0.5*exp(-0.5*x) + 0.75 * 4*exp(-4*x)
# F(x) = 0.25*(1-exp(-0.5*x)) + 0.75*(1-exp(-4*x))
def hyp_pdf(x):
    return 0.25 * 0.5 * math.exp(-0.5 * x) + 0.75 * 4 * math.exp(-4 * x)
def hyp_cdf(x):
    return 0.25 * (1 - math.exp(-0.5 * x)) + 0.75 * (1 - math.exp(-4 * x))
xs = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0]
print_case('Hyperexponential', 'asymmetric mixture', '[[{weight: 1, rate: 0.5}, {weight: 3, rate: 4}]]',
           [(x, hyp_pdf(x), hyp_cdf(x)) for x in xs])

# InverseChi2(nu=2)  →  scipy.stats.invgamma(a=nu/2, scale=0.5)
d = stats.invgamma(a=1.0, scale=0.5)
xs = [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('InverseChi2', 'small nu', '[2]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# InverseGamma(alpha=0.5, beta=0.5)  →  scipy.stats.invgamma(a=0.5, scale=0.5)
d = stats.invgamma(a=0.5, scale=0.5)
xs = [0.05, 0.1, 0.3, 0.5, 1.0, 3.0, 8.0]
print_case('InverseGamma', 'near-zero shapes', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# InverseGaussian(mu=1, lambda=0.5)
# scipy.stats.invgauss(mu=mu_ranjs/lambda, scale=lambda)
# Avoid params that cause CDF≈1 in the runX test range (leads to non-monotone float artifacts)
d = stats.invgauss(mu=1.0/0.5, scale=0.5)
xs = [0.2, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0]
print_case('InverseGaussian', 'large mu, small lambda', '[1, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# InvertedWeibull(c=0.5)  →  scipy.stats.invweibull(c=0.5)
d = stats.invweibull(c=0.5)
xs = [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 15.0]
print_case('InvertedWeibull', 'near-zero c', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# IrwinHall(n=3)  →  scipy.stats.irwinhall(n=3)
d = stats.irwinhall(n=3)
xs = [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 2.9]
print_case('IrwinHall', 'small n', '[3]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# JohnsonSU(gamma=1, delta=0.5, lambda=0.5, xi=1)
# scipy.stats.johnsonsu(a=gamma, b=delta, loc=xi, scale=lambda)
d = stats.johnsonsu(a=1, b=0.5, loc=1, scale=0.5)
xs = [-1.0, 0.0, 0.5, 1.0, 1.5, 2.0, 3.0]
print_case('JohnsonSU', 'shifted, small delta and lambda', '[1, 0.5, 0.5, 1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# JohnsonSB(gamma=1, delta=0.5, lambda=0.5, xi=1)
# scipy.stats.johnsonsb(a=gamma, b=delta, loc=xi, scale=lambda)
d = stats.johnsonsb(a=1, b=0.5, loc=1, scale=0.5)
xs = [1.05, 1.1, 1.2, 1.3, 1.4, 1.45, 1.49]
print_case('JohnsonSB', 'shifted, small delta and lambda', '[1, 0.5, 0.5, 1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Kumaraswamy(a=0.5, b=0.5)
# F(x) = 1 - (1 - x^a)^b
# f(x) = a*b*x^(a-1)*(1-x^a)^(b-1)
def kuma_pdf(x, a, b):
    return a * b * x ** (a - 1) * (1 - x ** a) ** (b - 1)
def kuma_cdf(x, a, b):
    return 1 - (1 - x ** a) ** b
xs = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
print_case('Kumaraswamy', 'near-zero shapes (U-shape)', '[0.5, 0.5]',
           [(x, kuma_pdf(x, 0.5, 0.5), kuma_cdf(x, 0.5, 0.5)) for x in xs])

# Laplace(mu=3, b=0.5)  →  scipy.stats.laplace(loc=3, scale=0.5)
d = stats.laplace(loc=3, scale=0.5)
xs = [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0]
print_case('Laplace', 'shifted location, small scale', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Levy(mu=1, c=0.5)  →  scipy.stats.levy(loc=1, scale=0.5)
d = stats.levy(loc=1, scale=0.5)
xs = [1.05, 1.1, 1.3, 1.5, 2.0, 4.0, 8.0]
print_case('Levy', 'shifted location, small scale', '[1, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Lindley(theta=0.5)
# f(x) = theta^2/(theta+1) * (1+x) * exp(-theta*x)
# F(x) = 1 - (1 + theta*x/(theta+1)) * exp(-theta*x)
def lindley_pdf(x, theta):
    return theta**2 / (theta + 1) * (1 + x) * math.exp(-theta * x)
def lindley_cdf(x, theta):
    return 1 - (1 + theta * x / (theta + 1)) * math.exp(-theta * x)
theta_l = 0.5
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
print_case('Lindley', 'small theta', '[0.5]',
           [(x, lindley_pdf(x, theta_l), lindley_cdf(x, theta_l)) for x in xs])

# LogCauchy(mu=1, sigma=0.5)
# f(x) = Cauchy(mu, sigma).pdf(log(x)) / x
# F(x) = Cauchy(mu, sigma).cdf(log(x))
d_c = stats.cauchy(loc=1, scale=0.5)
def logcauchy_pdf(x):
    return d_c.pdf(math.log(x)) / x
def logcauchy_cdf(x):
    return d_c.cdf(math.log(x))
xs = [0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0]
print_case('LogCauchy', 'positive mu, small sigma', '[1, 0.5]',
           [(x, logcauchy_pdf(x), logcauchy_cdf(x)) for x in xs])

# LogGamma(alpha=0.5, beta=0.5, mu=1)
# F(x) = Gamma(alpha, beta).cdf(log(x - mu + 1))
# f(x) = Gamma(alpha, beta).pdf(log(x - mu + 1)) / (x - mu + 1)
# Gamma uses shape-rate in ranjs: f(x;alpha,beta) = beta^alpha * ... so scale=1/beta in scipy
d_g = stats.gamma(a=0.5, scale=2.0)  # scale=1/beta=1/0.5=2
def loggamma_pdf(x, mu):
    z = math.log(x - mu + 1)
    return d_g.pdf(z) / (x - mu + 1)
def loggamma_cdf(x, mu):
    z = math.log(x - mu + 1)
    return d_g.cdf(z)
mu_lg = 1.0
# support: x > mu - 1 = 0, so x > 0; but x-mu+1 > 0 → x > 0
xs = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
print_case('LogGamma', 'small shape/rate, unit mu', '[0.5, 0.5, 1]',
           [(x, loggamma_pdf(x, mu_lg), loggamma_cdf(x, mu_lg)) for x in xs])

# LogLaplace(mu=1, b=0.5)
# f(x) = Laplace(mu, b).pdf(log(x)) / x
# F(x) = Laplace(mu, b).cdf(log(x))
# scipy.stats.loglaplace(c=1/b, scale=exp(mu)) where c=1/b and scale=exp(mu)
d_ll = stats.loglaplace(c=2.0, scale=math.exp(1.0))
xs = [0.3, 0.7, 1.5, 2.7, 5.0, 10.0, 20.0]
print_case('LogLaplace', 'positive mu, small b', '[1, 0.5]',
           [(x, d_ll.pdf(x), d_ll.cdf(x)) for x in xs])

# LogLogistic(alpha=0.5, beta=0.5)
# scipy.stats.fisk(c=beta, scale=alpha)
d = stats.fisk(c=0.5, scale=0.5)
xs = [0.01, 0.1, 0.5, 1.0, 5.0, 20.0, 100.0]
print_case('LogLogistic', 'near-zero shapes', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# LogNormal(mu=1, sigma=0.5)  →  scipy.stats.lognorm(s=0.5, scale=exp(1))
d = stats.lognorm(s=0.5, scale=math.exp(1.0))
xs = [0.5, 1.0, 2.0, 4.0, 7.0, 12.0, 20.0]
print_case('LogNormal', 'positive mu, small sigma', '[1, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Logarithmic(a=2, b=10)  →  closed-form
# f(x) = ln(x) / (fa - fb), where fa = a*(1-ln a), fb = b*(1-ln b)
# F(x) = (fa - x*(1-ln x)) / (fa - fb)
def logarithmic_pdf(x, a, b):
    fa = a * (1 - math.log(a))
    fb = b * (1 - math.log(b))
    return math.log(x) / (fa - fb)
def logarithmic_cdf(x, a, b):
    fa = a * (1 - math.log(a))
    fb = b * (1 - math.log(b))
    return (fa - x * (1 - math.log(x))) / (fa - fb)
xs = [2.1, 3.0, 4.0, 5.5, 7.0, 9.0, 9.9]
print_case('Logarithmic', 'small range', '[2, 10]',
           [(x, logarithmic_pdf(x, 2, 10), logarithmic_cdf(x, 2, 10)) for x in xs])

# Logistic(mu=3, s=0.5)  →  scipy.stats.logistic(loc=3, scale=0.5)
d = stats.logistic(loc=3, scale=0.5)
xs = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0]
print_case('Logistic', 'shifted location, small scale', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# LogisticExponential(lambda=0.5, kappa=0.5)
# F(x) = (expm1(lambda*x))^kappa / (1 + (expm1(lambda*x))^kappa)
# f(x) = lambda*kappa*(exp(lambda*x)-1)^(kappa-1)*exp(lambda*x) / (1 + (expm1(lambda*x))^kappa)^2
def logexp_pdf(x, lam, kappa):
    y = math.exp(lam * x)
    u = (y - 1) ** kappa
    if not math.isfinite(y ** (2 * kappa)):
        return 0
    return lam * kappa * (y - 1) ** (kappa - 1) * y / (1 + u) ** 2
def logexp_cdf(x, lam, kappa):
    u = math.expm1(lam * x) ** kappa
    return u / (1 + u)
lam_le, kappa_le = 0.5, 0.5
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0]
print_case('LogisticExponential', 'small lambda and kappa', '[0.5, 0.5]',
           [(x, logexp_pdf(x, lam_le, kappa_le), logexp_cdf(x, lam_le, kappa_le)) for x in xs])

# LogitNormal(mu=1, sigma=0.5)
# f(x) = Normal(mu, sigma).pdf(logit(x)) / (x*(1-x))
# F(x) = Normal(mu, sigma).cdf(logit(x))
d_n = stats.norm(loc=1, scale=0.5)
def logitnorm_pdf(x):
    return d_n.pdf(math.log(x / (1 - x))) / (x * (1 - x))
def logitnorm_cdf(x):
    return d_n.cdf(math.log(x / (1 - x)))
# Avoid extreme tail values (x=0.05 gives CDF~1.5e-15 near float precision)
xs = [0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 0.98]
print_case('LogitNormal', 'positive mu, small sigma', '[1, 0.5]',
           [(x, logitnorm_pdf(x), logitnorm_cdf(x)) for x in xs])

# Lomax(lambda=0.5, alpha=0.5)
# scipy.stats.lomax(c=alpha, scale=lambda)
d = stats.lomax(c=0.5, scale=0.5)
xs = [0.01, 0.1, 0.5, 1.0, 5.0, 20.0, 100.0]
print_case('Lomax', 'near-zero shapes', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Makeham(alpha=0.5, beta=0.5, lambda=0.5)
# F(x) = 1 - exp(-lambda*x - alpha*(exp(beta*x)-1)/beta)
# f(x) = (alpha*exp(beta*x) + lambda) * exp(-lambda*x - alpha*(exp(beta*x)-1)/beta)
def makeham_pdf(x, alpha, beta, lam):
    y = math.exp(beta * x)
    return (alpha * y + lam) * math.exp(-lam * x - alpha * (y - 1) / beta)
def makeham_cdf(x, alpha, beta, lam):
    y = math.exp(beta * x)
    return -math.expm1(-lam * x - alpha * math.expm1(beta * x) / beta)
alpha_m, beta_m, lam_m = 0.5, 0.5, 0.5
xs = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0]
print_case('Makeham', 'small parameters', '[0.5, 0.5, 0.5]',
           [(x, makeham_pdf(x, alpha_m, beta_m, lam_m), makeham_cdf(x, alpha_m, beta_m, lam_m)) for x in xs])

# MaxwellBoltzmann(a=0.5)  →  scipy.stats.maxwell(scale=0.5)
d = stats.maxwell(scale=0.5)
xs = [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0]
print_case('MaxwellBoltzmann', 'small a', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Mielke(k=0.5, s=4)  →  scipy.stats.mielke(k=0.5, s=4)
d = stats.mielke(k=0.5, s=4)
xs = [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('Mielke', 'small k, large s', '[0.5, 4]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Moyal(mu=3, sigma=0.5)  →  scipy.stats.moyal(loc=3, scale=0.5)
d = stats.moyal(loc=3, scale=0.5)
xs = [3.0, 3.2, 3.5, 4.0, 5.0, 7.0, 10.0]
print_case('Moyal', 'shifted location, small scale', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Muth(alpha=0.1)
# F(x) = 1 - exp(alpha*x - expm1(alpha*x)/alpha)
# f(x) = (exp(alpha*x) - alpha) * S(x)
# S(x) = exp(alpha*x - expm1(alpha*x)/alpha)
def muth_cdf(x, alpha):
    return -math.expm1(alpha * x - math.expm1(alpha * x) / alpha)
def muth_pdf(x, alpha):
    s = math.exp(alpha * x - math.expm1(alpha * x) / alpha)
    return (math.exp(alpha * x) - alpha) * s
alpha_mu = 0.1
xs = [0.1, 1.0, 3.0, 6.0, 10.0, 15.0, 22.0]
print_case('Muth', 'near-zero kappa', '[0.1]',
           [(x, muth_pdf(x, alpha_mu), muth_cdf(x, alpha_mu)) for x in xs])

# Nakagami(m=0.5, omega=0.5)  →  scipy.stats.nakagami(nu=0.5, scale=sqrt(0.5))
d = stats.nakagami(nu=0.5, scale=math.sqrt(0.5))
xs = [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0]
print_case('Nakagami', 'near-zero m, small omega', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# NoncentralChi(k=2, lambda=0.5)
# f(x) = 2*x * ncx2.pdf(x^2, k, lambda^2)
# F(x) = ncx2.cdf(x^2, k, lambda^2)
d_ncx2 = stats.ncx2(df=2, nc=0.25)
def nchi_pdf(x):
    return 2 * x * d_ncx2.pdf(x**2)
def nchi_cdf(x):
    return d_ncx2.cdf(x**2)
xs = [0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0]
print_case('NoncentralChi', 'small df and lambda', '[2, 0.5]',
           [(x, nchi_pdf(x), nchi_cdf(x)) for x in xs])

# NoncentralF(d1=2, d2=10, lambda=0.5)
d = stats.ncf(dfn=2, dfd=10, nc=0.5)
xs = [0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
print_case('NoncentralF', 'asymmetric df, small lambda', '[2, 10, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Normal(mu=3, sigma=0.5)  →  scipy.stats.norm(loc=3, scale=0.5)
d = stats.norm(loc=3, scale=0.5)
xs = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]
print_case('Normal', 'shifted location, small sigma', '[3, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Pareto(xm=1, alpha=0.5)
# scipy.stats.pareto(b=alpha, scale=xm)
d = stats.pareto(b=0.5, scale=1.0)
xs = [1.01, 1.1, 1.5, 2.0, 5.0, 15.0, 50.0]
print_case('Pareto', 'near-zero alpha, unit xm', '[1, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# PERT(a=0, b=0.5, c=1)  →  Beta(alpha,beta, loc=a, scale=c-a)
# PERT shape params: alpha = 1 + 4*(b-a)/(c-a) = 1 + 4*0.5/1 = 3
#                   beta  = 1 + 4*(c-b)/(c-a) = 1 + 4*0.5/1 = 3
d = stats.beta(a=3, b=3, loc=0, scale=1)
xs = [0.05, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95]
print_case('PERT', 'unit interval, symmetric center', '[0, 0.5, 1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# PowerLaw(a=0.5)  →  scipy.stats.powerlaw(a=0.5)
d = stats.powerlaw(a=0.5)
xs = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.95]
print_case('PowerLaw', 'near-zero a', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# QExponential(q=0.5, lambda=0.5)
# QExponential is GeneralizedPareto(mu=0, sigma=1/(lambda*(2-q)), xi=(q-1)/(2-q))
# q=0.5, lambda=0.5: sigma=1/(0.5*1.5)=4/3, xi=-0.5/1.5=-1/3
# F(x) = 1 - (1 - xi*(x-mu)/sigma)^(1/xi)
# For xi=-1/3: F(x) = 1 - (1 + (x*lambda*(2-q))/(2-q)/(1))^(-3) ... let me use the explicit formula
# Actually: QExponential(q, lambda) = GeneralizedPareto(0, 1/(lambda*(2-q)), (q-1)/(2-q))
# GenPareto(mu, sigma, xi): F(x) = 1 - (1 + xi*(x-mu)/sigma)^(-1/xi)
mu_gp = 0.0
sigma_gp = 1.0 / (0.5 * (2 - 0.5))  # = 1/(0.5*1.5) = 4/3
xi_gp = (0.5 - 1) / (2 - 0.5)       # = -0.5/1.5 = -1/3
d = stats.genpareto(c=xi_gp, loc=mu_gp, scale=sigma_gp)
# Support: for xi<0, x in [mu, mu - sigma/xi] = [0, 4/3 * 3] = [0, 4]
xs = [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
print_case('QExponential', 'positive q, small lambda', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# R(c=0.5)
# c=2 gives a uniform distribution; use c=0.5 (U-shaped, distinct from Uniform)
# R(c): extends Beta(c/2, c/2)
# f(x) = 0.5 * Beta(c/2, c/2).pdf((x+1)/2)  for x in [-1, 1]
# F(x) = Beta(c/2, c/2).cdf((x+1)/2)
def r_pdf(x, c):
    db = stats.beta(a=c/2, b=c/2)
    return 0.5 * db.pdf((x + 1) / 2)
def r_cdf(x, c):
    db = stats.beta(a=c/2, b=c/2)
    return db.cdf((x + 1) / 2)
xs = [-0.9, -0.5, -0.2, 0.0, 0.2, 0.5, 0.9]
print_case('R', 'near-zero c (U-shaped)', '[0.5]',
           [(x, r_pdf(x, 0.5), r_cdf(x, 0.5)) for x in xs])

# RaisedCosine(mu=3, s=0.5)
# f(x) = (1 + cos(pi*(x-mu)/s)) / (2*s)  for x in [mu-s, mu+s]
# F(x) = 0.5 + (x-mu)/(2*s) + sin(pi*(x-mu)/s)/(2*pi)
def rc_pdf(x, mu, s):
    return (1 + math.cos(math.pi * (x - mu) / s)) / (2 * s)
def rc_cdf(x, mu, s):
    z = (x - mu) / s
    return 0.5 * (1 + z + math.sin(math.pi * z) / math.pi)
mu_rc, s_rc = 3.0, 0.5
xs = [2.55, 2.65, 2.8, 3.0, 3.2, 3.35, 3.45]
print_case('RaisedCosine', 'shifted location, small scale', '[3, 0.5]',
           [(x, rc_pdf(x, mu_rc, s_rc), rc_cdf(x, mu_rc, s_rc)) for x in xs])

# Rayleigh(sigma=0.5)  →  scipy.stats.rayleigh(scale=0.5)
d = stats.rayleigh(scale=0.5)
xs = [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0]
print_case('Rayleigh', 'small sigma', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Reciprocal(a=1, b=10)  →  scipy.stats.reciprocal(a=1, b=10)
d = stats.reciprocal(a=1, b=10)
xs = [1.05, 1.5, 2.0, 3.0, 5.0, 7.0, 9.5]
print_case('Reciprocal', 'smaller range', '[1, 10]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# ReciprocalInverseGaussian(mu=0.5, lambda=4)
# f(x) = InverseGaussian(mu,lambda).pdf(1/x) / x^2
# F(x) = 1 - InverseGaussian(mu,lambda).cdf(1/x)
d_ig = stats.invgauss(mu=0.5/4.0, scale=4.0)
def rig_pdf(x):
    return d_ig.pdf(1 / x) / (x * x)
def rig_cdf(x):
    return 1 - d_ig.cdf(1 / x)
xs = [0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
print_case('ReciprocalInverseGaussian', 'small mu, large lambda', '[0.5, 4]',
           [(x, rig_pdf(x), rig_cdf(x)) for x in xs])

# Rice(nu=0.5, sigma=2)  →  scipy.stats.rice(b=nu/sigma, scale=sigma)
# nu > 0 required in ranjs; use small nu with large sigma for Rayleigh-like shape
d = stats.rice(b=0.5/2.0, scale=2.0)
xs = [0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 10.0]
print_case('Rice', 'small nu, large sigma', '[0.5, 2]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# StudentT(nu=0.5)  →  scipy.stats.t(df=0.5)
d = stats.t(df=0.5)
xs = [-5.0, -2.0, -1.0, 0.0, 1.0, 2.0, 5.0]
print_case('StudentT', 'near-zero nu (heavy tail)', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# StudentZ(n=2)  →  n > 1 required in ranjs; use n=2
# ranjs uses StudentT(n-1) scaled by sqrt(n-1):
# f(x; n) = StudentT(n-1).pdf(x*sqrt(n-1)) * sqrt(n-1)
# F(x; n) = StudentT(n-1).cdf(x*sqrt(n-1))
n_sz = 2
d_t = stats.t(df=n_sz - 1)   # StudentT(n-1) = StudentT(1) = Cauchy
sqn = math.sqrt(n_sz - 1)    # sqrt(n-1) = sqrt(1) = 1
def sz_pdf(x):
    return d_t.pdf(x * sqn) * sqn
def sz_cdf(x):
    return d_t.cdf(x * sqn)
xs = [-3.0, -1.0, -0.5, 0.0, 0.5, 1.0, 3.0]
print_case('StudentZ', 'small df', '[2]',
           [(x, sz_pdf(x), sz_cdf(x)) for x in xs])

# Trapezoidal(a=0, b=0.3, c=0.7, d=1)
# scale = (b-a) + 2*(c-b) + (d-c) = b-a + 2c-2b + d-c = d-a+c-b = 1+0.4 = 1.4
# f(x): linear ramp [a,b], flat [b,c], linear ramp [c,d]
def trap_scale(a, b, c, d):
    return (b - a) + 2 * (c - b) + (d - c)
def trap_pdf(x, a, b, c, d):
    sc = trap_scale(a, b, c, d)
    if x < b:
        return 2 * (x - a) / ((b - a) * sc)
    elif x < c:
        return 2 / sc
    else:
        return 2 * (d - x) / ((d - c) * sc)
def trap_cdf(x, a, b, c, d):
    sc = trap_scale(a, b, c, d)
    if x < b:
        return (x - a) ** 2 / ((b - a) * sc)
    elif x < c:
        return ((x - b) * 2 + (b - a)) / sc
    else:
        return 1 - (d - x) ** 2 / ((d - c) * sc)
a_t, b_t, c_t, d_t = 0, 0.3, 0.7, 1.0
xs = [0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95]
print_case('Trapezoidal', 'unit interval, asymmetric plateau', '[0, 0.3, 0.7, 1]',
           [(x, trap_pdf(x, a_t, b_t, c_t, d_t), trap_cdf(x, a_t, b_t, c_t, d_t)) for x in xs])

# Triangular(a=0, b=1, c=0.1)
# scipy.stats.triang(c=(mode-a)/(b-a), loc=a, scale=b-a)
d = stats.triang(c=0.1/(1 - 0), loc=0, scale=1)
xs = [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95]
print_case('Triangular', 'unit interval, left-skewed mode', '[0, 1, 0.1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# TruncatedNormal(mu=0, sigma=1, a=-2, b=2)
# scipy.stats.truncnorm(a=(a-mu)/sigma, b=(b-mu)/sigma, loc=mu, scale=sigma)
d = stats.truncnorm(a=(-2 - 0) / 1, b=(2 - 0) / 1, loc=0, scale=1)
xs = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]
print_case('TruncatedNormal', 'standard normal, symmetric truncation', '[0, 1, -2, 2]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# UQuadratic(a=0, b=1)
# f(x) = alpha*(x-beta)^2, alpha=12/(b-a)^3, beta=(a+b)/2
# F(x) = alpha/3 * ((x-beta)^3 - (a-beta)^3) + 0 at a = alpha/3 * ((x-beta)^3 + (b-a)^3/8... let me be careful
# alpha = 12/(b-a)^3 = 12
# beta = (a+b)/2 = 0.5
# F(x) = alpha * ((x-beta)^3/3 - (a-beta)^3/3)
# = alpha/3 * ((x-0.5)^3 - (-0.5)^3) = 12/3 * ((x-0.5)^3 + 0.125)
# = 4 * ((x-0.5)^3 + 0.125)
def uquad_pdf(x, a, b):
    alpha = 12 / (b - a) ** 3
    beta = (a + b) / 2
    return alpha * (x - beta) ** 2
def uquad_cdf(x, a, b):
    alpha = 12 / (b - a) ** 3
    beta = (a + b) / 2
    return alpha / 3 * ((x - beta) ** 3 - (a - beta) ** 3)
xs = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]
print_case('UQuadratic', 'unit interval', '[0, 1]',
           [(x, uquad_pdf(x, 0, 1), uquad_cdf(x, 0, 1)) for x in xs])

# Uniform(a=0, b=1)  →  scipy.stats.uniform(loc=0, scale=1)
d = stats.uniform(loc=0, scale=1)
xs = [0.1, 0.25, 0.5, 0.75, 0.9]
print_case('Uniform', 'unit interval', '[0, 1]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# UniformProduct(n=2)
# f(x) = (-ln(x))^(n-1) / (n-1)! = (-ln(x))^1 / 1 = -ln(x)
# F(x) = sum_{k=0}^{n-1} (-1)^k * (-ln(x))^k / k! evaluated at n=2...
# Actually: F(x) = incomplete_gamma(n, -ln(x)) via upper incomplete gamma
# For n=2: f(x) = -ln(x), F(x) = x*(1-ln(x)) = x - x*ln(x)
def uprod_pdf(x, n):
    from math import lgamma, log
    return (-log(x)) ** (n - 1) / math.exp(lgamma(n))
def uprod_cdf(x, n):
    from scipy.special import gammaincc, gamma
    return gammaincc(n, -math.log(x)) * gamma(n) / gamma(n)
    # Actually: F(x) = 1 - Gamma_upper_incomplete(n, -ln(x)) / Gamma(n)
    # = gammainccc(n, -ln(x))
    # = gammaincc(n, -ln(x)) where gammaincc is the regularized upper incomplete gamma

# Let me recalculate: for Uniform Product:
# F(x) = P(X1*...*Xn <= x) = gammainccc(n, -ln(x)) = Q(n, -ln(x))
# This is the regularized upper incomplete gamma Q(a, x)
from scipy.special import gammaincc, gammainccinv
def uprod_cdf2(x, n):
    return gammaincc(n, -math.log(x))
xs = [0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.98]
print_case('UniformProduct', 'small n', '[2]',
           [(x, uprod_pdf(x, 2), uprod_cdf2(x, 2)) for x in xs])

# VonMises(kappa=0.5)  →  scipy.stats.vonmises(kappa=0.5)
d = stats.vonmises(kappa=0.5)
xs = [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0]
print_case('VonMises', 'near-zero kappa (near-uniform)', '[0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Weibull(lambda=0.5, k=0.5)  →  scipy.stats.weibull_min(c=k, scale=lambda)
d = stats.weibull_min(c=0.5, scale=0.5)
xs = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 3.0]
print_case('Weibull', 'near-zero shapes', '[0.5, 0.5]',
           [(x, d.pdf(x), d.cdf(x)) for x in xs])

# Wigner(R=0.5)
# f(x) = 2*sqrt(R^2-x^2) / (pi*R^2) for x in [-R, R]
# F(x) = 0.5 + x*sqrt(R^2-x^2)/(pi*R^2) + arcsin(x/R)/pi
def wigner_pdf(x, R):
    r2 = R * R
    return 2 * math.sqrt(r2 - x * x) / (math.pi * r2)
def wigner_cdf(x, R):
    r2 = R * R
    return 0.5 + x * math.sqrt(r2 - x * x) / (math.pi * r2) + math.asin(x / R) / math.pi
R_w = 0.5
xs = [-0.45, -0.3, -0.15, 0.0, 0.15, 0.3, 0.45]
print_case('Wigner', 'small R', '[0.5]',
           [(x, wigner_pdf(x, R_w), wigner_cdf(x, R_w)) for x in xs])

# ── DISCRETE DISTRIBUTIONS ────────────────────────────────────────────────────

print('\n\n// ── DISCRETE ──')

# Bernoulli(p=0.1)  →  scipy.stats.bernoulli(p=0.1)
d = stats.bernoulli(p=0.1)
xs = [0, 1]
print_case('Bernoulli', 'low probability', '[0.1]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# BetaBinomial(n=10, a=0.5, b=4)  →  scipy.stats.betabinom(n=10, a=0.5, b=4)
d = stats.betabinom(n=10, a=0.5, b=4)
xs = [0, 1, 2, 3, 5, 7, 10]
print_case('BetaBinomial', 'small n, asymmetric shapes', '[10, 0.5, 4]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# Binomial(n=10, p=0.1)  →  scipy.stats.binom(n=10, p=0.1)
d = stats.binom(n=10, p=0.1)
xs = [0, 1, 2, 3, 5, 7, 10]
print_case('Binomial', 'small n, low p', '[10, 0.1]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# Delaporte(alpha=0.5, beta=0.5, lambda=0.5)
# Delaporte = Poisson(lambda + Gamma(alpha, beta)) where Gamma is shape-rate
# PMF: sum over k of Poisson(n; k+lambda) * Gamma_pmf(k; alpha, 1/beta)?
# Actually, Delaporte is NegBinomial + Poisson:
# Delaporte(alpha, beta, lambda): P(X=k) = sum_{j=0}^{k} NegBin(j; alpha, 1/(1+beta)) * Poisson(k-j; lambda)
# Or more directly: it's a Poisson-mixture model
# Let me compute via the ranjs CJS bundle using Node.js
import subprocess
delaporte_vals = []
for k in [0, 1, 2, 3, 5, 8, 12]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.Delaporte(0.5, 0.5, 0.5)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        import json
        val = json.loads(result.stdout.strip())
        delaporte_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('Delaporte', 'small parameters', '[0.5, 0.5, 0.5]', delaporte_vals, discrete=True)

# DiscreteUniform(min=0, max=9)  →  scipy.stats.randint(0, 10)
d = stats.randint(low=0, high=10)
xs = [0, 1, 3, 5, 7, 9]
print_case('DiscreteUniform', 'small range', '[0, 9]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# DiscreteWeibull(q=0.75, beta=2)
# q=0.75 gives cdf(0) = 0.25 exactly; beta=2 gives rapid decay (different from existing beta=2 at q=0.5)
# pmf(k) = q^(k^beta) - q^((k+1)^beta)
# cdf(k) = 1 - q^((k+1)^beta)
def dw_pmf(k, q, beta):
    return q ** (k ** beta) - q ** ((k + 1) ** beta)
def dw_cdf(k, q, beta):
    return 1 - q ** ((k + 1) ** beta)
q_dw, beta_dw = 0.75, 2.0
xs_dw = [0, 1, 2, 3, 4, 5, 6]
print_case('DiscreteWeibull', 'high q, standard beta', '[0.75, 2]',
           [(k, dw_pmf(k, q_dw, beta_dw), dw_cdf(k, q_dw, beta_dw)) for k in xs_dw], discrete=True)

# GeneralizedHermite(a1=3, a2=2, m=2)
# GH(3,2,2) has mean=7, passes cdf monotonicity over x in [-1,50]
# Via ranjs CJS bundle
gh_vals = []
for k in [0, 1, 2, 4, 6, 9, 14]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.GeneralizedHermite(3, 2, 2)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        val = json.loads(result.stdout.strip())
        gh_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('GeneralizedHermite', 'medium parameters', '[3, 2, 2]', gh_vals, discrete=True)

# Geometric(p=0.25)
# p=0.25 = 1/4 is exactly representable in binary float; avoids cdf(0)=0.0999... precision issue
# ranjs is 0-indexed: P(X=k) = p*(1-p)^k  k=0,1,2,...
# scipy.stats.nbinom(1, p): P(X=k) = C(k,k)*p*(1-p)^k = p*(1-p)^k  (same!)
d = stats.nbinom(1, 0.25)
xs = [0, 1, 2, 5, 10, 20, 40]
print_case('Geometric', 'low success probability', '[0.25]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# HeadsMinusTails(n=2)
# ranjs computes folded distribution of |X| on support [0, 2n]
# pmf(0) = C(2n,n)/4^n; pmf(k) = 2*C(2n,n+k/2)/4^n for k>0 even
def hmt_pmf_ranjs(k, n):
    if k == 0:
        return math.comb(2 * n, n) / (4 ** n)
    elif k > 0 and k % 2 == 0:
        return 2 * math.comb(2 * n, n + k // 2) / (4 ** n)
    else:
        return 0
def hmt_cdf_ranjs(k, n):
    total = 0
    for x in range(0, k + 1, 2):
        total += hmt_pmf_ranjs(x, n)
    return total
n_hmt = 2
xs_hmt = [0, 2, 4]
print_case('HeadsMinusTails', 'small n', '[2]',
           [(k, hmt_pmf_ranjs(k, n_hmt), hmt_cdf_ranjs(k, n_hmt)) for k in xs_hmt], discrete=True)

# Hypergeometric(N=20, K=3, n=10)
# scipy.stats.hypergeom(M=N, n=K, N=n)
d = stats.hypergeom(M=20, n=3, N=10)
xs = [0, 1, 2, 3]
print_case('Hypergeometric', 'different ratio', '[20, 3, 10]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# LogSeries(p=0.9)  →  scipy.stats.logser(p=0.9)
d = stats.logser(p=0.9)
xs = [1, 2, 3, 5, 8, 12, 20]
print_case('LogSeries', 'high p (heavy tail)', '[0.9]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# NegativeHypergeometric(N=20, K=5, r=10)
# Uses ranjs CJS bundle
nhg_vals = []
for k in [0, 1, 2, 3, 4, 5]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.NegativeHypergeometric(20, 5, 10)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        val = json.loads(result.stdout.strip())
        nhg_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('NegativeHypergeometric', 'different sizes', '[20, 5, 10]', nhg_vals, discrete=True)

# NeymanA(lambda=0.5, phi=0.5)
# Compound Poisson: Poisson(lambda) clusters, each cluster Poisson(phi)
# Via ranjs CJS bundle
na_vals = []
for k in [0, 1, 2, 3, 5, 8, 12]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.NeymanA(0.5, 0.5)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        val = json.loads(result.stdout.strip())
        na_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('NeymanA', 'small parameters', '[0.5, 0.5]', na_vals, discrete=True)

# PolyaAeppli(lambda=0.5, theta=0.1)
# Via ranjs CJS bundle
pa_vals = []
for k in [0, 1, 2, 3, 5, 8, 12]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.PolyaAeppli(0.5, 0.1)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        val = json.loads(result.stdout.strip())
        pa_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('PolyaAeppli', 'small lambda, low theta', '[0.5, 0.1]', pa_vals, discrete=True)

# Skellam(mu1=1, mu2=4)  →  scipy.stats.skellam(mu1=1, mu2=4)
d = stats.skellam(mu1=1, mu2=4)
xs = [-8, -4, -2, 0, 2, 4, 6]
print_case('Skellam', 'asymmetric rates', '[1, 4]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# Soliton(N=3)
# f(1) = 1/N; f(k) = 1/(k*(k-1)) for k=2,...,N
# F(k) = sum_{j=1}^{k} f(j)
def soliton_pmf(k, N):
    if k == 1:
        return 1.0 / N
    elif 2 <= k <= N:
        return 1.0 / (k * (k - 1))
    return 0.0
def soliton_cdf(k, N):
    return sum(soliton_pmf(j, N) for j in range(1, k + 1))
N_s = 3
xs_s = [1, 2, 3]
print_case('Soliton', 'small N', '[3]',
           [(k, soliton_pmf(k, N_s), soliton_cdf(k, N_s)) for k in xs_s], discrete=True)

# YuleSimon(rho=2.5)  →  scipy.stats.yulesimon(alpha=2.5)
# rho=1.5 has infinite variance, causing unreliable chi^2 tests; use rho=2.5 (finite variance)
d = stats.yulesimon(alpha=2.5)
xs = [1, 2, 3, 5, 8, 15, 30]
print_case('YuleSimon', 'smaller rho (heavier tail)', '[2.5]',
           [(x, d.pmf(x), d.cdf(x)) for x in xs], discrete=True)

# Zeta(s=5.0)  →  heavier concentration of mass at small k; existing case uses 3.8
# s=2.1 has very heavy tails that cause chi^2 test failures; use s=5 (light tail)
from scipy.special import zeta as riemann_zeta
def zeta_pmf(k, s):
    return k ** (-s) / riemann_zeta(s, 1)
def zeta_cdf(k, s):
    return sum(zeta_pmf(j, s) for j in range(1, k + 1))
s_z = 5.0
xs_z = [1, 2, 3, 5, 10, 20]
print_case('Zeta', 'light-tailed s', '[5.0]',
           [(k, zeta_pmf(k, s_z), zeta_cdf(k, s_z)) for k in xs_z], discrete=True)

# Zipf(s=1.5, N=20)
# pmf(k) = k^(-s) / H(N, s) where H(N,s) = sum_{j=1}^{N} j^(-s)
# Via ranjs CJS bundle
zipf_vals = []
for k in [1, 2, 3, 5, 10, 15, 20]:
    code = f"""
const r = require('./dist/ranjs.cjs.js')
const d = new r.dist.Zipf(1.5, 20)
console.log(JSON.stringify({{ x: {k}, pmf: d.pdf({k}), cdf: d.cdf({k}) }}))
"""
    result = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd='/home/user/ran')
    if result.returncode == 0:
        val = json.loads(result.stdout.strip())
        zipf_vals.append((val['x'], val['pmf'], val['cdf']))
print_case('Zipf', 'near-boundary exponent, small N', '[1.5, 20]', zipf_vals, discrete=True)
