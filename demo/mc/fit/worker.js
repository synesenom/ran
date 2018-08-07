function beta(data, model) {
    return data.length /
        data.reduce((sum, d) => {
            return sum + Math.pow(d.y - model(d.x), 2);
        }, 0);
}

self.addEventListener("message", function(event) {
    "use strict";
    importScripts("../../../ran.min.js", "../../d3.v4.min.js");

    // Generate data
    const DATA_SIZE = 1e4;
    const RESOLUTION = 10;
    const SAMPLE_SIZE = 1e3;
    const SCALE = 44125;
    const model = event.data.model;
    const g = new ran.dist[model](... event.data.params);
    const dataSamples = g.sample(DATA_SIZE);
    const data = Object.entries(dataSamples
        .reduce((h, d) => {
            let i = Math.floor(10 * d) / 10;
            if (!h[i]) {
                h[i] = 1;
            } else {
                h[i]++;
            }
            return h;
        }, {}))
        .map(d => ({x: +d[0], y: SCALE*RESOLUTION * d[1] / DATA_SIZE}))
        .sort((a, b) => a.x - b.x);
    postMessage({type: "generate", res: data});

    // Create model
    const deviation = beta(data, x => SCALE*g.pdf(x));
    const likelihood = function (p) {
        const m = new ran.dist[model](... p.map((d, i) => d * event.data.params[i]));
        return -0.5 * deviation * data.reduce((sum, d) => {
            return sum + Math.pow(d.y - SCALE*m.pdf(d.x), 2)
        }, 0);
    };
    const mc = new ran.mc.Metropolis(likelihood, {
        dim: event.data.params.length,
        min: [0]
    });

    // Burn-in
    mc.burnIn((i, a) => {
        console.log(a);
        postMessage({type: "burn-in", res: 100*i});
    }, 100);
    console.log(mc.state());
    console.log(mc.ac());
    return;

    // Sample
    let samples = mc.sample(SAMPLE_SIZE, i => {
        postMessage({type: "sampling", res: i});
    });
    let modelSamples = samples.map((d) => new ran.dist[model](...d.map((dd, i) => dd * event.data.params[i])));
    let curve = new Array(1000)
        .fill(0)
        .map((d, i) => {
            let y = modelSamples.map(p => {
                return SCALE*p.pdf(i / 100);
            }).sort((a, b) => a - b);
            let m = d3.mean(y);
            let lo = d3.quantile(y, 0.01);
            let hi = d3.quantile(y, 0.99);
            return {
                x: i / 100,
                y: m,
                lo: m - lo,
                hi: hi - m
            };
        });
    postMessage({type: "fit", res: curve});
});