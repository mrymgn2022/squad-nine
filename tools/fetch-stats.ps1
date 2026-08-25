# NPB公式サイトから全選手のシーズン成績を取得して data/npb-stats.js を生成する
# 打者: 打率・本塁打・打点・OPS(長打率+出塁率) / 投手: 防御率・勝敗
# 使い方: powershell -ExecutionPolicy Bypass -File tools/fetch-stats.ps1 [-Year 2026]
param([int]$Year = 2026)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$teams = @('g','t','db','c','s','d','h','f','m','e','b','l')

# 名前の正規化: 全半角スペース除去・全角英数字を半角に
function Normalize-Name([string]$s) {
  $s = $s -replace '[\s　]', ''
  $s = $s -replace '^[*＊+＋]+', ''   # NPBサイトの左打/両打マークを除去
  $s = $s.Normalize([System.Text.NormalizationForm]::FormKC)   # 互換漢字(U+FA45の海など)を正規化
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int]$ch
    if ($code -ge 0xFF01 -and $code -le 0xFF5E) { [void]$sb.Append([char]($code - 0xFEE0)) }
    else { [void]$sb.Append($ch) }
  }
  $sb.ToString()
}

# ロスターを読み込み (teamId+正規化名) -> id
$players = Get-Content (Join-Path $root 'data\npb-players.json') -Encoding UTF8 | ConvertFrom-Json
$byKey = @{}
foreach ($p in $players) { $byKey[$p.teamId + '|' + (Normalize-Name $p.name)] = $p.id }

function Fetch-Table([string]$url) {
  $wc = New-Object System.Net.WebClient
  $html = [System.Text.Encoding]::UTF8.GetString($wc.DownloadData($url))
  $rows = @()
  foreach ($m in [regex]::Matches($html, '<tr>(.*?)</tr>', 'Singleline')) {
    $cells = @()
    foreach ($c in [regex]::Matches($m.Groups[1].Value, '<td[^>]*>(.*?)</td>', 'Singleline')) {
      $cells += ([regex]::Replace($c.Groups[1].Value, '<[^>]+>', '')).Trim()
    }
    if ($cells.Count -gt 0) { $rows += ,$cells }
  }
  return $rows
}

$stats = @{}
$unmatched = @()
foreach ($t in $teams) {
  # 打撃: 選手,試合,打席,打数,得点,安打,二塁打,三塁打,本塁打(8),塁打,打点(10),盗塁,盗塁刺,犠打,犠飛,四球,故意四球,死球,三振,併殺打,打率(20),長打率(21),出塁率(22)
  foreach ($row in (Fetch-Table "https://npb.jp/bis/$Year/stats/idb1_$t.html")) {
    if ($row.Count -lt 23) { continue }
    $id = $byKey[$t + '|' + (Normalize-Name $row[0])]
    if (-not $id) { $unmatched += "$t 打者: $($row[0])"; continue }
    $pa = 0; [void][int]::TryParse($row[2], [ref]$pa)
    if ($pa -lt 1) { continue }   # 打席ゼロは載せない
    $slg = 0.0; $obp = 0.0
    [void][double]::TryParse($row[21], [ref]$slg)
    [void][double]::TryParse($row[22], [ref]$obp)
    $ops = $slg + $obp
    $opsStr = $ops.ToString('0.000', [System.Globalization.CultureInfo]::InvariantCulture)
    if ($opsStr.StartsWith('0')) { $opsStr = $opsStr.Substring(1) }
    if (-not $stats.ContainsKey($id)) { $stats[$id] = @{} }
    $stats[$id]['avg'] = $row[20]
    $stats[$id]['hr']  = [int]$row[8]
    $stats[$id]['rbi'] = [int]$row[10]
    $stats[$id]['ops'] = $opsStr
  }
  # 投手: 選手,登板(1),勝利(2),敗北(3),セーブ(4),ホールド,HP,完投,完封勝,無四球,勝率,打者,投球回,安打,本塁打,四球,故意四,死球,三振,暴投,ボーク,失点,自責点,防御率(23)
  foreach ($row in (Fetch-Table "https://npb.jp/bis/$Year/stats/idp1_$t.html")) {
    if ($row.Count -lt 24) { continue }
    $id = $byKey[$t + '|' + (Normalize-Name $row[0])]
    if (-not $id) { $unmatched += "$t 投手: $($row[0])"; continue }
    if (-not $stats.ContainsKey($id)) { $stats[$id] = @{} }
    $stats[$id]['era'] = $row[23]
    $stats[$id]['w']   = [int]$row[2]
    $stats[$id]['l']   = [int]$row[3]
    $stats[$id]['sv']  = [int]$row[4]
  }
  Write-Host "$t : OK"
  Start-Sleep -Milliseconds 500
}

# JS出力
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* NPB公式サイトの個人成績から生成。生成: tools/fetch-stats.ps1 */')
[void]$sb.AppendLine('window.NPB_STATS = {')
[void]$sb.AppendLine("  updated: '" + (Get-Date -Format 'yyyy-MM-dd') + "',")
[void]$sb.AppendLine('  players: {')
foreach ($id in ($stats.Keys | Sort-Object)) {
  $s = $stats[$id]
  $parts = @()
  if ($s.ContainsKey('avg')) { $parts += "avg:'$($s['avg'])',hr:$($s['hr']),rbi:$($s['rbi']),ops:'$($s['ops'])'" }
  if ($s.ContainsKey('era')) { $parts += "era:'$($s['era'])',w:$($s['w']),l:$($s['l']),sv:$($s['sv'])" }
  [void]$sb.AppendLine("    '" + $id + "': {" + ($parts -join ',') + "},")
}
[void]$sb.AppendLine('  }')
[void]$sb.AppendLine('};')
$outPath = Join-Path $root 'data\npb-stats.js'
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("saved: " + $outPath + " (" + $stats.Count + " players)")
if ($unmatched.Count -gt 0) {
  Write-Host ("unmatched: " + $unmatched.Count)
  $unmatched | Select-Object -First 15 | ForEach-Object { Write-Host ("  " + $_) }
}
