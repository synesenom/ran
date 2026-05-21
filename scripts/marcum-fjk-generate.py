#!/usr/bin/env python3
"""Offline generator for the large-mu Marcum-Q asymptotic-expansion coefficients.

Implements Section 4.2-4.6 of Gil, Segura & Temme, "Computation of the Marcum
Q-function" (arXiv:1311.0681) and emits the f_{jk} coefficient table and the
u_k(t) Bessel coefficients that `src/special/marcum-q.js` hardcodes.

This is a provenance artifact, NOT a build step (mirrors refvals-issue-134.py).
It derives the f_{jk} in exact rational / high-precision arithmetic and is
triple-gated:

  Gate A -- the j+k <= 3 subset reproduces the paper's printed Eq. 90.
  Gate B -- the j=0 column equals the Bessel coefficients, f_{0,k} = u_k(u^2).
  Gate C -- the assembled Q/P expansion matches scipy.stats.ncx2 across the
            mu >= 135 transition band to <= 1e-11.

Run:  python3 scripts/marcum-fjk-generate.py

Derivation outline (paper section 4.6.2). With scaled x, the saddle point of
phi(z) = -2 ln z + z^2/(4x) - sqrt(1+z^2) + ln(1+sqrt(1+z^2)) is
z0 = 2 sqrt(x(1+x)). Bleistein's transform sets phi(z) - phi(z0) = (1/2) sigma^2
with sigma = w - zeta. Reverting sigma(v) (v = z - z0) gives z(sigma); then
f_k(w) = (z/2x) u_k(t) (1+z^2)^(-1/4) dz/dw, and f_{jk} = [sigma^j] f_k.
"""
import sys
import mpmath as mp
import sympy

mp.mp.dps = 120

N = 14            # power-series truncation order (coefficient indices 0..N)
NT = N + 1
JGEN = 10         # derive f_{jk} for j = 0..JGEN
KGEN = 5          # ...                  k = 0..KGEN


# --------------------------------------------------------------------------
# Truncated power-series arithmetic (lists of mpf, index = power, length NT).
# --------------------------------------------------------------------------
def zeros():
    return [mp.mpf(0) for _ in range(NT)]


def ps_mul(a, b):
    r = zeros()
    for i in range(NT):
        ai = a[i]
        if ai == 0:
            continue
        for j in range(NT - i):
            r[i + j] += ai * b[j]
    return r


def ps_pow(a, alpha):
    """a**alpha for a power series with a[0] != 0 (J.C.P. Miller recurrence)."""
    r = zeros()
    a0 = a[0]
    r[0] = mp.power(a0, alpha)
    for m in range(1, NT):
        s = mp.mpf(0)
        for j in range(1, m + 1):
            s += (alpha * j - (m - j)) * a[j] * r[m - j]
        r[m] = s / (m * a0)
    return r


def ps_log(a):
    """log of a power series with a[0] > 0."""
    r = zeros()
    r[0] = mp.log(a[0])
    for m in range(1, NT):
        s = m * a[m]
        for j in range(1, m):
            s -= j * r[j] * a[m - j]
        r[m] = s / (m * a[0])
    return r


def ps_deriv(a):
    r = zeros()
    for i in range(NT - 1):
        r[i] = (i + 1) * a[i + 1]
    return r


def ps_compose(a, b):
    """a(b(x)); requires b[0] == 0."""
    r = zeros()
    bpow = zeros()
    bpow[0] = mp.mpf(1)
    for k in range(NT):
        ak = a[k]
        if ak != 0:
            for i in range(NT):
                r[i] += ak * bpow[i]
        bpow = ps_mul(bpow, b)
    return r


def ps_revert(a):
    """Series reversion: a[0]==0, a[1]!=0; returns b with a(b(x)) == x."""
    b = zeros()
    b[1] = 1 / a[1]
    for m in range(2, NT):
        comp = ps_compose(a, b)        # b[m] still 0 -> comp[m] is the known part
        b[m] = -comp[m] / a[1]
    return b


