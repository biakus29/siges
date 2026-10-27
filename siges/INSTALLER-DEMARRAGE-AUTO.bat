@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Aurel School Compta - Demarrage automatique
echo ==================================================
echo    DEMARRAGE AUTOMATIQUE AVEC WINDOWS
echo ==================================================
echo.
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v AurelSchoolCompta /t REG_SZ /d "\"%~dp0DEMARRAGE-SILENCIEUX.bat\"" /f >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Impossible d'ecrire dans le registre.
  pause
  exit /b 1
)
echo [OK] Le demarrage automatique est installe.
echo.
echo   Aurel School Compta demarrera automatiquement avec Windows
echo   (fenetre reduite, port 4000 par defaut).
echo.
echo   Personnalisation :
echo     - Port     : creez un fichier  port.txt  contenant le numero (ex : 8080)
echo     - Navigateur ouvert au demarrage : creez un fichier vide
echo                  OUVRIR-NAVIGATEUR.txt
echo     - Retirer  : lancez  RETIRER-DEMARRAGE-AUTO.bat
echo.
echo   NB : si vous utilisez XAMPP/WAMP (Apache), preferez l'installation
echo   des services Apache/MySQL depuis le panneau XAMPP.
echo.
pause
