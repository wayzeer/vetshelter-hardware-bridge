@echo off
echo ============================================
echo   Desinstalando inicio automatico
echo ============================================
echo.

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if exist "%STARTUP%\VetShelter-Hardware-Bridge.lnk" (
    del "%STARTUP%\VetShelter-Hardware-Bridge.lnk"
    echo [OK] Acceso directo eliminado
) else (
    echo [!] No se encontro acceso directo
)

echo.
echo El servidor ya no se iniciara automaticamente.
echo.
pause
