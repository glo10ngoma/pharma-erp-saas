param(
  [Parameter(Mandatory = $true)]
  [string]$JobPath
)

$ErrorActionPreference = 'Stop'
$job = Get-Content -LiteralPath $JobPath -Raw | ConvertFrom-Json

Add-Type -AssemblyName System.Drawing

$fontSize = if ([int]$job.paperWidthMm -eq 58) { 8 } else { 9 }
$font = New-Object System.Drawing.Font('Consolas', $fontSize)
$brush = [System.Drawing.Brushes]::Black
$lines = ([string]$job.ticket.text) -split "`r?`n"

for ($copy = 0; $copy -lt [int]$job.copies; $copy++) {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = [string]$job.printerName
  $doc.DocumentName = 'PharmaERP POS Ticket'
  if (-not $doc.PrinterSettings.IsValid) {
    throw "Imprimante introuvable: $($job.printerName)"
  }

  $lineIndex = 0
  $doc.add_PrintPage({
    param($sender, $eventArgs)
    $x = $eventArgs.MarginBounds.Left
    $y = $eventArgs.MarginBounds.Top
    $lineHeight = [int][Math]::Ceiling($font.GetHeight($eventArgs.Graphics) + 2)
    while ($script:lineIndex -lt $lines.Length) {
      if ($y + $lineHeight -gt $eventArgs.MarginBounds.Bottom) {
        $eventArgs.HasMorePages = $true
        return
      }
      $eventArgs.Graphics.DrawString($lines[$script:lineIndex], $font, $brush, $x, $y)
      $y += $lineHeight
      $script:lineIndex++
    }
    $eventArgs.HasMorePages = $false
  })
  $script:lineIndex = $lineIndex
  $doc.Print()
  $doc.Dispose()
}
