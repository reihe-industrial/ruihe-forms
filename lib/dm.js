// ============================================================
// 瑞禾業務系統：一鍵產生 DM（115/10/15）
// 物件簡表按「產生 DM」→ 向物件後端拿 dmGetData（銷售DM資料表的欄位、前 4 張照片、業務電話、公司資料）
// → 畫成 1080×1350 直式圖片（傳 LINE 用）可下載；或開 A4 版面另存 PDF（瀏覽器的列印 → 另存為 PDF）。
// 地址只寫到路名（沒有詳細地址就寫地段），不放契約編號、委託人資料。
// 住商物件沒有 DM 資料：用物件簡表那一列的內容、沒有照片。
// 要用 lib/match.js 的跳出視窗（RuiheMatch.showModal）。
// ============================================================
(function() {
  var OBJ_API = 'https://script.google.com/macros/s/AKfycbx8cp8ArkFb4RXXom9UCR2cAqc8MdU6AZlBznwkSx34tQoYR2xEH0I1oJzouip-fyJJQw/exec';
  // 依法每份 DM 都要放公司經紀人資訊（後端沒回傳時用這個）
  var BROKER = '經紀人 張維純　(114)中市經紀字第02353號';
  var BRAND = '#1E4A32', BG = '#F4F3EE', INK = '#1F2A24', MUTED = '#5D6B62', FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(fn, args) {
    return fetch(OBJ_API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }) }).then(function(r) { return r.json(); }).then(function(res) {
      if (!res.ok) throw new Error(res.message || '系統發生錯誤');
      return res.result;
    });
  }
  function roadOnly(detail) {
    var d = String(detail || '').split(/[；;、\n]/)[0].replace(/\s/g, '');
    var m = d.match(/^(.*?)(?=\d|[一二三四五六七八九十百]+(?:之\d+)?[號巷弄])/);
    return (m ? m[1] : d).replace(/[-之]$/, '');
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
    var specs = [
      ['位置', placeTxt || ''],
      ['土地面積', g('土地面積(坪)', listing.land != null ? String(listing.land) : '') ? g('土地面積(坪)', String(listing.land)) + ' 坪' : ''],
      ['建物面積', g('主建物面積(坪)', listing.bld != null ? String(listing.bld) : '') ? g('主建物面積(坪)', String(listing.bld)) + ' 坪' : ''],
      ['使用分區', g('使用分區')], ['面臨路寬', g('面臨路寬')],
      ['基地面寬／深度', [g('基地面寬'), g('基地深度')].filter(Boolean).join('／')],
      ['樓層', floors], ['簷高', g('簷高(滴水高度)')], ['主要建材', g('主要建材')], ['朝向', g('建物朝向')], ['格局', g('物件格局')]
    ].filter(function(x) { return x[1]; });
    return {
      name: g('案名', listing.name) || '物件介紹',
      tags: [g('類型', listing.typesText), listing.rs ? (listing.rs === '租' ? '出租' : listing.rs === '售' ? '出售' : listing.rs) : '', g('建物類別')].filter(Boolean).join('・'),
      price: g('總價', listing.priceText), unit: g('單價', listing.unitText),
      specs: specs.slice(0, 8), feature: g('特色說明'), photos: dm.photos || [],
      agents: (dm.agents && dm.agents.length ? dm.agents : String(listing.agents || '').split(/[、,，]/).filter(Boolean).map(function(n) { return { name: n, phone: '' }; })),
      company: { name: (dm.company && dm.company.name) || '瑞禾不動產經紀股份有限公司', phone: (dm.company && dm.company.phone) || '', broker: (dm.company && dm.company.broker) || BROKER }
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
  // 畫 1080×1350 的 DM 圖片，回傳 canvas
  function draw(d) {
    return Promise.all(d.photos.map(loadImg)).then(function(imgs) {
      imgs = imgs.filter(Boolean);
      var W = 1080, H = 1350, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = BG; x.fillRect(0, 0, W, H);
      // 頁首
      x.fillStyle = BRAND; x.fillRect(0, 0, W, 120);
      x.fillStyle = '#fff'; var hs = 44; do { x.font = 'bold ' + hs + 'px ' + FONT; } while (x.measureText(d.company.name).width > W - 300 && --hs > 26); x.textBaseline = 'middle'; x.fillText(d.company.name, 48, 60);
      x.font = '28px ' + FONT; x.textAlign = 'right'; x.fillText('物件介紹', W - 48, 62); x.textAlign = 'left';
      // 案名、標籤、價格
      x.fillStyle = INK; x.font = 'bold 56px ' + FONT; x.textBaseline = 'alphabetic';
      var tl = wrap(x, d.name, W - 96).slice(0, 2);
      tl.forEach(function(t, i) { x.fillText(t, 48, 200 + i * 66); });
      var y = 200 + (tl.length - 1) * 66 + 52;
      x.fillStyle = MUTED; x.font = '30px ' + FONT; x.fillText(d.tags, 48, y);
      y += 64;
      if (d.price) {
        x.fillStyle = '#B3261E'; x.font = 'bold 54px ' + FONT; x.fillText(d.price, 48, y);
        if (d.unit) { var pw = x.measureText(d.price).width; x.fillStyle = MUTED; x.font = '28px ' + FONT; x.fillText('（' + d.unit + '）', 48 + pw + 14, y); }
        y += 30;
      }
      // 照片
      // 先算規格和物件特色要多高，剩下的給照片（照片區 300～470）
      var specH = 6;
      for (var mi = 0; mi < d.specs.length; mi += 2) {
        var two = false;
        [0, 1].forEach(function(o) {
          var sp = d.specs[mi + o]; if (!sp) return;
          x.font = '28px ' + FONT; var lw0 = x.measureText(sp[0]).width + 16;
          x.font = 'bold 28px ' + FONT; if (wrap(x, sp[1], W / 2 - 60 - lw0).length > 1) two = true;
        });
        specH += two ? 82 : 46;
      }
      x.font = '28px ' + FONT;
      var featLines = d.feature ? Math.min(5, wrap(x, d.feature, W - 96).length) : 0;
      var featH = featLines ? 46 + featLines * 40 + 10 : 0;
      var bottom = H - 150;
      var py = y + 10, pw2 = W - 96;
      var ph = Math.max(300, Math.min(470, bottom - py - 46 - specH - featH));
      if (!imgs.length) {
        x.fillStyle = '#E4E2D8'; x.fillRect(48, py, pw2, ph);
        x.fillStyle = MUTED; x.font = '30px ' + FONT; x.textAlign = 'center'; x.fillText('（尚無照片）', W / 2, py + ph / 2); x.textAlign = 'left';
      } else if (imgs.length === 1) cover(x, imgs[0], 48, py, pw2, ph);
      else if (imgs.length === 2) { cover(x, imgs[0], 48, py, pw2 / 2 - 6, ph); cover(x, imgs[1], 48 + pw2 / 2 + 6, py, pw2 / 2 - 6, ph); }
      else {
        cover(x, imgs[0], 48, py, pw2 * 0.62, ph);
        var sx = 48 + pw2 * 0.62 + 12, sw2 = pw2 * 0.38 - 12, n = imgs.length - 1, sh2 = (ph - (n - 1) * 12) / n;
        for (var k = 1; k < imgs.length; k++) cover(x, imgs[k], sx, py + (k - 1) * (sh2 + 12), sw2, sh2);
      }
      y = py + ph + 46;
      // 規格（兩欄）
      // 規格兩欄；內容太長的換到第二行（最多兩行）
      x.font = '28px ' + FONT;
      for (var si = 0; si < d.specs.length; si += 2) {
        var rowH = 46;
        [0, 1].forEach(function(o) {
          var sp = d.specs[si + o]; if (!sp) return;
          var cx = o === 0 ? 48 : W / 2 + 12;
          x.font = '28px ' + FONT; x.fillStyle = MUTED; x.fillText(sp[0], cx, y);
          var lw = x.measureText(sp[0]).width + 16;
          x.font = 'bold 28px ' + FONT; x.fillStyle = INK;
          var vl = wrap(x, sp[1], W / 2 - 60 - lw).slice(0, 2);
          vl.forEach(function(t, k) { x.fillText(t, cx + lw, y + k * 36); });
          if (vl.length > 1) rowH = Math.max(rowH, 82);
        });
        y += rowH;
      }
      y += 6;
      // 特色說明
      if (d.feature && y < bottom - 60) {
        x.fillStyle = BRAND; x.font = 'bold 30px ' + FONT; x.fillText('物件特色', 48, y); y += 46;
        x.fillStyle = INK; x.font = '28px ' + FONT;
        var fl = wrap(x, d.feature, W - 96), maxL = Math.max(1, Math.min(5, Math.floor((bottom - y + 30) / 40)));
        fl.slice(0, maxL).forEach(function(t, i) { x.fillText(i === maxL - 1 && fl.length > maxL ? t.slice(0, -1) + '…' : t, 48, y + i * 40); });
      }
      // 頁尾：聯絡業務（公司電話）＋最下面一行經紀人資訊（依法要放）
      x.fillStyle = BRAND; x.fillRect(0, H - 140, W, 140);
      x.fillStyle = '#fff'; x.font = 'bold 32px ' + FONT; x.textBaseline = 'middle';
      var who = d.agents.map(function(a) { return a.name + (a.phone ? ' ' + a.phone : ''); }).join('　');
      x.fillText('聯絡業務：' + (who || '—'), 48, H - 98);
      if (d.company.phone) { x.textAlign = 'right'; x.font = '28px ' + FONT; x.fillText(d.company.name + ' ' + d.company.phone, W - 48, H - 98); x.textAlign = 'left'; }
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(48, H - 66, W - 96, 1);
      // 公司全稱＋經紀人：太長就把字縮小到放得下（最小 18px）
      x.fillStyle = '#fff';
      var legal = d.company.name + '　' + d.company.broker, fs = 26;
      do { x.font = fs + 'px ' + FONT; } while (x.measureText(legal).width > W - 96 && --fs > 18);
      x.fillText(legal, 48, H - 36);
      return c;
    });
  }
  // A4 版面（另開視窗、按列印 → 另存為 PDF）
  function printA4(d) {
    var w = window.open('', '_blank');
    if (!w) { alert('瀏覽器擋住了新視窗，請允許這個網站開啟彈出式視窗後再試一次。'); return; }
    var photos = d.photos.slice(0, 4).map(function(p) { return '<img src="' + p + '">'; }).join('');
    w.document.write('<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>' + esc(d.name) + '</title><style>' +
      '@page{size:A4;margin:10mm}body{font-family:' + FONT + ';color:' + INK + ';margin:0}#pg{width:190mm}' +
      '.hd{background:' + BRAND + ';color:#fff;padding:8px 14px;display:flex;justify-content:space-between;font-weight:700;font-size:17px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'h1{font-size:22px;margin:8px 0 0}.tags{color:' + MUTED + ';font-size:13px}.price{color:#B3261E;font-size:21px;font-weight:700;margin:4px 0 6px}' +
      '.ph{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:6px 0}.ph img{width:100%;height:64mm;object-fit:cover}.ph img:only-child{grid-column:span 2;height:100mm}' +
      'table{width:100%;border-collapse:collapse;font-size:12.5px}td{border-bottom:1px solid #ddd;padding:4px 4px;vertical-align:top}td.k{color:' + MUTED + ';width:20%}' +
      '.feat{white-space:pre-wrap;font-size:12.5px;line-height:1.55;margin-top:2px}.ft{margin-top:8px;padding:8px 14px;background:' + BRAND + ';color:#fff;font-weight:700;font-size:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '</style></head><body><div id="pg"><div class="hd"><span>' + esc(d.company.name) + '</span><span>物件介紹</span></div>' +
      '<h1>' + esc(d.name) + '</h1><div class="tags">' + esc(d.tags) + '</div>' +
      (d.price ? '<div class="price">' + esc(d.price) + (d.unit ? '<span style="font-size:15px;color:' + MUTED + ';font-weight:400;">（' + esc(d.unit) + '）</span>' : '') + '</div>' : '') +
      (photos ? '<div class="ph">' + photos + '</div>' : '') +
      '<table>' + d.specs.map(function(s) { return '<tr><td class="k">' + esc(s[0]) + '</td><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</table>' +
      (d.feature ? '<h3 style="color:' + BRAND + ';margin:8px 0 2px;font-size:14px;">物件特色</h3><div class="feat">' + esc(d.feature) + '</div>' : '') +
      '<div class="ft">聯絡業務：' + esc(d.agents.map(function(a) { return a.name + (a.phone ? ' ' + a.phone : ''); }).join('　') || '—') + (d.company.phone ? '　｜　' + esc(d.company.name + ' ' + d.company.phone) : '') +
      '<div style="font-weight:400;font-size:13px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.4);">' + esc(d.company.name + '　' + d.company.broker) + '</div></div>' +
      '</div><script>window.onload=function(){' +
      // 內容超過一頁（A4 扣掉邊界約 277mm）就整頁等比例縮小，保證一頁
      'var pg=document.getElementById("pg"),mm=pg.getBoundingClientRect().width/190,max=274*mm,h=pg.scrollHeight;' +
      'if(h>max){pg.style.zoom=(max/h).toFixed(3);}' +
      'setTimeout(function(){window.print();},300);};<\/script></body></html>');
    w.document.close();
  }
  // 物件簡表呼叫：auth＝{ name, code }；listing＝RuiheMatch.parseListing 的結果；key＝物件鍵
  function open(auth, listing, key) {
    var dlg = window.RuiheMatch.showModal('「' + (listing.name || '物件') + '」DM', '<div style="color:' + MUTED + ';">讀取資料和照片中…（照片多的話要幾秒鐘）</div>');
    var p = key && !/^RESIDENTIAL_/.test(key) ? post('dmGetData', [auth.name, auth.code, key]) : Promise.resolve({ fields: {}, photos: [], agents: [], company: { name: '瑞禾不動產經紀股份有限公司', phone: '', broker: BROKER } });
    p.then(function(dm) {
      var d = compose(listing, dm);
      return draw(d).then(function(canvas) {
        var url = canvas.toDataURL('image/jpeg', 0.9);
        dlg.body.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 10px;">' +
          '<a class="btn" id="dmDl" href="' + url + '" download="' + esc((d.name || '物件') + '_DM.jpg') + '" style="display:inline-flex;align-items:center;height:40px;padding:0 16px;border-radius:10px;background:' + BRAND + ';color:#fff;text-decoration:none;font-weight:700;">下載圖片</a>' +
          '<button type="button" id="dmPdf" style="height:40px;padding:0 16px;border-radius:10px;border:1px solid ' + BRAND + ';background:#fff;color:' + BRAND + ';font:inherit;font-weight:700;cursor:pointer;">A4 版面（存成 PDF）</button></div>' +
          (d.photos.length ? '' : '<div style="background:#FFF8E1;border:1px solid #E0C341;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13.5px;">沒有照片：' +
            esc(dm.photoNote || (key ? (/^RESIDENTIAL_/.test(key) ? '住商物件沒有照片資料' : '沒有讀到照片') : '物件簡表的資料還沒更新，請按「重新整理」後再試')) + '</div>') +
          '<img src="' + url + '" alt="DM 預覽" style="width:100%;max-width:540px;border:1px solid #ddd;border-radius:8px;display:block;">';
        document.getElementById('dmPdf').addEventListener('click', function() { printA4(d); });
      });
    }).catch(function(err) { dlg.body.innerHTML = '<div style="color:#B3261E;">產生失敗：' + esc(err.message || '連不上系統') + '</div>'; });
  }
  window.RuiheDM = { open: open, compose: compose, roadOnly: roadOnly, draw: draw };
})();
