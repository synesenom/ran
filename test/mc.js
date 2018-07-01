var assert = require('assert');
var utils = require('../test/test-utils').test_utils;
var dist = require('../src/ran').dist;
var mc = require('../src/ran').mc;

describe('ran', function() {
   describe('mc', function() {
       describe('Metropolis', function() {
           describe('burnIn', function() {
               it('should stop at an acceptance rate of 50%', function() {
                   var m = new mc.Metropolis(new dist.Weibull(5, 2).pdf, 1);
                   var s = m.burnIn(null, 1e3);
                   assert.equal(s.result, 0.5);
                   assert.equal(s.iterations < 1e3, true);
               });
               it('should stop at the given number of batches', function() {
                   var m = new mc.Metropolis(new dist.Weibull(5, 2).pdf, 1);
                   var s = m.burnIn(null, 3);
                   assert.notEqual(s.result, 0.5);
                   assert.equal(s.iterations, 3);
               });
           });
       });
   });
});