def poly_compose(coeffs, s):
    """Evaluate the polynomial sum coeffs[i]*s**i where s is a power series."""
    r = zeros()
    for c in reversed(coeffs):
        r = ps_mul(r, s)
        r[0] += c
    return r


# --------------------------------------------------------------------------
# Bessel uniform-asymptotic coefficients u_k(t), Eq. 47-48 (exact via SymPy).
# --------------------------------------------------------------------------
def bessel_uk(kmax):
    t, s = sympy.symbols('t s')
    polys = [sympy.Integer(1)]
    for k in range(kmax):
        uk = polys[k]
        term1 = sympy.Rational(1, 2) * t**2 * (1 - t**2) * sympy.diff(uk, t)
        term2 = sympy.Rational(1, 8) * sympy.integrate(
            (1 - 5 * s**2) * uk.subs(t, s), (s, 0, t))
        polys.append(sympy.expand(term1 + term2))
    coeffs = []
    for uk in polys:
        p = sympy.Poly(uk, t)
        deg = p.degree()
        c = [mp.mpf(0)] * (deg + 1)
        for (mono,), val in p.terms():
            c[mono] = mp.mpf(int(val.p)) / mp.mpf(int(val.q))
        coeffs.append(c)
    return coeffs


UK_COEF = bessel_uk(KGEN + 1)        # u_0..u_KGEN as poly-in-t coefficient lists


# --------------------------------------------------------------------------
# Derivation of f_{jk} for a single scaled x value.
# --------------------------------------------------------------------------
def phi_series(x, z0):
    """Power series of phi(z0 + v) in v."""
    z = zeros()
    z[0] = z0
    z[1] = mp.mpf(1)
    lnz = ps_log(z)
    z2 = ps_mul(z, z)
    onepz2 = list(z2)
    onepz2[0] += 1
    R = ps_pow(onepz2, mp.mpf(1) / 2)
    onepR = list(R)
    onepR[0] += 1
    lnonepR = ps_log(onepR)
    phi = zeros()
    for i in range(NT):
        phi[i] = -2 * lnz[i] + z2[i] / (4 * x) - R[i] + lnonepR[i]
    return phi


def derive(xval):
    """Return { (j, k): f_{jk}(x) } for j=0..JGEN, k=0..KGEN at scaled x=xval."""
    x = mp.mpf(xval)
    z0 = 2 * mp.sqrt(x * (1 + x))
    phi = phi_series(x, z0)
    if abs(phi[1]) > mp.mpf(10) ** (-mp.mp.dps + 25):
        raise AssertionError('phi\'(z0) != 0: %s' % phi[1])

    # sigma^2 = 2 (phi(z0+v) - phi(z0)); sigma = v * sqrt(sigma^2 / v^2).
    g = zeros()
    for i in range(NT - 2):
        g[i] = 2 * phi[i + 2]
    sg = ps_pow(g, mp.mpf(1) / 2)
    sigma = zeros()
    for i in range(NT - 1):
        sigma[i + 1] = sg[i]

    v = ps_revert(sigma)             # v(sigma)
    dv = ps_deriv(v)                 # dz/dw = dv/dsigma
    zc = list(v)
    zc[0] += z0                      # z(sigma)
    z2 = ps_mul(zc, zc)
    onepz2 = list(z2)
    onepz2[0] += 1
    tc = ps_pow(onepz2, -mp.mpf(1) / 2)        # t = (1+z^2)^(-1/2)
    q14 = ps_pow(onepz2, -mp.mpf(1) / 4)       # (1+z^2)^(-1/4)
    base = ps_mul([c / (2 * x) for c in zc], q14)

    out = {}
    for k in range(KGEN + 1):
        uk = poly_compose(UK_COEF[k], tc)      # u_k(t(sigma))
        fk = ps_mul(ps_mul(base, uk), dv)      # f_k(w) as a series in sigma
        for j in range(JGEN + 1):
            out[(j, k)] = fk[j]
    return out


# --------------------------------------------------------------------------
# Fit each f_{jk} as f_{jk}(u) = u^(j+2k) * D_{jk}(u^2), D of degree j+2k.
# --------------------------------------------------------------------------
SAMPLES = []                          # (xs, u, w=u^2, derive-dict)


