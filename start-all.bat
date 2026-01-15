@echo off
echo ============================================
echo   VetShelter Hardware Bridge + ngrok
echo ============================================
echo.

set "NGROK_DOMAIN=capital-bird-jolly.ngrok-free.app"

echo Iniciando servidor Node.js...
start /B cmd /c "node index.js"

echo Esperando 2 segundos...
timeout /t 2 /nobreak >nul

echo Iniciando ngrok con dominio fijo...
echo URL: https://%NGROK_DOMAIN%
echo.
ngrok http 3456 --domain %NGROK_DOMAIN%
