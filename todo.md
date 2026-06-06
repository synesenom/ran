# ranjs — Development Backlog

> Structured from the raw `todo` file. Items marked **[done]** are already implemented in `src/dist/`.
> Issues already filed on GitHub are linked where known.

---

## Most Important

### Improve special function precision

The functions in `src/special/` are the numerical foundation for almost every distribution CDF, quantile, and likelihood. Known gaps:

- **`error.js` (erf/erfc)** — currently uses a series expansion that loses accuracy in the tail (|x| ≫ 1). Continued-fraction representations converge much faster in the tail and give near-machine-precision accuracy. See issue #211. This directly affects `Normal`, `LogNormal`, `Erfc`-based CDFs.
- **`gamma-incomplete.js`** — the regularized lower/upper incomplete gamma (P and Q) is used by Chi2, Gamma, Poisson CDF, and many others. Accuracy near `x=a` (where P≈Q≈0.5) and for large `a` is most critical; should be cross-validated against scipy/Boost.
- **`beta-incomplete.js`** — regularized incomplete beta `I_x(a,b)` underlies Beta, Binomial CDF, F, t. Known to lose digits when `x` is very close to 0 or 1 and `a,b` differ by orders of magnitude.
- **`bessel.js`** — large-order and large-argument Bessel functions (used by Rice, Noncentral distributions) rely on asymptotic expansions whose accuracy degrades near the transition region.
- **`digamma.js`** — used in Dirichlet-related computations; polygamma (derivatives beyond ψ₀) is not yet implemented.

**Goal:** every special function should be accurate to within a few ULP for all representable inputs, as documented in accuracy tables (see publication-grade section below).

---

## Publication-Grade Gaps

Moving the library from *auditable* to *publication-grade* requires systematic reference-value coverage and documented accuracy bounds.

### Filed as GitHub Issues

| # | Description |
|---|-------------|
| [#211](../../issues/211) | **erf/erfc precision** — replace the series expansion with a continued-fraction algorithm for |x| > ~3 to recover tail accuracy. |
| [#212](../../issues/212) | **Property tests** — automated checks that PDF ≥ 0, CDF is non-decreasing, and `quantile(cdf(x)) ≈ x` for all implemented distributions. |
| [#213](../../issues/213) | **quantile() reference values** — cross-validate `quantile()` against scipy's `ppf()` for the 12 core continuous distributions, at p = 0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999. |
| [#214](../../issues/214) | **Catastrophic cancellation audit** — find and fix `1 - exp(...)` and `1 - cdf(...)` patterns near boundaries that lose significant digits; replace with `expm1`/`log1p` equivalents or stable complementary forms. |

### Not Yet Filed

- **Far-tail reference values for Normal/LogNormal** — add refVals at ±5σ and ±7σ to expose and track erf accuracy. Without these, regressions in tail precision are invisible.
- **Full-domain special function validation** — cross-validate `gammaLowerIncomplete`, `betaIncomplete`, `bessel`, `digamma`, and others against scipy or Boost across their entire representable input domains, not just spot-check values.
- **Systematic parameter-space coverage** — for each distribution, construct a grid of parameter values (not just two hand-picked sets) to catch edge-case failure modes near parameter boundaries.
- **Documented accuracy bounds** — for each special function and distribution CDF, state clearly: "accurate to X ULP for |x| ≤ Y" so users can reason about numerical error in downstream computations.

---

## Distributions

> Entries marked **[duplicate]** are already covered by an existing distribution under a different name.
> Entries marked **[partial]** exist in `src/dist/` but have open TODOs or incorrect/missing implementations.
> Within each subsection, entries are ordered from most broadly useful to most specialised.

### Continuous

#### Truncated Exponential
Exponential distribution restricted to the interval [a, b], 0 ≤ a < b ≤ ∞. Among the simplest missing distributions; follows the same pattern as the existing `TruncatedNormal`.
- **PDF:** f(x; λ, a, b) = λ·e^(−λx) / (e^(−λa) − e^(−λb))
- **CDF:** (e^(−λa) − e^(−λx)) / (e^(−λa) − e^(−λb))
- **Sampling:** inversion: x = −log(e^(−λa) − U·(e^(−λa)−e^(−λb))) / λ
- Refs: [scipy `truncexpon`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.truncexpon.html)

#### Exponentially Modified Gaussian (EMG)
Convolution of a Normal(μ, σ²) and an Exponential(λ) distribution; common in chromatography, neuroscience, and reaction-time modelling.
- **PDF:** f(x; μ, σ, λ) = (λ/2) · exp(λ/2·(2μ + λσ² − 2x)) · erfc((μ + λσ² − x)/(σ√2))
- **CDF:** combination of Φ and erfc terms
- **Sampling:** trivially, sum an independent Normal(μ, σ) and Exponential(λ) variate
- Requires accurate `error.js` (erfc in tail)
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Exponentially_modified_Gaussian_distribution)

#### Asymmetric Laplace
Two-sided exponential with an asymmetry parameter κ > 0. Reduces to symmetric Laplace when κ = 1. The likelihood kernel for Bayesian quantile regression and the prior implied by LASSO.
- **PDF:** f(x; μ, σ, κ) = (√2/σ) · κ/(1+κ²) · exp(−√2·κ^(∓1)/σ · |x−μ|), sign depending on which side of μ
- **CDF:** closed form involving exp
- **Sampling:** inversion via closed-form quantile function
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Asymmetric_Laplace_distribution); Kozubowski & Podgórski (2001) *Statistical Inference for Stochastic Processes* 4:73–104

#### Tweedie (Compound Poisson-Gamma)
Family parameterised by a power index p ∈ (1, 2): for fixed p the distribution is compound Poisson with Gamma-distributed cluster masses. Used in insurance loss models (exact-zero outcomes with a continuous positive tail), rainfall accumulation, and any GLM with a non-negative response. Special cases: p = 1 is Poisson, p = 2 is Gamma.
- **PMF/PDF:** no closed form; computed via a rapidly converging series over the compound Poisson terms
- **Sampling:** exact via compound structure — draw N ~ Poisson(λ), then sum N independent Gamma(α, β) variates
- **Dependency:** `_poisson.js`, `_gamma.js` (both already in `src/dist/`); `neumaier.js` for the series PDF
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Tweedie_distribution); Jørgensen (1987) *JRSS-B* 49(2):127–162

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
- **Dependency:** `bessel.js` (K_{λ−½}), `_gamma.js` — **`besselK` is currently absent from `src/special/`; must be added first**
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Variance-gamma_distribution)

