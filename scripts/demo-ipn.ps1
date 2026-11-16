<#
.SYNOPSIS
  Demo IPN sender for the Gói Huế VietQR checkout (classroom demo).

.DESCRIPTION
  Plays the role of the payment provider (in production this is SePay or a
  gateway such as VNPAY): it notifies the backend that money arrived for an
  order. The backend verifies the HMAC-SHA256 signature and matches the
  amount against the locked order total before recording anything:

    -Case ok             correct amount + valid signature   -> PAID
    duplicate            run "ok" again with the SAME -TransactionId
                         -> DUPLICATE_IGNORED (idempotent, nothing changes)
    -Case wrong-amount   amount differs from the order total -> REVIEW
    -Case bad-signature  signature made with a wrong secret  -> HTTP 401
    late payment         run "ok" after the 15-minute session expired
                         (order already auto-cancelled)     -> REVIEW

.PARAMETER OrderNumber
  The order number shown on the customer's QR screen, e.g. GH-AB12CD34.

.PARAMETER Amount
  The order total (items + shipping) in VND, as shown on the QR screen.

.EXAMPLE
  .\scripts\demo-ipn.ps1 -OrderNumber GH-AB12CD34 -Amount 115000
  .\scripts\demo-ipn.ps1 -OrderNumber GH-AB12CD34 -Amount 115000 -TransactionId DEMO-001   # twice = duplicate
  .\scripts\demo-ipn.ps1 -OrderNumber GH-AB12CD34 -Amount 115000 -Case wrong-amount
  .\scripts\demo-ipn.ps1 -OrderNumber GH-AB12CD34 -Amount 115000 -Case bad-signature
#>
param(
    [Parameter(Mandatory = $true)][string]$OrderNumber,
    [Parameter(Mandatory = $true)][long]$Amount,
    [ValidateSet("ok", "wrong-amount", "bad-signature")][string]$Case = "ok",
    [string]$TransactionId = "",
    [string]$Secret = $env:APP_IPN_SECRET,
    [string]$ApiBase = "http://127.0.0.1:8088/api/v1"
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8

if ([string]::IsNullOrWhiteSpace($TransactionId)) {
    $TransactionId = "DEMO-" + (Get-Date -Format "yyyyMMddHHmmss")
}
$effectiveAmount = $Amount
if ([string]::IsNullOrWhiteSpace($Secret)) {
    throw "Set APP_IPN_SECRET or supply -Secret to match the local demo API."
}
$effectiveSecret = $Secret
switch ($Case) {
    "wrong-amount" { $effectiveAmount = $Amount + 1000 }
    "bad-signature" { $effectiveSecret = "wrong-secret" }
}

$canonical = "$OrderNumber|$effectiveAmount|$TransactionId"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($effectiveSecret)
$signature = [BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))).Replace("-", "").ToLower()

$body = @{
    orderNumber   = $OrderNumber
    amount        = $effectiveAmount
    transactionId = $TransactionId
    signature     = $signature
} | ConvertTo-Json

Write-Host "POST $ApiBase/payments/ipn"
Write-Host "  case=$Case order=$OrderNumber amount=$effectiveAmount txn=$TransactionId"
try {
    $response = Invoke-WebRequest -Uri "$ApiBase/payments/ipn" -Method Post -ContentType "application/json" -Body $body
    Write-Host ("HTTP " + [int]$response.StatusCode + "  " + $response.Content)
} catch {
    $resp = $_.Exception.Response
    if ($null -ne $resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host ("HTTP " + [int]$resp.StatusCode + "  " + $reader.ReadToEnd())
    } else {
        Write-Host ("Request failed: " + $_.Exception.Message)
    }
}
