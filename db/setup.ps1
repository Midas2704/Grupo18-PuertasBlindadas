# Preparación I2 mediante Prisma. No ejecuta schema.sql ni seed.sql heredados.
$ErrorActionPreference = 'Stop'
$directorioBackend = Join-Path $PSScriptRoot '..\Controladores'
Push-Location $directorioBackend
try {
    if (-not (Test-Path -LiteralPath '.env')) { throw 'Copia .env.example a .env y configura DATABASE_URL antes de continuar.' }
    foreach ($paso in @('prisma:validate', 'prisma:generate', 'db:migrate', 'db:seed')) {
        & npm.cmd run $paso
        if ($LASTEXITCODE -ne 0) { throw "Falló $paso. No se continúa con el siguiente paso." }
    }
} finally { Pop-Location }
