// ksTest's critical value (test/test-utils.js) is the standard two-sided KS asymptotic
// constant at alpha=0.01 (D <= 1.628/sqrt(n)) -- every unseeded call has an inherent ~1%
// false-positive rate per CI run. Every distributional/margin-recovery KS assertion in this
// file therefore sweeps a fixed, pre-verified seed set -- [0, 42, 12345] (or, for Gibbs,
// [0, 7, 42] -- see that block's own comment for why) -- instead of relying on a single seed,
// so a real regression must break at least one of three independent trajectories reproducibly
// instead of the whole block carrying a permanent flake rate or, worse, having its seed
// hand-picked because it happened to pass. See
// solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md,
// solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md, and
// solutions/testing/2026-07-17-1615-mcmc-ks-test-seed-sweep-file-wide-policy.md
export const SEEDS = [0, 42, 12345]