def build_samples(n):
    for i in range(n):
        w = mp.mpf(5) / 100 + i * (mp.mpf(90) / 100) / (n - 1)
        u = mp.sqrt(w)
        xs = (1 - w) / (2 * w)
        SAMPLES.append((xs, u, w, derive(xs)))


def fit_fjk(j, k):
    """Return D_{jk} coefficient list (length j+2k+1, polynomial in w=u^2)."""
    deg = j + 2 * k
    m = deg + 1
    A = mp.matrix(m, m)
    rhs = mp.matrix(m, 1)
    for r in range(m):
        xs, u, w, fd = SAMPLES[r]
        upow = u ** deg
        for c in range(m):
            A[r, c] = upow * w ** c
        rhs[r] = fd[(j, k)]
    D = mp.lu_solve(A, rhs)
    # Independent check on the unused samples: confirms the degree/offset model.
    for r in range(m, len(SAMPLES)):
        xs, u, w, fd = SAMPLES[r]
        val = u ** deg * sum(D[c] * w ** c for c in range(m))
        ref = fd[(j, k)]
        rel = abs(val - ref) / (abs(ref) + mp.mpf(10) ** (-90))
        if rel > mp.mpf(10) ** (-45):
            raise AssertionError('fit check failed at (%d,%d): rel=%s' % (j, k, rel))
    return [D[c] for c in range(m)]


# --------------------------------------------------------------------------
# Gates.
# --------------------------------------------------------------------------
# Paper Eq. 90: f_{jk} = u^(j+2k) * D(w), w=u^2. D as exact rationals.
def R(p, q=1):
    return mp.mpf(p) / mp.mpf(q)


EQ90 = {
    (0, 0): [R(1)],
    (0, 1): [R(3, 24), R(0), R(-5, 24)],
    (1, 0): [R(3, 6), R(1, 6)],
    (0, 2): [R(81, 1152), R(0), R(-462, 1152), R(0), R(385, 1152)],
    (1, 1): [R(-9, 144), R(21, 144), R(75, 144), R(-95, 144)],
    (2, 0): [R(-3, 24), R(0), R(5, 24)],
    (0, 3): [R(30375, 414720), R(0), R(-369603, 414720), R(0),
             R(765765, 414720), R(0), R(-425425, 414720)],
    (1, 2): [R(-729, 6912), R(1053, 6912), R(9702, 6912), R(-11550, 6912),
             R(-12705, 6912), R(14245, 6912)],
    (2, 1): [R(27, 576), R(-144, 576), R(-402, 576), R(1440, 576), R(-925, 576)],
    (3, 0): [R(135, 2160), R(-117, 2160), R(-675, 2160), R(625, 2160)],
}


def coeff_err(a, b):
    """Mixed abs/rel error: a true-zero coefficient is compared absolutely."""
    if abs(b) < mp.mpf(10) ** (-30):
        return abs(a - b)
    return abs(a - b) / abs(b)


def gate_a(fjk):
    worst = mp.mpf(0)
    for key, paper in EQ90.items():
        got = fjk[key]
        if len(got) != len(paper):
            raise AssertionError('Gate A degree mismatch at %s' % (key,))
        for a, b in zip(got, paper):
            worst = max(worst, coeff_err(a, b))
    if worst > mp.mpf(10) ** (-40):
        raise AssertionError('Gate A failed: worst err = %s' % worst)
    print('  Gate A  PASS  (Eq. 90 reproduced, worst err = %.2e)' % float(worst))


def gate_b(fjk):
    worst = mp.mpf(0)
    for k in range(KGEN + 1):
        d = fjk[(0, k)]                       # f_{0,k} = u^(2k) D(w)
        uk = UK_COEF[k]                       # u_k(t), powers t^k..t^3k
        # u_k(u^2) = u^(2k) * sum_m uk[m+k] w^m
        for m in range(len(d)):
            ref = uk[m + k] if (m + k) < len(uk) else mp.mpf(0)
            worst = max(worst, coeff_err(d[m], ref))
    if worst > mp.mpf(10) ** (-40):
        raise AssertionError('Gate B failed: worst err = %s' % worst)
    print('  Gate B  PASS  (f_{0,k} = u_k(u^2), worst err = %.2e)' % float(worst))


