#!/usr/bin/env python3
"""Compute high-precision reference values using mpmath (dps=60) for
dist-cases-continuous.js distributions Alpha → Gumbel.
Each function prints new refVals entries."""

import mpmath
mpmath.mp.dps = 60

pi = mpmath.pi

def fmt(x):
    """Format an mpmath number to a float-representable string with 16 sig figs."""
    if x == 0:
        return '0'
    v = float(x)
    return repr(v)

def make_entry(x_val, pdf_val, cdf_val):
    x = fmt(x_val)
    p = fmt(pdf_val)
    c = fmt(cdf_val)
    return f'      {{ x: {x}, pdf: {p}, cdf: {c} }}'

# ---------------------------------------------------------------------------
# 1. Alpha(alpha=0.5, beta=0.5)
# PDF: beta * npdf(alpha - beta/x) / (x^2 * Phi(alpha))
# CDF: Phi(alpha - beta/x) / Phi(alpha)
# ---------------------------------------------------------------------------

def alpha_pdf(x, a, b):
    t = a - b/x
    phi_t = mpmath.npdf(t)
    Phi_a = mpmath.ncdf(a)
    return b * phi_t / (x**2 * Phi_a)

def alpha_cdf(x, a, b):
    t = a - b/x
    return mpmath.ncdf(t) / mpmath.ncdf(a)

print("# Alpha(alpha=0.5, beta=0.5)")
xs_alpha = [0.51, 0.55, 0.65, 0.8, 1.0, 1.5, 2.5, 5.0]
for x in xs_alpha:
    xm = mpmath.mpf(str(x))
    pdf = alpha_pdf(xm, mpmath.mpf('0.5'), mpmath.mpf('0.5'))
    cdf = alpha_cdf(xm, mpmath.mpf('0.5'), mpmath.mpf('0.5'))
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 2. Anglit(mu=3, beta=0.5)
# PDF: cos(2*(x-mu)/beta) / beta
# CDF: sin((x-mu)/beta + pi/4)^2
# Note: support is [mu - pi*beta/4, mu + pi*beta/4]
# ---------------------------------------------------------------------------

def anglit_pdf(x, mu, beta):
    return mpmath.cos(2*(x-mu)/beta) / beta

def anglit_cdf(x, mu, beta):
    # From code: sin(x/beta - mu/beta + pi/4)^2
    s = mpmath.sin(x/beta - mu/beta + pi/4)
    return s**2

print("# Anglit(mu=3, beta=0.5)")
mu_a, beta_a = mpmath.mpf('3'), mpmath.mpf('0.5')
# support: [3 - pi*0.5/4, 3 + pi*0.5/4] = [3 - pi/8, 3 + pi/8]
# pi/8 ≈ 0.3927
xs_anglit = [2.6, 2.8, 2.9, 3.0, 3.1, 3.2, 3.4]
for x in xs_anglit:
    xm = mpmath.mpf(str(x))
    lo = mu_a - pi * beta_a / 4
    hi = mu_a + pi * beta_a / 4
    if xm <= lo or xm >= hi:
        print(f'      {{ x: {x}, pdf: 0, cdf: {0 if xm <= lo else 1} }}')
    else:
        pdf = anglit_pdf(xm, mu_a, beta_a)
        cdf = anglit_cdf(xm, mu_a, beta_a)
        print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 3. Arcsine(a=0, b=1)
# PDF: 1 / (pi * sqrt((x-a)*(b-x)))
# CDF: 2/pi * arcsin(sqrt((x-a)/(b-a)))
# ---------------------------------------------------------------------------

def arcsine_pdf(x, a, b):
    return 1 / (pi * mpmath.sqrt((x-a)*(b-x)))

def arcsine_cdf(x, a, b):
    return 2/pi * mpmath.asin(mpmath.sqrt((x-a)/(b-a)))

print("# Arcsine(a=0, b=1)")
a_arc, b_arc = mpmath.mpf('0'), mpmath.mpf('1')
xs_arc = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
for x in xs_arc:
    xm = mpmath.mpf(str(x))
    pdf = arcsine_pdf(xm, a_arc, b_arc)
    cdf = arcsine_cdf(xm, a_arc, b_arc)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 4. BaldingNichols(F=0.1, p=0.1) → Beta(alpha, beta) where f=(1-F)/F, alpha=f*p, beta=f*(1-p)
# F=0.1 → f=9, alpha=0.9, beta=8.1
# Beta PDF: x^(alpha-1) * (1-x)^(beta-1) / B(alpha, beta)
# Beta CDF: regularized incomplete beta I_x(alpha, beta)
# ---------------------------------------------------------------------------

def beta_pdf(x, alpha, beta):
    lB = mpmath.log(mpmath.beta(alpha, beta))
    return mpmath.exp((alpha-1)*mpmath.log(x) + (beta-1)*mpmath.log(1-x) - lB)

def beta_cdf(x, alpha, beta):
    return mpmath.betainc(alpha, beta, 0, x, regularized=True)

