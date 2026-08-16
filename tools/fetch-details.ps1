# 選手ページから ふりがな と 公式写真URL を取得して data に追記する
#   npb.jp/bis/players/{id}.html を1件ずつ取得（キャッシュあり・再実行で差分のみ）
#
#   使い方:  powershell -ExecutionPolicy Bypass -File tools\fetch-details.ps1
#   ※ このファイルは UTF-8 (BOM付き) で保存すること

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root 'data'
$cache   = Join-Path $env:TEMP 'npb-player-cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$jsonPath = Join-Path $dataDir 'npb-players.json'
$players = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$total = $players.Count
$i = 0; $fetched = 0; $cached = 0; $failed = 0
$okKana = 0; $okPhoto = 0

foreach ($p in $players) {
  $i++
  if ($p.id -notmatch '^\d+$') { continue }

  $file = Join-Path $cache "$($p.id).html"
  if (Test-Path $file) {
    $html = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($file))
    $cached++
  } else {
    try {
      $wc = New-Object System.Net.WebClient
      $bytes = $wc.DownloadData("https://npb.jp/bis/players/$($p.id).html")
      [System.IO.File]::WriteAllBytes($file, $bytes)
      $html = [System.Text.Encoding]::UTF8.GetString($bytes)
      $fetched++
      Start-Sleep -Milliseconds 150
    } catch {
      $failed++
      Write-Host "FAIL $($p.id) $($p.name): $($_.Exception.Message)"
      continue
    }
  }

  # ふりがな（例: まる・よしひろ）
  $kana = ''
  if ($html -match '<li id="pc_v_kana">(.*?)</li>') {
    $kana = ($Matches[1] -replace '<[^>]+>', '').Trim()
  }
  # 公式写真
  $photo = ''
  if ($html -match '(https://p\.npb\.jp/players_photo/[^"'']+)') {
    $photo = $Matches[1]
  }

  Add-Member -InputObject $p -NotePropertyName 'kana'     -NotePropertyValue $kana  -Force
  Add-Member -InputObject $p -NotePropertyName 'photoUrl' -NotePropertyValue $photo -Force
  if ($kana)  { $okKana++ }
  if ($photo) { $okPhoto++ }

  if ($i % 100 -eq 0) { Write-Host "$i / $total  (取得 $fetched / キャッシュ $cached / 失敗 $failed)" }
}

"------------------------------------------"
"処理 $total 名 / 新規取得 $fetched / キャッシュ $cached / 失敗 $failed"
"ふりがな取得 $okKana 名 / 写真URL取得 $okPhoto 名"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, ($players | ConvertTo-Json -Depth 5), $utf8)

$compact = $players | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText((Join-Path $dataDir 'npb-players.js'),
  "// NPB 全選手データ (出典: npb.jp) $($players.Count)名 / 育成含む`r`nwindow.NPB_PLAYERS = $compact;`r`n", $utf8)

"書き出し完了: data\npb-players.json / data\npb-players.js"
