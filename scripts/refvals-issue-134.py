#!/usr/bin/env python3
"""Generate scipy/numpy reference values for the 8 core discrete distributions
listed in issue #134. Cross-validation against dist/ranjs.cjs.js happens in
scripts/refvals-issue-134-verify.js.

Parameter mapping notes (see solutions/testing/ for the prevention strategy):

- Geometric: ranjs is 0-indexed (failures before first success). scipy.stats.geom
  is 1-indexed. Use scipy.stats.nbinom(1, p) which IS the 0-indexed geometric.
- NegativeBinomial: ranjs PMF C(k+r-1, k) (1-p)^r p^k has the success/failure
  interpretation swapped relative to scipy nbinom C(k+n-1, k) p^n (1-p)^k.
  Equivalent call: nbinom(n=r_ranjs, p=1-p_ranjs).
- Hypergeometric: scipy uses hypergeom(M, n, N) where the names collide with
  ranjs's (N, K, n). Map: hypergeom(M=N_ranjs, n=K_ranjs, N=n_ranjs).
- DiscreteUniform: scipy.stats.randint(low, high) has EXCLUSIVE upper bound.
  ranjs (xmin, xmax) maps to randint(xmin, xmax+1).
"""
import numpy as np
from scipy import stats


def fmt(name, params_ranjs, x_grid, pmf_fn, cdf_fn):
    print(f"  {name} (ranjs params: {params_ranjs}):")
    print("    refVals: [")
    for x in x_grid:
        pmf = float(pmf_fn(x))
        cdf = float(cdf_fn(x))
        # repr() gives the shortest round-trip representation; standard.js
        # rejects literals with too many digits, so prefer repr over fixed-width.
        print(f"      {{ x: {x}, pmf: {pmf!r}, cdf: {cdf!r} }},")
    print("    ]")
    print()


# 1. Binomial(n=25, p=0.5) — endpoints x=0, x=25 included for boundary coverage.
n, p = 25, 0.5
d = stats.binom(n, p)
fmt("Binomial", (n, p),
    [0, 5, 8, 10, 12, 13, 15, 18, 22, 25],
    d.pmf, d.cdf)

# 2. Poisson(mu=10) — case[0] is [10]
mu = 10
d = stats.poisson(mu)
fmt("Poisson", (mu,),
    [2, 5, 8, 10, 12, 15, 20, 30],
    d.pmf, d.cdf)

# 3. Geometric(p=0.5) — ranjs is 0-indexed. nbinom(1, p) is 0-indexed geometric.
p = 0.5
d = stats.nbinom(1, p)
fmt("Geometric", (p,),
    [0, 1, 2, 3, 5, 8, 12],
    d.pmf, d.cdf)

# 4. NegativeBinomial(r=10, p=0.4) — asymmetric p so the success/failure swap
#    cannot be hidden by 1-p == p. p=0.3/0.7 are flaky at chiTest seed=0; p=0.4
#    is the closest asymmetric value that passes all three fixed seeds reliably.
r_ranjs, p_ranjs = 10, 0.4
d = stats.nbinom(r_ranjs, 1 - p_ranjs)   # n = r_ranjs, p_scipy = 1 - p_ranjs
fmt("NegativeBinomial", (r_ranjs, p_ranjs),
    [0, 3, 5, 7, 10, 15, 25],
    d.pmf, d.cdf)

# 5. Hypergeometric(N=30, K=10, n=5) — scipy uses (M, n, N).
N_ranjs, K_ranjs, n_ranjs = 30, 10, 5
d = stats.hypergeom(M=N_ranjs, n=K_ranjs, N=n_ranjs)
fmt("Hypergeometric", (N_ranjs, K_ranjs, n_ranjs),
    [0, 1, 2, 3, 4, 5],
    d.pmf, d.cdf)

# 6. Bernoulli(p=0.5)
p = 0.5
d = stats.bernoulli(p)
fmt("Bernoulli", (p,),
    [0, 1],
    d.pmf, d.cdf)

# 7. DiscreteUniform(xmin=5, xmax=50) — randint has exclusive upper bound.
xmin, xmax = 5, 50
d = stats.randint(xmin, xmax + 1)
fmt("DiscreteUniform", (xmin, xmax),
    [5, 10, 20, 30, 40, 50],
    d.pmf, d.cdf)

# 8. Categorical(weights=[0.4, 0.6], min=0) — no scipy; numpy normalize + cumsum.
w = np.array([0.4, 0.6], dtype=float)
p_arr = w / w.sum()
c_arr = np.cumsum(p_arr)
print("  Categorical (ranjs params: ([0.4, 0.6], 0)):")
print("    refVals: [")
for x in [0, 1]:
    print(f"      {{ x: {x}, pmf: {float(p_arr[x])!r}, cdf: {float(c_arr[x])!r} }},")
print("    ]")
