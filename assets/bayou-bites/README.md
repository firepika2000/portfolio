# Bayou Bites — Adaptive Rhythm Edition v5.0.0

A touch-first, three-stage rhythm game. Good play increases the pace; random button presses can now end the run. This update keeps the v4 artwork, animated trumpet-playing menu, original recordings, timed munch animations, three stages, and embeddable layout.

## Play or embed

Open the separately supplied **bayou-bites-v5.html** in a browser for the self-contained version. It contains the scripts, images, and all four original MP3s (approximately 23 MB). Start the menu music by tapping Louis or the song card, then press START. The first-start help explains the updated rules.

For a website, keep this source folder intact and serve `index.html`. No build step, account, backend, CDN, or external service is needed. To run a local development server from this folder:

```sh
python -m http.server 8080
```

Open `http://localhost:8080/`. The single-file version needs no development server. Actual browser navigation support still needs testing on the intended device; see the validation section.

## Every press matters

Tap the matching lane's pad when the **center of a pastry meets the glowing line**. Tapping that lane on the playfield also works. A correct press turns Louis, opens his mouth, and munches the pastry. Position alone, a held key, a held touch, and dragging across lanes do not collect food.

**Missed pastries and bad presses share ONE miss meter. Every three remove one heart.**

| Action | Result |
|---|---|
| Correct lane, within the timing window | Eat the pastry, score points, increase combo and earned pace. |
| Let a pastry pass its late window | Add one miss; break combo. |
| Empty, wrong-lane, or off-time press | Add one miss; break combo; subtract 15 points, without going below zero. |
| Timed press on thorn fruit | Immediately lose one heart; break combo. |
| Let thorn fruit pass without pressing | Safe dodge. No miss. |

For example, one dropped pastry plus two bad presses costs one heart. Three bad presses do the same. Nine bad presses from full health can end the run even before the first pastry arrives. Successful catches do not clear the partially filled meter; a thorn hit does not clear it either. Score, hearts, combo, and the partial meter carry between stages. There is no automatic health refill.

A bad press does not remove or reserve a pastry. A valid correction can still catch it, even immediately after a wrong-lane press. If that pastry is never caught and subsequently expires, that is a separate miss from the earlier bad press. Each pastry itself expires only once.

Simultaneous physical presses are judged separately. Pressing all three lanes with one valid pastry can create one catch and two mistakes; extra presses are no longer silently swallowed by a global debounce. The input layer suppresses duplicate delivery of the **same physical contact**, generated pointer clicks, and keyboard auto-repeat. It does not suppress independent fast taps or other fingers.

The game ignores gameplay inputs while the menu, countdown, pause, result, loading, or audio-error state is active, and while media is buffering.

## Performance-driven pace

Each area has **five pace tiers**: Easy Groove, Picking Up, Sweet Groove, Hot Streak, and Fever. The HUD now shows `PACE 1 / 5` through `PACE 5 / 5`, charges the next segment as performance builds, and briefly announces each upgrade. The miss counter turns pink at 2/3.

Genuine successful catches and the best streak in the current stage account for 85% of the main difficulty ramp; elapsed song time contributes 15%. Perfect and Great timing build it faster than merely Good timing. Previously earned quality supplies a small carry-over bonus in later stages. A mistake breaks the live combo but **does not erase already-earned stage pace**. Restarting the run clears the ramp.

As tiers increase, items appear on more of the musical beats, spend fewer beats in the air, and have a higher thorn probability. Lane phrases become more demanding too. The later stages have higher base pressure: at equivalent pace tiers Riverboat has a greater real-time release rate and shorter fall than Bayou, and City has a greater release rate and shorter fall than Riverboat.

### Presets in `rhythm.js`

A cadence is the cyclic number of detected beats between releases. For example, `[1,1,2]` means successive-beat drops, then a one-beat rest, repeated. The entries are always whole beats, not unaligned millisecond timers. Tiers below are ordered 1 → 5.

| Stage | Release cadence by tier | Flight length by tier |
|---|---|---|
| Bayou | `[3]` → `[2]` → `[2,1]` → `[1,1,2]` → `[1,1,1,2]` | 6 → 5 → 4 → 4 → 3 beats |
| Riverboat | `[2]` → `[2,1]` → `[1,1,2]` → `[1,1,1,2]` → `[1]` | 5 → 4 → 3 → 3 → 2 beats |
| City | `[2,1]` → `[1,1,2]` → `[1,1,1,2]` → `[1,1,1,1,1,2]` → `[1]` | 5 → 4 → 3 → 3 → 2 beats |

