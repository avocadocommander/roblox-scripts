@echo off
setlocal

set VERSION_BUMP=%~1

if "%ROBLOX_PLACE_ID%"=="" (
	echo Missing ROBLOX_PLACE_ID.
	echo Set ROBLOX_PLACE_ID to the place asset id you want to publish.
	exit /b 1
)

if not "%ROBLOX_API_KEY%"=="" (
	if "%ROBLOX_UNIVERSE_ID%"=="" (
		echo Missing ROBLOX_UNIVERSE_ID.
		echo Open Cloud publishing with ROBLOX_API_KEY requires the universe id.
		exit /b 1
	)
) else (
	if "%ROBLOX_COOKIE%"=="" (
		echo Missing publish credentials.
		echo Set ROBLOX_API_KEY and ROBLOX_UNIVERSE_ID for Open Cloud publishing.
		echo Or set ROBLOX_COOKIE for cookie-based Rojo upload.
		exit /b 1
	)
)

if not "%VERSION_BUMP%"=="" (
	if /I "%VERSION_BUMP%"=="patch" goto valid_bump
	if /I "%VERSION_BUMP%"=="minor" goto valid_bump
	if /I "%VERSION_BUMP%"=="major" goto valid_bump
	if /I "%VERSION_BUMP%"=="prerelease" goto valid_bump
	echo Invalid version bump "%VERSION_BUMP%".
	echo Use patch, minor, major, prerelease, or omit the argument to publish the current version.
	exit /b 1

	:valid_bump
	call npm.cmd version "%VERSION_BUMP%" --no-git-tag-version
	if errorlevel 1 exit /b %errorlevel%
)

call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set GAME_VERSION=%%v

if not "%ROBLOX_API_KEY%"=="" (
	echo Publishing Roblox place %ROBLOX_PLACE_ID% as game version v%GAME_VERSION% using Open Cloud.
	call npx.cmd rojo upload default.project.json --asset_id "%ROBLOX_PLACE_ID%" --universe_id "%ROBLOX_UNIVERSE_ID%" --api_key "%ROBLOX_API_KEY%"
	exit /b %errorlevel%
)

echo Publishing Roblox place %ROBLOX_PLACE_ID% as game version v%GAME_VERSION% using cookie auth.
call npx.cmd rojo upload default.project.json --asset_id "%ROBLOX_PLACE_ID%" --cookie "%ROBLOX_COOKIE%"
exit /b %errorlevel%
