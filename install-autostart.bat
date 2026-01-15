@echo off
echo ============================================
echo   Instalando inicio automatico
echo ============================================
echo.

:: Get the current directory
set "BRIDGE_PATH=%~dp0"
set "NGROK_DOMAIN=capital-bird-jolly.ngrok-free.app"

:: Create VBS script to run both services hidden
echo Creating launcher script...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%BRIDGE_PATH%"
echo ' Start the Node.js server
echo WshShell.Run "cmd /c node index.js", 0, False
echo ' Wait 2 seconds for server to start
echo WScript.Sleep 2000
echo ' Start ngrok with static domain
echo WshShell.Run "cmd /c ngrok http 3456 --domain %NGROK_DOMAIN%", 0, False
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
echo El servidor + ngrok se iniciaran automaticamente
echo cuando Windows arranque.
echo.
echo URL fija: https://%NGROK_DOMAIN%
echo.
echo IMPORTANTE: Asegurate de haber ejecutado:
echo   ngrok config add-authtoken TU_TOKEN
echo.
echo Para desinstalar, ejecuta: uninstall-autostart.bat
echo.
pause
