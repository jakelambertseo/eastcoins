param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path $RepoPath).Path
$multiviewPath = Join-Path $repo 'multiview.html'
$shareJsPath = Join-Path $repo 'assets\eastcoins-multiview-share.js'
$changelogPath = Join-Path $repo 'changelog.html'

foreach ($path in @($multiviewPath, $shareJsPath, $changelogPath)) {
  if (-not (Test-Path $path)) {
    throw "Required EastCoin file not found: $path"
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Verify the compact share implementation is installed before cache-busting it.
$shareJs = [System.IO.File]::ReadAllText($shareJsPath)
if ($shareJs -notmatch 'const\s+SHARE_PARAM\s*=\s*["'']m["'']') {
  throw 'The compact MultiView share implementation is not installed yet. Install the Short MultiView Links update first.'
}

# Force browsers/CDN to request the new compact share module instead of a cached share1 copy.
$multiview = [System.IO.File]::ReadAllText($multiviewPath)
$updatedMultiview = [regex]::Replace(
  $multiview,
  'assets/eastcoins-multiview-share\.js\?v=share\d+',
  'assets/eastcoins-multiview-share.js?v=share2'
)

if ($updatedMultiview -eq $multiview -and $multiview -notmatch 'eastcoins-multiview-share\.js\?v=share2') {
  throw 'Could not find the MultiView share script tag to update.'
}

[System.IO.File]::WriteAllText($multiviewPath, $updatedMultiview, $utf8NoBom)

# Add a changelog entry once. Keep this as a hotfix entry rather than altering the prior feature text.
$changelog = [System.IO.File]::ReadAllText($changelogPath)
$entryTitle = 'Short MultiView links cache fix'

if ($changelog -notmatch [regex]::Escape($entryTitle)) {
  # Remove the prior Latest marker so only this entry is marked Latest.
  $changelog = $changelog -replace 'timeline-entry latest', 'timeline-entry'
  $changelog = $changelog -replace '<span class="latest-badge">Latest</span>', ''

  $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date"><time datetime="2026-08-13">August 13, 2026</time><span class="latest-badge">Latest</span></div>
<h2>Short MultiView links cache fix</h2>
<p>Updated MultiView to cache-bust the compact sharing module so browsers load the new short <code>?m=</code> link format instead of reusing the older cached <code>?mv=</code> generator. Existing long MultiView links remain supported for backward compatibility.</p>
</article>
'@

  $timelineClose = $changelog.LastIndexOf('</section>')
  if ($timelineClose -lt 0) {
    throw 'Could not locate the changelog timeline closing section.'
  }

  $changelog = $changelog.Insert($timelineClose, $entry + "`r`n")

  $changelog = [regex]::Replace(
    $changelog,
    '(?<count>\d+) major update groups',
    {
      param($m)
      ([int]$m.Groups['count'].Value + 1).ToString() + ' major update groups'
    },
    1
  )

  [System.IO.File]::WriteAllText($changelogPath, $changelog, $utf8NoBom)
}

Write-Host ''
Write-Host 'EastCoin MultiView short-link cache fix installed.' -ForegroundColor Green
Write-Host 'Updated: multiview.html -> eastcoins-multiview-share.js?v=share2'
Write-Host 'Verified: compact ?m= share implementation is present.'
Write-Host 'Updated: changelog.html'
Write-Host ''
Write-Host 'After deployment, a new Share link should begin with:' -ForegroundColor Cyan
Write-Host 'https://eastcoin.vip/multiview.html?m='
