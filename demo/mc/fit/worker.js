function beta(data, model) {
    return data.length /
        data.reduce((sum, d) => {
            return sum + Math.pow(d.y - model(d.x), 2);
        }, 0);
}

self.addEventListener("message", function(event) {
    "use strict";
    importScripts("../../../dist/ranjs.min.js", "../../d3.v4.min.js");

    // Generate data
    const DATA_SIZE = 1e4;
    const RESOLUTION = 10;
    const SAMPLE_SIZE = 1e4;
    const SCALE = 44125;
    const model = event.data.model;
    const g = new ranjs.dist[model](... event.data.params);
    const dataSamples = g.sample(DATA_SIZE)
        .filter(d => d > 2 && d < 7);
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
        .map(d => ({x: +d[0], y: SCALE * RESOLUTION * d[1] / DATA_SIZE}))
        .sort((a, b) => a.x - b.x);
    postMessage({type: "generate", res: data});

    // Create model
    const deviation = beta(data, x => SCALE * g.pdf(x));
    /*const likelihood = p => {
        const m = new ranjs.dist[model](... p);
        return -0.5 * deviation * data.reduce((sum, d) => {
            return sum + Math.pow(d.y - SCALE * m.pdf(d.x), 2)
        }, 0);
    };*/
    const likelihood = p => {
        const m = new ranjs.dist[model](... p);
        return m.lnL(dataSamples);
    };
    const rwm = new ranjs.mc.RWM(likelihood, {
        dim: event.data.params.length
    }, {
        x: event.data.params
    });

    // Warm-up
    rwm.warmUp(i => postMessage({type: "warm-up", res: i}), 100);

    // Sample
    let samples = rwm.sample(i => postMessage({type: "sampling", res: i}), SAMPLE_SIZE);

    let modelSamples = samples.map((d) => new ran.dist[model](...d));
    let curve = new Array(1000)
        .fill(0)
        .map((d, i) => {
            let y = modelSamples.map(p => {
                return SCALE*p.pdf(i / 100);
            }).sort((a, b) => a - b);
            let m = d3.mean(y);
            let lo = d3.quantile(y, 0.001);
            let hi = d3.quantile(y, 0.999);
            return {
                x: i / 100,
                y: m,
                lo: m - lo,
                hi: hi - m
            };
        });
    postMessage({type: "fit", res: curve});
});