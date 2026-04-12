param(
  [int]$WatchSeconds = 180,
  [int]$PollSeconds = 5,
  [string]$IpnUrl = "https://pay.bookstore.ailab.engineer/payment_ipn"
)

$ErrorActionPreference = "Continue"

function Write-Section($title) {
  Write-Host ""
  Write-Host "==== $title ====" -ForegroundColor Cyan
}

function Probe-Url($url) {
  Write-Host "Probing: $url"
  $output = & curl.exe -sS -i --max-time 15 $url 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "curl failed: $output" -ForegroundColor Yellow
    return
  }

  $lines = $output -split "`r?`n"
  $statusLine = $lines | Where-Object { $_ -match "^HTTP/" } | Select-Object -First 1
  if ($statusLine) {
    Write-Host "Status: $statusLine" -ForegroundColor Green
  }

  $bodyStart = ($lines | Select-String -Pattern "^$" | Select-Object -First 1).LineNumber
  if ($bodyStart) {
    $body = $lines[$bodyStart..($lines.Count - 1)] -join "`n"
    if ($body.Trim().Length -gt 0) {
      Write-Host "Body: $body"
    }
  }
}

function Get-RecentLogs($container, $pattern, $since) {
  $raw = & docker logs --since $since $container 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Cannot read logs from ${container}: $raw" -ForegroundColor Yellow
    return @()
  }

  $lines = $raw -split "`r?`n"
  return $lines | Where-Object { $_ -match $pattern }
}

Write-Section "1) Endpoint probe"
Probe-Url $IpnUrl
Probe-Url "http://pay.bookstore.ailab.engineer/payment_ipn"

Write-Section "2) Recent logs (last 15m)"
 $vnpRecent = Get-RecentLogs -container "commerce-vnpay-service" -pattern "payment_ipn|GET /payment_ipn|POST /api/create-payment-url" -since "15m"
 $payRecent = Get-RecentLogs -container "commerce-payment-service" -pattern "internal/vnpay-confirm|POST /payments/internal/vnpay-confirm" -since "15m"

Write-Host "commerce-vnpay-service:"
if ($vnpRecent.Count -eq 0) {
  Write-Host "  (no matching logs)" -ForegroundColor Yellow
} else {
  $vnpRecent | ForEach-Object { Write-Host "  $_" }
}

Write-Host "commerce-payment-service:"
if ($payRecent.Count -eq 0) {
  Write-Host "  (no matching logs)" -ForegroundColor Yellow
} else {
  $payRecent | ForEach-Object { Write-Host "  $_" }
}

Write-Section "3) Live watch for IPN hits"
Write-Host "Now complete a VNPay sandbox payment in browser."
Write-Host "Watching for $WatchSeconds seconds..."

$end = (Get-Date).AddSeconds($WatchSeconds)
while ((Get-Date) -lt $end) {
  $vnpNow = Get-RecentLogs -container "commerce-vnpay-service" -pattern "GET /payment_ipn|payment_ipn" -since "${PollSeconds}s"
  $payNow = Get-RecentLogs -container "commerce-payment-service" -pattern "POST /payments/internal/vnpay-confirm|internal/vnpay-confirm" -since "${PollSeconds}s"

  if ($vnpNow.Count -gt 0) {
    Write-Host "[commerce-vnpay-service]" -ForegroundColor Green
    $vnpNow | ForEach-Object { Write-Host "  $_" }
  }

  if ($payNow.Count -gt 0) {
    Write-Host "[commerce-payment-service]" -ForegroundColor Green
    $payNow | ForEach-Object { Write-Host "  $_" }
  }

  Start-Sleep -Seconds $PollSeconds
}

Write-Section "4) Final verdict"
$vnpFinal = Get-RecentLogs -container "commerce-vnpay-service" -pattern "GET /payment_ipn|payment_ipn" -since "${WatchSeconds}s"
$payFinal = Get-RecentLogs -container "commerce-payment-service" -pattern "POST /payments/internal/vnpay-confirm|internal/vnpay-confirm" -since "${WatchSeconds}s"

if ($vnpFinal.Count -eq 0) {
  Write-Host "No IPN hit detected in commerce-vnpay-service during watch window." -ForegroundColor Red
  Write-Host "=> VNPay probably did not call IPN, or callback was blocked before reaching origin."
} else {
  Write-Host "IPN hit detected in commerce-vnpay-service." -ForegroundColor Green
}

if ($payFinal.Count -eq 0) {
  Write-Host "No internal vnpay-confirm call detected in commerce-payment-service." -ForegroundColor Yellow
  Write-Host "=> Callback reached commerce-vnpay-service but confirmation may have failed before payment update."
} else {
  Write-Host "Internal vnpay-confirm call detected in commerce-payment-service." -ForegroundColor Green
}
