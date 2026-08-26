"""
Reference value generation for test/precision-special.js (issue #1140).

All reference values are mpmath (mp.dps = 50) evaluations of besselI, besselISpherical,
besselIExpScaled, besselISphericalExpScaled, besselInu, besselK, besselKnu, and digamma,
rounded to the nearest float64 (shortest round-tripping decimal) and emitted as JS literals.

Unlike scripts/precision-refs-continuous.py / -discrete.py, there is no existing
independently-vetted reference file (analogous to test/dist-cases-*.js) to self-check the
generator against for bare special functions -- so this script's own --check step IS the
check: it evaluates ranjs's own src/special/ implementation (via scripts/eval-special.js, a
small Node/@babel-register bridge, mirroring the dump-dist-cases-json.js precedent) at every
grid point and reports any mismatch beyond that point's tolerance.

Because there is no second reference source, review this generator's own reference formulas
(besselISpherical_ref etc.) with the same rigor as production code: confirm the grid actually
exercises every special case those formulas branch on (e.g. x=0, negative-order divergence),
not just every branch in src/special/bessel.js/digamma.js -- a wrong x=0 guard in
this file is exactly as dangerous as a bug in the code under test. See
solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md

The grid is deliberately threshold-focused rather than a brute-force Cartesian sweep: every
documented internal dispatch threshold in src/special/bessel.js and src/special/digamma.js
gets a small cluster of points straddling it (issue #1185 was found exactly this way -- a
bug in the (10, 14] band around besselI(0, x)'s crossover), supplemented by a modest spread
of interior points per branch. Reference math (the i_n(x) = sqrt(pi/(2x))*I_{n+1/2}(x)
spherical-Bessel identity, the direct besseli/besselk/digamma calls) is independent of ranjs's
own algorithms (Taylor series, Miller backward recurrence, Wronskian recurrence, DLMF
asymptotic expansions) -- per CLAUDE.md, the test must never share a formula with the
production code it's checking.

Requires: pip install mpmath (already in scripts/requirements.txt)
Usage: python3 scripts/precision-refs-special.py --check   # report mismatches only
       python3 scripts/precision-refs-special.py --emit    # write test/precision-special.js
"""
import json
import os
import subprocess
import sys

from mpmath import mp, mpf, pi, sqrt, exp, log, besseli, besselk
from mpmath import digamma as mp_digamma
from mpmath import gamma as mp_gamma, beta as mp_beta, gammainc, betainc
from mpmath import binomial as mp_binomial, inf

mp.dps = 50

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'test', 'precision-special.js')
EVAL_SCRIPT = os.path.join(REPO_ROOT, 'scripts', 'eval-special.js')

DEFAULT_TOL = 1e-13

# Named-mechanism tolerances (mirrors precision-refs-continuous.py's _N_SERIES/_N_ERFC/NOTES
# convention): a grid cluster only gets a looser tolerance than DEFAULT_TOL when --check has
# empirically confirmed the gap and the mechanism is understood -- never a blind loosening.
_N_KASYMP_INSIDE = ('x is within the series branch (x<=6) but close enough to the x=6 '
                     '_X_K_SERIES crossover that the combined-series form loses a few extra '
                     'ULP beyond the 1e-13 default')
_N_KASYMP_NEAR = ('x is just past the _X_K_SERIES=6 series/asymptotic crossover, where '
                   '_KAsymptotic\'s optimal-truncation error has not yet converged past ~1e-7 '
                   '-- this is the known, previously-unquantified gap flagged in todo.md '
                   '("asymptotic expansions... accuracy degrades near the transition region"); '
                   'accuracy improves to ~1e-10 by x=10')
_N_KNU_CONNECTION = ('x<=6 connection formula (pi/2)*(I_{-nu}-I_nu)/sin(pi*nu) subtracts two '
                      'comparable-magnitude terms, losing a few extra ULP beyond the 1e-13 '
                      'default')
_N_KNU_NEAR_INTEGER = ('nu is close enough to an integer that sin(pi*nu) in the connection-'
                        'formula denominator amplifies floating-point noise, even just outside '
                        'the hard 1e-8 snap-to-besselK threshold')

# x=10 is far enough past the x=6 _X_K_SERIES crossover that _KAsymptotic's optimal-truncation
# error has converged much closer to machine precision than the 2e-6 just-past-crossover
# tolerance above -- measured empirically via --check (see todo.md's "accuracy improves to
# ~1e-10 by x=10"): besselK's worst observed rel error across n in {0,1,2,3,5} is ~1.87e-10
# and besselKnu's worst observed rel error across nu in {+-0.5,...,+-3.3} is ~1.09e-10, so
# 1e-9 gives >5x headroom over the measured worst case while still being ~1500x tighter than
# the 2e-6 just-past-crossover bucket, catching a real regression that degrades accuracy here.
_TOL_KASYMP_X10 = 1e-9
_TOL_KNUASYMP_X10 = 1e-9

# Issue #1361 sweep (nu in [3,10], x in [6,15]): same _KAsymptotic optimal-truncation mechanism
# as _N_KASYMP_NEAR/_TOL_KNUASYMP_X10 above, re-measured at larger nu now that the order-
# reduction fix routes it through the same base-order asymptotic evaluation. Measured via
# --check against the actual sweep grid below: worst rel error 6.19e-8 at nu=8.25, x=6.01 (x in
# {6.01,7.18,9.0} tier) and 1.11e-12 at nu=7.0, x=12.5 (x in {10,12.5} tier uses the tighter of
# _TOL_KNUASYMP_X10 at x=10 and this at x=12.5); x=15 already converges within the 1e-13
# default and needs no override.
_TOL_KNU_1361_NEAR = 2e-7
_TOL_KNU_1361_X12_5 = 2e-12

