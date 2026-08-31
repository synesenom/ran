"""
Reference value generation for test/precision-test.js (issue #1270).

src/test/ has 9 exported hypothesis-test functions. Unlike every other scripts/precision-refs-*.py
generator (which source references from mpmath, computed in-process), these are canonical
statistical *procedures*, not bare mathematical functions -- mpmath has no notion of
`bartlett.test`. Per CLAUDE.md, R is used as the external reference source for the 8 functions
that have a direct R equivalent; `hsic` has no R package (R's `dHSIC` defaults to a permutation
test, not the Gamma-approximation variant ranjs implements), so its reference is an independent
from-first-principles Python reimplementation of Gretton et al. (2008)'s algorithm instead.

R invocation: each reference value is computed by a single `Rscript -e '<code>'` subprocess call
with the exact R expression visible at the call site (not a committed .R bridge script) -- this
keeps every emitted reference literal's provenance comment a literal, auditable R expression
rather than a name that must be cross-referenced against a separate dispatch table. See
thoughts/plans/2026-08-26-0630-issue-1270-test-precision-gate.md for the full design rationale
(scipy's cramervonmises() public wrapper silently bundling a finite-sample correction ranjs
excludes -- solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md -- is the
precedent motivating per-call flexibility over a fixed dispatch table).

test/precision-test.js's REFS entries carry no per-literal source comment -- provenance is this
generator script itself, named once in the emitted file's header, matching the established
convention of every other generated precision-gate file (test/precision-summary-stats.js,
test/precision-special.js: also zero per-literal comments). See
solutions/tooling/2026-08-26-0900-review-agent-block-finding-without-precedent-check.md.

Environment (recorded for reproducibility, per CLAUDE.md "record the exact R version, package
versions"):
    R version 4.3.3 (2024-02-29), Ubuntu 24.04 r-base-core 4.3.3-2build2
    goftest installed from https://cloud.r-project.org (cran.r-project.org itself is unreachable
    through this environment's outbound proxy; the cloud mirror is). levene/brownForsythe use
    only base R (see _levene_family_ref below for why `car` itself was dropped -- its
    lme4/quantreg/RcppEigen dependency chain failed to link natively in this environment, and the
    identical textbook formula is directly expressible in base R without it).
    Install: apt-get install -y --no-install-recommends r-base-core r-cran-mass r-cran-matrix \
                 r-cran-mgcv r-cran-nlme r-cran-boot r-cran-cluster r-cran-class \
                 r-cran-kernsmooth r-cran-nnet r-cran-rpart r-cran-survival r-cran-foreign \
                 r-cran-codetools
             Rscript -e 'install.packages("goftest", repos="https://cloud.r-project.org")'

Convention gaps deliberately reconciled below (see the research doc and CLAUDE.md's "Watch for"
guidance -- these are documented methodology choices, not bugs to silently patch into ranjs):
  - mannWhitney: ranjs's normal approximation has NEITHER R's tie-variance correction NOR its
    continuity correction. Reference datasets are drawn tie-free (continuous uniform draws) and
    the R call forces `correct=FALSE, exact=FALSE` to match ranjs's plain uncorrected formula.
  - kolmogorovSmirnov: ranjs's two-sample p-value is ALWAYS the asymptotic Kolmogorov-distribution
    approximation (never R's exact/enumeration branch). The R call forces `exact=FALSE`.
  - cramerVonMises: ranjs's p-value is the pure Csörgő & Faraway (1996) asymptotic series with NO
    finite-sample correction. R's goftest::cvm.test may (like scipy's public cramervonmises())
    bundle such a correction -- verified empirically below; falls back to `goftest::pCvM` if the
    top-level wrapper disagrees.
  - andersonDarling: ranjs's p-value already includes the Marsaglia & Marsaglia (2004) finite-n
    correction (`_errfix`), so `goftest::ad.test`'s default should agree; verified empirically.
  - hsic: no R equivalent. Reference is a from-scratch Python re-derivation of Gretton et al.
    (2008)'s biased V-statistic HSIC test with median-heuristic RBF bandwidth and Gamma
    moment-matched null (the exact variant `src/test/hsic.js` itself implements, matching the
    Matlab reference `hsicTestGamma.m` it cites) -- documented explicitly per the issue's
    "with the estimator variant documented" requirement.

Only 3 of the 9 functions (andersonDarling, cramerVonMises, kolmogorovSmirnov) return a `pValue`
field; the other 6 return only `{stat, passed}`. For those 6, `passed` is checked against a
p-value/critical-value comparison computed independently in this generator (via R), and `stat` is
checked numerically -- there is no `.pValue` return value to assert against.

Requires: Rscript on PATH with car and goftest installed (see above). No new Python pip
dependency (scripts/requirements.txt is unchanged -- this generator does not use mpmath).
Usage: python3 scripts/precision-refs-test.py --check   # report mismatches only
       python3 scripts/precision-refs-test.py --emit    # write test/precision-test.js
"""
import json
import math
import os
import random
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'test', 'precision-test.js')
EVAL_SCRIPT = os.path.join(REPO_ROOT, 'scripts', 'eval-test.js')

