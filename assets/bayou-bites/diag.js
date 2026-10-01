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
    var lastEngineT = -1, frozenFor = 0;
    setInterval(function () {
      var L = [], st = null, el = document.getElementById('game-music'), dbg = window.BayouDebug;
      try { st = window.BayouBites && window.BayouBites.getState(); } catch (e) { note('getState: ' + e.message); }
      L.push('BAYOU DIAG  build v5.1');
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
      }
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
