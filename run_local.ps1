# Uruchamia aplikację w trybie produkcyjnym na localhost:5000
$ErrorActionPreference = "Stop"

# 1. Zbuduj frontend (jeśli dist/ nie istnieje)
if (-not (Test-Path "frontend\dist\index.html")) {
    Write-Host "Budowanie frontendu..." -ForegroundColor Cyan
    Push-Location frontend
    npm install
    npm run build
    Pop-Location
}

# 2. Uruchom backend (serwuje API + frontend)
Write-Host "Uruchamianie Cyklia na http://127.0.0.1:5000" -ForegroundColor Green
& ".venv\Scripts\python.exe" "backend\app.py"
