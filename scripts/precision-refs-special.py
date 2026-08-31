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
import math
import os
import subprocess
import sys

from mpmath import mp, mpf, pi, sqrt, exp, log, besseli, besselk
from mpmath import digamma as mp_digamma
from mpmath import gamma as mp_gamma, beta as mp_beta, gammainc, betainc
from mpmath import binomial as mp_binomial, inf
from mpmath import zeta, polylog, stirling2
from mpmath import erf as mp_erf, erfc as mp_erfc, erfinv as mp_erfinv
from mpmath import expint, hyp1f1, lambertw, quad

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
# Issue #1414 zeta/polylog cluster: stirlingSecond's recurrence sums only non-negative terms (no
# cancellation), so float64 rounding beyond the 2^53 exact-integer boundary stays a benign
# nearest-representable-value rounding on both sides of the comparison, not an accuracy cliff
# (measured: rel error ~5.5e-17 at stirlingSecond(25,12), already beyond 2^53) -- no tolerance
# override needed for that reason. hurwitzZeta needed no override either.

# riemannZeta's 5-term Laurent expansion (riemann-zeta.js:32-34) has residual truncation error
# that grows as d=s-1 approaches the band's own right edge (0.1001) -- measured via --check: rel
# error 4.22e-12 at s=1.0999 (d=0.0999). >2x headroom over the measured value.
_TOL_RIEMANNZETA_LAURENT_EDGE = 1e-11
# riemannZeta's general branch (Wynn-epsilon-accelerated alternating series, riemann-zeta.js:36)
# sums terms (k+1)^(-s) that grow polynomially in k for negative s -- the more negative s is, the
# faster that growth and the more the epsilon-table's extrapolation accuracy degrades. Measured
# via --check across s in {-3,-5}: worst rel error 2.82e-10 at s=-5. >3x headroom over the
# measured value. (This degradation becomes a genuine, unbounded-magnitude defect well past this
# range -- see the riemannZeta WITHHELD entry below, not a tolerance-calibration matter. It is
# also broader than these two integer probes alone suggest: scripts/difftest-special.py's own
# riemannZeta SWEEP_SPEC found a non-integer s=-4.448 with rel error ~2.17e-7, ~1000x worse than
# this bucket's own s=-5 integer probe, same mechanism -- see that file's comment.)
_TOL_RIEMANNZETA_NEGATIVE_S = 1e-9

# generalizedHarmonic's n>=10, m!=1 branch computes riemannZeta(m)-hurwitzZeta(m,n+1)
# (generalized-harmonic.js:31); for m just inside riemannZeta's own Laurent band (near but not
# at m=1), this subtracts two comparable-magnitude, individually near-pole values. Measured via
# --check: worst rel error 2.59e-13 at (n,m)=(10,1.05). >2x headroom over the measured value.
_TOL_GENHARMONIC_ZETA_CANCELLATION = 6e-13

# polylogarithm's general Wynn-epsilon series (polylogarithm.js:19-23, used for n!=1; n=1 has
# its own closed-form early return, polylogarithm.js:16-18, issue #1414) converges more slowly as
# n decreases (fewer powers of k damping the k^(-n) factor) and as |z| approaches the unit-radius
# convergence boundary. At n=2, one order closer to n=1, the degradation is bad enough that even
# the interior sweep's z=0.9 point (not just the near-1 cluster) breaches the 1e-13 default;
# measured via --check: worst rel error 1.54e-13 at z=0.9. >2x headroom over the measured value.
_TOL_POLYLOG_N2_INTERIOR = 4e-13
# measured via --check across z in {0.99,0.999}: worst rel error 2.87e-4 at z=0.999. >2x
# headroom over the measured value.
_TOL_POLYLOG_N2_NEAR_1 = 7e-4
# At n=3 this stays a modest, well-understood degradation; measured via
# --check across z in {0.99,0.999}: worst rel error 1.31e-6 at z=0.999. >2x headroom over the
# measured value. (n=3's own interior z=0.9 point stays within the 1e-13 default, unlike n=2's.)
_TOL_POLYLOG_N3_NEAR_1 = 3e-6
# n=4 converges faster than n=3 (one more power of k damping k^(-n)), but its interior z=0.9
# point still marginally breaches the 1e-13 default; measured via --check: worst rel error
# 4.55e-13 at z=0.9. >2x headroom over the measured value.
_TOL_POLYLOG_N4_INTERIOR = 1e-12
# measured via --check across z in {0.99,0.999}: worst rel error 1.98e-9 at z=0.999. >2x
# headroom over the measured value.
_TOL_POLYLOG_N4_NEAR_1 = 5e-9
# n=5 converges faster still, but its interior z=0.9 point still marginally breaches the 1e-13
# default; measured via --check: worst rel error 1.34e-13 at z=0.9. >2x headroom over the
# measured value.
_TOL_POLYLOG_N5_INTERIOR = 3e-13
# measured via --check across z in {0.99,0.999}: worst rel error 9.51e-11 at z=0.999. >2x
# headroom over the measured value.
_TOL_POLYLOG_N5_NEAR_1 = 2.5e-10

