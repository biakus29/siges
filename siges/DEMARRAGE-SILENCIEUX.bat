@echo off
chcp 65001 >nul
rem === Aurel School Compta — demarrage silencieux (sans question) ===
rem Relance minimisée : une seule fenetre, discretement reduite
if not "%AUREL_MIN%"=="1" (
  set AUREL_MIN=1
  start /min "" "%~f0"
  exit /b
)
cd /d "%~dp0"
set PHPCMD=
where php >nul 2>nul && set PHPCMD=php
if "%PHPCMD%"=="" if exist "C:\xampp\php\php.exe" set PHPCMD=C:\xampp\php\php.exe
if "%PHPCMD%"=="" if exist "C:\wamp64\bin\php\php-8.4\php.exe" set PHPCMD=C:\wamp64\bin\php\php-8.4\php.exe
if "%PHPCMD%"=="" exit /b 1
set PORT=4000
if exist "port.txt" set /p PORT=<port.txt
if "%PORT%"=="" set PORT=4000
if exist "OUVRIR-NAVIGATEUR.txt" start "" http://localhost:%PORT%
"%PHPCMD%" -d post_max_size=24M -d upload_max_filesize=24M -S 0.0.0.0:%PORT% router.php
