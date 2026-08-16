# NPB 全選手データ取得スクリプト
#   npb.jp/bis/teams/rst_*.html から12球団の選手一覧（育成含む）を取得し
#   data/npb-players.json と data/npb-players.js を再生成する。
#
#   使い方:  powershell -ExecutionPolicy Bypass -File tools\fetch-npb.ps1
#   ※ このファイルは UTF-8 (BOM付き) で保存すること

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root 'data'
$cache   = Join-Path $env:TEMP 'npb-roster-cache'
New-Item -ItemType Directory -Force -Path $dataDir, $cache | Out-Null

$teams = [ordered]@{
  g  = @{ name='読売ジャイアンツ';             short='巨人';         league='セ' }
  t  = @{ name='阪神タイガース';               short='阪神';         league='セ' }
  db = @{ name='横浜DeNAベイスターズ';         short='DeNA';         league='セ' }
  c  = @{ name='広島東洋カープ';               short='広島';         league='セ' }
  s  = @{ name='東京ヤクルトスワローズ';       short='ヤクルト';     league='セ' }
  d  = @{ name='中日ドラゴンズ';               short='中日';         league='セ' }
  h  = @{ name='福岡ソフトバンクホークス';     short='ソフトバンク'; league='パ' }
  f  = @{ name='北海道日本ハムファイターズ';   short='日本ハム';     league='パ' }
  m  = @{ name='千葉ロッテマリーンズ';         short='ロッテ';       league='パ' }
  e  = @{ name='東北楽天ゴールデンイーグルス'; short='楽天';         league='パ' }
  b  = @{ name='オリックス・バファローズ';     short='オリックス';   league='パ' }
  l  = @{ name='埼玉西武ライオンズ';           short='西武';         league='パ' }
}

function Strip-Tags([string]$s) {
  $s = [regex]::Replace($s, '<[^>]+>', '')
  $s = $s -replace '&nbsp;', ' ' -replace '&amp;', '&' -replace '&#45;', '-'
  return $s.Trim()
}

# ---- ダウンロード ----
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
foreach ($code in $teams.Keys) {
  $out = Join-Path $cache "$code.html"
  Write-Host "GET rst_$code.html"
  $wc = New-Object System.Net.WebClient
  [System.IO.File]::WriteAllBytes($out, $wc.DownloadData("https://npb.jp/bis/teams/rst_$code.html"))
  Start-Sleep -Milliseconds 300
}

# ---- パース ----
$all = New-Object System.Collections.ArrayList
$updated = ''

foreach ($code in $teams.Keys) {
  $html = [System.Text.Encoding]::UTF8.GetString(
            [System.IO.File]::ReadAllBytes((Join-Path $cache "$code.html")))

  if ($html -match '<div class="rosterUpdate">(.*?)</div>') { $updated = Strip-Tags $Matches[1] }

  # 「支配下/育成の見出し」「ポジション見出し行」「選手行」を出現順に走査する
  $pattern = '(?<sub><div class="rosterSub"><h3>.*?</h3></div>)' +
             '|(?<head><tr class="rosterMainHead">.*?</tr>)' +
             '|(?<row><tr class="rosterPlayer">.*?</tr>)'
  $tokens = [regex]::Matches($html, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)

  $rosterType = '支配下'
  $group = ''
  $count = 0; $ikusei = 0

  foreach ($m in $tokens) {
    if ($m.Groups['sub'].Success) {
      $rosterType = if ((Strip-Tags $m.Groups['sub'].Value) -match '育成') { '育成' } else { '支配下' }
      continue
    }
    if ($m.Groups['head'].Success) {
      $th = [regex]::Match($m.Groups['head'].Value, '<th class="rosterPos">(.*?)</th>',
                           [System.Text.RegularExpressions.RegexOptions]::Singleline)
      if ($th.Success) { $group = Strip-Tags $th.Groups[1].Value }
      continue
    }

    # 監督・コーチ欄（身長体重の列が無い）は除外
    if ($group -notin @('投手','捕手','内野手','外野手')) { continue }

    $tds = [regex]::Matches($m.Groups['row'].Value, '<td[^>]*>(.*?)</td>',
                            [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($tds.Count -lt 8) { continue }

    $cells = @(); foreach ($td in $tds) { $cells += (Strip-Tags $td.Groups[1].Value) }
    if ([string]::IsNullOrWhiteSpace($cells[1])) { continue }

    $playerId = ''
    $link = [regex]::Match($tds[1].Groups[1].Value, 'players/(\d+)\.html')
    if ($link.Success) { $playerId = $link.Groups[1].Value }

    $name = $cells[1] -replace '\s+', '　'

    [void]$all.Add([ordered]@{
      id        = if ($playerId) { $playerId } else { "$code-$($cells[0])-$name" }
      name      = $name
      team      = $teams[$code].name
      teamShort = $teams[$code].short
      teamId    = $code
      league    = $teams[$code].league
      number    = $cells[0]
      group     = $group          # 投手 / 捕手 / 内野手 / 外野手
      roster    = $rosterType     # 支配下 / 育成
      birth     = $cells[2]       # yyyy.MM.dd
      height    = if ($cells[3] -match '^\d+$') { [int]$cells[3] } else { $null }
      weight    = if ($cells[4] -match '^\d+$') { [int]$cells[4] } else { $null }
      throws    = $cells[5]       # 右 / 左
      bats      = $cells[6]       # 右 / 左 / 左右
      note      = $cells[7]
    })
    $count++
    if ($rosterType -eq '育成') { $ikusei++ }
  }
  "{0,-4} {1,-12} 計{2,4}名 (支配下 {3}, 育成 {4})" -f $code, $teams[$code].short, $count, ($count-$ikusei), $ikusei
}

"------------------------------------------"
"合計 $($all.Count) 名 / 名簿更新日: $updated"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $dataDir 'npb-players.json'),
  ($all | ConvertTo-Json -Depth 5), $utf8)

$compact = $all | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText((Join-Path $dataDir 'npb-players.js'),
  "// NPB 全選手データ (出典: npb.jp/bis/teams/ $updated) $($all.Count)名 / 育成含む`r`nwindow.NPB_PLAYERS = $compact;`r`n", $utf8)

"書き出し完了: data\npb-players.json / data\npb-players.js"
