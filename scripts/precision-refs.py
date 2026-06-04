"""
Reference value generation for test/precision.js special-function precision gate.
All values computed at mp.dps = 70 (70 decimal places) to ensure 50+ accurate digits.

Requires: pip install mpmath
Usage:    python3 test/precision-refs.py
"""
from mpmath import mp, gammainc, erf, erfc, erfinv, besseli, digamma, loggamma, gamma
from mpmath import betainc, lambertw, zeta, hyp1f1, pi, exp, factorial, inf, findroot, quad

mp.dps = 70


def marcumQ(mu, x, y):
    """Generalized Marcum Q-function Q_mu(x, y) via Poisson-weighted upper-gamma series.

    mpmath has no built-in marcumq, so this uses the standard series expansion:
      Q_mu(x, y) = sum_{k=0}^inf exp(-x^2/2) * (x^2/2)^k / k! * Q(mu+k, y^2/2)
    where Q(a, z) is the regularized upper incomplete gamma function.
    """
    a2 = x**2 / 2
    b2 = y**2 / 2
    result = mp.mpf(0)
    k = 0
    while True:
        term = exp(-a2) * a2**k / factorial(k) * gammainc(mu + k, b2, inf, regularized=True)
        result += term
        if abs(term) < mp.mpf('1e-60') * (abs(result) + mp.mpf('1e-300')):
            break
        k += 1
        if k > 500:
            break
    return result


def owenT(h, a):
    """Owen T function T(h, a) = 1/(2pi) * integral_0^a exp(-h^2*(1+x^2)/2) / (1+x^2) dx.

    mpmath has no built-in owenT, so this uses direct quadrature.
    """
    return 1 / (2 * pi) * quad(
        lambda x: exp(-h**2 * (1 + x**2) / 2) / (1 + x**2),
        [0, a],
        maxdegree=10
    )


print('=== gammaLowerIncomplete(s, x) = P(s, x) regularized ===')
print(gammainc(2.0, 0, 1.0, regularized=True))    # 0.26424111765711535680895245...
print(gammainc(3.0, 0, 2.0, regularized=True))    # 0.32332358381693654053000252...
print(gammainc(0.5, 0, 0.5, regularized=True))    # 0.68268949213708589717046509...
# CF path (x >= s+1):
print(gammainc(2.0, 0, 5.0, regularized=True))    # 0.9595723180054871...   P(2,5)
print(gammainc(0.5, 0, 2.0, regularized=True))    # 0.9544997361036416...   P(0.5,2)

print('\n=== gammaUpperIncomplete(s, x) = Q(s, x) regularized ===')
print(gammainc(2.0, 1.0, regularized=True))       # 0.73575888234288464319104754...
print(gammainc(3.0, 2.0, regularized=True))       # 0.67667641618306345946999747...
print(gammainc(0.5, 0.5, regularized=True))       # 0.31731050786291410282953490...
# CF path (x >= s+1):
print(gammainc(2.0, 5.0, regularized=True))       # 0.040427681994512805...   Q(2,5)

print('\n=== gammaLowerIncompleteInv(a, p) ===')
print(findroot(lambda x: gammainc(2.0, 0, x, regularized=True) - 0.5, 1))     # 1.6783469900166606...
print(findroot(lambda x: gammainc(3.0, 0, x, regularized=True) - 0.8, 4))     # 4.2790298601253339...
print(findroot(lambda x: gammainc(1.0, 0, x, regularized=True) - 0.3, 0.5))   # 0.3566749439387323...
# a < 1: fallback initial estimate
print(findroot(lambda x: gammainc(0.5, 0, x, regularized=True) - 0.5, 0.5))   # 0.2274682115597864...
# Near p=1
print(findroot(lambda x: gammainc(0.5, 0, x, regularized=True) - 0.95, 1))    # 1.9207294103470622...

