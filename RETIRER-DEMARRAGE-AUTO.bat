@echo off
chcp 65001 >nul
title Aurel School Compta - Retirer le demarrage automatique
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v AurelSchoolCompta /f >nul 2>nul
echo [OK] Le demarrage automatique a ete retire.
echo L'application reste utilisable via DEMARRER-WINDOWS.bat
pause
