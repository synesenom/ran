import * as ran from 'ranjs'

// Distribution instantiation
const n = new ran.dist.Normal(0, 1)
const _p = new ran.dist.Pareto(1, 2)
const _cat = new ran.dist.Categorical([1, 2, 3])
const _cat2 = new ran.dist.Categorical([1, 2, 3], 0)
const _hyp = new ran.dist.Hyperexponential([{ weight: 1, rate: 2 }])

// Base class methods
const s1: number = n.sample()
const s2: number | number[] = n.sample(5)
const _s3: number = n.sample(1)
const _pdf: number = n.pdf(0)
const _cdf: number = n.cdf(0)
const _q: number | undefined = n.q(0.5)
const _surv: number = n.survival(0)
const _haz: number = n.hazard(0)
const _ch: number = n.cHazard(0)
const _lp: number = n.lnPdf(0)
const _ll: number = n.lnL([1, 2, 3])
const _aic: number = n.aic([1, 2, 3])
const _bic: number = n.bic([1, 2, 3])
const t = n.test([1, 2, 3])
const _tstat: number = t.statistics
const _tpass: boolean = t.passed
const _tp: 'continuous' | 'discrete' = n.type()
const sp = n.support()
const _sv: number = sp[0].value
const _sc: boolean = sp[0].closed
const state = n.save()
n.load(state)
n.seed(42)
n.seed('test')

// core namespace — all overloads
ran.core.seed(42)
const f1: number = ran.core.float()
const f2: number = ran.core.float(2)
const _f3: number = ran.core.float(0, 1)
const _f4: number | number[] = ran.core.float(0, 1, 5)
const _i1: number = ran.core.int(10)
const _i2: number = ran.core.int(1, 10)
const _i3: number | number[] = ran.core.int(1, 10, 5)
const _choice1 = ran.core.choice([1, 2, 3])
const _choice2 = ran.core.choice([1, 2, 3], 2)
const _ch2 = ran.core.char('abc')
const _ch3 = ran.core.char('abc', 3)
const _shuffled = ran.core.shuffle([1, 2, 3])
const _coinSingle: string = ran.core.coin('H', 'T')
const _coinP: string = ran.core.coin('H', 'T', 0.5)
const _coin: string | Array<string> = ran.core.coin('H', 'T', 0.5, 3)

// Statistical namespaces — location
const _mean: number | undefined = ran.location.mean([1, 2, 3])
const _gm: number | undefined = ran.location.geometricMean([1, 2, 3])
const _hm: number | undefined = ran.location.harmonicMean([1, 2, 3])
const _med: number | undefined = ran.location.median([1, 2, 3])

// Statistical namespaces — dispersion
const _var: number | undefined = ran.dispersion.variance([1, 2, 3])
const _sd: number | undefined = ran.dispersion.stdev([1, 2, 3])
const _iqr: number | undefined = ran.dispersion.iqr([1, 2, 3])

// Statistical namespaces — shape
const _skew: number | undefined = ran.shape.skewness([1, 2, 3])
const _kurt: number | undefined = ran.shape.kurtosis([1, 2, 3])
const _q50: number | undefined = ran.shape.quantile([1, 2, 3], 0.5)

// Statistical namespaces — dependence
const _pear: number | undefined = ran.dependence.pearson([1, 2], [3, 4])
const _spear: number | undefined = ran.dependence.spearman([1, 2], [3, 4])
const _kend: number | undefined = ran.dependence.kendall([1, 2], [3, 4])
const _cov: number | undefined = ran.dependence.covariance([1, 2], [3, 4])

// test namespace — all 5 functions
const _bart = ran.test.bartlett([[1, 2, 3], [4, 5, 6]])
const _bstat: number = _bart.stat
const _bpass: boolean = _bart.passed
const _bf = ran.test.brownForsythe([[1, 2, 3], [4, 5, 6]])
const _lev = ran.test.levene([[1, 2, 3], [4, 5, 6]])
const _mw = ran.test.mannWhitney([[1, 2, 3], [4, 5, 6]])
const _hsic = ran.test.hsic([[1, 2, 3], [4, 5, 6]])

// Suppress unused variable warnings
void s1; void s2; void _s3; void f1; void f2; void _p; void _cat; void _cat2; void _hyp
void _pdf; void _cdf; void _q; void _surv; void _haz; void _ch
void _lp; void _ll; void _aic; void _bic; void _tstat; void _tpass
void _tp; void sp; void _sv; void _sc; void state; void _f3; void _f4; void _i1; void _i2; void _i3
void _choice1; void _choice2; void _ch2; void _ch3; void _shuffled; void _coinSingle; void _coinP; void _coin; void _mean
void _gm; void _hm; void _med; void _var; void _sd; void _iqr
void _skew; void _kurt; void _q50; void _pear; void _spear; void _kend; void _cov
void _bstat; void _bpass; void _bf; void _lev; void _mw; void _hsic