# Issue #1271 gamma/beta cluster: beta(x,y)'s logGamma-fallback path (Math.exp(logGamma(x)
# +logGamma(y)-logGamma(x+y))) subtracts three O(log(large)) magnitude terms down to a much
# smaller result when x and y differ by orders of magnitude -- measured via --check: rel error
# 1.82e-13 at beta(10.5, 200.2). >2x headroom over the measured value.
_TOL_BETA_WIDE_MAGNITUDE = 4e-13
# logBeta(x,y) = logGamma(x)+logGamma(y)-logGamma(x+y): same three-term-subtraction mechanism
# as _TOL_BETA_WIDE_MAGNITUDE, here reached via a negative non-integer argument's reflection
# formula rather than a wide-magnitude split. Measured: rel error 1.49e-13 at
# logBeta(0.4, -0.3).
_TOL_LOGBETA_REFLECTION = 3e-13
# betaIncomplete/regularizedBetaIncomplete's backward branch (B(a,b)-B(b,a,1-x) or
# 1-I_{1-x}(b,a)) subtracts two comparable-magnitude terms when a>>b and x is very close to 1
# -- the same cancellation mechanism issue #675's fix already documented (see
# solutions/special-functions/2026-06-04-1805-betaIncomplete-backward-branch-complement-
# constant.md), re-measured here at more extreme parameters. Measured via --check: worst rel
# error 1.21e-12 at (a,b,x)=(100,0.01,0.9999); >2x headroom over the measured value.
_TOL_BETAINCOMPLETE_BACKWARD_CANCELLATION = 3e-12

# besselInu(nu, x) for very negative fractional nu at x approaching the documented ~710 series
# boundary used to return Infinity (Math.pow(x/2, nu)'s tiny prefactor times an internally-
# overflowing recursiveSum) where the true value is a large but finite number (~1e302-1e306).
# Fixed in issue #1215 (a hand-written rescaling loop in src/special/bessel.js); no points
# remain withheld. This dict is kept (empty) as the reusable mechanism for any future
# accuracy-cliff bug of this shape, the same way VonMises[11]'s refVals were withheld pending
# issue #1185 -- see the WITHHELD report printed by --check/--emit.
#
# beta(-0.5, 2) and beta(2, -0.5): ranjs's beta.js falls back to
# Math.exp(logGamma(x)+logGamma(y)-logGamma(x+y)) for non-integer/non-fast-path arguments.
# logGamma always represents log|Gamma(z)| (real-valued by construction, per its own
# reflection-formula comment), so exponentiating a sum of logGamma calls can only ever
# produce a non-negative number -- it structurally cannot reproduce a negative Beta
# function value. The true B(-0.5,2) = Gamma(-0.5)*Gamma(2)/Gamma(1.5) = -4 (Gamma(-0.5) =
# -2*sqrt(pi) is negative), confirmed independently via mpmath's own beta(); ranjs returns
# +4 instead, i.e. the correct magnitude with the wrong sign. This is a genuine production
# bug (not a grid-design issue) discovered by this PR's new coverage -- out of scope to fix
# here per issue #1271's own "fixing accuracy defects... file those separately", flagged for
# the build's bug-triage stage instead.
WITHHELD = {
    ('beta', (-0.5, 2)): 'sign lost by the exp(logGamma-sum) fallback for negative non-integer args -- see comment above WITHHELD',
    ('beta', (2, -0.5)): 'sign lost by the exp(logGamma-sum) fallback for negative non-integer args -- see comment above WITHHELD',
}


def besselI_ref(n, x):
    return besseli(n, x)


def besselISpherical_ref(n, x):
    # i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x) -- the standard modified-spherical-Bessel identity
    # (DLMF 10.47.9), independent of ranjs's own Taylor/Wronskian-recurrence implementation.
    # For negative n, i_n(0) diverges to +Infinity (e.g. i_{-1}(0) = cosh(0)/0), not 0.
    if x == 0:
        if n == 0:
            return mpf(1)
        return mpf(0) if n > 0 else mpf('inf')
    return sqrt(pi / (2 * x)) * besseli(n + mpf('0.5'), x)


def besselIExpScaled_ref(n, x):
    # exp(-|x|) * I_n(x) (#1292): built from the same direct besseli() call as besselI_ref,
    # scaled by the definitional exp(-|x|) factor -- independent of _besselIBackward's
    # scaled=true Miller-recurrence formula in bessel.js.
    return besseli(n, x) * exp(-abs(x))


def besselISphericalExpScaled_ref(n, x):
    # exp(-x) * i_n(x) (#1292), built on besselISpherical_ref's own independent identity
    # (i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x)) rather than bessel.js's Taylor/Wronskian formulas.
    # For n < 0, x == 0: this mirrors besselISpherical_ref's own always-+Infinity guard above,
    # which is itself only exactly correct for n=-1 (i_n(0+) actually alternates sign with n,
    # e.g. i_-2(0+) -> -Infinity) -- pre-existing, unexercised by either grid (n=-2/-3 at x=0
    # is never probed), and out of scope for #1310's test-only remit to fix here.
    if x == 0:
        if n == 0:
            return mpf(1)
        return mpf(0) if n > 0 else mpf('inf')
    return besselISpherical_ref(n, x) * exp(-x)


def logBesselIExpScaled_ref(n, x):
    # log(exp(-x) * I_n(x)) = log(besseli(n, x)) - x (#1321), built from the same direct
    # besseli() call as besselIExpScaled_ref -- independent of bessel.js's own
    # besselIExpScaled-then-log/series-fallback dispatch.
    return log(besseli(n, x)) - abs(x)


def besselInu_ref(nu, x):
    return besseli(nu, x)


def besselK_ref(n, x):
    return besselk(n, x)


def besselKnu_ref(nu, x):
    return besselk(nu, x)


def digamma_ref(z):
    return mp_digamma(z)


def gamma_ref(z):
    # mpmath's gamma() raises ValueError at a pole instead of returning Infinity --
    # translate to match ranjs's own non-positive-integer pole guard (gamma.js:27-29).
    if z <= 0 and z == int(z):
        return mpf('inf')
    return mp_gamma(z)


def logGamma_ref(z):
    # log(abs(gamma(z))) uses mpmath's own gamma() black box, independent of ranjs's own
    # Lanczos/reflection-formula/LOG_FACTORIAL-table decomposition in log-gamma.js. Same
    # pole translation as gamma_ref above (log-gamma.js:56-60).
    if z <= 0 and z == int(z):
        return mpf('inf')
    return log(abs(mp_gamma(z)))