print('\n=== betaIncomplete(a, b, x) - unnormalized B(a,b,x) ===')
print(betainc(2.0, 3.0, 0, 0.5))          # 0.05729166666666666...
print(betainc(1.5, 2.5, 0, 0.3))          # 0.08162011893537471...
print(betainc(0.5, 0.5, 0, 0.4))          # 1.3694384060045658...
# Near branch switch at (a+1)/(a+b+2) = 3/7 ≈ 0.429 (forward side):
print(betainc(2.0, 3.0, 0, 0.4))          # 0.04373333333333334...   B(2,3,0.4)

print('\n=== regularizedBetaIncomplete(a, b, x) = I_x(a,b) ===')
print(betainc(2.0, 3.0, 0, 0.5, regularized=True))    # 0.6875
print(betainc(1.5, 2.5, 0, 0.3, regularized=True))    # 0.41568785229802532...
print(betainc(0.5, 0.5, 0, 0.4, regularized=True))    # 0.43590578315102508...
# Backward branch (x > (a+1)/(a+b+2)):
print(betainc(2.0, 3.0, 0, 0.7, regularized=True))    # 0.9163...   I_0.7(2,3)
print(betainc(0.5, 0.5, 0, 0.5, regularized=True))    # 0.5 exactly by symmetry

print('\n=== erf(x) ===')
print(erf(1.0))    # 0.84270079294971486...
print(erf(0.5))    # 0.52049987781304653...
print(erf(3.0))    # 0.99997790950300141...
# Reflection: erf(-x) = -erf(x)
print(erf(-2.0))   # -0.9953222650189527...   reflection path
# Near 1 (CF branch):
print(erf(5.0))    # 0.9999999999984626...   near-1 CF branch

print('\n=== erfc(x) ===')
print(erfc(1.0))   # 0.15729920705028513...
print(erfc(2.0))   # 0.00467773498104726...
print(erfc(5.0))   # 1.5374597944280348e-12
# Reflection: erfc(-x) = 1 + erf(x)
print(erfc(-1.0))  # 1.8427007929497148...   reflection path
# Deep tail:
print(erfc(10.0))  # 2.088487583762545e-45   deep tail

print('\n=== erfinv(x) ===')
print(erfinv(0.5))    # 0.47693627620446987...
print(erfinv(0.9))    # 1.16308715367667408...
print(erfinv(-0.5))   # -0.47693627620446987...
# Near-pole (Newton iteration must work hard):
print(erfinv(0.99))   # 1.8213863677184494...   near +1
print(erfinv(-0.99))  # -1.8213863677184494...  near -1

print('\n=== besselI(n, x) - small argument ===')
print(besseli(0, 1.0))   # 1.26606587775200833...
print(besseli(1, 2.0))   # 1.59063685463732906...
print(besseli(2, 5.3))   # 23.54248570460479015...
# Boundary I_0(0) = 1:
print(besseli(0, 0.0))   # 1.0 exactly
# Sign flip odd n, negative x:
print(besseli(1, -3.0))  # -3.9533702174026093...   I_1(-3) = -I_1(3)
# Even n: I_n(-x) = I_n(x):
print(besseli(2, -3.0))  # 2.245212440929951...    I_2(-3) = I_2(3)

print('\n=== besselI(n, x) - large argument ===')
print(besseli(0, 10.0))   # 2815.71662846625447...
print(besseli(1, 15.0))   # 328124.92197020639673...
print(besseli(3, 20.0))   # 34592416.34091961893...

print('\n=== digamma(z) ===')
print(digamma(1.0))    # -0.57721566490153286...
print(digamma(2.0))    # 0.42278433509846713...
print(digamma(0.5))    # -1.96351002602142347...
# Negative non-integer: reflection branch
print(digamma(-0.5))   # 0.03648997397857652...   reflection path
# Large z: direct Stirling asymptotic
print(digamma(10.0))   # 2.251752589066721...      direct Stirling (no shift steps)

