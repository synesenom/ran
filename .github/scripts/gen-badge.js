#!/usr/bin/env node
'use strict'

const fs = require('fs')

const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'))
const pct = Math.round(summary.total.lines.pct)

const color = pct >= 90 ? '#4C1' : pct >= 75 ? '#dfb317' : '#e05d44'

const label = 'coverage'
const value = `${pct}%`

// Label width is fixed for "coverage" (8 chars at ~8px + padding matches anybadge output)
const labelWidth = 65
const valueWidth = value.length * 8 + 9
const totalWidth = labelWidth + valueWidth
const labelMid = Math.round(labelWidth / 2)
const valueMid = labelWidth + Math.round(valueWidth / 2)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
    <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <mask id="anybadge_1">
        <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
    </mask>
    <g mask="url(#anybadge_1)">
        <path fill="#555" d="M0 0h${labelWidth}v20H0z"/>
        <path fill="${color}" d="M${labelWidth} 0h${valueWidth}v20H${labelWidth}z"/>
        <path fill="url(#b)" d="M0 0h${totalWidth}v20H0z"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="${labelMid + 1}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
        <text x="${labelMid}" y="14">${label}</text>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="${valueMid + 1}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
        <text x="${valueMid}" y="14">${value}</text>
    </g>
</svg>
`

fs.mkdirSync('img', { recursive: true })
fs.writeFileSync('img/coverage.svg', svg)
console.log(`Coverage badge generated: ${pct}%`)
