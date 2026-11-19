# Cap nhat ban moi tren may chu Windows (chay tren may chu, hoac tu laptop qua SSH - xem docs/DEPLOY.md muc 5.1).
# Thu tu: sao luu DB -> git pull -> build 3 image -> bat lai (khong build lai) -> cho backend healthy.
# Dung lai ngay khi mot buoc loi. Thong bao khong dau de PowerShell 5.1 doc dung bang ma nao cung duoc.
#
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1            # mac dinh
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Https     # dang chay kem Caddy (muc 3.1)
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -SkipPull  # build lai code dang co, khong pull
param(
    [switch]$Https,
    [switch]$SkipPull,
    [switch]$SkipBackup,
    [int]$HealthTimeoutSeconds = 300,
    # Ngoai repo de git khong thay va khong lo commit nham
    [string]$BackupDir = ''
)

# Khong dung 'Stop': PowerShell 5.1 coi dong stderr cua docker/git la loi. Moi lenh ngoai deu kiem $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $BackupDir) { $BackupDir = Join-Path (Split-Path -Parent $root) 'wpe-backups' }

$composeArgs = @('-f', 'docker-compose.prod.yml')
if ($Https) { $composeArgs += @('-f', 'deploy/docker-compose.https.yml') }
$composeArgs += @('--env-file', 'deploy/.env')

function Write-Step([string]$message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Stop-Deploy([string]$message) { Write-Host "LOI: $message" -ForegroundColor Red; exit 1 }
function Invoke-Native([string]$what, [scriptblock]$command) {
    & $command
    if ($LASTEXITCODE -ne 0) { Stop-Deploy "$what (ma loi $LASTEXITCODE)" }
}

if (-not (Test-Path 'deploy/.env')) { Stop-Deploy 'Khong thay deploy/.env. Lam theo muc 3 cua docs/DEPLOY.md truoc.' }
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) { Stop-Deploy 'Docker chua chay. Docker Desktop chi chay khi da dang nhap Windows tren may chu.' }

# 1. Sao luu DB (dinh dang custom cua pg_dump, khoi phuc bang pg_restore). Bo qua khi postgres chua chay (lan dau).
if (-not $SkipBackup) {
    Write-Step 'Sao luu co so du lieu'
    $pg = docker compose @composeArgs ps -q postgres
    if ($pg) {
        New-Item -ItemType Directory -Force $BackupDir -ErrorAction Stop | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $file = "wpe_db_$stamp.dump"
        $target = Join-Path $BackupDir $file
        # Ten user/DB lay tu bien moi truong cua container postgres (khong doc deploy/.env)
        $dumpCmd = 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/' + $file
        Invoke-Native 'pg_dump' { docker compose @composeArgs exec -T postgres sh -c $dumpCmd }
        Invoke-Native 'Chep ban sao luu ra may' { docker compose @composeArgs cp "postgres:/tmp/$file" $target }
        docker compose @composeArgs exec -T postgres rm -f "/tmp/$file" | Out-Null
        $size = [math]::Round((Get-Item $target).Length / 1KB)
        if ($size -lt 1) { Stop-Deploy "Ban sao luu $target rong, dung lai." }
        Write-Host "Da luu $target ($size KB)"
    } else {
        Write-Host 'Postgres chua chay, bo qua sao luu.'
    }
}

# 2. Lay code moi
if (-not $SkipPull) {
    Write-Step 'Lay code moi (git pull)'
    $dirty = git status --porcelain --untracked-files=no
    if ($dirty) { Stop-Deploy "Code tren may chu dang bi sua tay:`n$dirty`nCat hoac bo cac thay doi do roi chay lai." }
    Invoke-Native 'git pull' { git pull --ff-only }
    git log -1 --format='Ban hien tai: %h %s'
}

# 3. Build tung image (Compose v5 build qua bake bi chan --allow=fs.read, xem muc 3 cua docs/DEPLOY.md)
Write-Step 'Build backend'
Invoke-Native 'Build backend' { docker build -f deploy/backend.Dockerfile -t wpe-prod-backend wpe-backend }
Write-Step 'Build ai-service'
Invoke-Native 'Build ai-service' { docker build -f deploy/ai-service.Dockerfile -t wpe-prod-ai-service wpe-ai-service }
Write-Step 'Build frontend'
Invoke-Native 'Build frontend' { docker build -f deploy/frontend.Dockerfile --build-context deploy=./deploy --build-context shared=./shared -t wpe-prod-frontend wpe-frontend }

# 4. Bat lai cac container co image moi
Write-Step 'Khoi dong lai he thong'
Invoke-Native 'docker compose up' { docker compose @composeArgs up -d --no-build }

# 5. Cho backend healthy (Flyway va buoc don du lieu chay luc khoi dong)
Write-Step 'Cho backend san sang'
$backend = docker compose @composeArgs ps -q backend
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
$status = ''
while ((Get-Date) -lt $deadline) {
    $status = docker inspect --format '{{.State.Health.Status}}' $backend
    if ($status -eq 'healthy') { break }
    if ($status -eq 'unhealthy') { break }
    Start-Sleep -Seconds 5
}
if ($status -ne 'healthy') {
    docker compose @composeArgs logs --tail 60 backend
    Stop-Deploy "Backend chua healthy (trang thai: $status). Xem log o tren. Ban sao luu DB nam trong $BackupDir."
}

docker compose @composeArgs ps
Write-Host "`nDeploy xong." -ForegroundColor Green
