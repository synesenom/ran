function collect(samples, hist) {
    Object.entries(samples.reduce(function (h, d) {
        var i = Math.floor(d);
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

var diff = [];
function send(real, estimate, metrics) {
    diff.push(estimate.map(function(d, i) {
        return Math.abs(d.y - real[i].y);
    }).reduce(function(sum, d) {
        return sum + d;
    }, 0) / estimate.reduce(function(sum, d) {
        return sum + d.y;
    }, 0));
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
        m: metrics,
        d: [{name: "diff",
            values: diff.map(function(d, i) {
            return {
                x: i,
                y: d
            };
        })}]
    });
}

self.addEventListener("message", function(event) {
    "use strict";
    importScripts("../../ran.min.js");

    var density = new ran.dist.Weibull(10, 2);
    /*var M = new Array(4).fill(0).map(function(d) {
        return new ran.mc.Metropolis(function(x) {
            return Math.log(density.pdf(x));
        }, 1, {
            x0: [Math.random()*30],
            min: 0
        });
    });
    var SAMPLES = [];
    M.forEach(function(d, i) {
        console.log(i);
        d.burnIn();
        SAMPLES.push(d.sample(null, 1e4));
    });
    postMessage([{
        name: "gr", values: ran.mc.gr(SAMPLES)[0].map(function (d, i) {
            return {
                x: i,
                y: d
            };
        })
    }]);
    return;*/

    var mc = new ran.mc.Metropolis(function(x) {
        return Math.log(density.pdf(x));
    }, 1, {
        x0: [Math.random()],
        min: 0
    });

    console.log("burn in");
    mc.burnIn(null, 100);

    console.log("sampling");
    var BATCH_SIZE = 1e4;
    var xMax = 0;
    var total = 0;
    var hist = {};
    var means = [];
    var std = [];
    var acceptance = [];
    var correlation = [];
    var laps = 100;
    var run = function() {
        var result = mc.sample(null, BATCH_SIZE);
        var stats = mc.stats();
        var acc = mc.acceptance();
        total += result.length;
        xMax = Math.max(xMax, result.reduce(function (max, d) {
            max = Math.max(max, d);
            return max;
        }, 0));
        collect(result, hist);
        means.push(stats.mean[0]);
        std.push(stats.std[0]);
        acceptance.push(acc);
        correlation = mc.ac();
        send(new Array(Math.ceil(xMax+10)).fill(0).map(function (d, i) {
            return {
                x: i - 0.5,
                y: total * density.pdf(i)
            };
        }), Object.entries(hist).map(function (d) {
            return {
                x: +d[0],
                y: d[1]
            };
        }), [{
            name: "correlation",
            values: means.map(function (d, i) {
                return {
                    x: i,
                    y: d
                };
            })
        }]);

        if (laps > 0) {
            setTimeout(run, 100);
            laps--;
        }
    };
    run();

    /*var BATCH_SIZE = 1e4;
    var total = 0;
    var hist = {};
    var xMax = 0;
    var normal = new ran.dist.Weibull(10, 2);
    for (var lap=0; lap<100; lap++) {
        total += BATCH_SIZE;
        Object.entries(normal.sample(BATCH_SIZE).reduce(function (h, d) {
            var i = Math.floor(d);
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
            xMax = Math.max(xMax, d[0]);
        });

    }*/
});