At peak City pace, a new item is released on every detected beat and its normal flight lasts two beats. With the recording's analyzed nominal tempo of approximately 162 BPM, this is about 2.7 releases per second and roughly 0.74 seconds of flight. Actual timestamps come from the preserved beat map, not that rounded estimate. Every stage has a finite top tier; pace does not increase without limit.

Both release and catch-line arrival remain on actual mapped beats. The music is never sped up or pitch-shifted. **Already-falling items never accelerate or change their target time.** When a faster flight would overtake a previous item, the director rests a release beat rather than forcing overlapping catches. Arrival decisions are at least 300 ms apart. There are no mandatory simultaneous chords. A 500 ms tail margin leaves the final judgment window inside the song even at maximum positive calibration.

### Exact ramp / editable tuning

A Perfect catch earns 1 quality unit, Great earns 0.8, and Good earns 0.5. Bad presses, dropped pastries, and thorn hits earn none. The stage quality targets are 28 / 48 / 72 and best-stage-combo targets are 18 / 24 / 30 for Bayou / Riverboat / City.

```text
songProgress = clamp(stageTime / songDuration, 0, 1)
success      = clamp(stageQuality / qualityTarget, 0, 1)
streak       = clamp(bestStageCombo / comboTarget, 0, 1)
carry        = clamp(qualityEarnedBeforeThisStage / 400, 0, 0.10)
pressure     = clamp(0.15*songProgress + 0.65*success + 0.20*streak + carry, 0, 1)
tierIndex    = min(4, floor(5*pressure))
```

Tier thresholds are 0.20, 0.40, 0.60, and 0.80. All inputs to earned pressure are nondecreasing within a song. Holding, mashing, and merely surviving longer cannot build quality or streak pressure.

In the included deterministic, perfectly timed full-run simulation, Bayou upgrades occurred after approximately 6, 11, 17, and 24 catches. These are a test trace, not fixed catch-count thresholds; timing quality, song progress, and prior-stage performance affect real play. `tests/perfect-run-pace-trace.json` records all three stages.

## Timing and scoring remain unchanged

| Judgment | Absolute timing error | Base points | Accuracy / quality weight |
|---|---:|---:|---:|
| Perfect | ≤45 ms | 100 | 1.0 |
| Great | ≤90 ms | 70 | 0.8 |
| Good | ≤150 ms | 40 | 0.5 |
| Dropped pastry or bad press | No valid catch | 0 / −15 | 0 |
| Thorn hit | Thorn inside the window | 0 plus immediate heart loss | 0 |

The combo multiplier is ×1, ×2 at 10 catches, ×3 at 20, and ×4 at 30. Accuracy includes successful judgments, dropped pastries, bad presses, and thorn hits; safe dodges do not inflate it. Dropped food and bad presses have separate result counters and are added only once each to accuracy. `totalMisses = counts.miss + counts.bad` is their combined count. Rank thresholds remain S+ ≥99%, S ≥95%, A ≥90%, B ≥80%, C ≥70%, D ≥60%, and E below 60%.

Use A / S / D, or Left / Down / Right. Up also maps to center. Enter or Space operates a focused pad once per press. P or Escape pauses. The three timing windows stay the same across levels and pace tiers; challenge increases through the chart, not hidden narrowing of the window.

## Music and original presentation

| Screen / area | Recording | Existing analyzed duration | Existing analyzed tempo |
|---|---|---:|---:|
| Menu | Moon over the Bayou | 191.56 s, looping | 102.05 BPM |
| Bayou | Beignet Bounce | 99.60 s | 108.20 BPM |
| Riverboat | Fireflies & Crocodile Eyes | 203.20 s | 102.10 BPM |
| City | French Quarter Fever | 191.60 s | 161.87 BPM |

These are the preserved automatic analyses, not a new hand-charted transcription. A four-beat count-in precedes each stage; its actual recording then starts at the beginning. Stage completion follows the recording's end, using browser media duration when available. Intermissions wait for the player. Pausing freezes music and gameplay together. Muting keeps the media clock running. Blocked audio exposes a retry action instead of changing to an unrelated clock.

All original MP3 bytes, existing beat maps, sprite frames, and image assets are retained. Louis's trumpet-playing menu rig uses song time and the existing amplitude envelope for sway, breath, and emitted notes; it is not isolated-instrument detection. Eating, munching, hit poses, fireflies, riverboat animation, and the nighttime City scene remain.

Music and effects volumes, master mute, reduced motion, and manual timing adjustment from −250 to +250 ms are still available. A positive offset moves notes and judgments later. Calibration does not alter the song playback speed. A listening-based sync pass on the final device is still needed, especially for wireless audio.

