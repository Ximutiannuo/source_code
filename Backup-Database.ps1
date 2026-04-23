# Database Backup Script for ProjectControls - Per-Table Backup Mode
# ASCII ONLY - NO UNICODE CHARACTERS

param(
    [Parameter(Mandatory=$false)]
    [string]$DbUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$DbPass = "",
    
    [Parameter(Mandatory=$false)]
    [string]$DbHost = "localhost"
)

# ==========================================
# 1. Configuration
# ==========================================
$DB_NAME = "projectcontrols"
$DB_PORT = "3306"

# Backup storage root directory
$BACKUP_ROOT = "D:\DatabaseBackups\ProjectControls"
$LOG_FILE = "$PSScriptRoot\logs\backup.log"

# MySQL Paths
$MYSQL_PATH = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$MYSQLDUMP_PATH = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" 

# ==========================================
# 2. Initialize
# ==========================================
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$DATE_STR = Get-Date -Format "yyyyMMdd"

$DAILY_DIR = Join-Path $BACKUP_ROOT "Daily"
$WEEKLY_DIR = Join-Path $BACKUP_ROOT "Weekly"
$MONTHLY_DIR = Join-Path $BACKUP_ROOT "Monthly"
$LOG_DIR = Split-Path $LOG_FILE -Parent

# Temp directory for this specific backup session
$TEMP_SESSION_DIR = Join-Path $DAILY_DIR "temp_$TIMESTAMP"

foreach ($dir in @($DAILY_DIR, $WEEKLY_DIR, $MONTHLY_DIR, $LOG_DIR, $TEMP_SESSION_DIR)) {
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
}

function Write-Log {
    param([string]$Message)
    $LogMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $LogMsg
    $LogMsg | Out-File -FilePath $LOG_FILE -Append -Encoding ascii
}

# ==========================================
# 3. Execution
# ==========================================
Write-Log "Starting PER-TABLE backup: $DB_NAME (User: $DbUser, Host: $DbHost)"

# Use Environment Variable for password
$oldPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $DbPass

try {
    if ([string]::IsNullOrWhiteSpace($DbPass)) {
        throw "Database password is empty. Check Vault."
    }

    # 3.1 Get List of Tables
    Write-Log "Fetching table list..."
    $Tables = & $MYSQL_PATH --host=$DbHost --port=$DB_PORT --user=$DbUser -N -e "SHOW TABLES" $DB_NAME
    
    if ($LASTEXITCODE -ne 0 -or !$Tables) {
        throw "Failed to fetch table list."
    }

    # 3.2 Dump each table individually
    foreach ($Table in $Tables) {
        $TableFile = Join-Path $TEMP_SESSION_DIR "$Table.sql"
        Write-Log "Dumping table: $Table..."
        
        $DumpArgs = @(
            "--host=$DbHost",
            "--port=$DB_PORT",
            "--user=$DbUser",
            "--no-tablespaces",
            "--single-transaction",
            "--result-file=$TableFile",
            $DB_NAME,
            $Table
        )
        
        & $MYSQLDUMP_PATH $DumpArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Warning: Failed to dump table $Table"
        }
    }

    # 3.3 Dump Routines and Triggers separately
    Write-Log "Dumping routines and triggers..."
    $SchemaFile = Join-Path $TEMP_SESSION_DIR "_schema_routines.sql"
    & $MYSQLDUMP_PATH --host=$DbHost --port=$DB_PORT --user=$DbUser --no-data --no-tablespaces --routines --triggers --no-create-info --result-file=$SchemaFile $DB_NAME

    # 3.4 Compress the entire session directory
    $ZIP_FILE = Join-Path $DAILY_DIR "backup_$($DB_NAME)_$TIMESTAMP.zip"
    Write-Log "Compressing all tables into $ZIP_FILE..."
    Compress-Archive -Path "$TEMP_SESSION_DIR\*" -DestinationPath $ZIP_FILE -Force
    
    # Cleanup temp directory
    Remove-Item $TEMP_SESSION_DIR -Recurse -Force
    
    Write-Log "Backup successful: $ZIP_FILE"

    # ==========================================
    # 4. Archiving & 5. Cleanup (same retention logic)
    # ==========================================
    $DAY_OF_WEEK = (Get-Date).DayOfWeek
    $DAY_OF_MONTH = (Get-Date).Day
    if ($DAY_OF_WEEK -eq "Sunday") {
        Copy-Item $ZIP_FILE (Join-Path $WEEKLY_DIR "weekly_$DATE_STR.zip")
    }
    if ($DAY_OF_MONTH -eq 1) {
        Copy-Item $ZIP_FILE (Join-Path $MONTHLY_DIR "monthly_$DATE_STR.zip")
    }
    
    Get-ChildItem $DAILY_DIR -Filter "*.zip" | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } | Remove-Item -ErrorAction SilentlyContinue
    Write-Log "Cleanup completed."

} catch {
    Write-Log "ERROR: $_"
} finally {
    $env:MYSQL_PWD = $oldPwd
}