print('\n=== logGamma(z) ===')
print(loggamma(0.5))    # 0.57236494292470008...
print(loggamma(1.5))    # -0.12078223763524522...
print(loggamma(10.0))   # 12.80182748008146961...
# z < 0.5 positive: reflection path
print(loggamma(0.3))    # 1.0957979948180756...    positive reflection
# Negative non-integer: ln|Γ(z)| = log(fabs(gamma(z)))
from mpmath import fabs
print(mp.log(fabs(gamma(mp.mpf('-0.5')))))  # 1.2655121234846454...   ln|Γ(-0.5)|
# Large argument: Stirling asymptotic
print(loggamma(100.0))  # 359.1342053695754...     Stirling without reflection

print('\n=== gamma(z) ===')
print(gamma(0.5))    # 1.77245385090551602...
print(gamma(1.5))    # 0.88622692545275801...
print(gamma(-1.5))   # 2.36327180120735470...
# z < 0.5 positive: reflection path
print(gamma(0.1))    # 9.51350769866873...         reflection path
# Exact integer (Lanczos, z >= 0.5): 4! = 24
print(gamma(5.0))    # 24.0 exactly
# Negative between poles: sign-corrected reflection
print(gamma(-2.5))   # -0.9453087204829419...      sign-corrected reflection

print('\n=== lambertW0(z) ===')
print(lambertw(1.0, 0))    # 0.56714329040978387...
print(lambertw(0.5, 0))    # 0.35173371124919582...
print(lambertw(10.0, 0))   # 1.74552800274069938...
# Small z < 1 (initial estimate w0=0):
print(lambertw(0.1, 0))    # 0.09127652716086226...
# Large z (initial estimate w0=log(z)):
print(lambertw(100.0, 0))  # 3.38563014029005...
# Near branch point -1/e ≈ -0.3679 (w0=0 path for z < 1):
print(lambertw(-0.35, 0))  # -0.7166388164560736...

print('\n=== lambertW1m(z) - W_{-1} branch ===')
print(lambertw(-0.1, -1))   # -3.57715206395729721...
print(lambertw(-0.2, -1))   # -2.54264135777352642...
print(lambertw(-0.3, -1))   # -1.78133702342162761...
# Laurent log initial estimate (z >= -0.1):
print(lambertw(-0.001, -1)) # -9.11800647040274...   Laurent path
# Branch-point series initial estimate (z < -0.1), near -1/e:
print(lambertw(-0.36, -1))  # -1.2227701339785062... branch-point series

print('\n=== riemannZeta(s) ===')
print(zeta(2.0))              # 1.64493406684822643...
print(zeta(3.0))              # 1.20205690315959428...
print(zeta(mp.mpf('1.001')))  # 1000.57728847590149...  (near pole, Laurent expansion)
# Alternating series path (s outside Laurent window):
print(zeta(0.5))              # -1.4603545088095868...  Borwein alternating series
# Large s:
print(zeta(10.0))             # 1.000994575127818...    rapidly convergent

print('\n=== hurwitzZeta(s, a) ===')
print(zeta(2.0, 1.0))                              # 1.64493406684822643...
print(zeta(2.0, 0.5))                              # 4.93480220054467930...
print(zeta(mp.mpf('1.001'), mp.mpf('0.5')))        # 1001.96486397024572...  (near pole)
# s=3: faster converging but n_min=20 Euler-Maclaurin still limits to ~1e-9
print(zeta(3.0, 1.0))                              # 1.2020569031595942...   hurwitzZeta(3,1)
# Large s: very rapidly convergent
print(zeta(10.0, 1.0))                             # 1.000994575127818...    hurwitzZeta(10,1)