v5 uses its own local personal-best key (`bayou-bites:v5`) because the rules and score opportunity changed. On the same origin it copies the prior v4 audio, timing, and motion preferences, but starts a fresh best score and shows the updated tutorial. The game runs without persistence when storage is unavailable.

## Website integration

A 12:17 iframe is the intended compact window:

```html
<iframe
  id="bayou-game"
  src="/games/bayou-bites/index.html?embed=1"
  title="Bayou Bites rhythm game"
  allow="autoplay"
  loading="lazy"
  style="display:block;width:100%;max-width:480px;aspect-ratio:12/17;border:0;border-radius:14px"
></iframe>
```

`embed=1` removes outside captions. Keep the source folder structure intact. `embed-example.html` shows a host page and message handling. In-game pads retain 44 px minimum height at the tested small sizes. Audio still waits for an explicit interaction; the iframe permission alone does not start music. A site's content-security policy must permit the local scripts/media/images; the standalone build additionally needs its inline content and data-URI assets permitted.

DOM events bubble from `#game` as `bayou:ready`, `bayou:judge`, `bayou:paceup`, `bayou:damage`, `bayou:levelstart`, `bayou:levelclear`, `bayou:victory`, and `bayou:gameover`, among others. Equivalent iframe messages have `source: 'bayou-bites'`, numeric `version: 5`, and an `event` name. The new `paceup` event includes the 1-based `pace` and the full `pressure` preset.

```js
window.addEventListener('message', event => {
  const frame = document.querySelector('#bayou-game');
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  if (event.data?.source !== 'bayou-bites') return;
  if (event.data.event === 'paceup') console.log('New pace:', event.data.pace);
});
```

Adapt origin checks for a genuinely different game origin. Incoming host commands accept only a pause request from the actual parent and the configured/referrer-derived origin. `parentOrigin` can be set explicitly in the iframe query. A local preview without a trustworthy origin ignores incoming commands. No publication or external deployment is performed by this package.

`window.BayouBites.getState()` provides score, timing, stage, playback, `totalMisses`, `performance`, and `pressure`. Public `pause()`, `showSettings()`, and `destroy()` methods remain. The string API version is `5.0.0`. Do not include `?debug=1` in a player-facing embed; it deliberately exposes development clock/engine helpers.

## Build and validate

```sh
python tools/build_standalone.py --out dist/bayou-bites-v5.html
node tools/test_engine.cjs
python tools/test_browser.py --html dist/bayou-bites-v5.html
# Optional, where browser navigation is permitted:
python tools/test_delivery.py --html dist/bayou-bites-v5.html
```

The builder uses Python's standard library. Engine tests use Node's built-ins. Browser tests require Python Playwright and Chromium; set `CHROMIUM_PATH` to the installed executable as needed.

**Executed validation:** 108 engine checks and 102 Chromium inline-document checks passed (210 total). These include full simulated journeys at Perfect/Great/Good timing, actual decoding and brief playback of all four MP3s, real browser pointer/key routing, emulated simultaneous three-finger mashing, mixed miss penalties, early wrong-lane recovery, duplicate-contact protection, five-tier progression, immutable in-flight schedules, beat alignment, and 280–480 px layouts. Test reports and actual captures are in `tests/`.

The browser used embedded bytes and an inline document for these executed checks. A separate localhost navigation attempt was blocked by the environment's browser administrator policy; HTTP/hosted embedding and direct-file navigation are **not verified here**. The block is recorded in `tests/delivery-results.json`, not counted as a passing test. Physical iPhone/Android, Safari/WebKit, real-device audible/input latency, and human listening-based beat alignment remain untested. These limitations do not invalidate the executed engine/inline tests, but should be checked before publishing the game.

`tools/test_delivery.py` is supplied for an environment that permits navigation. It starts only a temporary loopback server and performs no public deployment. `tests/audio-integrity.json` verifies that all four original recordings are unchanged.

## Source map

`rhythm.js` owns cadence presets and adaptive scheduling. `engine.js` owns judgments, counters, the shared miss penalty, and performance tracking. `game.js` owns physical-input identity, rendering, UI, sound effects, and state transitions. `music.js` is the original media transport. `track-data.js`, `sprite-data.js`, `menu-envelope.js`, and `assets/` preserve the existing recordings and presentation. The standalone packager combines those exact files.

This is a user-requested fan-game prototype, not an official Disney or Konami product. The package does not establish authorization for commercial distribution of the character, imagery, or recordings.
