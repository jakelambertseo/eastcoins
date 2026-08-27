@echo off
setlocal
cd /d "%~dp0"

set STABLE=f9ac1afa01d06607b3b5465776c7dd647eda7537

echo.
echo EastCoin stable restore
echo Restoring production files from %STABLE%
echo.

git cat-file -e %STABLE%^{commit} 2>nul
if errorlevel 1 (
  echo ERROR: Stable commit %STABLE% is not available locally.
  echo Run: git fetch origin
  exit /b 1
)

for %%F in (
  "_headers"
  "assets/eastcoins-event-visibility.js"
  "assets/eastcoins-events-home.js"
  "assets/eastcoins-persistent-shell.js"
  "assets/eastcoins-ppv-api.js"
  "assets/eastcoins-streamed-api.js"
  "changelog.html"
  "events.html"
  "index.html"
) do (
  echo Restoring %%~F
  git show %STABLE%:%%~F > "%%~F"
  if errorlevel 1 (
    echo ERROR restoring %%~F
    exit /b 1
  )
)

echo.
echo Restore complete.
echo These production files now match the last known-good state before DLStreams.
echo Prototype DLStreams files were intentionally left in the repo but are not wired into production.
echo.
git --no-pager diff --stat -- _headers assets/eastcoins-event-visibility.js assets/eastcoins-events-home.js assets/eastcoins-persistent-shell.js assets/eastcoins-ppv-api.js assets/eastcoins-streamed-api.js changelog.html events.html index.html
echo.
echo Review the diff above, then use the Git commands provided by ChatGPT.
endlocal
