$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Test-Path -LiteralPath '.env') { Write-Host 'Keeping existing .env and credentials.'; exit 0 }
function New-Password {
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$dbPassword = New-Password
$adminPassword = New-Password
$config = "DB_PASSWORD=$dbPassword`nADMIN_EMAIL=admin@goihue.local`nADMIN_PASSWORD=$adminPassword`n"
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), $config, (New-Object Text.UTF8Encoding($false)))
Write-Host 'Created local .env. Read ADMIN_EMAIL and ADMIN_PASSWORD there. Do not share this file.'
