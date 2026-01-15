@echo off
echo ============================================
echo   VetShelter Hardware Bridge - Setup
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo.
    echo Por favor, descarga e instala Node.js desde:
    echo https://nodejs.org/
    echo.
    echo Despues de instalar, reinicia y ejecuta este script de nuevo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado:
node --version
echo.

:: Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] ngrok no encontrado. Instalando...
    echo.
    winget install ngrok.ngrok --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar ngrok
        echo Instala manualmente desde: https://ngrok.com/download
        pause
        exit /b 1
    )
    echo.
    echo [OK] ngrok instalado.
    echo [!] IMPORTANTE: Cierra esta ventana y abre una nueva para continuar.
    pause
    exit /b 0
)

echo [OK] ngrok encontrado:
ngrok version
echo.

:: Install npm dependencies
echo Instalando dependencias de Node.js...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error instalando dependencias
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas
echo.

:: Check ngrok auth
echo ============================================
echo   Configuracion de ngrok
echo ============================================
echo.
echo Necesitas configurar tu token de ngrok.
echo.
echo 1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Copia tu authtoken
echo 3. Ejecuta: ngrok config add-authtoken TU_TOKEN
echo.
echo ============================================
echo   Siguiente paso
echo ============================================
echo.
echo Despues de configurar el authtoken, ejecuta:
echo.
echo   start-all.bat     (para probar manualmente)
echo   install-autostart.bat  (para inicio automatico)
echo.
echo URL fija: https://capital-bird-jolly.ngrok-free.app
echo.
pause
