param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
$month = Get-Date -Format "yyyy-MM"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Get-ErrorStatusCode {
  param($Exception)
  if ($Exception.Response -and $Exception.Response.StatusCode) {
    return [int]$Exception.Response.StatusCode
  }
  return -1
}

function Try-Request {
  param(
    [ValidateSet("GET", "POST", "PATCH")][string]$Method,
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [hashtable]$Body
  )

  $uri = "$base$Path"

  try {
    if ($Method -eq "GET") {
      $res = Invoke-WebRequest -Uri $uri -Method Get -WebSession $Session -UseBasicParsing
    } elseif ($Method -eq "POST") {
      $res = Invoke-WebRequest -Uri $uri -Method Post -WebSession $Session -Body ($Body | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    } else {
      $res = Invoke-WebRequest -Uri $uri -Method Patch -WebSession $Session -Body ($Body | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    }

    return [pscustomobject]@{
      Status = [int]$res.StatusCode
      Content = $res.Content
    }
  } catch {
    return [pscustomobject]@{
      Status = Get-ErrorStatusCode -Exception $_.Exception
      Content = ""
    }
  }
}

$agentEmail = "verify-agent-$stamp@example.com"
$userEmail = "verify-user-$stamp@example.com"
$boyEmail = "verify-boy-$stamp@example.com"

$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$boySession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentReloginSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$regAgent = Try-Request -Method POST -Path "/api/auth/register" -Session $agentSession -Body @{ email = $agentEmail; password = "AgentCheck1234"; role = "AGENT" }
$loginAgent = Try-Request -Method POST -Path "/api/auth/login" -Session $agentSession -Body @{ identifier = $agentEmail; password = "AgentCheck1234" }

$regUser = Try-Request -Method POST -Path "/api/auth/register" -Session $userSession -Body @{ email = $userEmail; password = "UserCheck1234"; role = "USER" }
$loginUser = Try-Request -Method POST -Path "/api/auth/login" -Session $userSession -Body @{ identifier = $userEmail; password = "UserCheck1234" }
$userId = (($regUser.Content | ConvertFrom-Json).user.id)

$regBoy = Try-Request -Method POST -Path "/api/auth/register" -Session $boySession -Body @{ email = $boyEmail; password = "BoyCheck1234"; role = "DELIVERY_BOY" }
$boyId = (($regBoy.Content | ConvertFrom-Json).user.id)
$approveBoy = Try-Request -Method PATCH -Path "/api/auth/delivery-boys" -Session $agentSession -Body @{ userId = $boyId; action = "APPROVE" }
$loginBoy = Try-Request -Method POST -Path "/api/auth/login" -Session $boySession -Body @{ identifier = $boyEmail; password = "BoyCheck1234" }

$createCustomer = Try-Request -Method POST -Path "/api/customers" -Session $agentSession -Body @{ name = "Verify Customer $stamp"; area = "Zone X"; assignedUserId = $userId }
$customerId = (($createCustomer.Content | ConvertFrom-Json).id)

$createCollection = Try-Request -Method POST -Path "/api/collections" -Session $agentSession -Body @{ customerId = $customerId; monthYear = $month; amount = 321; mode = "CASH"; status = "PAID" }
$createDelivery = Try-Request -Method POST -Path "/api/deliveries" -Session $agentSession -Body @{ customerId = $customerId; ordered = 12; deliveryBoyUsername = $boyEmail }
$deliveryId = (($createDelivery.Content | ConvertFrom-Json).id)

$userCreateCustomer = Try-Request -Method POST -Path "/api/customers" -Session $userSession -Body @{ name = "NoPerm User"; area = "Denied" }
$boyCreateCustomer = Try-Request -Method POST -Path "/api/customers" -Session $boySession -Body @{ name = "NoPerm Boy"; area = "Denied" }

$boyConfirmDelivery = Try-Request -Method PATCH -Path "/api/deliveries" -Session $boySession -Body @{ deliveryId = $deliveryId; delivered = 10 }

$agentDash = Try-Request -Method GET -Path "/api/dashboard?month=$month" -Session $agentSession -Body @{}
$userDash = Try-Request -Method GET -Path "/api/dashboard?month=$month" -Session $userSession -Body @{}
$boyDash = Try-Request -Method GET -Path "/api/dashboard?month=$month" -Session $boySession -Body @{}

$agentObj = $agentDash.Content | ConvertFrom-Json
$userObj = $userDash.Content | ConvertFrom-Json
$boyObj = $boyDash.Content | ConvertFrom-Json
$userSeesAssignedCustomer = (($userObj.data.customers | Where-Object { $_.id -eq $customerId } | Measure-Object).Count -gt 0)

$agentRelogin = Try-Request -Method POST -Path "/api/auth/login" -Session $agentReloginSession -Body @{ identifier = $agentEmail; password = "AgentCheck1234" }
$agentReloginDash = Try-Request -Method GET -Path "/api/dashboard?month=$month" -Session $agentReloginSession -Body @{}
$agentReloginObj = $agentReloginDash.Content | ConvertFrom-Json
$persistedAfterRelogin = (($agentReloginObj.data.customers | Where-Object { $_.id -eq $customerId } | Measure-Object).Count -gt 0)

Write-Output ("register_login_status agent=" + $regAgent.Status + "/" + $loginAgent.Status + " user=" + $regUser.Status + "/" + $loginUser.Status + " delivery_boy=" + $regBoy.Status + "/" + $loginBoy.Status + " approval=" + $approveBoy.Status)
Write-Output ("feature_status create_customer=" + $createCustomer.Status + " create_collection=" + $createCollection.Status + " create_delivery=" + $createDelivery.Status + " confirm_delivery_by_assigned_boy=" + $boyConfirmDelivery.Status)
Write-Output ("permission_status user_create_customer=" + $userCreateCustomer.Status + " delivery_boy_create_customer=" + $boyCreateCustomer.Status)
Write-Output ("dashboard_counts agent(users/customers/deliveries/collections)=" + $agentObj.data.users.Count + "/" + $agentObj.data.customers.Count + "/" + $agentObj.data.deliveries.Count + "/" + $agentObj.data.collections.Count)
Write-Output ("dashboard_counts user(users/customers/deliveries/collections)=" + $userObj.data.users.Count + "/" + $userObj.data.customers.Count + "/" + $userObj.data.deliveries.Count + "/" + $userObj.data.collections.Count)
Write-Output ("dashboard_counts delivery_boy(users/customers/deliveries/collections)=" + $boyObj.data.users.Count + "/" + $boyObj.data.customers.Count + "/" + $boyObj.data.deliveries.Count + "/" + $boyObj.data.collections.Count)
Write-Output ("assignment_visibility user_sees_assigned_customer=" + $userSeesAssignedCustomer + " customer_id=" + $customerId)
Write-Output ("persistence_check relogin_status=" + $agentRelogin.Status + " relogin_dashboard=" + $agentReloginDash.Status + " customer_persisted_after_relogin=" + $persistedAfterRelogin + " customer_id=" + $customerId)
