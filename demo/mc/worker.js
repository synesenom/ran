function collect(samples, hist) {
    Object.entries(samples.reduce(function (h, d) {
        var i = Math.floor(d[0]);
        if (!h.hasOwnProperty(i)) {
            h[i] = 1;
        } else {
            h[i]++;
        }
        return h;
    }, {})).forEach(function (d) {
        if (!hist.hasOwnProperty(d[0])) {
            hist[d[0]] = d[1];
        } else {
            hist[d[0]] += d[1];
        }
    });
}

function send(real, estimate) {
    // Update relative difference
    if (!this.diff) {
        this.diff = [];
    }
    this.diff.push(estimate.map(function (d, i) {
        return real[i] ? Math.abs(d.y - real[i].y) : 0;
    }).reduce(function (sum, d) {
        return sum + d;
    }, 0));

    // Send real distribution, estimate and the difference
    postMessage({
        p: [
            {
                name: "real",
                values: real
            },
            {
                name: "estimate",
                values: estimate
            }
        ],
        d: [
            {
                name: "diff",
                values: this.diff.map(function (d, i) {
                    return {
                        x: Math.log(i+1),
                        y: Math.log(d)
                    };
                })
            }
        ]
    });
}

self.addEventListener("message", function(event) {
    "use strict";
    importScripts("../../ran.min.js");

    // Use a bimodal density with long tails
    var alpha = 0.3;
    var density = function(x) {
        return alpha * new ran.dist.Weibull(10, 2).pdf(x) + (1 - alpha) * new ran.dist.Normal(60, 20).pdf(x);
    };

    var mc = new ran.mc.Slice(function(x) {
        return Math.log(density(x));
    }, {
        min: [0]
    });

    mc.burnIn();
    var BATCH_SIZE = 1e2;
    var xMax = 0;
    var total = 0;
    var hist = {};
    var laps = 200;
    var run = function() {
        var result = mc.sample(BATCH_SIZE);
        total += result.length;
        xMax = Math.max(xMax, result.reduce(function (max, d) {
            max = Math.max(max, d);
            return max;
        }, 0));
        collect(result, hist, total);
        send(new Array(Math.ceil(xMax+10)).fill(0).map(function (d, i) {
            return {
                x: i - 0.5,
                y: density(i)
            };
        }), Object.entries(hist).map(function (d) {
            return {
                x: +d[0],
                y: d[1] / total
            };
        }));

        if (laps > 0) {
            setTimeout(run, 20);
            laps--;
        }
    };
    run();
});