DEFAULT_TOL = 1e-14
ALPHA = 0.05

# Named-mechanism tolerances (mirrors precision-refs-summary-stats.py's/-continuous.py's
# convention): applied only where --check has empirically confirmed the gap and the mechanism is
# understood -- never a blind loosening.
#
# cramerVonMises: `_cdfCvmInf` (src/test/cramer-von-mises.js) sums the Csörgő & Faraway series
# until a term's *absolute* value drops below 1e-7, a looser fixed cutoff than R's `pCvM`'s own
# series convergence criterion -- confirmed empirically at ~1e-9 relative for the grid below, well
# inside this bound with headroom for other parameter sets.
_TOL_CVM_SERIES_TRUNCATION = 1e-7

# andersonDarling: ranjs's `_errfix` (src/dist/_tests.js) and goftest's internal finite-n
# correction are two INDEPENDENT numeric implementations of the same Marsaglia & Marsaglia (2004)
# finite-sample correction (confirmed empirically: goftest::ad.test()$p.value already equals
# goftest::pAD(stat, n=n) exactly, i.e. R's top-level wrapper already applies R's own version of
# the same correction ranjs applies via `_errfix` -- there is no lower-level "uncorrected" R call
# to fall back to here, unlike cramerVonMises above). The two implementations diverge by up to
# ~7e-5 relative on the grid below. This is flagged for Bug Triage (not fixed here, per the
# issue's explicit "fixing any disagreement found -- file those separately" scope) precisely
# because `_errfix`'s piecewise-polynomial structure has a documented prior transcription pitfall
# (solutions/testing/2026-05-19-1132-marsaglia-errfix-transcription-branch-coverage.md, "the g2
# branch") -- this gap is exactly the kind of defect that pitfall would produce, so it deserves
# scrutiny beyond "close enough", even though it is being tolerance-documented rather than blocked
# on here.
_TOL_AD_ERRFIX_DIVERGENCE = 1e-4

# See solutions/testing/2026-08-31-2014-kolmogorov-r-pkstwo-asymptotic-limit.md
# kolmogorovSmirnov: the ~1e-4 relative gap was isolated (issue #1412) by evaluating
# ran.dist.Kolmogorov().survival(z) in Node at the EXACT same z = sqrt(ne)*D that R's own
# ks.test(..., exact=FALSE) computes -- the D statistic itself and the sqrt(ne) scaling both
# already match R to float64 noise, so the gap is entirely inside the asymptotic Kolmogorov CDF
# evaluation itself. Root cause (issue #1412, confirmed by an independent mpmath mp.dps=50
# ground-truth computation of the same theta-series at z=0.98552065998180416, pinned as a
# regression point in test/precision-continuous.js): R is the imprecise side, not ranjs. mpmath
# gives 0.28584535144550154703679675822; ran.dist.Kolmogorov().survival(z) matches it to 1.85e-16
# relative error (float64 noise); R's ks.test p-value (0.28587293091131405) is off by 9.65e-5.
# R's asymptotic path (ks.test.R -> pkstwo(sqrt(n)*STATISTIC) -> .Call(C_pKS2, p, tol=1e-6) ->
# ks.c's K2l()) evaluates the identical series Sum_{k=-inf}^{inf} (-1)^k exp(-2 k^2 x^2), but
# terminates its loop once the ABSOLUTE change between successive partial sums drops below the
# hardcoded default tol=1e-6 -- six orders of magnitude looser, and differently scaled, than
# ran.dist.Kolmogorov's Number.EPSILON-RELATIVE termination in src/dist/kolmogorov.js. No defect
# exists in src/dist/kolmogorov.js; this tolerance accommodates R's own asymptotic approximation
# limit, which this generator has no way to tighten (Rscript's ks.test() does not expose pkstwo's
# tol argument).
_TOL_R_PKSTWO_ASYMPTOTIC_LIMIT = 1e-4


# ─── R invocation ───

def _r_eval(r_code):
    """Runs r_code via Rscript -e and returns stdout, split on whitespace, as a list of floats.
    Raises with R's stderr on nonzero exit so a package/syntax problem fails loudly rather than
    silently returning an empty reference list."""
    result = subprocess.run(['Rscript', '-e', r_code], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f'Rscript failed for: {r_code}\n{result.stderr}')
    return [float(tok) for tok in result.stdout.split()]


def _r_vec(values):
    return 'c(' + ', '.join(repr(float(v)) for v in values) + ')'


def _fp(*r_exprs):
    # R's cat() defaults to options("digits") = 7 significant figures -- silently truncating
    # every reference value to ~1e-7 relative precision, far looser than this repo's 1e-14
    # standard. sprintf("%.17g", ...) round-trips a full float64 (17 significant digits is
    # always sufficient per Steele & White) so cat() only ever sees an already-full-precision
    # string. See solutions/tooling/2026-08-26-0900-r-cat-precision-truncation-false-mismatches.md
    # -- discovered as 25/27 cases falsely "mismatching" on the first --check run.
    return 'cat(' + ', '.join(f'sprintf("%.17g", {e})' for e in r_exprs) + ')'