F_bn, p_bn = mpmath.mpf('0.1'), mpmath.mpf('0.1')
f_bn = (1 - F_bn) / F_bn
alpha_bn = f_bn * p_bn
beta_bn = f_bn * (1 - p_bn)
print(f"# BaldingNichols(F=0.1, p=0.1) → Beta(alpha={float(alpha_bn):.6f}, beta={float(beta_bn):.6f})")
xs_bn = [0.01, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95]
for x in xs_bn:
    xm = mpmath.mpf(str(x))
    pdf = beta_pdf(xm, alpha_bn, beta_bn)
    cdf = beta_cdf(xm, alpha_bn, beta_bn)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 5. Bates(n=3, a=0, b=1)  (uses IrwinHall)
# IrwinHall n=3: PDF/CDF from closed form
# Bates: y = n*x/(b-a) - n*a/(b-a) = n*x for a=0,b=1
# PDF_bates(x) = n * PDF_IH(n*x)
# CDF_bates(x) = CDF_IH(n*x)
# IrwinHall(n=3):
# PDF_IH(y) = piecewise
# CDF_IH(y) = piecewise
# For n=3:
# 0<=y<1: PDF = y^2/2, CDF = y^3/6
# 1<=y<2: PDF = (-2y^2+6y-3)/2, CDF = (-y^3+6y-2*y^3+3*y^2... complex)
# Let me use the general formula via mpmath
# ---------------------------------------------------------------------------

def irwinhall_pdf_3(y):
    """IrwinHall n=3 PDF at y (0 <= y <= 3)"""
    if y < 0 or y > 3:
        return mpmath.mpf('0')
    elif y < 1:
        return y**2 / 2
    elif y < 2:
        return (-2*y**2 + 6*y - 3) / 2
    else:
        return (y - 3)**2 / 2

def irwinhall_cdf_3(y):
    """IrwinHall n=3 CDF at y"""
    if y <= 0:
        return mpmath.mpf('0')
    elif y < 1:
        return y**3 / 6
    elif y < 2:
        return (-y**3 + 3*y**2 - 3*y + 1) / (-6) + y**3/6
        # Actually let me use integration
    elif y <= 3:
        return mpmath.quad(lambda t: irwinhall_pdf_3(t), [0, y])
    else:
        return mpmath.mpf('1')

def irwinhall_cdf_3_exact(y):
    """Closed-form IrwinHall(3) CDF"""
    if y <= 0:
        return mpmath.mpf('0')
    elif y <= 1:
        return y**3 / 6
    elif y <= 2:
        return (-y**3 + 3*y**2 - 3*y + 2) / 2 / (-1) + mpmath.mpf('1')/6
        # = y^3/6 + integral from 1 to y of (-2t^2+6t-3)/2 dt
        # = 1/6 + [(-2t^3/3+3t^2-3t)/2]_1^y
        # = 1/6 + (-2y^3/3+3y^2-3y)/2 - (-2/3+3-3)/2
        # = 1/6 + (-2y^3/3+3y^2-3y)/2 - (-2/3)/2
        # = 1/6 + (-2y^3/3+3y^2-3y)/2 + 1/3
        # = 1/2 + (-2y^3/3+3y^2-3y)/2
        # = (3-2y^3/3+3y^2-3y)/2 ... hmm let me just use numerical integration
    elif y <= 3:
        pass
    else:
        return mpmath.mpf('1')
    return mpmath.quad(lambda t: irwinhall_pdf_3(mpmath.mpf(t)), [0, float(y)])

def bates_pdf(x, n, a, b):
    """Bates PDF. n must be integer."""
    scale = n / (b - a)
    y = scale * x - n * a / (b - a)
    # IrwinHall n=3 case
    if n == 3:
        return scale * irwinhall_pdf_3(y)
    return mpmath.mpf('0')  # fallback

def bates_cdf(x, n, a, b):
    """Bates CDF."""
    scale = n / (b - a)
    y = scale * x - n * a / (b - a)
    if n == 3:
        return mpmath.quad(lambda t: irwinhall_pdf_3(mpmath.mpf(t)), [0, float(y)])
    return mpmath.mpf('0')

print("# Bates(n=3, a=0, b=1)")
xs_bates = [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9]
for x in xs_bates:
    xm = mpmath.mpf(str(x))
    # Compute CDF via quadrature of IrwinHall(3) PDF at y = 3*x
    y = 3 * xm
    pdf_ih = irwinhall_pdf_3(y)
    pdf = 3 * pdf_ih
    cdf = mpmath.quad(lambda t: irwinhall_pdf_3(mpmath.mpf(str(t))), [0, float(y)])
    print(make_entry(x, pdf, cdf))

print()

# Note: Bates(n=2.7, a=0, b=1) rounds to n=3, same values
print("# Bates(n=2.7, a=0, b=1) [rounds to n=3, same values as above]")
print("  # same as n=3")
print()

# ---------------------------------------------------------------------------
# 6. Benini(alpha=0.5, beta=0.5, sigma=1)
# PDF: (alpha/x + 2*beta*log(x/sigma)/x) * exp(-alpha*log(x/sigma) - beta*log(x/sigma)^2)
# CDF: 1 - exp(-alpha*log(x/sigma) - beta*log(x/sigma)^2)
# ---------------------------------------------------------------------------

