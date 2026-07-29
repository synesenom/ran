"""
Reference value generation for test/precision-special.js (issue #1140).

All reference values are mpmath (mp.dps = 50) evaluations of besselI, besselISpherical,
besselInu, besselK, besselKnu, digamma, and trigamma, rounded to the nearest float64
(shortest round-tripping decimal) and emitted as JS literals.

Unlike scripts/precision-refs-continuous.py / -discrete.py, there is no existing
independently-vetted reference file (analogous to test/dist-cases-*.js) to self-check the
generator against for bare special functions -- so this script's own --check step IS the
check: it evaluates ranjs's own src/special/ implementation (via scripts/eval-special.js, a
small Node/@babel-register bridge, mirroring the dump-dist-cases-json.js precedent) at every
grid point and reports any mismatch beyond that point's tolerance.

Because there is no second reference source, review this generator's own reference formulas
(besselISpherical_ref etc.) with the same rigor as production code: confirm the grid actually
exercises every special case those formulas branch on (e.g. x=0, negative-order divergence),
not just every branch in src/special/bessel.js/digamma.js/trigamma.js -- a wrong x=0 guard in
this file is exactly as dangerous as a bug in the code under test. See
solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md

The grid is deliberately threshold-focused rather than a brute-force Cartesian sweep: every
documented internal dispatch threshold in src/special/bessel.js, src/special/digamma.js, and
src/special/trigamma.js gets a small cluster of points straddling it (issue #1185 was found exactly this way -- a
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

from mpmath import mp, mpf, pi, sqrt, besseli, besselk
from mpmath import digamma as mp_digamma
from mpmath import polygamma as mp_polygamma

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

# besselInu(nu, x) for very negative fractional nu at x approaching the documented ~710 series
# boundary used to return Infinity (Math.pow(x/2, nu)'s tiny prefactor times an internally-
# overflowing recursiveSum) where the true value is a large but finite number (~1e302-1e306).
# Fixed in issue #1215 (a hand-written rescaling loop in src/special/bessel.js); no points
# remain withheld. This dict is kept (empty) as the reusable mechanism for any future
# accuracy-cliff bug of this shape, the same way VonMises[11]'s refVals were withheld pending
# issue #1185 -- see the WITHHELD report printed by --check/--emit.
WITHHELD = {
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


def besselInu_ref(nu, x):
    return besseli(nu, x)


def besselK_ref(n, x):
    return besselk(n, x)


def besselKnu_ref(nu, x):
    return besselk(nu, x)


def digamma_ref(z):
    return mp_digamma(z)


def trigamma_ref(z):
    # psi_1(z), independent of ranjs's own Stirling-series/shift-and-sum/reflection code.
    return mp_polygamma(1, z)


REF_FN = {
    'besselI': besselI_ref,
    'besselISpherical': besselISpherical_ref,
    'besselInu': besselInu_ref,
    'besselK': besselK_ref,
    'besselKnu': besselKnu_ref,
    'digamma': digamma_ref,
    'trigamma': trigamma_ref,
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


def _trigamma_grid(add):
    # Threshold z=10 (shift-and-sum vs Stirling series) -- same crossover as digamma, since
    # trigamma.js reuses digamma's shift threshold (independently re-verified during
    # implementation to hit the same ~1e-14 truncation error there).
    for z in [0.01, 0.1, 0.5, 0.9, 1, 1.5, 2, 5, 9, 9.9, 9.99, 10, 10.01, 10.1, 15, 50, 100, 500]:
        add('trigamma', (z,), 'trigamma: shift-and-sum/Stirling crossover at z=10')
    # Negative non-integer: reflection formula psi1(1-z) + psi1(z) = (pi/sin(pi*z))^2.
    for z in [-0.5, -1.5, -2.5, -9.5, -10.5, -100.5]:
        add('trigamma', (z,), 'trigamma: reflection formula for negative z')
    # Near-pole (bracketing the existing test/special.js pole spot-checks).
    for z in [-1 + 1e-6, -2 + 1e-6, -5 + 1e-7]:
        add('trigamma', (z,), 'trigamma: near-pole reflection-formula precision')


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
    _besselInu_grid(add)
    _besselK_grid(add)
    _besselKnu_grid(add)
    _digamma_grid(add)
    _trigamma_grid(add)

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
        lines.append(
            f"  {{ fn: '{fn}', args: {args_js}, ref: {num(ref)}, tol: {tol!r}, note: '{note}' }},"
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
