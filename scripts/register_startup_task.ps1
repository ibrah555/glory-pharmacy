# register_startup_task.ps1
# This script registers the backend startup script as a Windows Scheduled Task.

$taskName = "GloryPharmacyBackendStarter"
$scriptPath = "C:\xampp\htdocs\glory-pharmacy\scripts\start_backend.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

# Register the task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force

Write-Host "Scheduled Task '$taskName' has been registered for path: $scriptPath"
Write-Host "It will run the next time you log in."