#### Normal-Inverse Gaussian (NIG)
Special case of the Generalized Hyperbolic distribution with λ = −½. Popular in financial return modelling and engineering.
- **PDF:** f(x; μ, α, β, δ) = (αδ/π) · K₁(α√(δ²+(x−μ)²)) / √(δ²+(x−μ)²) · exp(δγ + β(x−μ))  where γ = √(α²−β²)
- **Sampling:** via the representation X | V ~ Normal(μ + βV, V), V ~ InverseGaussian(δ/γ, δ²)
- **Dependency:** `bessel.js` (K₁), `inverse-gaussian.js` — **`besselK` is currently absent from `src/special/`; must be added first**
- Refs: [scipy `norminvgauss`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norminvgauss.html)

#### Generalized Hyperbolic
A five-parameter family (λ, α, β, μ, δ) that unifies several heavy-tailed distributions used in finance and physics. Special cases include:
- **Normal-Inverse Gaussian (NIG):** λ = −½
- **Variance-Gamma:** δ = 0
- **Hyperbolic:** λ = 1
- **Student-t:** α = 0 (limit)
- **PDF:** involves modified Bessel function K_λ(·) — needs accurate `bessel.js`
- **Sampling:** via the GIG (Generalized Inverse Gaussian) mixing representation
- **Prerequisite:** `besselK` (second-kind modified Bessel, all real orders) is currently absent from `src/special/bessel.js` — must be added before this distribution can be implemented
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
- **Dependency:** `bessel.js` (K₀) — **`besselK` is currently absent from `src/special/`; must be added first**
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

#### Wrapped Cauchy
Heavy-tailed circular distribution on [−π, π); the stereographic projection of a Cauchy distribution onto the circle. Used in wind direction modelling, paleomagnetism, and neuroscience (head direction cells). The only other circular distribution in the library is `VonMises`.
- **PDF:** f(θ; μ, ρ) = (1/(2π)) · (1−ρ²) / (1 + ρ² − 2ρ·cos(θ−μ)),  ρ ∈ (0,1)
- **CDF:** closed form via arctan
- **Sampling:** exact inversion via closed-form quantile
- No special functions required
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Wrapped_Cauchy_distribution)

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
- **Prerequisite:** `besselK` (K₂ via recurrence K₂(z) = (2/z)·K₁(z) + K₀(z)) — must be added to `src/special/` first
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Maxwell%E2%80%93J%C3%BCttner_distribution)

