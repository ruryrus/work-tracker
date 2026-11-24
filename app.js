/* 지예 작업 현황 — data/works.json 만 고치면 화면이 바뀝니다. */
(function () {
  'use strict';

  var DATA_URL = 'data/works.json';
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

  function allItems() {
    var out = [];
    (DATA.platforms || []).forEach(function (p) { (p.items || []).forEach(function (it) { out.push(it); }); });
    return out;
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
    var items = p.items || [];
    var c = countItems(items);
    var shown = FILTER === 'all' ? items.length : items.filter(matches).length;
    var pct = progress(items);
    var parts = [];
    if (c.user_action) parts.push('<span><i class="tick user"></i>지예 대기 ' + c.user_action + '</span>');
    if (c.review) parts.push('<span><i class="tick review"></i>심사중 ' + c.review + '</span>');
    if (c.approved) parts.push('<span><i class="tick approved"></i>승인 ' + c.approved + '</span>');
    if (c.rejected) parts.push('<span><i class="tick rejected"></i>반려 ' + c.rejected + '</span>');
    var dim = FILTER !== 'all' && shown === 0 ? ' style="opacity:.45"' : '';
    return '<li>' +
      '<button class="p-card" type="button" data-platform="' + esc(p.id) + '" style="--c:' + esc(p.color || '#6C5CE7') + '"' + dim + '>' +
        '<span class="p-emoji" style="--c:' + esc(p.color || '#6C5CE7') + '">' + esc(p.emoji || '📁') + '</span>' +
        '<span class="p-main">' +
          '<span class="p-name">' + esc(p.name) + '</span>' +
          '<span class="p-studio">' + esc(p.studio || '') + '</span>' +
          '<span class="p-counts">' + (parts.join('') || '<span>작업 없음</span>') + '</span>' +
          '<span class="p-bar"><i style="width:' + pct + '%"></i></span>' +
        '</span>' +
        '<span class="p-pct">' + pct + '%</span>' +
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
    $('platform-label').textContent = '플랫폼 ' + platforms.length + '곳 · 작업 ' + n + '개';
    $('home-view').hidden = false;
    $('detail-view').hidden = true;
  }

  function stepHtml(s) {
    var state = s.state === 'done' || s.state === 'current' ? s.state : 'todo';
    return '<li class="' + state + '"><span class="dot"></span>' +
      '<span class="label">' + esc(s.label) + '</span>' +
      (s.date ? '<span class="t-date">' + esc(s.date) + '</span>' : '') + '</li>';
  }

  function itemCard(it) {
    var st = STATUS[it.status] || { badge: it.status, cls: 'review' };
    var steps = (it.steps || []).map(stepHtml).join('');
    var files = (it.files || []).length
      ? '<p class="i-files">자료 ' + it.files.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(' ') + '</p>'
      : '';
    return '<li class="i-card">' +
      '<div class="i-top"><h3>' + esc(it.title) + '</h3>' +
        '<span class="badge ' + st.cls + '">' + esc(st.badge) + '</span></div>' +
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
    var items = p.items || [];
    var c = countItems(items);
    var visible = items.filter(matches);
    var pct = progress(items);

    var pills = [];
    if (c.user_action) pills.push('<span class="pill"><i class="user"></i>지예 작업/대기 ' + c.user_action + '</span>');
    if (c.review) pills.push('<span class="pill"><i class="review"></i>심사중 ' + c.review + '</span>');
    if (c.approved) pills.push('<span class="pill"><i class="approved"></i>승인 완료 ' + c.approved + '</span>');
    if (c.rejected) pills.push('<span class="pill"><i class="rejected"></i>반려·보완 ' + c.rejected + '</span>');
    pills.push('<span class="pill">진행률 ' + pct + '%</span>');

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

    var body = visible.length
      ? '<ul class="item-list">' + visible.map(itemCard).join('') + '</ul>'
      : '<p class="empty">이 상태의 작업이 없어요.</p>';

    var filterNote = '';
    if (FILTER !== 'all') {
      var label = (FILTERS.filter(function (f) { return f.id === FILTER; })[0] || {}).label || FILTER;
      filterNote = '<p class="filter-note"><span>‘' + esc(label) + '’ ' + visible.length + '개만 보는 중</span>' +
        '<button type="button" data-clear-filter>전체 보기</button></p>';
    }

    $('detail-body').innerHTML = head + filterNote + body;
    $('home-view').hidden = true;
    $('detail-view').hidden = false;

    var clearBtn = $('detail-body').querySelector('[data-clear-filter]');
    if (clearBtn) clearBtn.addEventListener('click', function () { setFilter('all'); });
  }

  function render() {
    if (!DATA) return;
    renderHeader();
    renderStats();
    renderChips();
    if (ROUTE.view === 'detail') renderDetail();
    else renderHome();
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
      render();
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
  netState();
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);
  window.addEventListener('hashchange', parseHash);
  $('back').addEventListener('click', function () { location.hash = '#/'; });
  $('refresh').addEventListener('click', refresh);

  $('platform-list').innerHTML = '<li class="skeleton">불러오는 중…</li>';
  fetchData(false).then(function (json) {
    DATA = json;
    parseHash();
  }).catch(function () {
    $('platform-list').innerHTML = '<li class="skeleton">목록을 불러오지 못했어요. 새로 고침을 눌러 주세요.</li>';
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* ignore */ });
    });
  }
})();
