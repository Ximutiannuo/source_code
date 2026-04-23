# ProjectControls - Backup Schedule Service
# This script runs as a long-running service to perform backups at scheduled times.
# ASCII only for Windows PowerShell compatibility.

$BACKUP_HOUR = 2 # Execute at 02:00 AM

function Write-ServiceLog {
    param([string]$Message)
    $LogMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [SCHEDULE] $Message"
    Write-Host $LogMsg
}

Write-ServiceLog "Backup Scheduler Service Started."
Write-ServiceLog "Target backup time: $($BACKUP_HOUR):00 daily."

while ($true) {
    $now = Get-Date
    
    # Check if it's the target hour and we haven't backed up in the last 12 hours
    if ($now.Hour -eq $BACKUP_HOUR) {
        Write-ServiceLog "It's backup time! Fetching credentials from Vault..."
        
        $dbHost = "10.78.44.17"
        $vaultAdminUser = & C:\vault\vault.exe kv get -field=username secret/db-roles/system_admin 2>$null
        $vaultAdminPass = & C:\vault\vault.exe kv get -field=password secret/db-roles/system_admin 2>$null
        
        if ($vaultAdminUser -and $vaultAdminPass) {
            Write-ServiceLog "Credentials fetched. Starting Backup-Database.ps1..."
            & "$PSScriptRoot\Backup-Database.ps1" -DbUser "$vaultAdminUser" -DbPass "$vaultAdminPass" -DbHost "$dbHost"
            Write-ServiceLog "Backup task finished. Sleeping until tomorrow."
        } else {
            Write-ServiceLog "ERROR: Could not fetch credentials from Vault. Will retry in 1 hour."
        }
        
        # Sleep for an hour to ensure we don't trigger again in the same hour
        Start-Sleep -Seconds 3605 
    } else {
        # Check every 10 minutes
        Start-Sleep -Seconds 600
    }
}
