# Redimensiona in-place los PNG de public/img/players a un máximo de 160px
# (se muestran a 30-66px). Preserva transparencia. Requiere Windows PowerShell.
param(
  [string]$Dir = "public/img/players",
  [int]$Max = 160
)

Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem -Path $Dir -Filter *.png -File
$before = ($files | Measure-Object Length -Sum).Sum
$done = 0

foreach ($file in $files) {
  try {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $ms = New-Object System.IO.MemoryStream (,$bytes)
    $img = [System.Drawing.Image]::FromStream($ms)

    $w = $img.Width; $h = $img.Height
    if ([Math]::Max($w, $h) -le $Max) { $img.Dispose(); $ms.Dispose(); continue }

    $scale = $Max / [Math]::Max($w, $h)
    $nw = [int][Math]::Round($w * $scale)
    $nh = [int][Math]::Round($h * $scale)

    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $nw, $nh)

    $g.Dispose(); $img.Dispose(); $ms.Dispose()

    $bmp.Save($file.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $done++
  }
  catch {
    Write-Warning "$($file.Name): $($_.Exception.Message)"
  }
}

$after = (Get-ChildItem -Path $Dir -Filter *.png -File | Measure-Object Length -Sum).Sum
"redimensionadas=$done  antes=$([math]::Round($before/1MB,1))MB  despues=$([math]::Round($after/1MB,1))MB"
