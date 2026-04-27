Write-Host "========================================="
Write-Host "      Starting Manufacturing Platform    "
Write-Host "========================================="
# Start HashiCorp Vault (Key Management)
Write-Host "Starting HashiCorp Vault..."
$vaultProcess = Start-Process -FilePath ".\vault.exe" -ArgumentList "server -dev -dev-root-token-id=project-root-token -dev-listen-address=127.0.0.1:8200" -WindowStyle Normal -PassThru
Write-Host "Vault started with PID: $($vaultProcess.Id)"
# Give Vault time to start
Start-Sleep -Seconds 2

# Seed Vault (In dev mode, we need to seed it on every start as it's in-memory)
Write-Host "Seeding Vault with credentials..."
python backend/scripts/seed_vault_from_env.py

# Start Backend
Write-Host "Starting Backend (Port 8001)..."
$backendProcess = Start-Process -FilePath "python" -ArgumentList "backend/run.py" -WindowStyle Normal -PassThru
Write-Host "Backend started with PID: $($backendProcess.Id)"

# Start Frontend
Write-Host "Starting Frontend (Port 3000)..."
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory "frontend" -WindowStyle Normal -PassThru
Write-Host "Frontend started with PID: $($frontendProcess.Id)"

Write-Host "========================================="
Write-Host "All services have been launched."

# Save PIDs to a file for easy stopping later
$pids = @{
    "Vault" = $vaultProcess.Id
    "Backend" = $backendProcess.Id
    "Frontend" = $frontendProcess.Id
}
$pids | ConvertTo-Json | Out-File -FilePath ".services-pids.json" -Encoding UTF8

Write-Host "Process IDs saved to .services-pids.json"
Write-Host "You can use Stop-All-Services.ps1 to stop them."
Write-Host "========================================="
