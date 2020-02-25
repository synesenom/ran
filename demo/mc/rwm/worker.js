importScripts('../../../dist/ranjs.min.js', '../../d3.v4.min.js');

const pdf = x => Math.pow(Math.sin(x), 2) * Math.exp(x / 10) + 0.1;

self.addEventListener('message', () => {
  // Build MC sampler
  const rwm = new ranjs.mc.RWM(x => Math.log(pdf(x)));

  // Warm-up sampler
  rwm.warmUp(i => postMessage({type: 'warmUp', i}));

  // Sample
  const samples = rwm.sample().flat();
  postMessage({type: 'sample', samples});
});
