param(
  [string]$Pptx = "praesentation.pptx",
  [string]$Out = "$env:TEMP\praesentation-png"
)
$full = (Resolve-Path $Pptx).Path
if (Test-Path $Out) { Remove-Item "$Out\*" -Force }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($full, $true, $false, $false)
$count = $pres.Slides.Count
for ($i = 1; $i -le $count; $i++) {
  $pres.Slides.Item($i).Export((Join-Path $Out ("folie-{0:D2}.png" -f $i)), "PNG", 1600, 900)
}
$pres.Close()
$app.Quit()
Write-Output "$count Folien nach $Out exportiert"
