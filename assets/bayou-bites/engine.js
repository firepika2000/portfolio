/* Bayou Bites v5: timing-only rhythm judgment; rendering/input-independent.
 * Every distinct physical press is judged. Duplicate DOM deliveries and key
 * auto-repeat are filtered at the input layer, NOT by a global time cooldown.
 * Empty/wrong/off-time presses and dropped pastries share the 3-miss heart rule.
 */
(function(root){
  'use strict';
  const W=Object.freeze({perfect:.045,great:.090,good:.150});
  const AREAS=['bayou','riverboat','city'];
  const PATTERNS=[[1,0,1,2,1,0,2,1],[0,1,2,1,0,0,2,2],[0,1,2,2,1,0,1,2]];
  const WEIGHTS=Object.freeze({perfect:1,great:.8,good:.5});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rand(n){n=(n^0x41c64e6d)>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
  function judge(error){const d=Math.abs(error);return d<=W.perfect+1e-9?'perfect':d<=W.great+1e-9?'great':d<=W.good+1e-9?'good':null;}
  const emptyCounts=()=>({perfect:0,great:0,good:0,miss:0,bad:0,thorn:0,dodged:0});
  class Engine{
    constructor(tracks,onEvent=()=>{}){this.tracks=tracks;this.onEvent=onEvent;this.sync=0;this.reset();}
    reset(){
      this.state='menu';this.level=0;this.time=0;this.duration=0;this.score=0;this.combo=0;this.maxCombo=0;
      this.hearts=3;this.missMeter=0;this.catches=0;this.quality=0;this.stageCombo=0;this.stageBestCombo=0;this.paceTier=0;
      this.counts=emptyCounts();this.notes=[];this.serial=0;this.completed=0;this.stageResults=[];this.dropped=0;this.director=null;
      this.stageStart={score:0,catches:0,quality:0,counts:emptyCounts()};
    }
    emit(type,detail={}){this.onEvent({level:this.level+1,time:this.time,...detail,type});}
    begin(level,duration){
      this.level=clamp(Math.round(Number(level)||0),0,2);this.duration=duration||this.tracks[AREAS[this.level]].duration;
      this.time=0;this.notes=[];this.dropped=0;this.state='playing';this.stageCombo=0;this.stageBestCombo=0;
      this.stageStart={score:this.score,catches:this.catches,quality:this.quality,counts:{...this.counts}};
      this.director=new root.BayouRhythm.Director(AREAS[this.level],this.tracks[AREAS[this.level]],{firstDrop:2,minDecision:.30,endMargin:.50});
      this.paceTier=this.pressure().tier;
      this.emit('levelstart',{duration:this.duration,pressure:this.pressure()});
    }
    performance(){return {catches:this.catches-this.stageStart.catches,quality:this.quality-this.stageStart.quality,
      bestCombo:this.stageBestCombo,priorQuality:this.stageStart.quality};}
    pressure(){return root.BayouRhythm.pressure(AREAS[this.level],this.time,this.duration||1,this.performance());}
    updatePace(){
      const p=this.pressure();
      if(p.tier>this.paceTier){const fromTier=this.paceTier;this.paceTier=p.tier;this.emit('paceup',{fromTier,toTier:p.tier,pressure:p});}
    }
    add(drop,force={}){
      const p=drop.pressure||this.pressure(),i=drop.arrivalBeatIndex||0,pattern=PATTERNS[this.level];
      // Higher tiers use the lane pattern on each drop rather than repeating a
      // beginner's lane, and add alternating mirrored phrases later in the run.
      let lane=pattern[Math.floor(i/(this.level===0&&p.tier<2?2:1))%pattern.length];
      if(this.level>0&&p.amount>.50&&(Math.floor(i/16)%2))lane=2-lane;
      const hazard=this.dropped>3&&!(this.level===0&&drop.impactAt<14)&&rand(i*199+this.level*1777)<p.hazardChance;
      const note={id:++this.serial,lane,type:hazard?'thorn':'beignet',spawnAt:drop.spawnAt,at:drop.impactAt,
        flightBeats:drop.flightBeats,paceTier:p.tier,resolved:false,...force};
      this.notes.push(note);this.dropped++;this.emit('drop',{...note,kind:note.type,pressure:p});return note;
    }
    /** One shared penalty path. counts.miss counts dropped FOOD only and
     * counts.bad counts bad PRESSES only; neither is added twice to accuracy.
     * A bad press leaves the actual food available for a correct recovery tap.
     */
    miss(rating,detail={}){
      if(this.state!=='playing')return {ignored:true};
      this.counts[rating==='bad'?'bad':'miss']++;this.combo=0;this.stageCombo=0;
      if(rating==='bad')this.score=Math.max(0,this.score-15);
      const missCount=this.missMeter+1,heartLost=missCount>=3;
      this.missMeter=heartLost?0:missCount;
      const event={rating,error:null,...detail,missCount,missMeter:this.missMeter,heartLost};
      this.emit('judge',event);
      if(heartLost)this.damage('misses');
      return event;
    }
    tick(time){
      if(this.state!=='playing'||!Number.isFinite(Number(time)))return;
      // Minor media-clock jitter must never rewind notes or re-open a judgment.
      this.time=clamp(Number(time),this.time,this.duration);this.updatePace();
      this.director.advance(this.time,()=>this.performance(),this.duration,d=>this.add(d));
      for(const n of this.notes){
        if(this.state!=='playing')break;
        if(!n.resolved&&this.time>n.at+this.sync+W.good+1e-8){
          n.resolved=true;n.resolvedAt=this.time;
          if(n.type==='thorn'){this.counts.dodged++;this.emit('dodge',{note:{...n}});}
          else this.miss('miss',{lane:n.lane,note:{...n},reason:'dropped'});
        }
      }
      this.notes=this.notes.filter(n=>!n.resolved||this.time-(n.resolvedAt||0)<.5);
      if(this.state==='playing'&&this.time>=this.duration-1e-7)this.complete();
    }
    tap(lane,time){
      if(this.state!=='playing'||!Number.isInteger(lane)||lane<0||lane>2||!Number.isFinite(Number(time)))return {ignored:true};
      this.tick(time);if(this.state!=='playing')return {ignored:true};
      const candidates=this.notes.filter(n=>!n.resolved&&n.lane===lane&&judge(this.time-(n.at+this.sync)))
        .sort((a,b)=>Math.abs(a.at+this.sync-this.time)-Math.abs(b.at+this.sync-this.time));
      const n=candidates[0];
      // No global debounce: pressing all lanes simultaneously must NOT produce
      // one free hit plus two silently ignored mistakes.
      if(!n)return this.miss('bad',{lane,reason:'mistap'});
      n.resolved=true;n.resolvedAt=this.time;const error=this.time-(n.at+this.sync);
      if(n.type==='thorn'){
        this.counts.thorn++;this.combo=0;this.stageCombo=0;
        this.emit('judge',{rating:'thorn',lane,note:{...n},error});this.damage('thorn');return {rating:'thorn',error};
      }
      const rating=judge(error);this.counts[rating]++;this.catches++;this.quality+=WEIGHTS[rating];
      this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.stageCombo++;
      this.stageBestCombo=Math.max(this.stageBestCombo,this.stageCombo);
      const multiplier=1+Math.min(3,Math.floor(this.combo/10)),points={perfect:100,great:70,good:40}[rating]*multiplier;
      this.score+=points;this.emit('judge',{rating,lane,note:{...n},error,points,multiplier});this.updatePace();
      return {rating,error,points};
    }
    damage(reason){
      if(this.state!=='playing')return;
      this.hearts=Math.max(0,this.hearts-1);this.emit('damage',{reason,hearts:this.hearts});
      if(this.hearts===0){this.state='gameover';this.emit('gameover',this.snapshot());}
    }
    accuracy(counts=this.counts){const denominator=counts.perfect+counts.great+counts.good+counts.miss+counts.bad+counts.thorn;
      return denominator?100*(counts.perfect+counts.great*.8+counts.good*.5)/denominator:0;}
    grade(a=this.accuracy()){return a>=99?'S+':a>=95?'S':a>=90?'A':a>=80?'B':a>=70?'C':a>=60?'D':'E';}
    complete(){
      if(this.state!=='playing')return;const counts={};for(const k of Object.keys(this.counts))counts[k]=this.counts[k]-this.stageStart.counts[k];
      const result={level:this.level+1,score:this.score-this.stageStart.score,catches:this.catches-this.stageStart.catches,
        counts,accuracy:this.accuracy(counts),peakPace:this.paceTier+1,bestCombo:this.stageBestCombo,totalMisses:counts.miss+counts.bad};
      this.stageResults.push(result);this.completed=this.level+1;this.state=this.level===2?'victory':'levelclear';
      this.emit(this.state,{...result,run:this.snapshot()});
    }
    snapshot(){return {state:this.state,level:this.level+1,time:this.time,duration:this.duration,score:this.score,combo:this.combo,
      maxCombo:this.maxCombo,hearts:this.hearts,missMeter:this.missMeter,totalMisses:this.counts.miss+this.counts.bad,
      catches:this.catches,quality:this.quality,performance:this.performance(),accuracy:this.accuracy(),grade:this.grade(),
      counts:{...this.counts},completed:this.completed,pressure:this.pressure(),
      stageResults:this.stageResults.map(x=>({...x,counts:{...x.counts}}))};}
  }
  root.BayouEngine=Object.freeze({Engine,judge,windows:W,weights:WEIGHTS,version:'5.0.0'});
})(typeof window!=='undefined'?window:globalThis);
