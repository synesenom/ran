import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as ran from '../src/index'

describe('index', () => {
  it('exports the mc namespace', () => {
    assert.isDefined(ran.mc)
    assert.isFunction(ran.mc.RWM)
    assert.isFunction(ran.mc.gelmanRubin)
  })
})
