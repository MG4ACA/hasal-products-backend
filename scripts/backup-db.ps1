# ============================================================
# backup-db.ps1 — MySQL database backup script
# Usage: .\scripts\backup-db.ps1
# Creates a timestamped .sql dump in scripts/backups/
# ============================================================

# Load .env variables
$envFile = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $name  = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"').Trim("'")
      [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$DB_PASS = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "hasal_pos_dev" }

# Create backups directory
$backupsDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupsDir)) {
  New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupsDir "${DB_NAME}_backup_${timestamp}.sql"

Write-Host "Backing up database: $DB_NAME @ ${DB_HOST}:${DB_PORT}"
Write-Host "Output: $backupFile"

# Set password via env var to avoid password prompt / warning
$env:MYSQL_PWD = $DB_PASS

$args = @(
  "--host=$DB_HOST",
  "--port=$DB_PORT",
  "--user=$DB_USER",
  "--single-transaction",   # consistent snapshot without locking tables
  "--routines",             # include stored procedures/functions
  "--triggers",             # include triggers
  "--set-gtid-purged=OFF",  # avoid GTID issues on restore
  $DB_NAME
)

& mysqldump @args | Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -eq 0) {
  $size = (Get-Item $backupFile).Length / 1KB
  Write-Host "Backup COMPLETE: $([math]::Round($size, 1)) KB → $backupFile"
} else {
  Write-Host "Backup FAILED (exit code $LASTEXITCODE)" -ForegroundColor Red
  Remove-Item $backupFile -ErrorAction SilentlyContinue
  exit 1
}