def half_zeta_sq(xs, ys):
    w = mp.sqrt(1 + 4 * xs * ys)
    return xs + ys - w + mp.log((1 + w) / (2 * ys))


def assemble(fjk, mu, xs, ys, jmax, kmax):
    """Assemble the primary Marcum tail from the f_{jk} table (mirrors _largeMu)."""
    u = 1 / mp.sqrt(2 * xs + 1)
    w = u * u
    hz2 = half_zeta_sq(xs, ys)
    zeta = mp.sign(xs - ys + 1) * mp.sqrt(2 * max(hz2, mp.mpf(0)))
    q_primary = zeta < 0
    eta = zeta if q_primary else -zeta
    sq = mp.sqrt(mu / 2)
    ea2 = mp.e ** (-mu * zeta * zeta / 2)
    psi = [mp.sqrt(mp.pi / (2 * mu)) * mp.erfc(-eta * sq), ea2 / mu]
    for j in range(2, jmax + 1):
        psi.append(((j - 1) * psi[j - 2] + (-eta) ** (j - 1) * ea2) / mu)
    total = mp.mpf(0)
    for j in range(jmax + 1):
        aj = mp.mpf(0)
        for k in range(kmax + 1):
            d = fjk[(j, k)]
            poly = sum(d[m] * w ** m for m in range(len(d)))
            aj += u ** (j + 2 * k) * poly / mu ** k
        sign = 1 if q_primary else (1 if j % 2 == 0 else -1)
        total += sign * aj * psi[j]
    expansion = mp.sqrt(mu / (2 * mp.pi)) * total
    xi2 = 4 * xs * ys
    t = 1 / mp.sqrt(1 + xi2)
    bes = sum(poly_eval(UK_COEF[k], t) / mu ** k for k in range(KGEN + 1))
    scaled = bes / (mp.sqrt(2 * mp.pi * mu) * (1 + xi2) ** mp.mpf('0.25'))
    bigt = ea2 * scaled
    primary = expansion - bigt if q_primary else expansion + bigt
    return ('q' if q_primary else 'p'), primary


def poly_eval(coeffs, t):
    r = mp.mpf(0)
    for c in reversed(coeffs):
        r = r * t + c
    return r


def gate_c(fjk):
    from scipy.stats import ncx2
    # The dispatcher routes the whole open band |y - (x+mu)| < sqrt(4x+2mu)
    # to this branch, so the grid must reach close to both band edges.
    grid = []
    for mu in (135, 140, 160, 300, 1000, 3000):
        for x in (30, 60, 150, 400):
            span = mp.sqrt(4 * x + 2 * mu)
            for frac in (-0.97, -0.6, -0.3, 0.3, 0.6, 0.97):
                y = x + mu + frac * span
                grid.append((mu, x, mp.mpf(x) / mu, mp.mpf(y) / mu, y))

    best = None
    for jmax in range(4, JGEN + 1):
        for kmax in range(2, KGEN + 1):
            worst = mp.mpf(0)
            for mu, x, xs, ys, y in grid:
                tail, val = assemble(fjk, mp.mpf(mu), xs, ys, jmax, kmax)
                if tail == 'q':
                    ref = mp.mpf(repr(float(ncx2.sf(float(2 * y), 2 * mu, 2 * x))))
                else:
                    ref = mp.mpf(repr(float(ncx2.cdf(float(2 * y), 2 * mu, 2 * x))))
                worst = max(worst, abs(val - ref) / abs(ref))
            if worst <= mp.mpf('1e-11'):
                best = (jmax, kmax, worst)
                break
        if best:
            break
    if not best:
        raise AssertionError('Gate C: no (J,K) reached 1e-11 within JGEN/KGEN')
    jmax, kmax, worst = best
    print('  Gate C  PASS  (J=%d, K=%d -> worst rel vs scipy ncx2 = %.2e)'
          % (jmax, kmax, float(worst)))
    return jmax, kmax


