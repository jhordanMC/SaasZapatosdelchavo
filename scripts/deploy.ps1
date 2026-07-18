# Compila el proyecto y publica el resultado en el repo de despliegue (RepoSaasPruebas),
# que es el que Azure Static Web Apps observa para publicar el sitio.
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistDir     = Join-Path $ProjectRoot "dist\ProyectoSaasAlba\browser"
$DeployDir   = "D:\Alba\Saas\DespliegueFront\RepoSaasPruebas"

if (-not (Test-Path $DeployDir)) {
    throw "No se encontro el repo de despliegue en '$DeployDir'."
}

Write-Host "==> Compilando (produccion)..." -ForegroundColor Cyan
Set-Location $ProjectRoot
npm run build
if ($LASTEXITCODE -ne 0) { throw "La compilacion fallo (exit code $LASTEXITCODE)." }

if (-not (Test-Path $DistDir)) {
    throw "No se encontro la salida del build en '$DistDir'."
}

Write-Host "==> Sincronizando dist -> $DeployDir ..." -ForegroundColor Cyan
robocopy $DistDir $DeployDir /MIR /XD .git .github /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy fallo (exit code $LASTEXITCODE)." }

Set-Location $DeployDir

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "==> Sin cambios respecto al ultimo deploy. Nada que publicar." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    exit 0
}

Write-Host "==> Cambios detectados:" -ForegroundColor Cyan
git status --short

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git add -A
git commit -m "deploy: build $timestamp"
git push

Set-Location $ProjectRoot
Write-Host "==> Deploy publicado. Azure Static Web Apps iniciara el despliegue en unos minutos." -ForegroundColor Green