def gammaLowerIncomplete_ref(s, x):
    # Regularized lower incomplete gamma P(s,x) -- confirmed by reading
    # src/special/gamma-incomplete.js:121-123 (JSDoc: "regularized lower incomplete
    # gamma function"). x<0 matches _gli's own explicit guard (gamma-incomplete.js:22) --
    # mpmath's gammainc has no such guard and computes something else entirely for a
    # negative upper bound, so translate explicitly.
    if x < 0:
        return mpf(0)
    return gammainc(s, 0, x, regularized=True)


def gammaUpperIncomplete_ref(s, x):
    # Regularized upper incomplete gamma Q(s,x) -- gamma-incomplete.js:135-137.
    return gammainc(s, x, inf, regularized=True)


def gammaLowerIncompleteInv_ref(a, p):
    # No single mpmath one-liner inverts gammainc. Root-find independently of ranjs's own
    # Wilson-Hilferty-seeded Halley refinement (gamma-incomplete.js:158-189) via
    # bisection: gammainc(a,0,x,regularized=True) is strictly monotonic increasing in x,
    # so bisection alone -- no Newton/derivative step, which can overshoot into the x<0
    # region where mpmath's own gammainc recurses without bound (confirmed: a Newton
    # hybrid attempt here crashed with RecursionError inside mpmath's gammainc) -- is
    # unconditionally convergent.
    if p <= 0:
        return mpf(0)
    if p >= 1:
        return mpf('inf')

    def f(x):
        return gammainc(a, 0, x, regularized=True) - p

    lo = mpf(a) / 1000 if a > 1000 else mpf('1e-10')
    hi = mpf(a) * 10 + 10
    while f(lo) > 0:
        lo /= 10
    while f(hi) < 0:
        hi *= 10
    # Bisect on log(x), not x itself: for small a, gammainc's leading term ~x^a/(a*Gamma(a))
    # is an extremely flat function of x (exponent a<<1), so the true root can sit many
    # hundreds of orders of magnitude below hi (confirmed via difftest-special.py's random
    # sweep: a=0.0115, p=0.0017 has a root near 4.8e-241 while hi starts near 10). Plain
    # bisection on x converges 1 bit/step of the *absolute* [lo,hi] range and needs a step
    # count proportional to that magnitude gap -- an 800-step linear-x attempt here landed
    # ~1.8x off the true root, nowhere near mp.dps=50 precision. Bisecting on log(x)
    # converges in a magnitude-independent step count instead.
    log_lo, log_hi = mp.log(lo), mp.log(hi)
    for _ in range(300):
        log_mid = (log_lo + log_hi) / 2
        if log_mid == log_lo or log_mid == log_hi:
            break
        if f(exp(log_mid)) < 0:
            log_lo = log_mid
        else:
            log_hi = log_mid
    return exp((log_lo + log_hi) / 2)


def beta_ref(x, y):
    return mp_beta(x, y)


def logBeta_ref(x, y):
    # mpmath's own beta() black box, independent of ranjs's logGamma(x)+logGamma(y)
    # -logGamma(x+y) decomposition.
    return log(abs(mp_beta(x, y)))


def betaIncomplete_ref(a, b, x):
    # Unnormalized -- confirmed by beta-incomplete.js:53-63 (comment: "B(a,b) != 1 for
    # unnormalized form"). a=0 (with x>0) is a genuine pole of the unnormalized integral
    # (the integrand t^(a-1) diverges at t=0 when a=0), matching ranjs's own
    # betaIncomplete(0,b,x)=Infinity (reached via its `a !== 0` dispatch guard forcing the
    # backward branch, whose Math.exp(logGamma(0)+...)=Infinity pole propagates through).
    # mpmath's own betainc() divides by a internally and raises ZeroDivisionError instead
    # of returning Infinity there, so translate that case explicitly.
    if a == 0 and 0 < x < 1:
        return mpf('inf')
    return betainc(a, b, 0, x, regularized=False)


def regularizedBetaIncomplete_ref(a, b, x):
    # Normalized I_x(a,b) -- confirmed by beta-incomplete.js:77-84.
    return betainc(a, b, 0, x, regularized=True)


def logBinomial_ref(n, k):
    # mpmath's own binomial() black box, independent of ranjs's logGamma(n+1)
    # -logGamma(k+1)-logGamma(n-k+1) decomposition.
    return log(abs(mp_binomial(n, k)))


REF_FN = {
    'besselI': besselI_ref,
    'besselISpherical': besselISpherical_ref,
    'besselIExpScaled': besselIExpScaled_ref,
    'besselISphericalExpScaled': besselISphericalExpScaled_ref,
    'logBesselIExpScaled': logBesselIExpScaled_ref,
    'besselInu': besselInu_ref,
    'besselK': besselK_ref,
    'besselKnu': besselKnu_ref,
    'digamma': digamma_ref,
    'gamma': gamma_ref,
    'logGamma': logGamma_ref,
    'gammaLowerIncomplete': gammaLowerIncomplete_ref,
    'gammaUpperIncomplete': gammaUpperIncomplete_ref,
    'gammaLowerIncompleteInv': gammaLowerIncompleteInv_ref,
    'beta': beta_ref,
    'logBeta': logBeta_ref,
    'betaIncomplete': betaIncomplete_ref,
    'regularizedBetaIncomplete': regularizedBetaIncomplete_ref,
    'logBinomial': logBinomial_ref,
}


def _besselI_grid(add):
    # n=0 crossover at |x|=10 (_I0 vs _besselIBackward), with a dense cluster over the
    # (10, 14] band where issue #1185 found a real bug.
    for x in [0.001, 0.5, 1, 5, 9.9, 9.99, 10, 10.01, 10.1, 12, 14, 14.1, 15, 20, 50, 100, 200, 500]:
        add('besselI', (0, x), 'besselI n=0: _I0/_besselIBackward crossover at x=10, issue #1185 band (10,14]')
    # n != 0: _besselIBackward's j_max formula depends on both n and x, so re-bracket the same
    # crossover for a few small integer orders.
    for n in [1, 2, 3, 5, 10]:
        for x in [0.5, 1, 5, 9.9, 10, 10.1, 14, 20, 50, 100, 200]:
            add('besselI', (n, x), f'besselI n={n}: _besselIBackward j_max(n,x) crossover region')
    # Sign symmetry for odd n at negative x (bessel.js:138).
    for n in [1, 3, 5]:
        for x in [-0.5, -5, -50]:
            add('besselI', (n, x), f'besselI n={n}: odd-order sign flip at negative x')


