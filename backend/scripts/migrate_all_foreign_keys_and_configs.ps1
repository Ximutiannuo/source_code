# Database Migration Script: Add Foreign Keys and Create Config Table
# Execution Order:
# 1. Create system_configs table
# 2. Add foreign key constraints
# 3. Initialize system configs

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Migration: Foreign Keys and Config Table" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location $PSScriptRoot\..

# 1. Create system_configs table
Write-Host "Step 1/3: Creating system_configs table..." -ForegroundColor Yellow
python scripts\migrate_create_system_configs_table.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create system_configs table" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Add foreign key constraints
Write-Host "Step 2/3: Adding foreign key constraints..." -ForegroundColor Yellow
python scripts\migrate_add_foreign_keys.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to add foreign key constraints" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Initialize system configs
Write-Host "Step 3/3: Initializing system configs..." -ForegroundColor Yellow
python scripts\init_system_configs.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to initialize system configs" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Migration completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

