param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutputPath = "endpoint-smoke-results.json"
)

$ErrorActionPreference = "Continue"
$base = $BaseUrl.TrimEnd("/")
$results = New-Object System.Collections.Generic.List[object]

function Clip {
  param([string]$Text, [int]$Max = 260)
  if ($null -eq $Text) { return "" }
  if ($Text.Length -le $Max) { return $Text }
  return $Text.Substring(0, $Max)
}

function Add-Result {
  param(
    [string]$Endpoint,
    [string]$Method,
    [string]$Case,
    [int]$Status,
    [string]$Response
  )

  $results.Add([pscustomobject]@{
    endpoint = $Endpoint
    method = $Method
    case = $Case
    status = $Status
    response = (Clip -Text $Response)
  }) | Out-Null
}

function Invoke-ApiTest {
  param(
    [string]$Endpoint,
    [string]$Method = "GET",
    [string]$Case,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body = $null,
    [int]$TimeoutSec = 30
  )

  $uri = "$base$Endpoint"
  $params = @{
    Uri = $uri
    Method = $Method
    UseBasicParsing = $true
    TimeoutSec = $TimeoutSec
  }

  if ($null -ne $Session) {
    $params["WebSession"] = $Session
  }

  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 12)
    $params["ContentType"] = "application/json"
  }

  try {
    $resp = Invoke-WebRequest @params
    Add-Result -Endpoint $Endpoint -Method $Method -Case $Case -Status ([int]$resp.StatusCode) -Response $resp.Content
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Content = $resp.Content }
  } catch {
    if ($_.Exception.Response) {
      $r = $_.Exception.Response
      $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
      $raw = $sr.ReadToEnd()
      Add-Result -Endpoint $Endpoint -Method $Method -Case $Case -Status ([int]$r.StatusCode) -Response $raw
      return [pscustomobject]@{ Status = [int]$r.StatusCode; Content = $raw }
    }

    Add-Result -Endpoint $Endpoint -Method $Method -Case $Case -Status -1 -Response $_.Exception.Message
    return [pscustomobject]@{ Status = -1; Content = $_.Exception.Message }
  }
}

$month = Get-Date -Format "yyyy-MM"
$anonSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Invoke-ApiTest -Endpoint "/api/auth/me" -Method "GET" -Case "unauthenticated me" -Session $anonSession | Out-Null
$adminLogin = Invoke-ApiTest -Endpoint "/api/auth/login" -Method "POST" -Case "admin valid login" -Session $adminSession -Body @{ identifier="admin@example.com"; password="admin123" }
$agentLogin = Invoke-ApiTest -Endpoint "/api/auth/login" -Method "POST" -Case "agent valid login" -Session $agentSession -Body @{ identifier="agent1@example.com"; password="agent@db123" }
Invoke-ApiTest -Endpoint "/api/auth/login" -Method "POST" -Case "login invalid password" -Session $anonSession -Body @{ identifier="admin@example.com"; password="wrongpass" } | Out-Null

$invalidRegisterEmail = "apitest-invalid-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
Invoke-ApiTest -Endpoint "/api/auth/register" -Method "POST" -Case "register invalid short password" -Session $anonSession -Body @{ email=$invalidRegisterEmail; password="abc123"; role="USER" } | Out-Null

$validRegisterEmail = "apitest-valid-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
Invoke-ApiTest -Endpoint "/api/auth/register" -Method "POST" -Case "register valid new user" -Session $anonSession -Body @{ email=$validRegisterEmail; password="Password1234"; role="USER" } | Out-Null

if ($adminLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/me" -Method "GET" -Case "admin me after login" -Session $adminSession | Out-Null
}
if ($agentLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/me" -Method "GET" -Case "agent me after login" -Session $agentSession | Out-Null
}

Invoke-ApiTest -Endpoint "/api/auth/delivery-boys" -Method "GET" -Case "delivery-boys unauthenticated" -Session $anonSession | Out-Null
if ($adminLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/delivery-boys" -Method "GET" -Case "delivery-boys with admin (forbidden expected)" -Session $adminSession | Out-Null
}
if ($agentLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/delivery-boys" -Method "GET" -Case "delivery-boys with agent" -Session $agentSession | Out-Null
  Invoke-ApiTest -Endpoint "/api/auth/delivery-boys" -Method "PATCH" -Case "delivery-boys patch invalid user id" -Session $agentSession -Body @{ userId="nonexistent-user"; action="APPROVE" } | Out-Null
}

