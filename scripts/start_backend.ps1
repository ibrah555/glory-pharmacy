# start_backend.ps1
# This script starts the backend server for the Glory Pharmacy Management System.

$backendDir = "C:\xampp\htdocs\glory-pharmacy\backend"
$logFile = "C:\xampp\htdocs\glory-pharmacy\scripts\backend_startup.log"

# Create logs directory if it doesn't exist
$logDir = [System.IO.Path]::GetDirectoryName($logFile)
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force
}

# Function to log messages
function Log-Message {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append
}

Log-Message "Starting backend server recovery in $backendDir..."

if (Test-Path $backendDir) {
    Set-Location $backendDir
    Log-Message "Navigated to $backendDir"
    
    # Start the server and redirect output
    Log-Message "Executing npm start..."
    npm start >> $logFile 2>&1
} else {
    Log-Message "ERROR: Backend directory not found at $backendDir"
}
