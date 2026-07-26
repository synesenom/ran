// Regenerates versions.json for the gh-pages docs site: scans the deployed
// site directory for vX.Y.Z release directories and writes a manifest the
// client-side version switcher (docs/assets/version-switcher.js) fetches at
// page-load. Run by .github/workflows/docs-deploy.yml after each deploy.
// See decisions/0043-versioned-docs-deployment.md.
const fs = require('fs')
const path = require('path')

const VERSION_DIR_RE = /^v(\d+)\.(\d+)\.(\d+)$/

function compareVersionsDescending (a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pb[i] - pa[i]
    }
  }
  return 0
}

function main () {
  const siteDir = process.argv[2]
  if (!siteDir) {
    throw new Error('Usage: node build-docs-versions-manifest.js <siteDir>')
  }

  const versions = fs.readdirSync(siteDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => VERSION_DIR_RE.exec(entry.name))
    .filter(Boolean)
    .map(match => match[0].slice(1))
    .sort(compareVersionsDescending)

  if (versions.length === 0) {
    throw new Error(`No vX.Y.Z directories found under ${siteDir} — refusing to write an empty manifest.`)
  }

  const manifest = {
    latest: versions[0],
    versions
  }
  fs.writeFileSync(path.join(siteDir, 'versions.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`versions.json: latest=${manifest.latest}, ${versions.length} version(s)`)
}

main()
