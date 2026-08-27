param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path
$PackageRoot = Split-Path $PSScriptRoot -Parent

$sourceAsset = Join-Path $PackageRoot "assets\\eastcoins-event-visibility.js"
$targetAsset = Join-Path $RepoPath "assets\\eastcoins-event-visibility.js"

if (-not (Test-Path $sourceAsset)) {
  throw "Package asset not found: $sourceAsset"
}

Copy-Item $sourceAsset $targetAsset -Force
$visibilityTag = '<script src="assets/eastcoins-event-visibility.js?v=visibility1"></script>'

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Install-VisibilityTag([string]$FileName) {
  $path = Join-Path $RepoPath $FileName
  if (-not (Test-Path $path)) {
    Write-Warning "Skipping missing file: $FileName"
    return
  }

  $content = Get-Content $path -Raw

  if ($content -match 'eastcoins-event-visibility\\.js') {
    $content = [regex]::Replace(
      $content,
      '<script\\s+src=["'']assets/eastcoins-event-visibility\\.js\\?v=[^"'']+["'']\\s*></script>',
      $visibilityTag
    )
    Write-Utf8NoBom $path $content
    Write-Host "Updated visibility filter in $FileName" -ForegroundColor Green
    return
  }

  $apiPattern = '(<script\\s+src=["'']assets/eastcoins-streamed-api\\.js\\?v=[^"'']+["'']\\s*></script>)'

  if ($content -match $apiPattern) {
    $content = [regex]::Replace(
      $content,
      $apiPattern,
      ('$1' + [Environment]::NewLine + $visibilityTag),
      1
    )
    Write-Utf8NoBom $path $content
    Write-Host "Installed event visibility filter in $FileName" -ForegroundColor Green
    return
  }

  if ($FileName -eq "index.html") {
    $shellPattern = '(<script\\s+src=["'']assets/eastcoins-persistent-shell\\.js\\?v=[^"'']+["'']\\s*></script>)'
    if ($content -match $shellPattern) {
      $content = [regex]::Replace(
        $content,
        $shellPattern,
        ($visibilityTag + [Environment]::NewLine + '$1'),
        1
      )
    } else {
      $content = $content -replace '</body>', ($visibilityTag + [Environment]::NewLine + '</body>')
    }
    Write-Utf8NoBom $path $content
    Write-Host "Installed navigation visibility filter in index.html" -ForegroundColor Green
    return
  }

  Write-Warning "Could not find Streamed API script in $FileName; left unchanged."
}

@("index.html", "player.html", "events.html", "multiview.html", "status.html") | ForEach-Object {
  Install-VisibilityTag $_
}

$changelogPath = Join-Path $RepoPath "changelog.html"
if (Test-Path $changelogPath) {
  $content = Get-Content $changelogPath -Raw
  $entryMarker = "Basketball and soccer temporarily hidden"

  if ($content -notmatch [regex]::Escape($entryMarker)) {
    $content = $content -replace 'class="timeline-entry latest"', 'class="timeline-entry"'
    $content = $content -replace '<span class="latest-badge">Latest</span>', ''

    $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-20">August 20, 2026</time><span class="latest-badge">Latest</span>
</div>
<h2>Basketball and soccer temporarily hidden</h2>
<p>
    Temporarily removed basketball events, including WNBA listings, and soccer
    events from EastCoin discovery, category navigation, search results, and
    MultiView event selection. The provider data and direct event compatibility
    remain intact so either sport can be restored later without rebuilding the
    Streamed or PPV integrations.
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

    $countPattern = '<div class="release-count">(\\d+) major update groups</div>'
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
  } else {
    Write-Host "Changelog entry already present." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "EastCoin event visibility update installed." -ForegroundColor Cyan
Write-Host "Hidden for now: Basketball (including WNBA) and Soccer."
Write-Host "Direct/shared event links remain compatible."
