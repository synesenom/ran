// let Slice = (function(logDensity, config) {
//   let _min = config && typeof config.min !== 'undefined' ? config.min : null,
//     _max = config && typeof config.max !== 'undefined' ? config.max : null,
//     _x = Math.random(),
//     _e = new Exponential(1);
//
//   function _boundary (x) {
//     return (!_min || x >= _min[0]) && (!_max || x >= _max[0]);
//   }
//
//   function _accept (x, z, l, r) {
//     let L = l,
//       R = r,
//       D = false;
//
//     while (R - L > 1.1) {
//       let M = (L + R) / 2;
//       D = (_x < M && x >= M) || (_x >= M && x < M);
//
//       if (x < M) {
//         R = M;
//       } else {
//         L = M;
//       }
//
//       if (D && z >= logDensity(L) && z >= logDensity(R)) {
//         return false;
//       }
//     }
//
//     return true;
//   }
//
//   function _iterate () {
//     // Pick slice height
//     let z = logDensity(_x) - _e.sample(),
//       L = _x - Math.random(),
//       R = L + 1;
//
//     // Find slice interval
//     while ((z < logDensity(L) || z < logDensity(R))) {
//       if (Math.random() < 0.5) {
//         L -= R - L;
//       } else {
//         R += R - L;
//       }
//     }
//
//     // Shrink interval
//     let x = r(L, R);
//     while (!_boundary(x) || z > logDensity(x) || !_accept(x, z, L, R)) {
//       if (x < _x) {
//         L = x;
//       } else {
//         R = x;
//       }
//       x = r(L, R);
//     }
//
//     // Update and return sample
//     _x = x;
//     return _x;
//   }
//
//   // Placeholder
//   function burnIn () {
//     return null;
//   }
//
//   function sample (size) {
//     return new Array(size || 1e6).fill(0).map(function () {
//       return [_iterate()];
//     });
//   }
//
//   // Public methods
//   return {
//     burnIn: burnIn,
//     sample: sample
//   };
// });
