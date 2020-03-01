import { float, int } from '../src/core'

const Param = {
  rangeMin () {
    return float(-10, 10)
  },

  rangeIn () {
    return float(10, 20)
  },

  rangeMax () {
    return float(20, 30)
  },

  shape () {
    return float(0.1, 5)
  },

  location () {
    return float(-5, 5)
  },

  scale () {
    return float(0.1, 5)
  },

  prob () {
    return float(0.01, 0.99)
  },

  count () {
    return int(3, 20)
  },

  degree () {
    return int(1, 10)
  },

  rate () {
    return float(0.1, 10)
  }
}

export default [{
  name: 'Alpha',
  invalidParams: [
    [-1, 1], [0, 1],  // alpha > 0
    [1, -1], [1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Pareto',
    params: () => [Param.scale(), Param.shape()]
  },
  cases: [{
    params: () => [Param.shape(), Param.scale()],
  }]
}, {
  name: 'Anglit',
  invalidParams: [
    [0, -1], [0, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Arcsine',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale()]
  }]
}, {
  name: 'Arcsine',
  invalidParams: [
    [1, 1], [2, 1]  // a < b
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rangeMin(), Param.rangeMax()]
  }]
}]
