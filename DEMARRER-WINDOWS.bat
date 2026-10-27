@echo off
chcp 65001 >nul
title Aurel School Compta (PHP) - College Bonneau
cd /d "%~dp0"
echo ==================================================
echo    AUREL SCHOOL COMPTA - COLLEGE BONNEAU  (PHP)
echo    Gestion des frais de scolarite - v1.8
echo ==================================================
echo.
set PHPCMD=
where php >nul 2>nul && set PHPCMD=php
if "%PHPCMD%"=="" if exist "C:\xampp\php\php.exe" set PHPCMD=C:\xampp\php\php.exe
if "%PHPCMD%"=="" if exist "C:\wamp64\bin\php\php-8.4\php.exe" set PHPCMD=C:\wamp64\bin\php\php-8.4\php.exe
if "%PHPCMD%"=="" (
  echo [ERREUR] PHP n'a pas ete trouve sur ce PC.
  echo.
  echo   Choisissez l'une des options :
  echo   1. Installez XAMPP ^(https://www.apachefriends.org^) puis placez ce
  echo      dossier dans C:\xampp\htdocs et ouvrez
  echo      http://localhost/aurel-school-compta/install.php
  echo   2. Ou installez PHP pour Windows ^(https://windows.php.net/download^)
  echo      puis relancez ce fichier.
  echo.
  start "" https://www.apachefriends.org
  pause
  exit /b 1
)
echo [1/3] PHP detecte :
"%PHPCMD%" -v | findstr /R "^PHP"
echo.
echo [2/3] Adresse et port du serveur local.
set PORT=4000
set /p PORT=Port du serveur (appuyez sur Entree pour 4000) :
if "%PORT%"=="" set PORT=4000
echo.
if not exist "config.php" (
  echo [3/3] Premiere utilisation : ouvrez http://localhost:%PORT%/install.php
  echo        dans le navigateur pour creer la base de donnees.
) else (
  echo [3/3] Demarrage de l'application...
)
echo.
echo   Application : http://localhost:%PORT%
echo   Les autres postes du reseau peuvent utiliser http://IP-DE-CE-PC:%PORT%
echo   ^(le navigateur s'ouvre automatiquement^)
echo   Laissez cette fenetre OUVERTE. Arret : Ctrl+C.
echo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%"
"%PHPCMD%" -d post_max_size=24M -d upload_max_filesize=24M -S 0.0.0.0:%PORT% router.php
echo.
echo Serveur arrete. Appuyez sur une touche pour fermer.
pause >nul
