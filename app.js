/* 지예 작업 현황 — data/works.json 만 고치면 화면이 바뀝니다. */
(function () {
  'use strict';

  var DATA_URL = 'data/works.json';
  var HIDDEN_KEY = 'work-tracker-hidden-ids';
  var STATUS = {
    user_action: { label: '지예 작업/대기', badge: '지예 작업중', cls: 'user' },
    review: { label: '심사중', badge: '심사 대기중', cls: 'review' },
    approved: { label: '승인 완료', badge: '승인 완료', cls: 'approved' },
    rejected: { label: '반려·보완', badge: '반려·재작업', cls: 'rejected' }
  };
  var FILTERS = [
    { id: 'all', label: '전체' },
    { id: 'user_action', label: '지예 작업중/대기' },
    { id: 'review', label: '심사중' },
    { id: 'approved', label: '승인완료' },
    { id: 'rejected', label: '반려/보완' }
  ];

  var DATA = null;
  var FILTER = 'all';
  var ROUTE = { view: 'home', id: null };
  var LOADING = false;
  var HIDDEN = [];          /* 숨긴 작업 id 목록 (localStorage 저장) */
  var TOAST_TIMER = null;
  var TOAST_ACTION = null;

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadFilter() {
    try {
      var f = localStorage.getItem('wt.filter');
      if (f && FILTERS.some(function (x) { return x.id === f; })) FILTER = f;
    } catch (e) { /* ignore */ }
  }

  function saveFilter() {
    try { localStorage.setItem('wt.filter', FILTER); } catch (e) { /* ignore */ }
  }

  /* ── 숨김(삭제) ────────────────────────────────── */

  function loadHidden() {
    try {
      var raw = localStorage.getItem(HIDDEN_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      HIDDEN = Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string' && x; }) : [];
    } catch (e) { HIDDEN = []; }
  }

  function saveHidden() {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(HIDDEN)); } catch (e) { /* ignore */ }
  }

  function isHidden(it) { return !!it && HIDDEN.indexOf(it.id) !== -1; }

  function hideItem(id) {
    if (HIDDEN.indexOf(id) === -1) { HIDDEN.push(id); saveHidden(); }
  }

  function unhideItem(id) {
    var i = HIDDEN.indexOf(id);
    if (i !== -1) { HIDDEN.splice(i, 1); saveHidden(); }
  }

  /* 원본 JSON 에서 사라진 id 는 숨김 목록에서도 정리 */
  function pruneHidden() {
    var known = {};
    rawItems().forEach(function (it) { if (it && it.id) known[it.id] = 1; });
    var next = HIDDEN.filter(function (id) { return known[id]; });
    if (next.length !== HIDDEN.length) { HIDDEN = next; saveHidden(); }
  }

  function findItem(id) {
    var hit = null;
    (DATA && DATA.platforms || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        if (it && it.id === id) hit = { item: it, platform: p };
      });
    });
    return hit;
  }

  /* ── 계산 ───────────────────────────────────────── */

  function emptyCounts() {
    return { user_action: 0, review: 0, approved: 0, rejected: 0 };
  }

  function countItems(items) {
    var c = emptyCounts();
    items.forEach(function (it) {
      if (c[it.status] == null) c[it.status] = 0;
      c[it.status] += 1;
    });
    return c;
  }

  /* 숨김 포함 전체 항목 */
  function rawItems() {
    var out = [];
    (DATA && DATA.platforms || []).forEach(function (p) { (p.items || []).forEach(function (it) { out.push(it); }); });
    return out;
  }

  /* 화면에 보이는(숨기지 않은) 항목 */
  function allItems() {
    return rawItems().filter(function (it) { return !isHidden(it); });
  }

  function visibleItems(p) {
    return (p.items || []).filter(function (it) { return !isHidden(it); });
  }

  function progress(items) {
    var weight = { approved: 100, review: 60, user_action: 35, rejected: 15 };
    if (!items.length) return 0;
    var sum = 0;
    items.forEach(function (it) {
      var w = weight[it.status];
      sum += typeof w === 'number' ? w : 35;
    });
    return Math.round(sum / items.length);
  }

  function matches(item) {
    return FILTER === 'all' || item.status === FILTER;
  }

  function fmtUpdated(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      var s = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(d);
      return s + ' 기준';
    } catch (e) {
      return iso;
    }
  }

  /* ── 토스트 ─────────────────────────────────────── */

  function showToast(msg, actionLabel, onAction) {
    var el = $('toast');
    if (!el) return;
    var txt = $('toast-text');
    var act = $('toast-action');
    txt.textContent = msg;
    TOAST_ACTION = typeof onAction === 'function' ? onAction : null;
    if (actionLabel && TOAST_ACTION) {
      act.textContent = actionLabel;
      act.hidden = false;
    } else {
      act.hidden = true;
    }
    el.hidden = false;
    clearTimeout(TOAST_TIMER);
    TOAST_TIMER = setTimeout(hideToast, 4600);
  }

  function hideToast() {
    clearTimeout(TOAST_TIMER);
    var el = $('toast');
    if (el) el.hidden = true;
    TOAST_ACTION = null;
  }

  function hideWithUndo(id) {
    var hit = findItem(id);
    if (!hit) return;
    hideItem(id);
    refreshAll();
    showToast('‘' + hit.item.title + '’ 항목을 숨겼어요', '실행 취소', function () {
      unhideItem(id);
      refreshAll();
      hideToast();
    });
  }

  /* ── 숨긴 항목 관리 ─────────────────────────────── */

  function renderHiddenToggle() {
    var btn = $('hidden-toggle');
    var n = HIDDEN.length;
    if (!btn) return;
    btn.hidden = n === 0;
    var cnt = $('hidden-count');
    if (cnt) cnt.textContent = n;
  }

  function hiddenRows() {
    var rows = [];
    (DATA && DATA.platforms || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        if (isHidden(it)) rows.push({ platform: p, item: it });
      });
    });
    return rows;
  }

  function renderHiddenSheet() {
    var rows = hiddenRows();
    var list = $('hidden-list');
    var title = $('hidden-title');
    if (title) title.textContent = '숨긴 항목 ' + rows.length + '개';
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<li class="hidden-empty">숨긴 항목이 없어요.</li>';
    } else {
      list.innerHTML = rows.map(function (r) {
        return '<li class="hidden-row">' +
          '<span class="h-main">' +
            '<span class="h-title">' + esc(r.item.title) + '</span>' +
            '<span class="h-meta"><i class="tick" style="background:' + esc(r.platform.color || '#6C5CE7') + '"></i>' +
              esc(r.platform.name) + ' · ' + esc(r.item.id) + '</span>' +
          '</span>' +
          '<button class="h-restore" type="button" data-restore="' + esc(r.item.id) + '">복원</button>' +
        '</li>';
      }).join('');
    }
    Array.prototype.forEach.call(list.querySelectorAll('[data-restore]'), function (btn) {
      btn.addEventListener('click', function () {
        restoreOne(btn.getAttribute('data-restore'));
      });
    });
    var copyBtn = $('hidden-copy');
    if (copyBtn) copyBtn.disabled = !rows.length;
    var allBtn = $('hidden-restore-all');
    if (allBtn) allBtn.disabled = !rows.length;
  }

  function openHiddenSheet() {
    renderHiddenSheet();
    var sheet = $('hidden-sheet');
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    var close = $('hidden-close');
    if (close) { try { close.focus(); } catch (e) { /* ignore */ } }
  }

  function closeHiddenSheet() {
    var sheet = $('hidden-sheet');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('sheet-open');
  }

  function restoreOne(id) {
    var hit = findItem(id);
    unhideItem(id);
    refreshAll();
    if (hit) showToast('‘' + hit.item.title + '’ 항목을 다시 표시했어요');
    else showToast('항목을 다시 표시했어요');
  }

  function restoreAll() {
    var n = HIDDEN.length;
    if (!n) return;
    HIDDEN = [];
    saveHidden();
    refreshAll();
    showToast('숨긴 항목 ' + n + '개를 모두 다시 표시했어요');
  }

  function hiddenCopyText() {
    var lines = ['아래 항목 원본에서 삭제해 주세요:'];
    hiddenRows().forEach(function (r) {
      lines.push('- [' + r.platform.name + '] ' + r.item.title + ' (' + r.item.id + ')');
    });
    return lines.join('\n');
  }

  function copyHiddenList() {
    var rows = hiddenRows();
    if (!rows.length) { showToast('숨긴 항목이 없어요'); return; }
    var text = hiddenCopyText();
    var done = function () {
      showToast('숨긴 목록 ' + rows.length + '개를 복사했어요 · 채팅에 붙여넣어 주세요');
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      var ok = false;
      try {
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
      } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done();
      else showToast('복사하지 못했어요 · 목록을 길게 눌러 복사해 주세요');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* ── 렌더 ───────────────────────────────────────── */

  function renderHeader() {
    var title = (DATA.app && DATA.app.title) || '작업 현황';
    document.title = title;
    $('app-title').textContent = title;
    $('updated-at').textContent = DATA.app && DATA.app.updatedAt
      ? '최근 업데이트 ' + fmtUpdated(DATA.app.updatedAt)
      : '최근 업데이트 정보 없음';
  }

  function renderStats() {
    var c = countItems(allItems());
    var total = c.user_action + c.review + c.approved + c.rejected;
    var tiles = [
      { key: 'all', label: '전체 작업', n: total },
      { key: 'review', label: '심사중', n: c.review },
      { key: 'user_action', label: '지예 대기', n: c.user_action },
      { key: 'approved', label: '승인', n: c.approved }
    ];
    var box = $('stats');
    box.innerHTML = tiles.map(function (t) {
      var on = FILTER === t.key ? 'true' : 'false';
      return '<button class="stat" type="button" data-stat="' + t.key + '" aria-pressed="' + on + '">' +
        '<span class="n">' + t.n + '</span><span class="l">' + esc(t.label) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-stat]'), function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.getAttribute('data-stat'));
      });
    });
  }

  function renderChips() {
    var c = countItems(allItems());
    var box = $('chips');
    box.innerHTML = FILTERS.map(function (f) {
      var n = f.id === 'all'
        ? c.user_action + c.review + c.approved + c.rejected
        : c[f.id];
      var on = FILTER === f.id ? 'true' : 'false';
      return '<button class="chip" type="button" role="tab" data-filter="' + f.id + '" aria-pressed="' + on + '">' +
        esc(f.label) + '<span class="c">' + n + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-filter]'), function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.getAttribute('data-filter'));
      });
    });
  }

  function platformCard(p) {
    var items = visibleItems(p);
    var hiddenHere = (p.items || []).length - items.length;
    var c = countItems(items);
    var shown = FILTER === 'all' ? items.length : items.filter(matches).length;
    var pct = progress(items);
    var parts = [];
    if (c.user_action) parts.push('<span><i class="tick user"></i>지예 대기 ' + c.user_action + '</span>');
    if (c.review) parts.push('<span><i class="tick review"></i>심사중 ' + c.review + '</span>');
    if (c.approved) parts.push('<span><i class="tick approved"></i>승인 ' + c.approved + '</span>');
    if (c.rejected) parts.push('<span><i class="tick rejected"></i>반려 ' + c.rejected + '</span>');
    if (hiddenHere && items.length) parts.push('<span class="p-hidden">숨김 ' + hiddenHere + '</span>');
    var dim = FILTER !== 'all' && shown === 0 ? ' style="opacity:.45"' : '';
    var counts = parts.length ? parts.join('') : '<span>' + (hiddenHere ? '숨긴 항목만 있음' : '작업 없음') + '</span>';
    var pctText = items.length ? pct + '%' : '—';
    return '<li>' +
      '<button class="p-card" type="button" data-platform="' + esc(p.id) + '" style="--c:' + esc(p.color || '#6C5CE7') + '"' + dim + '>' +
        '<span class="p-emoji" style="--c:' + esc(p.color || '#6C5CE7') + '">' + esc(p.emoji || '📁') + '</span>' +
        '<span class="p-main">' +
          '<span class="p-name">' + esc(p.name) + '</span>' +
          '<span class="p-studio">' + esc(p.studio || '') + '</span>' +
          '<span class="p-counts">' + counts + '</span>' +
          '<span class="p-bar"><i style="width:' + pct + '%"></i></span>' +
        '</span>' +
        '<span class="p-pct">' + pctText + '</span>' +
        '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
      '</button></li>';
  }

  function renderHome() {
    var list = $('platform-list');
    var platforms = DATA.platforms || [];
    list.innerHTML = platforms.map(platformCard).join('');
    Array.prototype.forEach.call(list.querySelectorAll('[data-platform]'), function (btn) {
      btn.addEventListener('click', function () {
        location.hash = '#p/' + btn.getAttribute('data-platform');
      });
    });
    var total = countItems(allItems());
    var n = total.user_action + total.review + total.approved + total.rejected;
    $('platform-label').textContent = '플랫폼 ' + platforms.length + '곳 · 작업 ' + n + '개' +
      (HIDDEN.length ? ' · 숨김 ' + HIDDEN.length : '');
    $('home-view').hidden = false;
    $('detail-view').hidden = true;
  }

  function stepHtml(s) {
    var state = s.state === 'done' || s.state === 'current' ? s.state : 'todo';
    return '<li class="' + state + '"><span class="dot"></span>' +
      '<span class="label">' + esc(s.label) + '</span>' +
      (s.date ? '<span class="t-date">' + esc(s.date) + '</span>' : '') + '</li>';
  }

  var TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 7h16M9.5 7V4.8h5V7M6.4 7l.9 12.2h9.4L17.6 7M10 11v4.6M14 11v4.6"/></svg>';

  function itemCard(it) {
    var st = STATUS[it.status] || { badge: it.status, cls: 'review' };
    var steps = (it.steps || []).map(stepHtml).join('');
    var files = (it.files || []).length
      ? '<p class="i-files">자료 ' + it.files.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(' ') + '</p>'
      : '';
    return '<li class="i-card">' +
      '<div class="i-top">' +
        '<h3>' + esc(it.title) + '</h3>' +
        '<span class="badge ' + st.cls + '">' + esc(st.badge) + '</span>' +
        '<button class="i-hide" type="button" data-hide="' + esc(it.id) + '"' +
          ' aria-label="‘' + esc(it.title) + '’ 숨기기" title="숨기기">' + TRASH_SVG + '</button>' +
      '</div>' +
      (it.subtitle ? '<p class="i-sub">' + esc(it.subtitle) + '</p>' : '') +
      (it.meta ? '<p class="i-meta">' + esc(it.meta) + '</p>' : '') +
      (steps ? '<ol class="timeline">' + steps + '</ol>' : '') +
      (it.nextAction ? '<p class="next"><b>다음</b><span>' + esc(it.nextAction) + '</span></p>' : '') +
      (it.note ? '<p class="i-note">' + esc(it.note) + '</p>' : '') +
      files +
      '</li>';
  }

  function renderDetail() {
    var p = (DATA.platforms || []).filter(function (x) { return x.id === ROUTE.id; })[0];
    if (!p) { location.hash = '#/'; return; }
    var all = p.items || [];
    var items = visibleItems(p);
    var hiddenHere = all.length - items.length;
    var c = countItems(items);
    var visible = items.filter(matches);
    var pct = progress(items);

    var pills = [];
    if (c.user_action) pills.push('<span class="pill"><i class="user"></i>지예 작업/대기 ' + c.user_action + '</span>');
    if (c.review) pills.push('<span class="pill"><i class="review"></i>심사중 ' + c.review + '</span>');
    if (c.approved) pills.push('<span class="pill"><i class="approved"></i>승인 완료 ' + c.approved + '</span>');
    if (c.rejected) pills.push('<span class="pill"><i class="rejected"></i>반려·보완 ' + c.rejected + '</span>');
    pills.push('<span class="pill">진행률 ' + (items.length ? pct + '%' : '—') + '</span>');

    var head = '<div class="d-head" style="--c:' + esc(p.color || '#6C5CE7') + '">' +
      '<div class="d-head-top">' +
        '<span class="p-emoji" style="--c:' + esc(p.color || '#6C5CE7') + '">' + esc(p.emoji || '📁') + '</span>' +
        '<div><h2>' + esc(p.name) + '</h2><p class="sub">' + esc(p.studio || '') + '</p></div>' +
      '</div>' +
      '<div class="d-counts">' + pills.join('') + '</div>' +
      (p.link ? '<a class="studio-link" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' +
        esc(p.linkLabel || '스튜디오 열기') +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg></a>' : '') +
      (p.note ? '<p class="d-note">' + esc(p.note) + '</p>' : '') +
      '</div>';

    var body;
    if (visible.length) {
      body = '<ul class="item-list">' + visible.map(itemCard).join('') + '</ul>';
    } else if (!items.length && hiddenHere) {
      body = '<p class="empty">이 플랫폼 작업은 모두 숨겨져 있어요.<br>' +
        '<button class="empty-link" type="button" data-open-hidden>숨긴 항목 관리</button></p>';
    } else {
      body = '<p class="empty">이 상태의 작업이 없어요.</p>';
    }

    var filterNote = '';
    if (FILTER !== 'all') {
      var label = (FILTERS.filter(function (f) { return f.id === FILTER; })[0] || {}).label || FILTER;
      filterNote = '<p class="filter-note"><span>‘' + esc(label) + '’ ' + visible.length + '개만 보는 중</span>' +
        '<button type="button" data-clear-filter>전체 보기</button></p>';
    }

    var hiddenNote = hiddenHere && items.length
      ? '<p class="d-hidden">이 플랫폼에서 숨긴 항목 ' + hiddenHere + '개' +
        '<button type="button" data-open-hidden>보기</button></p>'
      : '';

    $('detail-body').innerHTML = head + filterNote + hiddenNote + body;
    $('home-view').hidden = true;
    $('detail-view').hidden = false;

    var bodyEl = $('detail-body');
    var clearBtn = bodyEl.querySelector('[data-clear-filter]');
    if (clearBtn) clearBtn.addEventListener('click', function () { setFilter('all'); });
    Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-hide]'), function (btn) {
      btn.addEventListener('click', function () {
        hideWithUndo(btn.getAttribute('data-hide'));
      });
    });
    Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-open-hidden]'), function (btn) {
      btn.addEventListener('click', openHiddenSheet);
    });
  }

  function render() {
    if (!DATA) return;
    renderHeader();
    renderStats();
    renderChips();
    renderHiddenToggle();
    if (ROUTE.view === 'detail') renderDetail();
    else renderHome();
  }

  /* 화면 + 열려 있는 숨김 패널 함께 갱신 */
  function refreshAll() {
    render();
    var sheet = $('hidden-sheet');
    if (sheet && !sheet.hidden) renderHiddenSheet();
  }

  function setFilter(f) {
    if (FILTER === f) return;
    FILTER = f;
    saveFilter();
    render();
  }

  /* ── 라우팅 ─────────────────────────────────────── */

  function parseHash() {
    var h = location.hash || '';
    var m = h.match(/^#p\/([\w-]+)/);
    ROUTE = m ? { view: 'detail', id: m[1] } : { view: 'home', id: null };
    render();
    window.scrollTo(0, 0);
  }

  /* ── 데이터 ─────────────────────────────────────── */

  function fetchData(bust) {
    var url = DATA_URL + (bust ? '?t=' + Date.now() : '');
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function refresh() {
    if (LOADING) return;
    LOADING = true;
    $('refresh').classList.add('busy');
    fetchData(true).then(function (json) {
      DATA = json;
      pruneHidden();
      refreshAll();
    }).catch(function () {
      if (!DATA) {
        $('platform-list').innerHTML = '<li class="skeleton">목록을 불러오지 못했어요. 전원·네트워크를 확인하고 새로 고침을 눌러 주세요.</li>';
        $('platform-label').textContent = '';
      }
    }).then(function () {
      LOADING = false;
      $('refresh').classList.remove('busy');
    });
  }

  function netState() {
    var el = $('net-state');
    if (!el) return;
    el.hidden = navigator.onLine !== false;
  }

  /* ── 시작 ───────────────────────────────────────── */

  loadFilter();
  loadHidden();
  netState();
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);
  window.addEventListener('hashchange', parseHash);
  $('back').addEventListener('click', function () { location.hash = '#/'; });
  $('refresh').addEventListener('click', refresh);

  $('toast-action').addEventListener('click', function () {
    var fn = TOAST_ACTION;
    hideToast();
    if (fn) fn();
  });

  $('hidden-toggle').addEventListener('click', openHiddenSheet);
  $('hidden-close').addEventListener('click', closeHiddenSheet);
  $('hidden-backdrop').addEventListener('click', closeHiddenSheet);
  $('hidden-copy').addEventListener('click', copyHiddenList);
  $('hidden-restore-all').addEventListener('click', restoreAll);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var sheet = $('hidden-sheet');
      if (sheet && !sheet.hidden) closeHiddenSheet();
    }
  });

  $('platform-list').innerHTML = '<li class="skeleton">불러오는 중…</li>';
  fetchData(false).then(function (json) {
    DATA = json;
    pruneHidden();
    parseHash();
  }).catch(function () {
    $('platform-list').innerHTML = '<li class="skeleton">목록을 불러오지 못했어요. 새로 고침을 눌러 주세요.</li>';
  });

  /* 서비스 워커: 새 버전이 제어를 잡으면 한 번만 자동 새로고침 */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }   /* 첫 설치 때는 새로고침하지 않음 */
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    var checkUpdate = function (reg) {
      if (!reg || !reg.update) return;
      try {
        var pr = reg.update();
        if (pr && pr.catch) pr.catch(function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        .then(checkUpdate)
        .catch(function () { /* ignore */ });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || !navigator.serviceWorker.controller) return;
      navigator.serviceWorker.getRegistration().then(checkUpdate).catch(function () { /* ignore */ });
    });
  }
})();
