param(
  [string]$OutputPath = (Join-Path $env:TEMP 'SwiftJob-TechCheck-Launcher.exe')
)

$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) {
  $compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compilerPath)) {
  throw 'The .NET Framework C# compiler was not found.'
}

$sourcePath = Join-Path $PSScriptRoot 'Program.cs'
$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

& $compilerPath /nologo /target:winexe /platform:anycpu /optimize+ "/out:$OutputPath" /reference:System.Windows.Forms.dll $sourcePath
if ($LASTEXITCODE -ne 0) {
  throw "Launcher build failed with exit code $LASTEXITCODE."
}

Get-Item -LiteralPath $OutputPath | Select-Object FullName, Length
