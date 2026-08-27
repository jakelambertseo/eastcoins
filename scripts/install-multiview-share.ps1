param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path
$PackageRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$multiviewSource = Join-Path $PackageRoot "multiview.html"
$shareSource = Join-Path $PackageRoot "assets\eastcoins-multiview-share.js"
$changelogEntrySource = Join-Path $PackageRoot "CHANGELOG-ENTRY.html"

$multiviewTarget = Join-Path $RepoPath "multiview.html"
$shareTarget = Join-Path $RepoPath "assets\eastcoins-multiview-share.js"
$changelogTarget = Join-Path $RepoPath "changelog.html"

if (-not (Test-Path $multiviewTarget)) {
  throw "multiview.html was not found in $RepoPath"
}

if (-not (Test-Path (Join-Path $RepoPath "assets\eastcoins-multiview.js"))) {
  throw "assets\eastcoins-multiview.js was not found in $RepoPath"
}

Copy-Item $multiviewSource $multiviewTarget -Force
Copy-Item $shareSource $shareTarget -Force

if (Test-Path $changelogTarget) {
  $html = Get-Content $changelogTarget -Raw

  if ($html -notmatch "Shareable MultiView links added") {
    $entry = Get-Content $changelogEntrySource -Raw

    $html = $html -replace 'class="timeline-entry latest"', 'class="timeline-entry"'
    $html = $html -replace '<span class="latest-badge">Latest</span>', ''

    $insertAt = $html.LastIndexOf("</section>")
    if ($insertAt -lt 0) {
      throw "Could not locate the changelog timeline closing section."
    }

    $html = $html.Insert($insertAt, "$entry`r`n")
    Set-Content -Path $changelogTarget -Value $html -Encoding UTF8
  }
}

Write-Host "EastCoin Shareable MultiView installed." -ForegroundColor Green
Write-Host "Updated: multiview.html"
Write-Host "Added: assets\eastcoins-multiview-share.js"
if (Test-Path $changelogTarget) {
  Write-Host "Updated: changelog.html"
}