print('\n=== f11(a, b, z) - confluent hypergeometric 1F1 ===')
print(hyp1f1(1.0, 2.0, 1.0))     # 1.71828182845904523...
print(hyp1f1(0.5, 1.5, -1.0))    # 0.74682413281242702...
print(hyp1f1(2.0, 3.0, 2.0))     # 4.19452804946532511...
# a=b identity: 1F1(a,a,z) = e^z
print(hyp1f1(1.0, 1.0, 2.0))     # 7.38905609893065...   e^2, Taylor series path
# Large z: asymptotic path (|z| >= 50)
print(hyp1f1(1.0, 2.0, 60.0))    # 1.903345649692807e+24  asymptotic
print(hyp1f1(2.0, 3.0, 50.0))    # 2.0324045672061324e+20 asymptotic boundary

print('\n=== marcumQ(mu, x, y) via custom series (half-squared convention) ===')
# ranjs marcumQ(mu, x, y) = Q_mu(sqrt(2x), sqrt(2y)) in standard Nuttall notation.
# Pass a=sqrt(2x), b=sqrt(2y) to the mpmath helper below.
from mpmath import sqrt
print(marcumQ(1, sqrt(2), sqrt(2)))   # marcumQ(1,1,1): Q_1(√2,√2) = 0.65425416127683562...
print(marcumQ(1, 2.0, sqrt(6)))       # marcumQ(1,2,3): Q_1(2,√6) = 0.41471058523413...
print(marcumQ(2, sqrt(3), 2.0))       # marcumQ(2,1.5,2): Q_2(√3,2) = 0.71592586809760200...
# x=0 special case: ranjs returns gammaUpperIncomplete(mu, y) where y is the ranjs arg
print(gammainc(1, mp.mpf('2'), inf, regularized=True))   # 0.1353352832366127...   marcumQ(1,0,2)
print(gammainc(2, mp.mpf('3'), inf, regularized=True))   # 0.19914827347145578...  marcumQ(2,0,3)
# Large-xi asymptotic path: x>=30, xi=2*sqrt(x*y)>30, mu^2 < 2*xi
print(marcumQ(1, sqrt(70), sqrt(60)))                    # 0.7526618893265659...   marcumQ(1,35,30)

print('\n=== owenT(h, a) via custom quadrature ===')
print(owenT(1.0, 0.5))   # 0.04306469112078536...
print(owenT(2.0, 1.0))   # 0.01111628172225982...
print(owenT(0.5, 2.0))   # 0.14158060365397839...
# h=0 closed form: T(0,a) = arctan(a)/(2*pi)
from mpmath import atan
print(atan(1) / (2 * pi))  # 0.125 exactly  T(0,1) = 1/8
# Outer branch: |a| > 1 and |h| > 0.67
print(owenT(1.0, 2.0))   # 0.0784681869930841...   T(1,2) outer dispatch branch

print('\n=== besselInu(nu, x) - fractional order ===')
print(besseli(0.5, 1.0))    # 0.9376748882454876...
print(besseli(1.5, 2.0))    # 1.0994731886331097...
print(besseli(2.3, 3.0))    # 1.787657392247681...
# Small x: leading-term (x/2)^nu dominance
print(besseli(0.5, 0.1))    # 0.25273398460013197...   small x
print(besseli(1.5, 0.1))    # 0.00841885518609277...   small x

print('\n=== besselISpherical(n, x) = sqrt(pi/(2x)) * I_{n+0.5}(x) ===')
def spherical_besseli(n, x):
    return mp.sqrt(pi / (2 * x)) * besseli(n + mp.mpf('0.5'), x)

print(spherical_besseli(0, 1.0))   # 1.1752011936438014...  i_0(1) = sinh(1)/1
print(spherical_besseli(1, 0.5))   # 0.17087070843777213...  i_1(0.5) Taylor path (|x|<1)
print(spherical_besseli(2, 3.0))   # 1.096501524700701...   i_2(3) Wronskian path (|x|>=1)
# n=0 large: closed-form sinh(x)/x
print(spherical_besseli(0, 5.0))   # 14.840642115557753...  i_0(5) closed form
# n=1 large: direct formula path (|x|>=1)
print(spherical_besseli(1, 5.0))   # 11.873861281846018...  i_1(5) direct formula
# n>=2 small: Taylor series (|x|<1)
print(spherical_besseli(2, 0.5))   # 0.01696636036086198... i_2(0.5) Taylor
# n=3: Wronskian path (|x|>=1)
print(spherical_besseli(3, 2.0))   # 0.09474252219651647... i_3(2) Wronskian

