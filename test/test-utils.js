var assert = require('assert');

var test_utils = (function() {
    var CHI_TABLE_LOW = [0, 7.879, 10.597, 12.838, 14.860, 16.750, 18.548, 20.278, 21.955, 23.589, 25.188, 26.757, 28.300,
        29.819, 31.319, 32.801, 34.267, 35.718, 37.156, 38.582, 39.997, 41.401, 42.796, 44.181, 45.559, 46.928, 48.290,
        49.645, 50.993, 52.336, 53.672, 55.003, 56.328, 57.648, 58.964, 60.275, 61.581, 62.883, 64.181, 65.476, 66.766,
        68.053, 69.336, 70.616, 71.893, 73.166, 74.437, 75.704, 76.969, 78.231, 79.490, 80.747, 82.001, 83.253, 84.502,
        85.749, 86.994, 88.236, 89.477, 90.715, 91.952, 93.186, 94.419, 95.649, 96.878, 98.105, 99.330, 100.554, 101.776,
        102.996, 104.215, 105.432, 106.648, 107.862, 109.074, 110.286, 111.495, 112.704, 113.911, 115.117, 116.321,
        117.524, 118.726, 119.927, 121.126, 122.325, 123.522, 124.718, 125.913, 127.106, 128.299, 129.491, 130.681,
        131.871, 133.059, 134.247, 135.433, 136.619, 137.803, 138.987, 140.169, 141.351, 142.532, 143.712, 144.891,
        146.070, 147.247, 148.424, 149.599, 150.774, 151.948, 153.122, 154.294, 155.466, 156.637, 157.808, 158.977,
        160.146, 161.314, 162.481, 163.648, 164.814, 165.980, 167.144, 168.308, 169.471, 170.634, 171.796, 172.957,
        174.118, 175.278, 176.438, 177.597, 178.755, 179.913, 181.070, 182.226, 183.382, 184.538, 185.693, 186.847,
        188.001, 189.154, 190.306, 191.458, 192.610, 193.761, 194.912, 196.062, 197.211, 198.360, 199.509, 200.657,
        201.804, 202.951, 204.098, 205.244, 206.390, 207.535, 208.680, 209.824, 210.968, 212.111, 213.254, 214.396,
        215.539, 216.680, 217.821, 218.962, 220.102, 221.242, 222.382, 223.521, 224.660, 225.798, 226.936, 228.074,
        229.211, 230.347, 231.484, 232.620, 233.755, 234.891, 236.026, 237.160, 238.294, 239.428, 240.561, 241.694,
        242.827, 243.959, 245.091, 246.223, 247.354, 248.485, 249.616, 250.746, 251.876, 253.006, 254.135, 255.264,
        256.393, 257.521, 258.649, 259.777, 260.904, 262.031, 263.158, 264.285, 265.411, 266.537, 267.662, 268.788,
        269.912, 271.037, 272.162, 273.286, 274.409, 275.533, 276.656, 277.779, 278.902, 280.024, 281.146, 282.268,
        283.390, 284.511, 285.632, 286.753, 287.874, 288.994, 290.114, 291.234, 292.353, 293.472, 294.591, 295.710,
        296.828, 297.947, 299.065, 300.182, 301.300, 302.417, 303.534, 304.651, 305.767, 306.883, 307.999, 309.115,
        310.231, 311.346];
    var CHI_TABLE_HIGH = [366.844, 421.900, 476.606, 531.026, 585.207, 639.183, 692.982, 746.625, 800.131, 853.514, 906.786,
        959.957, 1013.036, 1066.031, 1118.948];

    var param = {
        degree: function() {
            return parseInt(Math.random() * 4 + 1);
        },
        prob: function() {
            return Math.random();
        },
        scale: function() {
            return Math.random() * 5 + 0.1;
        },
        rate: function() {
            return Math.random() * 5 + 0.1;
        },
        shape: function() {
            return Math.random() * 5 + 0.1;
        }
    };

    /**
     * Performs a Kolmogorov-Smirnov test with significance level of 99%.
     *
     * @param values Sample of continuous random values.
     * @param model Theoretical cumulative distribution function.
     */
    function ks_test(values, model) {
        var D = 0;
        values.sort(function (a, b) {
            return a - b;
        });
        for (var i = 0; i < values.length; i++) {
            D = Math.max(D, Math.abs((i + 1) / values.length - model(values[i])));
        }
        return D <= 1.628 / Math.sqrt(values.length);
    }

    /**
     * Performs a chi-square test with significance level of 99%.
     *
     * @param values Sample of discrete random values.
     * @param model Theoretical cumulative mass function.
     * @param c Number of model parameters.
     */
    function chi_test(values, model, c) {
        // Calculate distribution first
        var p = {};
        for (var i = 0; i < values.length; i++) {
            if (!p[values[i]])
                p[values[i]] = 0;
            p[values[i]]++;
        }

        // Calculate chi-square
        var chi2 = 0;
        for (var x in p) {
            var m = model(parseInt(x)) * values.length;
            chi2 += Math.pow(p[x] - m, 2) / m;
        }

        // Find critical value
        var df = Math.max(1, Object.keys(p).length - c - 1);
        var crit = df <= 250 ? CHI_TABLE_LOW[df] : CHI_TABLE_HIGH[Math.floor(df / 50)];
        return chi2 <= crit;
    }

    /**
     * Performs 10 tests and checks if at least 6 was successful.
     *
     * @param test Test to run.
     * @param complete Whether all trials should succeed.
     */
    function trials(test, complete) {
        var success = 0;
        for (var t = 0; t < 10; t++) {
            success += test() ? 1 : 0;
        }
        assert.equal(success >= (complete ? 10 : 6), true);
    }

    function diff_disc(pmf, cdf, a, b) {
        var dy = 0;
        var int = 0;
        for (var x=a; x<b; x++) {
            int += pmf(x);
            dy += Math.abs(cdf(x) - int);
        }
        return dy;
    }

    function simpson(func, a, b, n) {
        var h = (b - a) / n;
        var s = func(a) + func(b);
        for (var i=1; i<n; i+=2) {
            s += 4 * func(a + i * h);
        }
        for (i=2; i<n-1; i+=2) {
            s += 2 * func(a + i * h);
        }
        return s * h / 3;
    }

    function diff_cont(pdf, cdf, a, b, dx) {
        var n = 0;
        var dy = 0;
        var int = 0;
        for (var x=a; x<b-dx; x+=dx) {
            int += simpson(pdf, x, x+dx, 100);
            dy += Math.abs(cdf(x+dx) - int);
            n++;
            //console.log(cdf(x+dx), int);
        }
        //console.log(dy/n);
        return dy/n;
    }

    return {
        param: param,
        ks_test: ks_test,
        chi_test: chi_test,
        trials: trials,
        diff_disc: diff_disc,
        diff_cont: diff_cont
    };
})();

// Export if we have module
if (typeof module !== "undefined" && typeof module.exports === "object")
    module.exports.test_utils = test_utils;