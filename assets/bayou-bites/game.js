/* Bayou Bites · Rhythm Edition v5.0.0. Dependency-free, embeddable Canvas/DOM game.
 * Timed lane taps, not position, trigger a bite. The actual soundtrack playhead
 * drives every note and input judgment. Original MP3s and beat maps preserved.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search||window.BAYOU_QA_QUERY||'');
if(params.get('embed')==='1')document.documentElement.classList.add('embed');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const AREAS=['bayou','riverboat','city'], NAMES=['The Bayou','The Riverboat','The City'];
const COLORS=['#f28daf','#ffdc80','#89caff'], LANES=[128,240,352], TOP=141, LINE=421;
const TRACKS=window.BAYOU_TRACKS, SPRITES=window.BAYOU_SPRITES;
const ASSETS=Object.assign({atlas:'assets/gator-atlas.png',background:'assets/rhythm-bayou.png',riverboat:'assets/riverboat-background.png',city:'assets/city-background.png',beignet:'assets/beignet.png',thorn:'assets/thorn-fruit.png',logo:'assets/rhythm-logo.png',performer:'assets/louis-performance.png'},window.BAYOU_ASSET_URLS||{});
const images={}, canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
if(!ctx){$('loading').innerHTML='<b>Canvas is unavailable.</b><small>Please open this game in a modern web browser.</small>';return;}
ctx.imageSmoothingEnabled=false;
const storageKey='bayou-bites:v5';let saved={};try{
 const current=localStorage.getItem(storageKey);
 if(current)saved=JSON.parse(current)||{};
 else {const previous=JSON.parse(localStorage.getItem('bayou-bites:v4')||'{}')||{};saved={...previous,best:0,tutorialSeen:false};}
}catch(_){}
let muted=saved.muted===true,musicVolume=clamp(Number(saved.musicVolume??.72),0,1),effectsVolume=clamp(Number(saved.effectsVolume??.35),0,1);
let reducedMotion=saved.reducedMotion??matchMedia('(prefers-reduced-motion: reduce)').matches;
let sync=clamp(Number(params.get('sync')??saved.sync??0)||0,-250,250)/1000, best=Number(saved.best)||0;
let mode='loading',previousMode='menu',pauseFrom='playing',modalBack=()=>{},lastFocused=null,activeTicket=0,retryAudio=()=>{},musicReady=false;
let ambient=0,lastFrame=0,raf=0,destroyed=false,countdown=0,lastCount=-1,judgeAge=10,flash=[0,0,0],shake=0;
let particles=[],snacks=[],musicalNotes=[],hitAge=10,actionAge=10,actionKind='idle',playerLane=1,playerLean=0,menuEnvelope=0,lastEmitBeat=-1;
let lastHud='',menuWasPlaying=false,stageBase=0,runStarted=false,renderCount=0,paceNoticeAge=10;
const heldKeys=new Set(),heldPointers=new Set();
function clearHeldInputs(){heldKeys.clear();heldPointers.clear();}
const listeners=[];
function listen(el,event,fn,options){el.addEventListener(event,fn,options);listeners.push(()=>el.removeEventListener(event,fn,options));}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({best,muted,musicVolume,effectsVolume,reducedMotion,sync:Math.round(sync*1000),tutorialSeen:saved.tutorialSeen===true}));}catch(_) {}}
function announce(text){$('announcer').textContent=text;}
let parentOrigin=null;try{parentOrigin=new URL(params.get('parentOrigin')||document.referrer).origin;}catch(_){}
function emit(event,detail={}){const message={source:'bayou-bites',version:5,event,...detail};$('game').dispatchEvent(new CustomEvent('bayou:'+event,{bubbles:true,detail:message}));if(window.parent!==window)window.parent.postMessage(message,parentOrigin&&parentOrigin!=='null'?parentOrigin:'*');}
class Effects {
 constructor(){this.ac=null;}
 unlock(){if(muted)return;try{if(!this.ac){const AC=window.AudioContext||window.webkitAudioContext;if(AC)this.ac=new AC({latencyHint:'interactive'});}if(this.ac?.state==='suspended')this.ac.resume().catch(()=>{});}catch(_) {}}
 tone(freq,dur=.08,when=0,type='triangle',strength=.05){if(muted||!this.ac||this.ac.state!=='running')return;const ac=this.ac,o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+when;o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(effectsVolume*strength,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
 play(r){if(r==='perfect'){this.tone(783,.075);this.tone(1046,.08,.025,'sine',.04);}else if(r==='great')this.tone(659,.075);else if(r==='good')this.tone(523,.065);else if(r==='thorn'){this.tone(110,.16,0,'sawtooth',.07);}else if(r==='bad')this.tone(170,.04,0,'sine',.025);else if(r==='count')this.tone(440,.045,0,'sine',.04);else if(r==='go')this.tone(880,.085,0,'sine',.05);else if(r==='clear')[523,659,783,1046].forEach((f,i)=>this.tone(f,.14,i*.06,'triangle',.045));}
}
const effects=new Effects();
const music=new window.BayouSoundtrack(TRACKS,window.BAYOU_MUSIC_URLS||{}, {
 metadata:()=>{lastHud='';},status:()=>{lastHud='';},
 ended:id=>{if(mode==='playing'&&id===AREAS[core.level]){core.tick(music.duration());}},
 error:message=>{if(destroyed)return;showAudioError(message);}
});
music.setMuted(muted);music.setVolume(musicVolume);
const core=new window.BayouEngine.Engine(TRACKS,onGameEvent);core.sync=sync;
const fmt=s=>{const t=Math.max(0,Math.floor(s));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
const fmtAcc=a=>a.toFixed(1)+'%';
function setMode(value){if(value!=='playing')clearHeldInputs();mode=value;$('game').dataset.mode=value;$('menu').hidden=value!=='menu';$('play-ui').hidden=['loading','menu'].includes(value);$('count-in').hidden=value!=='countdown';lastHud='';}
function setSound(){music.setMuted(muted);music.setVolume(musicVolume);$('game').dataset.muted=String(muted);document.querySelectorAll('.sound-button').forEach(b=>{b.setAttribute('aria-label',muted?'Turn sound on':'Mute sound');b.setAttribute('aria-pressed',String(muted));});persist();}
function closeModal(restoreFocus=true){$('modal').hidden=true;if(restoreFocus&&lastFocused?.isConnected)lastFocused.focus({preventScroll:true});}
function openPanel(kicker,title,body,actions,back=null){
 lastFocused=document.activeElement;$('panel-kicker').textContent=kicker;$('panel-title').textContent=title;$('panel-body').innerHTML=body;$('panel-actions').replaceChildren();
 for(const a of actions){const b=document.createElement('button');b.className=a.style||'gold';b.textContent=a.text;b.id=a.id||'';b.type='button';b.addEventListener('click',a.fn);$('panel-actions').appendChild(b);}
 modalBack=back||(()=>{});$('panel-close').hidden=!back;$('modal').hidden=false;$('panel').focus({preventScroll:true});
}
function help(startAfter=false){
 const back=()=>closeModal();
 openPanel('FEEL THE BEAT · FEED THE GATOR','Every bite is a beat.',
 `<div class="intro-rule"><img src="${ASSETS.beignet}" alt="Mouse-ear pastry"><div><b>TAP A PASTRY ON THE LINE.</b><p>Tap its colored pad as the pastry's center meets the glowing line. Louis opens up, then munches.</p></div></div><div class="intro-rule"><img src="${ASSETS.thorn}" alt="Spiky fruit"><div><b>LET THE THORNS GO.</b><p>Do not tap thorn fruit. Tapping one costs a heart. Missed pastries AND bad presses share the same meter: every 3 cost a heart.</p></div></div><p>One tap, one bite. Holding or swiping does not catch. Empty, wrong-lane and off-time presses each add a miss, break your combo and reduce score and accuracy. Random tapping will end your run.</p><p><b>PLAY WELL, PICK UP THE PACE.</b> Good catches and long streaks unlock five pace tiers: denser beat patterns, shorter falls, more thorns. Perfect and Great hits build the pace faster. Earned pace is not lost when you make a mistake.</p><div class="timing-bands"><span>PERFECT<strong>±45 ms</strong></span><span>GREAT<strong>±90 ms</strong></span><span>GOOD<strong>±150 ms</strong></span></div><p class="fine-print">Keyboard: A / S / D or ← / ↓ / →. P or Escape pauses. Settings include audio/timing adjustment.</p>`,
 [{text:startAfter?'LET’S PLAY ▸':'GOT IT',id:'help-continue',fn:()=>{saved.tutorialSeen=true;persist();closeModal(false);if(startAfter)startRun();}}],back);
}
function showSettings(back=()=>closeModal()){
 openPanel('MAKE YOURSELF COMFORTABLE','Sound & timing',
 `<div class="settings-row"><label for="music-volume">MUSIC VOLUME <output id="music-value">${Math.round(musicVolume*100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value="${Math.round(musicVolume*100)}"></div><div class="settings-row"><label for="effects-volume">BITE / JUDGMENT EFFECTS <output id="effects-value">${Math.round(effectsVolume*100)}%</output></label><input id="effects-volume" type="range" min="0" max="100" value="${Math.round(effectsVolume*100)}"></div><div class="settings-row"><label for="sync-offset">NOTE TIMING OFFSET <output id="sync-value">${Math.round(sync*1000)} ms</output></label><input id="sync-offset" type="range" min="-250" max="250" step="5" value="${Math.round(sync*1000)}"></div><p class="fine-print">Positive values move notes and their timing windows later. Try +25 ms when your on-beat taps repeatedly read LATE. Use small steps. Wired audio generally needs less compensation than wireless audio.</p><div class="settings-row check"><label><input id="mute-check" type="checkbox" ${muted?'checked':''}> Mute all audio (the rhythm keeps running)</label><label><input id="motion-check" type="checkbox" ${reducedMotion?'checked':''}> Reduce motion and flashing</label></div><p class="fine-print">Your settings are stored only in this browser. Timing windows stay the same across all three stages.</p>`,
 [{text:'SAVE & RETURN',id:'save-settings',fn:()=>{persist();back();}},{text:'Reset timing to 0 ms',style:'text-button',fn:()=>{sync=0;core.sync=0;$('sync-offset').value='0';$('sync-value').textContent='0 ms';persist();}}],back);
 $('music-volume').addEventListener('input',e=>{musicVolume=Number(e.target.value)/100;music.setVolume(musicVolume);$('music-value').textContent=e.target.value+'%';persist();});
 $('effects-volume').addEventListener('input',e=>{effectsVolume=Number(e.target.value)/100;$('effects-value').textContent=e.target.value+'%';persist();});
 $('sync-offset').addEventListener('input',e=>{sync=Number(e.target.value)/1000;core.sync=sync;$('sync-value').textContent=e.target.value+' ms';persist();});
 $('mute-check').addEventListener('change',e=>{muted=e.target.checked;setSound();if(!muted)effects.unlock();});$('motion-check').addEventListener('change',e=>{reducedMotion=e.target.checked;persist();});
}
async function playTheme(){
 if(mode!=='menu')return;const wasMuted=muted;if(muted){muted=false;setSound();}effects.unlock();
 if(music.id==='menu'&&music.intent==='playing'){if(!wasMuted)music.pause();return;}
 retryAudio=()=>{closeModal(false);setMode('menu');playTheme();};await music.playMenu();
}
async function startRun(){
 if(!musicReady||!['menu','gameover','victory','levelclear','paused'].includes(mode))return;
 activeTicket++;closeModal(false);core.reset();core.sync=sync;particles=[];snacks=[];musicalNotes=[];playerLane=1;hitAge=10;actionAge=10;runStarted=true;emit('start',{mode:'rhythm'});await prepareStage(0);
}
async function prepareStage(index){
 const ticket=++activeTicket;effects.unlock();music.pause();closeModal(false);core.level=index;core.time=0;core.notes=[];core.state='preparing';
 particles=[];snacks=[];actionAge=10;hitAge=10;playerLane=1;lastEmitBeat=-1;paceNoticeAge=10;$('pace-notice').classList.remove('show');setMode('preparing');$('loading').hidden=false;$('loading').innerHTML='<b>QUEUING THE NEXT SONG…</b><small>'+TRACKS[AREAS[index]].title+'</small>';
 retryAudio=()=>prepareStage(index);
 const ok=await music.prepare(AREAS[index]);if(ticket!==activeTicket||destroyed)return;
 $('loading').hidden=true;if(!ok)return;
 countdown=0;lastCount=-1;setMode('countdown');$('count-area').textContent=`0${index+1} · ${NAMES[index].toUpperCase()}`;$('count-song').textContent=TRACKS[AREAS[index]].title;$('count-number').textContent='4';announce('Level '+(index+1)+'. '+TRACKS[AREAS[index]].title);
}
async function beginSong(){
 const ticket=activeTicket;setMode('starting');core.begin(core.level,music.duration(AREAS[core.level]));core.sync=sync;retryAudio=()=>resumeAfterAudio();
 const ok=await music.play();if(ticket!==activeTicket||destroyed)return;
 if(ok&&mode==='starting'){setMode('playing');effects.play('go');canvas.focus({preventScroll:true});}
}
async function resumeAfterAudio(){
 closeModal(false);setMode('starting');retryAudio=()=>resumeAfterAudio();const ticket=activeTicket;
 const ok=await music.play();if(ok&&ticket===activeTicket&&!destroyed){setMode('playing');canvas.focus({preventScroll:true});}
}
function showAudioError(message){
 $('loading').hidden=true;$('count-in').hidden=true;setMode('audioerror');
 openPanel('THE BAND NEEDS A MOMENT','One more tap.',`<p id="audio-problem"></p>`,[{text:'PLAY THE SONG ▸',id:'retry-audio',fn:()=>retryAudio()},{text:'Back to the menu',style:'text-button',fn:()=>goHome()}]);$('audio-problem').textContent=message;
}
function showPause(){
 openPanel('THE MUSIC IS ON HOLD','Take a breath.',`<p>${TRACKS[AREAS[core.level]].title}<br>Notes and the song are paused together.</p><div class="result-metrics"><div><b>${core.score}</b><span>SCORE</span></div><div><b>${fmtAcc(core.accuracy())}</b><span>ACCURACY</span></div><div><b>${core.combo}</b><span>COMBO</span></div></div>`,[{text:'BACK TO THE BEAT ▸',id:'resume',fn:()=>resume()},{text:'SOUND & TIMING',id:'pause-settings',style:'secondary',fn:()=>showSettings(showPause)},{text:'End this run',id:'quit',style:'text-button',fn:()=>goHome()}],()=>resume());
}
function pause(){if(!['playing','countdown','starting','preparing'].includes(mode))return;pauseFrom=mode;activeTicket++;music.pause();$('loading').hidden=true;setMode('paused');showPause();emit('pause',{level:core.level+1,time:music.time()});}
function resume(){
 if(mode!=='paused')return;effects.unlock();closeModal(false);
 if(pauseFrom==='countdown'){setMode('countdown');lastCount=-1;return;}
 if(pauseFrom==='preparing'){prepareStage(core.level);return;}
 resumeAfterAudio();emit('resume',{level:core.level+1,time:music.time()});
}
function goHome(){activeTicket++;music.pause();closeModal(false);core.state='menu';core.level=0;core.notes=[];core.time=0;particles=[];snacks=[];actionAge=10;hitAge=10;$('loading').hidden=true;setMode('menu');runStarted=false;playerLane=1;lastEmitBeat=-1;lastHud='';if(musicReady&&!muted){retryAudio=()=>{closeModal(false);setMode('menu');playTheme();};music.select('menu',true);music.playMenu();}emit('home');}
function scorePanel(e,won=false){
 if(core.score>best){best=core.score;persist();}
 const c=core.counts,accuracy=fmtAcc(core.accuracy()),clear=mode==='levelclear';
 const title=clear?`${NAMES[core.level]} cleared.`:won?'A delicious finale.':'One more bite?';
 const detail=clear?`Next stop: ${NAMES[core.level+1]}. Hearts, misses and combo carry over.`:won?'All three songs. One very happy gator.':'Find the beat, then make every tap count.';
 const metrics=`<div class="grade">${core.grade()}</div><div class="result-total">${core.score.toLocaleString()}</div><p>${detail}</p><div class="result-metrics"><div><b>${accuracy}</b><span>ACCURACY</span></div><div><b>${core.maxCombo}</b><span>BEST COMBO</span></div><div><b>${core.catches}</b><span>PASTRIES</span></div></div><div class="judgment-counts"><span>PERFECT <b>${c.perfect}</b></span><span>GREAT <b>${c.great}</b></span><span>GOOD <b>${c.good}</b></span><span>MISSED <b>${c.miss}</b></span><span>MIS-TAPS <b>${c.bad}</b></span><span>THORN HITS <b>${c.thorn}</b></span></div>`;
 openPanel(clear?`STAGE ${core.level+1} / 3 · COMPLETE`:won?'THE MIDNIGHT MIXTAPE · COMPLETE':'THE BAND PLAYS ON',title,metrics,
 clear?[{text:`ON TO ${NAMES[core.level+1].toUpperCase()} ▸`,id:'next-level',fn:()=>prepareStage(core.level+1)},{text:'Back to the menu',style:'text-button',fn:goHome}]:[{text:'PLAY AGAIN ↻',id:'restart',fn:startRun},{text:'Back to the menu',style:'text-button',fn:goHome}]);
}
function burst(x,y,color,count=14){for(let i=0;i<(reducedMotion?5:count);i++){const a=(i/count)*Math.PI*2,s=35+Math.random()*65;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,age:0,life:.28+Math.random()*.35,size:2+Math.random()*2,color});}}
function onGameEvent(e){
 if(e.type==='judge'){
  judgeAge=0;actionAge=0;actionKind=e.rating;playerLane=e.lane??e.note?.lane??playerLane;
  const names={perfect:'PERFECT',great:'GREAT',good:'GOOD',bad:'MISS',miss:'MISS',thorn:'OUCH!'};
  $('judgment').dataset.rating=e.rating;$('judge-word').textContent=names[e.rating];
  $('judge-detail').textContent=['bad','miss'].includes(e.rating)
   ? (e.heartLost?'3 MISSES · −1 HEART':`${e.rating==='bad'?'MIS-TAP':'PASTRY MISSED'} · ${e.missCount} / 3`)
   : e.rating==='thorn'?'LET THE THORNS PASS'
   : (Math.abs(e.error)<.014?'RIGHT ON THE BEAT':`${e.error<0?'EARLY':'LATE'} · ${Math.round(Math.abs(e.error)*1000)} ms`);
  if(['bad','miss'].includes(e.rating))announce(e.heartLost?'Three mistakes cost a heart.':`${e.rating==='bad'?'Bad press':'Missed pastry'}. ${e.missCount} of 3 misses.`);
  $('judgment').classList.add('show');
  if(['perfect','great','good'].includes(e.rating)){flash[playerLane]=1;snacks.push({x:LANES[playerLane],y:itemAt(e.note).y,age:0,lane:playerLane});burst(LANES[playerLane],LINE,e.rating==='perfect'?'#ffe6a1':COLORS[playerLane],20);}
  if(e.rating==='thorn'){hitAge=0;burst(LANES[playerLane],LINE,'#e68781');}
  effects.play(e.rating);emit('judge',{rating:e.rating,lane:playerLane,errorMs:e.error===null?null:Math.round((e.error||0)*1000),score:core.score,combo:core.combo,accuracy:core.accuracy(),missMeter:core.missMeter,totalMisses:core.counts.miss+core.counts.bad,hearts:core.hearts});
 }
 else if(e.type==='damage'){hitAge=0;shake=reducedMotion?0:.28;announce(e.reason==='misses'?'Three mistakes: missed pastries or bad presses. '+e.hearts+' hearts remaining.':'Thorn hit. '+e.hearts+' hearts remaining.');emit('damage',{reason:e.reason,hearts:e.hearts});}
 else if(e.type==='paceup'){
  paceNoticeAge=0;$('pace-notice').textContent=`PACE UP · ${e.toTier+1} / 5 · ${e.pressure.label}`;$('pace-notice').classList.add('show');
  announce(`Pace ${e.toTier+1} of 5. ${e.pressure.label.toLowerCase()}.`);
  emit('paceup',{level:e.level,pace:e.toTier+1,pressure:e.pressure});
 }
 else if(e.type==='levelclear'||e.type==='victory'||e.type==='gameover'){
  music.pause();setMode(e.type);effects.play(e.type==='gameover'?'thorn':'clear');scorePanel(e,e.type==='victory');emit(e.type,core.snapshot());announce(e.type==='victory'?'Journey complete. Score '+core.score:e.type==='levelclear'?'Stage complete.':'Game over.');
 }
 else if(e.type==='levelstart'){emit('levelstart',{level:e.level,song:TRACKS[AREAS[core.level]].title,duration:core.duration});}
 else if(e.type==='drop'){emit('drop',{level:e.level,lane:e.lane,kind:e.kind,spawnAt:e.spawnAt,impactAt:e.at});}
 lastHud='';
}
function tap(lane){if(mode!=='playing'||music.status!=='playing'||!$('modal').hidden)return;effects.unlock();const result=core.tap(lane,music.time());if(!result.ignored){updateHud();flash[lane]=Math.max(flash[lane],.5);const b=document.querySelector(`[data-lane="${lane}"]`);b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),85);}}
function timePhase(time,track){const i=window.BayouRhythm.upperBound(track.beats,time)-1;if(i<0)return {index:-1,pulse:0,fraction:0};const span=(track.beats[i+1]||track.beats[i]+60/track.bpm)-track.beats[i],f=((time-track.beats[i])/span)%1;return {index:i,pulse:Math.max(0,1-f*4),fraction:f};}
function updateHud(){
 const t=core.time,p=core.pressure(),acc=core.accuracy();
 const key=[mode,core.score,core.combo,core.hearts,core.missMeter,core.counts.bad,core.counts.miss,p.tier,Math.floor(t*10),music.status,muted,core.level].join('|');if(key===lastHud)return;lastHud=key;
 $('best').textContent=best.toLocaleString();
 if(mode==='menu'){
  const playing=music.id==='menu'&&music.status==='playing'&&!muted;
  $('theme-status').textContent=playing?'LOUIS IS PLAYING · MENU THEME':music.status==='buffering'?'THE BAND IS BUFFERING…':'TAP TO HEAR LOUIS PLAY';
  $('theme').setAttribute('aria-label',playing?'Pause Moon over the Bayou':'Play Moon over the Bayou');document.querySelector('.sound-button').setAttribute('aria-label',playing?'Mute sound':'Play menu theme');$('performer-hint').textContent=playing?'LIVE FROM THE BAYOU ♫':'LET LOUIS PLAY ♫';return;
 }
 $('score').textContent=String(core.score).padStart(6,'0');$('combo').textContent=core.combo;$('combo-caption').textContent=core.combo>=10?'SWEET STREAK!':'COMBO';
 $('hearts').querySelectorAll('span').forEach((el,i)=>el.classList.toggle('lost',i>=core.hearts));$('hearts').setAttribute('aria-label',core.hearts+' hearts remaining');$('misses').textContent=core.missMeter+' / 3';
 $('misses').parentElement.classList.toggle('danger',core.missMeter===2);
 $('misses').setAttribute('aria-label',`${core.missMeter} of 3 mistakes toward the next lost heart. Missed pastries and bad presses both count.`);
 $('heat').querySelectorAll('i').forEach((el,i)=>{el.classList.toggle('on',i<=p.tier);el.style.setProperty('--charge',i===p.tier+1?Math.round(p.tierProgress*100)+'%':'0%');});
 $('heat').setAttribute('aria-label',`${NAMES[core.level]} pace ${p.tier+1} of 5: ${p.label}. ${p.tier===4?'Maximum pace.':Math.round(p.tierProgress*100)+' percent to the next tier.'}`);
 $('heat').title=`${p.label} · drop gaps: ${p.cadence.join(', ')} beats · fall: ${p.flightBeats} beats`;
 $('pace-label').textContent=`PACE ${p.tier+1} / 5`;
 const track=TRACKS[AREAS[core.level]];$('stage-label').textContent=`0${core.level+1} · ${NAMES[core.level].replace('The ','').toUpperCase()}${music.status==='buffering'?' · BUFFERING':''}`;$('song-title').textContent=track.title;$('bpm').textContent=Math.round(track.bpm);
 $('accuracy').textContent=(core.catches+core.counts.miss+core.counts.bad+core.counts.thorn)?fmtAcc(acc):'—';$('mult').textContent='×'+(1+Math.min(3,Math.floor(core.combo/10)));
 $('elapsed').textContent=fmt(t);$('duration').textContent=fmt(music.duration(AREAS[core.level]));$('progress').style.width=clamp(t/music.duration(AREAS[core.level])*100,0,100)+'%';
 $('journey').textContent=AREAS.map((x,i)=>`${i<core.level?'✓':i===core.level?'▸':'·'} ${['BAYOU','RIVERBOAT','CITY'][i]}`).join('  ');
}
// Scene render: scenery stays behind the readable note highway, never behind timing.
function backdrop(){
 const idx=mode==='menu'?0:core.level, bg=images[idx===0?'background':AREAS[idx]];
 if(bg){if(idx===0)ctx.drawImage(bg,0,0,480,680);else{ctx.drawImage(bg,0,0,480,600);ctx.drawImage(bg,0,540,480,60,0,600,480,80);}}else{ctx.fillStyle='#092638';ctx.fillRect(0,0,480,680);}
 if(idx>0){const g=ctx.createLinearGradient(0,0,0,680);g.addColorStop(0,'#03162777');g.addColorStop(.64,'#061b2922');g.addColorStop(1,'#060f2099');ctx.fillStyle=g;ctx.fillRect(0,0,480,680);}
 // Drifting fireflies, with fewer over the city; no sharp or full-screen flashes.
 const n=reducedMotion?8:idx===0?32:idx===1?23:12;
 for(let i=0;i<n;i++){const x=25+((i*127)%430)+Math.sin(ambient*.27+i*1.4)*14,y=40+((i*73)%520)+Math.sin(ambient*.32+i*2.1)*9,a=.25+.6*(.5+.5*Math.sin(ambient*1.4+i*1.7));ctx.globalAlpha=a;
  const r=ctx.createRadialGradient(x,y,0,x,y,8);r.addColorStop(0,'#e8f99cbb');r.addColorStop(1,'#c5d88100');ctx.fillStyle=r;ctx.fillRect(x-8,y-8,16,16);ctx.fillStyle='#f9efab';ctx.fillRect(Math.round(x),Math.round(y),2,2);
 }ctx.globalAlpha=1;
 // Small water glints live behind gameplay and remain entirely decorative.
 if(!reducedMotion&&idx<2){ctx.save();ctx.globalAlpha=.18;for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#d7c682':'#74aab2';const x=idx===0?310+Math.sin(ambient*.7+i)*12:5+((ambient*8+i*3)%25),y=idx===0?485+i*4:409+i*8;ctx.fillRect(x,y,7+i,2);}ctx.restore();}
 if(idx===1){ // Warm lantern strings, slow paddle wheel, and drifting steam.
  ctx.save();ctx.beginPath();ctx.rect(0,424,78,50);ctx.clip();ctx.translate(38,460);ctx.rotate(reducedMotion?0:ambient*.5);ctx.strokeStyle='#926447';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4);ctx.fillStyle='#83513b';ctx.fillRect(4,-2,31,4);ctx.fillStyle='#b17a4a';ctx.fillRect(29,-5,5,10);ctx.restore();}ctx.restore();
  if(!reducedMotion){ctx.save();for(const x of [70,392])for(let i=0;i<8;i++){const life=(ambient*.1+i/8)%1,size=7+life*21;ctx.globalAlpha=(1-life)*.10;ctx.fillStyle='#899d9c';ctx.fillRect(Math.round((x+life*24+Math.sin(life*7+i)*5)/2)*2,Math.round((131-life*77)/2)*2,size,size*.6);}ctx.restore();}

  for(let i=0;i<9;i++){const x=20+i*55,y=200+Math.sin(i/8*Math.PI)*20;ctx.fillStyle='#fff0a7';ctx.shadowColor='#fbd87f';ctx.shadowBlur=10;ctx.fillRect(x,y,3,4);}ctx.shadowBlur=0;
 }else if(idx===2){for(const x of [31,448]){const g=ctx.createRadialGradient(x,335,2,x,335,42);g.addColorStop(0,'#f6c36530');g.addColorStop(1,'#ecb04400');ctx.fillStyle=g;ctx.fillRect(x-42,293,84,84);}}
}
function drawPerformance(){
 const im=images.performer;if(!im)return;const track=TRACKS.menu,t=music.id==='menu'?music.time():0,phase=timePhase(t,track),playing=music.id==='menu'&&music.status==='playing'&&!muted;
 const env=window.BAYOU_MENU_ENVELOPE,ei=Math.floor(t*10);menuEnvelope=playing?(env?((env[ei]||0)/255):.6):0;
 const strength=playing?Math.max(.18,menuEnvelope):0,pulse=phase.pulse*strength;
 const sway=reducedMotion?0:playing?Math.sin(t*2*Math.PI/(60/track.bpm*4))*.015:Math.sin(ambient*.9)*.003;
 const bob=reducedMotion?0:playing?pulse*2:Math.sin(ambient*1.2)*.5;
 ctx.save();ctx.translate(240,523-bob);ctx.rotate(sway);const s=.59;ctx.scale(s,s);ctx.drawImage(im,-im.width/2,-im.height);
 // Cheek breath: puff only the cheek, keeping mouthpiece and trumpet connected.
 if(playing&&!reducedMotion){ctx.save();const x=-im.width/2+166,y=-im.height+115;ctx.beginPath();ctx.ellipse(x,y,50,36,0,0,Math.PI*2);ctx.clip();const k=1+pulse*.035;ctx.translate(x,y);ctx.scale(k,k);ctx.drawImage(im,-im.width/2-x,-im.height-y);ctx.restore();}
 ctx.restore();
 document.querySelectorAll('.eq i').forEach((el,i)=>{el.style.height=(playing?16+65*(.4+.6*Math.sin(t*5+i*.8)**2)*strength:12)+'%';});
 if(playing&&phase.index!==lastEmitBeat&&phase.index>=0){lastEmitBeat=phase.index;if(!reducedMotion)musicalNotes.push({x:355,y:337,age:0,phase:phase.index,life:1.4});}
 for(const n of musicalNotes){ctx.globalAlpha=Math.max(0,1-n.age/n.life);ctx.fillStyle='#ffdf8a';ctx.shadowColor='#ffce5b';ctx.shadowBlur=8;ctx.font='bold 20px Georgia';ctx.fillText(n.phase%2?'♪':'♫',n.x+n.age*28,n.y-n.age*33+Math.sin(n.age*5)*5);}ctx.globalAlpha=1;ctx.shadowBlur=0;
}
function drawHighway(){
 const phase=core.director?core.director.phase(core.time):{pulse:0},pulse=phase.pulse;
 for(let i=0;i<3;i++){
  const x=LANES[i]-56,g=ctx.createLinearGradient(x,TOP,x,LINE+18);g.addColorStop(0,'#05101f77');g.addColorStop(.75,['#61234155','#71522444','#204d7355'][i]);g.addColorStop(1,['#80345888','#8b6a3399','#2e669188'][i]);ctx.fillStyle=g;ctx.fillRect(x,TOP,112,LINE-TOP+24);
  ctx.globalAlpha=.45+flash[i]*.5;ctx.strokeStyle=COLORS[i];ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,LINE+22);ctx.stroke();if(i===2){ctx.beginPath();ctx.moveTo(x+112,TOP);ctx.lineTo(x+112,LINE+22);ctx.stroke();}ctx.globalAlpha=1;
  if(flash[i]>.05){ctx.globalAlpha=flash[i]*.22;ctx.fillStyle=COLORS[i];ctx.fillRect(x,TOP,112,LINE-TOP+25);ctx.globalAlpha=1;}
  ctx.strokeStyle=COLORS[i];ctx.lineWidth=2;ctx.shadowColor=COLORS[i];ctx.shadowBlur=reducedMotion?2:7+pulse*8;ctx.beginPath();ctx.moveTo(x+2,LINE);ctx.lineTo(x+110,LINE);ctx.stroke();ctx.shadowBlur=0;
  ctx.globalAlpha=.65;ctx.fillStyle=COLORS[i];earShape(LANES[i],LINE+18,6);ctx.globalAlpha=1;
 }
 // Light metrical divisions make the target readable without taking over the scene.
 const track=TRACKS[AREAS[core.level]],b=window.BayouRhythm.upperBound(track.beats,core.time);
 ctx.strokeStyle='#a1d9d518';ctx.lineWidth=1;
 const flight=core.pressure().flightBeats*60/track.bpm;
 for(let j=b;j<Math.min(b+8,track.beats.length);j++){const dt=track.beats[j]+sync-core.time,y=LINE-dt/flight*(LINE-TOP);if(y<TOP||y>LINE)continue;ctx.beginPath();ctx.moveTo(74,y);ctx.lineTo(406,y);ctx.stroke();}
 $('beat-dot').classList.toggle('on',pulse>.35&&mode==='playing');
}
function earShape(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.arc(x-r*.9,y-r*.85,r*.58,0,Math.PI*2);ctx.arc(x+r*.9,y-r*.85,r*.58,0,Math.PI*2);ctx.fill();}
function spriteName(){
 const dir=['left','center','right'][playerLane],a=SPRITES.animations[dir];
 if(hitAge<.5)return SPRITES.animations.hit[Math.min(SPRITES.animations.hit.length-1,Math.floor(hitAge/.07))];
 if(actionAge<.165&&['perfect','great','good','bad'].includes(actionKind)){const opening=[1,1,5][playerLane],transition=[0,0,4][playerLane];return a.eat[actionAge<.025?transition:opening];}
 if(actionAge<.46&&['perfect','great','good'].includes(actionKind))return a.munch[Math.max(0,Math.floor((actionAge-.165)*12))%a.munch.length]||a.munch[0];
 return a.idle[Math.floor(ambient*2.4)%a.idle.length];
}
let lastSprite='center_idle_0';
function drawPlayer(){
 const name=spriteName(),frame=SPRITES.frames[name];lastSprite=name;if(!frame||!images.atlas)return;
 playerLean=lerp(playerLean,(playerLane-1)*6,.2);const scale=1.12,bob=reducedMotion?0:Math.sin(ambient*3)*.65;
 ctx.save();ctx.translate(240+playerLean,(canvas.clientWidth<340?559:579)+bob);if(hitAge<.32&&!reducedMotion)ctx.rotate(Math.sin(hitAge*35)*.025);
 // A soft stage shadow keeps feet firmly grounded.
 ctx.fillStyle='#03142166';ctx.beginPath();ctx.ellipse(0,-2,73,8,0,0,Math.PI*2);ctx.fill();
 ctx.drawImage(images.atlas,frame.x,frame.y,frame.w,frame.h,-frame.anchor[0]*scale,-frame.anchor[1]*scale,frame.w*scale,frame.h*scale);ctx.restore();
}
function itemAt(n){const spawn=n.spawnAt+sync,at=n.at+sync,f=(core.time-spawn)/Math.max(.1,at-spawn);return {x:LANES[n.lane],y:TOP+(LINE-TOP)*f,progress:f};}
function drawNotes(){
 for(const n of core.notes){if(n.resolved)continue;const pos=itemAt(n);if(pos.progress<0||pos.y>LINE+48)continue;const good=n.type==='beignet',im=images[good?'beignet':'thorn'];if(!im)continue;
  ctx.save();ctx.beginPath();ctx.rect(70,TOP,340,LINE-TOP+52);ctx.clip();ctx.globalAlpha=clamp(pos.progress*8,0,1);
  const glow=ctx.createRadialGradient(pos.x,pos.y,2,pos.x,pos.y,28);glow.addColorStop(0,good?'#fbd06544':'#a9bd5733');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(pos.x-28,pos.y-28,56,56);
  const g=ctx.createLinearGradient(pos.x,pos.y-45,pos.x,pos.y);g.addColorStop(0,'#ffffff00');g.addColorStop(1,good?'#ffe5a044':'#bca96b33');ctx.fillStyle=g;ctx.fillRect(pos.x-12,pos.y-45,24,40);
  ctx.translate(Math.round(pos.x),Math.round(pos.y));if(!reducedMotion)ctx.rotate(good?Math.sin(core.time*2+n.id)*.025:Math.sin(core.time+n.id)*.12);ctx.drawImage(im,-22,-22,44,44);ctx.restore();
 }
}
function drawEffects(){
 for(const s of snacks){const q=clamp(s.age/.16,0,1),x=lerp(s.x,240+(s.lane-1)*28,q),y=lerp(s.y,canvas.clientWidth<340?446:466,q)-Math.sin(q*Math.PI)*11,size=lerp(39,13,q);ctx.globalAlpha=q<.8?1:(1-q)*5;ctx.drawImage(images.beignet,x-size/2,y-size/2,size,size);}ctx.globalAlpha=1;
 for(const p of particles){ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}ctx.globalAlpha=1;
}
function render(){
 ctx.save();if(shake>0)ctx.translate(Math.sin(ambient*75)*shake*9,0);backdrop();
 if(mode==='menu'||mode==='loading')drawPerformance();else{drawHighway();drawPlayer();drawNotes();drawEffects();}
 ctx.restore();renderCount++;
}
function update(dt){
 ambient+=dt;judgeAge+=dt;paceNoticeAge+=dt;
 if(paceNoticeAge>1.5)$('pace-notice').classList.remove('show');actionAge+=dt;hitAge+=dt;shake=Math.max(0,shake-dt);flash=flash.map(x=>Math.max(0,x-dt*6));
 if(judgeAge>.62)$('judgment').classList.remove('show');
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=75*dt;}particles=particles.filter(p=>p.age<p.life);
 for(const s of snacks)s.age+=dt;snacks=snacks.filter(s=>s.age<.165);
 for(const n of musicalNotes)n.age+=dt;musicalNotes=musicalNotes.filter(n=>n.age<n.life);
 if(mode==='countdown'){
  countdown+=dt;const period=60/TRACKS[AREAS[core.level]].bpm,beat=Math.floor(countdown/period);
  if(beat!==lastCount&&beat<4){lastCount=beat;$('count-number').textContent=4-beat;effects.play('count');}
  if(countdown>=period*4)beginSong();
 }
 if(mode==='playing'){if(music.virtual)music.tick(dt);if(music.status==='playing')core.tick(music.time());}
 updateHud();
}
function loop(now){if(destroyed)return;const dt=lastFrame?Math.min((now-lastFrame)/1000,.05):0;lastFrame=now;update(dt);render();raf=requestAnimationFrame(loop);}
// Each genuine press is judged, including simultaneous presses in other lanes.
// Deduplicate the physical event identity, never by a global time window.
function pointerPress(e,lane){
 if(e.button>0)return;e.preventDefault();
 if(heldPointers.has(e.pointerId))return;
 heldPointers.add(e.pointerId);tap(lane);
}
for(const b of document.querySelectorAll('.pad')){
 listen(b,'pointerdown',e=>pointerPress(e,Number(b.dataset.lane)));
 // Screen-reader / programmatic activation has no pointer identity. Native
 // pointer clicks are ignored because their pointerdown already did the bite.
 listen(b,'click',e=>{if(e.detail===0&&!e.pointerType&&e.clientX===0&&e.clientY===0)tap(Number(b.dataset.lane));});
}
listen(window,'pointerup',e=>heldPointers.delete(e.pointerId));
listen(window,'pointercancel',e=>heldPointers.delete(e.pointerId));
listen(window,'keyup',e=>heldKeys.delete(e.code||e.key));
listen(window,'blur',clearHeldInputs);
listen(canvas,'pointerdown',e=>{
 if(e.button>0)return;e.preventDefault();if(mode==='menu'){playTheme();return;}
 const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*480;
 pointerPress(e,clamp(Math.floor((x-72)/112),0,2));
});
listen(document,'keydown',e=>{
 if(e.key==='Tab'&&!$('modal').hidden){const focusables=[...$('panel').querySelectorAll('button:not([hidden]),input')].filter(x=>!x.disabled),first=focusables[0],last=focusables.at(-1);if(!first)return;if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('panel'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('panel'))){e.preventDefault();first.focus();}return;}
 if(e.key==='Escape'||e.key.toLowerCase()==='p'){if(!e.repeat){e.preventDefault();if(mode==='paused')resume();else if(!$('modal').hidden)modalBack();else pause();}return;}
 if(!$('modal').hidden||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 const map={a:0,s:1,d:2,ArrowLeft:0,ArrowDown:1,ArrowUp:1,ArrowRight:2};let lane=map[e.key]??map[e.key.toLowerCase()];
 const focusedPad=document.activeElement?.closest?.('.pad');
 if(focusedPad&&(e.key==='Enter'||e.key===' '))lane=Number(focusedPad.dataset.lane);
 if(lane!==undefined&&mode==='playing'){
  e.preventDefault();const id=e.code||e.key;if(e.repeat||heldKeys.has(id))return;
  heldKeys.add(id);tap(lane);
 }
});
listen($('start'),'click',()=>{if(!saved.tutorialSeen)help(true);else startRun();});listen($('theme'),'click',playTheme);listen($('performer'),'click',playTheme);listen($('help'),'click',()=>help(false));listen($('pause'),'click',pause);
listen($('panel-close'),'click',()=>modalBack());
for(const b of document.querySelectorAll('.settings-button'))listen(b,'click',()=>showSettings());
for(const b of document.querySelectorAll('.sound-button'))listen(b,'click',()=>{if(mode==='menu'&&music.status!=='playing'){muted=false;setSound();playTheme();return;}muted=!muted;setSound();if(!muted)effects.unlock();});
listen(document,'visibilitychange',()=>{if(document.hidden){if(['playing','countdown','starting','preparing'].includes(mode))pause();else if(mode==='menu'){menuWasPlaying=music.id==='menu'&&music.intent==='playing';if(menuWasPlaying)music.pause();}}else if(mode==='menu'&&menuWasPlaying){menuWasPlaying=false;playTheme();}});
listen(window,'pagehide',()=>{music.pause();if(mode==='playing')pause();});
listen(window,'message',e=>{if(e.source!==window.parent||!parentOrigin||parentOrigin==='null'||e.origin!==parentOrigin||e.data?.source!=='bayou-host')return;if(e.data.command==='pause')pause();});
function loadImage(key,url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>reject(new Error('Could not load '+key));im.src=url;});}
Promise.all(Object.entries(ASSETS).map(([key,url])=>loadImage(key,url))).then(()=>{
 document.querySelectorAll('[data-asset]').forEach(el=>el.src=ASSETS[el.dataset.asset]);musicReady=true;$('loading').hidden=true;$('start').disabled=false;setMode('menu');setSound();updateHud();emit('ready',{stages:3,controls:'tap-to-munch',version:5});
}).catch(error=>{$('loading').innerHTML='<b>THE STAGE IS NOT READY.</b><small></small>';$('loading').querySelector('small').textContent=error.message+'. Reload the page or check the assets folder.';});
setSound();raf=requestAnimationFrame(loop);
window.BayouBites=Object.freeze({getState:()=>({...core.snapshot(),mode,music:{id:music.id,time:music.time(),status:music.status,muted,volume:musicVolume},syncMs:sync*1000,version:5}),pause,showSettings:()=>{if(mode==='playing')pause();showSettings(mode==='paused'?showPause:()=>closeModal());},destroy:()=>{destroyed=true;cancelAnimationFrame(raf);activeTicket++;music.destroy();listeners.forEach(fn=>fn());effects.ac?.close().catch(()=>{});},version:'5.0.0'});
if(params.get('debug')==='1')window.BayouDebug={core,music,images,tap,render,startRun,prepareStage,pause,resume,goHome,showSettings,
 virtual:(level=0)=>{clearHeldInputs();paceNoticeAge=10;$('pace-notice').classList.remove('show');music.enableVirtual();music.select(AREAS[level]);music.intent='playing';music.setStatus('playing');closeModal(false);$('loading').hidden=true;core.reset();core.sync=sync;core.begin(level,TRACKS[AREAS[level]].duration);setMode('playing');core.director.disabled=true;playerLane=1;hitAge=10;actionAge=10;judgeAge=10;snacks=[];particles=[];$('judgment').classList.remove('show');},
 freeze:()=>{music.intent='paused';},
 at:t=>{music.testTime=t;core.tick(t);updateHud();render();},
 add:(lane,at,type='beignet')=>core.add({spawnAt:Math.max(0,at-2),impactAt:at,flightBeats:4,arrivalBeatIndex:10},{lane,type}),
 setMode,phase:()=>({mode,lastSprite,actionAge,hitAge,menuEnvelope,renderCount,musicalNotes:musicalNotes.length}),
 fire:(lane,t)=>{music.testTime=t;const r=core.tap(lane,t);updateHud();render();return r;},
 settings:()=>({muted,musicVolume,effectsVolume,sync,reducedMotion}),
 setSync:v=>{sync=v;core.sync=v;}
};
})();