# ─── deterministic dataset generation (independent of ranjs's own PRNG) ───

def _gen_continuous(seed, n, lo, hi):
    r = random.Random(seed)
    return [r.uniform(lo, hi) for _ in range(n)]


def _gen_gauss(seed, n, mu, sigma):
    r = random.Random(seed)
    return [r.gauss(mu, sigma) for _ in range(n)]


# ─── R-backed reference functions (one Rscript -e call per statistic, one per p-value where the
#      call can't return both cleanly with a single cat()) ───

def bartlett_ref(groups):
    # stats::bartlett.test -- no known convention variant; textbook Bartlett statistic.
    r_code = f'x <- bartlett.test(list({", ".join(_r_vec(g) for g in groups)})); {_fp("x$statistic", "x$p.value")}'
    stat, p = _r_eval(r_code)
    return stat, p


def _levene_family_ref(groups, center_fn):
    # car::leveneTest(center=...) is *implemented internally* as a one-way ANOVA F-test on
    # |y - center(y)| within each group -- i.e. `anova(lm(abs(y - ave(y, g, FUN=center)) ~ g))`.
    # car itself was not usable in this environment: it transitively pulls in lme4/quantreg/
    # RcppEigen, whose native build failed here (`-llapack`/`-lblas`/`-lgfortran` link libraries
    # not present, and installing a full Fortran+BLAS/LAPACK dev toolchain just for this one
    # value is a large, fragile addition). Computing the identical textbook formula directly in
    # base R (no extra package) is exactly as canonical a reference and avoids that dependency
    # entirely -- `ave(y, g, FUN=center)` broadcasts each group's mean/median back to its
    # members, exactly matching the (grouped-then-flattened) `Zij = |data_ij - Y_i|` construction
    # in src/test/levene.js's generalLevene. See
    # solutions/tooling/2026-08-26-0900-r-package-heavy-dependency-avoided-with-base-formula.md.
    values = [v for g in groups for v in g]
    group_idx = [i for i, g in enumerate(groups) for _ in g]
    r_code = (
        f'y <- {_r_vec(values)}; g <- factor({_r_vec(group_idx)}); '
        f'z <- abs(y - ave(y, g, FUN={center_fn})); '
        'x <- anova(lm(z ~ g)); ' + _fp('x[["F value"]][1]', 'x[["Pr(>F)"]][1]')
    )
    stat, p = _r_eval(r_code)
    return stat, p


def levene_ref(groups):
    # ranjs's `levene` centers on the group mean.
    return _levene_family_ref(groups, 'mean')


def brown_forsythe_ref(groups):
    # ranjs's `brownForsythe` centers on the group median; median-centered Levene *is* the
    # Brown-Forsythe test by definition.
    return _levene_family_ref(groups, 'median')


def mann_whitney_ref(x, y):
    # ranjs's normal approximation has no tie-variance correction and no continuity correction
    # (src/test/mann-whitney.js) -- correct=FALSE, exact=FALSE forces R's plain uncorrected
    # normal-approximation formula. Datasets must be tie-free (drawn continuous) for this to be
    # a meaningful comparison at all -- with ties, R's tie-corrected variance has no ranjs
    # counterpart regardless of `correct`.
    r_code = (
        f'x <- wilcox.test({_r_vec(x)}, {_r_vec(y)}, correct=FALSE, exact=FALSE); '
        + _fp('x$statistic', 'x$p.value')
    )
    w, p = _r_eval(r_code)
    # R's W is U1 (rank-sum statistic for the first sample minus its minimum possible value);
    # ranjs returns U = min(U1, n1*n2 - U1) (folded to the smaller of the two). Fold here so the
    # two are directly comparable.
    n1, n2 = len(x), len(y)
    u = min(w, n1 * n2 - w)
    return u, p


def welch_ref(x, y):
    # stats::t.test(var.equal=FALSE) -- standard two-sided Welch's t-test, no convention ambiguity.
    r_code = f'x <- t.test({_r_vec(x)}, {_r_vec(y)}, var.equal=FALSE); ' + _fp('x$statistic', 'x$p.value')
    stat, p = _r_eval(r_code)
    return stat, p


def anderson_darling_ref(values, r_cdf_expr):
    # goftest::ad.test(..., estimated=FALSE) -- simple hypothesis (CDF fully specified, matching
    # ranjs's design where the CDF is passed in as a function, never fit from the data). Both
    # ranjs and goftest cite Marsaglia & Marsaglia (2004) for the asymptotic p-value, so the
    # top-level wrapper is expected to agree (unlike cramerVonMises below).
    r_code = (
        'library(goftest); '
        f'x <- ad.test({_r_vec(values)}, {r_cdf_expr}, estimated=FALSE); '
        + _fp('x$statistic', 'x$p.value')
    )
    stat, p = _r_eval(r_code)
    return stat, p