def benini_pdf(x, alpha, beta, sigma):
    y = mpmath.log(x / sigma)
    z = alpha + beta * y
    return mpmath.exp(-y * z) * (z + beta * y) / x

def benini_cdf(x, alpha, beta, sigma):
    y = mpmath.log(x / sigma)
    return -mpmath.expm1(-y * (alpha + beta * y))

print("# Benini(alpha=0.5, beta=0.5, sigma=1)")
alpha_b, beta_b, sigma_b = mpmath.mpf('0.5'), mpmath.mpf('0.5'), mpmath.mpf('1')
xs_benini = [1.05, 1.2, 1.5, 2.0, 3.0, 5.0, 8.0]
for x in xs_benini:
    xm = mpmath.mpf(str(x))
    pdf = benini_pdf(xm, alpha_b, beta_b, sigma_b)
    cdf = benini_cdf(xm, alpha_b, beta_b, sigma_b)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 7. Beta(alpha=0.5, beta=0.5) - arcsine distribution
# ---------------------------------------------------------------------------

print("# Beta(alpha=0.5, beta=0.5)")
xs_beta = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
alpha_b05, beta_b05 = mpmath.mpf('0.5'), mpmath.mpf('0.5')
for x in xs_beta:
    xm = mpmath.mpf(str(x))
    pdf = beta_pdf(xm, alpha_b05, beta_b05)
    cdf = beta_cdf(xm, alpha_b05, beta_b05)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 8. BetaPrime(alpha=0.5, beta=4)
# PDF: beta_pdf(x/(1+x)) / (1+x)^2
# CDF: beta_cdf(x/(1+x))
# ---------------------------------------------------------------------------

def betaprime_pdf(x, alpha, beta):
    t = x / (1 + x)
    return beta_pdf(t, alpha, beta) / (1 + x)**2

def betaprime_cdf(x, alpha, beta):
    t = x / (1 + x)
    return beta_cdf(t, alpha, beta)

print("# BetaPrime(alpha=0.5, beta=4)")
alpha_bp, beta_bp = mpmath.mpf('0.5'), mpmath.mpf('4')
xs_bp = [0.05, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0]
for x in xs_bp:
    xm = mpmath.mpf(str(x))
    pdf = betaprime_pdf(xm, alpha_bp, beta_bp)
    cdf = betaprime_cdf(xm, alpha_bp, beta_bp)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 9. BetaRectangular(alpha=0.5, beta=0.5, theta=0.9, a=5, b=25)
# PDF: (theta * beta_pdf((x-a)/(b-a)) + (1-theta)) / (b-a)
# CDF: theta * beta_cdf((x-a)/(b-a)) + (1-theta)*(x-a)/(b-a)
# ---------------------------------------------------------------------------

def betarect_pdf(x, alpha, beta, theta, a, b):
    t = (x - a) / (b - a)
    return (theta * beta_pdf(t, alpha, beta) + (1 - theta)) / (b - a)

def betarect_cdf(x, alpha, beta, theta, a, b):
    t = (x - a) / (b - a)
    return theta * beta_cdf(t, alpha, beta) + (1 - theta) * t

print("# BetaRectangular(alpha=0.5, beta=0.5, theta=0.9, a=5, b=25)")
alpha_br, beta_br = mpmath.mpf('0.5'), mpmath.mpf('0.5')
theta_br = mpmath.mpf('0.9')
a_br, b_br = mpmath.mpf('5'), mpmath.mpf('25')
xs_br = [5.5, 7.0, 10.0, 15.0, 18.0, 21.0, 24.5]
for x in xs_br:
    xm = mpmath.mpf(str(x))
    pdf = betarect_pdf(xm, alpha_br, beta_br, theta_br, a_br, b_br)
    cdf = betarect_cdf(xm, alpha_br, beta_br, theta_br, a_br, b_br)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 10. BirnbaumSaunders(mu=0, beta=0.5, gamma=0.5)
# CDF: ncdf((z - 1/z) / gamma) where z = sqrt((x-mu)/beta)
# PDF: (z + 1/z) / (2 * gamma * (x-mu)) * npdf((z-1/z)/gamma)
# ---------------------------------------------------------------------------

def bs_cdf(x, mu, beta, gamma):
    z = mpmath.sqrt((x - mu) / beta)
    return mpmath.ncdf((z - 1/z) / gamma)

def bs_pdf(x, mu, beta, gamma):
    z = mpmath.sqrt((x - mu) / beta)
    t = (z - 1/z) / gamma
    return (z + 1/z) * mpmath.npdf(t) / (2 * gamma * (x - mu))

