@echo off
title ToshibaDLC - Local Server + DB
cd /d "%~dp0"
cls
echo.
echo  ==============================================
echo    ToshibaDLC  -  Local Site + SQLite DB
echo  ----------------------------------------------
echo    URL:         http://localhost:8080
echo    Admin login: admin / admin123
echo    Admin panel: http://localhost:8080/admin/
echo    DB file:     toshibadlc.db
echo  ----------------------------------------------
echo    Press Ctrl+C to stop the server
echo  ==============================================
echo.

start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:8080/"

call :attempt py -3
if %errorlevel%==0 goto :end
call :attempt python
if %errorlevel%==0 goto :end
call :attempt python3
if %errorlevel%==0 goto :end
call :attempt "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if %errorlevel%==0 goto :end
call :attempt "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if %errorlevel%==0 goto :end
call :attempt "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if %errorlevel%==0 goto :end

echo.
echo  [ERROR] A working Python 3 was not found.
echo  Install Python: https://www.python.org/downloads/
echo  (make sure to tick "Add Python to PATH")
echo.
pause
goto :end

:attempt
%* -c "import sqlite3,http.server,secrets" >nul 2>&1
if errorlevel 1 exit /b 1
echo  [OK] Python found. Starting server...
echo.
%* server.py
exit /b 0

:end
