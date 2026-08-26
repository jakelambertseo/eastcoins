@echo off
setlocal
cd /d "%~dp0\.."

set "CONFIG=wrangler.picks-migrations.jsonc"

echo.
echo =========================================
echo  EastCoin Picks - Step 4 Schema Migration
echo =========================================
echo.
echo Database: eastcoin-picks
echo Config: %CONFIG%
echo Migration folder: migrations
echo.

if not exist "%CONFIG%" (
  echo ERROR: Missing %CONFIG%
  goto :fail
)

if not exist "migrations\0001_picks_core.sql" (
  echo ERROR: Missing migrations\0001_picks_core.sql
  goto :fail
)

echo Checking unapplied migrations...
echo.

call npx wrangler@latest d1 migrations list eastcoin-picks --remote --config "%CONFIG%"
if errorlevel 1 goto :fail

echo.
echo Applying the production D1 migration...
echo.
echo If Wrangler asks to continue, type y and press Enter.
echo.

call npx wrangler@latest d1 migrations apply eastcoin-picks --remote --config "%CONFIG%"
if errorlevel 1 goto :fail

echo.
echo Verifying that every required Picks table exists...
echo.

call npx wrangler@latest d1 execute eastcoin-picks --remote --config "%CONFIG%" --command "SELECT (SELECT COUNT(*) FROM users) AS users_rows, (SELECT COUNT(*) FROM sessions) AS sessions_rows, (SELECT COUNT(*) FROM seasons) AS seasons_rows, (SELECT COUNT(*) FROM markets) AS markets_rows, (SELECT COUNT(*) FROM picks) AS picks_rows, (SELECT COUNT(*) FROM wallet_operations) AS wallet_operations_rows, (SELECT COUNT(*) FROM admin_actions) AS admin_actions_rows, (SELECT COUNT(*) FROM user_season_stats) AS user_season_stats_rows;"
if errorlevel 1 goto :fail

echo.
echo Verifying D1 migration history...
echo.

call npx wrangler@latest d1 execute eastcoin-picks --remote --config "%CONFIG%" --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id;"
if errorlevel 1 goto :fail

echo.
echo Checking that no migrations remain unapplied...
echo.

call npx wrangler@latest d1 migrations list eastcoin-picks --remote --config "%CONFIG%"
if errorlevel 1 goto :fail

echo.
echo =========================================
echo  STEP 4 DATABASE MIGRATION COMPLETE
echo =========================================
echo.
echo The remote D1 schema has been verified.
echo.
echo Next run:
echo.
echo   node tools\apply-picks-step-4-changelog.cjs
echo.
echo Then commit and push the Step 4 files.
echo.
exit /b 0

:fail
echo.
echo =========================================
echo  STEP 4 MIGRATION STOPPED
echo =========================================
echo.
echo The migration or verification did not complete successfully.
echo Do NOT run the changelog step and do NOT push Step 4 yet.
echo Copy the terminal output into ChatGPT.
echo.
exit /b 1