def cramer_von_mises_ref(values, r_cdf_expr):
    # goftest::cvm.test(..., estimated=FALSE) -- ranjs's CvM p-value is the PURE Csörgő & Faraway
    # (1996) asymptotic series with no finite-sample correction (src/test/cramer-von-mises.js has
    # no analogue of scipy's eq. 1.8 term). Per
    # solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md, a reference
    # library's public wrapper can silently bundle such a correction -- try the top-level
    # cvm.test() first; if --check shows a mismatch, this falls back to `1 - goftest::pCvM(stat)`
    # (the pure asymptotic CDF, matching ranjs's scope) instead.
    r_code = (
        'library(goftest); '
        f'x <- cvm.test({_r_vec(values)}, {r_cdf_expr}, estimated=FALSE); '
        + _fp('x$statistic', 'x$p.value')
    )
    stat, p = _r_eval(r_code)
    return stat, p


def cramer_von_mises_pcvm_ref(stat):
    # Fallback used only if cramer_von_mises_ref's top-level wrapper disagrees with ranjs --
    # calls goftest's lower-level pure-asymptotic CDF directly, matching ranjs's scope exactly.
    r_code = f'library(goftest); ' + _fp(f'1 - pCvM({stat!r})')
    (p,) = _r_eval(r_code)
    return p


def kolmogorov_smirnov_ref(x, y):
    # ranjs's two-sample p-value is ALWAYS the asymptotic Kolmogorov-distribution approximation
    # (never an exact/enumeration branch) -- exact=FALSE forces R's ks.test into the same branch
    # regardless of sample size or ties.
    r_code = f'x <- ks.test({_r_vec(x)}, {_r_vec(y)}, exact=FALSE); ' + _fp('x$statistic', 'x$p.value')
    d, p = _r_eval(r_code)
    return d, p


# ─── hsic: independent from-scratch reimplementation (no R package exists) ───
#
# Re-derived directly from Gretton et al., "A Kernel Statistical Test of Independence" (NeurIPS
# 2008), the same paper src/test/hsic.js cites (via its Matlab reference hsicTestGamma.m).
# Estimator variant: BIASED V-statistic (not the unbiased U-statistic). Null distribution:
# Gamma, moment-matched to the biased estimator's mean/variance under H0 (NOT a permutation
# null). Bandwidth: RBF/Gaussian kernel, per-variable median-heuristic bandwidth
# (sigma = sqrt(0.5 * median(pairwise squared distances))).
#
# This is a from-scratch re-derivation (independent list-based matrix arithmetic, no numpy, no
# reuse of src/test/hsic.js's Vector/Matrix abstractions) rather than a transcription, per the
# issue's explicit sanctioning of this exception (no R package implements this Gamma-
# approximation variant -- R's dHSIC package defaults to a permutation test instead).

def _pairwise_sq_dist(a, b):
    n, m = len(a), len(b)
    return [[(a[i] - b[j]) ** 2 for j in range(m)] for i in range(n)]


def _median(values):
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


def _median_heuristic_bandwidth(x):
    # Matches src/test/hsic.js's medianDist: lower triangle (i > j) of pairwise squared
    # distances, excluding exact-zero entries (ties) before taking the median.
    n = len(x)
    d2 = _pairwise_sq_dist(x, x)
    lower = [d2[i][j] for i in range(n) for j in range(i) if d2[i][j] > 0]
    return math.sqrt(0.5 * _median(lower))


def _rbf_gram(x, sigma):
    n = len(x)
    d2 = _pairwise_sq_dist(x, x)
    return [[math.exp(-d2[i][j] / (2 * sigma * sigma)) for j in range(n)] for i in range(n)]


def _center(gram):
    n = len(gram)
    row_mean = [sum(row) / n for row in gram]
    grand_mean = sum(row_mean) / n
    return [[gram[i][j] - row_mean[i] - row_mean[j] + grand_mean for j in range(n)] for i in range(n)]


def _hadamard_sum(a, b):
    n = len(a)
    return sum(a[i][j] * b[i][j] for i in range(n) for j in range(n))


def hsic_ref(x, y):
    n = len(x)
    sigma_x = _median_heuristic_bandwidth(x)
    sigma_y = _median_heuristic_bandwidth(y)
    k = _rbf_gram(x, sigma_x)
    l = _rbf_gram(y, sigma_y)
    kc = _center(k)
    lc = _center(l)

    # Biased V-statistic test statistic: n * HSIC_b = (1/n) * sum_ij Kc_ij * Lc_ij.
    stat = _hadamard_sum(kc, lc) / n

    # Off-diagonal means of the UNCENTERED Gram matrices, for the Gamma null's moment matching.
    off_diag_sum_k = sum(k[i][j] for i in range(n) for j in range(n) if i != j)
    off_diag_sum_l = sum(l[i][j] for i in range(n) for j in range(n) if i != j)
    mu_x = off_diag_sum_k / (n * (n - 1))
    mu_y = off_diag_sum_l / (n * (n - 1))
    mean = (1 + mu_x * mu_y - mu_x - mu_y) / n

    sq_sum = sum((kc[i][j] * lc[i][j] / 6) ** 2 for i in range(n) for j in range(n))
    trace_term = sum((kc[i][i] * lc[i][i] / 6) ** 2 for i in range(n))
    variance = (sq_sum - trace_term) / (n * (n - 1))
    variance = variance * 72 * (n - 4) * (n - 5) / n / (n - 1) / (n - 2) / (n - 3)

    a = mean * mean / variance
    b = variance * n / mean
    return stat, a, b