def _besselISpherical_grid(add):
    # Threshold |x|=1 (Taylor vs closed-form/Wronskian).
    for n in [0, 1, 2, 3, 5]:
        for x in [0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 5, 10, 50]:
            add('besselISpherical', (n, x), f'besselISpherical n={n}: |x|=1 Taylor/closed-form crossover')
    # Negative order: backward recurrence (bessel.js:193).
    for n in [-1, -2, -3]:
        for x in [0.5, 1, 2, 5, 10]:
            add('besselISpherical', (n, x), f'besselISpherical n={n}: negative-order backward recurrence')
    # x=0 boundary for a representative negative order: i_n(0) diverges to +Infinity for n<0,
    # unlike the n>=0 cases (0 or 1) -- exercises the fixed x==0 guard in besselISpherical_ref.
    add('besselISpherical', (-1, 0), 'besselISpherical n=-1: x=0 boundary (negative order diverges)')


def _besselIExpScaled_grid(add):
    # Issue #1310: besselIExpScaled had zero dedicated coverage -- reachable before only through
    # NoncentralChi2/NoncentralChi pdf at a handful of large-lambda*x points. Mirrors besselI's
    # own grid (same n=0 |x|=10 _I0/_besselIBackward crossover, same per-n j_max crossover
    # region, same odd-order sign-flip check) plus the x=0 boundary and large-x points past
    # besselI's own ~710 overflow ceiling, since staying representable there is this scaled
    # function's whole reason for existing (#1292).
    for x in [0.001, 0.5, 1, 5, 9.9, 9.99, 10, 10.01, 10.1, 12, 14, 20, 50, 100, 200, 500, 700, 1000]:
        add('besselIExpScaled', (0, x),
            'besselIExpScaled n=0: _I0/_besselIBackward crossover at x=10, scaled stays finite past besselI overflow ceiling ~710')
    for n in [1, 2, 3, 5, 10]:
        for x in [0.5, 1, 5, 9.9, 10, 10.1, 14, 20, 50, 100, 500, 1000]:
            add('besselIExpScaled', (n, x), f'besselIExpScaled n={n}: _besselIBackward scaled j_max(n,x) crossover region')
    # x=0 boundary for n != 0 (bessel.js's dedicated x===0 guard, ahead of _besselIBackward).
    for n in [1, 2, 3, 5]:
        add('besselIExpScaled', (n, 0), f'besselIExpScaled n={n}: x=0 boundary returns exactly 0')
    # Sign symmetry for odd n at negative x (bessel.js's x < 0 && n % 2 === 1 branch).
    for n in [1, 3, 5]:
        for x in [-0.5, -5, -50, -500]:
            add('besselIExpScaled', (n, x), f'besselIExpScaled n={n}: odd-order sign flip at negative x')


def _logBesselIExpScaled_grid(add):
    # Issue #1321: besselIExpScaled(n, x) underflows to exactly 0 once the Bessel order n is
    # large relative to x, even though log(exp(-x)*I_n(x)) stays a normal finite number.
    # logBesselIExpScaled fills that gap. First re-probe besselIExpScaled's own n=10 crossover
    # region (a subset of its grid above) to confirm the new function's direct-delegation
    # branch (log(besselIExpScaled(n,x))) stays consistent with the existing function. Then
    # add a large-order cluster, including the exact (n, twoSqrtProd) pairs Skellam(1000,1),
    # Skellam(2000,1), and Skellam(5000,1) produce at the issue's reported repro points
    # (999, 990, 1999, 4999) -- the regime where besselIExpScaled itself returns exactly 0.
    for x in [0.5, 1, 5, 9.9, 10, 10.1, 14, 20, 50, 100, 500, 1000]:
        add('logBesselIExpScaled', (10, x), 'logBesselIExpScaled n=10: direct-delegation regime, cross-checks besselIExpScaled n=10 crossover')
    # x=0 boundary.
    add('logBesselIExpScaled', (0, 0), 'logBesselIExpScaled n=0, x=0: returns exactly 0 (log(1))')
    for n in [1, 2, 3, 5]:
        add('logBesselIExpScaled', (n, 0), f'logBesselIExpScaled n={n}, x=0: -Infinity (log of exact 0)')
    # Large-order/small-argument regime: n >> x, where besselIExpScaled underflows to 0.
    for n, x in [(100, 20), (200, 30), (500, 44.72135954999579), (999, 63.245553203367585),
                 (990, 63.245553203367585), (1999, 89.44271909999159),
                 (2999, 109.5445115010332), (4999, 141.4213562373095)]:
        add('logBesselIExpScaled', (n, x), f'logBesselIExpScaled n={n}: large-order/small-argument regime, besselIExpScaled underflows to exactly 0')


def _besselISphericalExpScaled_grid(add):
    # Issue #1310: besselISphericalExpScaled had zero dedicated coverage. Covers the n=0/n=1
    # closed-form branches (including their own x=0 sub-guards), the |x|=1 Taylor/closed-form
    # (n=1) and Taylor/Wronskian (n>=2) crossover mirroring besselISpherical_grid's own
    # threshold cluster, and the n<0 backward-recurrence branch.
    add('besselISphericalExpScaled', (0, 0), 'besselISphericalExpScaled n=0: x=0 boundary returns exactly 1')
    for x in [0.001, 0.5, 1, 5, 10, 50, 100, 500, 700]:
        add('besselISphericalExpScaled', (0, x), 'besselISphericalExpScaled n=0: closed-form (1-e^-2x)/(2x) branch')
    add('besselISphericalExpScaled', (1, 0), 'besselISphericalExpScaled n=1: x=0 boundary (Taylor series collapses to 0)')
    for x in [0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 5, 50, 700]:
        add('besselISphericalExpScaled', (1, x), 'besselISphericalExpScaled n=1: Taylor/closed-form |x|=1 crossover')
    for n in [2, 3, 5]:
        add('besselISphericalExpScaled', (n, 0), f'besselISphericalExpScaled n={n}: x=0 boundary (Taylor series collapses to 0)')
        for x in [0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 5, 10, 50, 700]:
            add('besselISphericalExpScaled', (n, x), f'besselISphericalExpScaled n={n}: Taylor/Wronskian |x|=1 crossover')
    # Negative order: backward recurrence (bessel.js's n < 0 branch, linear in the ExpScaled
    # quantities the same way besselISpherical's own recurrence is).
    for n in [-1, -2, -3]:
        for x in [0.5, 1, 2, 5, 10, 50]:
            add('besselISphericalExpScaled', (n, x), f'besselISphericalExpScaled n={n}: negative-order backward recurrence')


