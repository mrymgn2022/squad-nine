/* SQUAD NINE — NPB スタメンメーカー */
(function () {
  'use strict';

  // ============================================================
  // 定数
  // ============================================================
  const FIELD_W = 1000, FIELD_H = 1010;   // フィールドSVGの viewBox
  // 共有画像ではフィールドの上下の余白を切り抜いて使う
  const SHARE_CROP_Y0 = 125, SHARE_CROP_H = 830;
  // 盤面（アプリ画面）は上の余白だけ切り落とす。下は捕手の名前ラベルの分を残す
  const BOARD_CROP_Y0 = 120, BOARD_CROP_H = 890;

  const POSITIONS = [
    // フェンスなしダイヤモンド配置（%）。球場デザイン復活時の旧座標は git 履歴参照
    { key: 'P',  num: 1, kanji: '投', kana: 'ピッチャー',   full: '投手',   group: '投手',   x: 50, y: 54 },
    { key: 'C',  num: 2, kanji: '捕', kana: 'キャッチャー', full: '捕手',   group: '捕手',   x: 50, y: 85 },
    { key: '1B', num: 3, kanji: '一', kana: 'ファースト',   full: '一塁手', group: '内野手', x: 81, y: 58 },
    { key: '2B', num: 4, kanji: '二', kana: 'セカンド',     full: '二塁手', group: '内野手', x: 67, y: 35 },
    { key: '3B', num: 5, kanji: '三', kana: 'サード',       full: '三塁手', group: '内野手', x: 19, y: 58 },
    { key: 'SS', num: 6, kanji: '遊', kana: 'ショート',     full: '遊撃手', group: '内野手', x: 33, y: 35 },
    { key: 'LF', num: 7, kanji: '左', kana: 'レフト',       full: '左翼手', group: '外野手', x: 12, y: 21 },
    { key: 'CF', num: 8, kanji: '中', kana: 'センター',     full: '中堅手', group: '外野手', x: 50, y: 11.5 },
    { key: 'RF', num: 9, kanji: '右', kana: 'ライト',       full: '右翼手', group: '外野手', x: 88, y: 21 },
    // DHは捕手の隣（DHなし時は捕手が中央に寄る）
    { key: 'DH', num: 0, kanji: '指', kana: 'DH',           full: '指名打者', group: null,   x: 72, y: 85 }
  ];

  const FIELD_STYLES = (window.FIELD && window.FIELD.styles) || [{ id: 'classic', label: '標準' }];

  // 写真未設定時に表示する人型アイコン（Material Symbols の person 相当）
  const PERSON_PATH = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';
  const SVGNS = 'http://www.w3.org/2000/svg';

  function personIcon() {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'avatar-icon');
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', PERSON_PATH);
    svg.appendChild(path);
    return svg;
  }

  /** アバターの中身を描く: 写真があれば写真、なければ人型アイコン */
  function fillAvatar(container, player) {
    const src = player && photos[player.id];
    if (src) { container.style.backgroundImage = 'url(' + src + ')'; return; }
    container.style.backgroundImage = '';
    container.appendChild(personIcon());
  }
  const POS = Object.fromEntries(POSITIONS.map(p => [p.key, p]));
  const FIELD_KEYS = POSITIONS.filter(p => p.key !== 'DH').map(p => p.key);

  // 打順の初期並び（定番）
  const DEFAULT_ORDER_DH  = ['CF', 'SS', 'RF', '3B', '1B', 'LF', 'DH', '2B', 'C'];
  const DEFAULT_ORDER_NODH = ['CF', 'SS', 'RF', '3B', '1B', 'LF', '2B', 'C', 'P'];

  // 表示用の短縮登録名（登録名が長すぎて枠に入らない選手のみ）
  const DISPLAY_NAME_OVERRIDES = {
    '53755138': 'スチュワートJr',  // スチュワート・ジュニア
    '93195150': 'モイセエフ'       // モイセエフ　ニキータ
  };

  /** 画面表示用の選手名（全角スペースを半角に、長すぎる名前は短縮形） */
  function displayName(player) {
    if (!player) return '';
    return DISPLAY_NAME_OVERRIDES[player.id] || player.name.replace(/　/g, ' ');
  }

  // 守備位置のラテン略号（共有画像の打順リスト用）
  const POS_EN = { P:'P', C:'C', '1B':'1B', '2B':'2B', '3B':'3B', SS:'SS', LF:'LF', CF:'CF', RF:'RF', DH:'DH' };

  /** 表示用の姓（表示名の空白より前） */
  function surnameOf(player) {
    return displayName(player).split(' ')[0];
  }

  // 球団別パレット（共有画像の打順バー等）: bar=帯 fg=帯上の文字 circ=番号丸 circFg=番号
  const TEAM_PALETTES = {
    g:  { bar: '#f97709', fg: '#ffffff', circ: '#ffffff', circFg: '#d95f00' },
    t:  { bar: '#141414', fg: '#ffe201', circ: '#ffe201', circFg: '#141414' },
    db: { bar: '#0055a5', fg: '#ffffff', circ: '#ffffff', circFg: '#0055a5' },
    c:  { bar: '#cf1126', fg: '#ffffff', circ: '#ffffff', circFg: '#cf1126' },
    s:  { bar: '#0a3260', fg: '#ffffff', circ: '#a6ce39', circFg: '#0a3260' },
    d:  { bar: '#003595', fg: '#ffffff', circ: '#ffffff', circFg: '#003595' },
    h:  { bar: '#f3c108', fg: '#171310', circ: '#171310', circFg: '#f3c108' },
    f:  { bar: '#0b3e66', fg: '#ffffff', circ: '#c8a86a', circFg: '#0b3e66' },
    m:  { bar: '#17191d', fg: '#ffffff', circ: '#c0c5cc', circFg: '#17191d' },
    e:  { bar: '#a3121f', fg: '#ffffff', circ: '#ffffff', circFg: '#a3121f' },
    b:  { bar: '#132238', fg: '#ffffff', circ: '#b69a6a', circFg: '#132238' },
    l:  { bar: '#15347a', fg: '#ffffff', circ: '#ffffff', circFg: '#15347a' },
    brand: { bar: '#ff6b2c', fg: '#16100b', circ: '#16100b', circFg: '#ff6b2c' }
  };

  /** 配置中の選手が全員同じ球団ならその球団のパレット、混成ならブランド色 */
  function currentPalette() {
    const ids = Object.values(state.assign).map(id => BY_ID.get(String(id))).filter(Boolean);
    if (!ids.length) return TEAM_PALETTES.brand;
    const teams = new Set(ids.map(p => p.teamId));
    if (teams.size === 1) return TEAM_PALETTES[ids[0].teamId] || TEAM_PALETTES.brand;
    return TEAM_PALETTES.brand;
  }

  // 新聞略記（狭い画面の打順表で使う）
  const TEAM_ABBR = {
    g: '巨', t: '神', db: 'De', c: '広', s: 'ヤ', d: '中',
    h: 'ソ', f: '日', m: 'ロ', e: '楽', b: 'オ', l: '西'
  };

  const TEAM_COLORS = {
    g: '#f97709', t: '#ffe201', db: '#0055a5', c: '#ff0000', s: '#00a0de', d: '#002569',
    h: '#fcc800', f: '#01609a', m: '#a0a4a8', e: '#85000b', b: '#b69a6a', l: '#102873'
  };

  const STORE_LINEUP = 'squadnine.lineup.v1';
  const STORE_PHOTOS = 'squadnine.photos.v1';
  const STORE_WELCOME = 'squadnine.welcomed.v1';

  // 共有画像に焼き込むサイト名。独自ドメイン取得後はここを書き換える
  const SHARE_SITE = 'mrymgn2022.github.io/squad-nine';

  // ロゴ（ボールに9）。viewBox 0 0 100 100 で描く中身
  const LOGO_MARK =
    '<circle cx="50" cy="50" r="46" fill="#f6f2e8"/>' +
    '<path d="M 21 18 Q 44 50 21 82" fill="none" stroke="#ff6b2c" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M 79 18 Q 56 50 79 82" fill="none" stroke="#ff6b2c" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M 25 27 l 7 3 M 23 39 l 8 2 M 23 51 l 8 0 M 23 62 l 8 -2 M 25 74 l 7 -3" stroke="#c9553e" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M 75 27 l -7 3 M 77 39 l -8 2 M 77 51 l -8 0 M 77 62 l -8 -2 M 75 74 l -7 -3" stroke="#c9553e" stroke-width="3" stroke-linecap="round"/>' +
    '<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#12171e">9</text>';

  /** 共有画像用: (x,y) を左上に size 角でロゴを描く */
  function logoSvg(x, y, size) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (size / 100) + ')">' + LOGO_MARK + '</g>';
  }

  /** 検索用にゆるく正規化する: 全角→半角、カタカナ→ひらがな、記号と空白を除去 */
  function normalizeQuery(s) {
    return String(s || '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[ｦ-ﾟ]/g, c => c)      // 半角カナはそのまま（実用上ほぼ入力されない）
      .replace(/[\s　・.,\-‐―ー]/g, '')
      .toLowerCase();
  }

  const PLAYERS = (window.NPB_PLAYERS || []).map(p => {
    const kana = p.kana || '';
    return Object.assign({}, p, {
      nameFlat: (p.name || '').replace(/　/g, ''),
      kanaFlat: normalizeQuery(kana),
      batsLabel: p.bats === '左右' ? '両' : p.bats
    });
  });
  const BY_ID = new Map(PLAYERS.map(p => [String(p.id), p]));

  const TEAMS = [];
  {
    const seen = new Set();
    for (const p of PLAYERS) {
      if (seen.has(p.teamId)) continue;
      seen.add(p.teamId);
      TEAMS.push({ id: p.teamId, name: p.team, short: p.teamShort, league: p.league });
    }
  }

  // ============================================================
  // 状態
  // ============================================================
  const state = {
    title: '',
    dh: true,
    notation: 'kanji',       // 'kanji' | 'kana'
    myTeam: TEAMS.length ? TEAMS[0].id : '',
    fieldStyle: 'koshien',   // 球場デザイン (field.js)
    assign: {},              // posKey -> playerId
    order: DEFAULT_ORDER_DH.slice()
  };

  let photos = {};           // playerId -> dataURL

  // ============================================================
  // 永続化
  // ============================================================
  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORE_LINEUP);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (typeof s.title === 'string') state.title = s.title;
          if (typeof s.dh === 'boolean') state.dh = s.dh;
          if (s.notation === 'kana' || s.notation === 'kanji') state.notation = s.notation;
          if (typeof s.myTeam === 'string' && TEAMS.some(t => t.id === s.myTeam)) state.myTeam = s.myTeam;
          if (typeof s.fieldStyle === 'string' && FIELD_STYLES.some(f => f.id === s.fieldStyle)) state.fieldStyle = s.fieldStyle;
          if (s.assign && typeof s.assign === 'object') {
            for (const k of Object.keys(s.assign)) {
              if (POS[k] && BY_ID.has(String(s.assign[k]))) state.assign[k] = String(s.assign[k]);
            }
          }
          if (Array.isArray(s.order)) {
            const clean = s.order.filter(k => POS[k]);
            if (clean.length) state.order = clean;
          }
        }
      }
    } catch (e) { /* 破損時は初期状態 */ }

    try {
      const raw = localStorage.getItem(STORE_PHOTOS);
      if (raw) photos = JSON.parse(raw) || {};
    } catch (e) { photos = {}; }

    syncOrder();
  }

  function saveLineup() {
    try { localStorage.setItem(STORE_LINEUP, JSON.stringify(state)); } catch (e) {}
  }

  // ------------------------------------------------------------
  // 共有URL  #v1.<flags>.<選手ID×10>.<打順>.<タイトル>
  //   選手IDは36進数に圧縮し、守備位置の並びは固定なのでキー名を持たない
  // ------------------------------------------------------------
  const POS_ORDER = POSITIONS.map(p => p.key);

  function encodeState() {
    const styleIdx = Math.max(0, FIELD_STYLES.findIndex(f => f.id === state.fieldStyle));
    const flags = (state.dh ? 1 : 0) + '' + (state.notation === 'kana' ? 1 : 0) + styleIdx.toString(36);
    const ids = POS_ORDER.map(k => {
      const id = state.assign[k];
      if (!id) return '';
      return /^\d+$/.test(id) ? parseInt(id, 10).toString(36) : '~' + encodeURIComponent(id);
    }).join('-');
    const order = state.order.map(k => POS_ORDER.indexOf(k).toString(36)).join('');
    return 'v1.' + flags + '.' + ids + '.' + order + '.' + encodeURIComponent(state.title || '');
  }

  function decodeState(hash) {
    const s = hash.replace(/^#/, '');
    if (s.indexOf('v1.') !== 0) return false;
    const parts = s.split('.');
    if (parts.length < 4) return false;
    try {
      const flags = parts[1];
      state.dh = flags[0] === '1';
      state.notation = flags[1] === '1' ? 'kana' : 'kanji';
      const style = FIELD_STYLES[parseInt(flags[2], 36)];
      if (style) state.fieldStyle = style.id;

      state.assign = {};
      parts[2].split('-').forEach((tok, i) => {
        const key = POS_ORDER[i];
        if (!key || !tok) return;
        const id = tok[0] === '~' ? decodeURIComponent(tok.slice(1)) : String(parseInt(tok, 36));
        if (BY_ID.has(id)) state.assign[key] = id;
      });

      const order = parts[3].split('').map(c => POS_ORDER[parseInt(c, 36)]).filter(Boolean);
      if (order.length) state.order = order;
      state.title = parts.length > 4 ? decodeURIComponent(parts.slice(4).join('.')) : '';
      syncOrder();
      return true;
    } catch (e) {
      return false;
    }
  }

  function shareUrl() {
    return location.origin + location.pathname + '#' + encodeState();
  }
  function savePhotos() {
    try {
      localStorage.setItem(STORE_PHOTOS, JSON.stringify(photos));
      return true;
    } catch (e) {
      toast('写真の保存領域が足りません。不要な写真を削除してください。');
      return false;
    }
  }

  // ============================================================
  // 打順ロジック
  // ============================================================
  function requiredKeys() {
    return state.dh
      ? FIELD_KEYS.filter(k => k !== 'P').concat('DH')
      : FIELD_KEYS.slice();
  }

  /** DHの有無に合わせて order を必要な9枠に揃える（既存の並びは維持） */
  function syncOrder() {
    const need = requiredKeys();
    const needSet = new Set(need);
    const kept = [];
    const seen = new Set();
    for (const k of state.order) {
      if (needSet.has(k) && !seen.has(k)) { kept.push(k); seen.add(k); }
    }
    const base = state.dh ? DEFAULT_ORDER_DH : DEFAULT_ORDER_NODH;
    for (const k of base) if (needSet.has(k) && !seen.has(k)) { kept.push(k); seen.add(k); }
    state.order = kept;
  }

  function playerAt(posKey) {
    const id = state.assign[posKey];
    return id ? BY_ID.get(String(id)) || null : null;
  }

  function posLabel(posKey) {
    const p = POS[posKey];
    if (!p) return '';
    return state.notation === 'kanji' ? p.kanji : p.kana;
  }

  function teamColor(player) {
    return (player && TEAM_COLORS[player.teamId]) || '#ff6b2c';
  }

  /** #rrggbb の輝度 (0-1) */
  function hexLum(c) {
    const h = String(c).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /** 暗い背景上の文字用: 球団カラーが暗い場合は白側に寄せて読めるようにする */
  function teamTextColor(player) {
    const c = teamColor(player);
    if (hexLum(c) >= 0.35) return c;
    const h = c.replace('#', '');
    const f = v => Math.round(parseInt(v, 16) + (255 - parseInt(v, 16)) * 0.6).toString(16).padStart(2, '0');
    return '#' + f(h.slice(0, 2)) + f(h.slice(2, 4)) + f(h.slice(4, 6));
  }

  function ageFrom(birth) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(birth || '');
    if (!m) return null;
    const b = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const md = now.getMonth() - b.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < b.getDate())) a--;
    return a;
  }

  // ============================================================
  // DOM
  // ============================================================
  const $ = sel => document.querySelector(sel);
  const el = {
    chips: $('#chips'),
    orderBody: $('#orderBody'),
    dhSeg: $('#dhSeg'),
    myTeam: $('#myTeam'),
    notationLabel: $('#notationLabel'),
    toast: $('#toast')
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.toast.hidden = true; }, 2600);
  }

  // ============================================================
  // 描画: フィールド
  // ============================================================
  function renderField() {
    el.chips.innerHTML = '';

    const keys = state.dh ? FIELD_KEYS.concat('DH') : FIELD_KEYS;
    for (const key of keys) {
      const p = POS[key];
      const player = playerAt(key);

      const chip = document.createElement('div');
      chip.className = 'chip' + (player ? ' has-player' : ' empty');
      chip.style.left = p.x + '%';
      chip.style.top = p.y + '%';
      chip.style.setProperty('--team', teamColor(player));
      chip.dataset.pos = key;
      chip.title = p.full + ' を選ぶ';

      const avatar = document.createElement('div');
      avatar.className = 'chip-avatar';

      const photo = document.createElement('div');
      photo.className = 'chip-photo';
      fillAvatar(photo, player);
      avatar.appendChild(photo);

      // DHだけは位置から役割が分からないので右上にDHバッジを付ける
      if (key === 'DH') {
        const badge = document.createElement('div');
        badge.className = 'chip-badge';
        badge.textContent = 'DH';
        avatar.appendChild(badge);
        chip.classList.add('has-badge');
      }

      // 📷と×は選手がいる駒にだけ付ける（空の駒は＋＝選手選択に専念させる）
      if (player) {
        const cam = document.createElement('button');
        cam.className = 'chip-cam';
        cam.type = 'button';
        cam.textContent = '📷';
        cam.title = '写真を設定';
        cam.addEventListener('click', ev => {
          ev.stopPropagation();
          openPhoto(player);
        });
        avatar.appendChild(cam);

        const del = document.createElement('button');
        del.className = 'chip-del';
        del.type = 'button';
        del.textContent = '×';
        del.title = 'この選手を外す';
        del.addEventListener('click', ev => {
          ev.stopPropagation();
          removePlayer(key);
        });
        avatar.appendChild(del);
      }

      chip.appendChild(avatar);
      if (player) {
        const name = document.createElement('div');
        name.className = 'chip-name';
        name.textContent = player.number + ' ' + surnameOf(player);
        chip.appendChild(name);
      } else {
        // 空きポジションは ＋ マークだけ（文字は出さない）
        const plus = document.createElement('div');
        plus.className = 'chip-add';
        plus.textContent = '+';
        avatar.appendChild(plus);
      }
      chip.addEventListener('click', () => openPicker(key));
      el.chips.appendChild(chip);
    }

  }

  // ============================================================
  // 描画: 打順表
  // ============================================================
  function renderOrder() {
    el.orderBody.innerHTML = '';

    state.order.forEach((key, idx) => {
      const player = playerAt(key);
      const tr = document.createElement('tr');
      tr.className = 'order-row';
      tr.dataset.idx = String(idx);

      const tdNo = document.createElement('td');
      tdNo.className = 'ord-no';
      tdNo.textContent = idx + 1;

      const tdPos = document.createElement('td');
      const posSpan = document.createElement('span');
      posSpan.className = 'ord-pos';
      posSpan.textContent = posLabel(key);
      posSpan.style.color = teamTextColor(player);
      tdPos.appendChild(posSpan);

      const tdName = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'ord-name';
      const av = document.createElement('div');
      av.className = 'ord-avatar' + (player ? '' : ' is-empty');
      av.style.setProperty('--team', teamColor(player));
      fillAvatar(av, player);
      const txt = document.createElement('div');
      txt.className = 'ord-text';
      const pn = document.createElement('div');
      pn.className = 'ord-pname' + (player ? '' : ' is-empty');
      pn.textContent = player ? displayName(player) : '（未設定）';
      const sub = document.createElement('div');
      sub.className = 'ord-sub';
      if (player) {
        // 球団名: PCはフル表記、狭い画面では新聞略記（CSSで切替）
        sub.appendChild(document.createTextNode('#' + player.number + ' '));
        const team = document.createElement('span');
        team.className = 'ord-team';
        team.textContent = player.teamShort + ' ';
        sub.appendChild(team);
        const abbr = document.createElement('span');
        abbr.className = 'ord-team-s';
        abbr.textContent = (TEAM_ABBR[player.teamId] || player.teamShort) + ' ';
        sub.appendChild(abbr);
        sub.appendChild(document.createTextNode(player.throws + '投' + player.batsLabel + '打'));
      } else {
        sub.textContent = POS[key].full;
      }
      txt.appendChild(pn);
      txt.appendChild(sub);
      wrap.appendChild(av);
      wrap.appendChild(txt);
      tdName.appendChild(wrap);
      tdName.style.cursor = 'pointer';
      tdName.addEventListener('click', () => openPicker(key));

      const tdAct = document.createElement('td');
      const btns = document.createElement('div');
      btns.className = 'ord-btns';

      // タッチ端末用の写真ボタン（駒のホバーが使えないため）
      if (player) {
        const cam = document.createElement('button');
        cam.type = 'button'; cam.className = 'cam'; cam.textContent = '📷';
        cam.title = '写真を設定';
        cam.addEventListener('click', () => openPhoto(player));
        btns.appendChild(cam);
      }

      const up = document.createElement('button');
      up.type = 'button'; up.className = 'mv'; up.textContent = '▲'; up.title = '上へ';
      up.addEventListener('click', () => moveOrder(idx, idx - 1));
      const dn = document.createElement('button');
      dn.type = 'button'; dn.className = 'mv'; dn.textContent = '▼'; dn.title = '下へ';
      dn.addEventListener('click', () => moveOrder(idx, idx + 1));
      btns.appendChild(up); btns.appendChild(dn);

      if (player) {
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'del'; del.textContent = '×';
        del.title = 'この選手を外す';
        del.addEventListener('click', () => removePlayer(key));
        btns.appendChild(del);
      }

      tdAct.appendChild(btns);

      tr.appendChild(tdNo); tr.appendChild(tdPos); tr.appendChild(tdName); tr.appendChild(tdAct);
      el.orderBody.appendChild(tr);
      attachRowDrag(tr, idx);
    });
  }

  function moveOrder(from, to) {
    if (to < 0 || to >= state.order.length || from === to) return;
    const arr = state.order;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    saveLineup();
    renderAll();
  }

  // ------------------------------------------------------------
  // 打順のライブ並べ替え（iOSのリスト編集/Apple Music方式）
  //   掴んだ行が指に追従し、他の行がリアルタイムに場所を空ける
  //   タッチ: ≡ハンドルのみ / マウス: 行のどこでも（5px動いたらドラッグ扱い）
  // ------------------------------------------------------------
  // ドラッグ中はページスクロールを止める（touch-actionは後から変えられないため）
  let touchDragActive = false;
  document.addEventListener('touchmove', e => { if (touchDragActive) e.preventDefault(); }, { passive: false });

  function attachRowDrag(row, fromIdx) {
    row.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return;                      // ▲▼×📷はそのまま
      // マウス: 5px動いたらドラッグ / タッチ: 220msの長押しで持ち上げ
      const mode = e.pointerType === 'mouse' ? 'threshold' : 'longpress';
      startRowDrag(e, row, fromIdx, mode);
    });
  }

  function startRowDrag(e, row, fromIdx, mode) {
    const rows = Array.from(el.orderBody.querySelectorAll('.order-row'));
    // ドキュメント座標で各行の中心を控えておく（オートスクロールしてもズレない）
    const mids = rows.map(r => {
      const rc = r.getBoundingClientRect();
      return rc.top + window.scrollY + rc.height / 2;
    });
    const h = rows[fromIdx].getBoundingClientRect().height;
    const startDocY = e.clientY + window.scrollY;
    const pid = e.pointerId;
    let engaged = false;
    let newIdx = fromIdx;
    let pressTimer = null;

    const engage = () => {
      engaged = true;
      touchDragActive = true;
      row.classList.add('drag-live');
      rows.forEach(r => { if (r !== row) r.classList.add('drag-anim'); });
      document.body.classList.add('dragging-order');
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
    };
    if (mode === 'immediate') { engage(); e.preventDefault(); }
    else if (mode === 'longpress') pressTimer = setTimeout(engage, 220);

    const onMove = ev => {
      if (ev.pointerId !== pid) return;
      const docY = ev.clientY + window.scrollY;
      const dy = docY - startDocY;
      if (!engaged) {
        if (mode === 'threshold') {
          if (Math.abs(dy) < 5) return;
          engage();
        } else {
          // 長押し前に大きく動いたらスクロールと判断して中止
          if (Math.abs(dy) > 10) finish(false);
          return;
        }
      }
      ev.preventDefault();
      row.style.transform = 'translateY(' + dy + 'px)';

      // 掴んだ行の中心が他の行の中心を跨いだら、その行をスライドさせる
      const centerY = mids[fromIdx] + dy;
      let up = 0, down = 0;
      rows.forEach((r, i) => {
        if (i === fromIdx) return;
        let ty = 0;
        if (i > fromIdx && centerY > mids[i]) { ty = -h; up++; }
        else if (i < fromIdx && centerY < mids[i]) { ty = h; down++; }
        r.style.transform = ty ? 'translateY(' + ty + 'px)' : '';
      });
      newIdx = fromIdx + up - down;

      // 画面端に近づいたらオートスクロール
      const m = 70;
      if (ev.clientY < m) window.scrollBy(0, -10);
      else if (ev.clientY > window.innerHeight - m) window.scrollBy(0, 10);
    };

    const finish = commit => {
      clearTimeout(pressTimer);
      touchDragActive = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.body.classList.remove('dragging-order');
      if (engaged && commit && newIdx !== fromIdx) {
        // 掴んだ行を確定位置へ滑らせてから並びを確定する
        row.style.transition = 'transform .12s ease';
        row.style.transform = 'translateY(' + ((newIdx - fromIdx) * h) + 'px)';
        setTimeout(() => moveOrder(fromIdx, newIdx), 120);
      } else {
        rows.forEach(r => { r.style.transform = ''; r.classList.remove('drag-anim', 'drag-live'); });
      }
      if (engaged) {
        // ドラッグ直後に発生するゴーストクリックだけを握りつぶす（250ms窓）
        const swallow = ev2 => { ev2.stopPropagation(); ev2.preventDefault(); };
        document.addEventListener('click', swallow, true);
        setTimeout(() => document.removeEventListener('click', swallow, true), 250);
      }
    };
    const onUp = ev => { if (ev.pointerId === pid) finish(true); };
    const onCancel = ev => { if (ev.pointerId === pid) finish(false); };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }

  /** オーソドックスな内野（土のダイヤ＋内側の芝＋白線）を (ox,oy,w,h) に描く
   *  盤面と共有画像で共用。※球場デザイン（field.js）は凍結中 */
  function infieldSvg(ox, oy, w, h, pre, withBg) {
    const k = Math.min(w / 1000, h / 900);
    const F = f => [ox + f[0] * w, oy + f[1] * h];
    const T = F([0.5, 0.24]), Rt = F([0.8, 0.55]), B = F([0.5, 0.86]), L = F([0.2, 0.55]);
    const Cc = F([0.5, 0.55]);
    const rhombus = t => 'M ' + [T, Rt, B, L].map(p =>
      (Cc[0] + (p[0] - Cc[0]) * t) + ' ' + (Cc[1] + (p[1] - Cc[1]) * t)).join(' L ') + ' Z';
    const out = [];
    out.push('<defs>');
    out.push('<linearGradient id="' + pre + 'gr" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3a8c4e"/><stop offset="100%" stop-color="#2b6b3b"/></linearGradient>');
    out.push('<linearGradient id="' + pre + 'dt" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#b3763f"/><stop offset="100%" stop-color="#96602f"/></linearGradient>');
    out.push('<pattern id="' + pre + 'mw" width="' + (72 * k) + '" height="' + (72 * k) + '" patternUnits="userSpaceOnUse">' +
      '<rect width="' + (36 * k) + '" height="' + (72 * k) + '" fill="#ffffff" opacity="0.035"/></pattern>');
    if (withBg) {
      out.push('<pattern id="' + pre + 'st" width="' + (118 * k) + '" height="' + (118 * k) + '" patternUnits="userSpaceOnUse">' +
        '<rect width="' + (118 * k) + '" height="' + (118 * k) + '" fill="#10151c"/>' +
        '<rect width="' + (59 * k) + '" height="' + (118 * k) + '" fill="#ffffff" opacity="0.018"/></pattern>');
    }
    out.push('</defs>');
    if (withBg) out.push('<rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + h + '" fill="url(#' + pre + 'st)"/>');
    // 土のダイヤ（外周を丸くふくらませた帯）
    out.push('<path d="' + rhombus(1) + '" fill="url(#' + pre + 'dt)" stroke="url(#' + pre + 'dt)" stroke-width="' + (58 * k) + '" stroke-linejoin="round"/>');
    // 内側の芝
    out.push('<path d="' + rhombus(0.72) + '" fill="url(#' + pre + 'gr)"/>');
    out.push('<path d="' + rhombus(0.72) + '" fill="url(#' + pre + 'mw)"/>');
    // ベースライン（白）
    out.push('<path d="' + rhombus(1) + '" fill="none" stroke="#f2ead9" stroke-width="' + (6 * k) + '" opacity="0.85"/>');
    // マウンド
    out.push('<circle cx="' + Cc[0] + '" cy="' + Cc[1] + '" r="' + (54 * k) + '" fill="#8a5a34"/>');
    out.push('<rect x="' + (Cc[0] - 12 * k) + '" y="' + (Cc[1] - 4 * k) + '" width="' + (24 * k) + '" height="' + (8 * k) + '" fill="#f2ead9"/>');
    // 本塁まわりの土と本塁
    out.push('<circle cx="' + B[0] + '" cy="' + B[1] + '" r="' + (62 * k) + '" fill="url(#' + pre + 'dt)"/>');
    out.push('<path d="M ' + (B[0] - 16 * k) + ' ' + (B[1] - 12 * k) + ' h' + (32 * k) + ' v' + (14 * k) +
      ' l-' + (16 * k) + ' ' + (14 * k) + ' l-' + (16 * k) + ' -' + (14 * k) + ' z" fill="#f2ead9"/>');
    // 塁ベース（白）
    [T, Rt, L].forEach(p => {
      out.push('<rect x="' + (p[0] - 17 * k) + '" y="' + (p[1] - 17 * k) + '" width="' + (34 * k) + '" height="' + (34 * k) +
        '" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')" fill="#f2ead9"/>');
    });
    return out.join('');
  }

  function renderFieldArt() {
    const svg = document.querySelector('.field-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', '0 0 1000 900');
    svg.innerHTML = infieldSvg(0, 0, 1000, 900, 'bd', true);
  }

  function renderAll() {
    renderField();
    renderOrder();
  }

  // ============================================================
  // 選手選択モーダル
  // ============================================================
  const picker = {
    modal: $('#pickerModal'),
    title: $('#pickerTitle'),
    search: $('#pickerSearch'),
    team: $('#pickerTeam'),
    group: $('#pickerGroup'),
    ikusei: $('#pickerIkusei'),
    list: $('#pickerList'),
    count: $('#pickerCount'),
    target: null
  };

  function fillTeamSelects() {
    const opts = TEAMS.map(t => '<option value="' + t.id + '">' + t.short + '</option>').join('');
    el.myTeam.innerHTML = opts;
    el.myTeam.value = state.myTeam;
    picker.team.innerHTML = '<option value="all">全球団</option>' + opts;
  }

  function openPicker(posKey) {
    picker.target = posKey;
    picker.title.textContent = POS[posKey].full + ' を選ぶ';
    // その守備位置の登録区分を初期値にする（DHは区分がないので内野手を初期表示）
    picker.group.value = POS[posKey].group || (posKey === 'DH' ? '内野手' : 'all');
    picker.team.value = state.myTeam || 'all';
    picker.search.value = '';
    picker.modal.hidden = false;
    renderPickerList();
    setTimeout(() => picker.search.focus(), 30);
  }

  function closePicker() {
    picker.modal.hidden = true;
    picker.target = null;
  }

  function pickerFiltered() {
    const q = normalizeQuery(picker.search.value);
    const team = picker.team.value;
    const group = picker.group.value;
    const inclIkusei = picker.ikusei.checked;

    return PLAYERS.filter(p => {
      if (!inclIkusei && p.roster === '育成') return false;
      if (team !== 'all' && p.teamId !== team) return false;
      if (group !== 'all' && p.group !== group) return false;
      if (q) {
        const hit = p.nameFlat.indexOf(q) >= 0 ||
                    (p.kanaFlat && p.kanaFlat.indexOf(q) >= 0) ||
                    p.number.indexOf(q) >= 0;
        if (!hit) return false;
      }
      return true;
    });
  }

  function renderPickerList() {
    const list = pickerFiltered();
    picker.list.innerHTML = '';
    picker.count.textContent = list.length + ' 名';

    if (!list.length) {
      picker.list.innerHTML = '<div class="p-empty">該当する選手がいません。<br>フィルターを緩めてみてください。</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    const used = new Set(Object.values(state.assign).map(String));

    for (const p of list.slice(0, 400)) {
      const row = document.createElement('div');
      row.className = 'p-item';

      const num = document.createElement('div');
      num.className = 'p-num';
      num.textContent = p.number;

      const av = document.createElement('div');
      av.className = 'p-avatar';
      av.style.borderColor = teamColor(p);
      fillAvatar(av, p);

      const main = document.createElement('div');
      main.className = 'p-main';
      const nm = document.createElement('div');
      nm.className = 'p-name';
      nm.textContent = p.name.replace(/　/g, ' ');
      const sub = document.createElement('div');
      sub.className = 'p-sub';
      const age = ageFrom(p.birth);
      sub.textContent = [
        p.teamShort, p.group,
        p.throws + '投' + p.batsLabel + '打',
        p.height + 'cm/' + p.weight + 'kg',
        p.birth + (age !== null ? '(' + age + ')' : '')
      ].join(' · ');
      main.appendChild(nm);
      main.appendChild(sub);

      const tagWrap = document.createElement('div');
      if (p.roster === '育成') {
        const t = document.createElement('span');
        t.className = 'p-tag';
        t.textContent = '育成';
        tagWrap.appendChild(t);
      }
      if (used.has(String(p.id))) {
        const t = document.createElement('span');
        t.className = 'p-tag';
        t.style.background = '#1d2f22'; t.style.color = '#6bbf87'; t.style.borderColor = '#2c4a35';
        t.textContent = '起用中';
        tagWrap.appendChild(t);
      }

      row.appendChild(num); row.appendChild(av); row.appendChild(main); row.appendChild(tagWrap);
      row.addEventListener('click', () => assignPlayer(picker.target, p.id));
      frag.appendChild(row);
    }
    picker.list.appendChild(frag);

    if (list.length > 400) {
      const more = document.createElement('div');
      more.className = 'p-empty';
      more.textContent = '他 ' + (list.length - 400) + ' 名 … 検索で絞り込んでください';
      picker.list.appendChild(more);
    }
  }

  function removePlayer(posKey) {
    if (!state.assign[posKey]) return;
    delete state.assign[posKey];
    saveLineup();
    renderAll();
  }

  function resetBoard() {
    if (!confirm('盤面をリセットします。配置した選手と打順が初期状態に戻ります。（写真は残ります）')) return;
    state.assign = {};
    state.order = (state.dh ? DEFAULT_ORDER_DH : DEFAULT_ORDER_NODH).slice();
    syncOrder();
    saveLineup();
    renderAll();
    toast('盤面をリセットしました');
  }

  function assignPlayer(posKey, playerId) {
    const id = String(playerId);
    // 同じ選手が別ポジションにいたら外す
    for (const k of Object.keys(state.assign)) {
      if (k !== posKey && String(state.assign[k]) === id) delete state.assign[k];
    }
    state.assign[posKey] = id;
    saveLineup();
    closePicker();
    renderAll();
  }

  picker.search.addEventListener('input', renderPickerList);
  picker.team.addEventListener('change', renderPickerList);
  picker.group.addEventListener('change', renderPickerList);
  picker.ikusei.addEventListener('change', renderPickerList);

  // ============================================================
  // 写真モーダル（トリミング付き）
  // ============================================================
  const photo = {
    modal: $('#photoModal'),
    name: $('#photoTargetName'),
    area: $('#cropArea'),
    canvas: $('#cropCanvas'),
    zoomRow: $('#zoomRow'),
    zoom: $('#zoomRange'),
    file: $('#photoFile'),
    player: null,
    img: null,
    scale: 1,
    ox: 0,
    oy: 0
  };
  const CROP_SIZE = 360;
  const OUT_SIZE = 320;

  function openPhoto(player) {
    photo.player = player;
    photo.name.textContent = player.name.replace(/　/g, ' ') + '（' + player.teamShort + '）';
    photo.img = null;
    photo.scale = 1; photo.ox = 0; photo.oy = 0;
    photo.zoom.value = 100;
    photo.area.classList.remove('has-image');
    photo.zoomRow.hidden = true;
    photo.modal.hidden = false;

    const existing = photos[player.id];
    if (existing) loadImageIntoCrop(existing);
  }

  function closePhoto() {
    photo.modal.hidden = true;
    photo.player = null;
    photo.img = null;
  }

  function loadImageIntoCrop(src) {
    const im = new Image();
    im.onload = () => {
      photo.img = im;
      // cover になる最小倍率を1.0とする
      photo.baseScale = Math.max(CROP_SIZE / im.width, CROP_SIZE / im.height);
      photo.scale = 1;
      photo.ox = 0; photo.oy = 0;
      photo.zoom.value = 100;
      photo.area.classList.add('has-image');
      photo.zoomRow.hidden = false;
      drawCrop();
    };
    im.onerror = () => toast('画像を読み込めませんでした');
    im.src = src;
  }

  function clampOffsets() {
    if (!photo.img) return;
    const s = photo.baseScale * photo.scale;
    const w = photo.img.width * s;
    const h = photo.img.height * s;
    const maxX = Math.max(0, (w - CROP_SIZE) / 2);
    const maxY = Math.max(0, (h - CROP_SIZE) / 2);
    photo.ox = Math.max(-maxX, Math.min(maxX, photo.ox));
    photo.oy = Math.max(-maxY, Math.min(maxY, photo.oy));
  }

  function drawCrop() {
    const ctx = photo.canvas.getContext('2d');
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    if (!photo.img) return;
    clampOffsets();
    const s = photo.baseScale * photo.scale;
    const w = photo.img.width * s;
    const h = photo.img.height * s;
    ctx.drawImage(photo.img, (CROP_SIZE - w) / 2 + photo.ox, (CROP_SIZE - h) / 2 + photo.oy, w, h);
  }

  photo.zoom.addEventListener('input', () => {
    photo.scale = +photo.zoom.value / 100;
    drawCrop();
  });

  // ドラッグで位置調整
  (function () {
    let dragging = false, lx = 0, ly = 0;
    const start = (x, y) => { if (!photo.img) return; dragging = true; lx = x; ly = y; };
    const move = (x, y) => {
      if (!dragging) return;
      const r = photo.area.getBoundingClientRect();
      const k = CROP_SIZE / r.width;
      photo.ox += (x - lx) * k; photo.oy += (y - ly) * k;
      lx = x; ly = y;
      drawCrop();
    };
    const end = () => { dragging = false; };

    photo.area.addEventListener('pointerdown', e => { start(e.clientX, e.clientY); photo.area.setPointerCapture(e.pointerId); });
    photo.area.addEventListener('pointermove', e => move(e.clientX, e.clientY));
    photo.area.addEventListener('pointerup', end);
    photo.area.addEventListener('pointercancel', end);
  })();

  // ファイル / D&D / ペースト
  function readFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('画像ファイルを指定してください'); return; }
    const fr = new FileReader();
    fr.onload = () => loadImageIntoCrop(fr.result);
    fr.readAsDataURL(file);
  }

  photo.file.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    readFile(f);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev =>
    photo.area.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  photo.area.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    const dt = e.dataTransfer;
    if (dt.files && dt.files[0]) { readFile(dt.files[0]); return; }
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url) loadImageIntoCrop(url);
  });

  function handlePaste(e) {
    if (photo.modal.hidden) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.indexOf('image') === 0) {
        readFile(it.getAsFile());
        e.preventDefault();
        return;
      }
    }
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (text && /^https?:\/\//.test(text.trim())) {
      loadImageIntoCrop(text.trim());
      e.preventDefault();
    }
  }
  document.addEventListener('paste', handlePaste);

  // タッチ端末用: 長押し→ペーストの受け皿。貼り付けは document の paste ハンドラが処理する
  const pasteZone = $('#pasteZone');
  if (pasteZone) {
    pasteZone.addEventListener('input', () => { pasteZone.textContent = ''; });   // 文字が入ったら消す
  }
  const isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;

  $('#btnPhotoPaste').addEventListener('click', async () => {
    const fallback = () => {
      if (isTouch && pasteZone) {
        pasteZone.focus();
        toast('下の点線の欄を長押しして「ペースト」を選んでください');
      } else {
        toast('Ctrl+V で貼り付けてください');
      }
    };
    if (!navigator.clipboard || !navigator.clipboard.read) { fallback(); return; }
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find(t => t.indexOf('image') === 0);
        if (type) {
          const blob = await it.getType(type);
          readFile(new File([blob], 'paste.png', { type }));
          return;
        }
      }
      toast('クリップボードに画像がありません');
    } catch (err) {
      fallback();
    }
  });

  $('#btnPhotoSearch').addEventListener('click', () => {
    if (!photo.player) return;
    const q = encodeURIComponent(photo.player.nameFlat + ' ' + photo.player.teamShort + ' 選手');
    window.open('https://www.google.com/search?tbm=isch&q=' + q, '_blank', 'noopener');
    toast('画像を右クリック→「画像をコピー」→ Ctrl+V で貼り付け');
  });

  $('#btnPhotoRemove').addEventListener('click', () => {
    if (!photo.player) return;
    delete photos[photo.player.id];
    savePhotos();
    closePhoto();
    renderAll();
  });

  $('#btnPhotoSave').addEventListener('click', () => {
    if (!photo.player) return;
    if (!photo.img) { toast('画像を選んでください'); return; }
    const out = document.createElement('canvas');
    out.width = OUT_SIZE; out.height = OUT_SIZE;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
    ctx.drawImage(photo.canvas, 0, 0, CROP_SIZE, CROP_SIZE, 0, 0, OUT_SIZE, OUT_SIZE);
    let data;
    try { data = out.toDataURL('image/jpeg', 0.86); }
    catch (err) { toast('この画像は保存できません（外部サイトの画像は一度ダウンロードしてください）'); return; }
    photos[photo.player.id] = data;
    if (savePhotos()) toast('写真を保存しました');
    closePhoto();
    renderAll();
  });

  // ============================================================
  // 共有画像 (SVG → PNG)
  // ============================================================
  // 主戦場はXなので16:9を先頭（デフォルト）にする
  const SHARE_PRESETS = [
    { id: 'x',     label: 'X (Twitter)', note: '16:9',  w: 1600, h: 900 },
    { id: 'ig',    label: 'Instagram',   note: '4:5',   w: 1080, h: 1350 },
    { id: 'sq',    label: '正方形',       note: '1:1',   w: 1080, h: 1080 },
    { id: 'story', label: 'ストーリーズ', note: '9:16',  w: 1080, h: 1920 }
  ];
  const FONT = "'Yu Gothic','Hiragino Kaku Gothic ProN','Noto Sans JP','Meiryo',sans-serif";
  let sharePreset = SHARE_PRESETS[0];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 共有画像用の丸アバター: 写真があれば写真、なければ人型アイコン */
  function shareAvatar(cx, cy, R, player, clipId) {
    const out = [];
    const src = player && photos[player.id];
    out.push('<clipPath id="' + clipId + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '"/></clipPath>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#10161d"/>');
    if (src) {
      out.push('<image x="' + (cx - R) + '" y="' + (cy - R) + '" width="' + (R * 2) + '" height="' + (R * 2) +
        '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clipId + ')" href="' + src + '"/>');
    } else {
      const s = (R * 1.32) / 24;
      out.push('<g transform="translate(' + (cx - R * 0.66) + ',' + (cy - R * 0.62) + ') scale(' + s + ')">' +
        '<path d="' + PERSON_PATH + '" fill="rgba(255,255,255,0.38)"/></g>');
    }
    return out.join('');
  }

  /** 共有画像のフィールド部分（フェンスなしダイヤモンド）を (fx,fy,fw,fh) に描く */
  /** 共有画像のフィールド: 盤面と同じオーソドックスな内野を使う */
  function shareFieldSvg(fx, fy, fw, fh) {
    return infieldSvg(fx, fy, fw, fh, 'shf', false);
  }
  function buildShareSVG(W, H) {
    const u = Math.min(W, H) / 1080;
    const pal = currentPalette();
    const parts = [];

    // 背景（微細な縦ストライプ）
    parts.push('<pattern id="shbg" width="' + (118 * u) + '" height="' + (118 * u) + '" patternUnits="userSpaceOnUse">' +
      '<rect width="' + (118 * u) + '" height="' + (118 * u) + '" fill="#10151c"/>' +
      '<rect width="' + (59 * u) + '" height="' + (118 * u) + '" fill="#ffffff" opacity="0.018"/></pattern>');
    parts.push('<rect width="' + W + '" height="' + H + '" fill="url(#shbg)"/>');

    // 打順リストの行データ（パはP行を追加）
    const rows = state.order.map((k, i) => ({ num: String(i + 1), pos: POS_EN[k] || '', player: playerAt(k) }));
    if (state.dh) rows.push({ num: 'P', pos: '', player: playerAt('P') });

    // 枠いっぱいに使う。ダイヤモンドは枠の形に合わせて伸縮する（楽天公式も横広の菱形）
    const side = W >= H;                 // 16:9・1:1は横並び / 4:5・9:16は縦積み
    const m = 24 * u, footH = 46 * u, gap = 14 * u;
    let fx, fy, fw, fh, sx, sy, listW, rh;
    if (side) {
      listW = Math.max(300 * u, W * 0.30);
      fw = W - listW - m * 3;
      fh = Math.min(H - footH - m * 2, fw * 0.92);
      fx = m;
      fy = (H - footH - fh) / 2;
      sx = W - m - listW;
      rh = Math.min(96 * u, (H - m * 2 - footH) / rows.length);
      sy = (H - footH - rh * rows.length) / 2;
    } else {
      fw = W - m * 2;
      const availH = H - m - footH;
      fh = Math.min(fw * 0.62, availH * 0.52);
      rh = Math.min(96 * u, (availH - fh - gap) / rows.length);
      let slack = availH - fh - gap - rh * rows.length;
      const grow = Math.min(Math.max(0, slack), fw * 0.75 - fh);
      fh += grow; slack -= grow;
      fx = m;
      fy = m + Math.max(0, slack) / 2;
      sx = m; listW = fw;
      sy = fy + fh + gap;
    }

    // --- フィールド ---
    parts.push(shareFieldSvg(fx, fy, fw, fh));

    // --- 選手チップ（背番号＋姓の名前札つき）---
    const R = Math.min(fw * 0.063, fh * 0.082);
    const chipKeys = state.dh ? FIELD_KEYS.concat('DH') : FIELD_KEYS;
    for (const key of chipKeys) {
      const p = POS[key];
      const cx = fx + p.x / 100 * fw;
      const cy = fy + p.y / 100 * fh;
      const player = playerAt(key);
      parts.push(shareAvatar(cx, cy, R, player, 'shc_' + key));
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' +
        (player ? teamColor(player) : '#39434f') + '" stroke-width="' + (R * 0.11) + '"/>');
      if (key === 'DH') {
        // 右上のDHバッジ（白箱・濃色文字）
        const bw2 = R * 0.92, bh2 = R * 0.44;
        parts.push('<rect x="' + (cx + R * 0.42) + '" y="' + (cy - R * 1.04) + '" width="' + bw2 + '" height="' + bh2 +
          '" rx="' + (bh2 * 0.25) + '" fill="#f2f2f4"/>');
        parts.push('<text x="' + (cx + R * 0.42 + bw2 / 2) + '" y="' + (cy - R * 1.04 + bh2 * 0.74) +
          '" text-anchor="middle" font-family="' + FONT + '" font-size="' + (bh2 * 0.7) + '" font-weight="900" fill="#12171e">DH</text>');
      }
      if (player) {
        const label = player.number + ' ' + surnameOf(player);
        const fz = R * 0.42;
        const w = label.length * fz * 0.92 + fz * 1.2;
        const hh = fz * 1.75;
        parts.push('<rect x="' + (cx - w / 2) + '" y="' + (cy + R + R * 0.14) + '" width="' + w + '" height="' + hh +
          '" rx="' + (hh * 0.28) + '" fill="rgba(8,12,17,0.92)" stroke="rgba(255,255,255,0.14)"/>');
        parts.push('<text x="' + cx + '" y="' + (cy + R + R * 0.14 + hh * 0.72) + '" text-anchor="middle" font-family="' + FONT +
          '" font-size="' + fz + '" font-weight="bold" fill="#ffffff">' + esc(label) + '</text>');
      }
    }

    // --- 打順リスト（球団カラーの帯・番号丸・守備略号・フル名）---
    // LIST_PANEL=true なら右側全体を球団カラーの1枚パネルにする（バー個別ではなく）
    const LIST_PANEL = window.__SHARE_LIST_PANEL !== false;   // 既定は全面パネル
    const names = rows.map(r => r.player ? displayName(r.player) : '未設定');
    const maxLen = Math.max.apply(null, names.map(s => s.length));
    const nameFz = Math.min(rh * 0.42, (listW - rh * 1.7) / maxLen);
    if (LIST_PANEL) {
      // 横並び: 右側全面 / 縦積み: リスト開始位置から下端まで（フッターもパネル上）
      const panelY = side ? 0 : sy - 8 * u;
      const panelH = side ? H : H - panelY;
      const panelX = side ? sx - 12 * u : 0;
      const panelW = side ? W - panelX : W;
      parts.push('<rect x="' + panelX + '" y="' + panelY + '" width="' + panelW + '" height="' + panelH +
        '" fill="' + pal.bar + '"/>');
    }
    rows.forEach((r, i) => {
      const y = sy + i * rh;
      const bh = rh - 8 * u;
      const cyy = y + bh / 2;
      if (LIST_PANEL) {
        if (i > 0) parts.push('<line x1="' + (sx + 4 * u) + '" y1="' + (y - 4 * u) + '" x2="' + (sx + listW - 4 * u) +
          '" y2="' + (y - 4 * u) + '" stroke="rgba(255,255,255,0.22)" stroke-width="' + (1.5 * u) + '"/>');
      } else {
        parts.push('<rect x="' + sx + '" y="' + y + '" width="' + listW + '" height="' + bh +
          '" rx="' + (10 * u) + '" fill="' + pal.bar + '" stroke="rgba(255,255,255,0.13)" stroke-width="' + (1.5 * u) + '"/>');
      }
      parts.push('<circle cx="' + (sx + rh * 0.42) + '" cy="' + cyy + '" r="' + (rh * 0.27) + '" fill="' + pal.circ + '"/>');
      parts.push('<text x="' + (sx + rh * 0.42) + '" y="' + (cyy + rh * 0.1) + '" text-anchor="middle" font-family="' + FONT +
        '" font-size="' + (rh * 0.3) + '" font-weight="900" fill="' + pal.circFg + '">' + r.num + '</text>');
      let nx = sx + rh * 0.78;
      if (r.pos) {
        parts.push('<rect x="' + nx + '" y="' + (cyy - rh * 0.195) + '" width="' + (rh * 0.56) + '" height="' + (rh * 0.39) +
          '" rx="' + (5 * u) + '" fill="rgba(0,0,0,0.35)"/>');
        parts.push('<text x="' + (nx + rh * 0.28) + '" y="' + (cyy + rh * 0.115) + '" text-anchor="middle" font-family="' + FONT +
          '" font-size="' + (rh * 0.25) + '" font-weight="900" fill="#ffffff">' + r.pos + '</text>');
      }
      nx += rh * 0.68;
      parts.push('<text x="' + nx + '" y="' + (cyy + nameFz * 0.36) + '" font-family="' + FONT +
        '" font-size="' + nameFz + '" font-weight="900" fill="' + pal.fg + '"' +
        (r.player ? '' : ' opacity="0.55"') + '>' + esc(names[i]) + '</text>');
    });

    // --- フッター: ロゴ＋SQUAD NINE（左）、ドメイン（右）---
    // 縦積み＋パネル時はフッター全体がパネル上に乗るので文字を白系にする
    const onPanelL = LIST_PANEL && !side;
    const onPanelR = LIST_PANEL;
    const fBase = H - 16 * u;
    const fSize = 34 * u;
    parts.push(logoSvg(m, fBase - fSize * 0.82, fSize));
    parts.push('<text x="' + (m + fSize + 10 * u) + '" y="' + fBase + '" font-family="' + FONT +
      '" font-size="' + (19 * u) + '" font-weight="bold" letter-spacing="' + (3 * u) + '" fill="' +
      (onPanelL ? 'rgba(255,255,255,0.92)' : '#8b98a5') + '">SQUAD NINE</text>');
    if (SHARE_SITE) {
      parts.push('<text x="' + (W - m) + '" y="' + fBase + '" text-anchor="end" font-family="' + FONT +
        '" font-size="' + (15 * u) + '" font-weight="bold" fill="' +
        (onPanelR ? 'rgba(255,255,255,0.88)' : '#ff6b2c') + '">' + esc(SHARE_SITE) + '</text>');
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W +
      '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + parts.join('') + '</svg>';
  }

  let shareBlob = null;

  function renderShareSizes() {
    const box = $('#shareSizes');
    box.innerHTML = '';
    for (const preset of SHARE_PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'size-btn' + (preset.id === sharePreset.id ? ' is-on' : '');
      b.innerHTML = '<b>' + preset.label + '</b><small>' + preset.note + '</small>';
      b.addEventListener('click', () => {
        sharePreset = preset;
        renderShareSizes();
        renderSharePreview();
      });
      box.appendChild(b);
    }
  }

  function renderSharePreview() {
    const W = sharePreset.w, H = sharePreset.h;
    $('#shareDim').textContent = W + ' × ' + H + ' px';
    $('#sharePreview').innerHTML = '<div class="hint">生成中…</div>';
    shareBlob = null;

    const svg = buildShareSVG(W, H);
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0e1116';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(im, 0, 0);
      cv.toBlob(blob => {
        shareBlob = blob;
        const out = URL.createObjectURL(blob);
        $('#sharePreview').innerHTML = '<img alt="スタメン画像" src="' + out + '">';
        const nativeBtn = $('#btnShareNative');
        nativeBtn.hidden = !(navigator.canShare &&
          navigator.canShare({ files: [new File([blob], 'x.png', { type: 'image/png' })] }));
      }, 'image/png');
    };
    im.onerror = () => {
      $('#sharePreview').innerHTML = '<div class="hint">画像の生成に失敗しました</div>';
    };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function openShare() {
    $('#shareModal').hidden = false;
    renderShareSizes();
    renderSharePreview();
  }

  function shareFilename() {
    const t = (state.title.trim() || 'squad-nine').replace(/[\\/:*?"<>|\s]+/g, '_');
    return t + '_' + sharePreset.w + 'x' + sharePreset.h + '.png';
  }

  $('#btnShareDownload').addEventListener('click', () => {
    if (!downloadShareImage()) toast('生成中です');
  });

  $('#btnShareLink').addEventListener('click', async () => {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('リンクをコピーしました');
    } catch (err) {
      prompt('コピーしてください', url);
    }
  });

  function shareText() {
    return (state.title.trim() || 'マイスタメン') + ' #SQUADNINE';
  }

  function downloadShareImage() {
    if (!shareBlob) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(shareBlob);
    a.download = shareFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }

  /** 画像付きでOSの共有シートを開く。開けなければ false */
  async function trySystemShare(extraText) {
    if (!shareBlob) return false;
    const file = new File([shareBlob], shareFilename(), { type: 'image/png' });
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) return false;
    try {
      await navigator.share({ files: [file], text: extraText });
      return true;
    } catch (err) {
      // ユーザーのキャンセルは成功扱い（フォールバックさせない）
      return err && err.name === 'AbortError';
    }
  }

  // X: 画像付き共有シート → 無理なら 画像を保存して投稿画面を開く
  $('#btnShareX').addEventListener('click', async () => {
    if (!shareBlob) { toast('生成中です'); return; }
    if (await trySystemShare(shareText() + '\n' + shareUrl())) return;
    downloadShareImage();
    const u = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) +
              '&url=' + encodeURIComponent(shareUrl());
    window.open(u, '_blank', 'noopener');
    toast('画像を保存しました。投稿に添付してください');
  });

  // Instagram: 画像付き共有シート → 無理なら 画像を保存して案内
  $('#btnShareIG').addEventListener('click', async () => {
    if (!shareBlob) { toast('生成中です'); return; }
    if (await trySystemShare(shareText())) return;
    downloadShareImage();
    toast('画像を保存しました。Instagramアプリから投稿してください');
  });

  $('#btnShareNative').addEventListener('click', async () => {
    if (!shareBlob) return;
    await trySystemShare(shareText() + '\n' + shareUrl());
  });

  // ============================================================
  // その他の操作
  // ============================================================
  function syncNotationUi() {
    el.notationLabel.textContent = state.notation === 'kanji' ? '漢字' : 'カナ';
    document.body.classList.toggle('nota-kana', state.notation === 'kana');
  }

  $('#btnNotation').addEventListener('click', () => {
    state.notation = state.notation === 'kanji' ? 'kana' : 'kanji';
    syncNotationUi();
    saveLineup();
    renderAll();
  });

  el.dhSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    const dh = btn.dataset.dh === '1';
    if (dh === state.dh) return;
    state.dh = dh;
    syncOrder();
    saveLineup();
    updateDhSeg();
    renderAll();
  });

  function updateDhSeg() {
    el.dhSeg.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('is-on', (b.dataset.dh === '1') === state.dh);
    });
  }

  el.myTeam.addEventListener('change', () => {
    state.myTeam = el.myTeam.value;
    saveLineup();
  });

  $('#btnReset').addEventListener('click', resetBoard);

  // ------------------------------------------------------------
  // 初回訪問: 応援球団を選んでもらい、その球団のスタメンを出す
  // ------------------------------------------------------------
  function welcomeDone() {
    try { localStorage.setItem(STORE_WELCOME, '1'); } catch (e) {}
    $('#welcome').hidden = true;
  }

  function showWelcome() {
    const grid = $('#welcomeGrid');
    grid.innerHTML = '';
    for (const t of TEAMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'team-tile' + (hexLum(TEAM_COLORS[t.id] || '#333') >= 0.55 ? ' light' : '');
      btn.style.background = TEAM_COLORS[t.id] || '#333';
      btn.textContent = t.short;
      btn.addEventListener('click', () => {
        state.myTeam = t.id;
        el.myTeam.value = t.id;
        applyPreset(t.id);
        saveLineup();
        welcomeDone();
        toast('円をタップすると選手を入れ替えられます');
      });
      grid.appendChild(btn);
    }
    $('#welcome').hidden = false;
  }

  $('#welcomeSkip').addEventListener('click', welcomeDone);

  /** 球団プリセットを適用する。適用できたら true */
  function applyPreset(teamId) {
    const pre = window.NPB_PRESETS && window.NPB_PRESETS.teams && window.NPB_PRESETS.teams[teamId];
    if (!pre || !pre.assign) return false;
    if (typeof pre.dh === 'boolean') state.dh = pre.dh;
    state.assign = {};
    for (const k of Object.keys(pre.assign)) {
      const id = String(pre.assign[k]);
      if (POS[k] && BY_ID.has(id)) state.assign[k] = id;
    }
    if (Array.isArray(pre.order)) {
      const clean = pre.order.filter(k => POS[k]);
      if (clean.length) state.order = clean;
    }
    syncOrder();
    updateDhSeg();
    saveLineup();
    renderAll();
    return true;
  }

  // おまかせ配置: 選択中の球団のプリセットを適用する
  $('#btnAuto').addEventListener('click', () => {
    const teamId = el.myTeam.value;
    const team = TEAMS.find(t => t.id === teamId);
    const short = team ? team.short : '';
    const pre = window.NPB_PRESETS && window.NPB_PRESETS.teams && window.NPB_PRESETS.teams[teamId];
    if (!pre || !pre.assign) {
      toast(short + 'のおまかせ配置は準備中です');
      return;
    }
    if (Object.keys(state.assign).length &&
        !confirm('今のスタメンを ' + short + ' のおすすめ配置で置き換えますか？')) return;
    applyPreset(teamId);
    toast(short + 'のおすすめスタメンを配置しました');
  });

  $('#btnShare').addEventListener('click', openShare);
  $('#btnMenu').addEventListener('click', () => { $('#menuModal').hidden = false; });

  $('#btnCopyText').addEventListener('click', async () => {
    const lines = [state.title.trim() || 'スタメン'];
    state.order.forEach((key, i) => {
      const p = playerAt(key);
      lines.push((i + 1) + '  ' + posLabel(key) + '  ' + (p ? p.name.replace(/　/g, ' ') : '—'));
    });
    if (state.dh) {
      const pit = playerAt('P');
      lines.push('P  ' + (pit ? pit.name.replace(/　/g, ' ') : '—'));
    }
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch (err) {
      prompt('コピーしてください', text);
    }
    $('#menuModal').hidden = true;
  });

  $('#fieldStyle').addEventListener('change', e => {
    state.fieldStyle = e.target.value;
    saveLineup();
    renderFieldArt();
  });

  $('#btnResetPhotos').addEventListener('click', () => {
    if (!confirm('保存した写真をすべて削除しますか？')) return;
    photos = {};
    savePhotos();
    $('#menuModal').hidden = true;
    renderAll();
    toast('写真を削除しました');
  });

  // モーダル共通の閉じる操作
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m || e.target.hasAttribute('data-close')) {
        if (m.id === 'pickerModal') closePicker();
        else if (m.id === 'photoModal') closePhoto();
        else m.hidden = true;
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal:not([hidden])').forEach(m => {
      if (m.id === 'pickerModal') closePicker();
      else if (m.id === 'photoModal') closePhoto();
      else m.hidden = true;
    });
  });

  // ============================================================
  // 起動
  // ============================================================
  function init() {
    if (!PLAYERS.length) {
      toast('選手データを読み込めませんでした (data/npb-players.js)');
    }
    loadStorage();
    // URLにスタメンが載っていれば取り込む（取り込んだらハッシュは消す）
    let fromLink = false;
    if (location.hash && decodeState(location.hash)) {
      fromLink = true;
      saveLineup();
      history.replaceState(null, '', location.pathname + location.search);
    }
    fillTeamSelects();
    const fs = $('#fieldStyle');
    fs.innerHTML = FIELD_STYLES.map(f => '<option value="' + f.id + '">' + f.label + '</option>').join('');
    fs.value = state.fieldStyle;
    syncNotationUi();
    updateDhSeg();
    renderFieldArt();
    renderAll();

    // 初回訪問なら応援球団を聞く。共有リンク経由・既にスタメンがある人には出さない
    let welcomed = null;
    try { welcomed = localStorage.getItem(STORE_WELCOME); } catch (e) {}
    const hasLineup = Object.keys(state.assign).length > 0;
    if (!welcomed) {
      if (fromLink || hasLineup) {
        try { localStorage.setItem(STORE_WELCOME, '1'); } catch (e) {}
      } else {
        showWelcome();
      }
    }
  }

  init();
})();