print('\n=== beta(x, y) = exp(loggamma(x)+loggamma(y)-loggamma(x+y)) ===')
from mpmath import beta as mpbeta
print(mpbeta(2.0, 3.0))    # 0.08333333333333333...  = 1/12
print(mpbeta(0.5, 0.5))    # 3.14159265358979323...  = pi
print(mpbeta(1.5, 2.5))    # 0.19634954084936207...
# Large integer arguments:
print(mpbeta(5.0, 11.0))   # 6.66000666000666e-05...   B(5,11)

print('\n=== logBeta(x, y) = loggamma(x)+loggamma(y)-loggamma(x+y) ===')
print(loggamma(2.0) + loggamma(3.0) - loggamma(5.0))    # -2.4849066497880004...  = log(1/12)
print(loggamma(0.5) + loggamma(0.5) - loggamma(1.0))    # 1.1447298858494002...   = log(pi)
print(loggamma(1.5) + loggamma(2.5) - loggamma(4.0))    # -1.627858836390381...
# Larger integer arguments:
print(loggamma(5.0) + loggamma(11.0) - loggamma(16.0))  # -9.616804980417431...   logB(5,11)

print('\n=== logBinomial(n, k) = loggamma(n+1)-loggamma(k+1)-loggamma(n-k+1) ===')
print(loggamma(11) - loggamma(4) - loggamma(8))    # 4.787491742782046...   = log C(10,3) = log(120)
print(loggamma(21) - loggamma(8) - loggamma(14))   # 11.258291246564648...  = log C(20,7) = log(77520)
print(loggamma(6) - loggamma(3) - loggamma(4))     # 2.302585092994046...   = log C(5,2) = log(10)
# Large n:
print(loggamma(51) - loggamma(26) - loggamma(26))  # 32.47055650581199...   = log C(50,25)

print('\n=== generalizedHarmonic(n, m) = sum_{k=1}^n k^{-m} ===')
print(sum(mp.mpf(1)/k**2 for k in range(1, 6)))     # 1.4636111111111112...  H(5,2)  direct-sum path (n<10)
print(sum(mp.mpf(1)/k**3 for k in range(1, 21)))    # 1.2008678419584369...  H(20,3) zeta path (n>=10)
print(sum(mp.mpf(1)/k**2 for k in range(1, 16)))    # 1.580440283444987...   H(15,2) zeta path (n>=10)
# m=1 harmonic number: H(5,1) = 1+1/2+1/3+1/4+1/5 = 137/60
print(sum(mp.mpf(1)/k for k in range(1, 6)))        # 2.283333333333333...  H(5,1) direct-sum path

print('\n=== marcumP(mu, x, y) = 1 - marcumQ(mu, x, y) (half-squared convention) ===')
print(1 - marcumQ(1, sqrt(2), sqrt(2)))    # 0.3457458387231645...  P_1(1,1)
print(1 - marcumQ(1, 2.0, sqrt(6)))        # 0.58528941476587...    P_1(2,3)
print(1 - marcumQ(2, sqrt(3), 2.0))        # 0.284074131902398...   P_2(1.5,2)
# x=0 special case: ranjs returns gammaLowerIncomplete(mu, y)
print(gammainc(1, 0, mp.mpf('2'), regularized=True))   # 0.8646647167633873...   marcumP(1,0,2)
print(gammainc(2, 0, mp.mpf('3'), regularized=True))   # 0.8008517265285442...   marcumP(2,0,3)