Invoke-ApiTest -Endpoint "/api/dashboard?month=bad-month" -Method "GET" -Case "dashboard invalid month format (admin)" -Session $adminSession | Out-Null
Invoke-ApiTest -Endpoint "/api/dashboard?month=$month" -Method "GET" -Case "dashboard unauthenticated" -Session $anonSession | Out-Null
$dashboardRes = $null
if ($adminLogin.Status -eq 200) {
  $dashboardRes = Invoke-ApiTest -Endpoint "/api/dashboard?month=$month" -Method "GET" -Case "dashboard with admin" -Session $adminSession
}

$dashboardObj = $null
if ($dashboardRes -and $dashboardRes.Status -eq 200) {
  try { $dashboardObj = $dashboardRes.Content | ConvertFrom-Json -Depth 15 } catch { $dashboardObj = $null }
}

$existingCustomerId = $null
$deliveryBoyUsername = "boy1"
if ($dashboardObj -and $dashboardObj.data) {
  $existingCustomerId = ($dashboardObj.data.customers | Select-Object -First 1).id
  $approvedBoy = $dashboardObj.data.users | Where-Object { $_.role -eq "DELIVERY_BOY" -and $_.approvalStatus -eq "APPROVED" } | Select-Object -First 1
  if ($approvedBoy -and $approvedBoy.username) { $deliveryBoyUsername = $approvedBoy.username }
}

Invoke-ApiTest -Endpoint "/api/customers" -Method "POST" -Case "customers create unauthenticated" -Session $anonSession -Body @{ name="Smoke"; area="Zone" } | Out-Null
$customerId = $null
if ($adminLogin.Status -eq 200) {
  $createCustomerRes = Invoke-ApiTest -Endpoint "/api/customers" -Method "POST" -Case "customers create with admin" -Session $adminSession -Body @{ name=("Smoke API " + (Get-Random -Minimum 1000 -Maximum 9999)); area="Zone A" }
  if ($createCustomerRes.Status -eq 200) {
    try { $customerId = ($createCustomerRes.Content | ConvertFrom-Json).id } catch {}
  }
}
if (-not $customerId) { $customerId = $existingCustomerId }

if ($adminLogin.Status -eq 200 -and $customerId) {
  Invoke-ApiTest -Endpoint "/api/customers" -Method "PATCH" -Case "customers patch with admin" -Session $adminSession -Body @{ customerId=$customerId; status="STOPPED" } | Out-Null
} else {
  Add-Result -Endpoint "/api/customers" -Method "PATCH" -Case "customers patch with admin" -Status -1 -Response "Skipped: missing customer id"
}

Invoke-ApiTest -Endpoint "/api/collections" -Method "POST" -Case "collections create unauthenticated" -Session $anonSession -Body @{ customerId="x"; monthYear=$month; amount=10; mode="CASH"; status="PAID" } | Out-Null
$collectionId = $null
if ($adminLogin.Status -eq 200 -and $customerId) {
  $createCollectionRes = Invoke-ApiTest -Endpoint "/api/collections" -Method "POST" -Case "collections create with admin" -Session $adminSession -Body @{ customerId=$customerId; monthYear=$month; amount=120; mode="CASH"; status="PAID" }
  if ($createCollectionRes.Status -eq 200) {
    try { $collectionId = ($createCollectionRes.Content | ConvertFrom-Json).id } catch {}
  }
} else {
  Add-Result -Endpoint "/api/collections" -Method "POST" -Case "collections create with admin" -Status -1 -Response "Skipped: missing customer id or admin login failed"
}

if ($adminLogin.Status -eq 200 -and $collectionId) {
  Invoke-ApiTest -Endpoint "/api/collections" -Method "PATCH" -Case "collections patch mark paid with admin" -Session $adminSession -Body @{ collectionId=$collectionId } | Out-Null
} else {
  Add-Result -Endpoint "/api/collections" -Method "PATCH" -Case "collections patch mark paid with admin" -Status -1 -Response "Skipped: missing collection id"
}

