param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoPath = (Resolve-Path $RepoPath).Path

$assetSource = Join-Path $PackageRoot "assets\eastcoins-multiview-share.js"
$assetDestination = Join-Path $RepoPath "assets\eastcoins-multiview-share.js"
$multiviewPath = Join-Path $RepoPath "multiview.html"
$changelogPath = Join-Path $RepoPath "changelog.html"

if (!(Test-Path $assetSource)) { throw "Missing package asset: $assetSource" }
if (!(Test-Path $multiviewPath)) { throw "Could not find multiview.html in $RepoPath" }
if (!(Test-Path $changelogPath)) { throw "Could not find changelog.html in $RepoPath" }

Copy-Item $assetSource $assetDestination -Force

$multiview = Get-Content $multiviewPath -Raw
$updatedMultiview = [regex]::Replace(
  $multiview,
  'assets/eastcoins-multiview-share\.js\?v=share\d+',
  'assets/eastcoins-multiview-share.js?v=share2'
)

if ($updatedMultiview -eq $multiview -and $multiview -notmatch 'eastcoins-multiview-share\.js') {
  throw "Could not find the MultiView share script reference in multiview.html"
}

Set-Content -Path $multiviewPath -Value $updatedMultiview -Encoding UTF8

$changelog = Get-Content $changelogPath -Raw
$entryTitle = "MultiView share links shortened"

if ($changelog -notmatch [regex]::Escape($entryTitle)) {
  # Move the Latest marker to this new production update.
  $changelog = $changelog -replace '<article class="timeline-entry latest">', '<article class="timeline-entry">'
  $changelog = $changelog -replace '<span class="latest-badge">Latest</span>', ''

  $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-13">August 13, 2026</time><span class="latest-badge">Latest</span>
</div>
<h2>MultiView share links shortened</h2>
<p>Reworked MultiView sharing to use a compact event-ID format instead of embedding event titles and metadata in every URL. Normal event-only links are substantially shorter while still preserving the selected two-, three-, or four-panel layout and panel sizing. Existing long <code>?mv=</code> links remain supported for backward compatibility, and manual pasted URLs continue to share safely when used in a panel.</p>
</article>
'@

  $timelineMarker = '<section aria-label="EastCoin feature timeline" class="timeline">'
  $timelineStart = $changelog.IndexOf($timelineMarker)
  if ($timelineStart -lt 0) {
    throw "Could not find the EastCoin changelog timeline marker."
  }

  $timelineClose = $changelog.IndexOf('</section>', $timelineStart + $timelineMarker.Length)
  if ($timelineClose -lt 0) {
    throw "Could not find the EastCoin changelog timeline closing tag."
  }

  $changelog = $changelog.Insert($timelineClose, "$entry`r`n")

  $changelog = [regex]::Replace(
    $changelog,
    '<div class="release-count">(\d+) major update groups</div>',
    {
      param($match)
      $next = [int]$match.Groups[1].Value + 1
      return "<div class=`"release-count`">$next major update groups</div>"
    },
    1
  )

  Set-Content -Path $changelogPath -Value $changelog -Encoding UTF8
}

Write-Host "EastCoin short MultiView links installed." -ForegroundColor Green
Write-Host "Updated: assets/eastcoins-multiview-share.js"
Write-Host "Updated: multiview.html (share2 cache bust)"
Write-Host "Updated: changelog.html"