def _besselInu_grid(add):
    # No internal branch, but the Taylor/recurrence series is only documented accurate up to
    # x ~ 710 (issue #629's coverage-gap fix) -- probe the overflow boundary. Points that
    # overflow to Infinity are listed in WITHHELD above and excluded at emit time.
    for nu in [0.5, 1.5, 2.5, 3.3, -0.5, -1.5, -2.5, -3.3]:
        for x in [0.001, 0.5, 1, 5, 10, 50, 100, 300, 500, 700, 709, 710]:
            add('besselInu', (nu, x), f'besselInu nu={nu}: large-x series behavior, overflow boundary ~710')


def _besselK_grid(add):
    # x=0 boundary: besselK(n, 0) diverges to +Infinity (bessel.js:302-303's x===0 guard),
    # unlike besselISpherical_grid's n>=0 finite case -- exercises _mismatch_message's
    # divergent-reference branch, previously dead/untested for besselK.
    for n in [0, 1, 2]:
        add('besselK', (n, 0), f'besselK n={n}: x=0 boundary (diverges to +Infinity)')
    # Threshold x=6 (_X_K_SERIES: combined series vs _KAsymptotic).
    for n in [0, 1, 2, 3, 5]:
        for x in [0.001, 0.5, 1]:
            add('besselK', (n, x), f'besselK n={n}: series branch, interior')
        for x in [5, 5.9, 5.99, 6]:
            add('besselK', (n, x), f'besselK n={n}: series branch, approaching x=6 crossover',
                tol=1e-10)
        for x in [6.01, 6.1]:
            add('besselK', (n, x), f'besselK n={n}: asymptotic branch, just past x=6 crossover',
                tol=2e-6)
        add('besselK', (n, 10), f'besselK n={n}: asymptotic branch, x=10 (well past crossover)',
            tol=_TOL_KASYMP_X10)
        for x in [20, 50, 100]:
            add('besselK', (n, x), f'besselK n={n}: asymptotic branch, interior')


def _besselKnu_grid(add):
    # x=0 boundary: besselKnu(nu, 0) diverges to +Infinity via its own x===0 guard
    # (bessel.js:330-331), checked before the near-integer dispatch, so this holds for any nu.
    add('besselKnu', (0.5, 0), 'besselKnu nu=0.5: x=0 boundary (diverges to +Infinity)')
    # The x<=6 connection-formula path (I_{-nu}-I_nu cancellation) vs the x>6 asymptotic path.
    for nu in [0.5, 1.5, 2.5, 3.3, -0.5, -1.5, -2.5, -3.3]:
        for x in [0.5, 1]:
            add('besselKnu', (nu, x), f'besselKnu nu={nu}: x<=6 connection-formula path, interior')
        for x in [3, 5, 5.9]:
            add('besselKnu', (nu, x), f'besselKnu nu={nu}: x<=6 connection-formula cancellation path',
                tol=1e-10)
        add('besselKnu', (nu, 6.01), f'besselKnu nu={nu}: asymptotic branch, just past x=6 crossover',
            tol=2e-6)
        add('besselKnu', (nu, 10), f'besselKnu nu={nu}: asymptotic branch, x=10 (well past crossover)',
            tol=_TOL_KNUASYMP_X10)
        for x in [20, 50, 100]:
            add('besselKnu', (nu, x), f'besselKnu nu={nu}: x>6 asymptotic path, interior')
    # The |nu-round(nu)|<1e-8 near-integer snap-to-besselK threshold, probed from both sides.
    for n in [0, 1, 2, 3]:
        for x in [3, 10]:
            add('besselKnu', (n + 1e-9, x),
                f'besselKnu nu~{n}: inside the 1e-8 near-integer snap-to-besselK threshold',
                tol=1e-6)
            add('besselKnu', (n + 1e-7, x),
                f'besselKnu nu~{n}: just outside the 1e-8 near-integer snap threshold',
                tol=1e-6)
    # Issue #1361: nu comparable in magnitude to x, just past the x=6 crossover, where the old
    # unconditional dispatch to _KAsymptotic(nu, x) (ignoring nu entirely) returned up to ~77%
    # relative error. Sweeps nu in [3,10] crossed with x in [6,15] per the issue's acceptance
    # criteria, including the exact reported point (nu=4.82, x=7.18). x values just past the
    # crossover carry _KAsymptotic's own (pre-existing, not fix-specific) optimal-truncation
    # tolerance, same mechanism/bucket as _N_KNU_CONNECTION/_TOL_KNUASYMP_X10 above.
    # nu=3.5 (not 3.3) avoids exact (fn, args) duplicates with the existing nu=3.3 x=6.01/x=10
    # points in the loop above.
    for nu in [3.5, 4.82, 5.5, 7.0, 8.25, 10.0, -4.82, -7.0]:
        for x in [6.01, 7.18, 9.0]:
            add('besselKnu', (nu, x),
                f'besselKnu nu={nu}: issue #1361 sweep, just past x=6 crossover, order comparable to x',
                tol=_TOL_KNU_1361_NEAR)
        add('besselKnu', (nu, 10.0),
            f'besselKnu nu={nu}: issue #1361 sweep, x=10, order comparable to x',
            tol=_TOL_KNUASYMP_X10)
        add('besselKnu', (nu, 12.5),
            f'besselKnu nu={nu}: issue #1361 sweep, x=12.5, order comparable to x',
            tol=_TOL_KNU_1361_X12_5)
        add('besselKnu', (nu, 15.0),
            f'besselKnu nu={nu}: issue #1361 sweep, x=15, order comparable to x')


