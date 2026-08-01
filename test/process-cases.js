import AR1 from '../src/process/ar1'
import BrownianBridge from '../src/process/brownian-bridge'
import BrownianMotion from '../src/process/brownian-motion'
import CompoundPoisson from '../src/process/compound-poisson'
import CoxIngersollRoss from '../src/process/cox-ingersoll-ross'
import GeometricBrownianMotion from '../src/process/geometric-brownian-motion'
import OrnsteinUhlenbeck from '../src/process/ornstein-uhlenbeck'
import ProcessPoisson from '../src/process/poisson'
import RandomWalk from '../src/process/random-walk'
import { Normal } from '../src/dist'

// Externally-sourced reference values for the analytical methods of ran.process (issue #1221).
//
// WHY THERE IS NO SHARED RUNNER MODULE HERE: test/dist-runner.js exists because four shard files
// (dist-shard-0.js .. dist-shard-3.js) each consume it to spread 145+ distributions across
// mocha --parallel workers. There is one process test file, no sharding need at 9 processes, and
// so a registerProcessRefTests() module would be an abstraction boundary with exactly one caller.
// Every other structured case file in test/ — precision-continuous.js, precision-discrete.js,
// precision-special.js, precision-summary-stats.js — instead pairs a plain array with an inline
// forEach consumer, and that is the precedent followed here. The data lives in its own file only
// because test/process.js is already ~3400 lines of behavioural tests; the precision-*.js files can
// embed their arrays because the array IS their whole purpose. Reconsider a runner only if a second
// consumer (e.g. process shard files, or a process precision gate) ever actually appears.
//
// Entry shape:
//   should      prose completing "should ..." — the mocha test title, carried over verbatim from
//               the hand-written block this entry replaced, so a failure still names the
//               mathematical property that broke rather than a stringified call
//   params      thunk returning the constructor arguments (thunked, as in dist-cases-*.js, so no
//               instance — in particular no jump distribution and its PRNG — is built at import)
//   method      instance method to call
//   args        arguments to that method
//   chain       optional: method to call on `method`'s return value (only marginal(t).pdf(x))
//   chainArgs   optional: arguments to `chain`
//   expected    the reference value
//   tol         absolute tolerance for assert.closeTo
//   source      provenance, naming the external tool (mpmath at mp.dps=50 / scipy / R) or the exact
//               rational identity. Passed as assert.closeTo's message so provenance is visible in
//               the failure output, not only to a reader of this file.
//
// solutions/testing/2026-08-01-1617-inline-provenance-comments-drift-from-their-literals.md — a
// provenance comment is never executed, so a wrong one reads exactly like a verified one; keeping
// provenance in a `source` field makes it enumerable and surfaces it in failure output.
//
// Every value below was independently re-verified against mpmath at mp.dps=50, using each process's
// textbook marginal/transition law (Gaussian for BM/OU/BB/AR1, log-normal for GBM, Poisson for the
// counting process, Gamma for CIR's x0 = 0 marginal, shifted binomial for RandomWalk) — never by
// running ran.process itself, which would make these assertions tautological.
export default [
  {
    name: 'BrownianMotion',
    ctor: BrownianMotion,
    refs: [
      {
        should: 'return mu*t for zero initial state',
        params: () => [0.5, 1, 1],
        method: 'mean',
        args: [2],
        expected: 1.0,
        tol: 1e-10,
        source: 'exact rational: mu*t = 0.5*2 = 1'
      },
      {
        should: 'return sigma^2 * t',
        params: () => [0, 2, 1],
        method: 'variance',
        args: [3],
        expected: 12,
        tol: 1e-10,
        source: 'exact rational: sigma^2*t = 2^2*3 = 12'
      },
      {
        should: 'return Normal(0,1) density at x=0, t=1 for mu=0, sigma=1',
        params: () => [0, 1, 1],
        method: 'pdf',
        args: [0, 1],
        expected: 0.3989422804014327,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, loc=0, scale=1) = 0.3989422804014327'
      },
      {
        should: 'return Normal(mu*t, sigma^2*t) density for general parameters',
        params: () => [0.5, 2, 1],
        method: 'pdf',
        args: [1, 2],
        expected: 0.1410473958869391,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(1, loc=0.5*2, scale=sqrt(4*2)) = 0.1410473958869391'
      },
      {
        should: 'match Normal distribution with correct parameters',
        params: () => [-0.2, 1.5, 1],
        method: 'pdf',
        args: [0, 3],
        expected: 0.1495123243667221,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, loc=-0.2*3, scale=sqrt(1.5^2*3)) = 0.1495123243667221'
      },
      {
        should: 'return sigma^2 * min(s, t)',
        params: () => [0, 2, 1],
        method: 'covariogram',
        args: [2, 3],
        expected: 8,
        tol: 1e-10,
        source: 'exact rational: sigma^2*min(s,t) = 2^2*min(2,3) = 4*2 = 8'
      },
      {
        should: 'match the transition log-likelihood of a fixed path',
        params: () => [0.3, 1.2, 0.5],
        method: 'lnL',
        args: [[0, 0.4, 1.1, 0.7]],
        expected: -2.7276011658226307,
        tol: 1e-9,
        source: 'mpmath mp.dps=50: sum of Normal(x_i + mu*dt, sigma^2*dt).logpdf(x_{i+1}) over the 3 steps -> -2.7276011658226308065169617691597986337297768997831'
      }
    ]
  },
  {
    name: 'GeometricBrownianMotion',
    ctor: GeometricBrownianMotion,
    refs: [
      {
        should: 'return exp(mu*t)',
        params: () => [0.1, 0.2, 1],
        method: 'mean',
        args: [3],
        expected: 1.3498588075760032,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: exp(0.1*3) = exp(0.3) -> 1.3498588075760032'
      },
      {
        should: 'return exp(2*mu*t)*(exp(sigma^2*t)-1)',
        params: () => [0.05, 0.3, 1],
        method: 'variance',
        args: [1],
        expected: 0.10407867958160391,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: exp(0.1)*(exp(0.09)-1) -> 0.10407867958160391'
      },
      {
        should: 'return log-normal density for mu=0.1, sigma=0.3, t=1, x=1',
        params: () => [0.1, 0.3, 1],
        method: 'pdf',
        args: [1.0, 1],
        expected: 1.3076461848524421,
        tol: 1e-10,
        source: 'scipy: stats.lognorm.pdf(1, s=0.3*sqrt(1), scale=exp(log(1)+(0.1-0.09/2)*1)) = 1.3076461848524421'
      },
      {
        should: 'return log-normal density for mu=0.05, sigma=0.2, t=2, x=1.5',
        params: () => [0.05, 0.2, 1],
        method: 'pdf',
        args: [1.5, 2],
        expected: 0.4459926977250626,
        tol: 1e-10,
        source: 'scipy: stats.lognorm.pdf(1.5, s=0.2*sqrt(2), scale=exp((0.05-0.02)*2)) = 0.4459926977250626'
      },
      {
        should: 'return log-normal density for mu=0, sigma=0.5, t=0.5, x=0.8',
        params: () => [0, 0.5, 1],
        method: 'pdf',
        args: [0.8, 0.5],
        expected: 1.2721398281078873,
        tol: 1e-10,
        // The inline comment this replaced wrote the scale as exp(-0.0625*0.5), which evaluates to
        // 1.2172975135116265 — not the asserted value. The log-mean is (mu - sigma^2/2)*t =
        // (0 - 0.125)*0.5 = -0.0625, so the scale is exp(-0.0625). The literal was always correct;
        // only the stated derivation was wrong (#1221).
        source: 'scipy: stats.lognorm.pdf(0.8, s=0.5*sqrt(0.5), scale=exp((0-0.5^2/2)*0.5)=exp(-0.0625)) = 1.2721398281078873'
      },
      {
        should: 'return exp(mu*(s+t)) * (exp(sigma^2*min(s,t)) - 1)',
        params: () => [0.05, 0.2, 1],
        method: 'covariogram',
        args: [1, 3],
        expected: 0.049846392161234841,
        tol: 1e-10,
        source: 'scipy: exp(0.05*(1+3)) * (exp(0.2**2*min(1,3)) - 1) -> 0.049846392161234841'
      },
      {
        should: 'match the transition log-likelihood of a fixed path',
        params: () => [0.1, 0.25, 0.5],
        method: 'lnL',
        args: [[1.0, 1.2, 0.9, 1.5]],
        expected: -3.682464110185123,
        tol: 1e-9,
        source: 'mpmath mp.dps=50: sum of [Normal(drift, noise^2).logpdf(log(x_{i+1}/x_i)) - log(x_{i+1})] over the 3 steps, where drift = (mu-0.5*sigma^2)*dt, noise^2 = sigma^2*dt (the log-normal transition density\'s 1/x Jacobian) -> -3.6824641101851229894621067377482732895915091716478'
      }
    ]
  },
  {
    name: 'OrnsteinUhlenbeck',
    ctor: OrnsteinUhlenbeck,
    refs: [
      {
        should: 'return mu*(1 - exp(-theta*t)) for zero initial state',
        params: () => [2, 3, 1, 0.1],
        method: 'mean',
        args: [1],
        expected: 2.593994150290162,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: 3*(1-exp(-2)) -> 2.593994150290162'
      },
      {
        should: 'approach mu as t -> infinity',
        params: () => [1, 4, 1, 0.1],
        method: 'mean',
        args: [1000],
        expected: 4,
        tol: 1e-6,
        source: 'exact rational: mu*(1-exp(-theta*t)) -> mu as t -> inf; at theta*t = 1000, exp(-1000) underflows to 0 in float64, so the limit is exactly mu = 4'
      },
      {
        should: 'return sigma^2*(1-exp(-2*theta*t))/(2*theta)',
        params: () => [2, 0, 0.5, 0.1],
        method: 'variance',
        args: [1],
        expected: 0.06135527256945411,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: sigma^2*(1-exp(-2*theta*t))/(2*theta) = 0.25*(1-exp(-4))/4 -> 0.06135527256945411'
      },
      {
        should: 'approach stationary variance sigma^2/(2*theta) as t -> infinity',
        params: () => [2, 0, 0.5, 0.1],
        method: 'variance',
        args: [1000],
        expected: 0.0625,
        tol: 1e-6,
        source: 'exact rational: sigma^2/(2*theta) = 0.25/4 = 0.0625'
      },
      {
        should: 'return Normal(mean(t), variance(t)) density for theta=1 mu=2 sigma=1 t=1 x=1',
        params: () => [1, 2, 1, 0.1],
        method: 'pdf',
        args: [1, 1],
        expected: 0.5596687594392821,
        tol: 1e-10,
        source: 'scipy: mu=2*(1-exp(-1)), var=(1-exp(-2))/2; stats.norm.pdf(1, mu, sqrt(var)) = 0.5596687594392821'
      },
      {
        should: 'return correct density for theta=2 mu=0 sigma=0.5 t=0.5 x=0',
        params: () => [2, 0, 0.5, 0.1],
        method: 'pdf',
        args: [0, 0.5],
        expected: 1.7161142135258760,
        tol: 1e-10,
        source: 'scipy: mu=0, var=0.25*(1-exp(-2))/4; stats.norm.pdf(0, 0, sqrt(var)) = 1.7161142135258760'
      },
      {
        should: 'return correct density for theta=0.5 mu=3 sigma=2 t=2 x=2',
        params: () => [0.5, 3, 2, 0.1],
        method: 'pdf',
        args: [2, 2],
        expected: 0.2141814469689605,
        tol: 1e-10,
        source: 'scipy: mu=3*(1-exp(-1)), var=4*(1-exp(-2))/1; stats.norm.pdf(2, mu, sqrt(var)) = 0.2141814469689605'
      },
      {
        should: 'return (sigma^2/2theta)*(exp(-theta*|t-s|) - exp(-theta*(t+s)))',
        params: () => [2, 0, 0.5, 0.1],
        method: 'covariogram',
        args: [1, 3],
        expected: 0.0011237610163019791,
        tol: 1e-10,
        source: 'scipy: (0.5**2/(2*2)) * (exp(-2*abs(3-1)) - exp(-2*(3+1))) -> 0.0011237610163019791'
      },
      {
        should: 'match the transition log-likelihood of a fixed path',
        params: () => [0.8, 0.5, 0.6, 0.25],
        method: 'lnL',
        args: [[1.0, 0.9, 0.6, 0.8]],
        expected: 0.47497249518150225,
        tol: 1e-9,
        source: 'mpmath mp.dps=50: sum of Normal(x_i*decay + mu*(1-decay), noise^2).logpdf(x_{i+1}) over the 3 steps, where decay = exp(-theta*dt), noise^2 = sigma^2*(1-decay^2)/(2*theta) — the ONE-STEP transition constants, distinct from mean(t)/variance(t)\'s elapsed-time decay exp(-theta*t) for arbitrary t -> 0.47497249518150224285604569178811850409220342308943'
      }
    ]
  },
  {
    name: 'BrownianBridge',
    ctor: BrownianBridge,
    refs: [
      {
        should: 'return sigma^2 * t * (T-t) / T for 0 < t < T',
        params: () => [2, 1, 0.1],
        method: 'variance',
        args: [0.5],
        expected: 1,
        tol: 1e-10,
        source: 'exact rational: sigma^2*t*(T-t)/T = 4*0.5*0.5/1 = 1'
      },
      {
        should: 'return sigma^2 * min(s,t) * (T - max(s,t)) / T for 0 <= s <= t <= T',
        params: () => [2, 1, 0.1],
        method: 'covariogram',
        args: [0.25, 0.5],
        expected: 0.5,
        tol: 1e-10,
        source: 'exact rational: sigma^2*s*(T-t)/T = 4*0.25*0.5/1 = 0.5'
      },
      {
        should: 'return Normal(0, sigma^2*t*(T-t)/T) density at x=0 for sigma=1, T=2, t=1',
        params: () => [1, 2, 0.1],
        method: 'pdf',
        args: [0, 1],
        expected: 0.5641895835477563,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, 0, sqrt(1*1*1/2)) = 0.5641895835477563'
      },
      {
        should: 'return correct density at x=1 for sigma=1, T=2, t=1',
        params: () => [1, 2, 0.1],
        method: 'pdf',
        args: [1, 1],
        expected: 0.20755374871029736,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(1, 0, sqrt(0.5)) = 0.20755374871029736'
      },
      {
        should: 'return correct density at x=0 for sigma=2, T=4, t=2',
        params: () => [2, 4, 0.1],
        method: 'pdf',
        args: [0, 2],
        expected: 0.19947114020071635,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, 0, sqrt(4*2*2/4)) = stats.norm.pdf(0, 0, 2) = 0.19947114020071635'
      }
    ]
  },
  {
    name: 'AR1',
    ctor: AR1,
    refs: [
      {
        should: 'return sigma^2 at t = 1',
        params: () => [0.5, 2],
        method: 'variance',
        args: [1],
        expected: 4,
        tol: 1e-10,
        source: 'exact rational: Var(X_1) = sigma^2 = 4'
      },
      {
        should: 'return sigma^2*(1+phi^2) at t = 2',
        params: () => [0.5, 2],
        method: 'variance',
        args: [2],
        expected: 5,
        tol: 1e-10,
        source: 'exact rational: Var(X_2) = sigma^2*(1 + phi^2) = 4*(1+0.25) = 5'
      },
      {
        should: 'approach stationary variance sigma^2/(1-phi^2) as t -> infinity',
        params: () => [0.5, 1],
        method: 'variance',
        args: [1000],
        expected: 4 / 3,
        tol: 1e-6,
        source: 'exact rational: sigma^2/(1-phi^2) = 1/(1-0.25) = 4/3'
      },
      {
        should: 'grow monotonically for |phi| > 1',
        params: () => [1.5, 1],
        method: 'variance',
        args: [3],
        expected: 8.3125,
        tol: 1e-10,
        source: 'exact rational: Var(X_3) = sigma^2*(1 + phi^2 + phi^4) = 1 + 2.25 + 5.0625 = 8.3125'
      },
      // The next three are cancellation regression guards, not ordinary reference points: phi is
      // chosen so phi^2 lands just outside the 1e-14 special-case band, where the pre-#1153 formula
      // lost all significance. Their references are computed from the UNTRANSFORMED
      // sigma^2*(1-phi2^t)/(1-phi2) at 50 digits — deliberately not from the expm1/log1p
      // reformulation under test — and their tolerances are correspondingly tighter than the 1e-10
      // used elsewhere. Do not relax them to the default.
      {
        should: 'not collapse to 0 via cancellation for near-unit-root phi and small fractional t',
        params: () => [Math.sqrt(1 - 2e-14), 1],
        method: 'variance',
        args: [1e-6],
        expected: 1.00000000000001e-6,
        tol: 1e-15,
        source: 'mpmath mp.dps=50, untransformed sigma^2*(1-phi2^t)/(1-phi2) with the actual double phi2 = 0.99999999999998 (immune to cancellation at 50 digits): 1.0000000000000099999900...e-6'
      },
      {
        should: 'stay accurate for near-unit-root phi and moderate fractional t',
        params: () => [Math.sqrt(1 - 1e-13), 1],
        method: 'variance',
        args: [0.01],
        expected: 0.010000000000000495,
        tol: 1e-12,
        source: 'mpmath mp.dps=50, untransformed sigma^2*(1-phi2^t)/(1-phi2) with the actual double phi2 = 0.9999999999998999: 0.0100000000000004954950000000329...'
      },
      {
        should: 'remain accurate for near-unit-root phi at integer t (regression guard)',
        params: () => [Math.sqrt(1 - 1e-13), 1],
        method: 'variance',
        args: [10],
        expected: 9.999999999995495,
        tol: 1e-12,
        source: 'mpmath mp.dps=50, untransformed sigma^2*(1-phi2^t)/(1-phi2) with the actual double phi2 = 0.9999999999998999: 9.9999999999954955000000012024...'
      },
      {
        should: 'return Normal(0, sigma^2) density at t = 1',
        params: () => [0.5, 1],
        method: 'pdf',
        args: [0, 1],
        expected: 0.3989422804014327,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, 0, 1) = 0.3989422804014327'
      },
      {
        should: 'return Normal(0, sigma^2*(1+phi^2)) density at t = 2',
        params: () => [0.5, 1],
        method: 'pdf',
        args: [0, 2],
        expected: 0.3568248232305543,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(0, 0, sqrt(1.25)) = 0.3568248232305543'
      },
      {
        should: 'return Normal(0, sigma^2*(1+phi^2+phi^4)) density at t = 3',
        params: () => [0.5, 1],
        method: 'pdf',
        args: [1, 3],
        expected: 0.2379112029210874,
        tol: 1e-10,
        source: 'scipy: stats.norm.pdf(1, 0, sqrt(1.3125)) = 0.2379112029210874'
      },
      {
        should: 'return phi * Var(X_2) for s=2, t=3',
        params: () => [0.5, 1],
        method: 'covariogram',
        args: [2, 3],
        expected: 0.625,
        tol: 1e-10,
        source: 'exact rational: Cov(X_2, X_3) = phi * Var(X_2) = 0.5 * (1 + 0.25) = 0.625'
      },
      {
        should: 'return phi * Var(X_1) for s=1, t=2',
        params: () => [0.5, 1],
        method: 'covariogram',
        args: [1, 2],
        expected: 0.5,
        tol: 1e-10,
        source: 'exact rational: Cov(X_1, X_2) = phi^1 * Var(X_1) = 0.5 * 1 = 0.5'
      },
      {
        should: 'return phi^2 * Var(X_1) for s=1, t=3',
        params: () => [0.5, 1],
        method: 'covariogram',
        args: [1, 3],
        expected: 0.25,
        tol: 1e-10,
        source: 'exact rational: Cov(X_1, X_3) = phi^2 * Var(X_1) = 0.25 * 1 = 0.25'
      }
    ]
  },
  {
    name: 'Poisson',
    ctor: ProcessPoisson,
    refs: [
      {
        should: 'return lambda*t',
        params: () => [2, 0.5],
        method: 'mean',
        args: [3],
        expected: 6,
        tol: 1e-10,
        source: 'exact rational: lambda*t = 2*3 = 6'
      },
      {
        should: 'return lambda*t',
        params: () => [2, 0.5],
        method: 'variance',
        args: [3],
        expected: 6,
        tol: 1e-10,
        source: 'exact rational: lambda*t = 2*3 = 6'
      },
      {
        should: 'return Poisson(lambda*t) PMF for lambda=2 t=1 x=2',
        params: () => [2, 1],
        method: 'pdf',
        args: [2, 1],
        expected: 0.2706705664732255,
        tol: 1e-10,
        source: 'scipy: stats.poisson.pmf(2, 2) = 0.2706705664732255'
      },
      {
        should: 'return Poisson(lambda*t) PMF for lambda=0.5 t=3 x=1',
        params: () => [0.5, 1],
        method: 'pdf',
        args: [1, 3],
        expected: 0.3346952402226447,
        tol: 1e-10,
        source: 'scipy: stats.poisson.pmf(1, 1.5) = 0.3346952402226447'
      },
      {
        should: 'return Poisson(lambda*t) PMF for lambda=3 t=2 x=5',
        params: () => [3, 1],
        method: 'pdf',
        args: [5, 2],
        expected: 0.1606231410479798,
        tol: 1e-10,
        source: 'scipy: stats.poisson.pmf(5, 6) = 0.1606231410479798'
      },
      {
        should: 'return lambda * min(s, t)',
        params: () => [3, 0.5],
        method: 'covariogram',
        args: [2, 5],
        expected: 6,
        tol: 1e-10,
        source: 'exact rational: lambda*min(s,t) = 3*min(2,5) = 3*2 = 6'
      }
    ]
  },
  {
    // Only three entries, against 5-13 for every other process: a compound Poisson sum has no
    // closed-form pdf/cdf/lnL for a general jump distribution, so only the first two moments and
    // the covariogram are expressible as literals here. The density is covered instead by the
    // hand-written .marginal() block in process.js, which checks the Gamma-jump case against a
    // truncated Poisson-Gamma series. Thin by nature, not by oversight.
    name: 'CompoundPoisson',
    ctor: CompoundPoisson,
    refs: [
      {
        should: 'return lambda*t*E[J]',
        params: () => [new Normal(2, 1), 3, 1],
        method: 'mean',
        args: [5],
        expected: 30,
        tol: 1e-10,
        source: 'exact rational: lambda*t*mu = 3*5*2 = 30'
      },
      {
        should: 'return lambda*t*E[J^2]',
        params: () => [new Normal(2, 1), 3, 1],
        method: 'variance',
        args: [4],
        expected: 60,
        tol: 1e-10,
        source: 'exact rational: lambda*t*(sigma^2 + mu^2) = 3*4*(1+4) = 60'
      },
      {
        should: 'return lambda*E[J^2]*min(s,t)',
        params: () => [new Normal(2, 1), 3, 1],
        method: 'covariogram',
        args: [2, 5],
        expected: 30,
        tol: 1e-10,
        source: 'exact rational: lambda*E[J^2]*min(s,t) = 3*(1+4)*2 = 30'
      }
    ]
  },
  {
    name: 'CoxIngersollRoss',
    ctor: CoxIngersollRoss,
    refs: [
      {
        should: 'return theta*(1-exp(-kappa*t)) for zero initial state',
        params: () => [2, 3, 1, 0.1],
        method: 'mean',
        args: [1],
        expected: 2.593994150290162,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: 3*(1-exp(-2)) -> 2.5939941502901619243180015150825467897771053622713'
      },
      {
        should: 'approach theta as t -> infinity',
        params: () => [1, 4, 1, 0.1],
        method: 'mean',
        args: [1000],
        expected: 4,
        tol: 1e-6,
        source: 'exact rational: theta*(1-exp(-kappa*t)) -> theta as t -> inf; at kappa*t = 1000, exp(-1000) underflows to 0 in float64, so the limit is exactly theta = 4'
      },
      {
        should: 'return theta*sigma^2/(2*kappa)*(1-exp(-kappa*t))^2 for zero initial state',
        params: () => [2, 3, 0.5, 0.1],
        method: 'variance',
        args: [1],
        expected: 0.1401834510779079,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: 3*(0.25/(2*2))*(1-exp(-2))^2 -> 0.14018345107790789934482231837405108163687168295019'
      },
      {
        should: 'approach stationary variance theta*sigma^2/(2*kappa) as t -> infinity',
        params: () => [2, 3, 0.5, 0.1],
        method: 'variance',
        args: [1000],
        expected: 0.1875,
        tol: 1e-6,
        source: 'exact rational: theta*sigma^2/(2*kappa) = 3*0.25/4 = 0.1875'
      },
      // The five CIR pdf/covariogram references below previously cited "Python3 math", which is
      // float64 stdlib arithmetic and not one of the three tools CLAUDE.md sanctions. They are
      // re-derived here from the same textbook laws at mp.dps=50 — X_t ~ Gamma(2*kappa*theta/sigma^2,
      // scale = sigma^2*(1-exp(-kappa*t))/(2*kappa)) for x0 = 0, and Cov(X_s,X_t) = Var(X_min) *
      // exp(-kappa*|t-s|) — and the asserted literals are now the correctly-rounded float64 values
      // rather than the 13-significant-digit truncations previously stored (#1221).
      {
        should: 'return Gamma density for x=0.5, kappa=2, theta=3, sigma=1, t=0.5',
        params: () => [2, 3, 1, 0.1],
        method: 'pdf',
        args: [0.5, 0.5],
        expected: 0.0021308247498825613,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: Gamma(alpha=12, scale=(1-exp(-1))/4).pdf(0.5) -> 0.0021308247498825613865329058218278989295590699941829'
      },
      {
        should: 'return Gamma density for x=2.0, kappa=2, theta=3, sigma=1, t=0.5',
        params: () => [2, 3, 1, 0.1],
        method: 'pdf',
        args: [2.0, 0.5],
        expected: 0.6744427823991435,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: Gamma(alpha=12, scale=(1-exp(-1))/4).pdf(2) -> 0.674442782399143409464902014509663705211162020868'
      },
      {
        should: 'return Gamma density for x=1.5, kappa=2, theta=3, sigma=1, t=1',
        params: () => [2, 3, 1, 0.1],
        method: 'pdf',
        args: [1.5, 1],
        expected: 0.2017343219136092,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: Gamma(alpha=12, scale=(1-exp(-2))/4).pdf(1.5) -> 0.20173432191360919916867020119773819180627563066727'
      },
      {
        should: 'return correct value for s=1, t=3, kappa=2, theta=3, sigma=1',
        params: () => [2, 3, 1, 0.1],
        method: 'covariogram',
        args: [1, 3],
        expected: 0.010270197872477982,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: theta*sigma^2/(2*kappa)*(1-exp(-2))^2*exp(-4) -> 0.010270197872477981464836806653041575586157506387096'
      },
      {
        should: 'return correct value for s=0.5, t=2, kappa=2, theta=3, sigma=1',
        params: () => [2, 3, 1, 0.1],
        method: 'covariogram',
        args: [0.5, 2],
        expected: 0.014920303192110787,
        tol: 1e-10,
        source: 'mpmath mp.dps=50: theta*sigma^2/(2*kappa)*(1-exp(-1))^2*exp(-3) -> 0.01492030319211078711640681614504578734254378158162'
      }
    ]
  },
  {
    name: 'RandomWalk',
    ctor: RandomWalk,
    refs: [
      {
        should: 'return t*(2p-1) for biased walk',
        params: () => [0.7],
        method: 'mean',
        args: [5],
        expected: 2,
        tol: 1e-10,
        source: 'exact rational: t*(2p-1) = 5*(2*0.7-1) = 5*0.4 = 2'
      },
      {
        should: 'return negative mean for p < 0.5',
        params: () => [0.3],
        method: 'mean',
        args: [4],
        expected: -1.6,
        tol: 1e-10,
        source: 'exact rational: t*(2p-1) = 4*(0.6-1) = 4*(-0.4) = -1.6'
      },
      {
        should: 'return 4p(1-p)*t for symmetric walk',
        params: () => [0.5],
        method: 'variance',
        args: [10],
        expected: 10,
        tol: 1e-10,
        source: 'exact rational: 4*0.5*0.5*10 = 10'
      },
      {
        should: 'return 4p(1-p)*t for biased walk',
        params: () => [0.7],
        method: 'variance',
        args: [5],
        expected: 4.2,
        tol: 1e-10,
        source: 'exact rational: 4*0.7*0.3*5 = 4.2'
      },
      {
        should: 'return exact binomial PMF for p=0.5, t=4, x=0',
        params: () => [0.5],
        method: 'pdf',
        args: [0, 4],
        expected: 0.375,
        tol: 1e-10,
        source: 'exact rational: C(4,2)*0.5^4 = 6/16 = 0.375'
      },
      {
        should: 'return exact binomial PMF for p=0.5, t=4, x=2',
        params: () => [0.5],
        method: 'pdf',
        args: [2, 4],
        expected: 0.25,
        tol: 1e-10,
        source: 'exact rational: C(4,3)*0.5^4 = 4/16 = 0.25'
      },
      {
        should: 'return exact binomial PMF for p=0.6, t=3, x=1',
        params: () => [0.6],
        method: 'pdf',
        args: [1, 3],
        expected: 0.432,
        tol: 1e-10,
        source: 'exact rational: C(3,2)*0.6^2*0.4 = 3*0.36*0.4 = 0.432'
      },
      {
        should: 'return exact binomial PMF for p=0.7, t=5, x=3',
        params: () => [0.7],
        method: 'pdf',
        args: [3, 5],
        expected: 0.36015,
        tol: 1e-10,
        source: 'exact rational: C(5,4)*0.7^4*0.3 = 5*0.2401*0.3 = 0.36015'
      },
      {
        should: 'return 4p(1-p)*min(s,t) for symmetric walk',
        params: () => [0.5],
        method: 'covariogram',
        args: [3, 5],
        expected: 3,
        tol: 1e-10,
        source: 'exact rational: 4*0.5*0.5*min(3,5) = 3'
      },
      {
        should: 'return 4p(1-p)*min(s,t) for biased walk',
        params: () => [0.7],
        method: 'covariogram',
        args: [2, 4],
        expected: 1.68,
        tol: 1e-10,
        source: 'exact rational: 4*0.7*0.3*min(2,4) = 4*0.21*2 = 1.68'
      },
      {
        should: 'return a nonzero marginal pdf at the upper support boundary',
        params: () => [0.6],
        method: 'marginal',
        args: [4],
        chain: 'pdf',
        chainArgs: [4],
        expected: 0.1296,
        tol: 1e-10,
        source: 'exact rational: pdf(n) is the all-+1-steps walk, probability p^n = 0.6^4 = 0.1296'
      },
      {
        should: 'return a nonzero marginal pdf at the lower support boundary',
        params: () => [0.6],
        method: 'marginal',
        args: [4],
        chain: 'pdf',
        chainArgs: [-4],
        expected: 0.0256,
        tol: 1e-10,
        source: 'exact rational: pdf(-n) is the all--1-steps walk, probability (1-p)^n = 0.4^4 = 0.0256'
      }
    ]
  }
]
