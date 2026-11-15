@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Debes instalar Node.js 22 o superior para ejecutar FilaCero.
 pause
 exit /b 1
)
echo Iniciando FilaCero PWA en http://localhost:3000 ...
echo Para cerrar la aplicacion, presiona Ctrl+C.
node server\index.mjs
pause