def _digamma_grid(add):
    # Threshold z=10 (shift-and-sum vs Stirling series).
    for z in [0.01, 0.1, 0.5, 0.9, 1, 1.5, 2, 5, 9, 9.9, 9.99, 10, 10.01, 10.1, 15, 50, 100, 500]:
        add('digamma', (z,), 'digamma: shift-and-sum/Stirling crossover at z=10')
    # Negative non-integer: reflection formula.
    for z in [-0.5, -1.5, -2.5, -9.5, -10.5, -100.5]:
        add('digamma', (z,), 'digamma: reflection formula for negative z')
    # Near-pole (bracketing the existing test/special.js:40-41 spot-check).
    for z in [-1 + 1e-6, -2 + 1e-6, -5 + 1e-7]:
        add('digamma', (z,), 'digamma: near-pole reflection-formula precision')


def _gamma_grid(add):
    # z<=0 integer poles (gamma.js:27-29).
    for z in [0, -1, -2, -5]:
        add('gamma', (z,), 'gamma z<=0 integer: pole, diverges to +Infinity')
    # z<0.5 reflection/Lanczos crossover (gamma.js:32).
    for z in [0.001, 0.1, 0.3, 0.49, 0.5, 0.51, 0.7, 1, 2, 5, 10, 50, 100]:
        add('gamma', (z,), 'gamma: z<0.5 reflection/Lanczos crossover')
    # Negative non-integer / half-integer reflection-formula cancellation.
    for z in [-0.5, -1.5, -2.5, -9.5, -20.3]:
        add('gamma', (z,), 'gamma: negative non-integer reflection-formula cancellation')


def _logGamma_grid(add):
    # z<=0 integer poles (log-gamma.js:56-60).
    for z in [0, -1, -2]:
        add('logGamma', (z,), 'logGamma z<=0 integer: pole, diverges to +Infinity')
    # Negative non-integer reflection formula, mirroring the existing digamma grid's
    # negative-z points.
    for z in [-0.5, -1.5, -2.5, -9.5, -100.5]:
        add('logGamma', (z,), 'logGamma: negative non-integer reflection formula')
    # LOG_FACTORIAL integer-table boundary z<=171 (log-gamma.js:68, table lines 7-30).
    for z in [169, 170, 171, 172, 173]:
        add('logGamma', (z,), 'logGamma: LOG_FACTORIAL table boundary at z=171')
    # z<0.5 reflection/Lanczos crossover (log-gamma.js:72).
    for z in [0.001, 0.1, 0.3, 0.49, 0.5, 0.51, 0.7]:
        add('logGamma', (z,), 'logGamma: z<0.5 reflection/Lanczos crossover')
    # Large non-integer z past the table, exercising Lanczos directly.
    for z in [171.5, 200.7, 500.3, 1000.9]:
        add('logGamma', (z,), 'logGamma: large non-integer z, Lanczos beyond table range')


def _gammaIncomplete_shared_grid(add, fn):
    # Top-level x<s+1 series/CF crossover (gamma-incomplete.js:122,136) for several s.
    for s in [0.5, 1, 5, 15, 100]:
        for x in [max(1e-6, s - 1), s - 0.01, s, s + 0.99, s + 1, s + 1.01, s + 2]:
            add(fn, (s, x), f'{fn} s={s}: top-level x<s+1 series/CF crossover')
    # _deviance.stirlerr s=15 boundary (_deviance.js:52), probed away from the x<s+1 line.
    for s in [14, 14.9, 15, 15.1, 16]:
        add(fn, (s, s * 2), f'{fn} s={s}: _deviance.stirlerr s=15 boundary')
    # _deviance.bd0 t=x/s in {0.5,2} boundary (_deviance.js:78), s fixed away from its own
    # stirlerr boundary.
    for t in [0.49, 0.5, 0.51, 1.99, 2, 2.01]:
        add(fn, (20, 20 * t), f'{fn} s=20: _deviance.bd0 t=x/s={t} boundary')
    # Near-diagonal large-s region from issue #1348's own regression grid.
    for s in [4989, 4995, 4998]:
        add(fn, (s, 5000), f'{fn} s={s}: #1348 near-diagonal large-s CF convergence regime')
    # Small s near x=s+1 (the #1348 slow-convergence regime at the opposite extreme).
    for s in [1e-5, 1e-3, 0.01]:
        add(fn, (s, s + 1 + 1e-6), f'{fn} s={s}: small-s near x=s+1 boundary')


def _gammaLowerIncomplete_grid(add):
    _gammaIncomplete_shared_grid(add, 'gammaLowerIncomplete')
    # x<0 -> 0 boundary (_gli's own guard, gamma-incomplete.js:22).
    add('gammaLowerIncomplete', (2, -5), 'gammaLowerIncomplete: x<0 boundary returns exactly 0')


def _gammaUpperIncomplete_grid(add):
    _gammaIncomplete_shared_grid(add, 'gammaUpperIncomplete')


def _gammaLowerIncompleteInv_grid(add):
    # p<=0 -> 0, p>=1 -> Infinity (gamma-incomplete.js:152-153).
    add('gammaLowerIncompleteInv', (2, 0), 'gammaLowerIncompleteInv: p<=0 boundary returns exactly 0')
    add('gammaLowerIncompleteInv', (2, 1), 'gammaLowerIncompleteInv: p>=1 boundary returns +Infinity')
    # a>=1 W-H-seeded vs a<1 series-inversion-seeded crossover (gamma-incomplete.js:158).
    for a in [0.5, 0.9, 1, 1.1, 1.5, 5]:
        for p in [0.1, 0.5, 0.9]:
            add('gammaLowerIncompleteInv', (a, p),
                f'gammaLowerIncompleteInv a={a}: a>=1/a<1 initial-guess seed crossover')
    # Extreme small p exercising the relative floor (gamma-incomplete.js:189).
    for a in [0.5, 2, 10]:
        for p in [1e-10, 1e-30]:
            add('gammaLowerIncompleteInv', (a, p),
                f'gammaLowerIncompleteInv a={a}: extreme small p, relative-floor path')


