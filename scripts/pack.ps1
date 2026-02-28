param(
  [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $ProjectRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found: $manifestPath"
}

$manifest = Get-Content $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  $version = "0.0.0"
}

$releaseDir = Join-Path $ProjectRoot "release"
New-Item -ItemType Directory -Force $releaseDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipPath = Join-Path $releaseDir "uitab-local-clone-v$version-$timestamp.zip"
Compress-Archive -Path `
  (Join-Path $ProjectRoot "manifest.json"), `
  (Join-Path $ProjectRoot "newtab.html"), `
  (Join-Path $ProjectRoot "icons"), `
  (Join-Path $ProjectRoot "styles"), `
  (Join-Path $ProjectRoot "UI"), `
  (Join-Path $ProjectRoot "src"), `
  (Join-Path $ProjectRoot "README.md") `
  -DestinationPath $zipPath -CompressionLevel Optimal

$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$packer = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$crxPath = $null
$pemPath = $null
$buildDir = Join-Path $ProjectRoot "build"
New-Item -ItemType Directory -Force $buildDir | Out-Null

if ($packer) {
  $stageName = "packsrc-$timestamp"
  $stageDir = Join-Path $buildDir $stageName
  New-Item -ItemType Directory -Force $stageDir | Out-Null

  Copy-Item (Join-Path $ProjectRoot "manifest.json") $stageDir
  Copy-Item (Join-Path $ProjectRoot "newtab.html") $stageDir
  Copy-Item (Join-Path $ProjectRoot "README.md") $stageDir
  Copy-Item (Join-Path $ProjectRoot "icons") (Join-Path $stageDir "icons") -Recurse
  Copy-Item (Join-Path $ProjectRoot "styles") (Join-Path $stageDir "styles") -Recurse
  Copy-Item (Join-Path $ProjectRoot "UI") (Join-Path $stageDir "UI") -Recurse
  Copy-Item (Join-Path $ProjectRoot "src") (Join-Path $stageDir "src") -Recurse

  $targetPem = Join-Path $releaseDir "uitab-local-clone-v$version.pem"
  if (Test-Path $targetPem) {
    $pemPath = $targetPem
  }
  $packArgs = @("--pack-extension=$stageDir", "--no-message-box")
  if (Test-Path $targetPem) {
    $packArgs += "--pack-extension-key=$targetPem"
  }
  & $packer @packArgs | Out-Null

  $generatedCrx = Join-Path $buildDir "$stageName.crx"
  $generatedPem = Join-Path $buildDir "$stageName.pem"

  if (Test-Path $generatedCrx) {
    $crxPath = Join-Path $releaseDir "uitab-local-clone-v$version.crx"
    Copy-Item $generatedCrx $crxPath -Force
  }
  if (Test-Path $generatedPem) {
    $pemPath = Join-Path $releaseDir "uitab-local-clone-v$version.pem"
    Copy-Item $generatedPem $pemPath -Force
  }
}

Write-Host "Pack completed."
Write-Host "ZIP: $zipPath"
if ($crxPath) {
  Write-Host "CRX: $crxPath"
}
if ($pemPath) {
  Write-Host "PEM: $pemPath"
}
if (-not $packer) {
  Write-Host "No Chrome/Edge executable found; CRX not generated."
}
