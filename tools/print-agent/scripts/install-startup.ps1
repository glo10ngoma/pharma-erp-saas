param(
  [string]$AgentCommand = ''
)

$ErrorActionPreference = 'Stop'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'PharmaERP Print Agent.lnk'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

if (-not $AgentCommand) {
  $exe = Join-Path $root 'dist\PharmaERP-Print-Agent.exe'
  if (Test-Path $exe) {
    $AgentCommand = $exe
  } else {
    $AgentCommand = Join-Path $root 'dist\start-print-agent.cmd'
  }
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $AgentCommand
$shortcut.WorkingDirectory = Split-Path $AgentCommand
$shortcut.WindowStyle = 7
$shortcut.Description = 'PharmaERP local print agent'
$shortcut.Save()

Write-Host "Startup shortcut created: $shortcutPath"