def _beta_grid(add):
    # Integer fast-path boundary min(x,y)<=30 (beta.js:21,25).
    for m in [1, 2, 15, 29, 30, 31, 32, 50]:
        add('beta', (m, 40), f'beta m={m}: integer min(x,y)<=30 exact-recurrence boundary')
    # Non-integer args, logGamma fallback path.
    for x, y in [(0.5, 0.5), (2.3, 5.7), (100.4, 0.001)]:
        add('beta', (x, y), 'beta: non-integer argument, logGamma fallback path')
    # Widely-separated magnitude (x, y): three-term logGamma subtraction cancellation.
    add('beta', (10.5, 200.2), 'beta: non-integer argument, logGamma fallback path, wide x/y magnitude split',
        tol=_TOL_BETA_WIDE_MAGNITUDE)
    # Non-positive args, falling through to logGamma's own pole/reflection behavior.
    for x, y in [(-0.5, 2), (2, -0.5), (-1.5, -2.5)]:
        add('beta', (x, y), 'beta: non-positive argument, inherits logGamma pole/reflection behavior')


def _logBeta_grid(add):
    # Inherits logGamma's thresholds threefold -- probe (x,y) pairs where x, y, or x+y
    # cross the integer-table (z<=171) or z<0.5 reflection boundaries.
    for x, y in [(0.3, 0.3), (0.49, 5), (170, 1), (171, 1), (172, 1), (85.5, 85.5),
                 (-0.5, -1.5)]:
        add('logBeta', (x, y), 'logBeta: inherited logGamma threshold (table/reflection) via x, y, or x+y')
    # Negative non-integer argument: reflection-formula three-term-subtraction cancellation.
    add('logBeta', (0.4, -0.3), 'logBeta: inherited logGamma negative-argument reflection formula',
        tol=_TOL_LOGBETA_REFLECTION)


def _betaIncomplete_shared_grid(add, fn):
    # x in {0,1} boundary (beta-incomplete.js:54/78-80).
    for a, b in [(2, 3), (0.5, 0.5)]:
        add(fn, (a, b, 0), f'{fn} a={a},b={b}: x=0 boundary')
        add(fn, (a, b, 1), f'{fn} a={a},b={b}: x=1 boundary')
    # Parameter-dependent forward/backward crossover x<(a+1)/(a+b+2) (lines 61,81).
    for a, b in [(2, 3), (0.5, 5), (10, 0.2), (50, 50)]:
        xc = (a + 1) / (a + b + 2)
        for x in [xc - 0.01, xc - 1e-6, xc, xc + 1e-6, xc + 0.01]:
            if 0 < x < 1:
                add(fn, (a, b, x),
                    f'{fn} a={a},b={b}: x=(a+1)/(a+b+2) forward/backward crossover')
    # Backward-branch cancellation region (large a, small b, x near 1), mirrors issue #675.
    for a, b, x in [(100, 0.01, 0.9999), (50, 0.05, 0.999)]:
        add(fn, (a, b, x), f'{fn}: backward-branch cancellation region (large a, small b, x near 1)',
            tol=_TOL_BETAINCOMPLETE_BACKWARD_CANCELLATION)


def _betaIncomplete_grid(add):
    _betaIncomplete_shared_grid(add, 'betaIncomplete')
    # a===0 / b===0 special-case branch selection (beta-incomplete.js:61), unique to the
    # unnormalized betaIncomplete (regularizedBetaIncomplete has no such carve-out).
    for a, b, x in [(0, 3, 0.3), (2, 0, 0.7), (0, 0.001, 0.5)]:
        add('betaIncomplete', (a, b, x), 'betaIncomplete: a=0/b=0 special-case branch selection')


def _regularizedBetaIncomplete_grid(add):
    _betaIncomplete_shared_grid(add, 'regularizedBetaIncomplete')


def _logBinomial_grid(add):
    # k near n: n-k+1 near logGamma's z<0.5 threshold.
    for n, k in [(10, 9.4), (10, 9.5), (10, 9.6), (100, 99.5), (5, 4.5)]:
        add('logBinomial', (n, k), 'logBinomial: k near n, n-k+1 near logGamma z<0.5 threshold')
    # k near 0: k+1 near logGamma's z<0.5 threshold.
    for n, k in [(10, -0.4), (10, -0.5), (10, -0.6), (50, -0.5)]:
        add('logBinomial', (n, k), 'logBinomial: k near 0, k+1 near logGamma z<0.5 threshold')
    # Large n,k, straddling the logGamma 171 integer-table boundary.
    for n, k in [(170, 85), (171, 85), (172, 86), (300, 150)]:
        add('logBinomial', (n, k), 'logBinomial: large n,k around the logGamma 171 table boundary')


def grid():
    """Threshold-focused (fn, args, note, tol) tuples. See the module docstring for the
    rationale; each cluster's comment names the exact dispatch threshold in src/special/ it
    straddles, and non-default tolerances name the specific numerical mechanism (see the
    _N_* constants above)."""
    points = []

    def add(fn, args, note, tol=DEFAULT_TOL):
        points.append((fn, list(args), note, tol))

    _besselI_grid(add)
    _besselISpherical_grid(add)
    _besselIExpScaled_grid(add)
    _logBesselIExpScaled_grid(add)
    _besselISphericalExpScaled_grid(add)
    _besselInu_grid(add)
    _besselK_grid(add)
    _besselKnu_grid(add)
    _digamma_grid(add)
    _gamma_grid(add)
    _logGamma_grid(add)
    _gammaLowerIncomplete_grid(add)
    _gammaUpperIncomplete_grid(add)
    _gammaLowerIncompleteInv_grid(add)
    _beta_grid(add)
    _logBeta_grid(add)
    _betaIncomplete_grid(add)
    _regularizedBetaIncomplete_grid(add)
    _logBinomial_grid(add)

    return points


