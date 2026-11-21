/* Ara Ses — YouTube bölümlerini listelerden dinleme ve çalışma sayfasında hazırlama */
(function () {
  'use strict';

  var initialTracks = [
    { title: 'Sen Üzülme', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'R0nANMqcPXY', start: 2074, end: 2146 },
    { title: 'İnci Tanem', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'R0nANMqcPXY', start: 2146, end: 2321 },
    { title: 'Delikanlım', artist: 'Yıldız Tilbe', instrument: 'Belirtilmedi', videoId: 'Sqt_MRyILV4', start: 0, end: 181 },
    { title: 'Kış Güneşi', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'Sqt_MRyILV4', start: 936, end: 1118 }
  ];

  var KEY_STORE = 'araSes.store', KEY_OLD = 'araSes.customTracks', KEY_THEME = 'araSes.theme', KEY_AUTO = 'araSes.autoNext', KEY_SORT = 'araSes.sort';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- depolama ---------- */
  function load(key, fb) { try { var v = localStorage.getItem(key); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function cleanTrack(t) {
    return { id: t.id || uid('t'), title: String(t.title || 'Adsız').slice(0, 200), artist: String(t.artist || '').slice(0, 200),
      instrument: String(t.instrument || 'Belirtilmedi').slice(0, 120), videoId: String(t.videoId), start: +t.start || 0, end: +t.end };
  }
  function validTrack(t) { return t && /^[\w-]{11}$/.test(t.videoId) && isFinite(t.start) && isFinite(t.end) && t.end > t.start; }

  var store = load(KEY_STORE, null);
  if (!store || !Array.isArray(store.lists) || !store.lists.length) {
    var old = load(KEY_OLD, []);
    store = { version: 2, lists: [{ id: 'l-ana', name: 'Ara Ses', tracks: initialTracks.concat(Array.isArray(old) ? old : []).map(cleanTrack) }] };
    store.activeListId = 'l-ana';
    persist();
  }
  function persist() { if (!save(KEY_STORE, store)) showNotice('Tarayıcı depolaması kullanılamıyor; değişiklikler sayfa kapanınca kaybolur.', true); }
  function getList(id) { return store.lists.find(function (l) { return l.id === id; }); }
  function activeList() { var l = getList(store.activeListId); if (!l) { l = store.lists[0]; store.activeListId = l.id; } return l; }

  /* ---------- zaman ---------- */
  function fmt(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function parseTParam(v) {
    if (!v) return null;
    if (/^\d+(\.\d+)?s?$/.test(v)) return parseFloat(v);
    var m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m && (m[1] || m[2] || m[3]) ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : null;
  }
  function parseUrl(str) {
    var u; try { u = new URL(String(str).trim()); } catch (e) { return null; }
    var host = u.hostname.replace(/^(www|m|music)\./, ''), id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (/^youtube(-nocookie)?\.com$/.test(host)) {
      id = u.searchParams.get('v');
      if (!id) { var p = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (p) id = p[1]; }
    } else return null;
    if (id && !/^[\w-]{11}$/.test(id)) id = null;
    var list = u.searchParams.get('list');
    if (list && !/^[\w-]+$/.test(list)) list = null;
    var t = parseTParam(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([^&]+)/) || [])[1]);
    return (id || list) ? { videoId: id, list: list, t: t } : null;
  }
  function parseTime(str) {
    str = String(str || '').trim();
    if (!str) return null;
    if (/^https?:\/\//i.test(str)) { var r = parseUrl(str); return r && r.t !== null ? r.t : null; }
    if (/^\d+([.,]\d+)?$/.test(str)) return parseFloat(str.replace(',', '.'));
    var parts = str.split(':');
    if (parts.length < 2 || parts.length > 3 || !parts.every(function (p) { return /^\d+$/.test(p); })) return null;
    return parts.reduce(function (a, p) { return a * 60 + parseInt(p, 10); }, 0);
  }

  /* ---------- görünüm (sekmeler) ---------- */
  var view = 'dinle';
  function route() {
    var h = location.hash.slice(1);
    setView(h === 'calisma' ? 'calisma' : 'dinle');
  }
  function setView(v) {
    if (v === view && document.body.dataset.view === v) return;
    var leaving = view;
    view = v;
    document.body.dataset.view = v;
    $('view-dinle').hidden = v !== 'dinle';
    $('view-calisma').hidden = v !== 'calisma';
    document.querySelectorAll('.tab').forEach(function (a) { a.classList.toggle('on', a.dataset.tab === v); a.setAttribute('aria-current', a.dataset.tab === v ? 'page' : 'false'); });
    if (leaving !== v && ready) { try { player.pauseVideo(); } catch (e) {} setPlaying(false); previewing = false; }
    if (v === 'calisma') {
      $('placeholder').textContent = 'Bir YouTube bağlantısı açın';
      $('placeholder').hidden = !!draft.videoId;
      if (draft.videoId && ready && loadedId() !== draft.videoId) player.cueVideoById({ videoId: draft.videoId, startSeconds: draft.start || 0 });
      fillListSelect();
    } else {
      $('placeholder').textContent = 'Dinlemek için listeden bir parçaya dokunun';
      $('placeholder').hidden = current >= 0;
      if (current >= 0 && ready && loadedId() !== cur().videoId) player.cueVideoById({ videoId: cur().videoId, startSeconds: cur().start });
      renderLists(); render();
    }
  }
  window.addEventListener('hashchange', route);

  /* ---------- DİNLE: listeler ---------- */
  var list = $('trackList'), bar = $('bar'), seek = $('seek');
  var current = -1, order = [];
  function tracks() { return activeList().tracks; }
  function cur() { return tracks()[current]; }

  function renderLists() {
    $('listSel').innerHTML = store.lists.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === store.activeListId ? ' selected' : '') + '>' + esc(l.name) + ' (' + l.tracks.length + ')</option>';
    }).join('');
    $('deleteListBtn').disabled = store.lists.length < 2;
  }
  $('listSel').addEventListener('change', function () {
    stopListen(); current = -1; resetBar();
    store.activeListId = this.value; persist(); render(); renderLists();
  });
  $('newListBtn').addEventListener('click', function () {
    ask({ title: 'Yeni liste', value: '', ok: 'Oluştur' }, function (name) {
      var l = { id: uid('l'), name: name, tracks: [] };
      store.lists.push(l); store.activeListId = l.id; stopListen(); current = -1; resetBar();
      persist(); renderLists(); render();
    });
  });
  $('renameListBtn').addEventListener('click', function () {
    var l = activeList();
    ask({ title: 'Listeyi yeniden adlandır', value: l.name, ok: 'Kaydet' }, function (name) { l.name = name; persist(); renderLists(); });
  });
  $('deleteListBtn').addEventListener('click', function () {
    var l = activeList();
    if (store.lists.length < 2) return;
    ask({ title: '“' + l.name + '” silinsin mi?', text: l.tracks.length + ' parça da silinecek. Bu işlem geri alınamaz.', input: false, ok: 'Sil' }, function () {
      stopListen(); current = -1; resetBar();
      store.lists = store.lists.filter(function (x) { return x.id !== l.id; });
      store.activeListId = store.lists[0].id; persist(); renderLists(); render();
    });
  });

  function sortedIndexes() {
    var mode = $('sortSel').value, t = tracks(), idx = t.map(function (_, i) { return i; });
    if (mode === 'title' || mode === 'artist') {
      var other = mode === 'title' ? 'artist' : 'title';
      idx.sort(function (a, b) { return t[a][mode].localeCompare(t[b][mode], 'tr') || t[a][other].localeCompare(t[b][other], 'tr'); });
    }
    return idx;
  }
  var ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
  var ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  var ICON_DEL = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function render() {
    var t = tracks();
    order = sortedIndexes();
    var manual = $('sortSel').value === 'order';
    list.innerHTML = order.map(function (i, pos) {
      var x = t[i];
      return '<li class="track' + (i === current ? ' on' : '') + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' +
        esc(x.title + ', ' + x.artist + ', ' + fmt(x.end - x.start)) + '">' +
        '<span class="no">' + (pos + 1) + '</span>' +
        '<div><div class="t">' + esc(x.title) + '</div><div class="a">' + esc(x.artist) + '</div>' +
        '<span class="inst">' + esc(x.instrument || 'Belirtilmedi') + '</span></div>' +
        '<div class="right"><span class="dur">' + fmt(x.end - x.start) + '</span><span class="acts">' +
        (manual && pos > 0 ? '<button class="act" type="button" data-act="up" aria-label="' + esc(x.title) + ' yukarı taşı">' + ICON_UP + '</button>' : '') +
        '<button class="act" type="button" data-act="edit" aria-label="' + esc(x.title) + ' düzenle">' + ICON_EDIT + '</button>' +
        '<button class="act" type="button" data-act="del" aria-label="' + esc(x.title) + ' listeden çıkar">' + ICON_DEL + '</button>' +
        '</span></div></li>';
    }).join('');
    var total = t.reduce(function (s, x) { return s + (x.end - x.start); }, 0);
    $('summary').textContent = t.length + ' parça · toplam ' + fmt(total);
    $('emptyList').hidden = t.length > 0;
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'), li = e.target.closest('.track');
    if (!li) return;
    var i = +li.dataset.i;
    if (!b) { playIndex(i); return; }
    e.stopPropagation();
    var t = tracks(), x = t[i], playingId = cur() ? cur().id : null;
    if (b.dataset.act === 'del') {
      ask({ title: '“' + x.title + '” listeden çıkarılsın mı?', input: false, ok: 'Çıkar' }, function () {
        if (playingId === x.id) { stopListen(); resetBar(); }
        t.splice(i, 1); persist();
        current = playingId && playingId !== x.id ? t.findIndex(function (y) { return y.id === playingId; }) : -1;
        render(); renderLists();
      });
    } else if (b.dataset.act === 'up' && i > 0) {
      t.splice(i - 1, 0, t.splice(i, 1)[0]); persist();
      current = playingId ? t.findIndex(function (y) { return y.id === playingId; }) : -1;
      render();
    } else if (b.dataset.act === 'edit') {
      loadDraftFromTrack(activeList().id, x);
      location.hash = 'calisma';
    }
  });
  list.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('track')) { e.preventDefault(); playIndex(+e.target.dataset.i); }
  });

  /* ---------- YouTube oynatıcı (iki sayfa ortak) ---------- */
  var player = null, ready = false, playing = false, seeking = false, pending = null;
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: function () { ready = true; if (pending) { var p = pending; pending = null; p(); } },
        onStateChange: onState, onError: onError
      }
    });
  };
  (function () {
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { showNotice('YouTube oynatıcısı yüklenemedi. Bağlantınızı kontrol edin.', true); };
    document.head.appendChild(s);
  })();
  function whenReady(fn) { if (ready) fn(); else { pending = fn; showNotice('Oynatıcı hazırlanıyor…'); } }
  function loadedId() { try { return player.getVideoData().video_id; } catch (e) { return null; } }
  function ytUrl(id, t) { return 'https://www.youtube.com/watch?v=' + id + '&t=' + Math.floor(t || 0) + 's'; }

  function onState(e) {
    var S = YT.PlayerState;
    if (e.data === S.PLAYING) { setPlaying(true); hideNotice(); }
    else if (e.data === S.PAUSED || e.data === S.CUED) setPlaying(false);
    else if (e.data === S.ENDED) { if (view === 'dinle') finishSection(); else { setPlaying(false); previewing = false; } }
    if (view === 'calisma' && (e.data === S.PLAYING || e.data === S.CUED)) onWorkVideoInfo();
  }
  function onError(e) {
    setPlaying(false);
    var id = view === 'dinle' ? (cur() && cur().videoId) : draft.videoId;
    var t = view === 'dinle' ? (cur() && cur().start) : draft.start;
    var msg = (e.data === 101 || e.data === 150) ? 'Bu video sahibinin isteğiyle gömülü oynatmaya kapalı.'
      : e.data === 100 ? 'Video bulunamadı, kaldırılmış ya da gizli.' : 'Video oynatılamadı (hata ' + e.data + ').';
    showNotice(msg + (id ? ' <a href="' + ytUrl(id, t) + '" target="_blank" rel="noopener">YouTube’da ' + fmt(t || 0) + '’dan aç</a>' : ''), true);
  }
  function setPlaying(v) {
    playing = v; bar.classList.toggle('playing', v);
    $('playBtn').setAttribute('aria-label', v ? 'Duraklat' : 'Oynat');
    $('wPlay').textContent = v ? 'Duraklat' : 'Oynat';
  }

  /* ---------- DİNLE: oynatma ---------- */
  function playIndex(i) {
    var t = tracks()[i]; if (!t) return;
    current = i;
    $('notice').hidden = true; $('notice').dataset.keep = '';
    $('placeholder').hidden = true;
    updateNow(); render();
    whenReady(function () { player.loadVideoById({ videoId: t.videoId, startSeconds: t.start, endSeconds: t.end }); });
  }
  var finishing = false;
  function finishSection() {
    if (finishing || current < 0) return;
    finishing = true;
    var t = cur();
    try { player.pauseVideo(); player.seekTo(t.start, true); player.pauseVideo(); } catch (err) {}
    setPlaying(false); paint(t.start);
    var pos = order.indexOf(current);
    setTimeout(function () {
      finishing = false;
      if ($('autoNext').checked && view === 'dinle' && pos >= 0 && pos < order.length - 1) playIndex(order[pos + 1]);
    }, 300);
  }
  function stopListen() {
    if (!ready || current < 0 || !cur()) return;
    var t = cur();
    try { player.pauseVideo(); player.seekTo(t.start, true); player.pauseVideo(); } catch (e) {}
    setPlaying(false); paint(t.start);
  }
  function paint(now) {
    var t = cur(); if (!t) return;
    var rel = Math.min(Math.max(now - t.start, 0), t.end - t.start);
    seek.value = Math.floor(rel);
    $('elapsed').textContent = fmt(rel);
  }
  function updateNow() {
    var t = cur();
    $('nowTitle').textContent = t.title;
    $('nowMeta').textContent = t.artist + ' · ' + (t.instrument || 'Belirtilmedi') + ' · ' + fmt(t.start) + '–' + fmt(t.end);
    $('total').textContent = fmt(t.end - t.start); $('elapsed').textContent = '0:00';
    seek.max = Math.floor(t.end - t.start); seek.value = 0; seek.disabled = false;
    var a = $('ytLink'); a.href = ytUrl(t.videoId, t.start); a.hidden = false;
    document.title = t.title + ' · Ara Ses';
  }
  function resetBar() {
    current = -1;
    $('nowTitle').textContent = 'Parça seçilmedi'; $('nowMeta').textContent = '';
    $('elapsed').textContent = $('total').textContent = '0:00';
    seek.value = 0; seek.max = 0; seek.disabled = true; $('ytLink').hidden = true;
    if (view === 'dinle') $('placeholder').hidden = false;
    document.title = 'Ara Ses';
  }

  $('playBtn').addEventListener('click', function () {
    if (current < 0) { if (order.length) playIndex(order[0]); return; }
    if (!ready) return;
    var t = cur();
    if (playing) { player.pauseVideo(); return; }
    if (loadedId() !== t.videoId) { playIndex(current); return; }
    var now = player.getCurrentTime();
    if (now >= t.end - 0.5 || now < t.start - 1) player.seekTo(t.start, true);
    player.playVideo();
  });
  $('stopBtn').addEventListener('click', stopListen);
  $('restartBtn').addEventListener('click', function () {
    if (current < 0 || !ready) return;
    if (loadedId() !== cur().videoId) { playIndex(current); return; }
    player.seekTo(cur().start, true); player.playVideo(); paint(cur().start);
  });
  $('prevBtn').addEventListener('click', function () {
    if (!order.length) return;
    var pos = order.indexOf(current);
    if (ready && current >= 0 && loadedId() === cur().videoId && player.getCurrentTime() - cur().start > 3) { player.seekTo(cur().start, true); return; }
    playIndex(order[pos <= 0 ? order.length - 1 : pos - 1]);
  });
  $('nextBtn').addEventListener('click', function () {
    if (!order.length) return;
    var pos = order.indexOf(current);
    playIndex(order[pos < 0 || pos >= order.length - 1 ? 0 : pos + 1]);
  });
  seek.addEventListener('input', function () { seeking = true; $('elapsed').textContent = fmt(+seek.value); });
  seek.addEventListener('change', function () {
    seeking = false;
    if (current < 0 || !ready) return;
    var t = cur();
    player.seekTo(Math.min(t.start + (+seek.value), t.end - 0.5), true);
    if (!playing) player.playVideo();
  });

  /* ---------- ortak zamanlayıcı: bitiş denetimi + saat ---------- */
  setInterval(function () {
    if (!ready || !player.getCurrentTime) return;
    var now = player.getCurrentTime();
    if (view === 'dinle') {
      var t = cur(); if (!t || loadedId() !== t.videoId) return;
      if (playing && now >= t.end - 0.2) { finishSection(); return; }
      if (playing && now < t.start - 1.5) { player.seekTo(t.start, true); now = t.start; }
      if (!seeking) paint(now);
    } else {
      $('wNow').textContent = fmt(Math.floor(now));
      if (previewing && playing && draft.end != null && now >= draft.end - 0.2) {
        player.pauseVideo(); previewing = false; showNotice('Bölüm sonu (' + fmt(draft.end) + ').');
      }
    }
  }, 250);

  /* ---------- ÇALIŞMA ---------- */
  var draft = { videoId: null, start: null, end: null, editing: null };
  var previewing = false, plIds = [];

  function fillListSelect(selectId) {
    var sel = $('wList'), keep = selectId || sel.value || (draft.editing && draft.editing.listId) || store.activeListId;
    sel.innerHTML = store.lists.map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>'; }).join('') +
      '<option value="__new">+ Yeni liste…</option>';
    sel.value = getList(keep) ? keep : store.lists[0].id;
    $('newListInline').hidden = sel.value !== '__new';
  }
  $('wList').addEventListener('change', function () {
    $('newListInline').hidden = this.value !== '__new';
    if (this.value === '__new') $('wNewList').focus();
  });

  function openVideo(id, start, keepFields) {
    draft.videoId = id;
    if (!keepFields) { $('wTitle').value = ''; $('wArtist').value = ''; autoFilled = false; }
    $('placeholder').hidden = true; $('notice').hidden = true; $('notice').dataset.keep = '';
    whenReady(function () {
      hideNotice();
      if (start != null && start > 0) player.loadVideoById({ videoId: id, startSeconds: start });
      else player.cueVideoById({ videoId: id });
    });
    fetchTitle(id, function (info) {
      if (!info || draft.videoId !== id) return;
      if (!$('wTitle').value) { $('wTitle').value = cleanTitle(info.title); autoFilled = true; }
      if (!$('wArtist').value && info.author_name) $('wArtist').value = info.author_name.replace(/\s*-\s*Topic$/i, '');
    });
  }
  var autoFilled = false;
  function cleanTitle(t) { return String(t || '').replace(/\s*[\(\[][^)\]]*(official|video|audio|lyric|klip|hd|4k)[^)\]]*[\)\]]/ig, '').trim(); }
  var titleCache = {};
  function fetchTitle(id, cb) {
    if (titleCache[id]) { cb(titleCache[id]); return; }
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) titleCache[id] = j; cb(j); })
      .catch(function () { cb(null); });
  }
  function onWorkVideoInfo() {
    var d; try { d = player.getVideoData(); } catch (e) { return; }
    var dur = player.getDuration ? player.getDuration() : 0;
    $('wDur').textContent = dur ? '/ ' + fmt(dur) : '';
    if (d && d.video_id && d.video_id !== draft.videoId && plIds.length) { draft.videoId = d.video_id; markPl(); }
    if (d && d.title && !$('wTitle').value) { $('wTitle').value = cleanTitle(d.title); autoFilled = true; }
    if (d && d.author && !$('wArtist').value) $('wArtist').value = d.author.replace(/\s*-\s*Topic$/i, '');
    if (plIds.length === 0 && plPendingList) readPlaylist();
  }

  var plPendingList = null;
  $('srcForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = parseUrl($('srcUrl').value);
    if (!r) { msg('wMsg', 'Bu bir YouTube bağlantısı gibi görünmüyor.', true); return; }
    msg('wMsg', '');
    if (draft.editing) exitEdit();
    plIds = []; $('plBox').hidden = true;
    if (r.list && !/^(RD|UL|LL|LM|WL)/.test(r.list)) {
      plPendingList = r.list;
      $('placeholder').hidden = true;
      whenReady(function () {
        hideNotice();
        player.cuePlaylist({ listType: 'playlist', list: r.list, index: 0 });
        setTimeout(readPlaylist, 1500);
      });
      if (r.videoId) { draft.videoId = r.videoId; }
      if (r.t != null) $('wStart').value = fmt(r.t);
      return;
    }
    if (r.list && !r.videoId) { msg('wMsg', 'Bu liste türü (Beğenilenler, Mix, Daha sonra izle) gömülü oynatıcıda açılamıyor. Listeden bir videonun bağlantısını yapıştırın.', true); return; }
    if (r.t != null) { $('wStart').value = fmt(r.t); draft.start = r.t; }
    openVideo(r.videoId, r.t);
    updateLen();
  });

  function readPlaylist(tries) {
    if (!plPendingList) return;
    tries = tries || 0;
    var ids = []; try { ids = player.getPlaylist() || []; } catch (e) {}
    if (!ids.length) {
      if (tries < 8) setTimeout(function () { readPlaylist(tries + 1); }, 800);
      else { plPendingList = null; showNotice('Oynatma listesi okunamadı. Liste gizli olabilir; herkese açık ya da liste dışı yapın veya tek tek video bağlantısı yapıştırın.', true); }
      return;
    }
    plPendingList = null;
    plIds = ids;
    $('plBox').hidden = false;
    $('plCount').textContent = ids.length + ' video';
    $('plItems').innerHTML = ids.map(function (id, i) {
      return '<li data-id="' + esc(id) + '" tabindex="0"><span class="n">' + (i + 1) + '</span><span class="pt" id="pt-' + esc(id) + '">' + esc(id) + '</span></li>';
    }).join('');
    ids.slice(0, 200).forEach(function (id, i) {
      setTimeout(function () { fetchTitle(id, function (j) { var el = document.getElementById('pt-' + id); if (el && j) el.textContent = j.title; }); }, i * 60);
    });
    var want = draft.videoId && ids.indexOf(draft.videoId) >= 0 ? draft.videoId : ids[0];
    selectPl(want, true);
  }
  function selectPl(id, quiet) {
    var keep = quiet && $('wStart').value;
    if (!keep) { $('wStart').value = ''; $('wEnd').value = ''; draft.start = draft.end = null; }
    openVideo(id, keep ? parseTime($('wStart').value) : null);
    markPl(); updateLen();
  }
  function markPl() {
    document.querySelectorAll('#plItems li').forEach(function (li) { li.classList.toggle('on', li.dataset.id === draft.videoId); });
  }
  $('plItems').addEventListener('click', function (e) { var li = e.target.closest('li'); if (li) selectPl(li.dataset.id); });
  $('plItems').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var li = e.target.closest('li'); if (li) selectPl(li.dataset.id); } });

  function needVideo() { if (!draft.videoId || !ready) { msg('wMsg', 'Önce bir video açın.', true); return false; } return true; }
  $('wPlay').addEventListener('click', function () {
    if (!needVideo()) return;
    previewing = false;
    if (playing) player.pauseVideo(); else player.playVideo();
  });
  document.querySelectorAll('[data-nudge]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!needVideo()) return;
      player.seekTo(Math.max(0, player.getCurrentTime() + (+b.dataset.nudge)), true);
    });
  });
  $('setStart').addEventListener('click', function () { if (!needVideo()) return; $('wStart').value = fmt(Math.floor(player.getCurrentTime())); syncMarks(); });
  $('setEnd').addEventListener('click', function () { if (!needVideo()) return; $('wEnd').value = fmt(Math.ceil(player.getCurrentTime())); syncMarks(); });
  $('goStart').addEventListener('click', function () { syncMarks(); if (!needVideo() || draft.start == null) return; previewing = false; player.seekTo(draft.start, true); player.playVideo(); });
  $('goEnd').addEventListener('click', function () { syncMarks(); if (!needVideo() || draft.end == null) return; previewing = true; player.seekTo(Math.max(0, draft.end - 5), true); player.playVideo(); });
  $('wPreview').addEventListener('click', function () {
    syncMarks(); if (!needVideo()) return;
    if (draft.start == null || draft.end == null || draft.end <= draft.start) { msg('wMsg', 'Önce geçerli bir başlangıç ve bitiş belirleyin.', true); return; }
    previewing = true; player.seekTo(draft.start, true); player.playVideo();
  });
  ['wStart', 'wEnd'].forEach(function (id) { $(id).addEventListener('input', syncMarks); $(id).addEventListener('change', syncMarks); });
  function syncMarks() {
    draft.start = parseTime($('wStart').value);
    draft.end = parseTime($('wEnd').value);
    updateLen();
  }
  function updateLen() {
    var s = draft.start, e = draft.end;
    $('wLen').textContent = s != null && e != null ? (e > s ? 'Süre: ' + fmt(e - s) : 'Bitiş başlangıçtan sonra olmalı.') : '';
  }

  function loadDraftFromTrack(listId, t) {
    draft.editing = { listId: listId, trackId: t.id };
    $('srcUrl').value = 'https://youtu.be/' + t.videoId + '?t=' + Math.floor(t.start);
    $('wStart').value = fmt(t.start); $('wEnd').value = fmt(t.end);
    $('wTitle').value = t.title; $('wArtist').value = t.artist; $('wInst').value = t.instrument === 'Belirtilmedi' ? '' : t.instrument;
    plIds = []; $('plBox').hidden = true;
    fillListSelect(listId);
    $('wSave').textContent = 'Değişiklikleri kaydet'; $('wSaveNew').hidden = false;
    msg('wMsg', '“' + t.title + '” düzenleniyor.');
    syncMarks();
    if (view === 'calisma') openVideo(t.videoId, t.start, true);
    else { draft.videoId = t.videoId; pendingOpen = t.start; }
  }
  var pendingOpen = null;
  window.addEventListener('hashchange', function () {
    if (view === 'calisma' && pendingOpen != null && draft.videoId) { var s = pendingOpen; pendingOpen = null; openVideo(draft.videoId, s, true); }
  });
  function exitEdit() { draft.editing = null; $('wSave').textContent = 'Listeye ekle'; $('wSaveNew').hidden = true; }

  function saveDraft(asNew) {
    syncMarks();
    var title = $('wTitle').value.trim(), artist = $('wArtist').value.trim(), inst = $('wInst').value.trim() || 'Belirtilmedi';
    var err = !draft.videoId ? 'Önce bir video açın.' : !title ? 'Parça adı gerekli.' :
      draft.start == null ? 'Başlangıç anlaşılamadı (örnek: 125 ya da 2:05).' : draft.end == null ? 'Bitiş anlaşılamadı (örnek: 340 ya da 5:40).' :
      draft.end <= draft.start ? 'Bitiş, başlangıçtan sonra olmalı.' : '';
    var listId = $('wList').value, target;
    if (!err && listId === '__new') {
      var nm = $('wNewList').value.trim();
      if (!nm) err = 'Yeni listenin adını yazın.';
      else { target = { id: uid('l'), name: nm, tracks: [] }; store.lists.push(target); }
    } else target = getList(listId);
    if (err) { msg('wMsg', err, true); return; }
    var data = cleanTrack({ title: title, artist: artist, instrument: inst, videoId: draft.videoId, start: draft.start, end: draft.end });
    if (draft.editing && !asNew) {
      var from = getList(draft.editing.listId), idx = from ? from.tracks.findIndex(function (x) { return x.id === draft.editing.trackId; }) : -1;
      if (idx >= 0) {
        data.id = draft.editing.trackId;
        if (from === target) from.tracks[idx] = data;
        else { from.tracks.splice(idx, 1); target.tracks.push(data); if (from === activeList()) resetBar(); }
      } else target.tracks.push(data);
      msg('wMsg', '“' + title + '” güncellendi (' + target.name + ').');
      exitEdit();
    } else {
      target.tracks.push(data);
      msg('wMsg', '“' + title + '” ' + target.name + ' listesine eklendi (' + fmt(data.end - data.start) + ').');
    }
    persist(); fillListSelect(target.id); $('wNewList').value = '';
    // aynı videodan sonraki bölüm için: başlangıcı eski bitişe taşı
    $('wStart').value = fmt(data.end); $('wEnd').value = ''; $('wTitle').value = ''; syncMarks();
  }
  $('wSave').addEventListener('click', function () { saveDraft(false); });
  $('wSaveNew').addEventListener('click', function () { saveDraft(true); });
  $('wReset').addEventListener('click', function () {
    exitEdit(); ['srcUrl', 'wStart', 'wEnd', 'wTitle', 'wArtist', 'wInst', 'wNewList'].forEach(function (id) { $(id).value = ''; });
    draft.videoId = null; syncMarks(); plIds = []; $('plBox').hidden = true; msg('wMsg', '');
    if (ready) try { player.stopVideo(); } catch (e) {}
    $('placeholder').hidden = false; $('wDur').textContent = ''; $('wNow').textContent = '0:00';
  });

  /* ---------- yedekleme ---------- */
  function exportText() { return JSON.stringify({ app: 'ara-ses', version: 2, exported: new Date().toISOString(), lists: store.lists }, null, 1); }
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([exportText()], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'ara-ses-listeler-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    msg('dataMsg', 'Dosya indirildi.');
  });
  $('copyBtn').addEventListener('click', function () {
    navigator.clipboard.writeText(exportText()).then(function () { msg('dataMsg', 'Panoya kopyalandı. Diğer cihazda “Metin yapıştırarak içe aktar”ı kullanın.'); },
      function () { $('importText').value = exportText(); $('importText').closest('details').open = true; msg('dataMsg', 'Kopyalanamadı; metin aşağıdaki kutuya kondu, elle kopyalayın.', true); });
  });
  $('importFile').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(importData); this.value = '';
  });
  $('importTextBtn').addEventListener('click', function () { importData($('importText').value); });
  function importData(text) {
    var j; try { j = JSON.parse(text); } catch (e) { msg('dataMsg', 'Dosya okunamadı: geçerli JSON değil.', true); return; }
    var lists = Array.isArray(j) ? j : j && j.lists;
    if (!Array.isArray(lists)) { msg('dataMsg', 'Bu dosyada Ara Ses listesi bulunamadı.', true); return; }
    var added = 0, tr = 0;
    lists.forEach(function (l) {
      if (!l || !Array.isArray(l.tracks)) return;
      var tracksIn = l.tracks.map(cleanTrack).filter(validTrack);
      var name = String(l.name || 'İçe aktarılan').slice(0, 120);
      var existing = store.lists.find(function (x) { return x.name === name; });
      if (existing) {
        tracksIn.forEach(function (t) {
          if (!existing.tracks.some(function (x) { return x.videoId === t.videoId && x.start === t.start && x.end === t.end; })) { t.id = uid('t'); existing.tracks.push(t); tr++; }
        });
      } else { store.lists.push({ id: uid('l'), name: name, tracks: tracksIn.map(function (t) { t.id = uid('t'); return t; }) }); added++; tr += tracksIn.length; }
    });
    persist(); renderLists(); render(); $('importText').value = '';
    msg('dataMsg', added + ' yeni liste, toplam ' + tr + ' parça eklendi. Aynı adlı listeler birleştirildi.');
  }

  /* ---------- diyalog ---------- */
  var dlgCb = null;
  function ask(o, cb) {
    var d = $('dlg');
    $('dlgTitle').textContent = o.title; $('dlgText').textContent = o.text || '';
    $('dlgInput').hidden = o.input === false; $('dlgInput').value = o.value || ''; $('dlgInput').required = o.input !== false;
    $('dlgOk').textContent = o.ok || 'Tamam';
    $('dlgOk').classList.toggle('danger', /Sil|Çıkar/.test(o.ok || ''));
    dlgCb = cb;
    if (d.showModal) { d.showModal(); if (o.input !== false) setTimeout(function () { $('dlgInput').select(); }, 30); }
  }
  $('dlgInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (this.value.trim()) $('dlg').close('ok'); }
  });
  $('dlg').addEventListener('close', function () {
    var cb = dlgCb; dlgCb = null;
    if (this.returnValue !== 'ok' || !cb) return;
    if ($('dlgInput').hidden) cb(); else { var v = $('dlgInput').value.trim(); if (v) cb(v.slice(0, 120)); }
  });

  /* ---------- tema, ayarlar, mesajlar ---------- */
  $('themeBtn').addEventListener('click', function () {
    var root = document.documentElement;
    var c = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.theme = c === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY_THEME, root.dataset.theme); } catch (e) {}
  });
  $('autoNext').checked = load(KEY_AUTO, true);
  $('autoNext').addEventListener('change', function () { save(KEY_AUTO, this.checked); });
  $('sortSel').value = load(KEY_SORT, 'order');
  $('sortSel').addEventListener('change', function () { save(KEY_SORT, this.value); render(); });

  function msg(id, text, err) { var el = $(id); el.textContent = text; el.className = 'form-msg' + (err ? ' err' : ''); }
  function showNotice(html, keep) { var n = $('notice'); n.innerHTML = html; n.hidden = false; n.dataset.keep = keep ? '1' : ''; }
  function hideNotice() { var n = $('notice'); if (n.dataset.keep !== '1' || playing) { n.hidden = true; n.dataset.keep = ''; } }

  view = '';
  renderLists(); fillListSelect(); route();
})();
