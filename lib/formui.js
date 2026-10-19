// ============================================================
// 瑞禾業務系統：表單頁共用的左側段落目錄、底部固定送出列、手機收合（第五批改版第 3 次，115/10/16）
// 新增客需、調謄本用（新增物件頁是同樣的做法，寫在 listing.html 裡）。只加外觀和導覽，送出還是各頁原本的程式。
//
// RuiheFormUI.init({
//   form: 放段落的容器（會被包進左右兩欄的版面）,
//   sectionSelector: '.card'（每一段；要有標題才算）,
//   titleSelector: ':scope > h2'（每一段的標題，可以省略）,
//   submitBtn: 原本的送出按鈕（底部列按的是它；原本的藏起來）,
//   check: function() { return ['沒填的欄位名稱', …]; }（跟送出時同一套檢查）,
//   findField: function(名稱) { return 欄位元素; }
// })
// ============================================================
(function() {
  var CSS = [
    '.rf-layout { display: block; }',
    '.rf-toc { display: none; }',
    '@media (min-width: 1200px) {',
    '  .rf-layout:has(> .rf-toc:not([hidden])) { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 20px; align-items: start; }',
    '  .rf-toc[hidden] { display: none; }',
    '  .rf-toc { display: block; position: sticky; top: 76px; background: #fff; border: 1px solid var(--line, #E2E1D8); border-radius: 12px; padding: 10px 8px; }',
    '  .rf-toc a { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; color: #4D5B52; text-decoration: none; font-size: 14px; }',
    '  .rf-toc a:hover, .rf-toc a.on { background: var(--brand-soft, #E6F0E9); color: var(--brand, #1E4A32); }',
    '  .rf-toc a.on { font-weight: 700; }',
    '  .rf-toc .num { flex: 0 0 22px; height: 22px; border-radius: 50%; border: 1.5px solid #CFD5CF; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #8a8f88; }',
    '  .rf-toc a.done .num { background: var(--brand, #1E4A32); border-color: var(--brand, #1E4A32); color: #fff; }',
    '  .rf-toc .miss { margin-left: auto; font-size: 12px; font-weight: 700; color: #B3261E; }',
    '}',
    '.rf-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; background: rgba(255,255,255,0.97); border-top: 1px solid var(--line, #E2E1D8); box-shadow: 0 -2px 10px rgba(31,42,36,0.06); padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); }',
    '.rf-bar[hidden] { display: none; }',
    '.rf-bar-in { max-width: 1180px; margin: 0 auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }',
    '.rf-bar .st { font-size: 14.5px; font-weight: 700; color: #B3261E; }',
    '.rf-bar .st.ok { color: var(--brand, #1E4A32); }',
    '.rf-bar .jump { border: none; background: none; color: var(--brand, #1E4A32); text-decoration: underline; font: inherit; font-size: 14px; cursor: pointer; padding: 4px; }',
    '.rf-bar .jump[hidden] { display: none; }',
    '.rf-bar .go { margin-left: auto; height: 46px; padding: 0 28px; border: none; border-radius: 10px; background: var(--brand, #1E4A32); color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }',
    '.rf-bar .go:disabled { opacity: 0.6; cursor: default; }',
    'body.has-rf-bar { padding-bottom: 84px; }',
    'body.has-rf-bar .rf-hide-submit { display: none !important; }',
    '@media (max-width: 700px) {',
    '  .rf-collapsible > h2 { cursor: pointer; display: flex; align-items: center; }',
    '  .rf-collapsible > h2::after { content: "收起"; margin-left: auto; font-size: 12.5px; font-weight: 500; color: var(--muted, #5D6B62); }',
    '  .rf-collapsible.rf-collapsed > h2::after { content: "展開"; }',
    '  .rf-collapsible.rf-collapsed > :not(h2) { display: none !important; }',
    '  .rf-bar .go { height: 44px; padding: 0 20px; }',
    '}'
  ].join('\n');

  function init(o) {
    var form = o.form;
    if (!form) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var layout = document.createElement('div'); layout.className = 'rf-layout';
    var toc = document.createElement('nav'); toc.className = 'rf-toc'; toc.setAttribute('aria-label', '段落目錄'); toc.hidden = true;
    form.parentNode.insertBefore(layout, form);
    layout.appendChild(toc); layout.appendChild(form);
    var bar = document.createElement('div'); bar.className = 'rf-bar'; bar.hidden = true;
    bar.innerHTML = '<div class="rf-bar-in"><span class="st"></span><button type="button" class="jump">跳到第一項</button><button type="button" class="go">送出</button></div>';
    document.body.appendChild(bar);
    var stEl = bar.querySelector('.st'), jump = bar.querySelector('.jump'), go = bar.querySelector('.go');
    var submit = o.submitBtn;
    if (submit) submit.classList.add('rf-hide-submit');
    go.addEventListener('click', function() { if (submit && !submit.disabled) submit.click(); });
    var first = null;
    jump.addEventListener('click', function() {
      if (!first) return;
      var sec = first.closest(o.sectionSelector); if (sec) sec.classList.remove('rf-collapsed');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = first.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea');
      if (inp) setTimeout(function() { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 400);
    });
    function sections() {
      return [].filter.call(form.querySelectorAll(o.sectionSelector), function(c) {
        var h = c.querySelector(o.titleSelector || ':scope > h2'); if (!h) return false;
        if (c.querySelector(':scope > h2')) c.classList.add('rf-collapsible');
        return c.offsetParent !== null;
      });
    }
    function markActive() {
      var secs = sections(), cur = null;
      secs.forEach(function(c) { if (c.getBoundingClientRect().top < 140) cur = c; });
      if (!cur) cur = secs[0];
      [].forEach.call(toc.querySelectorAll('a'), function(a) { a.classList.toggle('on', !!cur && a.getAttribute('data-sec') === cur.id); });
    }
    function refresh() {
      var visible = form.offsetParent !== null && (!submit || submit.offsetParent !== null || submit.classList.contains('rf-hide-submit'));
      if (submit && getComputedStyle(submit.parentNode).display === 'none') visible = false;
      bar.hidden = !visible;
      document.body.classList.toggle('has-rf-bar', visible);
      var secs = visible ? sections() : [];
      toc.hidden = !secs.length;
      if (!visible) return;
      if (submit) { go.textContent = submit.textContent; go.disabled = submit.disabled; }
      var miss = [];
      try { miss = o.check() || []; } catch (e) {}
      var per = new Map(), fs = [];
      miss.forEach(function(raw) {
        var f = o.findField(String(raw).replace(/（.*$/, ''));
        if (!f) return;
        fs.push(f);
        var c = f.closest(o.sectionSelector); if (c) per.set(c, (per.get(c) || 0) + 1);
      });
      fs.sort(function(x, y) { return (x.compareDocumentPosition(y) & 4) ? -1 : 1; });
      first = fs[0] || null;
      stEl.textContent = miss.length ? '還有 ' + miss.length + ' 項必填沒填' : '必填都填好了 ✓';
      stEl.className = 'st' + (miss.length ? '' : ' ok');
      jump.hidden = !first;
      toc.innerHTML = secs.map(function(c, i) {
        var t = c.querySelector(o.titleSelector || ':scope > h2').textContent.replace(/^[一二三四五六七八九十]+、/, '').replace(/[*＊]/g, '').replace(/（.*?）/g, '').trim();
        var m = per.get(c) || 0;
        if (!c.id) c.id = 'rfSec' + i;
        return '<a href="#' + c.id + '" class="' + (m ? '' : 'done') + '" data-sec="' + c.id + '"><span class="num">' + (m ? (i + 1) : '✓') + '</span><span>' + t.replace(/[<>&]/g, '') + '</span>' + (m ? '<span class="miss">' + m + '</span>' : '') + '</a>';
      }).join('');
      markActive();
    }
    toc.addEventListener('click', function(e) {
      var a = e.target.closest('a[data-sec]'); if (!a) return;
      e.preventDefault();
      var c = document.getElementById(a.getAttribute('data-sec')); if (!c) return;
      window.scrollTo({ top: c.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
    form.addEventListener('click', function(e) {
      var h = e.target.closest('.rf-collapsible > h2');
      if (!h || !window.matchMedia('(max-width: 700px)').matches) return;
      h.parentNode.classList.toggle('rf-collapsed');
    });
    var t = null, busy = false;
    function later() { if (busy) return; clearTimeout(t); t = setTimeout(function() { busy = true; try { refresh(); } finally { setTimeout(function() { busy = false; }, 0); } }, 400); }
    form.addEventListener('input', later); form.addEventListener('change', later);
    window.addEventListener('scroll', markActive, { passive: true });
    new MutationObserver(later).observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'disabled', 'class'] });
    if (submit) new MutationObserver(later).observe(submit, { childList: true, characterData: true, subtree: true, attributes: true });
    (o.watch || []).forEach(function(el) { if (el) new MutationObserver(later).observe(el, { attributes: true, attributeFilter: ['style', 'hidden'] }); });
    setTimeout(refresh, 600);
    return { refresh: refresh };
  }
  window.RuiheFormUI = { init: init };
})();