# --------------------------------------------------------------------------
# Emit.
# --------------------------------------------------------------------------
def js_num(x):
    # Parity forces some coefficients to be exactly zero; the fit returns them
    # at the ~1e-110 noise floor. Snap those to a clean literal 0.
    if abs(x) < mp.mpf(10) ** (-30):
        return '0'
    return repr(float(x))


def emit(fjk, jmax, kmax):
    import os
    lines = [
        '/* eslint-disable no-loss-of-precision -- generated float64 constants;',
        '   every literal is a shortest round-tripping decimal, but the rule',
        '   toPrecision() heuristic false-positives on some 16-digit values. */',
        '// Generated by scripts/marcum-fjk-generate.py -- do not edit by hand.',
        '//',
        '// Coefficients for the large-mu uniform asymptotic expansion of the',
        '// Marcum Q-function, Section 4.2 / Eq. 90 of Gil, Segura & Temme,',
        '// "Computation of the Marcum Q-function" (arXiv:1311.0681).',
        '',
        '/**',
        ' * Coefficients of the large-mu asymptotic expansion. The expansion term',
        ' * f_{jk}(u) = u^(j+2k) * D_{jk}(u^2); F_JK[j][k] is the coefficient list',
        ' * of the polynomial D_{jk} in u^2. arXiv:1311.0681 Eq. 90 / Section 4.6.2.',
        ' *',
        ' * @memberof ran.special',
        ' * @private',
        ' */',
        'export const F_JK = [',
    ]
    jrows = []
    for j in range(jmax + 1):
        krows = ['    [' + ', '.join(js_num(c) for c in fjk[(j, k)]) + ']'
                 for k in range(kmax + 1)]
        jrows.append('  [\n' + ',\n'.join(krows) + '\n  ]')
    lines.append(',\n'.join(jrows))
    lines += [
        ']',
        '',
        '/**',
        ' * Bessel uniform-asymptotic coefficients u_k(t) (DLMF 10.41,',
        ' * arXiv:1311.0681 Eq. 47), as polynomials in t. Used for the modified-',
        ' * Bessel correction term of the large-mu expansion.',
        ' *',
        ' * @memberof ran.special',
        ' * @private',
        ' */',
        'export const U_K = [',
    ]
    urows = ['  [' + ', '.join(js_num(c) for c in UK_COEF[k]) + ']'
             for k in range(KGEN + 1)]
    lines.append(',\n'.join(urows))
    lines += [']', '']

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        '..', 'src', 'special', '_marcum-coefficients.js')
    with open(path, 'w') as fh:
        fh.write('\n'.join(lines))
    print('  wrote src/special/_marcum-coefficients.js  '
          '(F_JK: j=0..%d, k=0..%d; U_K: k=0..%d)' % (jmax, kmax, KGEN))

    print()
    print('scipy.stats.ncx2 reference values for test/special.js:')
    from scipy.stats import ncx2
    refs = [(135, 40, 170), (135, 44, 188), (150, 60, 205),
            (200, 55, 248), (160, 70, 250), (180, 50, 230)]
    for mu, x, y in refs:
        q = float(ncx2.sf(2 * y, 2 * mu, 2 * x))
        p = float(ncx2.cdf(2 * y, 2 * mu, 2 * x))
        print('  { mu: %d, x: %d, y: %d, p: %r, q: %r },' % (mu, x, y, p, q))


def main():
    print('marcum-fjk-generate.py  (dps=%d, N=%d)' % (mp.mp.dps, N))
    print('  deriving f_{jk} for j=0..%d, k=0..%d ...' % (JGEN, KGEN))
    build_samples(JGEN + 2 * KGEN + 4)
    fjk = {}
    for j in range(JGEN + 1):
        for k in range(KGEN + 1):
            fjk[(j, k)] = fit_fjk(j, k)
    gate_a(fjk)
    gate_b(fjk)
    jmax, kmax = gate_c(fjk)
    emit(fjk, jmax, kmax)


if __name__ == '__main__':
    sys.exit(main())
