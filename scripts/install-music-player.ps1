param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath,

  [string]$WorkerUrl = ""
)

$ErrorActionPreference = "Stop"

$PackageRoot = Split-Path -Parent $PSScriptRoot
$RepoPath = (Resolve-Path $RepoPath).Path

$required = @(
  (Join-Path $RepoPath "index.html"),
  (Join-Path $RepoPath "changelog.html"),
  (Join-Path $RepoPath "assets")
)

foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    throw "Expected EastCoin file/folder not found: $path"
  }
}

Write-Host "Installing EastCoin Music Player into $RepoPath" -ForegroundColor Cyan

# Complete replacement for the production shell page, based on GitHub main
# commit 64a8495ed182bb1bdd4ca13c35ebf1f5a71c4c6d.
Copy-Item (Join-Path $PackageRoot "index.html") (Join-Path $RepoPath "index.html") -Force

# New isolated music assets.
Copy-Item (Join-Path $PackageRoot "assets\eastcoins-music-player.css") (Join-Path $RepoPath "assets\eastcoins-music-player.css") -Force
Copy-Item (Join-Path $PackageRoot "assets\eastcoins-music-player.js") (Join-Path $RepoPath "assets\eastcoins-music-player.js") -Force
Copy-Item (Join-Path $PackageRoot "assets\eastcoins-music-config.js") (Join-Path $RepoPath "assets\eastcoins-music-config.js") -Force

# Optional shared-room Worker source. Keep it in the repo so deployment is versioned.
$workerDestination = Join-Path $RepoPath "worker\eastcoin-music-room"
New-Item -ItemType Directory -Path $workerDestination -Force | Out-Null
Copy-Item (Join-Path $PackageRoot "worker\*") $workerDestination -Recurse -Force

# Keep the version indicator aligned on MultiView without changing MultiView behavior.
$multiViewPath = Join-Path $RepoPath "multiview.html"
if (Test-Path $multiViewPath) {
  $multi = Get-Content $multiViewPath -Raw
  $multi = $multi.Replace("EastCoin v0.58", "EastCoin v0.59")
  [System.IO.File]::WriteAllText($multiViewPath, $multi, (New-Object System.Text.UTF8Encoding($false)))
}

# Add the release to the existing changelog without requiring manual editing.
$changelogPath = Join-Path $RepoPath "changelog.html"
$changelog = Get-Content $changelogPath -Raw

if ($changelog -notmatch "Shared Music Player and song requests added") {
  $changelog = $changelog.Replace('<article class="timeline-entry latest">', '<article class="timeline-entry">')
  $changelog = $changelog.Replace('<span class="latest-badge">Latest</span>', '')

  $newEntry = @'
<article class="timeline-entry latest"><div class="timeline-date"><time datetime="2026-08-12">August 12, 2026</time><span class="latest-badge">Latest</span></div><h2>Shared Music Player and song requests added</h2><p>Added a shell-owned Music Player to View Controls so EastCoin users can open a dedicated YouTube song-request dock beside Twitch chat without covering the active video or reconnecting chat. The first release accepts pasted YouTube links without a YouTube Data API key, automatically advances the queue, remembers local requests, handles browser autoplay blocking with a Join Music action, and includes an optional Cloudflare Durable Object/WebSocket backend for a synchronized shared queue, listener count, playback position, and community skip voting.</p></article>
'@

  $marker = '</article></section>'
  $markerIndex = $changelog.LastIndexOf($marker)
  if ($markerIndex -lt 0) {
    throw "Could not find the end of the changelog timeline. changelog.html was not modified."
  }

  $insertAt = $markerIndex + '</article>'.Length
  $changelog = $changelog.Insert($insertAt, $newEntry)
  [System.IO.File]::WriteAllText($changelogPath, $changelog, (New-Object System.Text.UTF8Encoding($false)))
}

if ($WorkerUrl) {
  & (Join-Path $PSScriptRoot "configure-music-worker.ps1") -RepoPath $RepoPath -WorkerUrl $WorkerUrl
}

Write-Host "" 
Write-Host "EastCoin Music Player files installed." -ForegroundColor Green
Write-Host "Local mode works immediately; no API key or Worker is required." -ForegroundColor Green
Write-Host "Deploy worker/eastcoin-music-room later for the shared queue." -ForegroundColor Yellow
