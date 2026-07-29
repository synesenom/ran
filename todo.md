# ranjs — Development Backlog

> Structured from the raw `todo` file.
> Issues already filed on GitHub are linked where known.

---

## Most Important

### Improve special function precision

The functions in `src/special/` are the numerical foundation for almost every distribution CDF, quantile, and likelihood. Known gaps:

- **`bessel.js`** — large-order and large-argument Bessel functions (used by Rice, Noncentral distributions) rely on asymptotic expansions whose accuracy degrades near the transition region. Quantified by the threshold-focused precision gate in `test/precision-special.js` (issue #1140): `besselK`/`besselKnu`'s series/asymptotic crossover at `x=6` is accurate to only ~1e-7 for `x` just past the crossover (vs. the library's usual ~1e-13), improving to ~1e-10 by `x=10` — the residual gap is tracked for follow-up, not yet fixed.

**Goal:** every special function should be accurate to within a few ULP for all representable inputs, as documented in accuracy tables (see publication-grade section below).

---

## Publication-Grade Gaps

Moving the library from *auditable* to *publication-grade* requires systematic reference-value coverage and documented accuracy bounds.

### Not Yet Filed

- **Documented accuracy bounds** — for each special function and distribution CDF, state clearly: "accurate to X ULP for |x| ≤ Y" so users can reason about numerical error in downstream computations.

---

## Distributions

> Within each subsection, entries are ordered from most broadly useful to most specialised.

### Continuous

#### Stable (Lévy α-stable)
Four-parameter family (α ∈ (0,2], β ∈ [−1,1], γ ≥ 0, δ ∈ ℝ) encompassing all distributions that are limits of normalized sums of iid random variables. No closed-form PDF/CDF except for special cases (Cauchy: α=1, β=0; Gaussian: α=2; Lévy: α=½, β=1).
- **Sampling:** Chambers-Mallows-Stuck (CMS) algorithm — exact, O(1)
- **PDF/CDF:** numerical Fourier inversion; expensive and numerically delicate
- **Note:** This is a large implementation effort; the CMS sampler alone may ship as a first step. Several existing distributions (Cauchy, Levy) are special cases.
- Implementation complexity: **high**
- Refs: Chambers, J.M., Mallows, C.L. & Stuck, B.W. (1976) "A Method for Simulating Stable Random Variables", *JASA* 71(354):340–344; Nolan, J.P. (2020) *Univariate Stable Distributions*, Springer; [Wikipedia](https://en.wikipedia.org/wiki/Stable_distribution)

#### Variance-Gamma
Special case of the Generalized Hyperbolic distribution with δ = 0. Popular in option pricing (Madan-Seneta model).
- **PDF:** f(x; μ, σ, ν, θ) involves |x−μ|^(λ−½) · K_{λ−½}(α|x−μ|) where α = √(θ²/σ⁴ + 2/(σ²ν)), λ = 1/ν
- **Sampling:** via variance-mean mixture: X | G ~ Normal(μ + θG, σ²G), G ~ Gamma(1/ν, ν)
- **Dependency:** `bessel.js` (`besselKnu` — already implemented), `_gamma.js`
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Variance-gamma_distribution)

#### Normal-Inverse Gaussian (NIG)
Special case of the Generalized Hyperbolic distribution with λ = −½. Popular in financial return modelling and engineering.
- **PDF:** f(x; μ, α, β, δ) = (αδ/π) · K₁(α√(δ²+(x−μ)²)) / √(δ²+(x−μ)²) · exp(δγ + β(x−μ))  where γ = √(α²−β²)
- **Sampling:** via the representation X | V ~ Normal(μ + βV, V), V ~ InverseGaussian(δ/γ, δ²)
- **Dependency:** `bessel.js` (`besselK` — already implemented), `inverse-gaussian.js`
- Refs: [scipy `norminvgauss`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norminvgauss.html)

#### Generalized Hyperbolic
A five-parameter family (λ, α, β, μ, δ) that unifies several heavy-tailed distributions used in finance and physics. Special cases include:
- **Normal-Inverse Gaussian (NIG):** λ = −½
- **Variance-Gamma:** δ = 0
- **Hyperbolic:** λ = 1
- **Student-t:** α = 0 (limit)
- **PDF:** involves modified Bessel function K_λ(·) — `besselKnu` already implemented in `bessel.js`
- **Sampling:** via the GIG (Generalized Inverse Gaussian) mixing representation
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Generalised_hyperbolic_distribution)

