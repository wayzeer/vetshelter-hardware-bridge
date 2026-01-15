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
    echo Despues de instalar, ejecuta este script de nuevo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado:
node --version
echo.

:: Install dependencies
echo Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Error instalando dependencias
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas
echo.

:: List printers
echo ============================================
echo   Impresoras disponibles en el sistema:
echo ============================================
wmic printer get name
echo.

echo ============================================
echo   Configuracion
echo ============================================
echo.
echo Edita el archivo .env y cambia PRINTER_INTERFACE
echo con el nombre exacto de tu impresora termica.
echo.
echo Ejemplo: PRINTER_INTERFACE=printer:POS-58
echo.
echo ============================================
echo   Para iniciar el servidor:
echo ============================================
echo.
echo   npm start
echo.
echo ============================================
pause