# riemannZeta(s) for s well past the negative-s degradation range above becomes flatly wrong, not
# merely imprecise: e.g. s=-15's true value (a nontrivial zeta value, ~0.4433) is off by nearly an
# order of magnitude (ranjs returns ~3.87), and by s=-20 (a trivial zero, true value exactly 0)
# ranjs returns ~267.6. The general branch's Wynn-epsilon extrapolation of the alternating series
# Σ(-1)^k(k+1)^(-s), whose terms grow as (k+1)^|s| for negative s, is not designed to remain
# accurate once that growth rate gets large enough -- a genuine algorithmic limitation, not a
# grid-design/tolerance-calibration issue. Out of scope to fix here per issue #1414's own
# "fixing accuracy defects... file those separately" scope note (inherited from #1271); flagged
# for the build's bug-triage stage instead.
#
WITHHELD = {
    ('beta', (-0.5, 2)): 'sign lost by the exp(logGamma-sum) fallback for negative non-integer args -- see comment above WITHHELD',
    ('beta', (2, -0.5)): 'sign lost by the exp(logGamma-sum) fallback for negative non-integer args -- see comment above WITHHELD',
    ('riemannZeta', (-15,)): 'Wynn-epsilon extrapolation of the negative-s general branch becomes flatly wrong (not just imprecise) well past the _TOL_RIEMANNZETA_NEGATIVE_S range -- see comment above WITHHELD',
    ('f11', (-1, -1, 5)): 'a==b non-positive integer is a genuine 0/0 Pochhammer-ratio indeterminate form _f11TaylorSeries cannot resolve (corrupts to NaN, per its own pole guard\'s comment in hypergeometric.js); mpmath\'s hyp1f1 resolves it to a finite limit (6, not e^z) ranjs cannot currently compute -- issue #1424 tracks this a===b indeterminate-form defect specifically (distinct from #1423, a different f11 defect in the asymptotic branch)',
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


def riemannZeta_ref(s):
    # mpmath's own zeta() black box, independent of ranjs's Laurent-expansion/Wynn-epsilon-
    # accelerated-series dispatch (riemann-zeta.js:28-38). mpmath raises ValueError at the s=1
    # pole rather than returning Infinity; translate to match ranjs's own 1/d-division behavior
    # there (riemann-zeta.js:33, ADR-0015).
    if s == 1:
        return mpf('inf')
    return zeta(s)


def hurwitzZeta_ref(s, a):
    # mpmath's own two-argument zeta(s, a) black box, independent of ranjs's Bernoulli partial-
    # sum series (hurwitz-zeta.js:15-46). mpmath's own pole behavior at s=1 is inconsistent
    # across `a` (raises ValueError when a=1, returns `inf` directly when a=2) since a=1 hits an
    # internal riemannZeta fast path -- guard explicitly so every `a` matches ranjs's own
    # blanket `Math.abs(s-1) < EPS -> Infinity` guard (hurwitz-zeta.js:17-19).
    if s == 1:
        return mpf('inf')
    return zeta(s, a)


def generalizedHarmonic_ref(n, m):
    # Direct sum at mp.dps=50, independent of ranjs's own neumaier-compensated-sum /
    # zeta-difference / digamma-identity dispatch (generalized-harmonic.js:19-32). n=0 is the
    # empty sum (0), matching Python's own range(1, 1) producing no terms.
    return mpf(sum(mpf(k) ** (-mpf(m)) for k in range(1, int(n) + 1)))


def polylogarithm_ref(n, z):
    # mpmath's own polylog() black box, independent of ranjs's implementation (n=1 closed form
    # or Wynn-epsilon-accelerated series for n!=1, polylogarithm.js:13-24).
    return polylog(n, z)


def stirlingSecond_ref(n, k):
    # mpmath's own stirling2(exact=True) black box (exact big-integer arithmetic), independent
    # of ranjs's own memoized k*S(n-1,k)+S(n-1,k-1) recurrence (stirling.js:15). Domain guard
    # mirrors stirling.js's own isInvalidInput (stirling.js:20-22) -- this is guarding the
    # function's documented domain, not sharing its recurrence formula.
    if n < 0 or k < 0 or k > n:
        return mpf(0)
    return mpf(stirling2(int(n), int(k), exact=True))


# ─── Issue #1415 remainder cluster ───

def erf_ref(x):
    # mpmath's own black-box erf(), independent of error.js:65-69's Maclaurin-series/Laplace-CF
    # dispatch.
    return mp_erf(x)


def erfc_ref(x):
    # mpmath's own black-box erfc(), independent of error.js:80-87's own series/CF dispatch --
    # whose x<=1/x>1 crossover is deliberately different from erf's own x<=2 crossover, to avoid
    # 1-erf(x) cancellation near x=1 (see
    # solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md).
    return mp_erfc(x)


def erfcx_ref(x):
    # exp(x^2)*erfc(x) computed directly from mpmath's own black-box erfc(), independent of
    # error.js:100-104's own CF-without-the-exp(-x^2)-factor formula. That formula exists purely
    # to dodge float64 overflow in exp(x^2) for large x -- irrelevant at mp.dps=50's arbitrary
    # exponent range, so the direct definitional composition is safe everywhere.
    return exp(mpf(x) ** 2) * mp_erfc(x)


def erfinv_ref(x):
    # mpmath's own black-box erfinv(), independent of error.js:115-135's polynomial-seeded
    # Newton refinement (whose three-way residual split at |x|=0.5 exists purely to avoid
    # cancellation in the *iterative* refinement, not a property of the true inverse function).
    return mp_erfinv(x)


def e1_ref(z):
    # mpmath's own black-box expint(1, z) == E_1(z) by definition, independent of e1.js's own
    # A&S 5.1.11 series / 5.1.22 continued-fraction dispatch (e1.js:15-46). mpmath returns a
    # complex value for z<0 (E_1 has a branch cut along the negative real axis) rather than
    # ranjs's own explicit NaN there (e1.js:13) -- translate explicitly. z==0 already returns a
    # real +inf directly from mpmath, no translation needed.
    if z < 0:
        return mpf('nan')
    return expint(1, z)


def f11_ref(a, b, z):
    # mpmath's own black-box hyp1f1(), independent of hypergeometric.js's own Taylor-series /
    # truncate-at-minimum-term-asymptotic-series dispatch (hypergeometric.js:67-71). Mirrors
    # f11()'s own branch order and its own guard exactly (see the JS source's own comment for
    # the full rationale, including two review-caught regressions in earlier, overbroad
    # versions of this guard): |a|<EPSILON is an exact-1 special case checked first; b a
    # non-positive integer is a genuine pole (mpmath itself raises ZeroDivisionError there)
    # UNLESS a is also a non-positive integer with a >= b -- for a > b strictly, the numerator's
    # own Pochhammer symbol terminates the series before the pole (mpmath: hyp1f1(-1,-2,3) ==
    # 2.5); for a == b, the guard condition is also false here, so this falls through to
    # mpmath's own hyp1f1, which (unlike ranjs's _f11TaylorSeries) robustly resolves the a==b
    # 0/0 Pochhammer-ratio indeterminate form to its correct finite limit (mpmath:
    # hyp1f1(-1,-1,5) == 6, NOT +Infinity and NOT e^z). ranjs's own f11() cannot compute this --
    # its guard deliberately excludes a==b too, but only to avoid *asserting* the wrong
    # +Infinity, falling through instead to _f11TaylorSeries's pre-existing 0/0-corrupted NaN
    # (see the JS source's own comment; WITHHELD below documents the resulting real mismatch;
    # #1424 tracks this a===b indeterminate-form defect specifically, not fixed here -- distinct
    # from #1423, a different f11 defect in the asymptotic branch).
    if abs(a) < 2.220446049250313e-16:
        return mpf(1)
    if b <= 0 and b == int(b) and not (a == int(a) and a <= 0 and a >= b):
        return mpf('inf')
    return hyp1f1(a, b, z)


def lambertW0_ref(z):
    # mpmath's own black-box lambertw(z, k=0) (principal branch), independent of
    # lambert-w.js:58-63's own Halley-refined initial-guess dispatch. mpmath returns a complex
    # value for z<-1/e rather than ranjs's own explicit NaN there -- translate explicitly.
    if z < -exp(-1):
        return mpf('nan')
    return lambertw(z, k=0)


def lambertW1m_ref(z):
    # mpmath's own black-box lambertw(z, k=-1) (branch -1), independent of
    # lambert-w.js:30-45's own Halley-refined initial-guess dispatch. ranjs restricts the domain
    # to [-1/e, 0) (lambert-w.js:31); mpmath's own branch -1 is real there but complex outside
    # it, so translate outside that domain to match.
    if z < -exp(-1) or z >= 0:
        return mpf('nan')
    return lambertw(z, k=-1)


def owenT_ref(h, a):
    # No built-in Owen's T in mpmath. Independent evaluation via the function's own defining
    # integral (Owen, 1956): T(h,a) = (1/2pi) * integral_0^a exp(-h^2*(1+x^2)/2)/(1+x^2) dx, via
    # mpmath.quad at mp.dps=50 -- independent of owen-t.js's own 6-sub-algorithm lookup-table
    # numerical scheme (owen-t.js:10-56, translated from the Patefield & Tandy JSS algorithm),
    # even though both ultimately compute the same integral: this is the same "definition, not
    # algorithm" independence bar gammaLowerIncomplete_ref/betaIncomplete_ref already apply
    # (mpmath's own gammainc/betainc black boxes rather than ranjs's own series). mpmath.quad
    # handles a negative integration bound (a<0) correctly via signed-interval integration
    # (verified empirically: quad(f,[0,-0.5]) == -quad(f,[0,0.5]) to full mp.dps=50 precision),
    # matching owen-t.js's own a<0 -> -owenT(h,-a) identity (owen-t.js:314), so no separate
    # sign-flip branch is needed here.
    return quad(lambda x: exp(-h * h * (1 + x * x) / 2) / (1 + x * x), [0, a]) / (2 * pi)


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
    'riemannZeta': riemannZeta_ref,
    'hurwitzZeta': hurwitzZeta_ref,
    'generalizedHarmonic': generalizedHarmonic_ref,
    'polylogarithm': polylogarithm_ref,
    'stirlingSecond': stirlingSecond_ref,
    'erf': erf_ref,
    'erfc': erfc_ref,
    'erfcx': erfcx_ref,
    'erfinv': erfinv_ref,
    'e1': e1_ref,
    'f11': f11_ref,
    'lambertW0': lambertW0_ref,
    'lambertW1m': lambertW1m_ref,
    'owenT': owenT_ref,
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


def _riemannZeta_grid(add):
    # Laurent-expansion band d=s-1 in (-0.01, 0.1001) around the s=1 pole (riemann-zeta.js:32)
    # vs the Wynn-epsilon-accelerated alternating series elsewhere (riemann-zeta.js:36-37). At
    # d=0 the Laurent branch's own 1/d term diverges to +Infinity -- no separate pole guard.
    add('riemannZeta', (1,), 'riemannZeta s=1: pole, diverges to +Infinity via the Laurent branch\'s 1/d term')
    for d in [-0.011, -0.01, -0.0099, -0.005, 0.1001, 0.1002]:
        s = 1 + d
        add('riemannZeta', (s,), f'riemannZeta s={s}: Laurent-band/general-branch crossover at d=s-1 in (-0.01,0.1001), d={d}')
    add('riemannZeta', (1.0999,), 'riemannZeta s=1.0999: Laurent-band right-edge truncation error (d=0.0999, just inside the 0.1001 boundary)',
        tol=_TOL_RIEMANNZETA_LAURENT_EDGE)
    for s in [0.9, 0.5, 0, -1]:
        add('riemannZeta', (s,), f'riemannZeta s={s}: general Wynn-epsilon branch, s well below the Laurent band')
    for s in [-3, -5]:
        add('riemannZeta', (s,), f'riemannZeta s={s}: general Wynn-epsilon branch, negative-s extrapolation-accuracy degradation',
            tol=_TOL_RIEMANNZETA_NEGATIVE_S)
    add('riemannZeta', (-15,), 'riemannZeta s=-15: negative-s Wynn-epsilon extrapolation becomes flatly wrong -- see WITHHELD')
    for s in [1.2, 1.5, 2, 3, 5, 10, 50, 100]:
        add('riemannZeta', (s,), f'riemannZeta s={s}: general Wynn-epsilon branch, s well above the Laurent band')


def _hurwitzZeta_grid(add):
    # EPS-tight pole guard at s=1 (hurwitz-zeta.js:17-19) vs the continuously-ramping Bernoulli
    # partial-sum term count n=max(50,min(100,ceil(1/(s-1)))) elsewhere (line 24): n saturates at
    # 100 for s-1<=0.01 and floors at 50 for s-1>=0.02, ramping between those boundaries.
    add('hurwitzZeta', (1, 2), 'hurwitzZeta s=1: EPS pole guard, diverges to +Infinity')
    for d in [0.005, 0.0099, 0.01, 0.0101, 0.015, 0.0199, 0.02, 0.0201, 0.03]:
        s = 1 + d
        for a in [1, 2]:
            add('hurwitzZeta', (s, a), f'hurwitzZeta s={s},a={a}: term-count ramp n=max(50,min(100,ceil(1/(s-1)))) boundary, d={d}')
    # Confirm the ramp's validity doesn't secretly depend on `a` (cf. besselKnu's own
    # order-reduction crossover lesson: a threshold measured at one fixed second parameter can
    # silently be wrong for others) by re-probing the two boundary d values at very different a.
    for a in [0.5, 5, 20]:
        for d in [0.01, 0.02]:
            add('hurwitzZeta', (1 + d, a), f'hurwitzZeta s={1 + d},a={a}: term-count ramp boundary, confirms a-independence')
    for s in [1.1, 1.5, 2, 5, 20]:
        for a in [1, 3]:
            add('hurwitzZeta', (s, a), f'hurwitzZeta s={s},a={a}: interior, term count floored at n=50')


def _generalizedHarmonic_grid(add):
    # n<10: direct neumaier-compensated-sum branch (generalized-harmonic.js:20-27).
    for n in [0, 1, 3, 5, 9]:
        for m in [0.5, 1, 2, 5]:
            add('generalizedHarmonic', (n, m), f'generalizedHarmonic n={n},m={m}: direct compensated-sum branch (n<10)')
    # n>=10, m===1: exact digamma identity H_n = gamma + psi(n+1) (line 30), avoiding the
    # zeta(1)-hurwitzZeta(1,.) = Infinity-Infinity = NaN the general branch would hit.
    for n in [10, 15, 50, 100]:
        add('generalizedHarmonic', (n, 1), f'generalizedHarmonic n={n},m=1: digamma-identity branch, avoids Infinity-Infinity')
    # n>=10, m!=1: riemannZeta(m)-hurwitzZeta(m,n+1) zeta-difference branch (line 31), interior m.
    for n in [10, 20, 50, 100]:
        for m in [0.5, 2, 3, 5]:
            add('generalizedHarmonic', (n, m), f'generalizedHarmonic n={n},m={m}: zeta-difference branch (n>=10), interior m')
    # Compound-threshold cluster: m near 1 (excluding the exact m===1 digamma branch) lands
    # inside riemannZeta's own Laurent band (riemann-zeta.js:32, d=m-1 in (-0.01,0.1001)), where
    # riemannZeta(m)-hurwitzZeta(m,n+1) subtracts two comparable-magnitude, individually
    # near-pole values -- a cancellation mechanism unique to this composition, unreachable by
    # either standalone function's own grid (mirrors _besselKnu_grid's connection-formula
    # cancellation cluster above for the same reason).
    for n in [10, 50]:
        for m in [0.995, 1.005, 1.05]:
            add('generalizedHarmonic', (n, m), f'generalizedHarmonic n={n},m={m}: compound riemannZeta/hurwitzZeta near-pole cancellation',
                tol=_TOL_GENHARMONIC_ZETA_CANCELLATION)


def _polylogarithm_grid(add):
    # n!=1 has no internal dispatch branch -- a single unconditional Wynn-epsilon series
    # (polylogarithm.js:19-23) -- so the only quality axis for those orders is convergence
    # degradation as |z|->1. Documented domain is |z|<1 (polylogarithm.js:9), so negative z
    # (alternating-sign cancellation inside Wynn-epsilon, a qualitatively different regime from
    # positive z's monotone convergence) is genuinely supported behavior, not scope creep, even
    # though the only current caller (ExponentialLogarithmic) only ever passes positive z.
    # n=1 (Li_1(z)=-ln(1-z)) is an explicit closed-form early return (polylogarithm.js:16-18,
    # issue #1414), not the general Wynn-epsilon series, so it stays exact -- including at
    # z=0.99/0.999 -- and needs no tolerance override anywhere in this grid.
    for z in [0.01, 0.5, 0.9, 0.99, 0.999, -0.5, -0.99]:
        add('polylogarithm', (1, z), f'polylogarithm n=1: closed form -ln(1-z), z={z}')
    # n=2: same convergence-degradation mechanism as n=3, one order closer to the n=1 accuracy
    # bug (issue #1414) -- the only untested order this close to that regime, so it gets its own
    # named tolerances (both interior and near-1) rather than reusing n=3's constant.
    for z in [0.01, 0.5, 0.9, -0.5, -0.99]:
        add('polylogarithm', (2, z), f'polylogarithm n=2: Wynn-epsilon convergence gradient, z={z}',
            tol=_TOL_POLYLOG_N2_INTERIOR)
    for z in [0.99, 0.999]:
        add('polylogarithm', (2, z), f'polylogarithm n=2: convergence-quality degradation near z=1, z={z}',
            tol=_TOL_POLYLOG_N2_NEAR_1)
    # n=3: same convergence-degradation mechanism, much milder -- named tolerance covers it.
    for z in [0.01, 0.5, 0.9, -0.5, -0.99]:
        add('polylogarithm', (3, z), f'polylogarithm n=3: Wynn-epsilon convergence gradient, z={z}')
    for z in [0.99, 0.999]:
        add('polylogarithm', (3, z), f'polylogarithm n=3: convergence-quality degradation near z=1, z={z}',
            tol=_TOL_POLYLOG_N3_NEAR_1)
    # n=4: converges faster than n=3 (one more power of k damping k^(-n)), but its interior
    # z=0.9 point still marginally breaches the 1e-13 default -- named tolerance covers it.
    for z in [0.01, 0.5, 0.9, -0.5, -0.99]:
        add('polylogarithm', (4, z), f'polylogarithm n=4: Wynn-epsilon convergence gradient, z={z}',
            tol=_TOL_POLYLOG_N4_INTERIOR)
    for z in [0.99, 0.999]:
        add('polylogarithm', (4, z), f'polylogarithm n=4: convergence-quality degradation near z=1, z={z}',
            tol=_TOL_POLYLOG_N4_NEAR_1)
    # n=5: converges faster still, but its interior z=0.9 point still marginally breaches the
    # 1e-13 default -- named tolerance covers it.
    for z in [0.01, 0.5, 0.9, -0.5, -0.99]:
        add('polylogarithm', (5, z), f'polylogarithm n=5: Wynn-epsilon convergence gradient, z={z}',
            tol=_TOL_POLYLOG_N5_INTERIOR)
    for z in [0.99, 0.999]:
        add('polylogarithm', (5, z), f'polylogarithm n=5: convergence-quality degradation near z=1, z={z}',
            tol=_TOL_POLYLOG_N5_NEAR_1)
    # n=8: higher order converges comfortably within the 1e-13 default even at z=0.999.
    for z in [0.01, 0.5, 0.9, 0.99, 0.999, -0.5, -0.99]:
        add('polylogarithm', (8, z), f'polylogarithm n=8: Wynn-epsilon convergence gradient, z={z}')


def _stirlingSecond_grid(add):
    # Pure memoized combinatorial recurrence (stirling.js:15) -- no numerical-method threshold,
    # only the domain guard n<0||k<0||k>n->0 and the n=0,k=0 base case (stirling.js:3,20-22).
    # Points beyond the 2^53 float64-safe-integer boundary are included deliberately: the
    # recurrence sums only non-negative terms (no cancellation), so both ranjs's own float64
    # accumulation and this reference's float64-cast-of-the-exact-integer round to the same
    # nearest representable value -- confirmed no tolerance override is needed even there (see
    # the module-level comment above WITHHELD).
    add('stirlingSecond', (0, 0), 'stirlingSecond n=0,k=0: base case, exactly 1')
    for n, k in [(1, 0), (0, 1), (5, 0), (5, 6), (-1, 2), (5, -1)]:
        add('stirlingSecond', (n, k), f'stirlingSecond n={n},k={k}: domain guard (n<0||k<0||k>n), exactly 0')
    for n, k in [(1, 1), (5, 1), (5, 3), (5, 5), (10, 1), (10, 5), (10, 10), (20, 10), (25, 12), (30, 15)]:
        add('stirlingSecond', (n, k), f'stirlingSecond n={n},k={k}: interior recurrence')


def _erf_grid(add):
    # x=2 series/CF crossover (error.js:67).
    for x in [0, 0.001, 0.5, 1, 1.9, 1.99, 2, 2.01, 2.1, 5, 10, 20, 26]:
        add('erf', (x,), 'erf: x<=2 series/x>2 CF crossover')
    # Sign-flip branch (error.js:66).
    for x in [-0.001, -0.5, -1, -2, -5]:
        add('erf', (x,), 'erf: x<0 sign-flip branch')


def _erfc_grid(add):
    # x=1 series/CF crossover (error.js:85-86, deliberately different from erf's own x=2), and
    # the x=26.6 hard-underflow-to-0 floor (error.js:81).
    for x in [0, 0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 5, 10, 20]:
        add('erfc', (x,), 'erfc: x<=1 series/x>1 CF crossover (distinct from erf\'s own x=2)')
    # Points strictly past x=26.6 are deliberately not probed in the (26.6, ~27.3] sliver where
    # the true value is still a representable float64 subnormal (e.g. ~6.4e-310 at x=26.61) but
    # ranjs's own hard floor already returns exactly 0 -- an intentional, documented
    # approximation (error.js:81), not an accuracy defect; x=30 is included since by then the
    # true value has itself underflowed past the smallest representable subnormal and rounds to
    # 0 on both sides, so it stays a meaningful boundary check.
    for x in [26, 26.5, 26.59, 26.6, 30]:
        add('erfc', (x,), 'erfc: x=26.6 hard underflow-to-0 floor')
    for x in [-0.001, -0.5, -1, -2, -5]:
        add('erfc', (x,), 'erfc: x<0 branch (1+erf(-x))')


def _erfcx_grid(add):
    # x<=0 direct branch and x=1 series/CF crossover (error.js:101-103).
    for x in [-5, -1, -0.5, 0, 0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2]:
        add('erfcx', (x,), 'erfcx: x<=0 direct / x<=1 series / x>1 CF crossover')
    # Large x: erfcx stays finite (~1/(x*sqrt(pi))) unlike erfc, which underflows past x=26.6 --
    # the function's whole reason for existing.
    for x in [10, 26.6, 50, 100, 1000]:
        add('erfcx', (x,), 'erfcx: large x, stays finite past erfc\'s own underflow floor')


def _erfinv_grid(add):
    # |x|=0.5 three-way residual-cancellation-avoidance crossover (error.js:131).
    for x in [-0.999, -0.9, -0.51, -0.5, -0.49, -0.1, 0, 0.1, 0.49, 0.5, 0.51, 0.9, 0.999]:
        add('erfinv', (x,), 'erfinv: |x|=0.5 three-way residual-cancellation crossover')


def _e1_grid(add):
    # z=1 series/CF crossover (e1.js:15).
    for z in [0.001, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 5, 10, 50, 100, 500]:
        add('e1', (z,), 'e1: z<=1 A&S 5.1.11 series / z>1 A&S 5.1.22 CF crossover')
    # Explicit boundary branches (e1.js:13): z=0 -> +Infinity, z<0 -> NaN.
    add('e1', (0,), 'e1 z=0: explicit +Infinity boundary')
    for z in [-0.5, -5]:
        add('e1', (z,), 'e1 z<0: explicit NaN domain guard')


def _f11_grid(add):
    # |a|<EPSILON exact-1 special case (hypergeometric.js:63-65).
    for b in [0.5, 1, 2, 5]:
        for z in [0, 1, 10, 40, 60, 100]:
            add('f11', (0, b, z), 'f11 a=0: exact-1 special case')
    # |z|=50 Taylor/asymptotic crossover (hypergeometric.js:67), several (a,b) pairs.
    for a, b in [(0.5, 1), (1, 2), (2, 1), (3, 7)]:
        for z in [49, 49.9, 50, 50.1, 51]:
            add('f11', (a, b, z), f'f11 a={a},b={b}: |z|=50 Taylor/asymptotic crossover')
    # Inner |(b-a)(1-a)|<=z truncate-at-minimum-term vs direct-sum threshold inside the
    # asymptotic branch (hypergeometric.js:28), straddled via z for a fixed (a,b).
    for a, b in [(2, 1), (5, 3)]:
        thr = abs((b - a) * (1 - a))
        for z in sorted({max(51.0, thr - 5), max(51.0, thr - 0.5), max(51.0, thr), thr + 0.5, thr + 5}):
            add('f11', (a, b, z), f'f11 a={a},b={b}: inner asymptotic-branch truncate-at-minimum-term threshold')
    # b<=0 integer pole: diverges to +Infinity via the guard added to f11() by this issue's own
    # new coverage (hypergeometric.js).
    for b in [0, -1, -2, -5]:
        add('f11', (1, b, 3), 'f11 b<=0 integer: pole, diverges to +Infinity (guard added by #1415)')
    # a also a non-positive integer but a<b (|a|>|b|): the denominator's own zero at k=|b|+1
    # still comes first, so this is a genuine pole too, distinct from the a>b/a==b exceptions
    # below -- confirmed via mpmath's own ZeroDivisionError there.
    for a, b, z in [(-3, -1, 5), (-5, -2, 3)]:
        add('f11', (a, b, z), 'f11 a,b both non-positive integer with a<b: denominator still hits its own pole first')
    # a also a non-positive integer with a>b: the numerator's own Pochhammer symbol reaches zero
    # before the denominator's does, so the series terminates as a well-defined polynomial
    # rather than hitting the pole -- the exact regression a review pass caught in an earlier,
    # overbroad version of the guard above (it returned Infinity for these too).
    for a, b, z in [(-1, -2, 3), (-2, -3, 1), (-3, -5, 2), (-1, -5, 4)]:
        add('f11', (a, b, z), 'f11 a,b both non-positive integer with a>b: numerator terminates the series before the b-pole')
    # a==b, both non-positive integer: WITHHELD -- see the WITHHELD dict's own comment. ranjs's
    # guard deliberately falls through to _f11TaylorSeries's own pre-existing 0/0 NaN rather
    # than asserting the equally-wrong +Infinity a second review pass also caught here.
    add('f11', (-1, -1, 5), 'f11 a==b non-positive integer: 0/0 indeterminate form, WITHHELD (see WITHHELD dict)')
    # a=0 takes priority over the b<=0 pole guard (hypergeometric.js's own branch order checks
    # |a|<EPSILON first) -- exercises the precedence between the two special-case branches.
    add('f11', (0, -3, 5), 'f11 a=0, b<=0 integer: a=0 branch wins (exact-1), never reaches the pole guard')
    # Negative non-integer b: the pole guard's own Number.isInteger(b) check must not fire here.
    for a, b, z in [(1, -2.5, 3), (2, -0.5, 10)]:
        add('f11', (a, b, z), 'f11 b<0 non-integer: pole guard must not fire (Number.isInteger(b) is false)')
    # Real-caller regime: NoncentralChi/DoublyNoncentralT call f11((k+j)/2, k/2, h) and
    # f11(kj, nu/2, theta/(2*tk)) -- positive, often half-integer a,b with a moderate positive z.
    for a, b, z in [(0.5, 0.5, 1), (1.5, 1, 5), (3.5, 2.5, 10), (10.5, 5, 20)]:
        add('f11', (a, b, z), 'f11: real-caller regime (NoncentralChi/DoublyNoncentralT half-integer a,b)')
    # Large |a| relative to b -- solutions/correctness/2026-07-30-1600-doubly-noncentral-t-pdf-
    # f11-recurrence-instability.md found instability in a *different* code path (a contiguous
    # recurrence approximating f11), which confirms this parameter regime is worth probing
    # directly against f11() itself even though this gate exercises a different code path.
    for a, b, z in [(60, 5, 120), (100, 3, 50)]:
        add('f11', (a, b, z), 'f11: large a relative to b, per doubly-noncentral-t f11 recurrence-instability solution doc')


def _lambertW0_grid(add):
    # z=-1/e domain boundary and z=1 initial-guess-seed crossover (lambert-w.js:62).
    # The exact boundary z=-1/e is deliberately not probed: JS's Math.exp(-1) (ranjs's own
    # guard, lambert-w.js:59) and mpmath's exp(-1) are independent float64/arbitrary-precision
    # approximations of an irrational number that can disagree by a single ULP, making "exactly
    # at the boundary" an ill-defined, coin-flip test -- probe with enough margin (0.001) to
    # stay unambiguous instead.
    neg_inv_e = -1 / math.e
    for z in [neg_inv_e - 0.001, neg_inv_e + 0.001, -0.3, -0.1, 0, 0.5, 0.9, 0.99,
              1, 1.01, 1.1, 2, 10, 100, 1000]:
        add('lambertW0', (z,), 'lambertW0: z=-1/e domain boundary, z=1 initial-guess-seed crossover')


def _lambertW1m_grid(add):
    # z=-1/e domain boundary and z=-0.1 initial-guess-seed crossover (lambert-w.js:35).
    # Exact boundary z=-1/e deliberately not probed -- see the identical note in
    # _lambertW0_grid above (JS's vs mpmath's independent exp(-1) approximations can disagree
    # by a ULP).
    neg_inv_e = -1 / math.e
    for z in [neg_inv_e - 0.001, neg_inv_e + 1e-6, -0.3, -0.11, -0.1, -0.09, -0.01,
              -0.001, -1e-6]:
        add('lambertW1m', (z,), 'lambertW1m: z=-1/e domain boundary, z=-0.1 initial-guess-seed crossover')
    # Outside the [-1/e, 0) domain.
    for z in [0, 0.5]:
        add('lambertW1m', (z,), 'lambertW1m: z>=0 outside domain, explicit NaN')


def _owenT_grid(add):
    # A_RANGES/H_RANGES sector-table boundaries (owen-t.js:10-34) -- every boundary value,
    # mirroring the coordinates test/special/owen-t.js's own hand-picked coverage already probes
    # (not its literal reference values, per issue #1415's own warning to independently derive
    # every mpmath reference).
    a_boundaries = [0.025, 0.09, 0.15, 0.36, 0.5, 0.9, 0.99999]
    h_boundaries = [0.02, 0.06, 0.09, 0.125, 0.26, 0.4, 0.6, 1.6, 1.7, 2.33, 2.4, 3.36, 3.4, 4.8]
    for a in a_boundaries:
        add('owenT', (0.5, a), f'owenT a={a}: A_RANGES sector boundary (h=0.5 fixed)')
    for h in h_boundaries:
        add('owenT', (h, 0.5), f'owenT h={h}: H_RANGES sector boundary (a=0.5 fixed)')
    # Top-level dispatch boundaries (owen-t.js:304-311): |a|<=1 direct vs |a|>1 reflection, and
    # within the |a|>1 branch, |h|<=0.67 (cut) vs the complementary-normal reflection.
    for h, a in [(1, 0.99), (1, 1), (1, 1.01), (1, 2), (1, 5)]:
        add('owenT', (h, a), 'owenT: |a|<=1/|a|>1 top-level dispatch boundary')
    for h, a in [(0.6, 2), (0.67, 2), (0.68, 2), (1, 2), (2, 2)]:
        add('owenT', (h, a), 'owenT: |a|>1 branch, |h|<=0.67 cut vs complementary-normal reflection')
    # a<0 sign-flip (owen-t.js:314), and the SkewNormal real-caller shape (both signs of a).
    for h, a in [(0.5, -0.5), (1, -2), (2, -0.25)]:
        add('owenT', (h, a), 'owenT: a<0 sign-flip, mirrors SkewNormal real-caller shape')


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
    _riemannZeta_grid(add)
    _hurwitzZeta_grid(add)
    _generalizedHarmonic_grid(add)
    _polylogarithm_grid(add)
    _stirlingSecond_grid(add)
    _erf_grid(add)
    _erfc_grid(add)
    _erfcx_grid(add)
    _erfinv_grid(add)
    _e1_grid(add)
    _f11_grid(add)
    _lambertW0_grid(add)
    _lambertW1m_grid(add)
    _owenT_grid(add)

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