#### Normal-Inverse Gamma
Conjugate prior for the mean and variance of a normal distribution in Bayesian analysis. As a univariate marginal for the mean, it reduces to a (scaled) Student-t.
- **PDF:** f(μ, σ²; μ₀, λ, α, β) = NormalPDF(μ | μ₀, σ²/λ) · InverseGammaPDF(σ² | α, β)
- **Sampling:** draw σ² from InverseGamma(α, β), then μ from Normal(μ₀, σ²/λ)
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Normal-inverse-gamma_distribution); note: special case of Generalized Hyperbolic

#### Normal Product
Distribution of Z = X·Y where X, Y ~ Normal(0, 1) independently. The sampler is trivial; the main work is implementing the PDF via K₀.
- **PDF:** f(z) = K₀(|z|)/π where K₀ is the modified Bessel function of the second kind, order 0
- **Sampling:** trivial — multiply two standard Normal samples
- **Dependency:** `bessel.js` (`besselK` with n=0 — already implemented)
- Refs: [MathWorld](http://mathworld.wolfram.com/NormalProductDistribution.html)

#### Normal-Exponential-Gamma (NEG)
Three-parameter scale mixture of normals where the variance follows a Gamma prior with an Exponential-Gamma hyperprior. Produces a heavy-tailed, leptokurtic distribution useful in sparse signal modelling. Marginal PDF has a closed form involving Kummer's confluent hypergeometric function.
- Refs: Griffin, J.E. & Brown, P.J. (2011) "Bayesian Hyper-Lassos With Non-Convex Penalization", *Australian & New Zealand Journal of Statistics* 53(4):423–442

#### Generalized Beta-Prime
Extension of the Beta-Prime (a.k.a. inverted-Beta, Pearson type VI) distribution with additional shape parameters. Beta-Prime itself is already in `src/dist/beta-prime.js`.
- Refs: [scipy `betaprime`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.betaprime.html) with extended parameterization

#### Generalized Logistic Type IV (Skew-Logistic)
The four-type Generalized Logistic family has Types I–IV in the literature; the library's `GeneralizedLogistic` covers only one parameterisation. Type IV has a PDF expressible as a rescaled beta density on the logistic scale, nesting the symmetric logistic at α = β = 1. Used in extreme-value theory and L-moments hydrology (Hosking framework).
- **PDF:** f(x; α, β) = B(α, β)⁻¹ · exp(−αx) / (1 + exp(−x))^(α+β)
- **CDF:** I(eˣ/(1+eˣ); α, β) — regularized incomplete beta
- **Sampling:** logit transform of a Beta(α, β) variate
- **Dependency:** `beta-incomplete.js` (already in `src/special/`)
- Refs: Hosking, J.R.M. (1994) "The four-parameter kappa distribution", *IBM Journal of Research and Development* 38(3):251–258

#### Power-Lognormal
Generalization of the lognormal distribution by raising its CDF to a power p. Also called the "Crow distribution." Used in reliability engineering.
- **PDF:** f(x; σ, p) = p · φ(log x / σ) / (x · σ) · Φ(−log x / σ)^(p−1) where φ and Φ are standard normal PDF/CDF
- **CDF:** F(x) = 1 − Φ(log x / σ)^p
- **Sampling:** inversion: x = exp(−σ · Φ⁻¹(u^(1/p)))
- Refs: [scipy `powerlognorm`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlognorm.html)

#### Generalized Half-Logistic
Generalization of `src/dist/half-logistic.js` with an additional shape parameter controlling tail weight. Used in reliability and survival analysis.
- Refs: [scipy `genhalflogistic`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.genhalflogistic.html)

#### Exponentiated Exponential (Gupta-Kundu)
Two-parameter alternative to the Gamma and Weibull for lifetime data; has a simpler closed-form CDF that makes parameter estimation easier. Can be implemented as a thin subclass of the existing `ExponentiatedWeibull` with shape k = 1 fixed.
- **CDF:** F(x; α, λ) = (1 − e^(−λx))^α
- **PDF:** f(x; α, λ) = α·λ·e^(−λx)·(1−e^(−λx))^(α−1)
- **Sampling:** exact inversion: x = −log(1−u^(1/α))/λ
- Note: `ExponentiatedWeibull` is already in `src/dist/exponentiated-weibull.js`; this can subclass it with k = 1
- Refs: Gupta, R.D. & Kundu, D. (1999) "Generalized exponential distributions", *Australian & New Zealand Journal of Statistics* 41(2):173–188

#### Two-Component Weibull Mixture
Standard model for bimodal failure-time data (infant mortality + wear-out failure modes). Widely used in mechanical reliability, semiconductor burn-in, and field-return analysis (MIL-HDBK-338B).
- **PDF:** f(x; λ₁, k₁, λ₂, k₂, p) = p·Weibull(λ₁,k₁) + (1−p)·Weibull(λ₂,k₂)
- **Sampling:** draw Bernoulli(p), then sample from the selected Weibull component
- **Dependency:** `src/dist/weibull.js` (already present)
- Refs: [Wikipedia — mixture distribution](https://en.wikipedia.org/wiki/Mixture_distribution)

#### Gauss Hypergeometric
Continuous distribution on [0, 1] whose PDF involves the Gauss hypergeometric function ₂F₁.
- **PDF:** f(x; a, b, c, z) ∝ x^a · (1−x)^b · (1+zx)^c
- **Dependency:** `hypergeometric.js` must implement ₂F₁ accurately for |z| < 1
- Refs: [scipy `gausshyper`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gausshyper.html)

#### Hoyt (Nakagami-q)
The classical Hoyt distribution — not to be confused with `ran.dist.Hoyt`, which was a misnamed alias for the Nakagami-m distribution and has been deprecated (see #226). The true Hoyt (Nakagami-q) PDF contains a modified Bessel function I₀ and is a distinct family used in fading-channel modelling.
- **PDF:** f(x; q, ω) = 2(1+q²)x / (qω) · exp(−(1+q²)²x²/(4q²ω)) · I₀((1−q⁴)x²/(4q²ω)),  q ∈ (0, 1], ω > 0, x ≥ 0
- **CDF:** no elementary closed form; expressible via the Marcum Q-function: F(x) = 1 − Q₁(a·x, b·x) where a and b are functions of q and ω
- **Sampling:** rejection sampling against a Rayleigh envelope, or inversion via Brent root-finding on the Marcum Q CDF
- **Dependency:** `bessel.js` (I₀ — already present); `marcum-q.js` (marcumQ — already present)
- Refs: [Wikipedia — Hoyt distribution](https://en.wikipedia.org/wiki/Hoyt_distribution); Simon, M.K. (2002) "A new twist on the Marcum Q-function and its application", *IEEE Commun. Lett.* 2(2):39–41

#### Wrapped Normal
Circular diffusion model; the standard distribution for random-walk turning angles in animal movement ecology, ocean current headings, and wind direction statistics.
- **PDF:** f(θ; μ, σ) = (1/(σ√(2π))) · Σₖ exp(−(θ−μ+2πk)²/(2σ²)), series truncated at ~5 terms for σ < π
- **CDF:** numerical integration (Romberg, already in `src/algorithms/`)
- **Sampling:** trivial — (Normal(μ, σ) mod 2π)
- **Dependency:** `neumaier.js` for accurate series summation
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Wrapped_normal_distribution)

#### Reciprocal Normal
Distribution of 1/X when X ~ Normal(μ, σ²). Proper only when the normal has negligible mass near zero (μ ≫ σ).
- **PDF:** f(y) = (1/y²) · φ((1/y − μ)/σ) / σ
- **Sampling:** draw X ~ Normal(μ, σ), return 1/X
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Inverse_distribution#Reciprocal_normal_distribution)

#### Non-Central η (Eta)
Distribution of the square root of a rescaled non-central chi-squared, arising in Bayesian power analysis. Related to `NonCentralChi` in `src/dist/`.
- Refs: [sadists R package](https://cran.r-project.org/package=sadists)

#### Parabolic Fractal
Bounded distribution with a parabolic probability density, appearing in fractal and self-similar models.
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Parabolic_fractal_distribution)

---

*Low-priority — specialist or narrow-domain distributions.*

#### K-prime
Distribution from Bayesian prediction under normal models; appears as the predictive distribution for a scaled normal ratio.
- Refs: [Lecoutre 1999 (PDF)](https://eris62.eu/telechargements/1999Lecoutre-TwousefuldistributionsforBayesianpredictiveproceduresundernormalmodels.pdf), [arXiv:1003.4890](https://arxiv.org/pdf/1003.4890v1.pdf)

#### K-square
Square of the K-prime distribution; related to noncentral chi-squared in the same way K-prime relates to noncentral-t.
- Refs: [arXiv:1003.4890](https://arxiv.org/pdf/1003.4890v1.pdf)

#### Lambda-prime
Bayesian analogue of the t-distribution from Lecoutre (1999); defined on the positive reals.
- Refs: [arXiv:1003.4890](https://arxiv.org/pdf/1003.4890v1.pdf), [Lecoutre 1999](https://eris62.eu/telechargements/1999Lecoutre-TwousefuldistributionsforBayesianpredictiveproceduresundernormalmodels.pdf)

#### Planck
Continuous distribution proportional to the Planck blackbody spectrum: f(x) ∝ x³/(exp(x)−1) on (0,∞).
- **CDF:** involves the Bose-Einstein integral / polylogarithm Li₄(e^(−x)) — no elementary closed form
- **Sampling:** rejection sampling or series expansion sampling
- **Note:** CDF inversion requires numerical root-finding; `quantile()` must use Brent's method
- Refs: Devroye, L. (1986) *Non-Uniform Random Variate Generation*, Chapter 10 (Planck/Bose-Einstein sampling); see also [Wikipedia — Planck's law](https://en.wikipedia.org/wiki/Planck%27s_law)

#### Landau
Continuous, asymmetric, heavy-tailed distribution describing energy loss of a charged particle traversing a thin absorber (Landau fluctuations). A special case of the Lévy stable family (α=1, β=1) and has no closed-form PDF.
- **PDF:** approximated by Fourier series inversion or fast approximations (Moyal approximation: f(x) ≈ (1/√(2π))·exp(−(x+e^(−x))/2))
- **CDF:** numerical integration only
- **Sampling:** inversion from tabulated quantiles or from the Moyal approximation
- Implementation note: the Moyal distribution (already in `src/dist/moyal.js`) is an analytically tractable approximation; exact Landau requires numerical Fourier inversion
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Landau_distribution)

#### Crystal Ball
Continuous distribution with a Gaussian core above a threshold and a power-law tail below; used in particle physics for signal modelling.
- **PDF:** Gaussian for (x−μ)/σ > −α; power law C·(n/|α|·(n/|α|−|α|−(x−μ)/σ))^(−n) below
- **CDF:** combination of erf and rational terms
- **Sampling:** rejection or inverse CDF
- Depends on accurate `error.js`
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Crystal_Ball_function)

#### ARGUS
One-parameter distribution on [0, *c*] from particle physics (ARGUS experiment at DESY).
- **PDF:** f(x; c, p) ∝ x · (1 − (x/c)²)^p, standard form p = ½
- **CDF:** involves regularized incomplete gamma
- **Sampling:** rejection sampling or inversion via root-finding
- **Dependency:** `gamma-incomplete.js` must be accurate near 0
- Refs: [scipy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.argus.html), [Wikipedia](https://en.wikipedia.org/wiki/ARGUS_distribution)

#### Maxwell-Jüttner
Relativistic analogue of the `MaxwellBoltzmann` distribution (already in the library); describes particle momenta in a relativistic ideal gas. Used in plasma physics and astrophysics.
- **PDF:** f(p; θ) = p² / (θ · K₂(1/θ)) · exp(−√(1+p²)/θ),  θ = kT/(mc²)
- **Sampling:** rejection sampling against a Maxwellian envelope
- **Dependency:** `bessel.js` (`besselKnu` — already implemented)
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Maxwell%E2%80%93J%C3%BCttner_distribution)

#### Power Benini
Two-shape-parameter extension of the existing `Benini` distribution used in actuarial income and loss severity fitting. The extra shape parameter covers cases where the standard Benini cannot fit the tail.
- **CDF:** F(x; α, β, σ) = 1 − exp(−α·log(x/σ) − β·log(x/σ)²)
- **Sampling:** inversion via quadratic formula in log(x/σ)
- Note: `Benini` is already in `src/dist/benini.js`; this is a direct generalisation
- Refs: Klugman, S.A., Panjer, H.H. & Willmot, G.E. (2012) *Loss Models*, 4th ed., Chapter 3

---

### Discrete

#### Waring
Generalization of the Yule-Simon distribution. Yule-Simon is the special case σ = 1.
- **PMF:** P(X = k) = B(k + σ, ρ) / B(σ, ρ − 1) for k = 0, 1, 2, ..., where ρ > 1, σ > 0
- **CDF:** at NIST reference
- Refs: [NIST Dataplot](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/bgepdf.htm)

#### Sibuya
Discrete power-law distribution with an O(1) exact sampler. Used in species abundance models, fragmentation theory, and as the innovation distribution in INAR(1) integer-valued time series.
- **PMF:** P(X = k; α) = (−1)^(k−1) · C(α, k) = α · Γ(k−α) / (Γ(1−α) · k!),  α ∈ (0, 1)
- **Sampling:** exact in O(1): k = ⌈U^(−1/α)⌉ where U ~ Uniform(0,1), with geometric thinning
- **Dependency:** `log-gamma.js` for PMF evaluation (already in `src/special/`)
- Refs: Sibuya, M. (1979) "Generalized hypergeometric, digamma and trigamma distributions", *Ann. Inst. Stat. Math.* 31(1):373–390

#### Panjer (a,b,0) Class
Unified actuarial recursion that subsumes Poisson, Binomial, and Negative Binomial via a single recurrence f(k) = (a + b/k)·f(k−1). Allows parameter sweeps across the entire class without selecting a named distribution; central to aggregate loss modelling in non-life insurance.
- **PMF:** defined by recursion coefficients (a, b) and initial mass f(0); Poisson: a=0, b=λ; Binomial: a=−p/(1−p), b=(n+1)p/(1−p); NegBinom: a=p, b=(r−1)p
- **Sampling:** via PreComputed PMF table
- **Dependency:** `PreComputed` base class (already present)
- Refs: Panjer, H.H. (1981) "Recursive evaluation of a family of compound distributions", *ASTIN Bulletin* 12(1):22–26

#### Extended Negative Binomial
More general form of the Negative Binomial; PMF includes a zero-truncation or zero-inflation correction.
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Extended_negative_binomial_distribution)

#### Inverse Hypergeometric
Discrete distribution modelling the number of draws needed to obtain exactly *r* successes in sampling without replacement from a finite population of size *N* containing *K* successes. Analogous to the negative hypergeometric.
- Refs: [Vose Software](https://www.vosesoftware.com/riskwiki/InverseHypergeometricdistribution.php)

#### Inverse Distributions (General)
Concept of forming 1/X for a random variable X with a known distribution. Several already exist (`InverseGamma`, `InverseChi2`, `InverseGaussian`). Remaining candidates:
- Inverse Beta
- Inverse Weibull (already as `inverted-weibull.js`)
- Inverse Pareto
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Inverse_distribution)

#### Luria-Delbrück
Discrete distribution for the number of mutant cells in a fluctuation assay (Luria-Delbrück experiment). PMF has no simple closed form; computed via recursive convolution or characteristic function inversion.
- **Sampling:** simulation of the branching process (computationally expensive for large populations)
- Refs: [arXiv:1203.3422](https://arxiv.org/pdf/1203.3422.pdf)

---

*Low-priority — specialist or narrow-domain distributions.*

#### Dirichlet-Multinomial (Pólya Distribution)
Marginal distribution of a Multinomial(n, p) when p is drawn from Dirichlet(α). The univariate marginal for a single component is the Beta-Binomial (already implemented); this is the multivariate generalisation. Central to topic modelling (LDA) and Bayesian A/B tests with more than two buckets.
- **PMF:** f(k; n, α) = C(n; k) · B(k+α) / B(α) where B is the multivariate beta function
- **Prerequisite:** The `Distribution` base class (`_pdf(x)`, `_cdf(x)`, `_generator()`) is scalar-valued. A **multivariate distribution base class** must be designed and filed as a separate architectural issue before this or any other vector-valued distribution (Dirichlet, Multivariate Normal, Wishart) can be added.
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Dirichlet-multinomial_distribution)

---

### Reference Lists

- [sadists R package (PDF)](https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf) — distributions for Bayesian predictive procedures
- [chaopy distribution collection](https://chaospy.readthedocs.io/en/development/distributions/collection.html)
- [scipy continuous distributions](https://docs.scipy.org/doc/scipy-0.13.0/reference/tutorial/stats/continuous.html)
- [Devroye — Non-Uniform Random Variate Generation, Chapter 10](http://www.nrbook.com/devroye/Devroye_files/chapter_ten.pdf) — sampling algorithms
- [Lecoutre 1999](https://eris62.eu/telechargements/1999Lecoutre-TwousefuldistributionsforBayesianpredictiveproceduresundernormalmodels.pdf) — K-prime, K-square, lambda-prime
- **v2 design note:** consider adopting the standard-form + location/scale parameterisation from [NIST handbook](https://www.itl.nist.gov/div898/handbook/eda/section3/eda364.htm#FORMULAS) for uniformity

---

## Statistical Tests

Currently in `src/test/`: `bartlett`, `levene`, `brown-forsythe`, `mann-whitney`, `hsic`, `welch`.

### Normality Tests (category)
Several tests specifically target whether a sample comes from a normal distribution. Implement as a group since they share the framework of testing against a theoretical normal:

#### Shapiro-Wilk
Most powerful standard normality test for small samples (n ≤ ~50). Uses regression of order statistics on their expected values under normality.
- **Statistic:** W = (Σ aᵢ x_(i))² / Σ(xᵢ − x̄)² where aᵢ are precomputed coefficients
- **Dependency:** requires precomputed coefficient table (Royston 1992 approximation covers n up to ~5000)
- Complexity: moderate (table look-up dominates)

### ANOVA (Analysis of Variance)
One-way F-test for equality of means across k ≥ 2 independent groups. Assumes normality and homoscedasticity (use Welch's or Kruskal-Wallis as alternatives).
- **Statistic:** F = (SSB / (k−1)) / (SSW / (N−k))  where SSB = between-group SS, SSW = within-group SS
- **Dependency:** F distribution (already in `src/dist/f.js`)

### Analysis of Similarities (ANOSIM)
Non-parametric test for differences between groups based on a pairwise dissimilarity matrix. Analogous to MANOVA but distribution-free.
- **Statistic:** R = (r̄_B − r̄_W) / (N(N−1)/4)  where r̄_B and r̄_W are mean ranks of between- and within-group dissimilarities
- R ∈ [−1, 1]; R ≈ 1 implies groups are well separated
- Significance via permutation testing

### Breusch-Pagan
Test for heteroscedasticity in a linear regression. Regresses squared residuals on the predictors; a large R² indicates variance is not constant.
- **Statistic:** LM = n · R²_{auxiliary} ~ χ²(k) under H₀
- **Dependency:** Chi2 distribution (already in `src/dist/chi2.js`)

### Wilcoxon Signed-Rank Test
Non-parametric test for the median of a single sample (or paired differences). Alternative to one-sample t-test.
- **Statistic:** W = Σ sgn(xᵢ − μ₀) · Rᵢ  where Rᵢ = rank of |xᵢ − μ₀|
- Normal approximation for n > 25; exact distribution via recursion for small n

### Wald Test
General-purpose test of parametric hypotheses H₀: Rθ = r. Asymptotically chi-squared.
- **Statistic:** W = (Rθ̂ − r)ᵀ [R · Var(θ̂) · Rᵀ]⁻¹ (Rθ̂ − r) ~ χ²(rank(R))
- Requires user to supply the estimate θ̂ and its covariance matrix; a general framework rather than a specific test

### Reference
- [scipy.stats test listing](https://docs.scipy.org/doc/scipy/reference/stats.html)

---

## Time Series (`src/ts/`)

Currently only `online-covariance.js` is implemented.

### General Aggregator Class
An online (streaming) aggregator that maintains running statistics in O(1) time and O(1) space per update. Should expose at minimum:
- `count`, `mean`, `variance`, `std`, `min`, `max`, `sum`
- Welford's algorithm for numerically stable running variance
- Optional: quantile tracking via P² or t-digest

---

## Stochastic Processes (`src/process/`)

The module now exists with a `Process` base class (`_process.js`) plus `BrownianMotion`, `OrnsteinUhlenbeck`, `BrownianBridge`, `GeometricBrownianMotion`, `CoxIngersollRoss`, `AR1`, `RandomWalk`, and `Poisson`/`CompoundPoisson` (formerly `PoissonProcess`/`CompoundPoissonProcess`, deprecated per ADR-0041). The base class currently exposes `next()` and `mean(t)`; `trend()`, `noise()`, and `correlation(lag)` from the original design note are not implemented on the base class yet.

### Gaussian Process
A distribution over functions; fully specified by a mean function m(t) and a covariance (kernel) function k(t, t′).
- **Simulation:** Cholesky decomposition of the N×N covariance matrix, then multiply by a standard normal vector
- Common kernels: squared-exponential (RBF), Matérn, periodic
- **Dependency:** `src/la/matrix.js` (Cholesky)
- Note: O(N³) simulation cost; for large N, sparse or approximation methods needed

### Galton-Watson Branching Process
Discrete-time process: Xₙ₊₁ = Σᵢ₌₁^Xₙ Zᵢ where Zᵢ are iid offspring counts drawn from an offspring distribution.
- **Parameters:** offspring distribution (any distribution in `src/dist/` works; Poisson and Geometric are standard)
- **Key quantities:** extinction probability, expected population size, variance
- **Simulation:** straightforward per-generation loop

---

## MCMC (`src/mc/`)

Fully implemented: `RWM`, `AdaptiveMetropolis`, `Slice`, `HMC`, `NUTS`, `MALA`, `Gibbs`, `ARS`, `ParallelTempering`, `runChains`, `gelmanRubin`, plus shared Euclidean metric adaptation (diagonal/dense) for HMC/NUTS. No open items remain from the original backlog for this module.

---

## Special Functions (`src/special/`)

Currently implemented: `gamma`, `log-gamma`, `beta`, `log-beta`, `beta-incomplete`, `gamma-incomplete`, `error` (erf/erfc), `digamma`, `bessel` (including `besselK`/`besselKnu`), `hypergeometric`, `lambert-w`, `marcum-q`, `owen-t`, `hurwitz-zeta`, `riemann-zeta`, `generalized-harmonic`, `stirling`, `log-binomial`, `e1` (exponential integral), `polylogarithm`.

Functions still needed for the distributions above or otherwise missing:

| Function | Needed by | Notes |
|----------|-----------|-------|
| Elliptic integrals K(k), E(k) | Some special distributions | Carlson symmetric forms most numerically stable |
| `log1p(x)`, `expm1(x)` | Catastrophic cancellation (#214) | `Math.log1p`/`Math.expm1` are used in several places (e.g. `error.js`), but manual `Math.log(1 + …)`/`Math.exp(…) - 1` patterns remain in `gamma-gompertz.js`, `delaporte.js`, `logistic-exponential.js`, `geometric-brownian-motion.js` — audit and replace where precision-sensitive |

- Full reference: [Boost.Math special functions](https://www.boost.org/doc/libs/1_77_0/libs/math/doc/html/special.html)
