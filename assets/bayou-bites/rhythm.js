/* Bayou Bites v5 · performance-driven, beat-quantized difficulty.
 * More successful bites and sustained combos unlock denser beat patterns and
 * shorter flights. Nothing changes the song BPM or an already-released note.
 * A cadence entry is an INTEGER count of detected beats until the next drop.
 */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const LABELS = Object.freeze(['EASY GROOVE', 'PICKING UP', 'SWEET GROOVE', 'HOT STREAK', 'FEVER']);
  const freeze = o => {
    Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); });
    return Object.freeze(o);
  };
  const TUNING = freeze({
    bayou: {qualityTarget:28, comboTarget:18, heatBase:16, heatRange:34, hazardBase:.10, hazardRamp:.10,
      tiers:[{cadence:[3],flight:6},{cadence:[2],flight:5},{cadence:[2,1],flight:4},
        {cadence:[1,1,2],flight:4},{cadence:[1,1,1,2],flight:3}]},
    riverboat: {qualityTarget:48, comboTarget:24, heatBase:42, heatRange:33, hazardBase:.20, hazardRamp:.11,
      tiers:[{cadence:[2],flight:5},{cadence:[2,1],flight:4},{cadence:[1,1,2],flight:3},
        {cadence:[1,1,1,2],flight:3},{cadence:[1],flight:2}]},
    city: {qualityTarget:72, comboTarget:30, heatBase:70, heatRange:30, hazardBase:.30, hazardRamp:.12,
      tiers:[{cadence:[2,1],flight:5},{cadence:[1,1,2],flight:4},{cadence:[1,1,1,2],flight:3},
        {cadence:[1,1,1,1,1,2],flight:3},{cadence:[1],flight:2}]}
  });
  /** performance is stage-local, with a small carry-over for mastery in earlier songs.
   * The numeric form is kept for embedders that previously supplied a catch count.
   * Perfect / Great / Good earn 1 / .8 / .5 quality units. Highest stage combo,
   * not current combo, is used: a mistake never erases earned difficulty.
   */
  function pressure(area, time, duration, performance=0) {
    const t = TUNING[area];
    if (!t) throw new Error('Unknown stage: ' + area);
    const stats = typeof performance === 'number' ? {quality:performance} : (performance || {});
    const songProgress = clamp(finite(time) / Math.max(1, finite(duration,1)), 0, 1);
    const quality = Math.max(0, finite(stats.quality ?? stats.catches));
    const successPressure = clamp(quality / t.qualityTarget, 0, 1);
    const comboPressure = clamp(finite(stats.bestCombo) / t.comboTarget, 0, 1);
    const carryPressure = clamp(finite(stats.priorQuality) / 400, 0, .10);
    // 85% of the main ramp comes from genuine play, only 15% from elapsed time.
    const amount = clamp(.15 * songProgress + .65 * successPressure + .20 * comboPressure + carryPressure, 0, 1);
    const tier = Math.min(4, Math.floor((amount + 1e-10) * 5)), preset = t.tiers[tier];
    const meanStride = preset.cadence.reduce((a,b)=>a+b,0) / preset.cadence.length;
    return {amount, tier, label:LABELS[tier], tierProgress:tier===4?1:clamp(amount*5-tier,0,1),
      songProgress, successPressure, comboPressure, carryPressure,
      heat:Math.round(t.heatBase + t.heatRange * amount),
      cadence:preset.cadence, stride:meanStride, notesPerBeat:1/meanStride,
      flightBeats:preset.flight, hazardChance:t.hazardBase+t.hazardRamp*amount};
  }
  function upperBound(arr, value) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (arr[m] <= value) lo = m + 1; else hi = m; }
    return lo;
  }
  class Director {
    constructor(area, track, {offset=0, firstDrop=2.5, minDecision=.30, endMargin=.50} = {}) {
      if (!TUNING[area] || !Array.isArray(track.beats) || track.beats.length < 2) throw new Error('Missing beat map.');
      this.area=area;this.track=track;this.offset=offset;this.firstDrop=firstDrop;this.minDecision=minDecision;this.endMargin=endMargin;
      this.beats=track.beats.map(t=>t+offset);
      this.cursor=0;this.nextRelease=upperBound(this.beats,firstDrop);
      this.lastArrivalIndex=-1;this.lastArrivalAt=-Infinity;this.disabled=false;
      this.beatIndex=-1;this.spawned=0;this.patternCursor=0;this.patternTier=-1;
    }
    advance(time, performance, duration, release) {
      let examined=0;
      while(this.cursor<this.beats.length && this.beats[this.cursor]<=time) {
        const i=this.cursor++;this.beatIndex=i;examined++;
        if(this.disabled || i<this.nextRelease || this.beats[i]<this.firstDrop)continue;
        const stats=typeof performance==='function'?performance():performance;
        const p=pressure(this.area,this.beats[i],duration,stats);
        if(p.tier!==this.patternTier){this.patternTier=p.tier;this.patternCursor=0;}
        const stride=p.cadence[this.patternCursor%p.cadence.length];
        this.nextRelease=i+stride;
        let arrival=i+p.flightBeats;
        // An upgrade applies only to NEW items. Rest a beat rather than overtaking
        // an in-flight note or making two lanes require the same tap time.
        if(arrival<=this.lastArrivalIndex){this.nextRelease=i+1;continue;}
        while(arrival<this.beats.length && this.beats[arrival]-this.lastArrivalAt<this.minDecision-1e-9)arrival++;
        if(arrival>=this.beats.length || this.beats[arrival]>duration-this.endMargin)continue;
        const drop={beatIndex:i,arrivalBeatIndex:arrival,spawnAt:this.beats[i],impactAt:this.beats[arrival],
          flightBeats:arrival-i,stride,pressure:p};
        this.lastArrivalIndex=arrival;this.lastArrivalAt=drop.impactAt;this.spawned++;this.patternCursor++;
        release(drop);
      }
      return examined;
    }
    phase(time) {
      const i=upperBound(this.beats,time)-1;
      if(i<0)return {index:-1,pulse:0,fraction:0};
      const span=(this.beats[i+1]||this.beats[i]+60/this.track.bpm)-this.beats[i];
      const fraction=clamp((time-this.beats[i])/span,0,1);
      return {index:i,pulse:Math.max(0,1-fraction*4),fraction};
    }
  }
  window.BayouRhythm=Object.freeze({Director,pressure,tuning:TUNING,labels:LABELS,upperBound});
})();