#### Power Benini
Two-shape-parameter extension of the existing `Benini` distribution used in actuarial income and loss severity fitting. The extra shape parameter covers cases where the standard Benini cannot fit the tail.
- **CDF:** F(x; α, β, σ) = 1 − exp(−α·log(x/σ) − β·log(x/σ)²)
- **Sampling:** inversion via quadratic formula in log(x/σ)
- Note: `Benini` is already in `src/dist/benini.js`; this is a direct generalisation
- Refs: Klugman, S.A., Panjer, H.H. & Willmot, G.E. (2012) *Loss Models*, 4th ed., Chapter 3

---

#### Double Exponential
**[duplicate]** — equivalent to the Laplace distribution; already implemented in `src/dist/laplace.js`.

#### Error / Exponential Power
**[duplicate]** — equivalent to the Generalized Normal (Subbotin) distribution; already implemented in `src/dist/generalized-normal.js`.

#### Davis
**[partial]** — `src/dist/davis.js` — PDF is correct but two blockers remain:
- `_generator()` returns a hardcoded `1` — needs actual implementation (rejection sampling with a bounding envelope over the power-law decay)
- `_cdf()` has a stray `console.log` and uses Romberg integration; numerical CDF is acceptable (no closed form exists) but the debug statement must be removed before the distribution is usable
- **refVals needed:** two parameter sets in `test/dist-cases-continuous.js` with PDF/CDF/quantile values cross-checked against scipy `davis` or manual integration
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/Davis_distribution)

