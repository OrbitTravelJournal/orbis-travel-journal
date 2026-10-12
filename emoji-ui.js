/* Presentation only: keep original controls, labels and event handlers. */
(() => {
  // Original 24px line icons: one stroke, rounded ends, no font dependency.
  const icons = {
    home:'<path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m-3 3h7"/>',
    map:'<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14m6-12v14"/>',
    bookmark:'<path d="M6 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v15l-6-4-6 4z"/>',
    bed:'<path d="M3 20V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12M3 16h18M3 11h18M8 8v3m8-3v3"/>',
    journal:'<rect x="5" y="3" width="15" height="18" rx="3"/><path d="M8 3v18m4-12h5m-5 4h4M3 7h4m-4 5h4m-4 5h4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    warning:'<path d="m10 4-8 14a1 1 0 0 0 1 2h18a1 1 0 0 0 1-2L14 4a2 2 0 0 0-4 0ZM12 9v5m0 3v.1"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6"/>',
    copy:'<rect x="8" y="7" width="12" height="14" rx="3"/><path d="M15 7V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3"/>',
    share:'<path d="M12 15V3m-4 4 4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
    edit:'<path d="m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15zM4 20h16"/>',
    ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM15 5v2m0 3v2m0 3v4"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
    photo:'<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8m-9 4h4"/>',
    suitcase:'<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V4h6v3M8 7v13m8-13v13"/>',
    logout:'<path d="M10 4H5v16h5m0-8h11m-4-4 4 4-4 4"/>',
    menu:'<path d="M5 7h14M5 12h14M5 17h14"/>',
    pin:'<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0Z"/><circle cx="12" cy="9" r="2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    save:'<path d="M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6"/>',
    back:'<path d="m9 5-6 6 6 6m-6-6h12a5 5 0 0 1 0 10"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const pages = {trips:'home',itinerary:'calendar',map:'map',restaurants:'bookmark',stays:'bed',journal:'journal'};
  const colors = {
    home:'#77ce24',calendar:'#9762ff',map:'#00b8d4',bookmark:'#ff4b9b',bed:'#ff9345',journal:'#bc56ed',
    check:'#00c886',warning:'#e6b800',close:'#ed6274',trash:'#fa5a48',copy:'#c49700',share:'#18beac',
    edit:'#ab55ec',ticket:'#fa4e9c',compass:'#00b8bc',photo:'#4b83f6',search:'#7283ff',archive:'#df8c36',
    suitcase:'#80b719',logout:'#db648d',menu:'#8089c9',pin:'#ef7046',plus:'#13b982',save:'#438ef0',back:'#b666d7',user:'#b48a29',more:'#7e79ad'
  };
  const rules = [
    [/已复制|copied/i,'check'],[/无法自动复制|failed/i,'warning'],
    [/cancel|close|取消|关闭|^×$|^done$/i,'close'],
    [/delete|remove|删除|移除/i,'trash'],[/unsave|saved|save .*favorite|save trip|favorite|收藏|^save (?!stay|changes)/i,'bookmark'],
    [/copy|复制/i,'copy'],[/share|分享|email link/i,'share'],
    [/edit|change|修改|更换|编辑/i,'edit'],[/booking|预订/i,'ticket'],
    [/navigate|导航|open route|directions/i,'compass'],[/map|地图/i,'map'],
    [/photo|照片|upload/i,'photo'],[/detail|详情|提醒|工具/i,'search'],
    [/calendar|日历/i,'calendar'],[/past|archive|归档/i,'archive'],[/upcoming/i,'suitcase'],
    [/search|搜索/i,'search'],[/sign out/i,'logout'],[/menu|options|^···$|^☰$/i,'menu'],
    [/check.in|visited|打卡/i,'pin'],[/add|new|create|添加|新建/i,'plus'],
    [/save|保存/i,'save'],[/trip|行程|攻略|今天/i,'calendar'],[/stay|住宿|hotel/i,'bed'],
    [/return|back|返回/i,'back']
  ];
  function decorate() {
    document.querySelectorAll('.shell button,.shell a[data-page],.shell a[data-go],.shell .hotel-actions a,.shell .reader-navigate,.shell .navigate-stop,.shell .primary-map-link,.shell details>summary,dialog:not(#workspace-auth-dialog) button,dialog:not(#workspace-auth-dialog) .secondary-btn').forEach(el => {
      // Date information and language selectors remain readable.
      if (el.matches('.brand,.date-tab,[data-lang],summary') || el.closest('.language-switch,.reader-details-body,.reader-schedule,#reader-day-notes,.item-menu-panel')) return;
      const text = el.textContent.trim();
      const label = ((text.length > 2 ? text : el.getAttribute('aria-label')) || text || el.title || '').replace(/\s+/g,' ');
      const page = el.dataset.page || el.dataset.go || el.dataset.menuPage || el.dataset.fallbackPage;
      const icon = pages[page] || (el.matches('#workspace-profile') ? 'user' : el.matches('.save-stop,.trip-favorite') ? 'bookmark' : el.matches('.visited-stop') ? 'pin' : rules.find(([pattern]) => pattern.test(label))?.[1]) || 'more';
      el.classList.add('emoji-control');
      el.style.setProperty('--icon-color',colors[icon]);
      let graphic = el.querySelector(':scope>.orbis-icon');
      if (!graphic) { graphic = document.createElement('span'); graphic.className = 'orbis-icon'; graphic.setAttribute('aria-hidden','true'); el.append(graphic); }
      if (graphic.dataset.icon !== icon) {
        graphic.dataset.icon = icon;
        graphic.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${icons[icon]}</svg>`;
      }
      el.title = label;
      el.setAttribute('aria-label', label);
    });
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorate(); });
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
  decorate();
})();
