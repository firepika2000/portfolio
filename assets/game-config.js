/**
 * The Wrangler's Code — Cheese Run
 * ─────────────────────────────
 * GAME ASSET CONFIGURATION
 *
 * Edit paths here to swap out any asset without touching game code.
 * All paths are relative to the HTML file (the_wranglers_code.html).
 *
 * SPRITES  (3× game resolution — canvas renders at 2400×840 internally)
 * ───────
 * Drop PNG files into sprites/ matching the paths below.
 * If a sprite is missing the game falls back to its built-in canvas drawing,
 * so you can swap one asset at a time.
 *
 * All sprite dimensions are 3× the logical game size for crisp rendering:
 *
 *  player.png          408 × 252 px  — 4 frames wide (102 px each), 1 row
 *                      Frame order: stand | step-fwd | mid | step-back
 *                      Origin: top-left of hat, feet at bottom row edge
 *
 *  cheese.png          120 × 120 px  — single frame, centred on wheel
 *
 *  cactus_tall.png     108 × 174 px  — single frame, feet at bottom edge
 *  cactus_cluster.png  126 × 144 px  — single frame, feet at bottom edge
 *  tumbleweed.png      114 × 108 px  — single frame, centred
 *
 *  cloud.png           288 × 108 px  — single frame
 *                      White silhouette on transparent bg; game tints it via fillStyle
 *                      Bounding box covers base rect + upper bump together
 *                      Base rect starts at y=30 (bottom 78 px); bump is top-left 144×66 px
 */

const GAME_ASSETS = {

  /* ── AUDIO ── */
  audio: {
    title:   'audio/title_music.mp3',
    bg:      'audio/bg_music.mp3',
    credits: 'audio/credits_music.mp3',
  },

  /* ── VIDEO ── */
  video: {
    intro: 'video/intro.mp4',
    win:   'video/win.mp4',
  },

  /* ── SPRITES ── */
  sprites: {
    player:         'sprites/player.png',
    cheese:         'sprites/cheese.png',
    cactus_tall:    'sprites/cactus_tall.png',
    cactus_cluster: 'sprites/cactus_cluster.png',
    tumbleweed:     'sprites/tumbleweed.png',
    cloud:          'sprites/cloud.png',
  },
};
