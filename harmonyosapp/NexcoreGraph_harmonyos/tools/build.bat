@echo off
rem NexcoreGraph HarmonyOS CLI build entry (M-13 / D11). Logic lives in build.ps1.
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
exit /b %ERRORLEVEL%
