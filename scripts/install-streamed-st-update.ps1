param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = 'Stop'

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Utf8([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Require-File([string]$RelativePath) {
  $full = Join-Path $RepoPath $RelativePath
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    throw "Required EastCoin file not found: $RelativePath"
  }
  return $full
}

$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path

$apiPath       = Require-File 'assets/eastcoins-streamed-api.js'
$playerPath    = Require-File 'player.html'
$multiviewPath = Require-File 'multiview.html'
$eventsPath    = Require-File 'events.html'
$statusPath    = Require-File 'status.html'
$favoritesPath = Require-File 'favorites.html'
$changelogPath = Require-File 'changelog.html'

# 1) Move active Streamed API + relative image traffic to streamed.st.
$api = Read-Utf8 $apiPath
$beforeApi = $api
$api = $api.Replace('https://streamed.pk/api', 'https://streamed.st/api')
$api = $api.Replace('https://streamed.pk', 'https://streamed.st')

# Force a fresh provider cache after the hostname migration so cached stream
# payloads from the old domain cannot survive the deploy.
$api = $api.Replace('eastcoinStreamedCacheV2:', 'eastcoinStreamedCacheV3:')
$api = $api.Replace('eastcoinStreamedStreamsV1:', 'eastcoinStreamedStreamsV2:')

if ($api -eq $beforeApi) {
  if ($api -notmatch 'https://streamed\.st/api') {
    throw 'Streamed API adapter did not contain the expected domain or updated domain.'
  }
}
Write-Utf8 $apiPath $api

# 2) Update the visible Other Streams/Favorites destination.
$favorites = Read-Utf8 $favoritesPath
$favorites = $favorites.Replace('https://streamed.pk/', 'https://streamed.st/')
$favorites = $favorites.Replace('Streamed PK', 'Streamed ST')
Write-Utf8 $favoritesPath $favorites

# 3) Cache-bust the API adapter on all production surfaces that load it.
$apiScriptPattern = 'assets/eastcoins-streamed-api\.js\?v=[^"''\s>]+'
foreach ($path in @($playerPath, $multiviewPath, $eventsPath, $statusPath)) {
  $html = Read-Utf8 $path
  $updated = [regex]::Replace($html, $apiScriptPattern, 'assets/eastcoins-streamed-api.js?v=api4')
  if ($updated -eq $html -and $html -notmatch 'eastcoins-streamed-api\.js\?v=api4') {
    throw "Could not find Streamed API script reference in $(Split-Path $path -Leaf)."
  }
  Write-Utf8 $path $updated
}

# 4) Add the production change to the EastCoin changelog once.
$changelog = Read-Utf8 $changelogPath
$entryHeading = 'Streamed provider migrated to streamed.st'
if ($changelog -notmatch [regex]::Escape($entryHeading)) {
  # Remove the old Latest marker/class so this entry becomes the newest one.
  $changelog = $changelog.Replace('timeline-entry latest', 'timeline-entry')
  $changelog = $changelog.Replace('<span class="latest-badge">Latest</span>', '')

  $entry = @'
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-13">August 13, 2026</time><span class="latest-badge">Latest</span>
</div>
<h2>Streamed provider migrated to streamed.st</h2>
<p>Updated EastCoin's active Streamed REST API and relative image requests from streamed.pk to streamed.st after the provider moved domains. The provider cache namespace was refreshed so old stream responses are not reused after deployment, Streamed ST is now the visible Other Streams destination, and the Live Player, Events, MultiView, and Status pages load the new adapter version immediately.</p>
</article>
'@

  $timelinePattern = '(?s)(<section aria-label="EastCoin feature timeline" class="timeline">)(.*?)(</section>)'
  $match = [regex]::Match($changelog, $timelinePattern)
  if (-not $match.Success) {
    throw 'Could not locate the EastCoin changelog timeline section.'
  }

  $replacement = $match.Groups[1].Value + $match.Groups[2].Value + $entry + $match.Groups[3].Value
  $changelog = $changelog.Substring(0, $match.Index) + $replacement + $changelog.Substring($match.Index + $match.Length)

  $changelog = [regex]::Replace(
    $changelog,
    '(?<n>\d+) major update groups',
    { param($m) (([int]$m.Groups['n'].Value) + 1).ToString() + ' major update groups' },
    1
  )
}
Write-Utf8 $changelogPath $changelog

# 5) Validation: active provider adapter must no longer target streamed.pk.
$apiCheck = Read-Utf8 $apiPath
if ($apiCheck -match 'https://streamed\.pk') {
  throw 'Validation failed: the active Streamed API adapter still contains an https://streamed.pk request target.'
}
if ($apiCheck -notmatch 'https://streamed\.st/api') {
  throw 'Validation failed: streamed.st API base was not written.'
}

Write-Host ''
Write-Host 'EastCoin Streamed domain update installed successfully.' -ForegroundColor Green
Write-Host 'Active API: https://streamed.st/api'
Write-Host 'Updated: API adapter, provider cache keys, player/events/multiview/status cache busts, Favorites, changelog.'
Write-Host 'Legacy streamed.pk parsing in eastcoins-streamed.js is intentionally untouched for old pasted/shared links.'
