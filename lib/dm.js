// ============================================================
// 瑞禾業務系統：一鍵產生 DM（115/10/15）
// 物件簡表按「產生 DM」→ 向物件後端拿 dmGetData（銷售DM資料表的欄位、前 4 張照片、業務電話、公司資料）
// → 畫成 1080×1350 直式圖片（傳 LINE 用）可下載；或開 A4 版面另存 PDF（瀏覽器的列印 → 另存為 PDF）。
// 地址只寫到路名（沒有詳細地址就寫地段），不放契約編號、委託人資料。
// 住商物件：讀總彙整表「住商物件總表」那一列（不給客人看的欄位後端不帶），沒有照片。
// 聯絡業務＝產生 DM 的人（後端 requester，含業務名單的電話）。
// 要用 lib/match.js 的跳出視窗（RuiheMatch.showModal）。
// ============================================================
(function() {
  var OBJ_API = 'https://script.google.com/macros/s/AKfycbx8cp8ArkFb4RXXom9UCR2cAqc8MdU6AZlBznwkSx34tQoYR2xEH0I1oJzouip-fyJJQw/exec';
  // 依法每份 DM 都要放公司經紀人資訊（後端沒回傳時用這個）
  var BROKER = '經紀人 張維純　(114)中市經紀字第02353號';
  var LOGO = 'lib/img/logo-full.png', PHONE = '04-2380-3560', LOGO_DATA = ''; // LOGO_DATA：A4 列印視窗用的內嵌 Logo（另開的視窗讀不到網站上的圖檔）
  var BRAND = '#1E4A32', BG = '#F4F3EE', INK = '#1F2A24', MUTED = '#5D6B62', FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(fn, args) {
    return fetch(OBJ_API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }) }).then(function(r) { return r.json(); }).then(function(res) {
      if (!res.ok) throw new Error(res.message || '系統發生錯誤');
      return res.result;
    });
  }
  function roadOnly(detail) {
    // DM 不放詳細地址：只留到路名（全形數字「１６７巷」先轉成半形再切）
    var d = String(detail || '').split(/[；;、\n]/)[0].replace(/\s/g, '')
      .replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[－‐]/g, '-');
    var m = d.match(/^(.*?)(?=\d|[一二三四五六七八九十百]+(?:之\d+)?[號巷弄樓])/);
    return (m ? m[1] : d).replace(/[-之]$/, '');
  }
  function num(v) { var m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function wanOf(v) { // 「6,800萬」「1.2億」→ 萬
    var t = String(v || '').replace(/,/g, ''), m = t.match(/(\d+(?:\.\d+)?)\s*(億|萬|元)?/); if (!m) return null;
    var n = parseFloat(m[1]); return m[2] === '億' ? n * 10000 : m[2] === '元' ? n / 10000 : n;
  }
  function fmt2(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function unitRows(price, unit, types, rs, land, bld) {
    var rent = rs === '租' || /月/.test(String(price) + String(unit));
    var total = wanOf(price);
    if (/廠房/.test(types || '') && !rent && total) {
      var out = [];
      if (land > 0) out.push(['土地均價', fmt2(total / land) + ' 萬/坪']);
      if (bld > 0) out.push(['建物均價', fmt2(total / bld) + ' 萬/坪']);
      if (out.length) return out;
    }
    return unit ? [['單價', unit]] : [];
  }
  // 把後端的 DM 欄位和物件簡表那一列整理成 DM 要的內容
  function compose(listing, dm) {
    var f = dm.fields || {};
    var g = function(k, alt) { var v = String(f[k] || '').trim(); return v || (alt || ''); };
    var place = g('案件坐落', listing.placeText);
    var road = roadOnly(g('詳細地址'));
    // 詳細地址已經從縣市寫起（例如「台中市太平區永豐路…」）就不要再加一次坐落
    var placeTxt = road ? (/^.{2}[縣市]/.test(road) ? road : place + road) : (place + (listing.section ? '（' + listing.section + '）' : ''));
    var floors = [g('地上樓層') ? '地上 ' + g('地上樓層') + ' 層' : '', g('地下樓層') ? '地下 ' + g('地下樓層') + ' 層' : ''].filter(Boolean).join('、');
    // 單價（115/10/22）：一律標「單價」；廠房出售改成「土地均價」＝總價÷土地坪數、「建物均價」＝總價÷建物坪數
    var units = unitRows(g('總價', listing.priceText), g('單價', listing.unitText), g('類型', listing.typesText), listing.rs,
      num(g('土地面積(坪)', listing.land != null ? String(listing.land) : '')),
      num(g('主建物面積(坪)', listing.bld != null ? String(listing.bld) : ''))); // 跟 DM 上「建物面積」用同一個坪數
    var specs = [
      ['位置', placeTxt || ''],
      ['土地面積', g('土地面積(坪)', listing.land != null ? String(listing.land) : '') ? g('土地面積(坪)', String(listing.land)) + ' 坪' : ''],
      ['建物面積', g('主建物面積(坪)', listing.bld != null ? String(listing.bld) : '') ? g('主建物面積(坪)', String(listing.bld)) + ' 坪' : ''],
      ['使用分區', g('使用分區')], ['面臨路寬', g('面臨路寬')],
      ['基地面寬／深度', [g('基地面寬'), g('基地深度')].filter(Boolean).join('／')],
      ['樓層', floors], ['簷高', g('簷高(滴水高度)')], ['主要建材', g('主要建材')], ['朝向', g('建物朝向')], ['格局', g('物件格局')]
    ].filter(function(x) { return x[1]; }).concat((dm.extra || []).filter(function(x) { return x && x[1]; }));
    return {
      name: g('案名', listing.name) || '物件介紹',
      tags: [String(g('類型', listing.typesText)).split('、').map(function(t) { return t.replace(/^[A-Za-z]\./, ''); }).join('、'), listing.rs ? (listing.rs === '租' ? '出租' : listing.rs === '售' ? '出售' : listing.rs) : '', g('建物類別')].filter(Boolean).join('・'), // 類型前面的「I.」這種代碼拿掉
      price: g('總價', listing.priceText), unit: units.map(function(u) { return u[0] + ' ' + u[1]; }).join('｜'), units: units,
      specs: specs.slice(0, 10), allSpecs: specs, feature: g('特色說明'), photos: dm.photos || [],
      coord: listing.coord || null, doc: dm.doc || {}, fields: f, place: placeTxt, section: listing.section || '', landKind: g('土地類型'),
      agents: dm.requester && dm.requester.name ? [dm.requester] : (dm.agents && dm.agents.length ? dm.agents : String(listing.agents || '').split(/[、,，]/).filter(Boolean).map(function(n) { return { name: n, phone: '' }; })),
      company: { name: (dm.company && dm.company.name) || '瑞禾不動產經紀股份有限公司', phone: (dm.company && dm.company.phone) || PHONE, broker: (dm.company && dm.company.broker) || BROKER, addr: (dm.company && dm.company.addr) || '' },
      docPhotos: dm.docPhotos || 4
    };
  }
  function loadImg(src) {
    return new Promise(function(res) { var im = new Image(); im.onload = function() { res(im); }; im.onerror = function() { res(null); }; im.src = src; });
  }
  function wrap(ctx, text, maxW) {
    var lines = [], line = '';
    String(text || '').split('').forEach(function(ch) {
      if (ch === '\n') { lines.push(line); line = ''; return; }
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
    });
    if (line) lines.push(line);
    return lines;
  }
  // 照片裁切成填滿格子（從中間裁，不留白邊）
  function cover(ctx, im, x, y, w, h) {
    var r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r;
    ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h);
  }
  // 畫 DM 圖片（寬 1080；高度至少 1350，內容多就加高，特色說明、規格都完整顯示），回傳 canvas

  // ============================================================
  // 位置圖（115/10/21）：用物件座標拼出一張小地圖（國土測繪中心電子地圖，讀不到改 OpenStreetMap），紅點標位置
  // 讀不到地圖就不放，DM 照常產生
  // ============================================================
  var MAP_SOURCES = [
    { url: function(z, x, y) { return 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/' + z + '/' + y + '/' + x; }, credit: '© 內政部國土測繪中心' },
    { url: function(z, x, y) { return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png'; }, credit: '© OpenStreetMap' }
  ];
  var MAP_CACHE = {};
  function loadTile(src) {
    return new Promise(function(res, rej) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function() { res(im); }; im.onerror = rej; im.src = src; setTimeout(rej, 8000); });
  }
  function mapImage(coord, w, h, zoom) {
    if (!coord || !isFinite(coord[0]) || !isFinite(coord[1])) return Promise.resolve(null);
    w = w || 640; h = h || 400; zoom = zoom || 16;
    var ck = coord.join(',') + '|' + w + 'x' + h + '|' + zoom;
    if (MAP_CACHE[ck]) return Promise.resolve(MAP_CACHE[ck]);
    var n = Math.pow(2, zoom), lat = coord[0] * Math.PI / 180;
    var px = (coord[1] + 180) / 360 * n * 256, py = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n * 256;
    var x0 = px - w / 2, y0 = py - h / 2;
    var tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256), tx1 = Math.floor((x0 + w) / 256), ty1 = Math.floor((y0 + h) / 256);
    var tryFrom = function(si) {
      if (si >= MAP_SOURCES.length) return Promise.resolve(null);
      var src = MAP_SOURCES[si], jobs = [];
      for (var tx = tx0; tx <= tx1; tx++) for (var ty = ty0; ty <= ty1; ty++) (function(tx, ty) {
        jobs.push(loadTile(src.url(zoom, tx, ty)).then(function(im) { return { im: im, tx: tx, ty: ty }; }));
      })(tx, ty);
      return Promise.all(jobs).then(function(tiles) {
        var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d');
        tiles.forEach(function(t) { g.drawImage(t.im, Math.round(t.tx * 256 - x0), Math.round(t.ty * 256 - y0)); });
        // 紅點
        g.beginPath(); g.arc(w / 2, h / 2, 13, 0, Math.PI * 2); g.fillStyle = 'rgba(179,38,30,.25)'; g.fill();
        g.beginPath(); g.arc(w / 2, h / 2, 8, 0, Math.PI * 2); g.fillStyle = '#B3261E'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
        g.font = '12px sans-serif'; var cw = g.measureText(src.credit).width + 10;
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(w - cw, h - 18, cw, 18); g.fillStyle = '#333'; g.fillText(src.credit, w - cw + 5, h - 5);
        var url = c.toDataURL('image/png'); // 圖磚不允許跨網站讀取時這裡會失敗 → 換下一個來源
        MAP_CACHE[ck] = url; return url;
      }).catch(function() { return tryFrom(si + 1); });
    };
    return tryFrom(0);
  }
  function draw(d) {
    // 115/10/21：DM 圖片只放 1 張照片＋右邊的位置圖（地圖不蓋在照片上）；A4 也用這張直的位置圖（裁切時紅點保持在中間）
    return Promise.all(d.photos.slice(0, 1).map(loadImg).concat([loadImg(LOGO), mapImage(d.coord, 600, 760).then(function(u) { d.mapUrl = u; return u ? loadImg(u) : null; }).catch(function() { return null; })])).then(function(all) {
      var mapIm = all.pop();
      var logo = all.pop();
      if (logo) { try { var lc = document.createElement('canvas'); lc.width = logo.width; lc.height = logo.height; lc.getContext('2d').drawImage(logo, 0, 0); LOGO_DATA = lc.toDataURL('image/png'); } catch (e) {} }
      var imgs = all.filter(Boolean);
      // 115/10/21：改成接近 A4 的直式比例（1080×1527），行距放寬一點
      var W = 1080, FOOT = 150, LH = 46, SL = 40, A4H = 1527;
      // ---- 先量好每一塊要多高 ----
      var m = document.createElement('canvas').getContext('2d');
      m.font = 'bold 56px ' + FONT;
      var titleLines = wrap(m, d.name, W - 96).slice(0, 2);
      var y0 = 200 + (titleLines.length - 1) * 66 + 52 + 64 + (d.price ? 30 : 0); // 照片區上緣前一點
      var specRows = [];
      for (var si = 0; si < d.specs.length; si += 2) {
        var row = [], h = 54;
        [0, 1].forEach(function(o) {
          var sp = d.specs[si + o]; if (!sp) return;
          m.font = '28px ' + FONT; var lw = m.measureText(sp[0]).width + 16;
          m.font = 'bold 28px ' + FONT; var vl = wrap(m, sp[1], W / 2 - 60 - lw);
          row.push({ sp: sp, o: o, lw: lw, vl: vl });
          h = Math.max(h, 54 + (vl.length - 1) * SL);
        });
        specRows.push({ items: row, h: h });
      }
      var specH = specRows.reduce(function(a, r) { return a + r.h; }, 0) + 6;
      m.font = '28px ' + FONT;
      var featLines = d.feature ? wrap(m, d.feature, W - 96) : [];
      var featH = featLines.length ? 56 + featLines.length * LH + 24 : 0;
      var py = y0 + 10;
      // 照片區 470；放不下先縮到 360；還是放不下就把圖片加高
      var fixed = py + 56 + specH + featH + FOOT + 20;
      var ph = Math.min(620, A4H - fixed); // 照片區最高 620；放不下先縮到 380；還是放不下就把圖片加高
      var H = A4H;
      if (ph < 380) { ph = 380; H = fixed + ph; }
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = BG; x.fillRect(0, 0, W, H);
      // 頁首：白底＋公司 Logo（讀不到 Logo 就寫公司名稱），下面一條綠線
      x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, 120);
      x.fillStyle = BRAND; x.fillRect(0, 116, W, 4);
      x.textBaseline = 'middle';
      if (logo) { var lh = 74, lw = logo.width * lh / logo.height; if (lw > W - 280) { lw = W - 280; lh = logo.height * lw / logo.width; } x.drawImage(logo, 48, 58 - lh / 2, lw, lh); }
      else { x.fillStyle = BRAND; var hs = 44; do { x.font = 'bold ' + hs + 'px ' + FONT; } while (x.measureText(d.company.name).width > W - 300 && --hs > 26); x.fillText(d.company.name, 48, 60); }
      x.fillStyle = BRAND; x.font = 'bold 28px ' + FONT; x.textAlign = 'right'; x.fillText('物件介紹', W - 48, 60); x.textAlign = 'left';
      // 案名、標籤、價格
      x.fillStyle = INK; x.font = 'bold 56px ' + FONT; x.textBaseline = 'alphabetic';
      titleLines.forEach(function(t, i) { x.fillText(t, 48, 200 + i * 66); });
      var y = 200 + (titleLines.length - 1) * 66 + 52;
      x.fillStyle = MUTED; x.font = '30px ' + FONT; x.fillText(d.tags, 48, y);
      y += 64;
      if (d.price) {
        x.fillStyle = '#B3261E'; x.font = 'bold 54px ' + FONT; x.fillText(d.price, 48, y);
        if (d.unit) { // 單價（廠房是土地均價、建物均價），太長就縮小字
          var pw = x.measureText(d.price).width, ut = '（' + d.unit + '）', us = 28; x.fillStyle = MUTED;
          do { x.font = us + 'px ' + FONT; } while (x.measureText(ut).width > W - 96 - pw - 14 && --us > 16);
          x.fillText(ut, 48 + pw + 14, y);
        }
      }
      // 照片（裁切填滿）
      var pw2 = W - 96;
      // 左邊照片（有位置圖時佔 62%），右邊位置圖，一樣高、中間留 14px
      var phW = mapIm ? Math.round(pw2 * 0.62) : pw2, mapX = 48 + phW + 14, mapW = pw2 - phW - 14;
      if (!imgs.length) {
        x.fillStyle = '#E4E2D8'; x.fillRect(48, py, phW, ph);
        x.fillStyle = MUTED; x.font = '30px ' + FONT; x.textAlign = 'center'; x.fillText('（尚無照片）', 48 + phW / 2, py + ph / 2); x.textAlign = 'left';
      } else cover(x, imgs[0], 48, py, phW, ph);
      if (mapIm) {
        cover(x, mapIm, mapX, py, mapW, ph);
        x.strokeStyle = '#D8DDD5'; x.lineWidth = 2; x.strokeRect(mapX + 1, py + 1, mapW - 2, ph - 2);
        x.fillStyle = 'rgba(30,74,50,.88)'; x.fillRect(mapX, py, 92, 38); x.fillStyle = '#fff'; x.font = 'bold 22px ' + FONT; x.fillText('位置圖', mapX + 12, py + 27);
      }
      y = py + ph + 56;
      // 規格（兩欄，內容長的自動換行）
      specRows.forEach(function(r) {
        r.items.forEach(function(it) {
          var cx = it.o === 0 ? 48 : W / 2 + 12;
          x.font = '28px ' + FONT; x.fillStyle = MUTED; x.fillText(it.sp[0], cx, y);
          x.font = 'bold 28px ' + FONT; x.fillStyle = INK;
          it.vl.forEach(function(t, k2) { x.fillText(t, cx + it.lw, y + k2 * SL); });
        });
        y += r.h;
      });
      y += 6;
      // 物件特色（全部）
      if (featLines.length) {
        x.fillStyle = BRAND; x.font = 'bold 30px ' + FONT; x.fillText('物件特色', 48, y + 10); y += 56;
        x.fillStyle = INK; x.font = '28px ' + FONT;
        featLines.forEach(function(t, i) { x.fillText(t, 48, y + i * LH); });
      }
      // 頁尾：聯絡業務（公司電話）＋最下面一行經紀人資訊（依法要放）
      x.fillStyle = BRAND; x.fillRect(0, H - FOOT, W, FOOT);
      x.fillStyle = '#fff'; x.font = 'bold 32px ' + FONT; x.textBaseline = 'middle';
      var who = d.agents.map(function(a) { return a.name + (a.phone ? ' ' + a.phone : ''); }).join('　');
      x.fillText('聯絡業務：' + (who || '—'), 48, H - 98);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(48, H - 66, W - 96, 1);
      // 公司全稱＋經紀人：太長就把字縮小到放得下（最小 18px）
      x.fillStyle = '#fff';
      var legal = d.company.name + (d.company.phone ? '　電話 ' + d.company.phone : '') + '　' + d.company.broker, fs = 26;
      do { x.font = fs + 'px ' + FONT; } while (x.measureText(legal).width > W - 96 && --fs > 18);
      x.fillText(legal, 48, H - 36);
      return c;
    });
  }
  // A4 版面（另開視窗、按列印 → 另存為 PDF）
  function printA4(d) {
    var w = window.open('', '_blank');
    if (!w) { alert('瀏覽器擋住了新視窗，請允許這個網站開啟彈出式視窗後再試一次。'); return; }
    // A4：最多 3 張照片＋位置圖，固定 2×2 四格（沒有座標就放 4 張照片）
    var photos = d.photos.slice(0, d.mapUrl ? 3 : 4).map(function(p) { return '<img src="' + p + '">'; }).join('') + (d.mapUrl ? '<img src="' + d.mapUrl + '" alt="位置圖">' : '');
    w.document.write('<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>' + esc(d.name) + '</title><style>' +
      '@page{size:A4;margin:10mm}body{font-family:' + FONT + ';color:' + INK + ';margin:0}#pg{width:190mm}' +
      '.hd{background:#fff;color:' + BRAND + ';padding:4px 2px 6px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:17px;border-bottom:3px solid ' + BRAND + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}.hd img{height:13mm;width:auto}' +
      'h1{font-size:22px;margin:8px 0 0}.tags{color:' + MUTED + ';font-size:13px}.price{color:#B3261E;font-size:21px;font-weight:700;margin:4px 0 6px}' +
      '.ph{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:6px 0}.ph img{width:100%;height:62mm;object-fit:cover;display:block}.ph img:only-child{grid-column:span 2;height:100mm}' +
      'table{width:100%;border-collapse:collapse;font-size:12.5px}td{border-bottom:1px solid #ddd;padding:4px 4px;vertical-align:top}td.k{color:' + MUTED + ';width:20%}' +
      '.feat{white-space:pre-wrap;font-size:12.5px;line-height:1.55;margin-top:2px}.ft{margin-top:8px;padding:8px 14px;background:' + BRAND + ';color:#fff;font-weight:700;font-size:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '</style></head><body><div id="pg"><div class="hd">' + (LOGO_DATA ? '<img src="' + LOGO_DATA + '" alt="' + esc(d.company.name) + '">' : '<span>' + esc(d.company.name) + '</span>') + '<span>物件介紹</span></div>' +
      '<h1>' + esc(d.name) + '</h1><div class="tags">' + esc(d.tags) + '</div>' +
      (d.price ? '<div class="price">' + esc(d.price) + (d.unit ? '<span style="font-size:15px;color:' + MUTED + ';font-weight:400;">（' + esc(d.unit) + '）</span>' : '') + '</div>' : '') +
      (photos ? '<div class="ph">' + photos + '</div>' : '') +
      '<table>' + d.specs.map(function(s) { return '<tr><td class="k">' + esc(s[0]) + '</td><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</table>' +
      (d.feature ? '<h3 style="color:' + BRAND + ';margin:8px 0 2px;font-size:14px;">物件特色</h3><div class="feat">' + esc(d.feature) + '</div>' : '') +
      '<div class="ft">聯絡業務：' + esc(d.agents.map(function(a) { return a.name + (a.phone ? ' ' + a.phone : ''); }).join('　') || '—') + '<div style="font-weight:400;font-size:12.5px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.4);">' + esc(d.company.name + (d.company.phone ? '　電話 ' + d.company.phone : '') + '　' + d.company.broker) + '</div></div>' +
      '</div><script>(function(){var done=false;function go(){if(done)return;done=true;' +
      // 內容超過一頁（A4 扣掉邊界約 277mm）就整頁等比例縮小，保證一頁
      'function fit(){var pg=document.getElementById("pg");pg.style.zoom="";var mm=pg.getBoundingClientRect().width/190,max=272*mm,h=pg.scrollHeight;if(h>max){pg.style.zoom=(max/h).toFixed(3);}}' +
      'fit();setTimeout(function(){fit();window.print();},600);}' +
      // 不管「載入完成」有沒有已經發生都會執行：已完成就馬上做，否則等載入完成，最慢 1.5 秒也做
      'if(document.readyState==="complete")setTimeout(go,50);else window.addEventListener("load",go);setTimeout(go,1500);})();<\/script></body></html>');
    w.document.close();
  }
  // 物件簡表呼叫：auth＝{ name, code }；listing＝RuiheMatch.parseListing 的結果；key＝物件鍵

  // ============================================================
  // Word 檔（可編輯，115/10/20）：A4 表格式物件說明書，跟公司原本的 Word DM 同樣的排法
  // 第 1 頁：案名、售價／單價、各項資料（兩欄）、優勢特色、服務人員／聯絡電話／仲介服務費，下面是位置圖；有照片的話第 2 頁放照片。
  // 在瀏覽器裡直接組 .docx（用 JSZip，需要時才從 cdnjs 載入）。
  // ============================================================
  var JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  function loadJsZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function(res, rej) {
      var sc = document.createElement('script'); sc.src = JSZIP_URL;
      sc.onload = function() { window.JSZip ? res(window.JSZip) : rej(new Error('載入 Word 工具失敗')); };
      sc.onerror = function() { rej(new Error('載入 Word 工具失敗，請檢查網路')); };
      document.head.appendChild(sc);
    });
  }
  function x(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Word 檔字型：中文標楷體、英文和數字 Times New Roman（115/10/20 指定）
  var FONT_W = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="標楷體" w:cs="Times New Roman"/>';
  function run(text, o) {
    o = o || {};
    return '<w:r><w:rPr>' + FONT_W + (o.b ? '<w:b/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + '<w:sz w:val="' + (o.sz || 22) + '"/><w:szCs w:val="' + (o.sz || 22) + '"/></w:rPr><w:t xml:space="preserve">' + x(text) + '</w:t></w:r>';
  }
  function para(runs, o) {
    o = o || {};
    return '<w:p><w:pPr>' + (o.keepNext ? '<w:keepNext/>' : '') + '<w:spacing w:before="' + (o.before || 0) + '" w:after="0" w:line="300" w:lineRule="auto"/>' + (o.center ? '<w:jc w:val="center"/>' : '') + '</w:pPr>' + runs + '</w:p>';
  }
  // 可以改的內容包成「填寫欄位」（內容控制項）：文件用「填寫表單」保護，只有這些欄位能改，不會有整片黃色底（115/10/20）
  var SDT_ID = 100;
  // 115/10/20 改成不限制修改：整份都能改，ed() 不再包內容控制項
  function ed(content) { return content; }
  function cell(w, content, o) {
    o = o || {};
    return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : '') +
      (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>' + content + '</w:tc>';
  }
  function lines(text, o) {
    var arr = String(text || '').split(/\n/);
    return arr.map(function(t) { return para(run(t, o), o); }).join('') || para('');
  }
  var COLS = [1650, 3583, 1650, 3583]; // 合計 10466（A4 扣左右邊界各 0.5 吋）
  function tableXml(rows) {
    var b = '<w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/>';
    return '<w:tbl><w:tblPr><w:tblW w:w="10466" w:type="dxa"/><w:tblBorders>' + b + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + COLS.map(function(w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' + rows.join('') + '</w:tbl>';
  }
  function tr(cells, h) { return '<w:tr>' + (h ? '<w:trPr><w:trHeight w:val="' + h + '"/></w:trPr>' : '') + cells + '</w:tr>'; }
  var LABEL_FILL = 'E6F0E9'; // 欄位名稱的底色（淺綠，跟系統一致）
  var BRAND_HEX = '1E4A32', COMPANY_ADDR = '台中市南屯區益豐路四段91號';
  function imgXml(rid, id, cx, cy) {
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="照片' + id + '"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="照片' + id + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  function makeDocx(d) {
    SDT_ID = 100;
    return Promise.all([loadJsZip(), mapImage(d.coord, 960, 420).catch(function() { return null; })].concat(d.photos.slice(0, Math.min(d.docPhotos || 8, 8)).map(loadImg))).then(function(all) {
      var docMap = all.splice(1, 1)[0];
      var JSZip = all[0], imgs = all.slice(1);
      var rows = [];
      // 案名
      rows.push(tr(cell(10466, ed(para(run(d.name, { b: 1, sz: 36, color: 'FFFFFF' }), { center: 1 })), { span: 4, fill: BRAND_HEX }), 640)); // 案名：深綠底白字
      // 左邊建物、右邊土地（照公司原本的物件說明）；一列一列對齊，哪一邊沒有就留空
      var o = d.doc || {}, F = d.fields || {};
      var v = function() { for (var k = 0; k < arguments.length; k++) { var t = String(o[arguments[k]] || F[arguments[k]] || '').trim(); if (t) return t; } return ''; };
      var ping = function(m2) { var n = parseFloat(String(m2).replace(/,/g, '')); return isFinite(n) && n > 0 ? (Math.round(n * 0.3025 * 100) / 100) + ' 坪（' + n + ' m²）' : ''; };
      var join = function(arr, sep) { return arr.filter(Boolean).join(sep || '\n'); };
      // 115/10/29：建物面積＝主建物＋共有＋附屬（完整建築面積）
      var totalBldM2 = ['主建物面積(m²)', '附屬建物面積(m²)', '共同使用面積(m²)'].reduce(function(t, l) { var x = parseFloat(v(l)); return t + (isFinite(x) ? x : 0); }, 0);
      var totalBldText = totalBldM2 > 0 ? ping(totalBldM2) + '（主建物＋共有＋附屬）' : '';
      var bldArea = totalBldText || join([v('主建物面積(m²)') ? '主建物 ' + ping(v('主建物面積(m²)')) : (F['主建物面積(坪)'] ? F['主建物面積(坪)'] + ' 坪' : ''),
        v('附屬建物面積(m²)') && parseFloat(v('附屬建物面積(m²)')) > 0 ? '附屬建物 ' + ping(v('附屬建物面積(m²)')) : '',
        v('加蓋面積(m²)') && parseFloat(v('加蓋面積(m²)')) > 0 ? '加蓋 ' + ping(v('加蓋面積(m²)')) : '']);
      var floors = join([v('地上樓層') ? '地上 ' + v('地上樓層') + ' 層' : '', v('地下樓層') && v('地下樓層') !== '0' ? '地下 ' + v('地下樓層') + ' 層' : '', v('所在樓別') ? '所在 ' + v('所在樓別') : ''], '、');
      var mgmt = join([v('管理費用'), v('繳費方式')], '／');
      var B = [
        ['售價', d.price], ['位置', d.place], ['建物面積', bldArea], ['建築完成日', v('建築完成日')], ['樓層', floors], ['建物類別', v('建物類別')],
        ['主要建材', join([v('主要建材'), v('外壁材質') ? '外牆：' + v('外壁材質') : ''])], ['建物座向', v('建物朝向')], ['簷高', v('簷高(滴水高度)')],
        ['樓板載重', v('樓地板載重或機具/電梯載重')], ['格局', v('物件格局(廠房)', '物件格局')], ['電梯', v('電梯數')], ['附屬設備', v('附屬設備')],
        ['廠登', v('是否有廠登')], ['車位', v('有無車位')], ['管理費', mgmt && mgmt !== '0' ? mgmt : '']
      ].filter(function(x) { return x[1]; });
      var landArea = v('土地面積(m²)') ? ping(v('土地面積(m²)')) : (F['土地面積(坪)'] ? F['土地面積(坪)'] + ' 坪' : '');
      var L = [
        ['土地面積', landArea], ['地段', d.section], ['使用分區', join([v('都市或非都市計畫'), v('使用分區'), v('國土功能分區')], '／')],
        ['建蔽率／容積率', join([v('建蔽率'), v('容積率')], '／')], ['土地最大寬深', join([v('基地面寬') ? '寬 ' + v('基地面寬') : '', v('基地深度') ? '深 ' + v('基地深度') : ''], '，')],
        ['臨路路寬', v('面臨路寬') ? v('面臨路寬') + (/[米m]/i.test(v('面臨路寬')) ? '' : ' 米') : ''], ['土地座向', v('土地朝向(廠房)', '土地朝向(土地)')],
        ['土地類型', d.landKind || v('土地類型')], ['產業園區', v('產業園區名稱', '產業園區名稱(土地)')], ['用水', v('可供用水量')], ['用電', v('可供用電量')],
        ['汙水處理廠', v('是否有汙水處理廠')]
      ].filter(function(x) { return x[1]; });
      L = (d.units || []).concat(L); // 單價放右欄最上面（廠房：土地均價、建物均價兩列）
      var hasBld = B.some(function(x) { return x[0] !== '售價' && x[0] !== '位置'; });
      var left = B, right = L;
      if (!hasBld) { // 純土地：沒有建物資料，土地資料排成兩欄
        var all2 = B.concat(L); left = []; right = [];
        all2.forEach(function(x, k) { (k % 2 ? right : left).push(x); });
      }
      var label = function(t) { return cell(COLS[0], para(run(t, { b: 1 })), { fill: LABEL_FILL }); };
      var val = function(w, t, red) { return cell(w, ed(lines(t, { b: !!red, color: red ? 'B3261E' : '' }))); };
      for (var i2 = 0; i2 < Math.max(left.length, right.length); i2++) {
        var a = left[i2], b = right[i2];
        // 只有一邊有資料：內容橫跨到右邊，不留空白格子
        var one = a && !b ? a : (!a && b ? b : null);
        if (one) { rows.push(tr(label(one[0]) + cell(COLS[1] + COLS[2] + COLS[3], ed(lines(one[1], { b: one[0] === '售價', color: one[0] === '售價' ? 'B3261E' : '' })), { span: 3 }), 420)); continue; }
        rows.push(tr(label(a[0]) + val(COLS[1], a[1], a[0] === '售價') + cell(COLS[2], para(run(b[0], { b: 1 })), { fill: LABEL_FILL }) + val(COLS[3], b[1]), 420));
      }
      // 其他說明（環境說明）
      var env = v('建物及周圍環境其他說明(廠房)', '周圍環境其他說明(土地)');
      if (env) rows.push(tr(cell(COLS[0], para(run('其他說明', { b: 1 })), { fill: LABEL_FILL }) + cell(COLS[1] + COLS[2] + COLS[3], ed(lines(env)), { span: 3 }), 420));
      // 優勢特色
      if (d.feature) {
        var fl = String(d.feature).split(/\n/).filter(function(t) { return t.trim(); });
        rows.push(tr(cell(COLS[0], para(run('優勢特色', { b: 1 })), { fill: LABEL_FILL }) +
          cell(COLS[1] + COLS[2] + COLS[3], ed(fl.map(function(t) { return para(run('✓ ', { b: 1, color: '1E4A32' }) + run(t.replace(/^\s*\d+[.、]\s*/, ''))); }).join('')), { span: 3 }), 420));
      }
      // 服務人員／聯絡電話／仲介服務費（Word 裡直接改）
      var ag = d.agents[0] || { name: '', phone: '' };
      rows.push(tr(cell(COLS[0], para(run('服務人員', { b: 1 })), { fill: LABEL_FILL }) + cell(COLS[1], ed(para(run(ag.name || '', { b: 1 })))) +
        cell(COLS[2], para(run('聯絡電話', { b: 1 })), { fill: LABEL_FILL }) + cell(COLS[3], ed(para(run(ag.phone || '', { b: 1 })))), 460));
      rows.push(tr(cell(COLS[0], para(run('仲介服務費', { b: 1 })), { fill: LABEL_FILL }) + cell(COLS[1] + COLS[2] + COLS[3], ed(para('')), { span: 3 }), 460));
      // 公司資料放在頁尾（鎖住不能改）
      var body = tableXml(rows);
      // 照片（兩張一排）
      var media = [], rels = [];
      imgs.forEach(function(im, k) {
        if (!im) return;
        var src = d.photos[k], m = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.*)$/.exec(src || '');
        if (!m || m[1] === 'webp') return;
        var ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        media.push({ name: 'media/photo' + (k + 1) + '.' + ext, b64: m[2], ext: ext, w: im.width, h: im.height });
      });
      var mapM = /^data:image\/png;base64,(.*)$/.exec(docMap || '');
      // 位置圖：放在表格下方、同一頁（115/10/22；橫的 960×420，表格太長時 Word 會自己移到下一頁）
      if (mapM) {
        rels.push('<Relationship Id="rIdMap" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/map.png"/>');
        body += para(run('位置圖', { b: 1, sz: 26 }), { keepNext: 1, before: 160 }) + para(imgXml('rIdMap', 800, Math.round(6.5 * 914400), Math.round(6.5 * 914400 * 420 / 960)), { center: 1 });
      }
      // 第 2 頁：照片
      if (media.length) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (media.length) {
        body += para(run('物件照片', { b: 1, sz: 28 }), {}) + '<w:p/>';
        var cells = media.map(function(md, k) {
          var rid = 'rIdImg' + (k + 1);
          rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + md.name + '"/>');
          var maxW = 3.3 * 914400, maxH = 2.5 * 914400, r = Math.min(maxW / md.w, maxH / md.h);
          return cell(5233, ed(para(imgXml(rid, k + 1, Math.round(md.w * r), Math.round(md.h * r)), { center: 1 })));
        });
        var prow = [];
        for (var j = 0; j < cells.length; j += 2) prow.push(tr(cells[j] + (cells[j + 1] || cell(5233, para('')))));
        body += '<w:tbl><w:tblPr><w:tblW w:w="10466" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="5233"/><w:gridCol w:w="5233"/></w:tblGrid>' + prow.join('') + '</w:tbl>';
      }
      // 頁首：Logo＋「物件說明」＋深綠線；頁尾：深綠底白字公司資料。頁首頁尾在「限制編輯」裡鎖住，中間的內容可以改
      var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
      var logoM = /^data:image\/png;base64,(.*)$/.exec(LOGO_DATA || ''), hdrRels = '';
      var logoRun = '';
      if (logoM) {
        hdrRels = '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>';
        var lh = Math.round(0.5 * 914400), lw = Math.round(lh * 900 / 144);
        logoRun = imgXml('rIdLogo', 900, lw, lh);
      } else logoRun = run(d.company.name, { b: 1, sz: 28, color: BRAND_HEX });
      var header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' +
        '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="4" w:color="' + BRAND_HEX + '"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="10466"/></w:tabs><w:spacing w:after="120"/></w:pPr>' +
        logoRun + '<w:r><w:tab/></w:r>' + run('物件說明', { b: 1, sz: 28, color: BRAND_HEX }) + '</w:p></w:hdr>';
      var fpara = function(txt, o) { return '<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="' + BRAND_HEX + '"/><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' + run(txt, Object.assign({ color: 'FFFFFF' }, o || {})) + '</w:p>'; };
      var footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' +
        fpara(d.company.name + (d.company.phone ? '　電話 ' + d.company.phone : ''), { b: 1, sz: 22 }) +
        fpara((d.company.addr || COMPANY_ADDR) + '　' + d.company.broker, { sz: 18 }) + '</w:ftr>';
      var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<w:body>' + body + '<w:p/><w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:footerReference w:type="default" r:id="rIdFtr"/>' +
        '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="720" w:bottom="1200" w:left="720" w:header="360" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>';
      var zip = new JSZip();
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
      zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + rels.join('') + '</Relationships>');
      // 不限制修改（115/10/20）：整份都能改，包括頁首頁尾
      zip.file('word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>');
      zip.file('word/header1.xml', header);
      zip.file('word/footer1.xml', footer);
      zip.file('word/_rels/header1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + hdrRels + '</Relationships>');
      if (logoM) zip.file('word/media/logo.png', logoM[1], { base64: true });
      zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' + FONT_W + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>');
      zip.file('word/document.xml', doc);
      media.forEach(function(md) { zip.file('word/' + md.name, md.b64, { base64: true }); });
      if (mapM) zip.file('word/media/map.png', mapM[1], { base64: true });
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    });
  }
  // 115/10/29：產生 DM 前讓同仁挑照片：勾選要用哪幾張、◀ ▶ 調順序（第一張當封面）；只有一張就直接用
  function pickPhotos_(dlg, dm) {
    var photos = (dm.photos || []).slice();
    if (photos.length <= 1) return Promise.resolve(dm);
    var items = photos.map(function(src, i) { return { src: src, on: true, n: i + 1 }; });
    return new Promise(function(resolve) {
      var paint = function() {
        var grid = items.map(function(it, k) {
          return '<div data-k="' + k + '" style="width:118px;border:1px solid #ddd;border-radius:8px;padding:6px;background:' + (it.on ? '#fff' : '#f2f2f2') + ';opacity:' + (it.on ? '1' : '.45') + ';">' +
            '<img src="' + it.src + '" style="width:100%;height:84px;object-fit:cover;border-radius:6px;display:block;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:12.5px;">' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-on="' + k + '"' + (it.on ? ' checked' : '') + '>用</label>' +
            '<span style="font-weight:700;">' + (it.on ? (items.filter(function(x, j) { return x.on && j <= k; }).length === 1 && k === items.findIndex(function(x) { return x.on; }) ? '封面' : '') : '') + '</span></div>' +
            '<div style="display:flex;justify-content:center;gap:6px;margin-top:4px;"><button type="button" data-up="' + k + '" style="padding:1px 8px;">◀</button><button type="button" data-dn="' + k + '" style="padding:1px 8px;">▶</button></div></div>';
        }).join('');
        dlg.body.innerHTML = '<div style="color:' + MUTED + ';margin-bottom:8px;">勾選要放進 DM 的照片，◀ ▶ 調順序。第一張（有勾的）當封面，照這個順序放。</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + grid + '</div>' +
          '<button type="button" id="dmPickGo" style="margin-top:12px;width:100%;height:42px;border:none;border-radius:10px;background:' + BRAND + ';color:#fff;font:inherit;font-weight:700;cursor:pointer;">用這些照片產生 DM</button>';
        dlg.body.querySelectorAll('[data-on]').forEach(function(cb) { cb.addEventListener('change', function() { items[+cb.getAttribute('data-on')].on = cb.checked; paint(); }); });
        dlg.body.querySelectorAll('[data-up]').forEach(function(b) { b.addEventListener('click', function() { var k = +b.getAttribute('data-up'); if (k > 0) { var t = items[k]; items[k] = items[k - 1]; items[k - 1] = t; paint(); } }); });
        dlg.body.querySelectorAll('[data-dn]').forEach(function(b) { b.addEventListener('click', function() { var k = +b.getAttribute('data-dn'); if (k < items.length - 1) { var t = items[k]; items[k] = items[k + 1]; items[k + 1] = t; paint(); } }); });
        document.getElementById('dmPickGo').addEventListener('click', function() {
          var chosen = items.filter(function(it) { return it.on; }).map(function(it) { return it.src; });
          if (!chosen.length) { alert('請至少勾選一張照片。'); return; }
          resolve(Object.assign({}, dm, { photos: chosen }));
        });
      };
      paint();
    });
  }
  function open(auth, listing, key) {
    var dlg = window.RuiheMatch.showModal('「' + (listing.name || '物件') + '」DM', '<div style="color:' + MUTED + ';">讀取資料和照片中…（照片多的話要幾秒鐘）</div>');
    var p = key ? post('dmGetData', [auth.name, auth.code, key]) : Promise.resolve({ fields: {}, photos: [], agents: [], requester: { name: auth.name, phone: '' }, company: { name: '瑞禾不動產經紀股份有限公司', phone: '', broker: BROKER } });
    p.then(function(dm) {
      return pickPhotos_(dlg, dm).then(function(dm2) {
      var d = compose(listing, dm2);
      return draw(d).then(function(canvas) {
        var url = canvas.toDataURL('image/jpeg', 0.9);
        dlg.body.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 10px;">' +
          '<a class="btn" id="dmDl" href="' + url + '" download="' + esc((d.name || '物件') + '_DM.jpg') + '" style="display:inline-flex;align-items:center;height:40px;padding:0 16px;border-radius:10px;background:' + BRAND + ';color:#fff;text-decoration:none;font-weight:700;">下載圖片</a>' +
          '<button type="button" id="dmPdf" style="height:40px;padding:0 16px;border-radius:10px;border:1px solid ' + BRAND + ';background:#fff;color:' + BRAND + ';font:inherit;font-weight:700;cursor:pointer;">A4 版面（存成 PDF）</button>' +
          '<button type="button" id="dmDocx" style="height:40px;padding:0 16px;border-radius:10px;border:1px solid ' + BRAND + ';background:#fff;color:' + BRAND + ';font:inherit;font-weight:700;cursor:pointer;">Word 檔（可編輯）</button></div>' +
          (d.photos.length ? '' : '<div style="background:#FFF8E1;border:1px solid #E0C341;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13.5px;">沒有照片：' +
            esc(dm.photoNote || (key ? (/^RESIDENTIAL_/.test(key) ? '住商物件沒有照片資料' : '沒有讀到照片') : '物件簡表的資料還沒更新，請按「重新整理」後再試')) + '</div>') +
          '<img src="' + url + '" alt="DM 預覽" style="width:100%;max-width:540px;border:1px solid #ddd;border-radius:8px;display:block;">';
        document.getElementById('dmPdf').addEventListener('click', function() { printA4(d); });
        document.getElementById('dmDocx').addEventListener('click', function() {
          var b = this; b.disabled = true; b.textContent = '產生中…';
          makeDocx(d).then(function(blob) {
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (d.name || '物件') + '_物件說明.docx';
            document.body.appendChild(a); a.click(); setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          }).catch(function(err) { alert(err.message || '產生 Word 檔失敗'); }).then(function() { b.disabled = false; b.textContent = 'Word 檔（可編輯）'; });
        });
      });
      });
    }).catch(function(err) { dlg.body.innerHTML = '<div style="color:#B3261E;">產生失敗：' + esc(err.message || '連不上系統') + '</div>'; });
  }
  window.RuiheDM = { open: open, compose: compose, roadOnly: roadOnly, draw: draw, makeDocx: makeDocx };
})();
