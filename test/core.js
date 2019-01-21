import assert from 'assert';
import { describe, it } from 'mocha';
import utils from './test-utils';
import core from '../src/core';

const TRIALS = 1;
const LAPS = 100;

function add(dist, value) {
    if (!dist.hasOwnProperty(value))
        dist[value] = 1;
    else
        dist[value]++;
}

describe('core', () => {
    describe('.float()', () => {
        it('should return a float uniformly distributed in [0, 1]', () => {
            utils.trials(() => {
                const values = Array.from({length: LAPS}, () => core.float());
                return utils.ks_test(values, function (x) {
                    return x;
                });
            });
        });

        it('should return a float uniformly distributed in [min, max]', () => {
            utils.trials(() => {
                const max = Math.random() * 200;
                const values = Array.from({length: LAPS}, () => core.float(max));
                return utils.ks_test(values, function (x) {
                    return x / max;
                });
            });
        });

        it('should return multiple floats uniformly distributed in [min, max]', () => {
            utils.trials(() => {
                const min = Math.random() * 200 - 100;
                const max = Math.random() * 200 - 100;
                const k = Math.floor(Math.random() * 40 - 20);
                const values = [];
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.float(min, max, k);
                    if (k < 2)
                        r = [r];
                    r.forEach(function (ri) {
                        values.push(ri);
                        // Value is in range
                        assert.equal(true, (min < max ? min : max) <= ri && ri <= (min < max ? max : min));
                    });
                    // Length is correct
                    assert.equal(k < 2 ? 1 : k, r.length);
                }

                // Distribution is uniform
                if (min < max) {
                    return utils.ks_test(values, function (x) {
                        return (x - min) / (max - min);
                    });
                } else {
                    return utils.ks_test(values, function (x) {
                        return (x - max) / (min - max);
                    });
                }
            });
        });
    });

    describe('.int()', () => {
        it('should return an integer uniformly distributed in [0, max]', () => {
            utils.trials(() => {
                const max = Math.floor(Math.random() * 100);
                const values = Array.from({length: LAPS}, () => core.int(max));
                return utils.chi_test(values, function () {
                    return 1 / Math.abs(max + 1);
                }, 1);
            });
        });

        it('should return an integer uniformly distributed in [min, max]', () => {
            utils.trials(() => {
                const min = Math.floor(Math.random() * 200 - 100);
                const max = Math.floor(Math.random() * 200 - 100);
                const values = [];
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.int(min, max);
                    values.push(r);

                    // Value is in range
                    assert.equal(true, (min < max ? min : max) <= r && r <= (min < max ? max : min));

                    // Value is integer
                    assert.equal(r, parseInt(r, 10));
                }

                // Distribution is uniform
                return utils.chi_test(values, () => {
                    return 1 / Math.abs(max - min + 1);
                }, 1);
            });
        });

        it('should return multiple integers uniformly distributed in [0, max]', () => {
            utils.trials(() => {
                const min = Math.floor(Math.random() * 200 - 100);
                const max = Math.floor(Math.random() * 200 - 100);
                const k = Math.floor(Math.random() * 20 - 10);
                const values = [];
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.int(min, max, k);
                    if (k < 2)
                        r = [r];
                    for (let i = 0; i < r.length; i++) {
                        values.push(r[i]);

                        // Value is in range
                        assert.equal(true, (min < max ? min : max) <= r[i] && r[i] <= (min < max ? max : min));
                    }
                    // Length is correct
                    assert.equal(k < 2 ? 1 : k, r.length);
                }

                // Distribution is uniform
                return utils.chi_test(values, () => {
                    return 1 / Math.abs(max - min + 1);
                }, 1);
            });
        });
    });

    describe('.choice()', () => {
        it('should return a single null (no arguments)', () => {
            assert.equal(core.choice(), null);
        });

        it('should return a single null (null as argument)', () => {
            assert.equal(core.choice(null), null);
        });

        it('should return a single null (empty array as argument)', () => {
            assert.equal(core.choice([]), null);
        });

        it('should return multiple items distributed uniformly', () => {
            for (let trial = 0; trial < TRIALS; trial++) {
                const values = ['a', 'b', 'c'];
                const freqs = {};
                const k = Math.floor(Math.random() * 200 - 100);
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.choice(values, k);
                    if (k < 2)
                        r = [r];
                    r.forEach(function (ri) {
                        add(freqs, ri);
                        // Value is in array
                        assert.equal(values.indexOf(ri) > -1, true);
                    });
                    // Length is correct
                    assert.equal(k < 2 ? 1 : k, r.length);
                }
                for (let i in values) {
                    // Distribution is uniform
                    if (values.hasOwnProperty(i)) {
                        assert.equal(true, freqs[values[i]] > 0);
                    }
                }
                for (let i in freqs) {
                    assert.equal(values.indexOf(i) > -1, true)
                }
            }
        });
    });

    describe('.char()', () => {
        it('should return a single null (no arguments)', () => {
            assert.equal(core.char(), null);
        });

        it('should return a single null (null as argument)', () => {
            assert.equal(core.char(null), null);
        });

        it('should return a single null (empty string as argument)', () => {
            assert.equal(core.char(''), null);
        });

        it('should return multiple characters distributed uniformly', () => {
            for (let trial = 0; trial < TRIALS; trial++) {
                const string = "abcdefghijkl51313#^!#?><;!-_=+.,/:{}()";
                const k = Math.floor(Math.random() * 200 - 100);
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.char(string, k);
                    if (k < 2)
                        r = [r];
                    r.forEach(function (ri) {
                        // Character is in array
                        assert.equal(true, string.indexOf(ri) > -1);
                    });
                    // Length is correct
                    assert.equal(k < 2 ? 1 : k, r.length);
                }
            }
        });
    });

    describe('.shuffle()', () => {
        it('should swap all elements at least once', () => {
            for (let trial = 0; trial < TRIALS; trial++) {
                const values = [];
                const pos = [];
                for (let i = 0; i < 10; i++) {
                    values.push(i);
                    pos.push({});
                }

                for (let lap = 0; lap < LAPS; lap++) {
                    core.shuffle(values);
                    values.forEach(function (v, i) {
                        add(pos[v], i);
                    });
                }

                // Check if all positions have been visited at least once
                pos.forEach(function (p) {
                    for (let i in p)
                        if (p.hasOwnProperty(i)) {
                            assert.equal(true, p[i] > 0);
                        }
                });
            }
        });
    });

    describe('.coin()', () => {
        it('should return head or tail with 50% chance', () => {
            utils.trials(() => {
                const head = parseInt(Math.random() * 20);
                const tail = parseInt(Math.random() * 20);
                const values = [];
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.coin(head, tail);
                    r = [r];
                    r.forEach(function (ri) {
                        values.push(ri);
                    });
                }

                // Distribution is uniform
                return utils.chi_test(values, () => {
                    return 0.5;
                }, 1);
            });
        });

        it('should return multiple heads/tails with specific probability', () => {
            utils.trials(() => {
                const p = Math.random();
                const k = Math.floor(Math.random() * 10);
                const head = parseInt(Math.random() * 20);
                const tail = parseInt(Math.random() * 20);
                const values = [];
                for (let lap = 0; lap < LAPS; lap++) {
                    let r = core.coin(head, tail, p, k);
                    if (k < 2)
                        r = [r];
                    r.forEach(function (ri) {
                        values.push(ri);
                    });
                }

                // Distribution is uniform
                return utils.chi_test(values, function (x) {
                    return x === head ? p : 1 - p;
                }, 1);
            });
        });
    });
});
