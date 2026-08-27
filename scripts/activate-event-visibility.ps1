param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path

$assetPath = Join-Path $RepoPath "assets\eastcoins-event-visibility.js"
if (-not (Test-Path $assetPath)) {
  throw "Missing assets\eastcoins-event-visibility.js. Run git pull first; the filter asset is already committed to main."
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText(
    $Path,
    $Content,
    (New-Object System.Text.UTF8Encoding($false))
  )
}

$tag = '<script src="assets/eastcoins-event-visibility.js?v=visibility2"></script>'

function Patch-AfterStreamedApi([string]$FileName) {
  $path = Join-Path $RepoPath $FileName
  if (-not (Test-Path $path)) {
    throw "Missing production file: $FileName"
  }

  $content = Get-Content $path -Raw

  if ($content -match 'eastcoins-event-visibility\.js') {
    $content = [regex]::Replace(
      $content,
      '<script\s+src=["'']assets/eastcoins-event-visibility\.js\?v=[^"'']+["'']\s*></script>',
      $tag,
      1
    )
    Write-Utf8NoBom $path $content
    Write-Host "Refreshed visibility filter in $FileName" -ForegroundColor Green
    return
  }

  $pattern = '(<script\s+src=["'']assets/eastcoins-streamed-api\.js\?v=[^"'']+["'']\s*></script>)'
  if ($content -notmatch $pattern) {
    throw "Could not find the Streamed API script in $FileName"
  }

  $content = [regex]::Replace(
    $content,
    $pattern,
    ('$1' + [Environment]::NewLine + $tag),
    1
  )

  Write-Utf8NoBom $path $content
  Write-Host "Activated visibility filter in $FileName" -ForegroundColor Green
}

function Patch-Index {
  $path = Join-Path $RepoPath "index.html"
  if (-not (Test-Path $path)) {
    throw "Missing production file: index.html"
  }

  $content = Get-Content $path -Raw

  if ($content -match 'eastcoins-event-visibility\.js') {
    $content = [regex]::Replace(
      $content,
      '<script\s+src=["'']assets/eastcoins-event-visibility\.js\?v=[^"'']+["'']\s*></script>',
      $tag,
      1
    )
    Write-Utf8NoBom $path $content
    Write-Host "Refreshed visibility filter in index.html" -ForegroundColor Green
    return
  }

  $pattern = '(<script\s+src=["'']assets/eastcoins-persistent-shell\.js\?v=[^"'']+["'']\s*></script>)'
  if ($content -notmatch $pattern) {
    throw "Could not find the persistent shell script in index.html"
  }

  $content = [regex]::Replace(
    $content,
    $pattern,
    ($tag + [Environment]::NewLine + '$1'),
    1
  )

  Write-Utf8NoBom $path $content
  Write-Host "Activated navigation visibility filter in index.html" -ForegroundColor Green
}

Patch-Index
Patch-AfterStreamedApi "events.html"
Patch-AfterStreamedApi "multiview.html"

$changelogPath = Join-Path $RepoPath "changelog.html"
if (Test-Path $changelogPath) {
  $content = Get-Content $changelogPath -Raw
  $marker = "Basketball and soccer filter activated"

  if ($content -notmatch [regex]::Escape($marker)) {
    $content = $content -replace 'class="timeline-entry latest"', 'class="timeline-entry"'
    $content = $content -replace '<span class="latest-badge">Latest</span>', ''

    $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-20">August 20, 2026</time><span class="latest-badge">Latest</span>
</div>
<h2>Basketball and soccer filter activated</h2>
<p>
    Activated EastCoin's temporary event visibility filter so basketball,
    including WNBA listings, and soccer no longer appear in the main event
    directory, event search results, navigation categories, or MultiView's
    event picker. Direct event links and the underlying provider integrations
    remain available for easy restoration later.
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
    Write-Host "Updated changelog.html" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "EastCoin basketball/soccer filter is now WIRED into production pages." -ForegroundColor Cyan
Write-Host "Expected changed files:"
Write-Host "  index.html"
Write-Host "  events.html"
Write-Host "  multiview.html"
Write-Host "  changelog.html"
Write-Host ""
Write-Host "The existing assets\eastcoins-event-visibility.js is already committed and does not need to be staged again."
