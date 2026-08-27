param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path

$logoPath = Join-Path $RepoPath "assets\eastcoins-logo.webp"
$faviconPath = Join-Path $RepoPath "assets\eastcoin-favicon.svg"

if (-not (Test-Path $logoPath)) {
  throw "EastCoin logo not found: $logoPath"
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText(
    $Path,
    $Content,
    (New-Object System.Text.UTF8Encoding($false))
  )
}

# Build a square SVG favicon from the exact full EastCoin logo.
# preserveAspectRatio=meet keeps the complete logo visible without cropping.
$logoBytes = [System.IO.File]::ReadAllBytes($logoPath)
$logoBase64 = [Convert]::ToBase64String($logoBytes)

$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <image
    href="data:image/webp;base64,$logoBase64"
    x="8"
    y="8"
    width="496"
    height="496"
    preserveAspectRatio="xMidYMid meet" />
</svg>
"@

Write-Utf8NoBom $faviconPath $svg
Write-Host "Created full-logo favicon: assets\eastcoin-favicon.svg" -ForegroundColor Green

$changedFiles = New-Object System.Collections.Generic.List[string]

Get-ChildItem -Path $RepoPath -Filter "*.html" -File -Recurse | ForEach-Object {
  $path = $_.FullName
  $content = Get-Content $path -Raw
  $original = $content

  # Replace only browser favicon links. Keep the existing PNG Apple touch icon.
  $content = [regex]::Replace(
    $content,
    '<link(?=[^>]*\brel=["'']icon["''])(?=[^>]*\bhref=["'']assets/eastcoin-favicon\.png["''])[^>]*>',
    '<link href="assets/eastcoin-favicon.svg?v=full-logo1" rel="icon" type="image/svg+xml"/>',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  $content = [regex]::Replace(
    $content,
    '<link(?=[^>]*\brel=["'']shortcut icon["''])(?=[^>]*\bhref=["'']assets/eastcoin-favicon\.png["''])[^>]*>',
    '<link href="assets/eastcoin-favicon.svg?v=full-logo1" rel="shortcut icon" type="image/svg+xml"/>',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  if ($content -ne $original) {
    Write-Utf8NoBom $path $content
    $relative = $path.Substring($RepoPath.Length).TrimStart('\')
    $changedFiles.Add($relative)
    Write-Host "Updated favicon links: $relative" -ForegroundColor Green
  }
}

# Add the branding change to the production changelog.
$changelogPath = Join-Path $RepoPath "changelog.html"
if (Test-Path $changelogPath) {
  $content = Get-Content $changelogPath -Raw
  $entryMarker = "Full EastCoin logo becomes the site favicon"

  if ($content -notmatch [regex]::Escape($entryMarker)) {
    $content = $content -replace 'class="timeline-entry latest"', 'class="timeline-entry"'
    $content = $content -replace '<span class="latest-badge">Latest</span>', ''

    $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-20">August 20, 2026</time><span class="latest-badge">Latest</span>
</div>
<h2>Full EastCoin logo becomes the site favicon</h2>
<p>
    Updated EastCoin browser tabs to use the complete EastCoin logo as the
    favicon across the site while retaining the existing Apple touch-icon
    fallback.
  </p>
</article>
'@

    $timelineStart = $content.IndexOf('<section aria-label="EastCoin feature timeline" class="timeline">')
    if ($timelineStart -ge 0) {
      $timelineEnd = $content.IndexOf('</section>', $timelineStart)
      if ($timelineEnd -ge 0) {
        $content = $content.Insert($timelineEnd, $entry + [Environment]::NewLine)
      }
    }

    $countPattern = '<div class="release-count">(\d+) major update groups</div>'
    $content = [regex]::Replace(
      $content,
      $countPattern,
      {
        param($match)
        $next = [int]$match.Groups[1].Value + 1
        return '<div class="release-count">' + $next + ' major update groups</div>'
      },
      1
    )

    Write-Utf8NoBom $changelogPath $content

    if (-not $changedFiles.Contains("changelog.html")) {
      $changedFiles.Add("changelog.html")
    }

    Write-Host "Updated changelog.html" -ForegroundColor Green
  }
}

$manifestPath = Join-Path $RepoPath "favicon-changed-files.txt"
$manifestLines = @("assets/eastcoin-favicon.svg") + $changedFiles
Write-Utf8NoBom $manifestPath (($manifestLines | Sort-Object -Unique) -join [Environment]::NewLine)

Write-Host ""
Write-Host "Full EastCoin logo favicon installed." -ForegroundColor Cyan
Write-Host "A temporary favicon-changed-files.txt manifest was written to the repo root."
Write-Host "You can delete that manifest after checking the changed files."
