/* Ara Ses — YouTube bölümlerini tek listeden dinleme */
(function () {
  'use strict';

  var initialTracks = [
    { title: 'Sen Üzülme', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'R0nANMqcPXY', start: 2074, end: 2146 },
    { title: 'İnci Tanem', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'R0nANMqcPXY', start: 2146, end: 2321 },
    { title: 'Delikanlım', artist: 'Yıldız Tilbe', instrument: 'Belirtilmedi', videoId: 'Sqt_MRyILV4', start: 0, end: 181 },
    { title: 'Kış Güneşi', artist: 'Tarkan', instrument: 'Saksafon (Jazz)', videoId: 'Sqt_MRyILV4', start: 936, end: 1118 }
  ];

  var KEY_TRACKS = 'araSes.customTracks';
  var KEY_THEME = 'araSes.theme';
  var KEY_AUTO = 'araSes.autoNext';
  var KEY_SORT = 'araSes.sort';

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* depolama yoksa sessizce geç */ }
  }

  var custom = load(KEY_TRACKS, []);
  if (!Array.isArray(custom)) custom = [];
  var tracks = [];
  function rebuild() {
    tracks = initialTracks.map(function (t, i) { return Object.assign({ id: 'i' + i, custom: false }, t); })
      .concat(custom.map(function (t) { return Object.assign({ custom: true }, t); }));
  }
  rebuild();

  var $ = function (id) { return document.getElementById(id); };
  var list = $('trackList'), bar = $('bar'), seek = $('seek');
  var player = null, ready = false, current = -1, playing = false, seeking = false, pendingIndex = -1;
  var order = [];

  /* ---------- zaman yardımcıları ---------- */
  function fmt(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(x).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function parseTParam(v) {
    if (!v) return null;
    if (/^\d+(\.\d+)?s?$/.test(v)) return parseFloat(v);
    var m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    return null;
  }
  function parseUrl(str) {
    var u;
    try { u = new URL(str.trim()); } catch (e) { return null; }
    var host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    var id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (/youtube(-nocookie)?\.com$/.test(host)) {
      id = u.searchParams.get('v');
      if (!id) { var p = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (p) id = p[1]; }
    }
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    var t = parseTParam(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([^&]+)/) || [])[1]);
    return { videoId: id, t: t };
  }
  function parseTime(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (/^https?:\/\//i.test(str)) { var r = parseUrl(str); return r && r.t !== null ? r.t : null; }
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
    var parts = str.split(':');
    if (parts.length < 2 || parts.length > 3 || !parts.every(function (p) { return /^\d+$/.test(p); })) return null;
    return parts.reduce(function (acc, p) { return acc * 60 + parseInt(p, 10); }, 0);
  }

  /* ---------- liste ---------- */
  function sortedIndexes() {
    var mode = $('sortSel').value;
    var idx = tracks.map(function (_, i) { return i; });
    if (mode === 'title' || mode === 'artist') {
      var other = mode === 'title' ? 'artist' : 'title';
      idx.sort(function (a, b) {
        return tracks[a][mode].localeCompare(tracks[b][mode], 'tr') || tracks[a][other].localeCompare(tracks[b][other], 'tr');
      });
    }
    return idx;
  }
  function render() {
    order = sortedIndexes();
    list.innerHTML = order.map(function (i, pos) {
      var t = tracks[i];
      return '<li class="track' + (i === current ? ' on' : '') + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' +
        esc(t.title + ', ' + t.artist + ', ' + fmt(t.end - t.start)) + '">' +
        '<span class="no">' + (pos + 1) + '</span>' +
        '<div><div class="t">' + esc(t.title) + '</div><div class="a">' + esc(t.artist) + '</div>' +
        '<span class="inst">' + esc(t.instrument || 'Belirtilmedi') + '</span></div>' +
        '<div class="right"><span class="dur">' + fmt(t.end - t.start) + '</span>' +
        (t.custom ? '<button class="del" type="button" data-del="' + esc(t.id) + '" aria-label="' + esc(t.title) + ' parçasını sil">×</button>' : '') +
        '</div></li>';
    }).join('');
    var total = tracks.reduce(function (s, t) { return s + (t.end - t.start); }, 0);
    $('summary').textContent = tracks.length + ' parça · toplam ' + fmt(total);
  }

  list.addEventListener('click', function (e) {
    var d = e.target.closest('[data-del]');
    if (d) { e.stopPropagation(); removeCustom(d.getAttribute('data-del')); return; }
    var li = e.target.closest('.track');
    if (li) playIndex(+li.dataset.i);
  });
  list.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('track')) { e.preventDefault(); playIndex(+e.target.dataset.i); }
  });

  function removeCustom(id) {
    var playingId = current >= 0 ? tracks[current].id : null;
    custom = custom.filter(function (t) { return t.id !== id; });
    save(KEY_TRACKS, custom);
    rebuild();
    if (playingId === id) { stop(); current = -1; resetBar(); }
    else current = tracks.findIndex(function (t) { return t.id === playingId; });
    render();
  }

  /* ---------- YouTube oynatıcı ---------- */
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: function () { ready = true; if (pendingIndex >= 0) { var p = pendingIndex; pendingIndex = -1; playIndex(p); } },
        onStateChange: onState,
        onError: onError
      }
    });
  };
  (function () {
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { showNotice('YouTube oynatıcısı yüklenemedi. Bağlantınızı kontrol edin ya da parçayı YouTube’da açın.', true); };
    document.head.appendChild(s);
  })();

  function ytUrl(t) { return 'https://www.youtube.com/watch?v=' + t.videoId + '&t=' + Math.floor(t.start) + 's'; }

  function playIndex(i) {
    if (i < 0 || i >= tracks.length) return;
    current = i;
    var t = tracks[i];
    $('notice').hidden = true; $('notice').dataset.keep = '';
    $('placeholder').hidden = true;
    updateNow();
    render();
    if (!ready) { pendingIndex = i; showNotice('Oynatıcı hazırlanıyor…'); return; }
    player.loadVideoById({ videoId: t.videoId, startSeconds: t.start, endSeconds: t.end });
  }

  function onState(e) {
    var S = YT.PlayerState;
    if (e.data === S.PLAYING) { setPlaying(true); hideNotice(); }
    else if (e.data === S.PAUSED || e.data === S.CUED) setPlaying(false);
    else if (e.data === S.ENDED) finishSection();
  }

  function onError(e) {
    setPlaying(false);
    var t = tracks[current];
    var msg = (e.data === 101 || e.data === 150)
      ? 'Bu video sahibinin isteğiyle gömülü oynatmaya kapalı.'
      : e.data === 100 ? 'Video bulunamadı ya da kaldırılmış.' : 'Video oynatılamadı (hata ' + e.data + ').';
    showNotice(msg + (t ? ' <a href="' + ytUrl(t) + '" target="_blank" rel="noopener">YouTube’da ' + fmt(t.start) + '’dan aç</a>' : ''), true);
  }

  function setPlaying(v) { playing = v; bar.classList.toggle('playing', v); $('playBtn').setAttribute('aria-label', v ? 'Duraklat' : 'Oynat'); }

  var finishing = false;
  function finishSection() {
    if (finishing || current < 0) return;
    finishing = true;
    var t = tracks[current];
    try { player.pauseVideo(); player.seekTo(t.start, true); player.pauseVideo(); } catch (err) {}
    setPlaying(false);
    paint(t.start);
    var pos = order.indexOf(current);
    setTimeout(function () {
      finishing = false;
      if ($('autoNext').checked && pos >= 0 && pos < order.length - 1) playIndex(order[pos + 1]);
    }, 300);
  }

  /* Bitiş denetimi: kullanıcı YouTube çubuğuyla atlarsa endSeconds devre dışı kalabilir. */
  setInterval(function () {
    if (!ready || current < 0 || !player.getCurrentTime) return;
    var t = tracks[current], now = player.getCurrentTime();
    var vid = (player.getVideoData && player.getVideoData().video_id) || t.videoId;
    if (vid !== t.videoId) return;
    if (playing && now >= t.end - 0.2) { finishSection(); return; }
    if (playing && now < t.start - 1.5) { player.seekTo(t.start, true); now = t.start; }
    if (!seeking) paint(now);
  }, 250);

  function paint(now) {
    var t = tracks[current]; if (!t) return;
    var rel = Math.min(Math.max(now - t.start, 0), t.end - t.start);
    seek.value = Math.floor(rel);
    seek.style.setProperty('--p', (rel / (t.end - t.start) * 100) + '%');
    $('elapsed').textContent = fmt(rel);
  }

  function updateNow() {
    var t = tracks[current];
    $('nowTitle').textContent = t.title;
    $('nowMeta').textContent = t.artist + ' · ' + (t.instrument || 'Belirtilmedi') + ' · ' + fmt(t.start) + '–' + fmt(t.end);
    $('total').textContent = fmt(t.end - t.start);
    $('elapsed').textContent = '0:00';
    seek.max = Math.floor(t.end - t.start); seek.value = 0; seek.disabled = false;
    var a = $('ytLink'); a.href = ytUrl(t); a.hidden = false;
    document.title = t.title + ' · Ara Ses';
  }
  function resetBar() {
    $('nowTitle').textContent = 'Parça seçilmedi'; $('nowMeta').textContent = '';
    $('elapsed').textContent = $('total').textContent = '0:00';
    seek.value = 0; seek.max = 0; seek.disabled = true; $('ytLink').hidden = true;
    $('placeholder').hidden = false; document.title = 'Ara Ses';
  }

  function stop() {
    if (!ready || current < 0) return;
    var t = tracks[current];
    try { player.pauseVideo(); player.seekTo(t.start, true); player.pauseVideo(); } catch (e) {}
    setPlaying(false); paint(t.start);
  }

  /* ---------- kontroller ---------- */
  $('playBtn').addEventListener('click', function () {
    if (current < 0) { playIndex(order[0]); return; }
    if (!ready) return;
    var t = tracks[current];
    var vid = player.getVideoData && player.getVideoData().video_id;
    if (playing) { player.pauseVideo(); return; }
    if (vid !== t.videoId) { playIndex(current); return; }
    var now = player.getCurrentTime();
    if (now >= t.end - 0.5 || now < t.start - 1) player.seekTo(t.start, true);
    player.playVideo();
  });
  $('stopBtn').addEventListener('click', stop);
  $('restartBtn').addEventListener('click', function () {
    if (current < 0 || !ready) return;
    player.seekTo(tracks[current].start, true); player.playVideo(); paint(tracks[current].start);
  });
  $('prevBtn').addEventListener('click', function () {
    if (!order.length) return;
    var pos = order.indexOf(current);
    if (ready && current >= 0 && player.getCurrentTime() - tracks[current].start > 3) { player.seekTo(tracks[current].start, true); return; }
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
    var t = tracks[current];
    var target = Math.min(t.start + (+seek.value), t.end - 0.5);
    player.seekTo(target, true);
    if (!playing) player.playVideo();
  });

  /* ---------- tema ---------- */
  $('themeBtn').addEventListener('click', function () {
    var root = document.documentElement;
    var cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(KEY_THEME, next); } catch (e) {}
  });

  /* ---------- ayarlar ---------- */
  $('autoNext').checked = load(KEY_AUTO, true);
  $('autoNext').addEventListener('change', function () { save(KEY_AUTO, this.checked); });
  $('sortSel').value = load(KEY_SORT, 'order');
  $('sortSel').addEventListener('change', function () { save(KEY_SORT, this.value); render(); });

  /* ---------- parça ekle ---------- */
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, msg = $('formMsg');
    var title = f.title.value.trim(), artist = f.artist.value.trim();
    var instrument = f.instrument.value.trim() || 'Belirtilmedi';
    var link = parseUrl(f.url.value);
    var err = '';
    if (!title || !artist) err = 'Parça adı ve sanatçı gerekli.';
    else if (!link) err = 'Geçerli bir YouTube bağlantısı girin.';
    var start = f.start.value.trim() ? parseTime(f.start.value) : (link && link.t !== null ? link.t : 0);
    var end = parseTime(f.end.value);
    if (!err && start === null) err = 'Başlangıç anlaşılamadı. Örnek: 125, 2:05 veya zaman damgalı bağlantı.';
    else if (!err && end === null) err = 'Bitiş anlaşılamadı. Örnek: 340, 5:40 veya zaman damgalı bağlantı.';
    else if (!err && end <= start) err = 'Bitiş, başlangıçtan sonra olmalı.';
    if (err) { msg.textContent = err; msg.className = 'form-msg err'; return; }
    custom.push({ id: 'c' + Date.now().toString(36), title: title, artist: artist, instrument: instrument, videoId: link.videoId, start: start, end: end });
    save(KEY_TRACKS, custom);
    var playingId = current >= 0 ? tracks[current].id : null;
    rebuild();
    if (playingId) current = tracks.findIndex(function (t) { return t.id === playingId; });
    render();
    f.reset();
    msg.textContent = '“' + title + '” eklendi (' + fmt(end - start) + ').'; msg.className = 'form-msg';
  });

  function showNotice(html, keep) { var n = $('notice'); n.innerHTML = html; n.hidden = false; n.dataset.keep = keep ? '1' : ''; }
  function hideNotice() { var n = $('notice'); if (n.dataset.keep !== '1' || playing) { n.hidden = true; n.dataset.keep = ''; } }

  render();
})();
