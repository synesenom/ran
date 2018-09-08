const ran = require('../src/ran');

let pareto = new ran.dist.Pareto(1, 2);
let uniform = new ran.dist.UniformContinuous(1, 10);
console.log(pareto.sample(5));
console.log(pareto.pdf(3));
console.log(pareto.cdf(3));
console.log(pareto.survival(3));
console.log(pareto.hazard(3));
console.log(pareto.cHazard(3));
console.log(pareto.lnPdf(3));

let sample1 = pareto.sample(100);
let sample2 = uniform.sample(100);
console.log(pareto.test(sample1));
console.log(pareto.test(sample2));