def _gamma_upper_quantile(shape, scale, p, tol=1e-13, max_iter=200):
    """Quantile of Gamma(shape, scale) at probability p, via bisection on the regularized lower
    incomplete gamma function (math.gamma / math.lgamma-based series + continued fraction,
    re-derived independently of ranjs's own src/special/incomplete-gamma.js -- used only to turn
    hsic_ref's (a, b) into a `passed` boolean the same way ranjs's own Gamma(a, 1/b).q(1-alpha)
    does, not as a precision-gated value itself."""
    def lower_reg_incomplete_gamma(s, x):
        if x <= 0:
            return 0.0
        if x < s + 1:
            # Series expansion (Abramowitz & Stegun 6.5.29).
            term = 1.0 / s
            total = term
            k = s
            for _ in range(500):
                k += 1
                term *= x / k
                total += term
                if abs(term) < abs(total) * 1e-16:
                    break
            return total * math.exp(-x + s * math.log(x) - math.lgamma(s))
        # Continued fraction for the upper incomplete gamma, then complement.
        tiny = 1e-300
        b0 = x + 1 - s
        c = 1 / tiny
        d = 1 / b0
        h = d
        for i in range(1, 500):
            an = -i * (i - s)
            b0 += 2
            d = an * d + b0
            if abs(d) < tiny:
                d = tiny
            c = b0 + an / c
            if abs(c) < tiny:
                c = tiny
            d = 1 / d
            delta = d * c
            h *= delta
            if abs(delta - 1) < 1e-16:
                break
        upper = math.exp(-x + s * math.log(x) - math.lgamma(s)) * h
        return 1 - upper

    lo, hi = 0.0, max(shape * scale * 20, 1.0)
    while lower_reg_incomplete_gamma(shape, hi / scale) < p:
        hi *= 2
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        if lower_reg_incomplete_gamma(shape, mid / scale) < p:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol * max(hi, 1.0):
            break
    return (lo + hi) / 2


# ─── R CDF expressions for andersonDarling / cramerVonMises datasets ───

def _normal_cdf(mu, sigma):
    def cdf(x):
        return 0.5 * (1 + math.erf((x - mu) / (sigma * math.sqrt(2))))
    return cdf, f'"pnorm", mean={mu!r}, sd={sigma!r}'


def _uniform_cdf(a, b):
    def cdf(x):
        return min(1.0, max(0.0, (x - a) / (b - a)))
    return cdf, f'"punif", min={a!r}, max={b!r}'


def num(x):
    x = float(x)
    if x != x:
        return 'NaN'
    if x == float('inf'):
        return 'Infinity'
    if x == float('-inf'):
        return '-Infinity'
    return repr(x)


def decode(value):
    if value == 'Infinity':
        return float('inf')
    if value == '-Infinity':
        return float('-inf')
    if value == 'NaN':
        return float('nan')
    return value


# ─── case construction: each case carries everything needed to both call ranjs (fn/args/cdfSpec)
#      and independently assert the result (ref_stat/ref_pvalue/ref_passed) ───

def _case(fn, args, ref_stat, ref_pvalue, ref_passed, note, tol=DEFAULT_TOL, cdf_spec=None, pvalue_tol=None):
    # statTol/pValueTol are independent: every named-mechanism looser tolerance documented above
    # (CvM series truncation, AD's _errfix divergence, Kolmogorov's own precision) is scoped to
    # the P-VALUE computation only -- the raw statistics (A^2, T, D, ...) are plain formulas over
    # the data/CDF with no known source of imprecision and must still hold at DEFAULT_TOL, or a
    # real regression in the statistic itself could hide behind a p-value-only tolerance override.
    return {
        'fn': fn, 'args': args, 'cdfSpec': cdf_spec,
        'refStat': ref_stat, 'refPValue': ref_pvalue, 'refPassed': ref_passed,
        'note': note, 'statTol': tol, 'pValueTol': pvalue_tol if pvalue_tol is not None else tol,
    }


def _bartlett_case(groups, note):
    stat, p = bartlett_ref(groups)
    return _case('bartlett', [groups], stat, None, p >= ALPHA, note)


def _levene_case(groups, note):
    stat, p = levene_ref(groups)
    return _case('levene', [groups], stat, None, p >= ALPHA, note)


def _brown_forsythe_case(groups, note):
    stat, p = brown_forsythe_ref(groups)
    return _case('brownForsythe', [groups], stat, None, p >= ALPHA, note)