print("# BirnbaumSaunders(mu=0, beta=0.5, gamma=0.5)")
mu_bs, beta_bs, gamma_bs = mpmath.mpf('0'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_bs = [0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
for x in xs_bs:
    xm = mpmath.mpf(str(x))
    pdf = bs_pdf(xm, mu_bs, beta_bs, gamma_bs)
    cdf = bs_cdf(xm, mu_bs, beta_bs, gamma_bs)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 11. BoundedPareto(L=1, H=10, alpha=0.5)
# PDF: alpha * (L/x)^alpha / (x * denom)
# CDF: (1 - L^alpha * x^(-alpha)) / denom
# denom = 1 - (L/H)^alpha
# ---------------------------------------------------------------------------

def boundedpareto_pdf(x, L, H, alpha):
    denom = 1 - (L/H)**alpha
    return alpha * (L/x)**alpha / (x * denom)

def boundedpareto_cdf(x, L, H, alpha):
    denom = 1 - (L/H)**alpha
    return (1 - L**alpha * x**(-alpha)) / denom

print("# BoundedPareto(L=1, H=10, alpha=0.5)")
L_bp2, H_bp2, alpha_bp2 = mpmath.mpf('1'), mpmath.mpf('10'), mpmath.mpf('0.5')
xs_bp2 = [1.01, 1.1, 1.5, 2.0, 3.0, 5.0, 8.0, 9.9]
for x in xs_bp2:
    xm = mpmath.mpf(str(x))
    pdf = boundedpareto_pdf(xm, L_bp2, H_bp2, alpha_bp2)
    cdf = boundedpareto_cdf(xm, L_bp2, H_bp2, alpha_bp2)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 12. Bradford(c=0.5)
# PDF: c / (log(1+c) * (1 + c*x))
# CDF: log(1 + c*x) / log(1 + c)
# ---------------------------------------------------------------------------

def bradford_pdf(x, c):
    log1pc = mpmath.log(1 + c)
    return c / (log1pc * (1 + c * x))

def bradford_cdf(x, c):
    log1pc = mpmath.log(1 + c)
    return mpmath.log(1 + c * x) / log1pc

print("# Bradford(c=0.5)")
c_brad = mpmath.mpf('0.5')
xs_brad = [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95]
for x in xs_brad:
    xm = mpmath.mpf(str(x))
    pdf = bradford_pdf(xm, c_brad)
    cdf = bradford_cdf(xm, c_brad)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 13. Burr(c=0.5, k=4)
# PDF: c*k * x^(c-1) / (1 + x^c)^(k+1)
# CDF: 1 - (1 + x^c)^(-k)
# ---------------------------------------------------------------------------

def burr_pdf(x, c, k):
    xc = x**c
    return c * k * xc / (x * (1 + xc)**(k+1))

def burr_cdf(x, c, k):
    return -mpmath.expm1(-k * mpmath.log1p(x**c))

print("# Burr(c=0.5, k=4)")
c_burr, k_burr = mpmath.mpf('0.5'), mpmath.mpf('4')
xs_burr = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
for x in xs_burr:
    xm = mpmath.mpf(str(x))
    pdf = burr_pdf(xm, c_burr, k_burr)
    cdf = burr_cdf(xm, c_burr, k_burr)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 14. Cauchy(mu=3, gamma=0.5)
# PDF: 1 / (pi * gamma * (1 + ((x-mu)/gamma)^2))
# CDF: 0.5 + atan((x-mu)/gamma) / pi
# ---------------------------------------------------------------------------

def cauchy_pdf(x, mu, gamma):
    t = (x - mu) / gamma
    return 1 / (pi * gamma * (1 + t**2))

def cauchy_cdf(x, mu, gamma):
    t = (x - mu) / gamma
    return mpmath.mpf('0.5') + mpmath.atan(t) / pi

print("# Cauchy(mu=3, gamma=0.5)")
mu_c, gamma_c = mpmath.mpf('3'), mpmath.mpf('0.5')
xs_c = [0, 1.0, 2.5, 3.0, 3.5, 4.0, 5.0, 8.0]
for x in xs_c:
    xm = mpmath.mpf(str(x))
    pdf = cauchy_pdf(xm, mu_c, gamma_c)
    cdf = cauchy_cdf(xm, mu_c, gamma_c)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 15. Chi2(k=2)
# PDF: x^(k/2-1) * exp(-x/2) / (2^(k/2) * Gamma(k/2))
# CDF: regularized lower incomplete gamma P(k/2, x/2)
# ---------------------------------------------------------------------------

def chi2_pdf(x, k):
    if x <= 0:
        return mpmath.mpf('0')
    alpha = k / 2
    return x**(alpha-1) * mpmath.exp(-x/2) / (2**alpha * mpmath.gamma(alpha))

def chi2_cdf(x, k):
    if x <= 0:
        return mpmath.mpf('0')
    return mpmath.gammainc(k/2, 0, x/2, regularized=True)

print("# Chi2(k=2)")
k_chi2 = mpmath.mpf('2')
xs_chi2 = [0.1, 0.5, 1.0, 2.0, 4.0, 6.0, 9.0]
for x in xs_chi2:
    xm = mpmath.mpf(str(x))
    pdf = chi2_pdf(xm, k_chi2)
    cdf = chi2_cdf(xm, k_chi2)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 16. Dagum(p=0.5, a=0.5, b=2)
# PDF: a*p/x * (x/b)^(ap) / ((x/b)^a + 1)^(p+1)
# CDF: (1 + (x/b)^(-a))^(-p)
# ---------------------------------------------------------------------------

def dagum_pdf(x, p, a, b):
    y = (x/b)**a
    return a * p * y**p / (x * (y + 1)**(p+1))

def dagum_cdf(x, p, a, b):
    return (1 + (x/b)**(-a))**(-p)

print("# Dagum(p=0.5, a=0.5, b=2)")
p_dag, a_dag, b_dag = mpmath.mpf('0.5'), mpmath.mpf('0.5'), mpmath.mpf('2')
xs_dag = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
for x in xs_dag:
    xm = mpmath.mpf(str(x))
    pdf = dagum_pdf(xm, p_dag, a_dag, b_dag)
    cdf = dagum_cdf(xm, p_dag, a_dag, b_dag)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 17. Davis(mu=1, b=2, n=3)
# Davis distribution with the Hurwitz zeta function.
# PDF: (1/Γ(n) * ζ(n, mu/b)) * (1/(x-mu+b))^(n+1) * exp(-mu/(x-mu+b))... hmm
# Actually, looking at the davis.js source...
# ---------------------------------------------------------------------------
# Let me look at the source file
print("# Davis: need to check source - skipping for now")
print()

# ---------------------------------------------------------------------------
# 18. DoubleGamma(alpha=0.5, beta=2)
# PDF(x) = Gamma(|x|; alpha, beta) / 2
# CDF(x) = (1 ± Gamma_cdf(|x|; alpha, beta)) / 2
# Gamma(x; alpha, beta): PDF = beta^alpha * x^(alpha-1) * exp(-beta*x) / Gamma(alpha)
#                        CDF = P(alpha, beta*x) = regularized lower incomplete gamma
# ---------------------------------------------------------------------------

def gamma_pdf(x, alpha, beta):
    if x < 0:
        return mpmath.mpf('0')
    return beta**alpha * x**(alpha-1) * mpmath.exp(-beta*x) / mpmath.gamma(alpha)

def gamma_cdf(x, alpha, beta):
    if x < 0:
        return mpmath.mpf('0')
    return mpmath.gammainc(alpha, 0, beta*x, regularized=True)

def doublegamma_pdf(x, alpha, beta):
    return gamma_pdf(abs(x), alpha, beta) / 2

def doublegamma_cdf(x, alpha, beta):
    y = gamma_cdf(abs(x), alpha, beta)
    return (1 + (1 if x > 0 else -1) * y) / 2

print("# DoubleGamma(alpha=0.5, beta=2)")
alpha_dg, beta_dg = mpmath.mpf('0.5'), mpmath.mpf('2')
xs_dg = [-3.0, -1.0, -0.5, -0.1, 0.1, 0.5, 1.0, 3.0]
for x in xs_dg:
    xm = mpmath.mpf(str(x))
    pdf = doublegamma_pdf(xm, alpha_dg, beta_dg)
    cdf = doublegamma_cdf(xm, alpha_dg, beta_dg)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 19. DoubleWeibull(lambda=2, k=0.5)
# Weibull: PDF = k/lambda * (x/lambda)^(k-1) * exp(-(x/lambda)^k)
#          CDF = 1 - exp(-(x/lambda)^k)
# DoubleWeibull: PDF(x) = Weibull(|x|) / 2, CDF(x) = (1 ± Weibull_cdf(|x|)) / 2
# ---------------------------------------------------------------------------

def weibull_pdf(x, lambda_, k):
    if x < 0:
        return mpmath.mpf('0')
    return k / lambda_ * (x / lambda_)**(k-1) * mpmath.exp(-(x/lambda_)**k)

def weibull_cdf(x, lambda_, k):
    if x < 0:
        return mpmath.mpf('0')
    return -mpmath.expm1(-(x/lambda_)**k)

def doubleweibull_pdf(x, lambda_, k):
    return weibull_pdf(abs(x), lambda_, k) / 2

def doubleweibull_cdf(x, lambda_, k):
    y = weibull_cdf(abs(x), lambda_, k)
    return (1 + (1 if x > 0 else -1) * y) / 2

print("# DoubleWeibull(lambda=2, k=0.5)")
lambda_dw, k_dw = mpmath.mpf('2'), mpmath.mpf('0.5')
xs_dw = [-4.0, -2.0, -0.5, -0.1, 0.1, 0.5, 2.0, 4.0]
for x in xs_dw:
    xm = mpmath.mpf(str(x))
    pdf = doubleweibull_pdf(xm, lambda_dw, k_dw)
    cdf = doubleweibull_cdf(xm, lambda_dw, k_dw)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 20. Erlang(k=2, lambda=0.5) -- same as Gamma(k=2, beta=0.5)
# ---------------------------------------------------------------------------

print("# Erlang(k=2, lambda=0.5) = Gamma(alpha=2, beta=0.5)")
k_erl, lambda_erl = mpmath.mpf('2'), mpmath.mpf('0.5')
xs_erl = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
for x in xs_erl:
    xm = mpmath.mpf(str(x))
    pdf = gamma_pdf(xm, k_erl, lambda_erl)
    cdf = gamma_cdf(xm, k_erl, lambda_erl)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 21. Exponential(lambda=0.5)
# PDF: lambda * exp(-lambda*x)
# CDF: 1 - exp(-lambda*x)
# ---------------------------------------------------------------------------

def exponential_pdf(x, lambda_):
    if x < 0:
        return mpmath.mpf('0')
    return lambda_ * mpmath.exp(-lambda_ * x)

def exponential_cdf(x, lambda_):
    if x < 0:
        return mpmath.mpf('0')
    return -mpmath.expm1(-lambda_ * x)

print("# Exponential(lambda=0.5)")
lambda_exp = mpmath.mpf('0.5')
xs_exp = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
for x in xs_exp:
    xm = mpmath.mpf(str(x))
    pdf = exponential_pdf(xm, lambda_exp)
    cdf = exponential_cdf(xm, lambda_exp)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 22. ExponentialLogarithmic(p=0.9, beta=0.5)
# PDF: beta * (1-p) * e^(-beta*x) / ((1-(1-p)*e^(-beta*x)) * log(p))
# Note: the code is: beta * y / ((y - 1) * log(p)) where y = (1-p)*exp(-beta*x)
# CDF: 1 - log(1 - (1-p)*exp(-beta*x)) / log(p)
# ---------------------------------------------------------------------------

def expl_pdf(x, p, beta):
    y = (1 - p) * mpmath.exp(-beta * x)
    return beta * y / ((y - 1) * mpmath.log(p))

def expl_cdf(x, p, beta):
    return 1 - mpmath.log(1 - (1-p) * mpmath.exp(-beta*x)) / mpmath.log(p)

print("# ExponentialLogarithmic(p=0.9, beta=0.5)")
p_el, beta_el = mpmath.mpf('0.9'), mpmath.mpf('0.5')
xs_el = [0.01, 0.1, 0.3, 0.5, 1.0, 2.0, 4.0]
for x in xs_el:
    xm = mpmath.mpf(str(x))
    pdf = expl_pdf(xm, p_el, beta_el)
    cdf = expl_cdf(xm, p_el, beta_el)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 23. ExponentiatedWeibull(lambda=0.5, k=0.5, alpha=0.5)
# Weibull CDF: Fw(x) = 1 - exp(-(x/lambda)^k)
# EW CDF: F(x) = Fw(x)^alpha
# EW PDF: f(x) = alpha * fw(x) * Fw(x)^((alpha-1)/alpha)
# Actually: f(x) = alpha * fw(x) * Fw(x)^(alpha-1) ... let me re-check
# From code: _cdf(x) = Weibull._cdf(x)^alpha
#            _pdf(x) = Weibull._pdf(x) * alpha * _cdf(x)^((alpha-1)/alpha)
# Wait: Weibull._pdf(x) * alpha * (_cdf(x))^((alpha-1)/alpha)
# Since _cdf(x) = Fw(x)^alpha, (_cdf(x))^((alpha-1)/alpha) = Fw(x)^(alpha-1)
# So: f(x) = fw(x) * alpha * Fw(x)^(alpha-1)
# ---------------------------------------------------------------------------

def expw_cdf(x, lambda_, k, alpha):
    if x <= 0:
        return mpmath.mpf('0')
    Fw = -mpmath.expm1(-(x/lambda_)**k)
    return Fw**alpha

def expw_pdf(x, lambda_, k, alpha):
    if x <= 0:
        return mpmath.mpf('0')
    fw = weibull_pdf(x, lambda_, k)
    Fw = -mpmath.expm1(-(x/lambda_)**k)
    return fw * alpha * Fw**(alpha - 1)

print("# ExponentiatedWeibull(lambda=0.5, k=0.5, alpha=0.5)")
lambda_ew, k_ew, alpha_ew = mpmath.mpf('0.5'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_ew = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
for x in xs_ew:
    xm = mpmath.mpf(str(x))
    pdf = expw_pdf(xm, lambda_ew, k_ew, alpha_ew)
    cdf = expw_cdf(xm, lambda_ew, k_ew, alpha_ew)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 24. F(d1=2, d2=20)
# PDF: (d1/d2)^(d1/2) * x^(d1/2-1) * (1 + d1*x/d2)^(-(d1+d2)/2) / B(d1/2, d2/2)
# CDF: I_{d1*x/(d1*x+d2)}(d1/2, d2/2)
# ---------------------------------------------------------------------------

def f_pdf(x, d1, d2):
    if x <= 0:
        return mpmath.mpf('0')
    a, b = d1/2, d2/2
    lB = mpmath.log(mpmath.beta(a, b))
    return mpmath.exp((a-1)*mpmath.log(x) + a*mpmath.log(d1/d2) - (a+b)*mpmath.log(1 + d1*x/d2) - lB)

def f_cdf(x, d1, d2):
    if x <= 0:
        return mpmath.mpf('0')
    t = d1 * x / (d1 * x + d2)
    return mpmath.betainc(d1/2, d2/2, 0, t, regularized=True)

print("# F(d1=2, d2=20)")
d1_f, d2_f = mpmath.mpf('2'), mpmath.mpf('20')
xs_f = [0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
for x in xs_f:
    xm = mpmath.mpf(str(x))
    pdf = f_pdf(xm, d1_f, d2_f)
    cdf = f_cdf(xm, d1_f, d2_f)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 25. Frechet(alpha=0.5, s=1, m=0)
# PDF: alpha * z^(-1-alpha) * exp(-z^(-alpha)) / s, where z = (x-m)/s
# CDF: exp(-z^(-alpha))
# ---------------------------------------------------------------------------

def frechet_pdf(x, alpha, s, m):
    if x <= m:
        return mpmath.mpf('0')
    z = (x - m) / s
    return alpha * z**(-1-alpha) * mpmath.exp(-z**(-alpha)) / s

def frechet_cdf(x, alpha, s, m):
    if x <= m:
        return mpmath.mpf('0')
    z = (x - m) / s
    return mpmath.exp(-z**(-alpha))

print("# Frechet(alpha=0.5, s=1, m=0)")
alpha_fr, s_fr, m_fr = mpmath.mpf('0.5'), mpmath.mpf('1'), mpmath.mpf('0')
xs_fr = [0.1, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
for x in xs_fr:
    xm = mpmath.mpf(str(x))
    pdf = frechet_pdf(xm, alpha_fr, s_fr, m_fr)
    cdf = frechet_cdf(xm, alpha_fr, s_fr, m_fr)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 26. Gamma(alpha=0.5, beta=0.5) (beta is rate)
# ---------------------------------------------------------------------------

print("# Gamma(alpha=0.5, beta=0.5)")
alpha_gam, beta_gam = mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gam = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
for x in xs_gam:
    xm = mpmath.mpf(str(x))
    pdf = gamma_pdf(xm, alpha_gam, beta_gam)
    cdf = gamma_cdf(xm, alpha_gam, beta_gam)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 27. GammaGompertz(b=0.5, s=0.5, beta=0.5)
# PDF: b*s*exp(b*x) * beta^s / (beta - 1 + exp(b*x))^(s+1)
# CDF: 1 - (beta / (beta - 1 + exp(b*x)))^s
# ---------------------------------------------------------------------------

def gammagompertz_pdf(x, b, s, beta):
    y = mpmath.exp(b * x)
    return b * s * y * beta**s / (beta - 1 + y)**(s+1)

def gammagompertz_cdf(x, b, s, beta):
    return -mpmath.expm1(-s * mpmath.log1p(mpmath.expm1(b*x) / beta))

print("# GammaGompertz(b=0.5, s=0.5, beta=0.5)")
b_gg, s_gg, beta_gg = mpmath.mpf('0.5'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gg = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0]
for x in xs_gg:
    xm = mpmath.mpf(str(x))
    pdf = gammagompertz_pdf(xm, b_gg, s_gg, beta_gg)
    cdf = gammagompertz_cdf(xm, b_gg, s_gg, beta_gg)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 28. GeneralizedExponential(a=2, b=0.5, c=4)
# PDF: (a + b*(1-exp(-c*x))) * exp(-(a+b)*x + b/c*(1-exp(-c*x)))
# CDF: 1 - exp(-(a+b)*x - b*expm1(-c*x)/c)
# ---------------------------------------------------------------------------

def genexp_pdf(x, a, b, c):
    z = b * (1 - mpmath.exp(-c * x))
    return (a + z) * mpmath.exp(-(a + b) * x + z / c)

def genexp_cdf(x, a, b, c):
    return -mpmath.expm1(-(a + b) * x - b * mpmath.expm1(-c * x) / c)

print("# GeneralizedExponential(a=2, b=0.5, c=4)")
a_ge, b_ge, c_ge = mpmath.mpf('2'), mpmath.mpf('0.5'), mpmath.mpf('4')
xs_ge = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0]
for x in xs_ge:
    xm = mpmath.mpf(str(x))
    pdf = genexp_pdf(xm, a_ge, b_ge, c_ge)
    cdf = genexp_cdf(xm, a_ge, b_ge, c_ge)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 29. GeneralizedGamma(a=0.5, d=0.5, p_shape=0.5)
# PDF: p_shape/a^d * x^(d-1) / Gamma(d/p_shape) * exp(-(x/a)^p_shape)
# CDF: P(d/p_shape, (x/a)^p_shape)
# Note: ranjs uses GeneralizedGamma as: Gamma(alpha=d/p, beta=a^(-p)) with X = Y^(1/p)
# So CDF_GenGamma(x) = CDF_Gamma(x^p; d/p, a^(-p)) = P(d/p, (x/a)^p)
# ---------------------------------------------------------------------------

def gengamma_pdf(x, a, d, p_shape):
    alpha_gg = d / p_shape
    beta_gg = a**(-p_shape)
    # PDF = p * x^(p-1) * GammaPDF(x^p; alpha, beta)
    xp = x**p_shape
    gpdf = gamma_pdf(xp, alpha_gg, beta_gg)
    return p_shape * x**(p_shape - 1) * gpdf

def gengamma_cdf(x, a, d, p_shape):
    alpha_gg = d / p_shape
    beta_gg = a**(-p_shape)
    xp = x**p_shape
    return gamma_cdf(xp, alpha_gg, beta_gg)

print("# GeneralizedGamma(a=0.5, d=0.5, p_shape=0.5)")
a_gengam, d_gengam, p_gengam = mpmath.mpf('0.5'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gengam = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
for x in xs_gengam:
    xm = mpmath.mpf(str(x))
    pdf = gengamma_pdf(xm, a_gengam, d_gengam, p_gengam)
    cdf = gengamma_cdf(xm, a_gengam, d_gengam, p_gengam)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 30. GeneralizedLogistic(mu=3, s=0.5, c=0.5)
# PDF: c * exp(-z) / (s * (1 + exp(-z))^(c+1)), z = (x-mu)/s
# CDF: (1 + exp(-z))^(-c)
# ---------------------------------------------------------------------------

def genlogistic_pdf(x, mu, s, c):
    z = (x - mu) / s
    ez = mpmath.exp(-z)
    return c * ez / (s * (1 + ez)**(c+1))

def genlogistic_cdf(x, mu, s, c):
    z = (x - mu) / s
    return (1 + mpmath.exp(-z))**(-c)

print("# GeneralizedLogistic(mu=3, s=0.5, c=0.5)")
mu_gl, s_gl, c_gl = mpmath.mpf('3'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gl = [0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0]
for x in xs_gl:
    xm = mpmath.mpf(str(x))
    pdf = genlogistic_pdf(xm, mu_gl, s_gl, c_gl)
    cdf = genlogistic_cdf(xm, mu_gl, s_gl, c_gl)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 31. GeneralizedNormal(mu=3, alpha=0.5, beta=0.5)
# PDF: beta/(2*alpha*Gamma(1/beta)) * exp(-(|x-mu|/alpha)^beta)
# CDF: 0.5 * (1 + sign(x-mu) * P(1/beta, (|x-mu|/alpha)^beta))
# where P(a,x) = regularized lower incomplete gamma
# ---------------------------------------------------------------------------

def gennorm_pdf(x, mu, alpha, beta):
    lnorm = mpmath.log(beta) - mpmath.log(2*alpha) - mpmath.loggamma(1/beta)
    return mpmath.exp(lnorm - (abs(x - mu) / alpha)**beta)

def gennorm_cdf(x, mu, alpha, beta):
    t = abs(x - mu) / alpha
    reg = mpmath.gammainc(1/beta, 0, t**beta, regularized=True)
    return mpmath.mpf('0.5') * (1 + (1 if x > mu else -1) * reg)

print("# GeneralizedNormal(mu=3, alpha=0.5, beta=0.5)")
mu_gn, alpha_gn, beta_gn = mpmath.mpf('3'), mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gn = [1.0, 2.0, 2.5, 3.5, 4.0, 5.0, 7.0]
for x in xs_gn:
    xm = mpmath.mpf(str(x))
    pdf = gennorm_pdf(xm, mu_gn, alpha_gn, beta_gn)
    cdf = gennorm_cdf(xm, mu_gn, alpha_gn, beta_gn)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 32. Gompertz(eta=0.5, b=0.5)
# PDF: b*eta * exp(eta + b*x - eta*exp(b*x))
# CDF: 1 - exp(-eta * (exp(b*x) - 1))
# ---------------------------------------------------------------------------

def gompertz_pdf(x, eta, b):
    return b * eta * mpmath.exp(eta + b*x - eta*mpmath.exp(b*x))

def gompertz_cdf(x, eta, b):
    return -mpmath.expm1(-eta * mpmath.expm1(b*x))

print("# Gompertz(eta=0.5, b=0.5)")
eta_g, b_g = mpmath.mpf('0.5'), mpmath.mpf('0.5')
xs_gom = [0.1, 0.5, 1.0, 2.0, 4.0, 7.0, 12.0]
for x in xs_gom:
    xm = mpmath.mpf(str(x))
    pdf = gompertz_pdf(xm, eta_g, b_g)
    cdf = gompertz_cdf(xm, eta_g, b_g)
    print(make_entry(x, pdf, cdf))

print()

# ---------------------------------------------------------------------------
# 33. Gumbel(mu=3, beta=0.5)
# PDF: exp(-(z + exp(-z))) / beta, z = (x-mu)/beta
# CDF: exp(-exp(-z))
# ---------------------------------------------------------------------------

def gumbel_pdf(x, mu, beta):
    z = (x - mu) / beta
    return mpmath.exp(-(z + mpmath.exp(-z))) / beta

def gumbel_cdf(x, mu, beta):
    z = (x - mu) / beta
    return mpmath.exp(-mpmath.exp(-z))

print("# Gumbel(mu=3, beta=0.5)")
mu_gum, beta_gum = mpmath.mpf('3'), mpmath.mpf('0.5')
xs_gum = [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
for x in xs_gum:
    xm = mpmath.mpf(str(x))
    pdf = gumbel_pdf(xm, mu_gum, beta_gum)
    cdf = gumbel_cdf(xm, mu_gum, beta_gum)
    print(make_entry(x, pdf, cdf))
