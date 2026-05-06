# create_startup_shortcut.ps1
# This script creates a shortcut to our backend startup script in the Windows Startup folder.

$scriptPath = "C:\xampp\htdocs\glory-pharmacy\scripts\start_backend.ps1"
$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = Join-Path $startupFolder "GloryPharmacyBackend.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$Shortcut.WorkingDirectory = "C:\xampp\htdocs\glory-pharmacy\scripts"
$Shortcut.IconLocation = "powershell.exe"
$Shortcut.Save()

Write-Host "Startup shortcut created at: $shortcutPath"
Write-Host "Pointing to: $scriptPath"
Write-Host "This will run every time you log in."
