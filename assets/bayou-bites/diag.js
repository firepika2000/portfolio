/* Bayou Bites on-device diagnostics. Inert unless the URL has diag=1.
 * Loaded before the game so it can also catch errors thrown while the game
 * starts. Shows a live readout of the chain that makes notes fall:
 * mode → music status/clock → engine clock → notes created → frames drawn,
 * plus the device, and the last JavaScript error, if any. */
(function () {
  'use strict';
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  if (params.get('diag') !== '1') return;

  var errors = [];
  function note(msg) {
    errors.push(String(msg).slice(0, 160));
    if (errors.length > 3) errors.shift();
  }
  window.addEventListener('error', function (e) {
    note((e.message || 'error') + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    note('promise: ' + (e.reason && (e.reason.message || e.reason)));
  });

  // ── Audio event timeline: when does the element's duration/clock go wrong? ──
  var T0 = performance.now(), events = [], playCalls = [];
  function stamp() { return ((performance.now() - T0) / 1000).toFixed(2); }
  function fmt(n, d) { return typeof n === 'number' && isFinite(n) ? n.toFixed(d == null ? 2 : d) : String(n); }
  var EVENTS = ['loadstart', 'durationchange', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'play',
    'playing', 'pause', 'seeking', 'seeked', 'waiting', 'stalled', 'suspend', 'ended', 'emptied', 'abort', 'error'];
  function hook(el) {
    if (!el || el.__diagHooked) return;
    el.__diagHooked = true;
    EVENTS.forEach(function (name) {
      el.addEventListener(name, function () {
        events.push(stamp() + ' ' + name + ' t=' + fmt(el.currentTime) + ' dur=' + fmt(el.duration, 1) +
          ' rs=' + el.readyState + (el.muted ? ' muted' : '') + (el.error ? ' err=' + el.error.code : ''));
        if (events.length > 14) events.shift();
      });
    });
  }
  // Log every play() call and how its promise settles (iOS gesture/unlock issues show up here).
  var origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    var el = this, at = stamp(), p = origPlay.apply(this, arguments);
    var rec = { at: at, muted: el.muted, src: (el.getAttribute('src') || '').split('/').pop(), result: 'pending' };
    playCalls.push(rec); if (playCalls.length > 4) playCalls.shift();
    if (p && p.then) p.then(function () { rec.result = 'resolved @' + stamp(); },
                            function (e) { rec.result = 'REJECTED ' + (e && e.name) + ' @' + stamp(); });
    return p;
  };
  var hookTimer = setInterval(function () {
    var el = document.getElementById('game-music');
    if (el) { hook(el); clearInterval(hookTimer); }
  }, 50);

  // ── Raw audio test: the same file in a fresh, plain <audio>, no game logic ──
  var raw = null;
  function runRawTest() {
    if (raw && raw.running) return;
    var a = new Audio('assets/audio/beignet-bounce.mp3');
    raw = { running: true, line: 'raw test: starting…', el: a };
    var started = performance.now();
    var p = a.play();
    if (p && p.catch) p.catch(function (e) { raw.line = 'raw test: play() REJECTED ' + (e && e.name); raw.running = false; });
    var iv = setInterval(function () {
      raw.line = 'raw test: t=' + fmt(a.currentTime) + ' dur=' + fmt(a.duration, 1) + ' paused=' + a.paused +
        ' ended=' + a.ended + ' rs=' + a.readyState + (a.error ? ' err=' + a.error.code : '');
      if (performance.now() - started > 6000) {
        clearInterval(iv); a.pause(); raw.running = false;
        raw.line += a.currentTime > 2 ? '  → PLAYS OK' : '  → BROKEN (clock did not advance)';
      }
    }, 250);
  }

  var frames = 0, fps = 0, lastFpsAt = performance.now();
  (function count() {
    frames++;
    var now = performance.now();
    if (now - lastFpsAt >= 1000) { fps = Math.round(frames * 1000 / (now - lastFpsAt)); frames = 0; lastFpsAt = now; }
    requestAnimationFrame(count);
  })();

  function f(n, d) { return typeof n === 'number' && isFinite(n) ? n.toFixed(d == null ? 2 : d) : String(n); }

  function build() {
    var box = document.createElement('pre');
    box.id = 'bayou-diag';
    box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99999;margin:0;padding:6px 8px;max-width:calc(100vw - 8px);' +
      'background:rgba(0,0,0,.82);color:#9ff5c8;font:10px/1.35 ui-monospace,Menlo,Consolas,monospace;border:1px solid #2f7;' +
      'border-radius:4px;white-space:pre-wrap;word-break:break-all;pointer-events:none';
    document.body.appendChild(box);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '▶ RAW AUDIO TEST';
    btn.style.cssText = 'position:fixed;right:6px;top:52%;z-index:100000;font:bold 12px ui-monospace,Menlo,Consolas,monospace;' +
      'padding:10px 12px;background:#0b2a22;color:#9ff5c8;border:1px solid #2f7;border-radius:6px';
    btn.addEventListener('click', function (e) { e.stopPropagation(); runRawTest(); });
    document.body.appendChild(btn);
    var lastEngineT = -1, frozenFor = 0;
    setInterval(function () {
      var L = [], st = null, el = document.getElementById('game-music'), dbg = window.BayouDebug;
      try { st = window.BayouBites && window.BayouBites.getState(); } catch (e) { note('getState: ' + e.message); }
      L.push('BAYOU DIAG v2');
      if (st) {
        L.push('mode: ' + st.mode + '   music: ' + st.music.status + ' (' + st.music.id + ')' + (st.music.muted ? ' MUTED' : ''));
        L.push('music clock: ' + f(st.music.time) + 's   engine clock: ' + f(st.time) + 's / ' + f(st.duration, 1) + 's');
        var engineMoving = st.time !== lastEngineT;
        frozenFor = engineMoving ? 0 : frozenFor + 0.25; lastEngineT = st.time;
        if (st.mode === 'playing' && frozenFor >= 1) L.push('!! engine clock FROZEN for ' + f(frozenFor, 1) + 's');
        L.push('engine state: ' + st.state + '   level ' + st.level + '   hearts ' + st.hearts + '   misses ' + st.totalMisses + '   score ' + st.score);
      } else {
        L.push('game API not ready');
      }
      if (dbg && dbg.core) {
        var c = dbg.core;
        L.push('notes live: ' + c.notes.length + '   dropped total: ' + c.dropped + '   director spawned: ' +
          (c.director ? c.director.spawned + ' (beat ' + c.director.beatIndex + ')' : 'none'));
      }
      if (el) {
        L.push('audio: paused=' + el.paused + ' ended=' + el.ended + ' ready=' + el.readyState + ' net=' + el.networkState +
          ' t=' + f(el.currentTime) + ' dur=' + f(el.duration, 1) + (el.error ? ' ERR=' + el.error.code : ''));
        L.push('src: ' + (el.currentSrc || '(none)').split('/').slice(-2).join('/') +
          '   buffered: ' + (el.buffered.length ? f(el.buffered.start(0)) + '-' + f(el.buffered.end(el.buffered.length - 1)) : 'none'));
      }
      L.push('music.js fix: ' + (window.BayouSoundtrack && String(window.BayouSoundtrack).indexOf('progressWaiter') > -1 ? 'loaded' : 'OLD COPY'));
      if (playCalls.length) L.push('play() calls:\n  ' + playCalls.map(function (p) {
        return p.at + ' ' + p.src + (p.muted ? ' (muted)' : '') + ' → ' + p.result; }).join('\n  '));
      if (events.length) L.push('audio events:\n  ' + events.join('\n  '));
      if (raw) L.push(raw.line);
      var cv = document.getElementById('canvas');
      L.push('fps ' + fps + '   visible=' + document.visibilityState + '   focus=' + document.hasFocus() +
        '   canvas ' + (cv ? Math.round(cv.clientWidth) + 'x' + Math.round(cv.clientHeight) : '?'));
      L.push('screen ' + innerWidth + 'x' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x   ' +
        (window.parent !== window ? 'embedded' : 'standalone') + '   ' + location.protocol);
      L.push('UA: ' + navigator.userAgent);
      L.push('errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
      box.textContent = L.join('\n');
    }, 250);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
