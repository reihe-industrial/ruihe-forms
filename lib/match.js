// ============================================================
// 瑞禾業務系統：客需 ↔ 物件配對（115/10/15）
// 物件簡表（銷售中）和客需簡表（不含客戶資料）兩份資料在瀏覽器裡比對，客需修改頁、物件簡表、首頁共用。
//
// 一定要符合（不符合就不列）：
//   - 物件類型（客戶要廠房只配廠房；透天、別墅等建物類別都算房屋）
//   - 買／租（購買配「售」、承租配「租」）
//   - 區域：物件要在客戶目標區域的同一個縣市（不同縣市不列）；客戶沒填區域就不限
//   - 預算：超出預算 15% 以內還會列出來（標「預算超出 X%」），超過 15% 不列；物件沒填價格還是列，標「物件沒填價格」
//   - 坪數（115/10/16 改成一定要符合）：在客戶範圍內，或差 20% 以內才列；客戶有填坪數、物件沒填坪數的不列
//   - 結案的客需不配（客需簡表的 _closed）
// 加分（分數高的排前面，同分新的在前）：
//   - 區域：同一個區 +3（客戶只寫縣市＝整個縣市都算）；預設只列這種。勾「也顯示鄰近區域」才另外列「鄰近」的 +1（標 near）：
//     物件（有座標用座標，沒有用它那一區的中心點）距離客戶指定的區中心「系統設定 nearKm」公里以內（預設 10），不分縣市
//   - 坪數：在範圍內 +2；差 20% 以內 +1（再差就不列）
//   - 預算：在預算內 +2；超出 15% 以內 +1
// 範圍的寫法：「300~500」「300-500」「300至500」「500以上」「300以下」；坪數只寫一個數字＝上下 20%，預算只寫一個數字＝上限。
// 價格單位：買賣總價「萬」（1.2億＝12000萬）；廠房、土地租金「元/坪/月」比物件單價；房屋租金「元/月」比物件月租（萬/月）。
// ============================================================
(function() {
  var OBJ_API = 'https://script.google.com/macros/s/AKfycbx8cp8ArkFb4RXXom9UCR2cAqc8MdU6AZlBznwkSx34tQoYR2xEH0I1oJzouip-fyJJQw/exec';
  var CLIENT_API = 'https://script.google.com/macros/s/AKfycbz6EXnxZb40rln8q9xTaD_TiABT5leWT-R20P5DAQmgLwhiyLvVsI8mqC4Df4wT01zP/exec';
  var HOUSE_KINDS = ['房屋', '無電梯公寓', '華廈(10樓含以下)', '大樓(11樓以上)', '透天', '別墅', '一般套房', '商務套房', '學生套房', '樓中樓', '農舍'];

  // 管理員在「系統設定」改的參數（首頁登入時存進這個瀏覽器）；沒有就用預設
  function setting(k, def) {
    try { var v = (JSON.parse(localStorage.getItem('ruihe_settings_v1') || 'null') || {}).values; return v && isFinite(Number(v[k])) ? Number(v[k]) : def; } catch (e) { return def; }
  }
  // 區的中心點：台中市各區內建；其他縣市的區用物件簡表裡那一區物件座標的平均（setListings 時算）
  var TC = { '中區': [24.1437, 120.6794], '東區': [24.1367, 120.6977], '南區': [24.1199, 120.6646], '西區': [24.1417, 120.6650], '北區': [24.1584, 120.6826],
    '西屯區': [24.1814, 120.6261], '南屯區': [24.1376, 120.6157], '北屯區': [24.1822, 120.7136], '豐原區': [24.2520, 120.7230], '東勢區': [24.2586, 120.8278],
    '大甲區': [24.3489, 120.6224], '清水區': [24.2687, 120.5785], '沙鹿區': [24.2335, 120.5662], '梧棲區': [24.2549, 120.5316], '后里區': [24.3093, 120.7108],
    '神岡區': [24.2576, 120.6619], '潭子區': [24.2122, 120.7054], '大雅區': [24.2290, 120.6479], '新社區': [24.2340, 120.8095], '石岡區': [24.2750, 120.7801],
    '外埔區': [24.3320, 120.6543], '大安區': [24.3460, 120.5865], '烏日區': [24.1046, 120.6239], '大肚區': [24.1536, 120.5410], '龍井區': [24.1927, 120.5458],
    '霧峰區': [24.0616, 120.7003], '太平區': [24.1265, 120.7187], '大里區': [24.0994, 120.6779], '和平區': [24.2500, 121.0000] };
  var CENTERS = {};
  Object.keys(TC).forEach(function(d) { CENTERS['台中市' + d] = TC[d]; });
  function setListings(listings) {
    var sum = {};
    listings.forEach(function(L) {
      if (!L.coord || !L.county || !L.district) return;
      var k = L.county + L.district;
      if (!sum[k]) sum[k] = [0, 0, 0];
      sum[k][0] += L.coord[0]; sum[k][1] += L.coord[1]; sum[k][2]++;
    });
    Object.keys(sum).forEach(function(k) { if (!(k in CENTERS) || !TC[k.replace(/^台中市/, '')]) CENTERS[k] = [sum[k][0] / sum[k][2], sum[k][1] / sum[k][2]]; });
  }
  function km(a, b) {
    var R = 6371, t = Math.PI / 180, dLat = (b[0] - a[0]) * t, dLng = (b[1] - a[1]) * t;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function split(v) { return String(v == null ? '' : v).split(/[、,，;；\/\s]+/).map(function(x) { return x.trim(); }).filter(Boolean); }
  function mainType(t) {
    t = String(t || '').replace(/^[A-Za-z]\./, '');
    if (t === '廠房' || t === '土地') return t;
    return HOUSE_KINDS.indexOf(t) !== -1 ? '房屋' : '';
  }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/,/g, '').replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 65248); });
    var m = s.match(/(\d+(?:\.\d+)?)\s*億(?:\s*(\d+(?:\.\d+)?)\s*萬?)?/);
    if (m) return parseFloat(m[1]) * 10000 + (m[2] ? parseFloat(m[2]) : 0);
    m = s.match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  // 範圍：回傳 [下限, 上限] 或 null；isBudget：只寫一個數字時當上限（坪數則是上下 20%）
  function range(v, isBudget) {
    var s = String(v == null ? '' : v).replace(/,/g, '').trim();
    if (!s) return null;
    var nums = [];
    s.replace(/(\d+(?:\.\d+)?)\s*(億)?/g, function(all, n, yi) { nums.push(parseFloat(n) * (yi ? 10000 : 1)); return all; });
    if (!nums.length) return null;
    if (nums.length >= 2 && /[~～\-－至到]/.test(s)) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
    if (/以上|起/.test(s)) return [nums[0], Infinity];
    if (/以下|以內|內/.test(s)) return [0, nums[0]];
    var ap = setting('areaPct', 10) / 100;
    return isBudget ? [0, nums[0]] : [nums[0] * (1 - ap), nums[0] * (1 + ap)];
  }
  function place(text) {
    var t = String(text || '').replace(/\s/g, '').replace(/臺/g, '台');
    var m = t.match(/^(.{2}[縣市])(.{1,4}?[區鄉鎮市])?/);
    return m ? { county: m[1], district: m[2] || '' } : { county: '', district: '' };
  }
  function regions(text) {
    var out = [];
    split(String(text || '').replace(/臺/g, '台')).forEach(function(tok) {
      var p = place(tok);
      if (p.county) out.push(p);
    });
    return out;
  }

  // ---------- 從兩份簡表的列整理出比對要用的資料 ----------
  function parseClient(cols, row) {
    var g = function(l) { var i = cols.indexOf(l); return i === -1 ? '' : String(row[i] == null ? '' : row[i]); };
    return {
      key: g('_key'), closed: g('_closed') === '1', agents: split(g('負責業務')),
      types: split(g('物件類型')).map(mainType).filter(Boolean), demand: split(g('需求類型')),
      regionText: g('目標區域'), regions: regions(g('目標區域')), fill: g('填表日期'), industry: g('產業類別'),
      need: {
        '廠房': { buyArea: g('廠房需求坪數'), buyPrice: g('廠房總價(萬元)'), rentArea: g('廠房需求坪數(承租)'), rentPrice: g('廠房租金(元/坪/月)') },
        '土地': { buyArea: g('土地需求面積(坪)'), buyPrice: g('土地總價(萬元)'), rentArea: g('土地需求面積(承租)(坪)'), rentPrice: g('土地租金(元/坪/月)') },
        '房屋': { buyArea: g('房屋需求坪數'), buyPrice: g('房屋總價(萬元)'), rentArea: g('房屋需求坪數(承租)'), rentPrice: g('房屋租金(元/月)') }
      }
    };
  }
  function parseListing(cols, row, date, index, coord) {
    var g = function(l) { var i = cols.indexOf(l); return i === -1 ? '' : String(row[i] == null ? '' : row[i]); };
    var types = split(g('類型'));
    var p = place(g('坐落'));
    return {
      index: index, name: g('案件名稱'), typesText: types.join('、'), main: mainType(types[0] || ''), rs: g('租/售'),
      county: p.county, district: p.district, placeText: g('坐落'), section: g('地段'),
      land: num(g('土地面積(坪)')), bld: num(g('建物面積(坪)')), priceText: g('總價'), unitText: g('單價'),
      total: num(g('總價')), unit: num(g('單價')), agents: g('業務人員'), contract: g('契約類型'), date: date || '',
      coord: coord && isFinite(coord[0]) && isFinite(coord[1]) ? coord : null
    };
  }

  // ---------- 一個客需和一件物件：符合就回傳 { score, reasons, warn }，不符合回傳 null ----------
  function score(c, L) {
    if (c.closed || !L.main || c.types.indexOf(L.main) === -1) return null;
    var best = null;
    c.demand.forEach(function(d) {
      var rs = d.indexOf('購') !== -1 || d.indexOf('買') !== -1 ? '售' : (d.indexOf('租') !== -1 ? '租' : '');
      if (!rs || String(L.rs).indexOf(rs) === -1) return;
      var reasons = [], warn = '', s = 0, near = false;
      // 區域
      if (c.regions.length) {
        if (!L.county) return;
        var sameCounty = c.regions.filter(function(r) { return r.county === L.county; });
        if (sameCounty.some(function(r) { return !r.district || r.district === L.district; })) { s += 3; reasons.push('區域符合（' + (L.district || L.county) + '）'); }
        else {
          // 鄰近：物件位置距離客戶指定的區中心幾公里以內
          var pos = L.coord || CENTERS[L.county + L.district];
          var best2 = null;
          c.regions.forEach(function(r) { var ctr = r.district ? CENTERS[r.county + r.district] : null; if (pos && ctr) { var d2 = km(pos, ctr); if (best2 === null || d2 < best2.d) best2 = { d: d2, r: r }; } });
          if (!best2 || best2.d > setting('nearKm', 10)) return;
          s += 1; near = true; reasons.push('鄰近（' + L.county + L.district + '，離' + best2.r.district + '約 ' + Math.round(best2.d) + ' 公里）');
        }
      } else reasons.push('客戶沒填區域');
      // 坪數
      var n = c.need[L.main] || {};
      var area = range(rs === '售' ? n.buyArea : n.rentArea);
      var have = L.main === '土地' ? L.land : (L.bld != null ? L.bld : L.land);
      if (area) {
        if (have == null) return; // 客戶有填坪數、物件沒填：沒辦法判斷，不列
        if (have >= area[0] && have <= area[1]) { s += 2; reasons.push('坪數符合（' + have + ' 坪）'); }
        else if (have >= area[0] * (1 - setting('areaPct', 10) / 100) && have <= area[1] * (1 + setting('areaPct', 10) / 100)) { s += 1; reasons.push('坪數接近（' + have + ' 坪）'); }
        else return; // 坪數差太多：不列
      } else reasons.push('客戶沒填坪數');
      // 預算
      var budget = range(rs === '售' ? n.buyPrice : n.rentPrice, true);
      var price = null, unitLabel = '';
      if (rs === '售') { price = L.total; unitLabel = '萬'; }
      else if (L.main === '房屋') { price = L.total != null ? L.total * 10000 : null; unitLabel = '元/月'; }
      else { price = L.unit; unitLabel = '元/坪/月'; }
      if (!budget) reasons.push('客戶沒填預算');
      if (budget && price == null && isFinite(budget[1])) warn = '物件沒填價格';
      if (budget && price != null && isFinite(budget[1])) {
        if (price <= budget[1]) { s += 2; reasons.push('預算內'); }
        else {
          var over = (price - budget[1]) / budget[1];
          if (over > setting('budgetOverPct', 5) / 100) return;
          s += 1; warn = '預算超出 ' + Math.round(over * 100) + '%';
        }
      }
      if (!best || (best.near && !near) || (best.near === near && s > best.score)) best = { score: s, reasons: reasons, warn: warn, near: near };
    });
    return best;
  }
  function byScore(a, b) { return b.m.score - a.m.score || String(b.date || '').localeCompare(String(a.date || '')); }
  // includeNear：也列同縣市其他區的（預設只列區域符合的）
  function matchesForClient(c, listings, includeNear) {
    var out = [];
    listings.forEach(function(L) { var m = score(c, L); if (m && (includeNear || !m.near)) out.push({ listing: L, m: m, date: L.date }); });
    return out.sort(byScore);
  }
  function matchesForListing(L, clients, includeNear) {
    var out = [];
    clients.forEach(function(c) { var m = score(c, L); if (m && (includeNear || !m.near)) out.push({ client: c, m: m, date: c.fill }); });
    return out.sort(byScore);
  }
  function countNear(c, listings) { var n = 0; listings.forEach(function(L) { var m = score(c, L); if (m && m.near) n++; }); return n; }

  // ---------- 讀資料（先用這個分頁或裝置的暫存，再向後端確認是不是最新的） ----------
  function post(url, fn, args) {
    return fetch(url, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }) }).then(function(r) { return r.json(); }).then(function(res) {
      if (!res.ok) { var e = new Error(res.message || '系統發生錯誤'); e.fromServer = true; throw e; }
      return res.result;
    });
  }
  function readCache(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function loadListings(auth) {
    var c = readCache('ruihe_summary_cache_v1');
    return post(OBJ_API, 'summaryGetListings', [auth.name, auth.code, c && c.version && c.dates && c.keys && c.coords ? c.version : '']).then(function(res) {
      if (!(res.unchanged && c)) {
        c = { version: res.version, columns: res.columns || [], rows: res.rows || [], dates: res.dates || [], keys: res.keys || [], coords: res.coords || [], checkedAt: Date.now() };
        try { localStorage.setItem('ruihe_summary_cache_v1', JSON.stringify(c)); } catch (e) {}
      }
      var list = c.rows.map(function(r, i) { var L = parseListing(c.columns, r, (c.dates || [])[i], i, (c.coords || [])[i]); L.key = (c.keys || [])[i] || ''; return L; });
      setListings(list);
      return list;
    });
  }
  function loadClients(auth) {
    var c = readCache('ruihe_client_summary_cache_v1');
    return post(CLIENT_API, 'clientSummaryGet', [auth.name, auth.code, c && c.version ? c.version : '']).then(function(res) {
      if (!(res.unchanged && c)) {
        c = { version: res.version, columns: res.columns || [], rows: res.rows || [], checkedAt: Date.now() };
        try { localStorage.setItem('ruihe_client_summary_cache_v1', JSON.stringify(c)); } catch (e) {}
      }
      return c.rows.map(function(r) { return parseClient(c.columns, r); });
    });
  }

  // ---------- 畫面：清單 HTML、跳出視窗 ----------
  function reasonHtml(m) {
    return m.reasons.map(function(r) { return '<span style="display:inline-block;margin:2px 6px 0 0;font-size:12.5px;color:#1E4A32;">✓ ' + esc(r) + '</span>'; }).join('') +
      (m.warn ? '<span style="display:inline-block;margin:2px 6px 0 0;font-size:12.5px;font-weight:700;color:#8a4b00;background:#FFF2CC;border-radius:6px;padding:1px 6px;">' + esc(m.warn) + '</span>' : '');
  }
  function listingItemHtml(x) {
    var L = x.listing;
    var area = [L.land != null ? '土地 ' + L.land + ' 坪' : '', L.bld != null ? '建物 ' + L.bld + ' 坪' : ''].filter(Boolean).join('｜');
    return '<div style="border-top:1px solid #E2E1D8;padding:10px 2px;">' +
      '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;"><b style="font-size:15px;">' + esc(L.name || '（未填案名）') + '</b>' +
      '<span style="font-size:12.5px;color:#4D5B52;">' + esc([L.typesText, L.rs, L.contract].filter(Boolean).join('｜')) + '</span>' +
      '<span style="margin-left:auto;font-weight:700;color:#1E4A32;">' + esc(L.priceText || '') + '</span></div>' +
      '<div style="font-size:13.5px;color:#33403A;">' + esc([L.placeText, L.section, area].filter(Boolean).join('　')) + '</div>' +
      '<div style="font-size:13px;color:#5D6B62;">業務：' + esc(L.agents || '—') + (L.date ? '｜' + esc(L.date) + ' 登錄' : '') + '</div>' +
      '<div>' + reasonHtml(x.m) + '</div></div>';
  }
  function needText(c) {
    var parts = [];
    c.types.forEach(function(t) {
      var n = c.need[t] || {};
      c.demand.forEach(function(d) {
        var buy = d.indexOf('購') !== -1 || d.indexOf('買') !== -1;
        var a = buy ? n.buyArea : n.rentArea, p = buy ? n.buyPrice : n.rentPrice;
        if (a || p) parts.push(t + (buy ? '購買' : '承租') + '：' + [a ? a + ' 坪' : '', p ? p + (buy ? ' 萬' : (t === '房屋' ? ' 元/月' : ' 元/坪/月')) : ''].filter(Boolean).join('、'));
      });
    });
    return parts.join('；');
  }
  function clientItemHtml(x, link) {
    var c = x.client;
    return '<div style="border-top:1px solid #E2E1D8;padding:10px 2px;">' +
      '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;"><b style="font-size:15px;">' + esc(c.types.join('、') + '・' + c.demand.join('、')) + '</b>' +
      (c.industry ? '<span style="font-size:12.5px;color:#4D5B52;">' + esc(c.industry) + '</span>' : '') +
      '<span style="margin-left:auto;font-size:13px;color:#5D6B62;">負責業務：' + esc(c.agents.join('、') || '—') + '</span></div>' +
      '<div style="font-size:13.5px;color:#33403A;">' + esc([c.regionText ? '區域：' + c.regionText : '', needText(c)].filter(Boolean).join('｜')) + '</div>' +
      (c.fill ? '<div style="font-size:13px;color:#5D6B62;">' + esc(c.fill) + ' 填表</div>' : '') +
      '<div>' + reasonHtml(x.m) + (link ? ' <a href="' + esc(link) + '" style="font-size:13px;font-weight:700;color:#2E6B4A;">修改／追蹤</a>' : '') + '</div></div>';
  }
  function showModal(title, html) {
    var old = document.getElementById('ruiheMatchModal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'ruiheMatchModal';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,25,0.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto;';
    wrap.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:760px;width:100%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,0.25);font-size:14px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><h2 style="margin:0;font-size:18px;color:#1E4A32;">' + esc(title) + '</h2>' +
      '<button type="button" id="ruiheMatchClose" style="margin-left:auto;height:36px;padding:0 14px;border-radius:8px;border:1px solid #CFD5CF;background:#fff;font:inherit;cursor:pointer;">關閉</button></div>' +
      '<div id="ruiheMatchBody">' + html + '</div></div>';
    document.body.appendChild(wrap);
    var close = function() { wrap.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function(e) { if (e.key === 'Escape') close(); };
    document.getElementById('ruiheMatchClose').addEventListener('click', close);
    wrap.addEventListener('click', function(e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey);
    return { body: document.getElementById('ruiheMatchBody'), close: close };
  }

  window.RuiheMatch = {
    parseClient: parseClient, parseListing: parseListing, score: score, range: range, place: place,
    matchesForClient: matchesForClient, matchesForListing: matchesForListing, countNear: countNear, setListings: setListings,
    loadListings: loadListings, loadClients: loadClients,
    listingItemHtml: listingItemHtml, clientItemHtml: clientItemHtml, needText: needText, showModal: showModal, esc: esc
  };
})();