Invoke-ApiTest -Endpoint "/api/deliveries" -Method "POST" -Case "deliveries create unauthenticated" -Session $anonSession -Body @{ customerId="x"; ordered=5; deliveryBoyUsername="boy1" } | Out-Null
$deliveryId = $null
if ($adminLogin.Status -eq 200 -and $customerId) {
  $createDeliveryRes = Invoke-ApiTest -Endpoint "/api/deliveries" -Method "POST" -Case "deliveries create with admin" -Session $adminSession -Body @{ customerId=$customerId; ordered=8; deliveryBoyUsername=$deliveryBoyUsername }
  if ($createDeliveryRes.Status -eq 200) {
    try { $deliveryId = ($createDeliveryRes.Content | ConvertFrom-Json).id } catch {}
  }
} else {
  Add-Result -Endpoint "/api/deliveries" -Method "POST" -Case "deliveries create with admin" -Status -1 -Response "Skipped: missing customer id or admin login failed"
}

if ($adminLogin.Status -eq 200 -and $deliveryId) {
  Invoke-ApiTest -Endpoint "/api/deliveries" -Method "PATCH" -Case "deliveries patch confirm with admin" -Session $adminSession -Body @{ deliveryId=$deliveryId; delivered=7 } | Out-Null
} else {
  Add-Result -Endpoint "/api/deliveries" -Method "PATCH" -Case "deliveries patch confirm with admin" -Status -1 -Response "Skipped: missing delivery id"
}

Invoke-ApiTest -Endpoint "/api/insights" -Method "POST" -Case "insights unauthenticated" -Session $anonSession -Body @{ monthKey=$month; totalCollection=1000; lossAmount=100; netProfit=300; pendingCount=2 } | Out-Null
if ($adminLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/insights" -Method "POST" -Case "insights invalid payload with admin" -Session $adminSession -Body @{ bogus=1 } | Out-Null
  Invoke-ApiTest -Endpoint "/api/insights" -Method "POST" -Case "insights valid payload with admin" -Session $adminSession -Body @{ monthKey=$month; totalCollection=1000; lossAmount=100; netProfit=300; pendingCount=2 } | Out-Null
}

Invoke-ApiTest -Endpoint "/api/realtime/events" -Method "GET" -Case "realtime stream unauthenticated" -Session $anonSession -TimeoutSec 5 | Out-Null
if ($adminLogin.Status -eq 200) {
  $cookieHeader = (($adminSession.Cookies.GetCookies($base) | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; ")
  if ([string]::IsNullOrWhiteSpace($cookieHeader)) {
    Add-Result -Endpoint "/api/realtime/events" -Method "GET" -Case "realtime stream authorized (first bytes)" -Status -1 -Response "Missing session cookie"
  } else {
    $sseOut = & curl.exe -sS -N --max-time 3 -i -H "Cookie: $cookieHeader" "$base/api/realtime/events" 2>&1
    $sseText = ($sseOut -join "`n")
    $sseStatus = -1
    if ($sseText -match "HTTP/\d(?:\.\d)?\s+(\d{3})") {
      $sseStatus = [int]$matches[1]
    }
    Add-Result -Endpoint "/api/realtime/events" -Method "GET" -Case "realtime stream authorized (first bytes)" -Status $sseStatus -Response $sseText
  }
}

if ($adminLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/logout" -Method "POST" -Case "admin logout" -Session $adminSession | Out-Null
  Invoke-ApiTest -Endpoint "/api/auth/me" -Method "GET" -Case "admin me after logout" -Session $adminSession | Out-Null
}
if ($agentLogin.Status -eq 200) {
  Invoke-ApiTest -Endpoint "/api/auth/logout" -Method "POST" -Case "agent logout" -Session $agentSession | Out-Null
}

$results | ConvertTo-Json -Depth 6 | Set-Content $OutputPath
$results | Format-Table endpoint, method, case, status -AutoSize
Write-Output ("Base URL: " + $base)
Write-Output ("Saved: " + $OutputPath)