def num(x):
    # repr(float('inf')) is the Python literal 'inf', which is not valid JS (it would parse as
    # a ReferenceError to an undefined identifier) -- emit the JS spellings instead.
    x = float(x)
    if x != x:
        return 'NaN'
    if x == float('inf'):
        return 'Infinity'
    if x == float('-inf'):
        return '-Infinity'
    return repr(x)


def compute_refs(points):
    refs = []
    for fn, args, note, tol in points:
        val = REF_FN[fn](*args)
        refs.append(float(val))
    return refs


def compute_ranjs_values(points):
    payload = json.dumps([{'fn': fn, 'args': args} for fn, args, _, _ in points])
    result = subprocess.run(['node', EVAL_SCRIPT], input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('scripts/eval-special.js failed')
    return json.loads(result.stdout)


def decode(value):
    # Undoes eval-special.js's Infinity/NaN string tagging (JSON itself has no such literals).
    if value == 'Infinity':
        return float('inf')
    if value == '-Infinity':
        return float('-inf')
    if value == 'NaN':
        return float('nan')
    return value


def withheld_reason(fn, args):
    return WITHHELD.get((fn, tuple(args)))


def _is_divergent(x):
    return x != x or x in (float('inf'), float('-inf'))


def _mismatch_message(fn, args, ref, value, tol, note):
    # Returns None when the point is within tolerance, else a human-readable MISMATCH line.
    # A divergent reference (e.g. besselK at x=0) requires ranjs to diverge the same way.
    if _is_divergent(ref):
        if value == ref or (value != value and ref != ref):
            return None
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} (divergent reference) ({note})'
    if _is_divergent(value):
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} (ranjs diverges, reference does not) ({note})'
    if ref == 0:
        if abs(value) > tol:
            return f'  MISMATCH {fn}{args} got {value!r} want 0 ({note})'
        return None
    rel = abs(value - ref) / abs(ref)
    if rel > tol:
        return f'  MISMATCH {fn}{args} got {value!r} want {ref!r} rel {rel:.2e} tol {tol:.0e} ({note})'
    return None


def check(points, refs, ranjs_values):
    bad = 0
    checked = 0
    withheld = 0
    for (fn, args, note, tol), ref, got in zip(points, refs, ranjs_values):
        reason = withheld_reason(fn, args)
        if reason:
            withheld += 1
            print(f'  WITHHELD {fn}{args}: {reason} ({note})', flush=True)
            continue
        if 'error' in got:
            print(f'  ERROR {fn}{args}: {got["error"]}', flush=True)
            bad += 1
            continue
        checked += 1
        message = _mismatch_message(fn, args, ref, decode(got['value']), tol, note)
        if message:
            print(message, flush=True)
            bad += 1
    print(f'Checked {checked} points, {bad} mismatches, {withheld} withheld', flush=True)
    return bad


TEMPLATE = """/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
// ESLint's no-loss-of-precision rule false-positives on a few 17-significant-digit literals
// that do round-trip exactly, so it is disabled for this generated reference file.
import {{ assert }} from 'chai'
import {{ describe, it }} from 'mocha'
import * as special from '../src/special/index.js'

// Special-function precision gate (issue #1140).
//
// Reference values are from mpmath 1.4.1 at mp.dps = 50, rounded to float64.
// Generator (also the source of every reference formula): scripts/precision-refs-special.py
//
// Unlike the distribution precision gates (test/precision-continuous.js / -discrete.js), there
// is no independent second reference source to self-check the generator against here -- the
// generator's own --check step compares straight against ranjs's src/special/ implementation,
// which is the entire point of this gate. Any tolerance looser than the 1e-13 default carries
// a comment naming the specific numerical mechanism (never a blind loosening).
const REFS = [
{entries}
]

describe('special function precision gate', () => {{
  REFS.forEach(({{ fn, args, ref, tol, note }}) => {{
    it(`${{fn}}(${{args.join(', ')}}) should match the mpmath mp.dps=50 reference (${{note}})`, () => {{
      const got = special[fn](...args)
      if (!isFinite(ref)) {{
        // A divergent reference (e.g. besselISpherical(-1, 0) -> +Infinity) requires ranjs to
        // diverge identically -- (got - ref) / ref is NaN for Infinity - Infinity, so this case
        // can't reuse the relative-error branch below.
        assert(Object.is(got, ref))
      }} else if (ref === 0) {{
        assert.approximately(got, 0, tol)
      }} else {{
        assert.approximately(got / ref, 1, tol)
      }}
    }})
  }})
}})
"""


def render(points, refs):
    lines = []
    for (fn, args, note, tol), ref in zip(points, refs):
        if withheld_reason(fn, args):
            continue
        args_js = '[' + ', '.join(num(a) for a in args) + ']'
        # json.dumps produces a valid, properly-escaped JS string literal (double-quoted),
        # mirroring how tol!r above already avoids the equivalent hand-quoting problem for
        # tol -- a raw apostrophe in `note` (e.g. "besselI's ~710 overflow ceiling") would
        # otherwise break out of a hand-wrapped single-quoted literal.
        lines.append(
            f"  {{ fn: {json.dumps(fn)}, args: {args_js}, ref: {num(ref)}, tol: {tol!r}, "
            f"note: {json.dumps(note)} }},"
        )
    content = TEMPLATE.format(entries='\n'.join(lines))
    with open(OUTPUT_PATH, 'w') as f:
        f.write(content)
    print(f'Wrote {OUTPUT_PATH} ({len(lines)} points, {len(points) - len(lines)} withheld)', flush=True)


def main():
    points = grid()
    refs = compute_refs(points)
    ranjs_values = compute_ranjs_values(points)
    bad = check(points, refs, ranjs_values)

    if '--emit' in sys.argv:
        if bad:
            print(f'Refusing to emit: {bad} mismatch(es) unresolved -- either the mechanism is '
                  f'understood (add a tol= override with a named-mechanism comment in grid()) or '
                  f'it is a genuine bug (add it to WITHHELD and file separately).', flush=True)
            sys.exit(1)
        render(points, refs)
        return

    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
