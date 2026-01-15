@echo off
echo ============================================
echo   Instalando inicio automatico
echo ============================================
echo.

:: Get the current directory
set "BRIDGE_PATH=%~dp0"

:: Create VBS script to run hidden (no black window)
echo Creating launcher script...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%BRIDGE_PATH%"
echo WshShell.Run "cmd /c node index.js", 0, False
) > "%BRIDGE_PATH%start-hidden.vbs"

:: Create shortcut in Startup folder
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Creating startup shortcut...
(
echo Set oWS = WScript.CreateObject("WScript.Shell"^)
echo sLinkFile = "%STARTUP%\VetShelter-Hardware-Bridge.lnk"
echo Set oLink = oWS.CreateShortcut(sLinkFile^)
echo oLink.TargetPath = "%BRIDGE_PATH%start-hidden.vbs"
echo oLink.WorkingDirectory = "%BRIDGE_PATH%"
echo oLink.Description = "VetShelter Hardware Bridge"
echo oLink.Save
) > "%TEMP%\create-shortcut.vbs"
cscript //nologo "%TEMP%\create-shortcut.vbs"
del "%TEMP%\create-shortcut.vbs"

echo.
echo ============================================
echo   [OK] Instalado correctamente!
echo ============================================
echo.
echo El servidor se iniciara automaticamente
echo cuando Windows arranque.
echo.
echo Para desinstalar, elimina el acceso directo de:
echo %STARTUP%
echo.
pause
