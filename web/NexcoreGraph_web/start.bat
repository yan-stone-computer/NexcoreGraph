@echo off
rem ============================================
rem  Tianshu Smart Home - Web one-click start (Windows)
rem  Usage: start.bat [port]   default port 8090
rem ============================================
setlocal enabledelayedexpansion

set "APP=%~dp0webapp"
set "PORT=8090"
if not "%~1"=="" set "PORT=%~1"

if not exist "%APP%\index.html" (
  echo [ERROR] index.html not found under %APP%.
  echo         Please put start.bat in the project root.
  pause
  exit /b 1
)

rem Port already in use -> service already running, just open browser
netstat -ano | findstr /r ":%PORT%.*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [INFO] Port %PORT% already in use, opening browser.
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY ( where py >nul 2>&1 && set "PY=py" )
if not defined PY (
  echo [ERROR] Python not found. Install Python 3 first: https://www.python.org/downloads/
  pause
  exit /b 1
)

echo [START] Static server on http://127.0.0.1:%PORT%/  (close the new console window to stop)
start "Tianshu Web Server (port %PORT%)" /D "%APP%" cmd /k %PY% -m http.server %PORT% --bind 127.0.0.1

rem Wait up to 8 seconds for the port to become ready
set /a tries=0
:waitport
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /r ":%PORT%.*LISTENING" >nul 2>&1
if errorlevel 1 (
  set /a tries+=1
  if !tries! lss 8 goto waitport
)

start "" "http://127.0.0.1:%PORT%/"
echo Server started. Browser opened at http://127.0.0.1:%PORT%/
exit /b 0
