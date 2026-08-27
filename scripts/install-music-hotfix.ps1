param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $PSScriptRoot
$RepoPath = (Resolve-Path $RepoPath).Path

$indexPath = Join-Path $RepoPath "index.html"
$cssPath = Join-Path $RepoPath "assets\eastcoins-music-player.css"
$jsPath = Join-Path $RepoPath "assets\eastcoins-music-player.js"
$changelogPath = Join-Path $RepoPath "changelog.html"

foreach ($path in @($indexPath, $cssPath, $jsPath)) {
  if (-not (Test-Path $path)) { throw "Expected EastCoin file not found: $path" }
}

Copy-Item (Join-Path $PackageRoot "index.html") $indexPath -Force
Copy-Item (Join-Path $PackageRoot "assets\eastcoins-music-player.css") $cssPath -Force
Copy-Item (Join-Path $PackageRoot "assets\eastcoins-music-player.js") $jsPath -Force

if (Test-Path $changelogPath) {
  $changelog = Get-Content $changelogPath -Raw
  if ($changelog -notmatch "Music Player overlay and local queue hotfix") {
    $changelog = $changelog.Replace('<article class="timeline-entry latest">', '<article class="timeline-entry">')
    $changelog = $changelog.Replace('<span class="latest-badge">Latest</span>', '')
    $entry = Get-Content (Join-Path $PackageRoot "CHANGELOG-ENTRY.html") -Raw
    $marker = '</article></section>'
    $markerIndex = $changelog.LastIndexOf($marker)
    if ($markerIndex -ge 0) {
      $insertAt = $markerIndex + '</article>'.Length
      $changelog = $changelog.Insert($insertAt, $entry)
      [System.IO.File]::WriteAllText($changelogPath, $changelog, (New-Object System.Text.UTF8Encoding($false)))
    } else {
      Write-Warning "Could not find changelog timeline marker; changelog was left unchanged."
    }
  }
}

Write-Host "EastCoin Music Player v0.59.1 hotfix installed." -ForegroundColor Green
Write-Host "The player now floats over video and local Up Next advancement is fixed." -ForegroundColor Green
