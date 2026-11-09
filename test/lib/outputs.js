// ============================================================
// 瑞禾業務系統：DM（給客戶看）和業務銷講可以放哪些內容（115/11/09）
// 物件內容頁（detail.html）照這份產生 DM、業務銷講；後台管理「系統設定」用這份列出勾選清單。
// 管理員在後台勾的結果存在後端（outputConfigGet／adminSaveOutputConfig）；沒設定過就用這裡的預設值。
// dm: true＝DM 預設放；dm: false＝DM 預設不放但可以勾；dmNo: true＝DM 不能放（客戶不能看的內部資料）
// ============================================================
(function() {
  // 物件內容頁的欄位分組（同一個欄位只出現一次）
  var SECTIONS = [
    { id: 'land', title: '土地', labels: ['都市或非都市計畫', '使用分區', '都市計畫細部計畫', '國土功能分區', '產業園區名稱', '產業園區名稱(土地)', '土地類型',
      '土地面積(m²)', '建蔽率', '容積率', '基地面寬', '基地深度', '面臨路寬', '土地朝向(廠房)', '土地朝向(土地)'] },
    { id: 'bld', title: '建物', labels: ['建物類別', '房屋類別', '社區大樓名稱', '__建物合計', '主建物面積(m²)', '附屬建物面積(m²)', '共同使用面積(m²)', '加蓋面積(m²)', '加蓋面積位於何處(廠房)',
      '建築完成日', '__屋齡', '所在樓別', '地上樓層', '地下樓層', '主要建材', '外壁材質', '物件格局(廠房)', '物件格局', '加蓋格局', '建物朝向', '大門朝向', '落地窗朝向',
      '簷高(滴水高度)', '樓地板載重或機具/電梯載重', '電梯數', '每層戶數'] },
    { id: 'equip', title: '設備與管理', labels: ['可供用水量', '可供用電量', '是否有汙水處理廠', '是否有廠登', '附屬設備', '建築能效標示', '太陽光電發電設備',
      '管理方式', '管理費', '管理費用', '繳費方式', '是否有留鑰匙'] },
    { id: 'park', title: '車位', labels: ['有無車位', '車位編號', '車位數量', '車位產權', '車位型態', '停車方式', '車位管理費', '車位說明'] },
    { id: 'life', title: '生活機能', labels: ['小學', '國中', '高中', '大學', '市場購物', '公園綠地', '醫療機構', '鄰近交通'] },
    { id: 'env', title: '周邊環境', labels: ['半徑300公尺是否有嫌惡設施', '周圍環境其他說明(土地)', '建物及周圍環境其他說明(廠房)'] },
    { id: 'deed', title: '謄本資料', labels: ['地段', '地段+地號', '地段+建號', '產權範圍', '持分比例', '全筆土地面積(m²)', '全筆主建物面積(m²)', '取得原因',
      '所有權人及持分', '他項權利', '屋主是否一年內取得', '取得年月', '取得成交價格', '資訊為實價登錄或屋主提供?'] },
    { id: 'presale', title: '預售屋／換約', labels: ['建築執照', '換約金額(萬)', '轉讓證明書', '原始簽約日', '原契約總價(萬)'] },
    { id: 'deal', title: '委託與狀態', labels: ['物件編號', '契約編號', '委託種類', '委託案件種類', '委託類別', '合約到期', '使用狀態',
      '使用狀態補充說明(廠房)', '使用狀態補充說明(土地)', '使用狀態補充說明(房屋)', '主要用途', '案件狀態', '狀態日期', '狀態說明', '成交價', '關聯物件'] }
  ];
  // DM 不能放的（客戶不能看）
  var DM_NO_SECTIONS = ['deed'];
  var DM_NO_LABELS = ['是否有留鑰匙', '車位編號', '物件編號', '契約編號', '委託案件種類', '委託類別', '合約到期', '案件狀態', '狀態日期', '狀態說明', '成交價', '關聯物件',
    '換約金額(萬)', '轉讓證明書', '原始簽約日', '原契約總價(萬)'];
  // DM 預設不放（可以勾）
  var DM_OFF_LABELS = ['加蓋面積位於何處(廠房)', '加蓋格局', '委託種類', '使用狀態補充說明(廠房)', '使用狀態補充說明(土地)', '使用狀態補充說明(房屋)', '建築執照'];
  // 業務銷講預設放「委託與狀態」裡的這幾個（其他委託與狀態的欄位預設不放）
  var TALK_DEAL_ON = ['契約編號', '委託種類', '使用狀態', '主要用途'];
  // 不是欄位的項目
  var SPECIAL = [
    { id: '__photos', label: '照片', dm: true, talk: true },
    { id: '__map', label: '位置圖（地圖）', dm: true, talk: false },
    { id: '特色說明', label: '特色說明', dm: true, talk: true },
    { id: '__road', label: '位置（只寫到路名）', dm: true, talk: false },
    { id: '__addrFull', label: '詳細地址', dmNo: true, talk: true },
    { id: '__agents', label: '負責業務和電話', dmNo: true, talk: true },
    { id: '__gmap', label: 'Google 地圖網址', dmNo: true, talk: true },
    { id: '其他備註說明', label: '其他備註說明', dmNo: true, talk: true },
    { id: '__checks', label: '帶看前確認清單', dmNo: true, talk: true },
    { id: '__notes', label: '現場紀錄（空白線）', dmNo: true, talk: true }
  ];
  function labelText(l) {
    return l === '__建物合計' ? '建物面積合計' : l === '__屋齡' ? '屋齡' : String(l).replace(/\((廠房|土地|房屋)\)$/, '').replace(/\(m²\)$/, '');
  }
  // 勾選清單：[{ group, items: [{ id, label, dmNo, dmDef, talkDef }] }]
  function catalog() {
    var out = [{ group: '一般', items: SPECIAL.map(function(s) { return { id: s.id, label: s.label, dmNo: !!s.dmNo, dmDef: !!s.dm && !s.dmNo, talkDef: !!s.talk }; }) }];
    SECTIONS.forEach(function(sec) {
      out.push({ group: sec.title, items: sec.labels.map(function(l) {
        var dmNo = DM_NO_SECTIONS.indexOf(sec.id) !== -1 || DM_NO_LABELS.indexOf(l) !== -1;
        var dmDef = !dmNo && sec.id !== 'deal' && sec.id !== 'presale' && DM_OFF_LABELS.indexOf(l) === -1;
        if (sec.id === 'deal' && (l === '使用狀態' || l === '主要用途')) dmDef = true;
        var talkDef = sec.id === 'deal' ? TALK_DEAL_ON.indexOf(l) !== -1 : true;
        return { id: l, label: labelText(l), dmNo: dmNo, dmDef: dmDef, talkDef: talkDef };
      }) });
    });
    return out;
  }
  function allItems() { var a = []; catalog().forEach(function(g) { a = a.concat(g.items); }); return a; }
  // cfg：後端存的 { dm: [...], talk: [...] }（沒設定過是 null）；kind：'dm' 或 'talk'
  // 回傳一個判斷函式 on(id)
  function chooser(cfg, kind) {
    var items = allItems(), map = {};
    items.forEach(function(it) { map[it.id] = it; });
    var list = cfg && Array.isArray(cfg[kind]) ? cfg[kind] : null;
    return function(id) {
      var it = map[id];
      if (kind === 'dm' && it && it.dmNo) return false; // 客戶不能看的，設定了也不放
      if (list) return list.indexOf(id) !== -1;
      if (!it) return false;
      return kind === 'dm' ? it.dmDef : it.talkDef;
    };
  }
  window.RuiheOutputs = { SECTIONS: SECTIONS, catalog: catalog, chooser: chooser, labelText: labelText };
})();
