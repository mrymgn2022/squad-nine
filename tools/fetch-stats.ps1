# 全選手のシーズン成績を取得して data/npb-stats.js を生成する
#   取得元: プロ野球データFreak (baseball-data.com) を優先し、失敗したら NPB公式 (npb.jp) に切り替える
#   打者: 打率・本塁打・打点・OPS ほか / 投手: 防御率・勝敗・セーブ ほか
# 使い方: powershell -ExecutionPolicy Bypass -File tools/fetch-stats.ps1 [-Source auto|freak|npb] [-Year 2026]
param(
  [ValidateSet('auto', 'freak', 'npb')][string]$Source = 'auto',
  [int]$Year = (Get-Date).Year
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$teams = @('g','t','db','c','s','d','h','f','m','e','b','l')
# データFreakの球団コード（当アプリと違うものだけ）
$freakCode = @{ db = 'yb'; b = 'bs' }
# 取得元へは身元を明かした User-Agent でアクセスする
$userAgent = 'Mozilla/5.0 (compatible; squad-nine-stats/1.0; +https://mrymgn2022.github.io/squad-nine/)'
# これより少ない人数しか突合できなかったら取得失敗とみなす（壊れたデータで上書きしない）
$minPlayers = 400

# 名前の正規化: 全半角スペース除去・左打/両打マーク除去・互換漢字と全角英数の正規化
function Normalize-Name([string]$s) {
  $s = $s -replace '[\s　]', ''
  $s = $s -replace '^[*＊+＋]+', ''
  $s.Normalize([System.Text.NormalizationForm]::FormKC)
}

function To-Int([string]$s) { $n = 0; [void][int]::TryParse($s, [ref]$n); $n }

# ロスターを読み込み (teamId|正規化名) -> id
# ※背番号での突合はしない（移籍・背番号変更で別人に当たるため。検証で7件中6件が誤マッチだった）
$players = Get-Content (Join-Path $root 'data\npb-players.json') -Encoding UTF8 | ConvertFrom-Json
$byName = @{}
foreach ($p in $players) { $byName[$p.teamId + '|' + (Normalize-Name $p.name)] = $p.id }

# 取得元とロスターで表記が違う選手の別名表（取得元の表記 -> ロスターの表記）
$nameAlias = @{ '張峻瑋' = '張峻ウェイ' }

# URLの表を行ごとのセル配列にする（ヘッダー行は th なので自然に除外される）
function Fetch-Table([string]$url) {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', $userAgent)
  $html = [System.Text.Encoding]::UTF8.GetString($wc.DownloadData($url))
  $rows = @()
  foreach ($m in [regex]::Matches($html, '<tr[^>]*>(.*?)</tr>', 'Singleline')) {
    $cells = @()
    foreach ($c in [regex]::Matches($m.Groups[1].Value, '<td[^>]*>(.*?)</td>', 'Singleline')) {
      $cells += [System.Net.WebUtility]::HtmlDecode(([regex]::Replace($c.Groups[1].Value, '<[^>]+>', ''))).Trim()
    }
    if ($cells.Count -gt 0) { $rows += ,$cells }
  }
  return $rows
}

# ---------- データFreak ----------
# 打者: 背番号,選手名,打率(2),試合(3),打席(4),打数,安打(6),本塁打(7),打点(8),盗塁(9),四球(10),死球,三振(12),犠打,併殺打,出塁率(15),長打率(16),OPS(17),RC27(18),XR27
# 投手: 背番号,選手名,防御率(2),試合(3),勝利(4),敗北(5),セーブ(6),ホールド(7),勝率,打者,投球回(10),被安打,被本塁打,与四球,与死球,奪三振(15),失点,自責点,WHIP(18),DIPS
function Get-FreakStats {
  $stats = @{}
  $unmatched = @()
  foreach ($t in $teams) {
    $code = if ($freakCode.ContainsKey($t)) { $freakCode[$t] } else { $t }
    foreach ($kind in @('hitter', 'pitcher')) {
      $rows = Fetch-Table "https://baseball-data.com/stats/$kind-$code/"
      foreach ($row in $rows) {
        if ($row.Count -lt 20) { continue }
        $nm = Normalize-Name $row[1]
        if ($nameAlias.ContainsKey($nm)) { $nm = $nameAlias[$nm] }
        $id = $byName[$t + '|' + $nm]
        if (-not $id) { $unmatched += "$t ${kind}: $($row[1])"; continue }
        if ($kind -eq 'hitter' -and (To-Int $row[4]) -lt 1) { continue }    # 打席ゼロは載せない
        if ($kind -eq 'pitcher' -and (To-Int $row[3]) -lt 1) { continue }   # 登板ゼロも載せない
        if (-not $stats.ContainsKey($id)) { $stats[$id] = [ordered]@{} }
        $s = $stats[$id]
        if ($kind -eq 'hitter') {
          $s['avg'] = "'$($row[2])'"; $s['hr'] = To-Int $row[7]; $s['rbi'] = To-Int $row[8]; $s['ops'] = "'$($row[17])'"
          $s['g'] = To-Int $row[3]; $s['pa'] = To-Int $row[4]; $s['h'] = To-Int $row[6]; $s['sb'] = To-Int $row[9]
          $s['bb'] = To-Int $row[10]; $s['k'] = To-Int $row[12]; $s['obp'] = "'$($row[15])'"; $s['slg'] = "'$($row[16])'"
        } else {
          $s['era'] = "'$($row[2])'"; $s['w'] = To-Int $row[4]; $s['l'] = To-Int $row[5]; $s['sv'] = To-Int $row[6]
          $s['pg'] = To-Int $row[3]; $s['hld'] = To-Int $row[7]; $s['ip'] = "'$($row[10])'"; $s['so'] = To-Int $row[15]; $s['whip'] = "'$($row[18])'"
        }
      }
      Start-Sleep -Milliseconds 1000   # 相手サーバーに負荷をかけない
    }
    Write-Host "freak $t : OK"
  }
  # 投手の打撃成績は球団別の打者ページに載らないので、専用ページ（1.html = 打席数の下限なし）から取る
  # 列: 順位,選手名,チーム(2),打率(3),試合(4),打席(5),打数,安打(7),本塁打(8),打点(9),盗塁(10),四球(11),死球,三振(13),犠打,併殺打,出塁率(16),長打率(17),OPS(18),RC27,XR27
  $teamByName = @{ '巨人'='g'; '阪神'='t'; 'DeNA'='db'; '広島'='c'; 'ヤクルト'='s'; '中日'='d'; 'ソフトバンク'='h'; '日本ハム'='f'; 'ロッテ'='m'; '楽天'='e'; 'オリックス'='b'; '西武'='l' }
  $pHit = 0
  foreach ($row in (Fetch-Table 'https://baseball-data.com/stats/p-hitting/1.html')) {
    if ($row.Count -lt 21) { continue }
    $t = $teamByName[$row[2]]
    if (-not $t) { continue }
    $nm = Normalize-Name $row[1]
    if ($nameAlias.ContainsKey($nm)) { $nm = $nameAlias[$nm] }
    $id = $byName[$t + '|' + $nm]
    if (-not $id) { $unmatched += "$t p-hitting: $($row[1])"; continue }
    if ((To-Int $row[5]) -lt 1) { continue }
    if (-not $stats.ContainsKey($id)) { $stats[$id] = [ordered]@{} }
    $s = $stats[$id]
    $s['avg'] = "'$($row[3])'"; $s['hr'] = To-Int $row[8]; $s['rbi'] = To-Int $row[9]; $s['ops'] = "'$($row[18])'"
    $s['g'] = To-Int $row[4]; $s['pa'] = To-Int $row[5]; $s['h'] = To-Int $row[7]; $s['sb'] = To-Int $row[10]
    $s['bb'] = To-Int $row[11]; $s['k'] = To-Int $row[13]; $s['obp'] = "'$($row[16])'"; $s['slg'] = "'$($row[17])'"
    $pHit++
  }
  Write-Host "freak p-hitting : OK ($pHit)"
  return @{ stats = $stats; unmatched = $unmatched; source = 'baseball-data.com' }
}

# ---------- NPB公式（フォールバック） ----------
# 打撃: 選手,試合(1),打席(2),打数,得点,安打(5),二塁打,三塁打,本塁打(8),塁打,打点(10),盗塁(11),盗塁刺,犠打,犠飛,四球(15),故意四球,死球,三振(18),併殺打,打率(20),長打率(21),出塁率(22)
# 投手: 選手,登板(1),勝利(2),敗北(3),セーブ(4),ホールド(5),HP,完投,完封勝,無四球,勝率,打者,投球回(12),安打,本塁打,四球,故意四,死球,三振(18),暴投,ボーク,失点,自責点,防御率(23)
function Get-NpbStats {
  $stats = @{}
  $unmatched = @()
  $inv = [System.Globalization.CultureInfo]::InvariantCulture
  foreach ($t in $teams) {
    foreach ($row in (Fetch-Table "https://npb.jp/bis/$Year/stats/idb1_$t.html")) {
      if ($row.Count -lt 23) { continue }
      $id = $byName[$t + '|' + (Normalize-Name $row[0])]
      if (-not $id) { $unmatched += "$t hitter: $($row[0])"; continue }
      if ((To-Int $row[2]) -lt 1) { continue }
      $slg = 0.0; $obp = 0.0
      [void][double]::TryParse($row[21], [System.Globalization.NumberStyles]::Float, $inv, [ref]$slg)
      [void][double]::TryParse($row[22], [System.Globalization.NumberStyles]::Float, $inv, [ref]$obp)
      $ops = ($slg + $obp).ToString('0.000', $inv)
      if ($ops.StartsWith('0')) { $ops = $ops.Substring(1) }
      if (-not $stats.ContainsKey($id)) { $stats[$id] = [ordered]@{} }
      $s = $stats[$id]
      $s['avg'] = "'$($row[20])'"; $s['hr'] = To-Int $row[8]; $s['rbi'] = To-Int $row[10]; $s['ops'] = "'$ops'"
      $s['g'] = To-Int $row[1]; $s['pa'] = To-Int $row[2]; $s['h'] = To-Int $row[5]; $s['sb'] = To-Int $row[11]
      $s['bb'] = To-Int $row[15]; $s['k'] = To-Int $row[18]; $s['obp'] = "'$($row[22])'"; $s['slg'] = "'$($row[21])'"
    }
    Start-Sleep -Milliseconds 500
    foreach ($row in (Fetch-Table "https://npb.jp/bis/$Year/stats/idp1_$t.html")) {
      if ($row.Count -lt 24) { continue }
      $id = $byName[$t + '|' + (Normalize-Name $row[0])]
      if (-not $id) { $unmatched += "$t pitcher: $($row[0])"; continue }
      if (-not $stats.ContainsKey($id)) { $stats[$id] = [ordered]@{} }
      $s = $stats[$id]
      $s['era'] = "'$($row[23])'"; $s['w'] = To-Int $row[2]; $s['l'] = To-Int $row[3]; $s['sv'] = To-Int $row[4]
      $s['pg'] = To-Int $row[1]; $s['hld'] = To-Int $row[5]; $s['ip'] = "'$($row[12])'"; $s['so'] = To-Int $row[18]
    }
    Start-Sleep -Milliseconds 500
    Write-Host "npb $t : OK"
  }
  return @{ stats = $stats; unmatched = $unmatched; source = 'npb.jp' }
}

# ---------- 取得（autoはFreak優先、だめならNPB公式） ----------
$result = $null
$order = if ($Source -eq 'auto') { @('freak', 'npb') } else { @($Source) }
foreach ($src in $order) {
  try {
    $r = if ($src -eq 'freak') { Get-FreakStats } else { Get-NpbStats }
    if ($r.stats.Count -lt $minPlayers) { throw "突合できた選手が少なすぎます ($($r.stats.Count)人)" }
    $result = $r
    break
  } catch {
    Write-Host "[$src] 取得失敗: $($_.Exception.Message)"
  }
}
if (-not $result) { throw 'どの取得元からも成績を取得できませんでした（既存データは変更していません）' }

# ---------- JS出力 ----------
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* シーズン個人成績。生成: tools/fetch-stats.ps1 */')
[void]$sb.AppendLine('window.NPB_STATS = {')
[void]$sb.AppendLine("  updated: '" + (Get-Date -Format 'yyyy-MM-dd') + "',")
[void]$sb.AppendLine("  source: '" + $result.source + "',")
[void]$sb.AppendLine('  players: {')
foreach ($id in ($result.stats.Keys | Sort-Object)) {
  $s = $result.stats[$id]
  if ($s.Count -eq 0) { continue }
  $parts = foreach ($key in $s.Keys) { "${key}:$($s[$key])" }
  [void]$sb.AppendLine("    '" + $id + "': {" + ($parts -join ',') + "},")
}
[void]$sb.AppendLine('  }')
[void]$sb.AppendLine('};')
$outPath = Join-Path $root 'data\npb-stats.js'
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("saved: " + $outPath + " (" + $result.stats.Count + " players, source: " + $result.source + ")")
if ($result.unmatched.Count -gt 0) {
  Write-Host ("unmatched: " + $result.unmatched.Count)
  $result.unmatched | Select-Object -First 20 | ForEach-Object { Write-Host ("  " + $_) }
}
