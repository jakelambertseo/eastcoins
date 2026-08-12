param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath,

  [Parameter(Mandatory=$true)]
  [string]$WorkerUrl
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path
$configPath = Join-Path $RepoPath "assets\eastcoins-music-config.js"

if (-not (Test-Path $configPath)) {
  throw "Music config not found: $configPath"
}

try {
  $uri = [Uri]$WorkerUrl
} catch {
  throw "WorkerUrl must be a valid http/https URL."
}

if ($uri.Scheme -notin @("http", "https")) {
  throw "WorkerUrl must begin with http:// or https://"
}

$safeUrl = $WorkerUrl.TrimEnd('/').Replace('"', '\"')
$content = Get-Content $configPath -Raw
$content = [regex]::Replace(
  $content,
  'websocketUrl:\s*"[^"]*"',
  ('websocketUrl: "' + $safeUrl + '"'),
  1
)
[System.IO.File]::WriteAllText($configPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Shared Music Player endpoint configured:" -ForegroundColor Green
Write-Host $WorkerUrl