#### Champernowne
**[partial]** — `src/dist/champernowne.js` — Substantially incomplete:
- `_generator()` body is empty — no sampler at all
- `_pdf` is missing the normalization constant (`// TODO Add normalization factor`); the correct constant is C = α√(1−λ²)/π, derived from ∫ dx/(cosh(αx)+λ) = π/(α√(1−λ²))
- `_cdf()` is wrong — returns the hardcoded constant `this.c[0] = 1` instead of F(x) = ½ + (√(1−λ²)/π)·arctan(sinh(α(x−x₀))/√(1−λ²))
- **refVals needed:** two parameter sets in `test/dist-cases-continuous.js` with PDF/CDF/quantile values cross-checked against [Wikipedia](https://en.wikipedia.org/wiki/Champernowne_distribution) or numerical integration

---

### Discrete

#### Discrete Laplace (Bilateral Geometric)
Discrete analogue of the Laplace distribution; symmetric about an integer location parameter.
- **PMF:** P(X = k) = ((1−p)/(1+p)) · p^|k−μ| for k ∈ ℤ, p ∈ (0,1)
- **Sampling:** difference of two independent Geometric variates
- Refs: [scipy `dlaplace`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.dlaplace.html)

#### Waring
Generalization of the Yule-Simon distribution (already `[partial]` below). Yule-Simon is the special case σ = 1.
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

#### Beta-Geometric
**[partial]** — `src/dist/beta-geometric.js` — PMF and generator are present but carry a `// TODO Use log PDF` note. The current `_pk` computes `Math.exp(logBeta(…) − logBeta(…))` directly; for large k the difference of log-betas should be returned as-is (log-PMF) to avoid underflow, and the PreComputed base class updated to consume log probabilities.
- **refVals needed:** two parameter sets in `test/dist-cases-discrete.js` with PMF/CDF values cross-checked against [NIST](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/bgepdf.htm)

#### Beta-Negative Binomial
**[partial]** — `src/dist/beta-negative-binomial.js` — Three open issues:
1. Speed-up constants not computed (`// TODO Speed-up constants`)
2. The recurrence-based `_pk` has two commented-out alternative formulas alongside the active one, indicating the PMF is not yet finalised
3. The generator comment says `// TODO Direct sampling`; the current implementation compounds Beta → Gamma → Poisson which is correct but has higher variance than a direct method
- **refVals needed:** two parameter sets in `test/dist-cases-discrete.js` with PMF/CDF values cross-checked against [Wikipedia](https://en.wikipedia.org/wiki/Beta_negative_binomial_distribution) or [NIST](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/bnbcdf.htm)

#### Yule-Simon
**[partial]** — `src/dist/yule-simon.js` — PMF and CDF formulas are correct. The generator uses an exponential-geometric compound representation which is mathematically sound, but the edge-case branch (`1 − z === 1 → Math.ceil(e1 / z)`) can produce `Infinity` when z underflows to exactly 0, since e1/0 = Infinity. That branch needs a large-sample approximation (e.g. return a Pareto-distributed integer) rather than the direct ratio.
- **refVals needed:** two parameter sets in `test/dist-cases-discrete.js` with PMF/CDF values cross-checked against [Wikipedia](https://en.wikipedia.org/wiki/Yule%E2%80%93Simon_distribution)

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

Currently in `src/test/`: `bartlett`, `levene`, `brown-forsythe`, `mann-whitney`, `hsic`.

### Normality Tests (category)
Several tests specifically target whether a sample comes from a normal distribution. Implement as a group since they share the framework of testing against a theoretical normal:

#### Shapiro-Wilk
Most powerful standard normality test for small samples (n ≤ ~50). Uses regression of order statistics on their expected values under normality.
- **Statistic:** W = (Σ aᵢ x_(i))² / Σ(xᵢ − x̄)² where aᵢ are precomputed coefficients
- **Dependency:** requires precomputed coefficient table (Royston 1992 approximation covers n up to ~5000)
- Complexity: moderate (table look-up dominates)

#### Anderson-Darling
EDF-based goodness-of-fit test; more sensitive than Kolmogorov-Smirnov in the tails. Can test against any continuous distribution, not just normality.
- **Statistic:** A² = −N − (1/N) Σ(2i−1)[ln z_(i) + ln(1 − z_(N+1−i))]  where z_(i) = F(x_(i))
- Critical values depend on the hypothesised distribution; for normality, Stephens (1974) tables
- Already partially covered by `ksTest` in `test/test-utils.js`; Anderson-Darling is stronger

#### Cramér-von Mises
EDF-based test, less sensitive at tails than Anderson-Darling but has a simpler asymptotic distribution.
- **Statistic:** W² = Σ(z_(i) − (2i−1)/(2N))² + 1/(12N)
- Asymptotic distribution is tabulated; exact distribution computable via eigenvalue method

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

### Welch's t-test
Two-sample t-test for equality of means when variances are unequal (does not assume homoscedasticity). Preferred over Student's t-test in practice.
- **Degrees of freedom:** Welch-Satterthwaite approximation: ν = (s₁²/n₁ + s₂²/n₂)² / ((s₁²/n₁)²/(n₁−1) + (s₂²/n₂)²/(n₂−1))
- **Dependency:** Student-t distribution (already in `src/dist/student-t.js`)

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

## Stochastic Processes (`src/process/` — not yet started)

A new module for discrete-time and continuous-time stochastic processes. Each process object should implement a standard interface:

| Method | Description |
|--------|-------------|
| `next()` | Advance one step; return the new state |
| `trend()` | Extract the deterministic drift component |
| `noise()` | Extract the stochastic (noise) component |
| `mean(power)` | Compute the p-th power mean of the trajectory |
| `correlation(lag)` | Autocovariance / autocorrelation at given lag |

### Brownian Motion / Standard Wiener Process
The foundational continuous-time process: W(t) − W(s) ~ Normal(0, t − s) for s < t, independent increments.
- **Discrete simulation:** Wₙ = Wₙ₋₁ + √(Δt) · Z,  Z ~ Normal(0,1)
- Serves as the building block for all Itô diffusions below

### Ornstein-Uhlenbeck (OU) Process
Mean-reverting diffusion: dX = θ(μ − X)dt + σ dW.
- **Exact discrete update:** Xₙ₊₁ = Xₙ · e^(−θΔt) + μ(1 − e^(−θΔt)) + σ√((1−e^(−2θΔt))/(2θ)) · Z
- Used in finance (Vasicek interest rate model), physics (Langevin equation)
- **Dependency:** none beyond core PRNG

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

Currently implemented: `RWM` (random walk Metropolis), `SliceSampler`, `MCMC2`, `GelmanRubin`.

### Gibbs Sampling
Component-wise sampler: at each step, draw each coordinate xᵢ from its full conditional p(xᵢ | x₋ᵢ). Mixes well in low dimensions when conditionals are tractable.
- **Interface:** user supplies an array of conditional samplers `[p(x₁|…), p(x₂|…), …]`
- No acceptance step; always accepted
- Can be combined with Metropolis steps for intractable conditionals (Metropolis-within-Gibbs)

### Adaptive Metropolis (AM)
Standard RWM with a covariance-adapting proposal: Σ_proposal = (2.38²/d) · Cov(x₁,…,xₙ) + ε·I (Haario-Saksman-Tamminen 2001).
- **Adaptation:** update the empirical covariance during burn-in; freeze after
- **Dependency:** `src/la/matrix.js` (Cholesky for sampling from multivariate normal)
- Note: Ergodicity requires careful scheduling of adaptation; stop adapting after a fixed number of steps

### Hamiltonian Monte Carlo (HMC)
Uses gradient information to propose distant moves along Hamiltonian trajectories, dramatically reducing random-walk behaviour.
- **Algorithm:** leapfrog integrator for L steps of size ε, Metropolis accept/reject
- **User supplies:** log-posterior and its gradient (∂log p(θ)/∂θ)
- **Tuning:** step size ε and path length L are critical; NUTS automates this
- Ref: Neal (2011) "MCMC using Hamiltonian dynamics" in *Handbook of Markov Chain Monte Carlo*

### NUTS (No-U-Turn Sampler)
Extension of HMC that automatically tunes the trajectory length by building a binary tree until a U-turn criterion is met, eliminating the need to set L manually.
- **Algorithm:** recursive doubling of leapfrog steps; slice sampling selects the transition
- **Dual averaging:** adapts step size ε during warm-up (Hoffman-Gelman 2014)
- **Dependency:** HMC leapfrog integrator (implement HMC first)
- This is the sampler used by Stan, PyMC, and NumPyro

### Rejection Sampling for Log-Concave Distributions
Adaptive Rejection Sampling (ARS, Gilks-Wild 1992): for log-concave densities, automatically constructs a piecewise-exponential envelope from evaluation points and tightens it adaptively.
- Avoids the need for the user to specify a bounding constant
- **Dependency:** log-concavity check or trust; works best for unimodal, differentiable log-densities

### Euclidean Metric Adaptation
In HMC/NUTS, preconditioning by an estimated mass matrix M (the inverse of the parameter covariance) improves mixing by removing scale differences between dimensions.
- **Warm-up phase:** accumulate sample covariance; set M = Cov(θ)⁻¹
- **Dependency:** `src/la/matrix.js` (inversion or Cholesky)

### Step Size Jittering
Randomly perturb the leapfrog step size ε each iteration (e.g. ε ~ Uniform(0.9ε₀, 1.1ε₀)) to break periodicity artifacts in HMC trajectories.

### Inspiration
- [Interactive MCMC visualisations](https://github.com/chi-feng/mcmc-demo)

---

## Special Functions (`src/special/`)

Currently implemented: `gamma`, `log-gamma`, `beta`, `log-beta`, `beta-incomplete`, `gamma-incomplete`, `error` (erf/erfc), `digamma`, `bessel`, `hypergeometric`, `lambert-w`, `marcum-q`, `owen-t`, `hurwitz-zeta`, `riemann-zeta`, `generalized-harmonic`, `stirling`, `log-binomial`.

Functions needed for the distributions above or otherwise missing:

| Function | Needed by | Notes |
|----------|-----------|-------|
| **`besselK` — K_ν(x), all real ν** | NIG, Variance-Gamma, Normal Product, Generalized Hyperbolic, Maxwell-Jüttner | **Entirely absent.** `src/special/bessel.js` exports only first-kind functions (I_ν). K_ν must be added as a standalone prerequisite issue before any of the listed distributions can be implemented. Recurrence: K_{n+1}(x) = (2n/x)·K_n(x) + K_{n−1}(x); seed from K_0 and K_1 series. |
| Polygamma ψₙ(x), n ≥ 1 | Various | Trigamma (n=1) most urgent; can derive from digamma recurrence + Euler-Maclaurin |
| Exponential integral Eₙ(x), Ei(x) | Planck CDF | Related to incomplete gamma; Ei(x) = −E₁(−x) for x > 0 |
| Polylogarithm Liₛ(z) | Planck CDF, Fermi-Dirac | Li₂ (dilogarithm) has known series; general Liₛ needs Lerch transcendent |
| Elliptic integrals K(k), E(k) | Some special distributions | Carlson symmetric forms most numerically stable |
| `log1p(x)`, `expm1(x)` | Catastrophic cancellation (#214) | Use `Math.log1p` / `Math.expm1` (native in JS); ensure they are used consistently |

- Full reference: [Boost.Math special functions](https://www.boost.org/doc/libs/1_77_0/libs/math/doc/html/special.html)
