# Gera deploy.zip com o .output ja compilado.
#
# O build do Vite nao cabe na RAM do container do Shard Cloud (o processo e
# encerrado com OUT_OF_MEMORY), entao o upload leva os assets prontos e o
# CUSTOM_COMMAND apenas migra e inicia. Rode `npm run build` antes.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$entry = Join-Path $root '.output/server/index.mjs'
if (-not (Test-Path $entry)) {
  throw "Falta .output/server/index.mjs. Rode 'npm run build' antes de empacotar."
}

$out = Join-Path $root 'deploy.zip'
if (Test-Path $out) { Remove-Item $out -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
  $skipTop = @('node_modules', '.git', '.secrets', '.tanstack', '.cache', '.deps_cache', '.impeccable')
  $count = 0
  foreach ($file in Get-ChildItem $root -Recurse -Force -File) {
    $rel = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
    $top = $rel.Split('/')[0]
    if ($skipTop -contains $top) { continue }
    if ($file.Name -like '.env*' -or $file.Extension -eq '.log' -or $rel -eq 'deploy.zip') { continue }
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $rel)
    $count++
  }
} finally {
  $zip.Dispose()
}

$size = [math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Output "[deploy] deploy.zip pronto: $count arquivos, $size MB"