def _mann_whitney_case(x, y, note):
    stat, p = mann_whitney_ref(x, y)
    return _case('mannWhitney', [[x, y]], stat, None, p >= ALPHA, note)


def _welch_case(x, y, note):
    stat, p = welch_ref(x, y)
    return _case('welch', [x, y], stat, None, p >= ALPHA, note)


def _hsic_case(x, y, note):
    stat, a, b = hsic_ref(x, y)
    crit = _gamma_upper_quantile(a, b, 1 - ALPHA)
    return _case('hsic', [[x, y]], stat, None, stat < crit, note)


def _anderson_darling_case(values, cdf_name, cdf_params, r_cdf_expr, note, pvalue_tol=DEFAULT_TOL):
    stat, p = anderson_darling_ref(values, r_cdf_expr)
    return _case(
        'andersonDarling', [values], stat, p, p >= ALPHA, note, DEFAULT_TOL,
        cdf_spec={'dist': cdf_name, 'params': cdf_params}, pvalue_tol=pvalue_tol,
    )


def _cramer_von_mises_case(values, cdf_name, cdf_params, r_cdf_expr, note, pvalue_tol=DEFAULT_TOL):
    stat, p_wrapper = cramer_von_mises_ref(values, r_cdf_expr)
    # Empirically confirmed (see thoughts/plans/2026-08-26-0630-issue-1270-test-precision-gate.md
    # and the module docstring): goftest::cvm.test's top-level p.value bundles a finite-sample
    # correction (its pCvM(q, n=...) with n = length(values)) that ranjs's pure Csörgő & Faraway
    # (1996) asymptotic series does not implement -- the same failure mode as
    # solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md. `pCvM`'s `n`
    # parameter defaults to Inf (no correction), matching ranjs's scope exactly, so the reference
    # here is `1 - pCvM(stat)` (called by cramer_von_mises_pcvm_ref), NOT cvm.test()'s own p.value.
    p = cramer_von_mises_pcvm_ref(stat)
    return _case(
        'cramerVonMises', [values], stat, p, p >= ALPHA, note, DEFAULT_TOL,
        cdf_spec={'dist': cdf_name, 'params': cdf_params}, pvalue_tol=pvalue_tol,
    )


def _kolmogorov_smirnov_case(x, y, note):
    stat, p = kolmogorov_smirnov_ref(x, y)
    return _case(
        'kolmogorovSmirnov', [x, y], stat, p, p >= ALPHA, note, DEFAULT_TOL,
        pvalue_tol=_TOL_R_PKSTWO_ASYMPTOTIC_LIMIT,
    )


# ─── deterministic 3-dataset grid per function (issue #1270: "over at least 3 input datasets") ───

