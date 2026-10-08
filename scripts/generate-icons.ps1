Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\hp\.gemini\antigravity-ide\brain\77bec624-b2de-483f-a98d-efab214b0f2c\okwu_app_icon_variant_1791484477836.jpg"
$destDir = "$PSScriptRoot\..\public\icons"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$srcImage = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImage, 0, 0, $size, $size)
    $g.Dispose()

    $outPath = Join-Path $destDir "icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outPath ($size x $size)"
}

$srcImage.Dispose()
Write-Output "All icons successfully generated."
