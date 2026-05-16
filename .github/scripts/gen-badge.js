#!/usr/bin/env node
'use strict'

const fs = require('fs')
const { makeBadge } = require('badge-maker') // see solutions/tooling/2026-05-16-1220-badge-maker-svg-delegation.md

const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'))
const pct = Math.round(summary.total.lines.pct)

const color = pct >= 90 ? '#4c1' : pct >= 75 ? '#dfb317' : '#e05d44'

const svg = makeBadge({ label: 'coverage', message: `${pct}%`, color })

fs.mkdirSync('img', { recursive: true })
fs.writeFileSync('img/coverage.svg', svg)
console.log(`Coverage badge generated: ${pct}%`)
