// ============================================================
// 瑞禾業務系統：新增物件、新增客需的草稿（115/11/09）
// 草稿同時存在這台電腦（localStorage）和雲端（物件後端 draftCloudSave…，存在 Google 雲端硬碟「表單雲端草稿」資料夾），
// 換電腦、換手機、過幾天回來都能接著填。只有自己看得到自己的草稿；送出成功就刪掉。
// 照片不會存進草稿，接著填的時候要重新選。
// 用法：var D = RuiheDrafts.create({ key, kind: 'listing'|'client', apiUrl: 字串或函式, keepDays, onStatus })
// ============================================================
(function() {
  var LOGIN_KEY = 'ruihe_login_v1';
  function login_() { try { var a = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null'); return a && a.name && a.code ? a : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function newId() { return 'd' + Date.now() + Math.random().toString(36).slice(2, 6); }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function when(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()); }

  function create(o) {
    var keepDays = o.keepDays || 60, max = o.max || 20;
    var api = function() { return typeof o.apiUrl === 'function' ? o.apiUrl() : o.apiUrl; };
    var status = o.onStatus || function() {};
    var self = { id: newId(), cloud: null, picked: false };
    function call(fn, args, keepalive) {
      return fetch(api(), { method: 'POST', body: JSON.stringify({ fn: fn, args: args }), keepalive: !!keepalive })
        .then(function(r) { return r.json(); })
        .then(function(res) { if (!res.ok) throw new Error(res.message || '後端發生錯誤'); return res.result; });
    }

    // ---- 這台電腦 ----
    self.all = function() { try { var a = JSON.parse(localStorage.getItem(o.key) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    self.save = function(a) {
      var lim = Date.now() - keepDays * 864e5;
      a = a.filter(function(x) { return x && x.at >= lim && x.draft; }).sort(function(x, y) { return y.at - x.at; }).slice(0, max);
      try { localStorage.setItem(o.key, JSON.stringify(a)); } catch (e) {}
    };

    // ---- 雲端（存的動作排隊：一次只送一份，停手 5 秒後送）----
    var pending = null, timer = null, busy = false, lastSent = {};
    function send(keepalive) {
      if (!pending || busy) return Promise.resolve(false);
      var a = login_(); if (!a) { status('nologin'); return Promise.resolve(false); }
      var p = pending; pending = null;
      var json = JSON.stringify(p.draft);
      if (lastSent[p.id] === json) { status('saved', lastSent[p.id + '@']); return Promise.resolve(true); }
      busy = true; status('saving');
      return call('draftCloudSave', [a.name, a.code, o.kind, p.id, p.title, p.sub, json], keepalive && json.length < 60000).then(function(r) {
        busy = false; lastSent[p.id] = json; lastSent[p.id + '@'] = r && r.at || Date.now(); status('saved', lastSent[p.id + '@']);
        if (pending) return send();
        return true;
      }).catch(function(err) {
        busy = false; if (!pending) pending = p; status('error', err && err.message);
        return false;
      });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(function() { timer = null; send(); }, o.delay || 5000); }

    self.put = function(draft, title, sub) {
      var a = self.all().filter(function(x) { return x.id !== self.id; });
      a.unshift({ id: self.id, at: Date.now(), title: title || '', sub: sub || '', draft: draft });
      self.save(a);
      pending = { id: self.id, title: title || '', sub: sub || '', draft: draft };
      schedule();
    };
    // 馬上存到雲端（「暫存」按鈕、離開頁面）；回傳 Promise<是否成功>
    self.flush = function(keepalive) {
      clearTimeout(timer); timer = null;
      if (!pending) return Promise.resolve(lastSent[self.id] !== undefined);
      if (busy) return new Promise(function(ok) { var t = setInterval(function() { if (!busy) { clearInterval(t); ok(send(keepalive)); } }, 200); });
      return send(keepalive);
    };
    self.hasPending = function() { return !!pending; };
    function cloudDel(id) {
      delete lastSent[id]; if (pending && pending.id === id) pending = null;
      var a = login_(); if (!a) return Promise.resolve();
      return call('draftCloudDelete', [a.name, a.code, o.kind, id]).catch(function() {});
    }
    self.removeCurrent = function() { // 送出成功：只刪這一份（電腦和雲端都刪）
      var old = self.id;
      self.save(self.all().filter(function(x) { return x.id !== old; }));
      if (self.cloud) self.cloud = self.cloud.filter(function(x) { return x.id !== old; });
      cloudDel(old);
      self.id = newId();
    };
    // 讀雲端清單（不含內容）
    self.loadCloud = function() {
      var a = login_(); if (!a) return Promise.resolve([]);
      return call('draftCloudList', [a.name, a.code, o.kind]).then(function(r) { self.cloud = (r && r.items) || []; return self.cloud; })
        .catch(function() { self.cloud = []; return []; });
    };

    // 這台電腦＋雲端合在一起的清單
    function merged() {
      var map = {}, out = [];
      self.all().forEach(function(x) { map[x.id] = { id: x.id, at: x.at, title: x.title, sub: x.sub, local: x, cloud: null }; out.push(map[x.id]); });
      (self.cloud || []).forEach(function(c) {
        var m = map[c.id];
        if (m) { m.cloud = c; if (c.at > m.at + 1000) { m.at = c.at; m.title = c.title || m.title; m.sub = c.sub || m.sub; } }
        else out.push({ id: c.id, at: c.at, title: c.title, sub: c.sub, local: null, cloud: c });
      });
      var lim = Date.now() - keepDays * 864e5;
      return out.filter(function(x) { return x.at >= lim; }).sort(function(x, y) { return y.at - x.at; });
    }

    // 草稿橫幅；回傳有沒有草稿
    self.banner = function(onPick, onNew, newLabel) {
      var box = document.getElementById(o.boxId || 'draftBanner'), list = merged();
      if (!list.length) { box.style.display = 'none'; return false; }
      var cloudOn = !!login_();
      box.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">有 ' + list.length + ' 份還沒送出的草稿（保留 ' + keepDays + ' 天）</div>' +
        list.slice(0, 10).map(function(x) {
          var where = x.cloud ? '雲端和這台電腦都有' : (cloudOn ? '只存在這台電腦' : '存在這台電腦');
          if (x.cloud && !x.local) where = '存在雲端';
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed #e0c341;"><div style="flex:1;min-width:0;"><b>' + esc(x.title || '（還沒填名稱）') + '</b>' +
            (x.sub ? '<span style="color:#7a6a20;">｜' + esc(x.sub) + '</span>' : '') + '<div style="font-size:12.5px;color:#7a6a20;">最後儲存 ' + when(x.at) + '・' + where + '</div></div>' +
            '<button type="button" data-draft="' + esc(x.id) + '" style="padding:7px 14px;background:#2f6f4e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">繼續這一份</button>' +
            '<button type="button" data-draft-del="' + esc(x.id) + '" style="padding:7px 10px;background:#fff;color:#B3261E;border:1px solid #E8B4B0;border-radius:8px;cursor:pointer;">刪除</button></div>';
        }).join('') +
        (self.cloud === null && cloudOn ? '<div style="font-size:12.5px;color:#7a6a20;margin-top:6px;" data-cloud-loading>雲端草稿讀取中…</div>' : '') +
        '<div style="margin-top:8px;"><button type="button" data-draft-new style="width:100%;padding:9px;background:#fff;color:#2f6f4e;border:1px solid #2f6f4e;border-radius:8px;cursor:pointer;font-weight:600;">' + esc(newLabel) + '（草稿會留著）</button></div>';
      box.style.display = 'block';
      box.onclick = function(e) {
        var del = e.target.closest('[data-draft-del]');
        if (del) { // 只刪這一份（先確認，刪掉就找不回來）
          var did = del.getAttribute('data-draft-del'), dx = merged().filter(function(y) { return y.id === did; })[0];
          if (dx && confirm('確定要刪除「' + (dx.title || '（還沒填名稱）') + '」這份草稿嗎？刪掉就找不回來（雲端的也會一起刪）。')) {
            self.save(self.all().filter(function(y) { return y.id !== did; }));
            if (self.cloud) self.cloud = self.cloud.filter(function(y) { return y.id !== did; });
            cloudDel(did);
            if (!self.banner(onPick, onNew, newLabel)) { self.picked = true; onNew(); }
          }
          return;
        }
        var b = e.target.closest('[data-draft]');
        if (b) {
          var id = b.getAttribute('data-draft'), x = merged().filter(function(y) { return y.id === id; })[0];
          if (!x) return;
          var useCloud = x.cloud && (!x.local || x.cloud.at > x.local.at + 1000);
          if (!useCloud) { self.id = x.id; self.picked = true; box.style.display = 'none'; onPick(x.local.draft); return; }
          var a = login_(); if (!a) return;
          b.disabled = true; b.textContent = '讀取中…';
          call('draftCloudGet', [a.name, a.code, o.kind, id]).then(function(r) {
            self.id = id; self.picked = true; box.style.display = 'none';
            var arr = self.all().filter(function(y) { return y.id !== id; });
            arr.unshift({ id: id, at: r.at || Date.now(), title: r.title || '', sub: r.sub || '', draft: r.draft });
            self.save(arr);
            lastSent[id] = JSON.stringify(r.draft); lastSent[id + '@'] = r.at;
            onPick(r.draft);
          }).catch(function(err) {
            b.disabled = false; b.textContent = '繼續這一份';
            alert('讀不到這份雲端草稿：' + (err && err.message || err));
          });
          return;
        }
        if (e.target.closest('[data-draft-new]')) { self.picked = true; box.style.display = 'none'; onNew(); }
      };
      return true;
    };
    // 頁面離開：還沒送到雲端的馬上送（keepalive）
    window.addEventListener('pagehide', function() { if (pending) self.flush(true); });
    return self;
  }
  // 「暫存」按鈕旁的狀態文字
  function statusText(st, x) {
    if (st === 'saving') return '雲端暫存中…';
    if (st === 'saved') return '已暫存到雲端 ' + (x ? when(x) : '') + '，換電腦也能接著填';
    if (st === 'error') return '雲端暫存失敗（這台電腦還有存），稍後會再試';
    if (st === 'nologin') return '沒有登入，只存在這台電腦';
    if (st === 'empty') return '還沒填內容，不用暫存';
    return '';
  }
  window.RuiheDrafts = { create: create, statusText: statusText };
})();
