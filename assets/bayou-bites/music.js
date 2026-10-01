/* Streaming soundtrack transport. One persistent media element; no AudioBuffer cache.
 * Playback time (not requestAnimationFrame or setInterval) is the gameplay clock.
 * Browser API references: see README.md. */
(() => {
  'use strict';
  class Soundtrack {
    constructor(tracks, urls = {}, callbacks = {}) {
      this.tracks = tracks; this.urls = urls; this.callbacks = callbacks;
      this.id = null; this.status = 'idle'; this.intent = 'paused';
      this.token = 0; this.muted = false; this.volume = .72; this.virtual = false;
      this.testTime = 0; this.destroyed = false; this.durations = {};
      this.element = document.createElement('audio');
      this.element.id = 'game-music'; this.element.preload = 'metadata';
      this.element.setAttribute('playsinline', ''); this.element.hidden = true;
      document.body.appendChild(this.element);
      this.listeners = [];
      const on = (name, fn) => { this.element.addEventListener(name, fn); this.listeners.push(() => this.element.removeEventListener(name, fn)); };
      on('loadedmetadata', () => {
        if (this.id && Number.isFinite(this.element.duration)) {
          this.durations[this.id] = this.element.duration;
          this.callbacks.metadata?.(this.id, this.element.duration);
        }
      });
      on('waiting', () => { if (this.intent === 'playing') this.setStatus('buffering'); });
      on('playing', () => { if (this.intent === 'playing') this.setStatus('playing'); });
      on('ended', () => {
        if (this.intent === 'playing' && !this.element.loop) {
          this.intent = 'paused'; this.setStatus('ended'); this.callbacks.ended?.(this.id);
        }
      });
      // Truth over events. On real devices and networks (mobile Safari,
      // Android Chrome, slow connections) audible playback can start or
      // resume without the matching 'playing' event. The status then stuck on
      // 'buffering'/'loading' while the song played on, and because the engine
      // only advances while status === 'playing', no notes ever fell. If the
      // media clock is actually advancing, we are playing. A genuine stall
      // still holds the notes, because during a real stall the clock stops.
      this.lastProgressT = -1; this.progressWaiter = null;
      on('timeupdate', () => {
        const el = this.element, t = el.currentTime;
        if (this.intent === 'playing' && !el.paused && this.lastProgressT >= 0 && t > this.lastProgressT
            && (this.status === 'buffering' || this.status === 'loading')) this.setStatus('playing');
        this.lastProgressT = t;
        if (this.progressWaiter && !el.paused && t > this.progressWaiter.from + 0.05) {
          const done = this.progressWaiter.resolve; this.progressWaiter = null; done();
        }
      });
      on('error', () => {
        if (!this.destroyed && this.id && this.intent !== 'paused') {
          this.setStatus('error'); this.callbacks.error?.('The soundtrack could not load. Check the audio files, then retry.');
        }
      });
    }
    setStatus(status) {
      if (status !== this.status) { this.status = status; this.callbacks.status?.(status, this.id); }
    }
    duration(id = this.id) { return this.durations[id] || this.tracks[id]?.duration || 0; }
    time() { return this.virtual ? this.testTime : (this.element.currentTime || 0); }
    select(id, loop = false) {
      if (!this.tracks[id]) throw new Error(`Unknown soundtrack: ${id}`);
      const el = this.element;
      el.pause(); this.id = id; this.testTime = 0; el.loop = loop; this.lastProgressT = -1;
      if (!this.virtual) {
        const url = this.urls[id] || this.tracks[id].url;
        if (el.getAttribute('src') !== url || el.error) { el.src = url; el.preload = 'auto'; el.load(); }
        else { try { el.currentTime = 0; } catch (_) {} }
      }
      el.muted = this.muted; el.volume = this.volume;
    }
    async attempt(token, prepare = false) {
      if (this.virtual) { this.setStatus(prepare ? 'ready' : 'playing'); return true; }
      let timer;
      try {
        // Called from the user gesture for preparation / menu. The same element
        // is reused after the count-in, and every rejected play() has a retry UI.
        const promise = this.element.play();
        if (promise && promise.catch) promise.catch(() => {});   // handled by the race below
        const progressed = new Promise(resolve => { this.progressWaiter = { from: this.element.currentTime, resolve }; });
        await Promise.race([promise, progressed, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Audio loading timed out. Check your connection and retry.')), 20000);
        })]);
        if (token !== this.token || this.destroyed) return false;
        if (prepare) {
          this.element.pause(); this.element.currentTime = 0; this.element.muted = this.muted;
          this.intent = 'ready'; this.setStatus('ready');
        } else this.setStatus('playing');
        return true;
      } catch (error) {
        if (token !== this.token || this.destroyed) return false;
        this.element.pause(); this.element.muted = this.muted; this.intent = 'paused';
        const blocked = error.name === 'NotAllowedError';
        this.setStatus(blocked ? 'blocked' : 'error');
        this.callbacks.error?.(blocked ? 'Tap the button below to allow this song to play.' : error.message || 'The soundtrack could not load. Please retry.');
        return false;
      } finally { clearTimeout(timer); this.progressWaiter = null; }
    }
    prepare(id) {
      const token = ++this.token; this.select(id); this.intent = 'preparing'; this.setStatus('loading');
      this.element.muted = true; // Silent gesture-priming; rewind before the full song starts.
      if (this.virtual) { this.intent = 'ready'; this.setStatus('ready'); return Promise.resolve(true); }
      return this.attempt(token, true);
    }
    play() {
      const token = ++this.token; this.intent = 'playing'; this.element.muted = this.muted;
      this.setStatus('loading'); return this.attempt(token);
    }
    playMenu() {
      if (this.id !== 'menu') this.select('menu', true);
      this.element.loop = true; return this.play();
    }
    pause() {
      ++this.token; this.intent = 'paused'; this.element.pause();
      if (this.status !== 'ended') this.setStatus('paused');
    }
    seek(seconds) {
      const t = Math.max(0, Math.min(this.duration(), Number(seconds) || 0));
      this.lastProgressT = -1;
      if (this.virtual) this.testTime = t;
      else { try { this.element.currentTime = t; } catch (_) {} }
    }
    setMuted(value) { this.muted = Boolean(value); this.element.muted = this.muted; }
    setVolume(value) { this.volume = Math.max(0, Math.min(1, Number(value) || 0)); this.element.volume = this.volume; }
    enableVirtual() { this.pause(); this.virtual = true; this.testTime = 0; }
    tick(dt) {
      if (this.virtual && this.intent === 'playing') {
        this.testTime = Math.min(this.duration(), this.testTime + dt);
        // The game observes this clock and handles the exact end in its update.
      }
    }
    destroy() {
      this.destroyed = true; this.pause(); this.listeners.forEach(fn => fn());
      this.element.removeAttribute('src'); this.element.load(); this.element.remove();
    }
  }
  window.BayouSoundtrack = Soundtrack;
})();