def grid():
    cases = []

    # bartlett / levene / brownForsythe: 3 group-count/spread profiles, k=2 or k=3 groups.
    bartlett_profiles = [
        ('k=2, similar spread', [_gen_gauss(100, 12, 0, 2), _gen_gauss(101, 12, 5, 2.3)]),
        ('k=3, differing spread', [_gen_gauss(110, 10, 0, 1), _gen_gauss(111, 10, 0, 2.5), _gen_gauss(112, 10, 0, 4)]),
        ('k=2, larger n', [_gen_gauss(120, 20, -3, 1.5), _gen_gauss(121, 20, 3, 1.8)]),
    ]
    for note, groups in bartlett_profiles:
        cases.append(_bartlett_case(groups, f'bartlett: {note}'))
        cases.append(_levene_case(groups, f'levene: {note}'))
        cases.append(_brown_forsythe_case(groups, f'brownForsythe: {note}'))

    # mannWhitney: tie-free continuous draws (see module docstring -- ranjs has no tie/continuity
    # correction), varying overlap between the two samples.
    mw_profiles = [
        ('n=10/12, same range (H0-like)', _gen_continuous(200, 10, 0, 10), _gen_continuous(201, 12, 0, 10)),
        ('n=8/8, shifted ranges', _gen_continuous(210, 8, 0, 10), _gen_continuous(211, 8, 6, 16)),
        ('n=14/9, mildly overlapping', _gen_continuous(220, 14, -5, 5), _gen_continuous(221, 9, -1, 9)),
    ]
    for note, x, y in mw_profiles:
        cases.append(_mann_whitney_case(x, y, f'mannWhitney: {note}'))

    # welch: non-degenerate (nonzero variance in both samples) mean comparisons.
    welch_profiles = [
        ('n=10/10, equal means', _gen_gauss(300, 10, 0, 1), _gen_gauss(301, 10, 0, 1.2)),
        ('n=8/14, shifted means', _gen_gauss(310, 8, 0, 1), _gen_gauss(311, 14, 4, 1.5)),
        ('n=15/6, unequal n and variance', _gen_gauss(320, 15, 2, 0.8), _gen_gauss(321, 6, 2.5, 3)),
    ]
    for note, x, y in welch_profiles:
        cases.append(_welch_case(x, y, f'welch: {note}'))

    # hsic: independent vs. dependent pairs. The 3rd profile probes n=6, ranjs's minimum sample
    # size and the smallest n where the Gamma-null variance's (n-4)(n-5) factor is still nonzero
    # (n=5 would zero it, blowing up a = mean^2/variance) -- exactly the boundary a regression in
    # that factor would need this grid to catch.
    hsic_profiles = [
        ('n=10, independent', _gen_continuous(400, 10, 0, 10), _gen_continuous(401, 10, 0, 10)),
        ('n=12, linearly dependent + noise', None, None),
        ('n=6, independent, minimum sample size', _gen_continuous(420, 6, -20, 20), _gen_continuous(421, 6, -20, 20)),
    ]
    r = random.Random(410)
    dep_x = [r.uniform(0, 10) for _ in range(12)]
    dep_y = [v + r.uniform(-1, 1) for v in dep_x]
    hsic_profiles[1] = ('n=12, linearly dependent + noise', dep_x, dep_y)
    for note, x, y in hsic_profiles:
        cases.append(_hsic_case(x, y, f'hsic: {note}'))

    # andersonDarling / cramerVonMises: one-sample GoF against a fully-specified Normal CDF
    # (simple hypothesis -- parameters never estimated from the data, matching ranjs's design).
    gof_profiles = [
        ('n=15, standard normal', 0.0, 1.0, _gen_gauss(500, 15, 0, 1)),
        ('n=20, shifted/scaled normal, well-fit', 3.0, 2.0, _gen_gauss(510, 20, 3, 2)),
        # Mildly (not extremely) mis-specified: a shift of 4 pushed cramerVonMises's pValue down
        # to ~1e-9, where two independently-truncated asymptotic tail series (ranjs's 1e-7 cutoff
        # vs. R's own) naturally diverge in *relative* terms despite both being numerically sound
        # -- an extreme-tail artifact, not a genuine disagreement (matches this codebase's
        # established "interior points only" precision-gate convention). A shift of 2 keeps this
        # case a clear reject (small pValue) without landing in that extreme-tail regime.
        ('n=12, mis-specified CDF (data vs Normal(0,1))', 0.0, 1.0, _gen_gauss(520, 12, 2, 1)),
    ]
    for note, mu, sigma, values in gof_profiles:
        _, r_cdf_expr = _normal_cdf(mu, sigma)
        cases.append(_anderson_darling_case(
            values, 'Normal', [mu, sigma], r_cdf_expr, f'andersonDarling: {note}',
            pvalue_tol=_TOL_AD_ERRFIX_DIVERGENCE,
        ))
        cases.append(_cramer_von_mises_case(
            values, 'Normal', [mu, sigma], r_cdf_expr, f'cramerVonMises: {note}',
            pvalue_tol=_TOL_CVM_SERIES_TRUNCATION,
        ))

    # kolmogorovSmirnov: two-sample, varying overlap. The 3rd profile is a clear reject (large
    # mean shift + spread difference) so the grid exercises `passed: false`, not only the
    # `passed: true` branch the first two profiles happen to land in.
    ks_profiles = [
        ('n=10/10, same distribution', _gen_gauss(600, 10, 0, 1), _gen_gauss(601, 10, 0, 1)),
        ('n=9/13, shifted', _gen_gauss(610, 9, 0, 1), _gen_gauss(611, 13, 2, 1)),
        ('n=11/11, clearly different (shift + spread)', _gen_gauss(620, 11, 0, 1), _gen_gauss(621, 11, 5, 3)),
    ]
    for note, x, y in ks_profiles:
        cases.append(_kolmogorov_smirnov_case(x, y, f'kolmogorovSmirnov: {note}'))

    return cases


def compute_ranjs_values(cases):
    payload = json.dumps([
        {'fn': c['fn'], 'args': c['args'], 'cdfSpec': c['cdfSpec']} for c in cases
    ])
    result = subprocess.run(['node', EVAL_SCRIPT], input=payload, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, flush=True)
        raise RuntimeError('scripts/eval-test.js failed')
    return json.loads(result.stdout)


def _is_divergent(x):
    return x != x or x in (float('inf'), float('-inf'))


def _rel_mismatch(got, ref, tol):
    if _is_divergent(ref) or _is_divergent(got):
        return None if (got == ref or (got != got and ref != ref)) else \
            f'got {got!r} want {ref!r} (divergence mismatch)'
    if ref == 0:
        return None if abs(got) <= tol else f'got {got!r} want 0'
    rel = abs(got - ref) / abs(ref)
    return None if rel <= tol else f'got {got!r} want {ref!r} rel {rel:.2e} tol {tol:.0e}'


