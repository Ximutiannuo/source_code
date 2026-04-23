# Update Vault app-policy to include read access to secret/app-config
# This script updates the app-policy to allow reading SECRET_KEY from Vault

$ErrorActionPreference = "Stop"

# Check if Vault is configured
$vaultAddr = [System.Environment]::GetEnvironmentVariable("VAULT_ADDR", "Machine")
$vaultToken = [System.Environment]::GetEnvironmentVariable("VAULT_TOKEN", "Machine")

if (-not $vaultAddr) {
    Write-Host "ERROR: VAULT_ADDR environment variable is not set." -ForegroundColor Red
    Write-Host "Please set VAULT_ADDR first:" -ForegroundColor Yellow
    Write-Host '  [System.Environment]::SetEnvironmentVariable("VAULT_ADDR", "http://127.0.0.1:8200", "Machine")' -ForegroundColor Cyan
    exit 1
}

if (-not $vaultToken) {
    Write-Host "WARNING: VAULT_TOKEN environment variable is not set." -ForegroundColor Yellow
    Write-Host "This script requires Root Token to update policies." -ForegroundColor Yellow
    Write-Host "Please set VAULT_TOKEN (use Root Token for policy updates):" -ForegroundColor Cyan
    Write-Host '  $env:VAULT_TOKEN = "your-root-token"' -ForegroundColor Cyan
    Write-Host "Or set it permanently:" -ForegroundColor Cyan
    Write-Host '  [System.Environment]::SetEnvironmentVariable("VAULT_TOKEN", "your-root-token", "Machine")' -ForegroundColor Cyan
    Write-Host "`nYou can also set it for this session only:" -ForegroundColor Yellow
    Write-Host '  $env:VAULT_TOKEN = "hvs.eHreO999y4gf8qE853lVl85x"  # Your Root Token' -ForegroundColor Cyan
    exit 1
}

# Set environment variables for current session
$env:VAULT_ADDR = $vaultAddr
$env:VAULT_TOKEN = $vaultToken

# Vault executable path
$vaultExe = "C:\vault\vault.exe"
if (-not (Test-Path $vaultExe)) {
    Write-Host "ERROR: Vault executable not found at $vaultExe" -ForegroundColor Red
    exit 1
}

# Create temp directory if it doesn't exist
$tempDir = "C:\temp"
if (-not (Test-Path $tempDir)) {
    Write-Host "Creating directory: $tempDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# Policy file path
$policyFile = "$tempDir\app-policy.hcl"

Write-Host "`n=== Updating Vault app-policy ===" -ForegroundColor Cyan
Write-Host "Vault Address: $vaultAddr" -ForegroundColor Gray
Write-Host "Policy File: $policyFile" -ForegroundColor Gray

# Read current policy (if exists)
Write-Host "`nReading current app-policy..." -ForegroundColor Yellow
$currentPolicy = ""
try {
    $currentPolicy = & $vaultExe policy read app-policy 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Current policy found:" -ForegroundColor Green
        Write-Host $currentPolicy -ForegroundColor Gray
    } else {
        Write-Host "Policy 'app-policy' does not exist, will create new one." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Policy 'app-policy' does not exist, will create new one." -ForegroundColor Yellow
}

# Build new policy content
$policyContent = @"
# App Policy for ProjectControls
# Allows reading database credentials and app configuration

# Database roles (existing permissions)
path "secret/data/db-roles/*" {
  capabilities = ["read"]
}

path "secret/metadata/db-roles/*" {
  capabilities = ["read", "list"]
}

# App configuration (for SECRET_KEY)
path "secret/data/app-config" {
  capabilities = ["read"]
}

path "secret/metadata/app-config" {
  capabilities = ["read", "list"]
}
"@

# Write policy to file
Write-Host "`nWriting policy to file..." -ForegroundColor Yellow
try {
    # Use UTF-8 encoding without BOM (Vault expects clean UTF-8)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($policyFile, $policyContent, $utf8NoBom)
    Write-Host "Policy file written successfully." -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to write policy file: $_" -ForegroundColor Red
    exit 1
}

# Write policy to Vault
Write-Host "`nWriting policy to Vault..." -ForegroundColor Yellow
try {
    & $vaultExe policy write app-policy $policyFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy 'app-policy' updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to write policy to Vault (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to write policy to Vault: $_" -ForegroundColor Red
    exit 1
}

# Verify policy
Write-Host "`nVerifying policy..." -ForegroundColor Yellow
try {
    $verifyPolicy = & $vaultExe policy read app-policy 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy verification successful:" -ForegroundColor Green
        Write-Host $verifyPolicy -ForegroundColor Gray
    } else {
        Write-Host "WARNING: Could not verify policy (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not verify policy: $_" -ForegroundColor Yellow
}

# Clean up temp file (optional)
Write-Host "`nCleaning up..." -ForegroundColor Yellow
if (Test-Path $policyFile) {
    Remove-Item $policyFile -Force
    Write-Host "Temporary policy file removed." -ForegroundColor Gray
}

Write-Host "`n=== Policy update completed ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Test reading SECRET_KEY with app-policy token:" -ForegroundColor Yellow
Write-Host "   `$env:VAULT_TOKEN = 'your-app-policy-token'" -ForegroundColor Gray
Write-Host "   C:\vault\vault.exe kv get -field=secret_key secret/app-config" -ForegroundColor Gray
Write-Host "`n2. If successful, the app-policy token can now read SECRET_KEY from Vault." -ForegroundColor Yellow
Write-Host "`n" -ForegroundColor White
