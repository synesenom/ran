/* eslint-env browser */
// Populates the version dropdown and channel banner from the deployed
// versions.json manifest. Fetched from a fixed base URL (rather than a path
// computed from location.pathname) so the identical built HTML works
// whether it lives at the site root (latest-release mirror), under
// /vX.Y.Z/, or under /unreleased/ — see decisions/0043-versioned-docs-deployment.md.
;(function () {
  const BASE_URL = 'https://synesenom.github.io/ran/'

  function currentChannel () {
    return document.documentElement.getAttribute('data-ranjs-channel') || 'unreleased'
  }

  function currentPage () {
    return window.location.pathname.split('/').pop() || 'index.html'
  }

  function pathFor (channel) {
    return channel === 'unreleased' ? 'unreleased' : 'v' + channel
  }

  function renderBanner (manifest, channel) {
    const banner = document.getElementById('ranjs-version-banner')
    if (!banner) {
      return
    }
    if (channel === 'unreleased') {
      banner.innerHTML = 'You are viewing documentation for <strong>unreleased</strong> development work — it may change before release. ' +
        '<a href="' + BASE_URL + '">View the latest release</a>.'
      banner.hidden = false
    } else if (manifest.latest && channel !== manifest.latest) {
      banner.innerHTML = 'You are viewing documentation for an older release (<strong>v' + channel + '</strong>). ' +
        '<a href="' + BASE_URL + '">View the latest release (v' + manifest.latest + ')</a>.'
      banner.hidden = false
    } else {
      return
    }
    // The top bar and scrolling content read this to shift down by exactly
    // the rendered banner height (it wraps to two lines on narrow viewports).
    document.documentElement.style.setProperty('--ranjs-banner-height', banner.offsetHeight + 'px')
  }

  // A native <select> sizes itself to its widest <option> (e.g. "unreleased"),
  // not the selected one, so a short selection like "v1.31.0" leaves visible
  // slack. Measure the selected option's own text and set an explicit width.
  function sizeToSelectedOption (select) {
    const selected = select.options[select.selectedIndex]
    if (!selected) {
      return
    }
    const style = window.getComputedStyle(select)
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.whiteSpace = 'pre'
    probe.style.font = style.font
    probe.textContent = selected.text
    document.body.appendChild(probe)
    const textWidth = probe.getBoundingClientRect().width
    probe.remove()
    const horizontalChrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    select.style.width = Math.ceil(textWidth + horizontalChrome) + 'px'
  }

  function renderSelect (manifest, channel, page) {
    const select = document.getElementById('ranjs-version-select')
    if (!select) {
      return
    }
    const entries = manifest.versions.map(function (v) {
      return { value: v, label: 'v' + v }
    })
    entries.push({ value: 'unreleased', label: 'unreleased' })
    select.innerHTML = entries.map(function (entry) {
      const selected = entry.value === channel ? ' selected' : ''
      return '<option value="' + entry.value + '"' + selected + '>' + entry.label + '</option>'
    }).join('')
    sizeToSelectedOption(select)
    select.addEventListener('change', function () {
      window.location.href = BASE_URL + pathFor(select.value) + '/' + page
    })
  }

  const channel = currentChannel()
  const page = currentPage()

  fetch(BASE_URL + 'versions.json')
    .then(function (res) {
      if (!res.ok) {
        throw new Error('versions.json request failed: ' + res.status)
      }
      return res.json()
    })
    .then(function (manifest) {
      renderSelect(manifest, channel, page)
      renderBanner(manifest, channel)
    })
    .catch(function (err) {
      // Best-effort widget: a missing/unreachable manifest (e.g. a local
      // `npm run docs` build with no network) must never block the rest of
      // the page from rendering.
      console.warn('[ranjs docs] version switcher unavailable:', err)
    })
})()