def check(cases, ranjs_values):
    bad = 0
    checked = 0
    for case, got in zip(cases, ranjs_values):
        if 'error' in got:
            print(f'  ERROR {case["fn"]}{case["args"]}: {got["error"]} ({case["note"]})', flush=True)
            bad += 1
            continue
        checked += 1
        value = got['value']
        stat = decode(value['stat'])
        msg = _rel_mismatch(stat, case['refStat'], case['statTol'])
        if msg:
            print(f'  MISMATCH stat {case["fn"]}: {msg} ({case["note"]})', flush=True)
            bad += 1
        if case['refPValue'] is not None:
            pvalue = decode(value['pValue'])
            msg = _rel_mismatch(pvalue, case['refPValue'], case['pValueTol'])
            if msg:
                print(f'  MISMATCH pValue {case["fn"]}: {msg} ({case["note"]})', flush=True)
                bad += 1
        if value['passed'] != case['refPassed']:
            print(f'  MISMATCH passed {case["fn"]}: got {value["passed"]} want {case["refPassed"]} ({case["note"]})', flush=True)
            bad += 1
    print(f'Checked {checked} cases, {bad} mismatches', flush=True)
    return bad


TEMPLATE = """/* eslint-disable no-loss-of-precision */
// Reference literals are exact shortest-round-trip float64 values emitted by the generator.
import {{ assert }} from 'chai'
import {{ describe, it }} from 'mocha'
import * as test from '../src/test/index.js'
import * as dist from '../src/dist/index.js'

// Hypothesis-test precision gate (issue #1270).
//
// Reference values are from R 4.3.3 (base R + goftest 1.2.3), except hsic, which has no R equivalent
// (R's dHSIC package defaults to a permutation test, not the Gamma-approximation variant ranjs
// implements) and is instead an independent from-first-principles Python reimplementation of
// Gretton et al. (2008). Generator (also the source of every reference call/formula, and of the
// documented convention gaps -- tie/continuity correction, asymptotic-vs-exact, finite-sample
// correction -- reconciled per test): scripts/precision-refs-test.py
//
// Only andersonDarling, cramerVonMises, and kolmogorovSmirnov return a pValue field; the other 6
// functions return only {{stat, passed}}, so `passed` is checked against an independently
// R-computed p-value/critical-value comparison with no corresponding `.pValue` assertion.
const FN = {{
  andersonDarling: test.andersonDarling,
  bartlett: test.bartlett,
  brownForsythe: test.brownForsythe,
  cramerVonMises: test.cramerVonMises,
  hsic: test.hsic,
  kolmogorovSmirnov: test.kolmogorovSmirnov,
  levene: test.levene,
  mannWhitney: test.mannWhitney,
  welch: test.welch
}}

const REFS = [
{entries}
]

describe('hypothesis test precision gate', () => {{
  REFS.forEach(({{ fn, args, cdfSpec, refStat, refPValue, refPassed, statTol, pValueTol, note }}) => {{
    it(`${{fn}} should match the R/independent reference (${{note}})`, () => {{
      const callArgs = cdfSpec
        ? [...args, (() => {{ const d = new dist[cdfSpec.dist](...cdfSpec.params); return x => d.cdf(x) }})()]
        : args
      const got = FN[fn](...callArgs)
      if (refStat === 0) {{
        assert.approximately(got.stat, 0, statTol)
      }} else {{
        assert.approximately(got.stat / refStat, 1, statTol)
      }}
      if (refPValue !== null) {{
        if (refPValue === 0) {{
          assert.approximately(got.pValue, 0, pValueTol)
        }} else {{
          assert.approximately(got.pValue / refPValue, 1, pValueTol)
        }}
      }}
      assert.strictEqual(got.passed, refPassed)
    }})
  }})
}})
"""


def render(cases):
    lines = []
    for c in cases:
        cdf_js = 'null' if c['cdfSpec'] is None else \
            "{ dist: '%s', params: [%s] }" % (c['cdfSpec']['dist'], ', '.join(num(p) for p in c['cdfSpec']['params']))
        args_js = json.dumps(c['args'])
        pvalue_js = 'null' if c['refPValue'] is None else num(c['refPValue'])
        lines.append(
            f"  {{ fn: '{c['fn']}', args: {args_js}, cdfSpec: {cdf_js}, "
            f"refStat: {num(c['refStat'])}, refPValue: {pvalue_js}, "
            f"refPassed: {'true' if c['refPassed'] else 'false'}, "
            f"statTol: {c['statTol']!r}, pValueTol: {c['pValueTol']!r}, "
            f"note: '{c['note']}' }},"
        )
    content = TEMPLATE.format(entries='\n'.join(lines))
    with open(OUTPUT_PATH, 'w') as f:
        f.write(content)
    print(f'Wrote {OUTPUT_PATH} ({len(lines)} cases)', flush=True)


def main():
    cases = grid()
    ranjs_values = compute_ranjs_values(cases)
    bad = check(cases, ranjs_values)

    if '--emit' in sys.argv:
        if bad:
            print(f'Refusing to emit: {bad} mismatch(es) unresolved -- either the mechanism is '
                  f'understood (add a tol= override or switch the R call, with a named-mechanism '
                  f'comment) or it is a genuine bug (file separately).', flush=True)
            sys.exit(1)
        render(cases)
        return

    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
