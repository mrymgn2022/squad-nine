/* 球場イラストのSVG生成
 *   window.FIELD.build(styleId) → <svg> の中身（文字列）
 *   viewBox は 0 0 1000 1010 固定。app.js の POSITIONS はこの座標系に対応する。
 *
 * デザインはセ・リーグ6球団の本拠地。写しているのは
 * 「内野の形（芝/土）」「土の色」「フェンス前の土の有無」「フェンスの色」のみ。
 */
window.FIELD = (function () {
  'use strict';

  const VB_W = 1000, VB_H = 1010;
  const HX = 500, HY = 800;          // 本塁
  const S = Math.SQRT1_2;
  const RF = 660;                    // 外野フェンスまでの距離
  const FOUL = 44;                   // ファウル地域の幅
  const BACK = 108;                  // バックネットまでの距離
  const BASE = 215;                  // 塁間

  const MX = HX, MY = HY - 187;      // 投手板
  const DIRT_R = 198;                // 内野の土（投手板中心）
  const HOME_R = 108;                // 本塁まわりの土（既定）

  const B1 = [HX + BASE * S, HY - BASE * S];
  const B2 = [HX, HY - 2 * BASE * S];
  const B3 = [HX - BASE * S, HY - BASE * S];

  // 内野芝のダイヤモンド（塁線から内側にオフセットした四角形）
  const IC = [HX, HY - BASE * S];
  const INFIELD_GRASS = [[HX, HY], B1, B2, B3]
    .map(p => [IC[0] + (p[0] - IC[0]) * 0.78, IC[1] + (p[1] - IC[1]) * 0.78]);

  const n = v => Math.round(v * 10) / 10;

  /** 競技場（フェア＋ファウル地域）の外周 */
  function outline(rf, foul, back) {
    const plx = HX - rf * S, ply = HY - rf * S;
    const prx = HX + rf * S;
    const clx = plx - foul * S, cly = ply + foul * S;
    const crx = prx + foul * S;
    const t = Math.sqrt(Math.max(1, back * back - foul * foul));
    const hlx = HX - t * S - foul * S, hly = HY - t * S + foul * S;
    const hrx = HX + t * S + foul * S;
    return 'M ' + n(clx) + ' ' + n(cly) +
           ' L ' + n(plx) + ' ' + n(ply) +
           ' A ' + n(rf) + ' ' + n(rf) + ' 0 0 1 ' + n(prx) + ' ' + n(ply) +
           ' L ' + n(crx) + ' ' + n(cly) +
           ' L ' + n(hrx) + ' ' + n(hly) +
           ' A ' + n(back) + ' ' + n(back) + ' 0 1 1 ' + n(hlx) + ' ' + n(hly) + ' Z';
  }

  /** フェアグラウンド（本塁を頂点とする90度の扇形） */
  function wedge(rf) {
    return 'M ' + HX + ' ' + HY +
           ' L ' + n(HX - rf * S) + ' ' + n(HY - rf * S) +
           ' A ' + n(rf) + ' ' + n(rf) + ' 0 0 1 ' + n(HX + rf * S) + ' ' + n(HY - rf * S) + ' Z';
  }

  /** 外野フェンスの弧だけ */
  function fenceArc(rf) {
    return 'M ' + n(HX - rf * S) + ' ' + n(HY - rf * S) +
           ' A ' + n(rf) + ' ' + n(rf) + ' 0 0 1 ' + n(HX + rf * S) + ' ' + n(HY - rf * S);
  }

  function baseMark(p) {
    return '<rect x="' + n(p[0] - 11) + '" y="' + n(p[1] - 11) + '" width="22" height="22" ' +
           'transform="rotate(45 ' + n(p[0]) + ' ' + n(p[1]) + ')" fill="#f6f2e8"/>';
  }

  function poly(pts) {
    return 'M ' + pts.map(p => n(p[0]) + ' ' + n(p[1])).join(' L ') + ' Z';
  }

  // ------------------------------------------------------------------
  // 外野の形
  //   style.outfield があれば [本塁から見た角度(度), 距離] の並びで多角形にする。
  //   角度は中堅方向を0とし、左翼が負・右翼が正。両端は必ず ±45（ファウルライン）。
  //   指定が無い球場は従来どおり半径 RF の円弧。
  // ------------------------------------------------------------------
  function outfieldPoints(s) {
    if (!s || !s.outfield) return null;
    return s.outfield.map(a => {
      const t = a[0] * Math.PI / 180;
      return [HX + a[1] * Math.sin(t), HY - a[1] * Math.cos(t)];
    });
  }

  /** フェアグラウンド */
  function wedgePath(pts) {
    if (!pts) return wedge(RF);
    return 'M ' + HX + ' ' + HY + ' L ' +
           pts.map(p => n(p[0]) + ' ' + n(p[1])).join(' L ') + ' Z';
  }

  /** 競技場（フェア＋ファウル地域）の外周 */
  function outlinePath(pts, foul, back) {
    if (!pts) return outline(RF, foul, back);
    const t = Math.sqrt(Math.max(1, back * back - foul * foul));
    const hlx = HX - t * S - foul * S, hly = HY - t * S + foul * S;
    const hrx = HX + t * S + foul * S;
    const a = pts[0], z = pts[pts.length - 1];
    return 'M ' + n(a[0] - foul * S) + ' ' + n(a[1] + foul * S) +
           ' L ' + pts.map(p => n(p[0]) + ' ' + n(p[1])).join(' L ') +
           ' L ' + n(z[0] + foul * S) + ' ' + n(z[1] + foul * S) +
           ' L ' + n(hrx) + ' ' + n(hly) +
           ' A ' + n(back) + ' ' + n(back) + ' 0 1 1 ' + n(hlx) + ' ' + n(hly) + ' Z';
  }

  /** 外野フェンスのライン */
  function fencePath(pts) {
    if (!pts) return fenceArc(RF);
    return 'M ' + pts.map(p => n(p[0]) + ' ' + n(p[1])).join(' L ');
  }

  // ------------------------------------------------------------------
  // 球場デザイン
  //   infield:
  //     'alldirt' … 内野全面土（甲子園）
  //     'cutout'  … 全面芝。塁・マウンド・本塁だけ土（東京ドーム/バンテリン）
  //     'diamond' … 土の内野＋真ん中だけ芝。走路は土（神宮/マツダ/横浜）
  //   flatDirt   … true なら土をグラデーション無しの単色で塗る
  //   darkBases  … 塁の周りの土を濃くする（神宮/横浜など）
  //   moundDirt  … マウンドだけ土の色を変える場合に指定（みずほPayPay）
  //   track      … 外野フェンス前の土。null なら芝のまま
  // ------------------------------------------------------------------
  const STYLES = {
    koshien: {
      label: '甲子園',
      infield: 'alldirt',
      flatDirt: true,
      dirt: ['#6e5843', '#6e5843'],       // 黒土（単色）
      grass: ['#3f8b4f', '#2b6a39'],
      track: null,                        // 外野は全面芝
      warnLine: true,                     // 代わりにフェンス沿いの白線
      fence: '#1e5033',
      out: '#101a14'
    },
    tokyodome: {
      label: '東京ドーム',
      infield: 'cutout',
      dirt: ['#bd8355', '#a26a41'],
      grass: ['#55a45f', '#489053'],
      track: '#a9724a',
      fence: '#1a4a30',
      out: '#0d1519'
    },
    vantelin: {
      label: 'バンテリン',
      infield: 'cutout',
      dirt: ['#c67d4c', '#a8643a'],
      grass: ['#409657', '#2f7a44'],
      track: '#b06a41',
      fence: '#1d4e78',                   // 青
      out: '#0b1218'
    },
    jingu: {
      label: '神宮',
      infield: 'diamond',
      darkBases: '#8a4a28',
      dirt: ['#b56d43', '#9c5731'],       // 赤茶
      grass: ['#43904f', '#2f7038'],
      track: '#a9603c',
      fence: '#1d4e78',                   // 青
      out: '#101a14'
    },
    mazda: {
      label: 'マツダ',
      infield: 'diamond',
      dirt: ['#b46e44', '#96552f'],
      grass: ['#43904f', '#2d6d37'],
      track: '#b06a41',
      fence: '#163f2b',
      out: '#0f1913'
    },
    yokohama: {
      label: '横浜',
      infield: 'diamond',
      darkBases: '#8a4a28',
      dirt: ['#bd6f45', '#9d5330'],
      grass: ['#3d9a55', '#2d7f43'],
      track: '#b96a42',
      fence: '#14304f',                   // 濃紺
      out: '#0b111a'
    },

    // ---- パ・リーグ ----
    mizuhopaypay: {
      label: 'みずほPayPay',
      infield: 'cutout',                  // 全面人工芝＋塁とマウンドだけ土
      dirt: ['#b56d43', '#9c5731'],       // 塁まわり: 神宮と同じ赤茶
      moundDirt: ['#6e5843', '#6e5843'],  // マウンドだけ甲子園の黒土
      grass: ['#409657', '#2f7a44'],      // 人工芝
      track: '#a9603c',
      fence: '#16452a',                   // 濃い緑
      out: '#0b1218'
    },
    kyocera: {
      label: '京セラ',
      infield: 'cutout',
      dirt: ['#b56d43', '#9c5731'],       // 土はすべて神宮と同じ
      grass: ['#409657', '#2f7a44'],      // 人工芝
      track: '#a9603c',
      fence: '#1d4e78',                   // 青
      out: '#0b1218'
    },
    zozo: {
      label: 'ZOZO',
      infield: 'diamond',                 // 内野は神宮と同一
      darkBases: '#8a4a28',
      dirt: ['#b56d43', '#9c5731'],
      grass: ['#409657', '#2f7a44'],      // 人工芝
      track: '#a9603c',
      fence: '#1d4e78',                   // 青
      out: '#0b1218'
    },
    belluna: {
      label: 'ベルーナ',
      infield: 'diamond',                 // 内野は神宮と同一
      darkBases: '#8a4a28',
      dirt: ['#b56d43', '#9c5731'],
      grass: ['#409657', '#2f7a44'],      // 人工芝
      track: '#a9603c',
      fence: '#1f6b3a',                   // 緑
      out: '#0b1218'
    },
    rakuten: {
      label: '楽天モバイル',
      infield: 'diamond',
      flatDirt: true,
      dirt: ['#6e5843', '#6e5843'],       // 内野の土は甲子園の黒土。塁まわりも走路も同色
      grass: ['#43904f', '#2f7038'],      // 天然芝
      track: '#a9603c',                   // フェンス前だけ神宮の赤茶
      fence: '#1f6b3a',                   // 緑
      out: '#101a14'
    },
    escon: {
      label: 'エスコンF',
      infield: 'diamond',                 // 塁まわり・走路・マウンドすべて同色
      dirt: ['#b56d43', '#9c5731'],
      grass: ['#43904f', '#2f7038'],      // 天然芝
      track: '#a9603c',
      fence: '#0e2a19',                   // ほぼ黒に近い濃い緑
      out: '#0a130d',
      // 直線をつないだ多角形の外野。右中間に段差がある
      outfield: [
        [-45, 596],   // 左翼線
        [-37, 634],   // 左翼の角
        [-20, 654],
        [-6,  660],   // 最深部（やや左中間寄り）
        [8,   652],
        [21,  628],
        [31,  620],   // 右中間の張り出し
        [36,  576],   // 段差でひとつ内側へ
        [45,  584]    // 右翼線
      ]
    }
  };

  function build(styleId) {
    const s = STYLES[styleId] || STYLES.koshien;
    const p = [];

    // 外野の形（多角形指定があればそれ、無ければ円弧）
    const pts = outfieldPoints(s);
    const ground = outlinePath(pts, FOUL, BACK);
    const fair = wedgePath(pts);
    const fence = fencePath(pts);

    // 内野タイプごとの寸法
    const isCutout = s.infield === 'cutout';
    const isDiamond = s.infield === 'diamond';
    const moundR = isCutout ? 48 : 50;
    const cutR = 46;                              // カットアウトの塁の土
    // 本塁の土: カットアウトは小さく後ろ寄り、ダイヤモンド型はやや小さめ
    const homeR = isCutout ? 78 : (isDiamond ? 94 : HOME_R);
    const homeCY = isCutout ? HY + 20 : HY;

    // --- defs ---
    p.push('<defs>');
    p.push('<linearGradient id="fGrass" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="' + s.grass[0] + '"/>' +
           '<stop offset="100%" stop-color="' + s.grass[1] + '"/></linearGradient>');
    if (s.flatDirt) {
      p.push('<linearGradient id="fDirt" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + s.dirt[0] + '"/>' +
             '<stop offset="100%" stop-color="' + s.dirt[0] + '"/></linearGradient>');
    } else {
      p.push('<linearGradient id="fDirt" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + s.dirt[0] + '"/>' +
             '<stop offset="100%" stop-color="' + s.dirt[1] + '"/></linearGradient>');
    }
    if (s.moundDirt) {
      p.push('<linearGradient id="fMound" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + s.moundDirt[0] + '"/>' +
             '<stop offset="100%" stop-color="' + s.moundDirt[1] + '"/></linearGradient>');
    }
    if (s.darkBases) {
      // 塁の周りの濃い土。境界は少しだけぼかすがほぼくっきり
      p.push('<radialGradient id="fBaseDark">' +
             '<stop offset="0%" stop-color="' + s.darkBases + '" stop-opacity="0.92"/>' +
             '<stop offset="84%" stop-color="' + s.darkBases + '" stop-opacity="0.88"/>' +
             '<stop offset="100%" stop-color="' + s.darkBases + '" stop-opacity="0"/></radialGradient>');
    }
    p.push('<pattern id="fMow" width="72" height="72" patternUnits="userSpaceOnUse">' +
           '<rect width="36" height="72" fill="#ffffff" opacity="0.04"/></pattern>');
    p.push('<clipPath id="fFair"><path d="' + fair + '"/></clipPath>');
    p.push('<clipPath id="fGround"><path d="' + ground + '"/></clipPath>');
    p.push('</defs>');

    // --- 背景 / ファウル地域 / フェアグラウンド ---
    p.push('<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H + '" fill="' + s.out + '"/>');
    p.push('<path d="' + ground + '" fill="' + s.grass[1] + '"/>');
    p.push('<path d="' + fair + '" fill="url(#fGrass)"/>');
    p.push('<path d="' + fair + '" fill="url(#fMow)"/>');

    // --- 外野フェンス前の土 ---
    // フェンスのラインを太くなぞり、フェア地域で切り抜いて内側だけ残す
    if (s.track) {
      p.push('<g clip-path="url(#fFair)"><path d="' + fence + '" fill="none" stroke="' +
             s.track + '" stroke-width="68" stroke-linejoin="round" stroke-linecap="round"/></g>');
    }
    // 土の代わりのフェンス沿いの白線（他球場の土の外側にあたる位置）
    if (s.warnLine) {
      p.push('<g clip-path="url(#fFair)">' +
             '<circle cx="' + HX + '" cy="' + HY + '" r="' + (RF - 36) + '" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.8"/></g>');
    }

    // --- 内野 ---
    p.push('<g clip-path="url(#fGround)">');
    if (s.infield === 'alldirt' || isDiamond) {
      p.push('<circle cx="' + MX + '" cy="' + n(MY) + '" r="' + DIRT_R + '" fill="url(#fDirt)"/>');
    }
    if (isDiamond) {
      // 真ん中だけ芝。塁線沿いの走路は土のまま
      p.push('<path d="' + poly(INFIELD_GRASS) + '" fill="url(#fGrass)"/>');
      p.push('<path d="' + poly(INFIELD_GRASS) + '" fill="url(#fMow)"/>');
    }
    if (isCutout) {
      [B1, B2, B3].forEach(b => {
        p.push('<circle cx="' + n(b[0]) + '" cy="' + n(b[1]) + '" r="' + cutR + '" fill="url(#fDirt)"/>');
      });
    }
    p.push('<circle cx="' + HX + '" cy="' + n(homeCY) + '" r="' + homeR + '" fill="url(#fDirt)"/>');
    if (s.darkBases) {
      [B1, B2, B3].forEach(b => {
        p.push('<circle cx="' + n(b[0]) + '" cy="' + n(b[1]) + '" r="72" fill="url(#fBaseDark)"/>');
      });
    }
    p.push('</g>');

    // --- マウンド ---
    // プレートはマウンド後方1/4の位置。土の円を前（本塁側）にずらして表現する
    const moundCY = MY + moundR / 2;
    const moundFill = s.moundDirt ? 'url(#fMound)' : 'url(#fDirt)';
    p.push('<circle cx="' + MX + '" cy="' + n(moundCY) + '" r="' + moundR + '" fill="' + moundFill + '"/>');
    p.push('<circle cx="' + MX + '" cy="' + n(moundCY) + '" r="' + moundR + '" fill="none" stroke="#000000" stroke-width="2" opacity="0.12"/>');
    p.push('<rect x="' + (MX - 10) + '" y="' + n(MY - 4) + '" width="20" height="8" rx="2" fill="#f4efe4"/>');

    // --- ファウルライン・塁・本塁 ---
    // ラインは本塁からポール（外野の形の両端）まで
    const fl = pts ? pts[0] : [HX - RF * S, HY - RF * S];
    const fr = pts ? pts[pts.length - 1] : [HX + RF * S, HY - RF * S];
    p.push('<path d="M ' + HX + ' ' + HY + ' L ' + n(fl[0]) + ' ' + n(fl[1]) + '" stroke="#ffffff" stroke-width="5" opacity="0.9"/>');
    p.push('<path d="M ' + HX + ' ' + HY + ' L ' + n(fr[0]) + ' ' + n(fr[1]) + '" stroke="#ffffff" stroke-width="5" opacity="0.9"/>');
    p.push(baseMark(B1)); p.push(baseMark(B2)); p.push(baseMark(B3));
    p.push('<rect x="' + (HX - 42) + '" y="' + (HY - 26) + '" width="26" height="52" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.65"/>');
    p.push('<rect x="' + (HX + 16) + '" y="' + (HY - 26) + '" width="26" height="52" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.65"/>');
    p.push('<path d="M ' + (HX - 11) + ' ' + (HY - 11) + ' L ' + (HX + 11) + ' ' + (HY - 11) +
           ' L ' + (HX + 11) + ' ' + HY + ' L ' + HX + ' ' + (HY + 12) + ' L ' + (HX - 11) + ' ' + HY + ' Z" fill="#f6f2e8"/>');

    // --- フェンス ---
    p.push('<path d="' + ground + '" fill="none" stroke="' + s.fence + '" stroke-width="8"/>');
    p.push('<path d="' + fence + '" fill="none" stroke="' + s.fence +
           '" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>');

    return p.join('');
  }

  return {
    build: build,
    styles: Object.keys(STYLES).map(k => ({ id: k, label: STYLES[k].label })),
    viewBox: '0 0 ' + VB_W + ' ' + VB_H
  };
})();
