import { MALS, MAL_LIST, MOVES, ITEMS, TMS, MAPS, TYPE_COLORS, EVOLUTIONS, effectiveness, NAME_ALIASES, ABILITY_INFO, ABILITY_EFFECTS } from './data.js?v=20261122.2';
import { music, MAL_CRY_PROFILES, musicLayers } from './audio-data.js?v=20261122.2';
const STARTER_NAMES = ['Kangol', 'Bubbish', 'Lizrout'];
const STARTER_PERSONALITIES = ['BOLD / BOUNCY', 'SOFT / CURIOUS', 'WATCHFUL / STEADY'];
const RIVAL_STARTERS = {
  Kangol: 'Bubbish', Bubbish: 'Lizrout', Lizrout: 'Kangol',
  Seedkit: 'Cinderp', Cinderp: 'Ripplet', Ripplet: 'Seedkit',
};

// Storage wrapper: keep the game playable when browser storage is unavailable.
const safeStorage = {
  getItem(key) {
    try { return window.localStorage.getItem(key); }
    catch (error) { console.warn('Pocketmals storage unavailable; using session defaults.', error); return null; }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (error) { console.warn('Pocketmals could not persist this save/settings change.', error); return false; }
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key); return true; }
    catch (error) { console.warn('Pocketmals could not clear invalid stored data.', error); return false; }
  }
};
const SETTINGS_KEY = 'pocketmals-options';
const gameSettings = { textSpeed: 1, frameStyle: 0, soundEffects: true, musicMuted: false };
const savedSettingsRaw = safeStorage.getItem(SETTINGS_KEY);
if (savedSettingsRaw) {
  try {
    const savedSettings = JSON.parse(savedSettingsRaw);
    if (savedSettings && typeof savedSettings === 'object' && !Array.isArray(savedSettings)) {
      if ([0, 1, 2].includes(savedSettings.textSpeed)) gameSettings.textSpeed = savedSettings.textSpeed;
      if ([0, 1, 2].includes(savedSettings.frameStyle)) gameSettings.frameStyle = savedSettings.frameStyle;
      if (typeof savedSettings.soundEffects === 'boolean') gameSettings.soundEffects = savedSettings.soundEffects;
      if (typeof savedSettings.musicMuted === 'boolean') gameSettings.musicMuted = savedSettings.musicMuted;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn('Could not read saved Pocketmals options; using defaults.', error);
    safeStorage.removeItem(SETTINGS_KEY);
  }
}
function saveSettings() {
  safeStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings));
}

const shellColorPicker = document.getElementById('shell-color');
const savedShellColor = safeStorage.getItem('pocketmals-ds-shell-color');
if (savedShellColor && /^#[\da-f]{6}$/i.test(savedShellColor)) {
  shellColorPicker.value = savedShellColor;
}
function updateShellTheme(color) {
  document.documentElement.style.setProperty('--ds-shell-color', color);
  document.documentElement.style.setProperty('--ds-trim-color', `color-mix(in srgb, ${color}, #8995a2 22%)`);
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  document.documentElement.style.setProperty('--button-ink', luminance < 0.48 ? '#ffffff' : '#171b22');
}
updateShellTheme(shellColorPicker.value);
shellColorPicker.addEventListener('input', () => {
  updateShellTheme(shellColorPicker.value);
  safeStorage.setItem('pocketmals-ds-shell-color', shellColorPicker.value);
});


const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const lowerCanvas = document.getElementById('lower-screen');
const lowerCtx = lowerCanvas.getContext('2d');
const W = 320, H = 240, TS = 16;
const CANVAS_DENSITY = 2;
for (const screen of [canvas, lowerCanvas]) {
  screen.width = W * CANVAS_DENSITY;
  screen.height = H * CANVAS_DENSITY;
}
ctx.scale(CANVAS_DENSITY, CANVAS_DENSITY);
lowerCtx.scale(CANVAS_DENSITY, CANVAS_DENSITY);
ctx.imageSmoothingEnabled = false;
lowerCtx.imageSmoothingEnabled = false;
const topBezel = document.querySelector('.top-bezel');
const bottomBezel = document.querySelector('.bottom-bezel');
const gameStage = document.querySelector('.game-stage');
const controlPanel = document.querySelector('.controls');
const hinge = document.querySelector('.hinge');
function fit() {
  // Fit both 320x240 screens together without forcing a minimum that can crop.
  const styles = getComputedStyle(gameStage);
  const px = value => parseFloat(value) || 0;
  const topBounds = topBezel.getBoundingClientRect();
  const bottomBounds = bottomBezel.getBoundingClientRect();
  const topScreen = canvas.getBoundingClientRect();
  const bottomScreen = lowerCanvas.getBoundingClientRect();
  const horizontalChrome = px(styles.paddingLeft) + px(styles.paddingRight)
    + Math.max(0, topBounds.width - topScreen.width)
    + Math.max(0, bottomBounds.width - bottomScreen.width);
  const verticalChrome = px(styles.paddingTop) + px(styles.paddingBottom)
    + Math.max(0, topBounds.height - topScreen.height)
    + Math.max(0, bottomBounds.height - bottomScreen.height)
    + controlPanel.offsetHeight + hinge.offsetHeight + px(styles.rowGap) * 3;
  const availableWidth = Math.max(1, gameStage.clientWidth - horizontalChrome);
  const availableHeight = Math.max(1, gameStage.clientHeight - verticalChrome);
  const scale = Math.max(0.05, Math.min(availableWidth / W, availableHeight / (H * 2)));
  for (const screen of [canvas, lowerCanvas]) {
    screen.style.width = Math.floor(W * scale) + 'px';
    screen.style.height = Math.floor(H * scale) + 'px';
  }
}
addEventListener('resize', fit);
const layoutObserver = new ResizeObserver(fit);
layoutObserver.observe(gameStage);
layoutObserver.observe(controlPanel);
fit();

// ---------- Audio (original procedural chiptune, no external assets) ----------
let actx = null;
let muted = gameSettings.musicMuted;
let musicTrack = '';
let musicStep = 0;
let nextMusicNote = 0;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;


function beep(freq, dur = 0.08, type = 'square', vol = 0.04, when = actx && actx.currentTime) {
  if (!actx || !gameSettings.soundEffects || !freq) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g).connect(actx.destination);
  o.start(when);
  o.stop(when + dur);
}
function startAudio() {
  if (!AudioContextClass) return;
  try {
    // Recover if a browser has closed an earlier context, and never let audio
    // initialization prevent a menu action or battle from continuing.
    if (!actx || actx.state === 'closed') actx = new AudioContextClass();
    if (actx.state === 'suspended') {
      const resume = actx.resume();
      if (resume && typeof resume.catch === 'function') {
        resume.catch((error) => console.warn('Pocketmals audio could not resume; gameplay will continue.', error));
      }
    }
  } catch (error) {
    actx = null;
    console.warn('Pocketmals audio is unavailable in this browser; gameplay will continue without sound.', error);
  }
}


// ---------- Original Pocketmal cries ----------
// Each creature has its own short melodic contour, register, timbre and texture.
// These are generated locally with Web Audio; no copyrighted voice clips are used.


function playMalCry(name, variant = 'normal') {
  if (!gameSettings.soundEffects || !AudioContextClass) return;
  startAudio();
  if (!actx) return;
  if (variant === 'sendout') sfx.release();

  const profile = MAL_CRY_PROFILES[name];
  if (!profile) return;

  const now = actx.currentTime + 0.025;
  const pitchScale = variant === 'faint' ? 0.78 : variant === 'evolve' ? 1.08 : variant === 'caught' ? 1.04 : 1;
  const loudness = variant === 'preview' ? 0.78 : 1;

  for (const [offset, from, to, duration] of profile.notes) {
    const start = now + offset;
    const end = start + duration;
    const base = profile.pitch * pitchScale;

    // Main vocal tone with a species-specific pitch glide and gentle vibrato.
    const voice = actx.createOscillator();
    const voiceFilter = actx.createBiquadFilter();
    const voiceGain = actx.createGain();
    voice.type = profile.wave;
    voice.frequency.setValueAtTime(base * from, start);
    voice.frequency.exponentialRampToValueAtTime(base * to, end);
    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(profile.cutoff, start);
    voiceFilter.Q.value = 1.1;
    const peak = 0.041 * loudness;
    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.linearRampToValueAtTime(peak, start + Math.min(0.012, duration * 0.22));
    voiceGain.gain.setValueAtTime(peak * 0.72, start + duration * 0.56);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);
    voice.connect(voiceFilter).connect(voiceGain).connect(actx.destination);
    voice.start(start);
    voice.stop(end + 0.015);

    const vibrato = actx.createOscillator();
    const vibratoDepth = actx.createGain();
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(profile.vibrato, start);
    vibratoDepth.gain.setValueAtTime(profile.wobble, start);
    vibrato.connect(vibratoDepth).connect(voice.frequency);
    vibrato.start(start);
    vibrato.stop(end + 0.01);

    // A quiet upper partial gives the cry a more voiced, rounded quality.
    const overtone = actx.createOscillator();
    const overtoneFilter = actx.createBiquadFilter();
    const overtoneGain = actx.createGain();
    overtone.type = profile.wave === 'sawtooth' ? 'triangle' : 'sine';
    overtone.frequency.setValueAtTime(base * from * 2.01, start);
    overtone.frequency.exponentialRampToValueAtTime(base * to * 2.01, end);
    overtoneFilter.type = 'lowpass';
    overtoneFilter.frequency.setValueAtTime(profile.cutoff * 1.25, start);
    overtoneGain.gain.setValueAtTime(0.0001, start);
    overtoneGain.gain.linearRampToValueAtTime(0.010 * loudness, start + Math.min(0.01, duration * 0.2));
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, end);
    overtone.connect(overtoneFilter).connect(overtoneGain).connect(actx.destination);
    overtone.start(start);
    overtone.stop(end + 0.015);

    // A tiny filtered breath/noise layer varies the texture between species.
    if (profile.air > 0) {
      const noiseLength = Math.max(1, Math.floor(actx.sampleRate * Math.min(0.055, duration * 0.5)));
      const noiseBuffer = actx.createBuffer(1, noiseLength, actx.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i++) samples[i] = Math.random() * 2 - 1;
      const noise = actx.createBufferSource();
      const noiseFilter = actx.createBiquadFilter();
      const noiseGain = actx.createGain();
      noise.buffer = noiseBuffer;
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(profile.cutoff * 0.68, start);
      noiseFilter.Q.value = 0.8;
      noiseGain.gain.setValueAtTime(0.0001, start);
      noiseGain.gain.linearRampToValueAtTime(profile.air * loudness, start + 0.006);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + noiseLength / actx.sampleRate);
      noise.connect(noiseFilter).connect(noiseGain).connect(actx.destination);
      noise.start(start);
      noise.stop(start + noiseLength / actx.sampleRate + 0.008);
    }
  }
}
function playMusicTone(freq, dur, waveform, volume, when, steel = false) {
  if (!actx || muted || !freq) return;
  volume = (volume || 0.05) * 0.72;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  const filter = actx.createBiquadFilter();
  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, when);
  if (steel) {
    osc.frequency.setValueAtTime(freq * 1.035, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq * 0.985), when + dur * 0.72);
    osc.detune.setValueAtTime(-3, when);
  }
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(steel ? 5200 : 7200, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(filter).connect(gain).connect(actx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.012);
}

function playMusicDrum(kind, when) {
  if (!actx || muted || !kind) return;
  if (kind === 'kick') {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, when);
    osc.frequency.exponentialRampToValueAtTime(47, when + 0.12);
    gain.gain.setValueAtTime(0.045, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    osc.connect(gain).connect(actx.destination);
    osc.start(when);
    osc.stop(when + 0.15);
    return;
  }
  const duration = kind === 'hat' ? 0.035 : 0.085;
  const length = Math.max(1, Math.floor(actx.sampleRate * duration));
  const buffer = actx.createBuffer(1, length, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = actx.createBufferSource();
  const filter = actx.createBiquadFilter();
  const gain = actx.createGain();
  source.buffer = buffer;
  filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
  filter.frequency.value = kind === 'hat' ? 6200 : 1700;
  gain.gain.setValueAtTime(kind === 'hat' ? 0.009 : 0.02, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(filter).connect(gain).connect(actx.destination);
  source.start(when);
  source.stop(when + duration + 0.01);
}



function setMusicLayer(name, enabled) {
  if (Object.prototype.hasOwnProperty.call(musicLayers, name)) {
    musicLayers[name] = !!enabled;
  }
}

function setGameSeason(season) {
  const allowed = ['spring', 'summer', 'autumn', 'winter'];
  if (!allowed.includes(season) || !S) return;
  S.season = season;
  save();
  // The sequencer clock is deliberately not reset: the new layer enters on beat.
}

// Expose only small audio controls so later seasonal events can swap lanes.
window.PocketmalsAudio = {
  setLayer: setMusicLayer,
  setSeason: setGameSeason,
  getSeason: () => S?.season || 'spring',
  playCry: (name) => playMalCry(name, 'preview'),
};

function updateMusic() {
  if (!actx || muted) return;

  const areaTracks = {
    pocketown: 'covo', route1: 'route1', sunmeadow: 'solara',
    whisperwood: 'ombra', starlit: 'altoRidge', league: 'league',
  };
  const roomTrack = S?.room?.type?.startsWith('gym') ? 'gym' : S?.room?.type;
  const track = mode === 'battle' ? 'battle'
    : mode === 'opening' ? 'opening'
    : mode === 'title' || mode === 'select' ? 'title'
      : S && S.room ? roomTrack
        : areaTracks[S?.map] || 'world';

  if (track !== musicTrack) {
    musicTrack = track;
    musicStep = 0;
    nextMusicNote = actx.currentTime + 0.045;
  }

  if (nextMusicNote < actx.currentTime - 0.2) {
    nextMusicNote = actx.currentTime + 0.045;
  }

  const song = music[track] || music.world;
  const isWalking = !!(S && !S.room && moving && track !== 'world');
  const isSummer = !!(S && S.season === 'summer');

  // All instrument lanes share this one clock. Toggling a lane never restarts it.
  while (nextMusicNote < actx.currentTime + 0.13) {
    const step = musicStep % 16;
    // Each location now plays an eight-bar arrangement: A, A-prime, B, C,
    // then a varied return. The chord root changes at each bar instead of
    // endlessly replaying the exact same 16-note loop.
    const phrase = Math.floor(musicStep / 16) % 8;
    const phraseStyle = phrase % 4; // A / A' / bridge / turnaround
    const progressions = {
      opening:[0, 5, 3, 7, 0, 2, 5, 7],
      title:  [0, 5, 7, 2, 0, 3, 5, 7],
      world:  [0, 5, 2, 7, 3, 0, 5, 7],
      route:  [0, 5, 2, 7, 3, 0, 5, 2],
      forest: [0, 3, 5, 2, 0, 7, 3, 5],
      lab:    [0, 5, 2, 7, 3, 5, 0, 7],
      center: [0, 7, 5, 3, 0, 2, 5, 7],
      gym:    [0, 5, 7, 2, 0, 3, 5, 7],
      battle: [0, 3, 5, 7, 0, 5, 2, 7],
      covo: [0, 5, 3, 7, 0, 2, 5, 3],
      route1: [0, 5, 2, 7, 3, 0, 5, 2],
      solara: [0, 3, 5, 2, 0, 5, 7, 3],
      ombra: [0, 3, 7, 2, 0, 5, 3, 7],
      altoRidge: [0, 5, 2, 7, 3, 5, 0, 2],
      league: [0, 5, 7, 3, 0, 2, 5, 7],
    };
    const shift = (progressions[track] || progressions.world)[phrase];
    // The B section breathes; the turnaround builds back into the next phrase.
    const phraseMix = phraseStyle === 2 ? 0.68 : phraseStyle === 3 ? 1.16 : phraseStyle === 1 ? 0.92 : 1;
    const semitone = (freq, amount = 0) => freq ? freq * Math.pow(2, amount / 12) : 0;
    let lead = song.lead[step];
    let harmony = song.harmony[step];
    let bass = song.bass[Math.floor(step / 2) % song.bass.length];
    let arp = song.arp[step];

    // The bridge changes the melodic contour, and the other phrases add
    // pickups and turnarounds while retaining each area's own theme identity.
    if (phraseStyle === 1 && [7, 15].includes(step)) {
      lead = song.arp[(step + 3) % song.arp.length] || lead;
    } else if (phraseStyle === 2 && step % 4 === 2) {
      lead = song.harmony[(step + 5) % song.harmony.length] || lead;
      if (lead) lead *= 2;
    } else if (phraseStyle === 3 && [12, 14, 15].includes(step)) {
      lead = song.lead[(step + 1) % song.lead.length] || lead;
    }

    lead = semitone(lead, shift);
    harmony = semitone(harmony, shift);
    bass = semitone(bass, shift - (phraseStyle === 2 ? 2 : 0));
    arp = semitone(arp, shift);

    if (musicLayers.melody && lead) {
      playMusicTone(lead, song.tempo * 0.76, 'square', 0.016 * phraseMix, nextMusicNote);
    }
    if (musicLayers.harmony && harmony) {
      playMusicTone(harmony, song.tempo * 1.35, 'triangle', 0.008 * phraseMix, nextMusicNote);
    }
    if (musicLayers.bass && bass && step % 2 === 0) {
      playMusicTone(bass, song.tempo * 1.8, 'triangle', phraseStyle === 2 ? 0.015 : phraseStyle === 3 ? 0.03 : 0.024, nextMusicNote);
    }
    if (musicLayers.arpeggio && arp && step % 2 === 1) {
      playMusicTone(arp * 2, song.tempo * 0.34, 'square', 0.0045 * phraseMix, nextMusicNote);
    }

    // A small counter-line answers the lead on alternating beats.
    const counterSource = song.harmony[(step + (phraseStyle === 2 ? 3 : 8)) % song.harmony.length]
      || song.arp[(step + 5) % song.arp.length] * 0.5;
    if (musicLayers.counter && counterSource && [2, 6, 10, 14].includes(step)) {
      playMusicTone(semitone(counterSource * 1.5, shift), song.tempo * 0.48, 'sine', 0.0055 * phraseMix, nextMusicNote);
    }

    // Triad accents mark the start of each half-bar, with a softer mix so the
    // melody remains clear on laptop speakers and mobile devices.
    if (musicLayers.chords && (step === 0 || step === 8)) {
      const root = semitone(song.bass[0] * 1.65, shift);
      playMusicTone(root, song.tempo * 1.45, 'triangle', 0.0048, nextMusicNote);
      playMusicTone(semitone(root, 4), song.tempo * 1.25, 'triangle', 0.0038, nextMusicNote);
      playMusicTone(semitone(root, 7), song.tempo * 1.25, 'triangle', 0.0038, nextMusicNote);
    }

    if (musicLayers.percussion) {
      // Pull percussion back in the bridge, then add a fill on the build/turnaround.
      const quietBridge = phraseStyle === 2;
      if (!quietBridge || step === 2 || step === 10) {
        playMusicDrum(quietBridge ? 'hat' : song.drums[step], nextMusicNote);
      }
      if (!quietBridge && phraseStyle === 3 && step >= 12 && step % 2 === 0) playMusicDrum('hat', nextMusicNote);
      if (!quietBridge && (phrase === 3 || phrase === 7) && step === 15) playMusicDrum('snare', nextMusicNote);
    }

    // Walking adds a synced light rhythm accent without restarting the tune.
    if (musicLayers.walking && isWalking && (step === 4 || step === 12)) {
      playMusicDrum('snare', nextMusicNote);
      if (step === 12) playMusicDrum('hat', nextMusicNote + song.tempo * 0.25);
    }

    // Summer's little bell-like layer follows the same chord progression.
    if (musicLayers.seasonal && isSummer && song.summer[step]) {
      playMusicTone(semitone(song.summer[step], shift), song.tempo * 0.65, 'triangle', 0.012, nextMusicNote, true);
    }

    musicStep++;
    nextMusicNote += song.tempo;
  }
}

function setMuted(value) {
  muted = value;
  gameSettings.musicMuted = muted;
  saveSettings();
  const button = document.getElementById('sound-toggle');
  button.textContent = muted ? 'Music: Off' : 'Music: On';
  button.setAttribute('aria-pressed', String(!muted));
  if (!muted) {
    startAudio();
    musicTrack = '';
  }
}
const sfx = {
  ok: () => {
    beep(740, 0.04, 'triangle', 0.028);
    beep(988, 0.05, 'sine', 0.018, actx && actx.currentTime + 0.04);
  },
  menu: () => beep(620, 0.03, 'triangle', 0.022),
  bump: () => beep(140, 0.05, 'square', 0.018),
  step: () => beep(196, 0.028, 'triangle', 0.012),
  encounter: () => [330, 415, 523, 622, 784].forEach((f, i) => setTimeout(() => beep(f, 0.09, i % 2 ? 'triangle' : 'square', 0.028), i * 55)),
  hit: () => {
    if (!actx) return;
    const t = actx.currentTime;
    beep(210, 0.07, 'sawtooth', 0.032, t);
    beep(130, 0.11, 'triangle', 0.024, t + 0.05);
    beep(90, 0.08, 'sine', 0.016, t + 0.09);
  },
  catchFail: () => [622, 494, 370].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'triangle', 0.026), i * 95)),
  heal: () => [523, 659, 784, 880, 988, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'sine', 0.02), i * 90)),
  catch: () => [523, 659, 784, 988, 1175, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.026), i * 100)),
  level: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'sine', 0.024), i * 80)),
  release: () => {
    if (!actx) return;
    const t = actx.currentTime;
    beep(440, 0.08, 'sine', 0.02, t);
    beep(660, 0.1, 'triangle', 0.022, t + 0.06);
    beep(880, 0.12, 'sine', 0.016, t + 0.14);
  },
};

// ---------- Input ----------
const keys = {};
let pressed = null;
const KEYMAP = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', ArrowRight: 'right', d: 'right',
  a: 'a', b: 'b', x: 'x', y: 'y', z: 'a', c: 'x', v: 'y',
  Enter: 'start', ' ': 'start', Backspace: 'select', Escape: 'b', Shift: 'run',
};
function press(k) {
  startAudio();
  pressed = k;
  keys[k] = true;
}
addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('#sound-toggle, #nickname-form, #trainer-form')) return;
  const k = KEYMAP[e.key];
  if (k) {
    if (e.repeat && k === 'run') return;
    e.preventDefault();
    press(k);
  }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
document.querySelectorAll('[data-k]').forEach((b) => {
  b.addEventListener('pointerdown', (event) => {
    b.setPointerCapture(event.pointerId);
    press(b.dataset.k);
  });
  const release = () => (keys[b.dataset.k] = false);
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
});
document.getElementById('sound-toggle').addEventListener('click', () => setMuted(!muted));
const musicToggle = document.getElementById('sound-toggle');
musicToggle.textContent = muted ? 'Music: Off' : 'Music: On';
musicToggle.setAttribute('aria-pressed', String(!muted));

// ---------- UI primitives: dialog + choice ----------
let ui = null; // {kind:'say', text, resolve} | {kind:'choose', title, items, idx, resolve}
function say(text) {
  return new Promise((resolve) => (ui = {
    kind: 'say',
    text,
    revealed: 0,
    started: frame,
    lastPromptCycle: Math.floor(frame / 40),
    resolve,
  }));
}
function choose(items, title = '', idx = 0) {
  return new Promise((resolve) => (ui = { kind: 'choose', title, items, idx, resolve }));
}
async function sayAll(lines) {
  for (const l of lines) await say(l);
}
function handleUI(k) {
  if (ui.kind === 'say' && (k === 'a' || k === 'b')) {
    if (ui.revealed < ui.text.length) {
      ui.revealed = ui.text.length;
      sfx.ok();
      return;
    }
    const r = ui.resolve;
    ui = null;
    sfx.ok();
    r();
  } else if (ui.kind === 'choose') {
    if (k === 'up') ui.idx = (ui.idx + ui.items.length - 1) % ui.items.length;
    if (k === 'down') ui.idx = (ui.idx + 1) % ui.items.length;
    if (k === 'a' || k === 'b') {
      const r = ui.resolve, v = k === 'a' ? ui.idx : -1;
      ui = null;
      sfx.ok();
      r(v);
    }
  }
}

const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const trainerForm = document.getElementById('trainer-form');
const trainerInput = document.getElementById('trainer-input');
let finishNickname = null;
let finishTrainerName = null;
function askNickname(species) {
  return new Promise((resolve) => {
    finishNickname = resolve;
    nicknameInput.value = '';
    nicknameInput.placeholder = species;
    nicknameForm.hidden = false;
    nicknameInput.focus();
  });
}
function closeNickname(value) {
  if (!finishNickname) return;
  const resolve = finishNickname;
  finishNickname = null;
  nicknameForm.hidden = true;
  if (nicknameForm.contains(document.activeElement)) document.activeElement.blur();
  resolve(value);
}
function askTrainerName() {
  return new Promise((resolve) => {
    finishTrainerName = resolve;
    trainerInput.value = '';
    trainerForm.hidden = false;
    trainerInput.focus();
  });
}
function closeTrainerName(value) {
  if (!finishTrainerName) return;
  const resolve = finishTrainerName;
  finishTrainerName = null;
  trainerForm.hidden = true;
  if (trainerForm.contains(document.activeElement)) document.activeElement.blur();
  resolve(value);
}
nicknameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  closeNickname(nicknameInput.value.trim().slice(0, 12) || null);
});
trainerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  closeTrainerName(trainerInput.value.trim().slice(0, 12));
});
document.getElementById('nickname-skip').addEventListener('click', () => closeNickname(null));
nicknameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNickname(null);
  }
});
trainerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    trainerInput.value = 'Trainer';
    closeTrainerName('Trainer');
  }
});

// ---------- Mal helpers ----------
function makeMal(name, lv) {
  const sp = MALS[name];
  const m = { name, nickname: '', lv, xp: 0, moves: sp.moves.slice(0, Math.min(sp.moves.length, 1 + Math.floor(lv / 4))), pp: {} };
  ensureMovePP(m);
  calc(m);
  m.cur = m.maxhp;
  return m;
}
const malName = (m) => m.nickname || m.name;
function calc(m) {
  const sp = MALS[m.name];
  m.maxhp = Math.floor((sp.hp * m.lv) / 25) + m.lv + 12;
  m.atk = Math.floor((sp.atk * m.lv) / 30) + 6;
  m.def = Math.floor((sp.def * m.lv) / 30) + 6;
  m.spd = Math.floor((sp.spd * m.lv) / 30) + 6;
}
const xpNeed = (lv) => lv * lv * 6;

const spriteCache = {};
const MAL_SPRITE_ASSETS = Object.create(null);
function loadMalSpriteSheet(name, view) {
  const key = `${name}:${view}`;
  // Remember both successful loads and 404s. Without a negative cache, a
  // missing optional PNG is requested again every time its sprite is drawn.
  if (Object.prototype.hasOwnProperty.call(MAL_SPRITE_ASSETS, key)) {
    return MAL_SPRITE_ASSETS[key];
  }
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  MAL_SPRITE_ASSETS[key] = image;
  image.onload = () => {
    for (const cachedKey of Object.keys(spriteCache)) {
      if (cachedKey.startsWith(`${name}:`)) delete spriteCache[cachedKey];
    }
    // A shiny canvas is a colour-treated copy of the normal sprite. Discard it
    // too, or it would keep showing procedural fallback art after the PNG loads.
    for (const cachedKey of Object.keys(shinySpriteCache)) {
      if (cachedKey.startsWith(`${name}:`)) delete shinySpriteCache[cachedKey];
    }
  };
  image.onerror = () => { MAL_SPRITE_ASSETS[key] = false; };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  image.src = `./assets/sprites/pocketmals/${slug}-${view}.png`;
  return image;
}

function malSprite(name, pose = 0, view = 'front') {
  const cacheKey = `${name}:${pose}:${view}`;
  if (spriteCache[cacheKey]) return spriteCache[cacheKey];
  const species = MALS[name];
  if (!species) return document.createElement('canvas');
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const approvedSheet = null; // No approved PNG sprite sheets are committed; use built-in art without 404 requests.
  if (approvedSheet?.complete && approvedSheet.naturalWidth >= 48 && approvedSheet.naturalHeight >= 48) {
    const frameIndex = approvedSheet.naturalWidth >= 384 ? ((Math.floor(Number(pose) || 0) % 8) + 8) % 8 : 0;
    g.drawImage(approvedSheet, frameIndex * 48, 0, 48, 48, 0, 0, 48, 48);
    return (spriteCache[cacheKey] = c);
  }
  const palettes = {
    normal: ['#b38a5f', '#e9c995', '#493b37', '#f3dfb5'],
    fire: ['#c94e35', '#ffad55', '#592d32', '#ffe18b'],
    water: ['#347eb4', '#a8e0e8', '#21445f', '#e4f9f4'],
    grass: ['#377d49', '#9fd46f', '#183e34', '#d3ed9a'],
    electric: ['#c59b27', '#ffe777', '#4e4425', '#fff5ad'],
    ice: ['#78b6c4', '#dbf4f4', '#3a6673', '#fff'],
    fighting: ['#ae4e40', '#e6a079', '#53343a', '#ffe1ad'],
    poison: ['#83538e', '#d29acb', '#483450', '#ffe0ed'],
    ground: ['#aa8450', '#e2c47f', '#574531', '#f4e3b2'],
    flying: ['#5b9eaa', '#d2f0e9', '#31546a', '#fff0c9'],
    psychic: ['#8058a7', '#d7b4ec', '#3b3157', '#fff0d7'],
    bug: ['#719044', '#c5d77c', '#38492f', '#f1f0b4'],
    rock: ['#756657', '#c1b094', '#383a3e', '#e2d2ad'],
    ghost: ['#635887', '#b6a4d5', '#343149', '#e8e1ff'],
    dragon: ['#6b54ac', '#b39deb', '#342c61', '#f8e6ab'],
    steel: ['#71869b', '#cad8df', '#394858', '#fff1be'],
    dark: ['#55474d', '#a48a7a', '#2f303b', '#e7cf9f'],
    fairy: ['#bd7599', '#f5bfd7', '#683e68', '#fff3cb'],
  };
  const speciesPalettes = {
    Jayble: ['#4f79a6', '#e3ece1', '#34495c', '#c64f58'],
    Jayquill: ['#397e9c', '#b3e4e6', '#21445f', '#e8d590'],
    Jaystream: ['#285879', '#a8e3ed', '#1d354a', '#f0d071'],
    Kangol: ['#c65a39', '#f3bb76', '#59343a', '#ffe18b'],
    Flareroo: ['#c44a35', '#f2a15a', '#52343a', '#f4d379'],
    Flaresupial: ['#a83e32', '#ed9b52', '#3e3035', '#fff08c'],
    Bubbish: ['#5aa7d1', '#c8eef3', '#3a5468', '#d9bcf4'],
    Foamish: ['#58a5c4', '#dcf3ed', '#314e5b', '#f4fbff'],
    Jelluburst: ['#417ca7', '#c4e7ef', '#2e354e', '#efc9ef'],
    Lizrout: ['#6da94f', '#c2db7e', '#3b4e3a', '#f3d37e'],
    Thornko: ['#57883e', '#b4ce70', '#334236', '#d1aa5c'],
    Branack: ['#62764d', '#c6b685', '#3c4239', '#eee0ae'],
    Lovlittle: ['#ce7da5', '#f4c9de', '#623c62', '#fff0b0'],
    Malittle: ['#534765', '#b4a0d4', '#302c41', '#f0d7b6'],
  };
  const [base, light, ink, accent] = speciesPalettes[name] || palettes[species.type] || ['#8b8b8b', '#ddd', '#333', '#fff'];
  drawCreaturePixelArt(g, name, pose, view, { base, light, ink, accent });
  return (spriteCache[cacheKey] = c);
}

function drawCreaturePixelArt(canvasContext, name, pose, view, colors) {
  const g = canvasContext;
  const { base, light, ink, accent } = colors;
  g.clearRect(0, 0, 48, 48);
  g.save();
  g.scale(2, 2); // 24px logical canvas rendered as crisp 48px pixel art.
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  const px = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const poly = (points, color, outline = ink, lineWidth = 1) => {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (outline) {
      g.strokeStyle = outline;
      g.lineWidth = lineWidth;
      g.stroke();
    }
  };
  const oval = (x, y, rx, ry, color, outline = ink) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    if (outline) {
      g.strokeStyle = outline;
      g.lineWidth = 1;
      g.stroke();
    }
  };
  const eye = (x, y, iris = '#202b3a') => {
    if (pose % 8 === 7) {
      px(x, y + 1, 2, 1, ink);
      return;
    }
    px(x, y, 2, 3, ink);
    px(x, y, 1, 2, iris);
    px(x, y, 1, 1, '#fff');
  };
  const face = (x = 12, y = 12, spacing = 5) => {
    if (view === 'back') {
      px(x - 4, y - 2, 8, 2, light);
      px(x - 3, y, 6, 2, base);
      return;
    }
    eye(x - spacing / 2 - 1, y);
    eye(x + spacing / 2 - 1, y);
    px(x - 1, y + 5, 2, 1, ink);
    px(x - 4, y + 4, 2, 1, '#e88f93');
    px(x + 3, y + 4, 2, 1, '#e88f93');
  };
  const legs = (xs, y = 17, color = base) => {
    for (const x of xs) {
      px(x, y, 3, 5, ink);
      px(x + 1, y, 2, 4, color);
      px(x - 1, y + 4, 4, 2, ink);
      px(x, y + 4, 3, 1, light);
    }
  };
  const tailFlick = pose % 4;
  const tailY = tailFlick === 0 ? 13 : tailFlick === 1 ? 11 : tailFlick === 2 ? 14 : 12;
  const canine = ['Seedkit','Leafox','Florion','Cinderp','Flamfox','Blazion','Ripplet','Wavepup','Marinox','Yapup','Trailhound','Breezel','Kilnkit'].includes(name);

  // Shared ground shadow and a strong silhouette make the sprite read at battle scale.
  oval(12, 22, 7, 1.1, '#263c3b66', null);

  if (canine || name === 'Tuskvolt' || name === 'Cragmite') {
    // Quadruped torso and haunches.
    poly([[3,15],[4,11],[7,9],[13,9],[17,11],[19,15],[17,19],[6,20],[3,18]], base);
    px(5, 13, 8, 2, light);
    px(7, 17, 8, 2, colors.ink === ink ? '#00000020' : ink);
    legs([5, 15], 17, base);

    if (name === 'Tuskvolt') {
      poly([[5,7],[8,4],[15,5],[19,10],[19,16],[15,19],[7,18],[4,14]], base);
      poly([[5,10],[2,7],[4,13]], light);
      poly([[17,11],[21,8],[20,15]], light);
      poly([[6,13],[3,11],[4,16]], '#fff0c5', ink);
      poly([[17,13],[20,11],[19,16]], '#fff0c5', ink);
      px(8, 8, 2, 2, accent); px(14, 8, 2, 2, accent);
      if (view !== 'back') { eye(8, 11); eye(15, 11); }
      px(10, 16, 4, 2, ink);
    } else if (name === 'Cragmite') {
      poly([[5,10],[8,6],[15,7],[19,12],[18,18],[6,20],[3,16]], base);
      poly([[10,13],[16,14],[18,16],[13,18],[9,16]], light, ink);
      px(17, 14, 3, 2, accent);
      px(3, 17, 3, 2, ink); px(18, 17, 3, 2, ink);
      if (view !== 'back') { eye(9, 11); px(15, 14, 2, 1, ink); }
      px(7, 19, 2, 2, light); px(15, 19, 2, 2, light);
    } else {
      // Long muzzle and upright ears differ by each starter line.
      if (name === 'Ripplet' || name === 'Wavepup' || name === 'Marinox') {
        poly([[5,9],[7,5],[10,8],[14,6],[18,10],[19,16],[16,19],[7,19],[4,15]], base);
        poly([[6,8],[4,4],[9,6]], accent);
        poly([[14,7],[18,3],[19,9]], light);
        px(7, 15, 8, 3, light);
        px(7, 18, 6, 1, accent);
        poly([[17,17],[20,14],[22,13],[21,18],[18,20]], accent);
        if (name === 'Marinox') {
          poly([[5,8],[6,3],[9,7]], light);
          poly([[12,7],[15,2],[17,8]], '#d9fbf2');
          px(6, 11, 2, 2, '#d9fbf2');
          px(16, 11, 2, 2, '#d9fbf2');
        }
      } else if (name === 'Cinderp' || name === 'Flamfox' || name === 'Blazion') {
        poly([[5,10],[6,5],[9,8],[12,4],[15,8],[19,9],[20,16],[16,19],[7,19],[4,15]], base);
        poly([[6,8],[5,2],[10,6]], light);
        poly([[13,7],[18,1],[18,8]], accent);
        poly([[17,15],[20,12],[22,7],[22,15],[19,20]], '#f26a36');
        poly([[19,15],[21,10],[21,16]], '#ffe78a', null);
        px(7, 12, 4, 2, light);
        if (name === 'Blazion') {
          poly([[5,11],[2,7],[6,8],[8,3],[11,8]], accent);
          poly([[13,8],[17,2],[18,9]], '#fff0a3');
          px(6, 18, 7, 2, '#f6b35e');
        }
      } else if (name === 'Breezel') {
        poly([[3,14],[7,10],[14,10],[18,13],[16,18],[6,18]], base);
        poly([[6,12],[6,5],[10,10]], light);
        poly([[12,10],[17,5],[17,12]], accent);
        poly([[17,15],[20,12],[23,11],[21,17],[18,19]], light);
        px(7, 15, 7, 2, light);
      } else if (name === 'Kilnkit') {
        poly([[5,10],[7,5],[10,8],[14,5],[18,10],[19,17],[15,20],[6,19],[3,15]], base);
        poly([[6,9],[5,3],[10,7]], accent);
        poly([[14,7],[19,3],[18,10]], accent);
        px(8, 14, 7, 4, light);
        px(10, 15, 3, 2, '#e7783e');
      } else {
        poly([[5,10],[7,7],[11,8],[14,6],[18,10],[18,17],[15,19],[7,19],[4,15]], base);
        poly([[6,10],[4,5],[9,8]], accent);
        poly([[13,8],[18,5],[18,11]], light);
        poly([[17,16],[20,14],[22,13],[21,18],[18,20]], accent);
        px(7, 12, 7, 3, light);
        if (name === 'Seedkit') {
          poly([[8,7],[6,2],[11,5]], '#6fbd57');
          poly([[11,6],[13,1],[15,6]], '#b6df76');
        } else if (name === 'Leafox') {
          poly([[4,9],[3,3],[8,7]], '#6db85b');
          poly([[8,7],[11,1],[14,7]], '#b6df76');
          poly([[14,8],[20,3],[19,10]], '#77bd58');
          px(6, 12, 10, 4, '#a8d875');
        } else if (name === 'Florion') {
          poly([[5,9],[3,4],[8,7]], '#6db85b');
          poly([[9,7],[10,1],[14,6]], '#c5e78a');
          poly([[15,8],[21,3],[19,10]], '#77bd58');
          px(7, 12, 9, 3, '#b4df7e');
          px(8, 14, 2, 2, '#f5d98d');
          px(14, 14, 2, 2, '#f5d98d');
        } else if (name === 'Yapup') {
          poly([[6,8],[3,5],[7,6],[9,3],[11,8]], base);
          poly([[13,8],[17,4],[18,10]], base);
          px(5, 13, 3, 2, accent);
          px(15, 12, 3, 2, accent);
        } else if (name === 'Flamfox') {
          poly([[5,8],[3,2],[9,6],[12,0],[15,7],[20,2],[19,10]], '#f0783d');
          poly([[19,16],[22,10],[23,16],[21,20]], '#f0783d');
          px(19, 14, 2, 3, '#ffe78a');
        } else if (name === 'Wavepup') {
          poly([[5,8],[3,3],[9,7]], '#a8e0e6');
          poly([[14,7],[19,2],[19,9]], '#d9fbf2');
          poly([[19,16],[22,13],[23,17],[20,20]], '#6cc4d3');
        } else if (name === 'Trailhound') {
          poly([[5,8],[2,5],[5,7],[8,3],[10,8]], '#8b684d');
          poly([[14,8],[18,4],[20,9]], '#a57c58');
          px(7, 17, 7, 2, '#d7ad63');
        }
      }
      if (view !== 'back') {
        if (name === 'Seedkit' || name === 'Florion' || name === 'Yapup') {
          eye(8, 11); eye(14, 11);
        } else {
          eye(8, 11); eye(14, 11);
        }
        px(11, 15, 3, 1, ink);
      } else {
        px(8, 8, 8, 7, accent);
        px(10, 9, 4, 5, light);
      }
    }
  } else if (name === 'Bramblet') {
    poly([[3,15],[4,11],[7,9],[14,8],[19,12],[20,17],[16,21],[6,20]], base);
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 3;
      poly([[x,11],[x+1,4+(i%2)*2],[x+3,11]], i % 2 ? '#a8d46e' : '#6cae55');
    }
    px(7, 13, 8, 4, light);
    legs([6,15], 18, base);
    if (view !== 'back') { eye(16, 13); px(19, 16, 2, 1, ink); }
  } else if (name === 'Mothcinder') {
    poly([[11,13],[4,5],[1,8],[3,17],[10,20]], base);
    poly([[13,13],[20,5],[23,8],[21,17],[14,20]], base);
    poly([[11,12],[5,8],[4,13],[10,18]], accent);
    poly([[13,12],[19,8],[20,13],[14,18]], light);
    oval(12, 14, 3, 7, ink, ink);
    oval(12, 14, 2, 6, base, null);
    px(10, 9, 4, 2, accent);
    poly([[10,8],[8,3],[10,5]], ink);
    poly([[14,8],[16,3],[14,5]], ink);
    if (view !== 'back') { eye(10, 10); eye(14, 10); }

  } else if (name === 'Blobble') {
    oval(12, 13, 8, 9, ink);
    oval(12, 13, 7, 8, base, null);
    px(7, 9, 5, 2, light); px(15, 15, 3, 2, accent);
    poly([[5,17],[2,20],[7,20]], light);
    poly([[18,17],[22,20],[17,20]], light);
    for (const [x,y] of [[4,5],[19,4],[21,10]]) {
      oval(x,y,1.5,1.5,accent,null); px(x-1,y-1,1,1,'#fff');
    }
    if (view !== 'back') { eye(9, 12); eye(14, 12); px(11,17,3,1,ink); }
  } else if (name === 'Sparkit') {
    poly([[5,16],[5,10],[8,7],[14,7],[18,12],[17,18],[10,21]], base);
    poly([[7,9],[4,2],[10,6]], accent);
    poly([[13,7],[18,1],[18,9]], light);
    poly([[16,18],[20,17],[22,14],[22,20],[18,22]], accent);
    px(7, 15, 7, 2, light);
    if (view !== 'back') { eye(9, 12); eye(14, 12); }
    
  } else if (name === 'Rocklit') {
    poly([[3,16],[4,9],[8,6],[16,7],[20,12],[19,19],[6,21]], ink);
    poly([[4,15],[6,9],[10,7],[16,9],[19,14],[16,19],[7,19]], base, null);
    poly([[7,10],[10,7],[15,9],[13,13],[8,14]], light, null);
    poly([[12,14],[16,11],[18,16],[14,18]], accent, null);
    px(6,20,5,2,ink); px(14,20,5,2,ink);
    if (view !== 'back') { eye(8, 14); eye(14, 14); }
  } else if (name === 'Pufflet') {
    poly([[11,12],[4,6],[2,12],[5,19],[11,17]], ink);
    poly([[13,12],[20,6],[22,12],[19,19],[13,17]], ink);
    poly([[11,12],[5,8],[5,15],[11,18]], base, null);
    poly([[13,12],[19,8],[19,15],[13,18]], light, null);
    oval(12, 14, 5, 6, ink, ink);
    oval(12, 14, 4, 5, base, null);
    poly([[9,10],[9,5],[12,8],[15,5],[15,10]], accent);
    if (view !== 'back') { eye(10, 12); eye(14, 12); poly([[11,16],[13,16],[12,19]], '#efb750', ink); }
    px(7, 20, 3, 2, ink); px(14, 20, 3, 2, ink);
  } else if (name === 'Glimmit') {
    poly([[5,11],[3,3],[10,8]], ink);
    poly([[14,8],[21,3],[19,12]], ink);
    poly([[6,10],[5,5],[10,9]], accent, null);
    poly([[14,9],[19,5],[18,10]], light, null);
    oval(12, 15, 7, 6, ink);
    oval(12, 15, 6, 5, base, null);
    px(6, 15, 3, 2, light);
    poly([[6,18],[2,20],[4,16]], accent);
    poly([[18,18],[22,20],[20,16]], accent);
    if (view !== 'back') { eye(9, 13); eye(14, 13); }
    
  } else if (name === 'Hushowl') {
    poly([[5,9],[4,1],[10,6],[14,6],[20,1],[19,10],[21,16],[17,21],[7,21],[3,16]], ink);
    poly([[6,9],[6,4],[10,8],[14,8],[18,4],[18,10],[20,16],[16,19],[8,19],[4,16]], base, null);
    oval(8, 12, 4, 5, light, ink); oval(16, 12, 4, 5, light, ink);
    if (view !== 'back') { eye(7, 11, '#a85d3b'); eye(15, 11, '#a85d3b'); poly([[10,16],[14,16],[12,19]], '#e3b052', ink); }
    poly([[5,20],[2,23],[9,21]], accent); poly([[15,21],[22,23],[19,20]], accent);
  } else if (name === 'Bunnet') {
    poly([[7,12],[5,1],[10,7],[12,11]], ink);
    poly([[13,11],[15,2],[20,0],[18,13]], ink);
    poly([[8,10],[7,3],[10,8]], '#eaa6a2', null);
    poly([[15,10],[17,3],[18,9]], '#eaa6a2', null);
    oval(12, 16, 7, 6, ink);
    oval(12, 16, 6, 5, base, null);
    px(7, 14, 3, 3, light);
    if (view !== 'back') { eye(9, 14); eye(14, 14); px(11,18,2,1,ink); }
    px(5,20,4,2,ink); px(15,20,4,2,ink);
  } else if (name === 'Mossit') {
    oval(12, 17, 6, 5, ink); oval(12, 17, 5, 4, base, null);
    poly([[2,12],[4,6],[9,3],[15,3],[20,7],[22,13],[17,14],[7,14]], ink);
    poly([[4,10],[6,6],[10,4],[15,5],[19,8],[20,11],[15,12],[7,12]], accent, null);
    px(7,7,5,2,light); px(14,8,3,2,'#d6e9a0');
    if (view !== 'back') { eye(9, 16); eye(14, 16); }
    px(7,21,3,2,ink); px(14,21,3,2,ink);
  } else if (name === 'Ripfin') {
    poly([[6,14],[1,7],[3,15],[1,22],[8,18]], ink);
    poly([[7,14],[3,8],[4,15],[3,20],[8,17]], accent, null);
    poly([[7,11],[10,5],[14,10],[18,10],[21,14],[17,19],[9,19],[5,15]], ink);
    poly([[8,12],[11,7],[14,11],[18,11],[20,14],[16,17],[9,17],[6,15]], base, null);
    poly([[12,11],[14,4],[18,10]], light);
    poly([[13,17],[17,22],[10,19]], accent);
    if (view !== 'back') { eye(16, 13); px(17,16,2,1,ink); }
  } else if (name === 'Gearbit') {
    poly([[4,14],[7,7],[12,5],[18,8],[21,14],[18,21],[6,21]], ink);
    poly([[6,14],[8,9],[12,7],[17,9],[19,14],[16,19],[8,19]], base, null);
    poly([[8,9],[12,6],[16,9],[15,14],[9,14]], accent);
    px(10, 8, 4, 2, light);
    px(3, 13, 3, 2, ink); px(19,13,3,2,ink);
    px(6,20,2,3,ink); px(16,20,2,3,ink);
    poly([[8,7],[6,2],[10,6]], ink); poly([[15,6],[19,2],[18,8]], ink);
    if (view !== 'back') { eye(9, 13); eye(14, 13); }
    px(11,16,3,1,light);
  } else if (name === 'Wispurr') {
    poly([[4,14],[5,7],[9,3],[12,8],[16,3],[20,8],[20,17],[16,21],[6,20]], ink);
    poly([[6,14],[7,8],[10,6],[12,10],[15,6],[18,9],[18,16],[15,19],[7,18]], base, null);
    poly([[4,18],[1,21],[6,20],[8,18]], accent);
    poly([[18,18],[22,21],[21,15]], light);
    px(7, 12, 3, 3, light); px(14,12,3,3,light);
    if (view !== 'back') { eye(8, 12, '#d9d2ff'); eye(15,12,'#d9d2ff'); }
    
  } else if (name === 'Latticebot') {
    poly([[5,7],[8,3],[16,3],[20,8],[20,18],[16,21],[7,21],[3,17],[3,10]], ink);
    poly([[6,8],[9,5],[15,5],[18,9],[18,17],[15,19],[8,19],[5,16],[5,10]], base, null);
    px(7, 8, 10, 8, '#b7d0ca');
    px(8, 10, 3, 3, accent); px(14,10,3,3,accent);
    px(9, 15, 6, 1, ink);
    px(1, 11, 3, 3, light); px(20, 11, 3, 3, light);
    px(8, 21, 3, 2, ink); px(14,21,3,2,ink);
    px(11, 1, 2, 4, accent); px(10,0,4,2,light);
  } else if (name === 'Skylit' || name === 'Pyrewing') {
    const flameWing = name === 'Pyrewing';
    const wing = flameWing ? '#e87945' : '#9ad8e8';
    poly([[11,13],[3,6],[1,9],[5,17],[11,19]], ink);
    poly([[13,13],[21,6],[23,9],[19,17],[13,19]], ink);
    poly([[11,13],[4,8],[5,14],[11,18]], wing, null);
    poly([[13,13],[20,8],[19,14],[13,18]], flameWing ? '#ffbd69' : '#d8f0e9', null);
    oval(12, 15, 4, 6, ink);
    oval(12, 15, 3, 5, base, null);
    poly([[10,9],[8,4],[12,7],[15,3],[15,10]], accent);
    if (view !== 'back') {
      eye(10, 13);
      poly([[14,15],[18,16],[14,17]], '#e7ac55', ink);
    }
    px(8, 20, 3, 2, ink); px(13, 20, 3, 2, ink);

  } else if (name === 'Voltuff') {
    poly([[4,15],[5,10],[8,8],[15,9],[19,13],[18,18],[7,20]], ink);
    poly([[6,15],[7,11],[10,10],[15,11],[17,14],[16,18],[8,18]], base, null);
    poly([[6,10],[4,4],[10,8]], accent);
    poly([[14,9],[19,3],[18,11]], light);
    poly([[5,15],[2,12],[4,17]], '#fff0a0', null);
    poly([[16,15],[21,12],[19,17]], '#fff0a0', null);
    if (view !== 'back') { eye(9, 12); eye(14, 12); }
    legs([7, 15], 18, base);
    
  } else if (name === 'Astrin' || name === 'Starfox') {
    const evolved = name === 'Starfox';
    poly([[5,15],[5,10],[8,8],[14,8],[18,12],[18,18],[7,20]], ink);
    poly([[7,15],[7,11],[10,10],[14,10],[17,13],[16,18],[8,18]], base, null);
    poly([[6,9],[4,3],[10,7],[12,1],[15,8],[19,3],[18,10]], accent);
    poly([[4,16],[1,13],[3,18],[7,19]], light);
    poly([[17,17],[21,14],[23,15],[20,20]], accent);
    if (view !== 'back') {
      eye(9, 12, '#a8e8ff'); eye(14, 12, '#a8e8ff');
      px(10, 16, 4, 1, ink);
    } else {
      px(8, 11, 8, 5, accent); px(10, 12, 4, 3, light);
    }
    if (evolved) {
      
      
    }
  } else if (name === 'Floatide') {
    oval(12, 13, 8, 8, ink);
    oval(12, 12, 7, 7, base, null);
    poly([[5,17],[4,22],[8,18]], accent);
    poly([[11,18],[12,23],[14,18]], light);
    poly([[18,17],[21,21],[18,19]], accent);
    px(8, 8, 4, 2, light); px(15, 13, 3, 2, accent);
    if (view !== 'back') { eye(9, 11, '#efffff'); eye(14, 11, '#efffff'); }
    
  } else if (name === 'Thornox') {
    poly([[3,15],[4,10],[8,8],[16,9],[20,14],[18,20],[6,20]], ink);
    poly([[5,15],[7,11],[10,10],[16,11],[18,15],[16,18],[7,18]], base, null);
    for (let i = 0; i < 5; i++) {
      const x = 5 + i * 3;
      poly([[x,11],[x + 1,5 + (i % 2) * 2],[x + 3,11]], i % 2 ? light : accent, ink);
    }
    poly([[5,9],[3,4],[9,8]], accent);
    poly([[16,10],[20,5],[19,12]], light);
    if (view !== 'back') { eye(9, 13); eye(14, 13); }
    legs([6, 15], 18, base);
  } else if (name === 'Blazion' || name === 'Florion' || name === 'Marinox') {
    // Evolution silhouettes have broader shoulders, taller crests and layered markings.
    if (name === 'Florion') {
      poly([[3,16],[5,10],[8,8],[14,8],[18,12],[20,17],[16,21],[6,21]], ink);
      poly([[5,15],[7,11],[10,10],[15,10],[18,14],[17,19],[7,19]], base, null);
      poly([[5,10],[2,4],[8,7],[10,2],[13,8],[18,2],[20,9]], '#8bc866');
      px(6, 13, 9, 4, light); px(8,15,3,2,accent); px(14,14,3,2,'#d8ed9b');
      poly([[17,16],[21,12],[23,14],[21,20]], accent);
    } else if (name === 'Blazion') {
      poly([[3,15],[6,8],[12,7],[17,9],[20,15],[17,21],[6,20]], ink);
      poly([[5,15],[8,10],[13,9],[17,12],[18,17],[15,19],[7,19]], base, null);
      poly([[5,10],[3,3],[9,7],[11,1],[15,8],[20,3],[19,11]], '#f0783d');
      px(7, 12, 8, 3, light); px(9, 15, 4, 2, '#ffe49a');
      poly([[17,17],[20,13],[23,8],[22,17],[19,22]], '#f0783d');
      poly([[20,16],[22,11],[22,18]], '#fff0a0', null);
    } else {
      poly([[3,15],[6,9],[11,7],[17,10],[20,16],[16,21],[6,20]], ink);
      poly([[5,15],[8,11],[12,9],[16,12],[18,17],[15,19],[7,19]], base, null);
      poly([[6,9],[4,2],[10,7],[13,1],[16,8],[20,4],[20,11]], '#a8e0e6');
      px(7, 12, 8, 3, light); px(9,15,5,2,accent);
      poly([[17,16],[20,12],[23,13],[21,19]], '#6cc4d3');
    }
    if (view !== 'back') { eye(8, 12); eye(14,12); px(11,16,3,1,ink); }
    else { px(8,10,8,7,accent); px(10,11,4,4,light); }
  } else if (name === 'Grainper') {
    poly([[7,12],[4,9],[3,12],[7,16]], ink);
    poly([[17,12],[20,9],[21,12],[17,16]], ink);
    poly([[8,12],[5,10],[5,12],[8,15]], light, null);
    poly([[16,12],[19,10],[19,12],[16,15]], accent, null);
    oval(12, 14, 5, 6, ink);
    oval(12, 14, 4, 5, base, null);
    poly([[9,9],[7,5],[9,7],[10,4],[11,9]], ink);
    poly([[13,9],[14,4],[15,7],[17,5],[16,10]], ink);
    poly([[8,7],[7,4],[10,6]], '#9ac95b');
    poly([[14,6],[17,3],[16,7]], '#c5df7c');
    if (view !== 'back') {
      eye(9, 12, '#5c4d2e'); eye(14, 12, '#5c4d2e');
      px(11, 16, 2, 1, ink);
    }
    for (const x of [7, 11, 15]) {
      px(x, 18, 1, 2, ink);
      px(x - 1, 19, 2, 1, accent);
    }
  } else if (name === 'Wheafield') {
    poly([[6,13],[2,9],[3,17],[7,19]], ink);
    poly([[18,13],[22,9],[21,17],[17,19]], ink);
    poly([[7,13],[4,11],[5,16],[8,17]], '#8cc35a', null);
    poly([[17,13],[20,11],[19,16],[16,17]], light, null);
    poly([[7,12],[8,9],[10,8],[14,8],[16,10],[17,16],[15,20],[9,20],[7,17]], ink);
    poly([[8,13],[9,10],[11,9],[14,9],[15,12],[15,18],[10,19],[8,16]], base, null);
    poly([[8,9],[5,3],[10,7],[12,1],[14,7],[19,3],[16,10]], '#80b94e');
    poly([[9,12],[6,10],[8,15]], accent, null);
    poly([[15,12],[18,10],[16,15]], '#b6d971', null);
    if (view !== 'back') {
      px(9, 12, 2, 1, ink); px(14, 12, 2, 1, ink);
      px(11, 15, 3, 1, ink);
    } else {
      px(9, 11, 6, 6, accent); px(10, 12, 4, 4, light);
    }
    px(9, 19, 2, 4, ink); px(14, 19, 2, 4, ink);
    px(8, 22, 4, 1, ink); px(13, 22, 4, 1, ink);
  } else if (name === 'Rascoon') {
    poly([[17,16],[20,13],[23,15],[22,20],[18,21]], ink);
    poly([[19,15],[22,15],[21,17],[19,17]], light, null);
    poly([[19,19],[22,18],[21,20],[19,20]], light, null);
    oval(12, 17, 5, 5, ink);
    oval(12, 17, 4, 4, base, null);
    poly([[7,11],[6,6],[10,9]], ink);
    poly([[14,9],[18,6],[17,12]], ink);
    poly([[8,10],[7,7],[10,9]], accent, null);
    poly([[14,9],[17,7],[16,11]], accent, null);
    oval(12, 12, 7, 6, ink);
    oval(12, 12, 6, 5, base, null);
    poly([[6,11],[9,10],[11,12],[14,10],[18,11],[16,14],[13,13],[10,14],[7,13]], '#423b3d', null);
    oval(12, 14, 3, 2, light, null);
    if (view !== 'back') {
      eye(9, 11, '#8e6d44'); eye(14, 11, '#8e6d44');
      px(11, 14, 2, 1, ink);
    }
    px(8, 20, 2, 2, ink); px(14, 20, 2, 2, ink);
    px(9, 20, 1, 1, light); px(14, 20, 1, 1, light);
  } else if (name === 'Racrash') {
    poly([[16,15],[19,11],[23,12],[23,20],[18,22],[16,19]], ink);
    poly([[19,13],[22,13],[22,16],[19,16]], light, null);
    poly([[18,18],[22,17],[21,20],[18,20]], light, null);
    poly([[5,15],[6,10],[9,8],[15,8],[18,12],[19,18],[16,21],[7,21],[4,18]], ink);
    poly([[7,15],[8,11],[10,10],[15,10],[17,14],[17,18],[15,19],[8,19],[6,17]], base, null);
    poly([[7,10],[5,4],[10,8]], ink);
    poly([[14,8],[19,3],[18,11]], ink);
    poly([[8,10],[6,6],[10,9]], accent, null);
    poly([[15,8],[18,5],[17,10]], light, null);
    poly([[6,12],[9,11],[11,13],[14,11],[18,13],[16,15],[13,14],[10,16],[7,15]], '#312f39', null);
    poly([[8,16],[11,15],[14,16],[13,18],[9,18]], light, null);
    if (view !== 'back') {
      px(9, 12, 2, 1, '#f2d89a'); px(14, 12, 2, 1, '#f2d89a');
      px(11, 17, 2, 1, ink);
    } else {
      poly([[8,11],[15,11],[17,18],[9,19]], accent, null);
      px(10, 12, 4, 5, light);
    }
    px(7, 20, 3, 3, ink); px(14, 20, 3, 3, ink);
  } else if (name === 'Jayble') {
    poly([[8,15],[3,11],[3,17],[9,19]], ink);
    poly([[8,15],[4,13],[5,17],[9,18]], accent, null);
    poly([[7,13],[4,7],[9,10],[11,6],[13,11],[17,8],[16,14]], ink);
    oval(12, 15, 6, 7, ink);
    oval(12, 15, 5, 6, base, null);
    poly([[8,13],[6,10],[8,11],[10,9],[11,13]], light, null);
    poly([[13,13],[16,10],[17,13],[15,16]], '#bf4d58', null);
    if (view !== 'back') {
      eye(9, 13, '#243949');
      poly([[13,15],[18,15],[16,17],[14,17]], '#d9aa54', ink);
      poly([[13,17],[16,17],[15,19],[12,18]], '#b98039', ink);
    }
    px(8, 20, 1, 2, ink); px(14, 20, 1, 2, ink);
    poly([[7,22],[10,22],[9,23],[7,23]], '#d7aa55', ink);
    poly([[13,22],[16,22],[16,23],[14,23]], '#d7aa55', ink);
    px(7, 23, 1, 1, '#f0d47a'); px(9, 23, 1, 1, '#f0d47a');
    px(14, 23, 1, 1, '#f0d47a'); px(16, 23, 1, 1, '#f0d47a');
  } else if (name === 'Jayquill') {
    poly([[5,14],[2,9],[2,16],[7,18]], ink);
    poly([[6,13],[3,10],[4,15],[7,16]], '#e6cb81', null);
    poly([[8,13],[3,8],[4,14],[8,18]], '#4e9bb1', ink);
    poly([[16,13],[21,8],[20,15],[16,18]], '#a8dfe4', ink);
    oval(12, 15, 5, 7, ink);
    oval(12, 15, 4, 6, base, null);
    poly([[8,12],[7,7],[10,10],[12,5],[14,10],[18,6],[16,13]], ink);
    poly([[9,12],[8,8],[11,11],[12,7],[14,11],[17,8],[15,13]], accent, null);
    if (view !== 'back') {
      eye(9, 12, '#163847');
      poly([[13,14],[18,14],[16,16],[14,16]], '#e2c36d', ink);
      poly([[13,16],[16,16],[15,18],[12,17]], '#b78945', ink);
    }
    poly([[9,20],[8,23],[11,22]], '#d9ac58', ink);
    poly([[14,20],[13,22],[16,23]], '#d9ac58', ink);
    px(8, 23, 1, 1, '#f0d47a'); px(10, 23, 1, 1, '#f0d47a');
    px(13, 22, 1, 1, '#f0d47a'); px(15, 23, 1, 1, '#f0d47a');
  } else if (name === 'Jaystream') {
    poly([[6,15],[1,8],[2,16],[8,19]], ink);
    poly([[6,14],[2,10],[4,16],[8,17]], '#e7cc7c', null);
    poly([[9,13],[1,6],[2,13],[8,19]], ink);
    poly([[15,13],[23,5],[22,14],[16,19]], ink);
    poly([[9,14],[3,8],[4,14],[9,18]], '#61a9bd', null);
    poly([[15,14],[21,8],[20,14],[15,18]], '#9ce0e7', null);
    oval(12, 15, 5, 7, ink);
    oval(12, 15, 4, 6, base, null);
    poly([[8,12],[6,6],[10,10],[12,3],[14,10],[18,5],[16,13]], ink);
    poly([[9,11],[8,7],[11,10],[12,5],[14,10],[16,7],[15,12]], accent, null);
    poly([[16,17],[20,16],[22,20],[17,19]], light, ink);
    if (view !== 'back') {
      eye(9, 12, '#17364b');
      poly([[13,14],[19,14],[16,17],[14,16]], '#e5c46d', ink);
      poly([[13,16],[16,17],[15,19],[12,18]], '#b78945', ink);
    }
    px(8, 21, 1, 2, ink); px(15, 21, 1, 2, ink);
    poly([[7,23],[10,23],[9,24],[7,24]], '#d4a654', ink);
    poly([[14,23],[17,23],[17,24],[15,24]], '#d4a654', ink);
    px(7, 24, 1, 1, '#f0d47a'); px(9, 24, 1, 1, '#f0d47a');
    px(15, 24, 1, 1, '#f0d47a'); px(17, 24, 1, 1, '#f0d47a');
  } else if (name === 'Titone') {
    poly([[5,16],[4,11],[7,8],[16,8],[20,12],[19,19],[15,21],[7,20]], ink);
    poly([[7,15],[7,11],[9,9],[15,10],[18,13],[17,18],[14,19],[8,18]], base, null);
    poly([[5,11],[3,5],[8,8],[10,3],[13,8],[17,4],[18,11]], ink);
    poly([[6,10],[5,7],[8,9],[10,5],[12,9],[16,6],[16,10]], light, null);
    poly([[7,16],[10,14],[12,16],[15,14],[17,16],[15,18],[9,18]], accent, null);
    if (view !== 'back') {
      poly([[8,12],[11,12],[10,13]], '#f1dda8', ink);
      poly([[14,12],[17,12],[16,13]], '#f1dda8', ink);
      px(11, 16, 3, 1, ink);
    } else {
      px(8, 11, 8, 6, accent); px(10, 12, 4, 3, light);
    }
    px(7, 19, 3, 3, ink); px(15, 19, 3, 3, ink);
  } else if (name === 'Rockage') {
    poly([[2,16],[4,10],[8,7],[16,8],[21,12],[22,19],[17,22],[6,21]], ink);
    poly([[4,15],[7,10],[10,9],[16,10],[19,14],[19,18],[15,20],[7,19]], base, null);
    poly([[3,11],[2,5],[8,8],[10,2],[13,8],[17,3],[18,10],[22,8],[21,14]], ink);
    poly([[5,10],[4,7],[8,9],[10,4],[13,9],[16,5],[17,11],[20,10],[19,13]], light, null);
    poly([[5,15],[8,12],[11,14],[14,11],[18,14],[16,17],[9,17]], accent, ink);
    px(8, 18, 3, 2, '#91816c'); px(14, 18, 3, 2, '#91816c');
    if (view !== 'back') {
      poly([[8,12],[11,12],[10,13]], '#d8c59d', ink);
      poly([[14,12],[17,12],[16,13]], '#d8c59d', ink);
      px(11, 16, 4, 1, ink);
    } else {
      poly([[7,10],[17,10],[19,18],[8,19]], accent, ink);
      px(10, 11, 5, 5, light);
    }
    px(5, 20, 3, 2, ink); px(16, 20, 4, 2, ink);
  } else if (name === 'Kangol') {
    poly([[7,17],[3,17],[1,20],[3,22],[8,20]], ink);
    poly([[3,19],[2,21],[5,21],[8,19]], accent, null);
    oval(12, 18, 5, 4, ink); oval(12, 18, 4, 3, base, null);
    oval(12, 12, 7, 7, ink); oval(12, 12, 6, 6, base, null);
    poly([[7,9],[4,0],[8,2],[11,8]], ink);
    poly([[13,8],[17,0],[20,2],[17,10]], ink);
    poly([[7,7],[5,2],[8,5]], light, null);
    poly([[14,7],[18,2],[16,8]], light, null);
    poly([[7,14],[9,15],[8,18],[6,17]], ink);
    poly([[17,14],[15,15],[16,18],[18,17]], ink);
    poly([[8,16],[11,17],[12,16],[13,17],[16,16],[15,19],[12,20],[9,19]], light, ink);
    if (view !== 'back') {
      eye(8, 10, '#594239'); eye(15, 10, '#594239');
      px(11, 14, 2, 1, ink);
      px(6, 14, 2, 1, '#e99a92'); px(17, 14, 2, 1, '#e99a92');
    } else {
      px(8, 9, 8, 7, light);
      px(10, 17, 4, 2, accent);
    }
    px(8, 21, 4, 2, ink); px(14, 21, 4, 2, ink);
    px(9, 21, 2, 1, light); px(15, 21, 2, 1, light);
  } else if (name === 'Flareroo') {
    poly([[15,17],[20,15],[23,17],[22,20],[18,20]], ink);
    poly([[19,17],[22,17],[21,19],[19,19]], accent, null);
    poly([[8,13],[7,8],[10,6],[15,7],[18,12],[17,19],[8,20],[5,17]], ink);
    poly([[9,13],[9,9],[11,8],[14,9],[16,13],[15,18],[9,18]], base, null);
    poly([[7,9],[5,1],[9,4],[12,8]], ink);
    poly([[14,8],[19,1],[19,9]], ink);
    poly([[7,6],[6,3],[9,6]], accent, null);
    poly([[15,7],[18,3],[17,8]], light, null);
    poly([[8,14],[5,13],[4,16],[8,17]], ink);
    poly([[16,14],[19,12],[20,15],[17,17]], ink);
    poly([[17,17],[20,14],[23,9],[22,17],[19,21]], accent);
    poly([[20,16],[22,12],[21,17]], '#fff0a0', null);
    if (view !== 'back') {
      px(9, 11, 3, 1, ink); px(14, 11, 3, 1, ink);
      px(11, 15, 3, 1, ink);
    } else {
      poly([[9,10],[15,10],[16,17],[9,18]], accent, ink);
      px(10, 11, 4, 4, light);
    }
    px(8, 20, 3, 3, ink); px(15, 20, 3, 3, ink);
  } else if (name === 'Flaresupial') {
    poly([[9,17],[3,16],[1,20],[3,23],[8,21],[11,19]], ink);
    poly([[3,19],[2,21],[5,22],[9,19]], accent, null);
    poly([[8,11],[7,5],[10,3],[15,5],[18,11],[17,18],[15,21],[8,20],[6,16]], ink);
    poly([[9,11],[9,7],[11,6],[14,7],[16,12],[15,18],[10,19],[8,16]], base, null);
    poly([[7,8],[4,0],[9,3],[12,7]], ink);
    poly([[14,7],[19,0],[20,3],[18,10]], ink);
    poly([[7,6],[5,2],[9,5]], light, null);
    poly([[15,6],[18,2],[17,8]], accent, null);
    poly([[7,13],[4,11],[3,14],[8,16]], ink);
    poly([[17,13],[20,10],[21,13],[17,16]], ink);
    poly([[8,16],[16,16],[15,19],[9,19]], accent, ink);
    poly([[17,17],[20,14],[23,8],[22,18],[19,22]], '#f0783d');
    poly([[20,17],[22,12],[21,18]], '#fff0a0', null);
    if (view !== 'back') {
      px(9, 9, 3, 1, ink); px(14, 9, 3, 1, ink);
      px(11, 13, 3, 1, ink);
    } else {
      px(9, 9, 7, 9, accent);
      px(10, 10, 5, 6, light);
    }
    px(7, 20, 4, 3, ink); px(14, 20, 4, 3, ink);
  } else if (name === 'Bubbish') {
    poly([[5,14],[3,17],[4,20],[6,18]], ink);
    poly([[19,14],[21,17],[20,20],[18,18]], ink);
    oval(12, 11, 8, 7, ink); oval(12, 11, 7, 6, base, null);
    for (const [x, y, rx, ry] of [[6,9,3,3],[10,6,4,3],[15,7,4,3],[19,10,3,3]]) {
      oval(x, y, rx, ry, light, ink);
    }
    // A curled crown bubble and thick scalloped collar distinguish the jelly body.
    poly([[10,7],[10,4],[12,3],[14,4],[14,6],[12,7],[11,6],[12,5]], accent, ink);
    poly([[6,13],[8,15],[10,14],[12,16],[14,14],[16,15],[19,13],[18,18],[15,19],[13,18],[11,20],[8,18],[6,19]], light, ink);
    poly([[8,18],[9,20],[8,23],[7,22]], base, ink);
    poly([[11,18],[12,20],[11,24],[10,23]], accent, ink);
    poly([[14,18],[15,20],[14,23],[13,22]], base, ink);
    poly([[17,18],[18,20],[17,23],[16,22]], accent, ink);
    if (view !== 'back') {
      eye(8, 10, '#274d63'); eye(15, 10, '#274d63');
      oval(12, 13, 2, 1, ink, null);
      px(5, 12, 2, 1, '#e99a92'); px(17, 12, 2, 1, '#e99a92');
    } else {
      oval(12, 11, 5, 6, accent, ink);
      px(10, 9, 4, 4, light);
    }
  } else if (name === 'Foamish') {
    poly([[6,16],[3,20],[5,22],[9,18]], ink);
    poly([[18,16],[21,20],[19,22],[15,18]], ink);
    oval(12, 12, 7, 6, ink); oval(12, 12, 6, 5, base, null);
    for (const [x, y, rx, ry] of [[6,10,3,3],[10,7,4,3],[15,8,4,3],[19,11,3,3]]) {
      oval(x, y, rx, ry, light, ink);
    }
    poly([[10,8],[11,4],[13,6],[15,2],[16,8]], accent);
    poly([[6,15],[8,17],[7,20],[5,19]], light);
    poly([[18,15],[16,18],[17,21],[20,19]], accent);
    poly([[8,18],[5,22],[8,22]], base);
    poly([[16,18],[19,22],[16,22]], base);
    if (view !== 'back') {
      eye(9, 11, '#244c61'); eye(14, 11, '#244c61');
      px(11, 15, 3, 1, ink);
    } else {
      poly([[8,10],[16,10],[17,17],[8,17]], accent, ink);
      px(10, 11, 4, 4, light);
    }
    
  } else if (name === 'Jelluburst') {
    poly([[4,14],[1,18],[2,21],[5,19],[7,16]], ink);
    poly([[20,14],[23,18],[22,21],[19,19],[17,16]], ink);
    poly([[5,12],[3,9],[6,9],[5,6],[9,7],[10,4],[13,6],[16,3],[17,7],[21,6],[19,10],[22,12],[19,15],[6,15]], ink);
    poly([[6,11],[5,9],[8,9],[8,7],[11,8],[13,5],[15,8],[17,6],[18,9],[20,8],[18,12],[17,14],[7,14]], base, null);
    poly([[7,15],[9,15],[8,21],[6,23],[5,22]], light);
    poly([[10,15],[12,15],[12,22],[10,24],[9,22]], accent);
    poly([[14,15],[16,15],[17,22],[15,24],[14,21]], light);
    poly([[18,15],[20,15],[22,20],[20,22],[18,20]], accent);
    if (view !== 'back') {
      eye(9, 10, '#29384f'); eye(15, 10, '#29384f');
      poly([[10,13],[15,13],[13,15],[11,15]], ink, null);
    } else {
      poly([[8,9],[17,9],[19,15],[7,15]], accent, ink);
      px(10, 10, 5, 3, light);
    }
    
  } else if (name === 'Lizrout') {
    poly([[7,17],[3,18],[1,21],[4,22],[9,20]], ink);
    poly([[4,20],[2,21],[6,21],[9,19]], accent, null);
    poly([[7,12],[8,9],[14,9],[17,13],[16,19],[8,20],[6,17]], ink);
    poly([[8,12],[10,10],[14,10],[16,13],[15,18],[9,18],[7,16]], base, null);
    poly([[5,11],[3,7],[5,5],[7,9],[9,7],[11,9],[14,7],[18,10],[17,13]], ink);
    poly([[5,10],[4,7],[6,7],[8,10],[10,8],[12,10],[15,8],[17,10],[15,12]], light, null);
    poly([[8,13],[5,14],[4,17],[8,16]], ink);
    poly([[15,13],[18,13],[20,16],[16,16]], ink);
    poly([[16,15],[20,16],[23,19],[22,21],[18,20],[15,18]], ink);
    poly([[20,18],[22,19],[22,20],[19,19]], accent, null);
    if (view !== 'back') {
      eye(8, 11, '#314338'); eye(14, 11, '#314338');
      poly([[15,14],[20,15],[18,17],[15,16]], '#d2ad64', ink);
    } else {
      poly([[9,10],[15,10],[17,18],[9,18]], accent, ink);
      px(10, 11, 4, 5, light);
    }
    px(8, 19, 3, 3, ink); px(14, 19, 3, 3, ink);
  } else if (name === 'Thornko') {
    poly([[15,16],[19,16],[22,18],[23,21],[20,20],[17,19]], ink);
    poly([[19,18],[22,19],[21,20],[18,19]], accent, null);
    poly([[7,13],[7,8],[10,5],[15,6],[18,11],[17,18],[15,20],[8,20],[6,17]], ink);
    poly([[9,12],[9,8],[11,7],[14,8],[16,12],[15,18],[9,18]], base, null);
    poly([[6,8],[4,1],[8,4],[11,2],[12,0],[14,4],[18,1],[17,8]], ink);
    poly([[7,7],[5,3],[9,5],[11,3],[12,2],[14,6],[17,3],[16,8]], light, null);
    poly([[7,13],[4,11],[3,16],[8,16]], accent);
    poly([[17,13],[20,11],[21,16],[17,16]], light);
    poly([[8,15],[10,16],[9,19],[7,18]], ink);
    poly([[16,15],[18,16],[17,19],[15,18]], ink);
    if (view !== 'back') {
      px(9, 10, 3, 2, ink); px(14, 10, 3, 2, ink);
      px(11, 14, 3, 1, ink);
    } else {
      poly([[9,9],[15,9],[16,18],[9,18]], accent, ink);
      px(10, 10, 4, 5, light);
    }
    px(8, 20, 3, 3, ink); px(15, 20, 3, 3, ink);
  } else if (name === 'Branack') {
    poly([[5,16],[2,15],[0,17],[3,19],[8,18]], ink);
    poly([[2,17],[4,18],[8,17]], accent, null);
    poly([[3,15],[5,10],[9,9],[16,10],[19,14],[18,19],[14,21],[6,20]], ink);
    poly([[5,15],[7,11],[10,10],[15,11],[17,14],[16,18],[13,19],[7,18]], base, null);
    poly([[5,11],[4,7],[7,9],[9,4],[12,9],[15,6],[18,12]], ink);
    poly([[6,10],[6,8],[8,9],[9,6],[11,10],[14,8],[16,11]], light, null);
    poly([[15,13],[20,12],[23,14],[22,16],[17,16]], accent, ink);
    poly([[16,14],[21,14],[23,15],[20,17],[16,16]], light, null);
    px(4, 18, 3, 4, ink); px(15, 19, 3, 3, ink);
    poly([[18,18],[21,17],[23,19],[21,21],[18,20]], ink);
    if (view !== 'back') {
      px(9, 11, 3, 1, ink); px(14, 12, 3, 1, ink);
      px(20, 14, 1, 1, ink);
    } else {
      poly([[7,10],[16,11],[18,18],[8,18]], accent, ink);
      px(10, 12, 5, 4, light);
    }
    px(5, 21, 4, 2, ink); px(14, 21, 4, 2, ink);
  } else if (name === 'Lovlittle') {
    // Lovlittle: soft, rounded fairy silhouette with long petal-like ears
    // and a prominent heart-shaped chest ruff.
    poly([[5,14],[2,10],[2,6],[5,7],[9,11],[10,14]], ink);
    poly([[19,14],[22,10],[22,6],[19,7],[15,11],[14,14]], ink);
    poly([[4,9],[4,7],[6,9],[8,12],[6,11]], light, null);
    poly([[20,9],[20,7],[18,9],[16,12],[18,11]], light, null);
    // round head and compact body
    oval(12, 13, 7, 6, ink);
    oval(12, 13, 6, 5, base, null);
    poly([[7,10],[6,7],[9,8],[10,5],[12,8],[14,5],[15,8],[18,7],[17,11]], ink);
    poly([[8,9],[8,8],[10,8],[11,6],[12,9],[14,6],[15,9],[17,8],[16,10]], light, null);
    // layered heart ruff: broad lobes and a pointed lower tip
    poly([[6,15],[8,14],[11,15],[12,17],[13,15],[16,14],[18,16],[17,19],[12,23],[7,19]], ink);
    poly([[7,16],[9,15],[11,16],[12,18],[13,16],[15,15],[17,16],[16,19],[12,22],[8,19]], accent, null);
    px(9, 16, 2, 1, light); px(13, 16, 2, 1, light);
    if (view !== 'back') {
      eye(9, 11, '#69465f'); eye(14, 11, '#69465f');
      px(11, 14, 2, 1, ink);
      px(8, 13, 1, 1, '#f3a8c5'); px(15, 13, 1, 1, '#f3a8c5');
    } else {
      // visible back-of-head marking and the full heart ruff from behind
      poly([[8,10],[16,10],[18,15],[12,19],[6,15]], light, ink);
      px(10, 11, 4, 3, base);
      poly([[7,16],[11,16],[12,18],[13,16],[17,16],[16,19],[12,22],[8,19]], accent, ink);
    }
    px(7, 20, 3, 2, ink); px(14, 20, 3, 2, ink);
    px(8, 20, 2, 1, light); px(14, 20, 2, 1, light);
    
    
  } else if (name === 'Malittle') {
    // Malittle: compact shadow-spirit body, jagged ghost crown,
    // wispy side-flames and a clearly readable glowing chest jewel.
    poly([[7,14],[4,16],[2,20],[4,22],[8,19],[9,16]], ink);
    poly([[17,14],[20,16],[22,20],[20,22],[16,19],[15,16]], ink);
    poly([[4,19],[6,17],[7,18],[5,21]], base, null);
    poly([[20,19],[18,17],[17,18],[19,21]], base, null);
    // crown silhouette
    poly([[5,14],[3,10],[6,10],[4,5],[9,8],[12,2],[14,7],[19,4],[17,9],[21,8],[18,13],[17,17],[7,17]], ink);
    poly([[7,13],[6,10],[8,10],[7,7],[10,9],[12,5],[14,9],[18,7],[16,11],[19,10],[16,15],[8,15]], base, null);
    // violet shadow ridges and translucent-looking wisps
    poly([[6,11],[5,7],[9,9],[10,11]], accent, ink);
    poly([[15,10],[19,6],[18,11],[16,12]], light, ink);
    poly([[7,15],[4,17],[5,19],[8,17]], accent, null);
    poly([[17,15],[20,17],[19,19],[16,17]], accent, null);
    if (view !== 'back') {
      px(8, 11, 3, 1, '#f5e8ff'); px(14, 11, 3, 1, '#f5e8ff');
      px(9, 11, 1, 1, '#bda8ed'); px(15, 11, 1, 1, '#bda8ed');
      // luminous chest gem, framed by darker pixels for contrast
      poly([[9,14],[12,12],[15,14],[14,18],[12,20],[10,18]], ink);
      poly([[10,14],[12,13],[14,14],[13,17],[12,18],[11,17]], '#f0d7b6', null);
      px(11, 14, 1, 1, '#fff8df'); px(12, 15, 1, 1, '#fff8df');
    } else {
      poly([[8,9],[16,9],[18,15],[15,19],[12,21],[9,19],[6,15]], ink);
      poly([[9,10],[15,10],[17,15],[14,18],[12,19],[10,18],[7,15]], accent, null);
      poly([[10,13],[12,12],[14,13],[13,16],[12,17],[11,16]], '#b4a0d4', ink);
      px(11, 13, 1, 1, '#fff8df');
      // back wisps remain visible from either battle orientation
      poly([[7,15],[4,17],[5,20],[8,18]], light, null);
      poly([[17,15],[20,17],[19,20],[16,18]], light, null);
    }
    px(8, 20, 3, 2, ink); px(14, 20, 3, 2, ink);
    
    
  }

  // Dedicated silhouettes for the nine species that previously fell through to generic art.
  // These are provisional original interpretations pending the owner's exact sketch references.
  if (name === 'Brackibud') {
    poly([[7,7],[10,4],[14,5],[18,8],[19,14],[17,18],[14,20],[9,19],[5,16],[4,11]], base);
    poly([[7,8],[5,4],[9,6]], light); poly([[16,8],[20,4],[19,10]], accent);
    poly([[7,15],[4,17],[6,20],[9,18]], light); poly([[15,15],[18,18],[16,21],[13,18]], accent);
    px(7,12,2,2,ink);px(15,12,2,2,ink);px(10,16,4,1,ink);px(9,8,5,2,light);
  } else if (name === 'Puglow') {
    oval(12,14,8,7,base); poly([[6,9],[3,5],[8,7]],light);poly([[16,8],[20,5],[19,10]],accent);
    oval(8,14,2,2,light,null);oval(16,14,2,2,light,null);
    px(9,13,2,3,ink);px(14,13,2,3,ink);px(11,17,2,1,ink);
    poly([[5,19],[8,21],[10,19]],light,null);poly([[15,19],[18,21],[20,19]],accent,null);
  } else if (name === 'Glacub') {
    poly([[6,8],[9,4],[12,7],[16,4],[19,9],[20,15],[17,19],[12,21],[7,19],[4,15]],base);
    poly([[7,8],[5,4],[9,6]],light);poly([[15,7],[19,3],[18,9]],accent);
    poly([[5,14],[2,12],[4,17]],light);poly([[19,14],[22,12],[20,17]],light);
    px(8,12,2,2,ink);px(15,12,2,2,ink);px(11,16,2,1,ink);
    px(8,18,3,2,light);px(14,18,3,2,accent);
  } else if (name === 'Hauntide') {
    poly([[8,8],[12,4],[17,7],[19,13],[17,18],[14,19],[12,22],[9,19],[6,20],[4,16],[5,11]],base);
    poly([[8,8],[6,4],[10,6]],light);poly([[16,7],[20,4],[19,10]],accent);
    poly([[5,17],[2,20],[6,21],[8,19]],light);poly([[16,18],[20,21],[22,19],[19,17]],accent);
    if(view!=='back'){px(8,12,2,3,ink);px(15,12,2,3,ink);px(11,16,2,1,ink);}
    
  } else if (name === 'Duskrowl') {
    poly([[12,7],[8,3],[7,8],[4,10],[3,16],[7,18],[12,20],[17,18],[21,16],[20,10],[17,8],[16,3]],base);
    poly([[8,9],[4,7],[5,13],[9,15]],light);poly([[16,9],[20,7],[19,13],[15,15]],accent);
    poly([[8,8],[11,11],[9,13]],ink);poly([[16,8],[13,11],[15,13]],ink);
    if(view!=='back'){px(9,11,2,2,'#fff6c8');px(15,11,2,2,'#fff6c8');px(11,15,2,1,ink);}
    poly([[10,19],[12,22],[14,19]],accent);
  } else if (name === 'Ferrivine') {
    poly([[7,10],[10,6],[14,7],[18,10],[18,16],[14,19],[8,19],[5,16]],base);
    poly([[6,11],[2,6],[4,13],[8,14]],light);poly([[16,11],[22,6],[20,14],[16,15]],accent);
    poly([[7,8],[4,3],[10,6]],light);poly([[15,8],[20,3],[18,9]],accent);
    px(8,12,2,2,ink);px(15,12,2,2,ink);px(11,16,2,1,ink);
    poly([[10,19],[8,22],[12,21]],light,null);poly([[14,19],[17,22],[13,21]],accent,null);
  } else if (name === 'Drakindle') {
    poly([[6,9],[9,5],[14,6],[18,9],[20,15],[17,19],[7,20],[4,15]],base);
    poly([[7,8],[4,3],[10,6]],light);poly([[15,7],[20,2],[18,9]],accent);
    poly([[17,16],[20,14],[23,10],[22,16],[19,20]],accent);
    px(7,12,2,2,ink);px(15,12,2,2,ink);px(10,16,4,1,ink);
    px(8,18,3,2,light);px(14,18,3,2,accent);
    
  } else if (name === 'Dunemole') {
    poly([[5,13],[7,8],[12,6],[17,9],[20,14],[17,19],[8,20],[4,17]],base);
    poly([[8,8],[7,3],[11,6]],light);poly([[15,8],[19,4],[18,10]],accent);
    poly([[4,15],[1,13],[3,18],[7,18]],light);
    poly([[18,15],[22,13],[20,18],[17,18]],accent);
    px(8,12,2,2,ink);px(15,12,2,2,ink);px(11,16,2,1,ink);
    poly([[9,18],[11,21],[13,18]],light);px(6,20,3,1,ink);px(16,20,3,1,ink);
  } else if (name === 'Faefern') {
    oval(12,15,6,6,base);poly([[8,9],[4,3],[10,6]],light);poly([[15,9],[20,3],[18,10]],accent);
    poly([[5,14],[1,10],[3,16],[7,17]],light);poly([[17,14],[22,10],[20,17],[16,17]],accent);
    px(8,13,2,2,ink);px(15,13,2,2,ink);px(11,16,2,1,ink);
    poly([[9,19],[7,22],[11,20]],light,null);poly([[14,19],[17,22],[13,20]],accent,null);
    
  }

  // Small, species-type animation accents add a second layer to the idle cycle
  // without changing each creature's approved silhouette.
  const poseFrame = ((Math.floor(Number(pose) || 0) % 8) + 8) % 8;
  const speciesType = MALS[name]?.type;
  if (view !== 'back') {
    if (speciesType === 'fire' && [1, 4, 7].includes(poseFrame)) {
      
      px(20, 7 + (poseFrame % 3), 1, 2, '#f08a43');
    } else if (speciesType === 'water' && [2, 5].includes(poseFrame)) {
      oval(3, 7, 1, 1.5, '#d9fbff', null);
      oval(20, 5 + (poseFrame % 2), 1, 1.5, '#fff', null);
    } else if (speciesType === 'electric' && [1, 4, 6].includes(poseFrame)) {
      px(2, 10, 2, 1, '#fff4a3'); px(4, 8, 1, 2, '#fff4a3');
      px(20, 12, 2, 1, '#fff4a3');
    } else if (speciesType === 'grass' && [2, 6].includes(poseFrame)) {
      poly([[3, 7],[5, 4],[7, 7],[5, 9]], '#a8d878', null);
      
    } else if (['ghost', 'psychic', 'fairy'].includes(speciesType) && [1, 4, 7].includes(poseFrame)) {
      
    } else if (speciesType === 'flying' && [2, 6].includes(poseFrame)) {
      px(2, 12, 3, 1, light); px(19, 11, 3, 1, accent);
    } else if (speciesType === 'steel' && [0, 4].includes(poseFrame)) {
      px(11, 14, 2, 2, poseFrame === 0 ? '#fff0a0' : '#8be0d1');
    } else if (['rock', 'ground'].includes(speciesType) && poseFrame === 4) {
      px(2, 20, 2, 1, '#c6b18b'); px(20, 19, 2, 1, '#c6b18b');
    } else if (speciesType === 'bug' && [1, 5].includes(poseFrame)) {
      px(8, 2, 1, 2, light); px(15, 2, 1, 2, accent);
    }
  }

  // Rear-facing battle sprite markings: a readable shoulder/back silhouette, not a mirrored face.
  if (view === 'back') {
    px(9, 8, 6, 2, ink);
    px(8, 10, 8, 5, accent);
    px(10, 10, 4, 4, light);
    px(11, 14, 2, 3, base);
  } else if (pose % 5 === 1) {
    
  }

  // Small palette highlights create the stepped shading used by DS-era sprite art.
  px(6, 18, 3, 1, light);
  px(15, 18, 2, 1, ink);
  g.restore();
}

const MAL_MOTIONS = {
  Seedkit: 'sway', Cinderp: 'trot', Ripplet: 'wag', Bramblet: 'snuffle',
  Mothcinder: 'flutter', Blobble: 'float', Sparkit: 'jitter', Tuskvolt: 'stomp',
  Rocklit: 'rock', Cragmite: 'dig', Breezel: 'dash', Pufflet: 'flutter',
  Glimmit: 'twitch', Hushowl: 'glide', Yapup: 'wag', Bunnet: 'hop',
  Mossit: 'sway', Kilnkit: 'trot', Ripfin: 'swim', Gearbit: 'scuttle',
  Wispurr: 'float', Latticebot: 'servo', Florion: 'snuffle', Blazion: 'trot', Marinox: 'wag',
  Thornox: 'snuffle', Pyrewing: 'flutter', Floatide: 'float', Voltuff: 'jitter',
  Astrin: 'twitch', Skylit: 'glide', Cragmite: 'stomp', Starfox: 'float',
  Leafox: 'sway', Flamfox: 'trot', Wavepup: 'wag', Trailhound: 'wag',
  Grainper: 'twitch', Wheafield: 'sway', Rascoon: 'snuffle', Racrash: 'stomp',
  Jayble: 'flutter', Jayquill: 'glide', Jaystream: 'glide', Titone: 'rock', Rockage: 'stomp',
  Kangol: 'hop', Flareroo: 'trot', Flaresupial: 'stomp',
  Bubbish: 'float', Foamish: 'float', Jelluburst: 'float',
  Lizrout: 'trot', Thornko: 'stomp', Branack: 'stomp',
  Lovlittle: 'float', Malittle: 'twitch',
  Brackibud: 'scuttle', Puglow: 'stomp', Glacub: 'hop',
  Hauntide: 'float', Duskrowl: 'glide', Ferrivine: 'sway',
  Drakindle: 'trot', Dunemole: 'dig', Faefern: 'float',
};
function drawMal(name, x, y, width, height, pose = Math.floor(frame / 6) % 8, side = null) {
  const id = MALS[name].id;
  const phase = frame / 5 + id * 1.73;
  const cycle = Math.sin(phase);
  const motion = MAL_MOTIONS[name] || 'sway';
  let lift = 0, lean = 0, squash = 1, shadow = 1;
  switch (motion) {
    case 'float':
      lift = -3 - Math.sin(phase * 0.55) * 2;
      shadow = 0.74;
      break;
    case 'flutter':
    case 'glide':
      lift = -2 - (motion === 'flutter' ? Math.abs(cycle) * 2 : Math.sin(phase * 0.45) * 1.5);
      lean = cycle * 0.035;
      shadow = 0.82;
      break;
    case 'hop':
    case 'swim':
      lift = -Math.max(0, cycle) * (motion === 'hop' ? 5 : 2);
      squash = cycle < -0.7 ? 0.91 : 1;
      shadow = 1 - Math.max(0, -lift) * 0.035;
      break;
    case 'trot':
    case 'dash':
    case 'scuttle':
      lift = motion === 'dash' ? -Math.max(0, cycle) * 1.5 : 0;
      lean = cycle * (motion === 'dash' ? 0.055 : 0.025);
      squash = cycle < -0.75 ? 0.92 : 1;
      break;
    case 'stomp':
    case 'dig':
      lift = 0;
      lean = cycle * 0.025;
      squash = cycle < -0.65 ? 0.9 : 1;
      break;
    case 'jitter':
    case 'twitch':
    case 'servo':
      lift = motion === 'servo' && Math.floor(frame / 9 + id) % 3 === 0 ? -0.5 : 0;
      lean = motion === 'twitch' ? Math.sin(phase * 1.8) * 0.035 : cycle * 0.025;
      break;
    case 'wag':
    case 'snuffle':
    case 'rock':
    case 'sway':
      lift = 0;
      lean = cycle * (motion === 'rock' ? 0.018 : 0.03);
      squash = motion === 'snuffle' && cycle < -0.5 ? 0.95 : 1;
      break;
  }
  let lunge = 0;
  const action = side && B && B.action && B.action.side === side ? B.action : null;
  if (action) {
    const progress = Math.min(1, (frame - action.started) / 16);
    lunge = (side === 'me' ? 1 : -1) * Math.sin(progress * Math.PI) * 16;
    lift -= Math.sin(progress * Math.PI) * 3;
    squash = 0.94;
  }
  ctx.fillStyle = `rgba(22, 34, 31, ${Math.max(0.12, 0.3 - Math.max(0, -lift) * 0.025)})`;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height - 1, width * 0.34 * shadow, height * 0.07 * shadow, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x + width / 2 + lunge, y + height);
  ctx.rotate(lean);
  ctx.scale(side === 'me' ? -1 : 1, squash);
  ctx.drawImage(malSprite(name, pose, side === 'me' ? 'back' : 'front'), -width / 2, -height + lift, width, height);
  ctx.restore();
}

function drawMalball(g, x, y, radius = 8) {
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#172535';
  g.fillRect(x - radius, y + radius + 1, radius * 2, 2);
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fillStyle = '#f6f1dc';
  g.fill();
  g.save();
  g.beginPath();
  g.arc(x, y, radius - 1, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#e85e58';
  g.fillRect(x - radius, y - radius, radius * 2, radius);
  g.restore();
  g.fillStyle = '#293c4b';
  g.fillRect(x - radius, y - 1, radius * 2, 3);
  g.beginPath();
  g.arc(x, y, Math.max(2, Math.floor(radius / 3)), 0, Math.PI * 2);
  g.fillStyle = '#fffdf1';
  g.fill();
  g.strokeStyle = '#293c4b';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

// ---------- Game state ----------
let S = null;
let saveMessage = '';
let validSaveCache;
let titleSaveProfile;
let titleSaveProfileLoaded = false;
let mode = 'title';
let introScene = 'bedroom';
let introSceneStarted = 0;
let starterReveal = null;
let titleSel = 0;
let openingIndex = 0;
let openingStartedAt = 0;
let openingReturnMode = 'title';
let finishOpening = null;
const NPCS = {
  pocketown: [
    { x: 6, y: 9, c: '#70a050', text: ['Tall grass hides wild mals!', 'Toss a Malball when they are weak.'] },
    { x: 12, y: 12, c: '#a07040', text: ['They say three Wishbits are hidden', 'inside odd boulders across Mellora...'] },
    { x: 10, y: 1, c: '#5070c0', id: 'guard' },
  ],
  route1: [
    { x: 9, y: 8, c: '#8d9ed4', id: 'lumi' },
    { x: 15, y: 7, c: '#d96d78', id: 'mimi' },
    { x: 6, y: 3, c: '#c08030', trainer: 'Youngster Theo', team: [['Jayble', 4], ['Pufflet', 4]], money: 300 },
    { x: 12, y: 9, c: '#40a0a0', trainer: 'Schoolkid Nelle', team: [['Grainper', 6]], money: 400 },
    { x: 17, y: 2, c: '#8060c0', text: ['Solara City is the next stop north.', 'The old Ombra Woods trail is beyond it.'] },
  ],
  sunmeadow: [
    { x: 8, y: 10, c: '#8d9ed4', id: 'lumi2' },
    { x: 6, y: 8, c: '#cf9657', trainer: 'Camper Suri', team: [['Rascoon', 7], ['Pufflet', 7], ['Lizrout', 7]], money: 350 },
    { x: 17, y: 8, c: '#69a79e', trainer: 'Hiker Bram', team: [['Titone', 8], ['Jayquill', 8], ['Bubbish', 8]], money: 400 },
    { x: 16, y: 3, c: '#7eaf68', text: ['Covo Town has a little Gym.', 'Its leader welcomes new challengers!'] },
  ],
  whisperwood: [
    { x: 12, y: 9, c: '#2a3550', trainer: 'Team Meridian Grunt Corin', team: [['Gearbit', 8], ['Tuskvolt', 9]], money: 720, meridian: true },
    { x: 7, y: 5, c: '#2a3550', trainer: 'Team Meridian Grunt Vale', team: [['Gearbit', 9], ['Mothcinder', 10]], money: 720, meridian: true },
    { x: 9, y: 2, c: '#1a2035', trainer: 'Team Meridian Admin Vex', team: [['Gearbit', 11], ['Tuskvolt', 12], ['Latticebot', 13]], money: 2200, boss: true, meridian: true },
  ],
  league: [
    { x: 4, y: 3, c: '#b48a50', trainer: 'Elite Four Aster', eliteFour: 1, money: 3200, intro: ['Aster: I specialise in precision and resolve.', 'Every turn matters. Show me how well you know your partners.'], team: [['Gearbit',24],['Sparkit',24],['Voltuff',25],['Latticebot',26]], victory: ['Aster: A clean victory. You read every opening.', 'One member of the Elite Four has been defeated.'] },
    { x: 15, y: 3, c: '#5b9eb5', trainer: 'Elite Four Brin', eliteFour: 2, money: 3200, intro: ['Brin: The strongest current is the one that keeps moving.', 'Let us see whether your team can adapt.'], team: [['Ripfin',24],['Glacub',25],['Foamish',26],['Marinox',27]], victory: ['Brin: You never lost your rhythm. Well done.', 'Two members of the Elite Four have been defeated.'] },
    { x: 4, y: 9, c: '#79a85d', trainer: 'Elite Four Solene', eliteFour: 3, money: 3200, intro: ['Solene: Growth takes patience, care, and a strong foundation.', 'Show me the strength of your bond.'], team: [['Grainper',24],['Brackibud',25],['Wheafield',26],['Florion',28]], victory: ['Solene: Your partners trust you. That is a strength no machine can copy.', 'Three members of the Elite Four have been defeated.'] },
    { x: 15, y: 9, c: '#786b9e', trainer: 'Elite Four Orin', eliteFour: 4, money: 3200, intro: ['Orin: The quietest opponent can be the hardest to read.', 'Keep your focus when the battle turns strange.'], team: [['Wispurr',25],['Hauntide',26],['Duskrowl',27],['Starfox',29]], victory: ['Orin: You faced the unknown without turning away.', 'The entire Elite Four has been defeated. The Champion is ready.'] },
    { x: 10, y: 11, c: '#d6b15d', trainer: 'Champion Kael', champion: true, money: 6000, intro: ['Kael: So you crossed Alto Ridge and defeated the Elite Four.', 'I am Kael, Champion of Mellora. This final battle is about the journey you built with your partners.', 'Let us give them a battle worth remembering.'], team: [['Tuskvolt',29],['Cragmite',29],['Pyrewing',30],['Jelluburst',31],['Rockage',31],['Drakindle',32]] },
  ],
};

function newGame(gender, name) {
  saveMessage = '';
  S = {
    gender, name, look: gender === 'girl' ? '#d9638c' : '#427fc0',
    map: 'pocketown', x: 9, y: 12, dir: 'up', money: 1000,
    party: [], box: [], bag: { Malball: 0, Potion: 0, Berry: 0 }, seen: {}, caught: {}, evolved: {},
    flags: {}, beaten: {}, wishbits: [], badges: [], room: null, season: 'spring',
  };
}
const SAVE_FORMAT = 'mellora-dawn-state';
const SAVE_VERSION = 1;
const SAVE_KEYS = ['mellora-dawn-save', 'pocketmals_save'];

function packState(state) {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    game: 'mellora-dawn',
    exportedAt: new Date().toISOString(),
    note: 'Pocketmals save in the Mellora region. Future updates read state or snapshot, and still accept older Pocketmals and Lunaro files.',
    state,
    snapshot: state,
  };
}
function looksLikeProgress(obj) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj) && (
    Array.isArray(obj.party) || typeof obj.map === 'string' || Array.isArray(obj.badges)
    || (obj.flags && typeof obj.flags === 'object') || typeof obj.name === 'string'
  );
}
function extractState(parsed, depth = 0) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || depth > 5) return null;
  for (const key of ['state', 'snapshot', 'save', 'data', 'gameState', 'record', 'S']) {
    const child = parsed[key];
    if (looksLikeProgress(child) && child.format !== SAVE_FORMAT) return child;
    const nested = extractState(child, depth + 1);
    if (nested) return nested;
  }
  if (looksLikeProgress(parsed) && parsed.format !== SAVE_FORMAT) return parsed;
  return null;
}
function readStoredSaveRaw() {
  for (const key of SAVE_KEYS) {
    const raw = safeStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
}
function parseSaveText(raw) {
  const parsed = JSON.parse(raw);
  return extractState(parsed);
}
function invalidateSaveCache() {
  validSaveCache = undefined;
  titleSaveProfileLoaded = false;
}
function save() {
  if (!S) return false;
  let saved = false;
  try {
    const envelope = JSON.stringify(packState(S));
    const legacy = JSON.stringify(S);
    // The stable key is preferred; the legacy key remains for older builds.
    saved = safeStorage.setItem('mellora-dawn-save', envelope) || saved;
    saved = safeStorage.setItem('pocketmals_save', legacy) || saved;
  } catch (error) {
    console.warn('Pocketmals could not serialize this save.', error);
  }
  if (!saved) {
    validSaveCache = false;
    saveMessage = 'Save failed. Browser storage is unavailable or full; export a backup before leaving.';
    return false;
  }
  validSaveCache = true;
  titleSaveProfile = S;
  titleSaveProfileLoaded = true;
  saveMessage = '';
  return true;
}
function hasValidSave() {
  if (validSaveCache !== undefined) return validSaveCache;
  const raw = readStoredSaveRaw();
  if (!raw) {
    validSaveCache = false;
    return false;
  }
  try {
    validSaveCache = !!parseSaveText(raw);
    return validSaveCache;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    validSaveCache = false;
    return false;
  }
}
function loadFromObject(loaded) {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    saveMessage = 'That file is not a valid Pocketmals save.';
    return false;
  }
  S = { ...loaded };
  titleSaveProfile = S;
  titleSaveProfileLoaded = true;
  if (!S.map || !MAPS[S.map]) {
    S.map = 'pocketown';
    S.x = 9;
    S.y = 12;
    S.dir = 'down';
  }
  if (S.room && Number.isInteger(S.room.returnX) && Number.isInteger(S.room.returnY)) {
    S.x = S.room.returnX;
    S.y = S.room.returnY;
    if (!MAPS[S.map]) S.map = 'pocketown';
  }
  S.room = null;
  const rows = MAPS[S.map]?.rows || MAPS.pocketown.rows;
  const y = Number.isInteger(S.y) ? S.y : 12;
  const x = Number.isInteger(S.x) ? S.x : 9;
  const row = rows[y] || '';
  if (y < 0 || y >= rows.length || x < 0 || x >= row.length) {
    S.map = 'pocketown';
    S.x = 9;
    S.y = 12;
  } else {
    S.x = x;
    S.y = y;
  }
  if (!['up', 'down', 'left', 'right'].includes(S.dir)) S.dir = 'down';
  S.flags = S.flags && typeof S.flags === 'object' ? S.flags : {};
  S.flags.eliteFourWins = Array.isArray(S.flags.eliteFourWins)
    ? [...new Set(S.flags.eliteFourWins.filter((member) => [1, 2, 3, 4].includes(member)))]
    : [];
  // Remap legacy species names and rebuild all battle-critical fields from trusted data.
  // This also safely discards null entries, unknown species and malformed imported records.
  const sanitizeImportedMal = (entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string') return null;
    const speciesName = NAME_ALIASES[entry.name] || entry.name;
    if (!MALS[speciesName]) return null;
    const rawLevel = Number(entry.lv);
    const level = Number.isFinite(rawLevel) ? Math.max(1, Math.min(100, Math.floor(rawLevel))) : 5;
    const clean = { ...entry, name: speciesName, lv: level };
    const learnedMoves = Array.isArray(entry.moves)
      ? entry.moves.filter((move) => typeof move === 'string' && Object.prototype.hasOwnProperty.call(MOVES, move)).slice(0, 4)
      : [];
    clean.moves = learnedMoves.length ? learnedMoves : makeMal(speciesName, level).moves.slice();
    clean.pp = {};
    for (const move of clean.moves) {
      const maxPP = maxMovePP(move);
      const hasSavedPP = entry.pp && typeof entry.pp === 'object' && entry.pp[move] !== undefined && entry.pp[move] !== null;
      const rawPP = hasSavedPP ? Number(entry.pp[move]) : NaN;
      clean.pp[move] = Number.isFinite(rawPP) ? Math.max(0, Math.min(maxPP, Math.floor(rawPP))) : maxPP;
    }
    calc(clean);
    const rawHP = Number(entry.cur);
    clean.cur = Number.isFinite(rawHP) ? Math.max(0, Math.min(clean.maxhp, Math.floor(rawHP))) : clean.maxhp;
    const rawXP = Number(entry.xp);
    clean.xp = Number.isFinite(rawXP) ? Math.max(0, Math.min(xpNeed(level) - 1, Math.floor(rawXP))) : 0;
    clean.nickname = typeof entry.nickname === 'string' ? entry.nickname.slice(0, 20) : '';
    clean.shiny = entry.shiny === true;
    return clean;
  };
  S.party = Array.isArray(S.party) ? S.party.map(sanitizeImportedMal).filter(Boolean) : [];
  S.box = Array.isArray(S.box) ? S.box.map(sanitizeImportedMal).filter(Boolean) : [];
  if (S.seen && typeof S.seen === 'object') {
    const seen = {};
    for (const k of Object.keys(S.seen)) seen[NAME_ALIASES[k] || k] = true;
    S.seen = seen;
  }
  if (S.caught && typeof S.caught === 'object') {
    const caught = {};
    for (const k of Object.keys(S.caught)) caught[NAME_ALIASES[k] || k] = true;
    S.caught = caught;
  }

  if (S.flags.teamTinkIntroSeen && !S.flags.teamMeridianIntroSeen) S.flags.teamMeridianIntroSeen = true;
  S.season = ['spring', 'summer', 'autumn', 'winter'].includes(S.season) ? S.season : 'spring';
  S.bag = S.bag && typeof S.bag === 'object' ? S.bag : {};
  S.seen = S.seen && typeof S.seen === 'object' ? S.seen : {};
  S.caught = S.caught && typeof S.caught === 'object' ? S.caught : {};
  S.evolved = S.evolved && typeof S.evolved === 'object' ? S.evolved : {};
  S.party = Array.isArray(S.party)
    ? S.party.filter((entry) => entry && typeof entry === 'object' && typeof entry.name === 'string') : [];
  S.box = Array.isArray(S.box)
    ? S.box.filter((entry) => entry && typeof entry === 'object' && typeof entry.name === 'string') : [];
  S.wishbits = Array.isArray(S.wishbits) ? S.wishbits : [];
  S.shinyCaught = S.shinyCaught && typeof S.shinyCaught === 'object' ? S.shinyCaught : {};
  S.beaten = S.beaten && typeof S.beaten === 'object' ? S.beaten : {};
  S.badges = Array.isArray(S.badges) ? S.badges : [];
  S.gender = S.gender || 'boy';
  S.name = S.name || 'Trainer';
  S.look = S.look || (S.gender === 'girl' ? '#d9638c' : '#427fc0');
  if (S.flags.starter) S.flags.maldex = true;
  if (S.flags.starter) S.flags.runningShoes = true;
  for (const mal of [...S.party, ...S.box]) {
    if (!mal || typeof mal !== 'object' || typeof mal.name !== 'string') continue;
    mal.nickname = mal.nickname || '';
  }
  S.money = Number.isFinite(Number(S.money)) ? Math.max(0, Math.floor(Number(S.money))) : 1000;
  if (!S.party.length && S.flags.starter) {
    S.party.push(makeMal(MALS.Kangol ? 'Kangol' : MAL_LIST[0], 8));
    S.flags.saveRepaired = true;
  }
  saveMessage = '';
  save();
  return true;
}
function load() {
  const d = readStoredSaveRaw();
  if (!d) {
    saveMessage = 'No save data found. Choose NEW GAME or IMPORT SAVE.';
    return false;
  }
  let loaded;
  try {
    loaded = parseSaveText(d);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    saveMessage = 'Save data could not be read. Try IMPORT SAVE with a backup file.';
    return false;
  }
  if (!loaded) {
    saveMessage = 'That file is not a Pocketmals save.';
    return false;
  }
  return loadFromObject(loaded);
}
function exportSaveFile() {
  const source = S || (hasValidSave() ? parseSaveText(readStoredSaveRaw()) : null);
  if (!source) {
    saveMessage = 'Nothing to export yet.';
    return false;
  }
  const blob = new Blob([JSON.stringify(packState(source), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pocketmals-save.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  saveMessage = 'Save file downloaded. Keep it for the next update.';
  return true;
}
function importSaveText(raw) {
  let loaded;
  try {
    loaded = parseSaveText(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    saveMessage = 'That file could not be read.';
    return false;
  }
  if (!loaded) {
    saveMessage = 'No adventure data found in that file.';
    return false;
  }
  const ok = loadFromObject(loaded);
  if (ok) {
    invalidateSaveCache();
    validSaveCache = true;
    titleSel = 0;
    saveMessage = S.flags.saveRepaired
      ? 'Imported. Missing partners were restored so you can keep playing.'
      : 'Save imported. Choose CONTINUE.';
  }
  return ok;
}
function promptImportSave() {
  const input = document.getElementById('save-import');
  if (!input) {
    saveMessage = 'Import is unavailable in this browser.';
    return;
  }
  input.value = '';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importSaveText(String(reader.result || ''));
      mode = 'title';
    };
    reader.onerror = () => { saveMessage = 'Could not read that file.'; };
    reader.readAsText(file);
  };
  input.click();
}
function titleChoices() {
  const hasSave = hasValidSave();
  const items = [];
  if (hasSave) items.push({ id: 'continue', label: 'CONTINUE' });
  items.push({ id: 'new', label: 'New Game' });
  items.push({ id: 'import', label: 'IMPORT SAVE' });
  if (hasSave) items.push({ id: 'export', label: 'EXPORT SAVE' });
  return items;
}

// ---------- World ----------
let moving = null; // {fx,fy,t}
const tileAt = (x, y) => (MAPS[S.map].rows[y] || '')[x] || 'T';
const npcAt = (x, y) => NPCS[S.map].find((n) => n.x === x && n.y === y
  && !(n.id === 'mimi' && S.flags.rival)
  && !(n.id === 'guard' && S.flags.starter)
  && !(n.id === 'lumi2' && !S.flags.lumiMet));
const SOLID = 'THLCSDWRBYEK';

function tryMoveRoom(dir) {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = S.x + d[0], ny = S.y + d[1];
  if (dir === 'down' && S.y === 13 && S.x === 10) return leaveRoom();
  if (nx < 1 || nx > 18 || ny < 3 || ny > 13) return;
  if ((ny === 6 || ny === 7) && (nx < 9 || nx > 11)) return;
  moving = { fx: S.x, fy: S.y, t: 0 };
  S.x = nx;
  S.y = ny;
}
function enterRoom(type, returnX = S.x, returnY = S.y) {
  S.room = { type, returnX, returnY };
  S.x = 10;
  S.y = 12;
  S.dir = 'up';
  moving = null;
  musicTrack = '';
}
function leaveRoom() {
  S.x = S.room.returnX;
  S.y = S.room.returnY;
  S.room = null;
  S.dir = 'down';
  moving = null;
  musicTrack = '';
}
function tryMove(dir) {
  S.dir = dir;
  if (S.room) return tryMoveRoom(dir);
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = S.x + d[0], ny = S.y + d[1];
  const ex = MAPS[S.map].exits;
  if (ny < 0 && ex.up) {
    if (S.map === 'pocketown' && !S.flags.starter) return talk({ id: 'guard' });
    if (S.map === 'whisperwood' && !S.badges.includes('Grove Badge')) {
      return say('A soft starlight seals the ridge path. Earn the Grove Badge to pass.');
    }
    if (S.map === 'starlit' && !['Meadow Badge', 'Tide Badge', 'Grove Badge'].every((badge) => S.badges.includes(badge))) {
      return say('The Alto League gates recognise only trainers who have earned all three Mellora Gym badges.');
    }
    return changeMap(ex.up[0], S.map === 'sunmeadow' ? 14 : S.x, 13);
  }
  if (ny > 14 && ex.down) return changeMap(ex.down[0], S.x, 1);
  const t = tileAt(nx, ny);
  if (t === 'D' || t === 'B' || t === 'R' || t === 'E') return interactTile(t, nx, ny);
  if (SOLID.includes(t) || npcAt(nx, ny)) return;
  moving = { fx: S.x, fy: S.y, t: 0 };
  S.x = nx;
  S.y = ny;
}
function changeMap(m, x, y) {
  const changedArea = S.map !== m;
  S.map = m;
  S.x = x;
  S.y = y;
  if (m === 'sunmeadow') S.flags.sunmeadowVisited = true;
  if (changedArea) locationCard = { name: MAPS[m].name, start: frame };
  flash = 0.72;
  if (m === 'whisperwood' && !S.flags.teamMeridianIntroSeen) {
    S.flags.teamMeridianIntroSeen = true;
    teamArrival = { start: frame };
    save();
    // sayAll installs the first dialogue box synchronously, pausing movement
    // while Tessa catches up and explains what Professor Lotus warned her about.
    void whisperwoodArrivalScene();
  }
  if (m === 'starlit' && !S.flags.starlitIntroSeen) {
    S.flags.starlitIntroSeen = true;
    save();
    void starlitArrivalScene();
  }
}
async function starlitArrivalScene() {
  await sayAll([
    'The air here is thin and bright. Constellations feel closer than they should.',
    'A soft chime drifts from the ridge stones — Wishbit energy, but calmer.',
    'Tessa (message): If you spot a Starfox, record everything. Lotus will lose her mind.',
  ]);
}
async function whisperwoodArrivalScene() {
  await sayAll([
    'Tessa: Wait — stop. Look at the path.',
    'Tessa: Professor Lotus warned me about this. Team Meridian has been operating in Ombra Woods.',
    'Tessa: They believe the Wishbits sit on an old energy meridian under Mellora.',
    'Tessa: If they seize every node, they can force Pocketmal evolution... and rewrite how bonds work.',
    'Tessa: That is not research. That is control.',
    'Tessa: Stay sharp. Their grunts wear indigo coats with amber lines — and they do not negotiate.'
  ]);
  teamArrival = null;
  save();
}

function drawAreaTitleCard() {
  if (!locationCard) return;
  const age = frame - locationCard.start;
  const duration = 100;
  if (age >= duration) { locationCard = null; return; }
  const ease = age < 13 ? age / 13 : age > 77 ? (duration - age) / 23 : 1;
  const travel = Math.max(0, Math.min(1, ease));
  const x = Math.round((1 - travel) * -326);
  const y = 78;
  ctx.save();
  ctx.globalAlpha = Math.min(1, travel * 1.35);
  // Black-and-white shutters and a bold double-frame echo the DS route banner.
  ctx.fillStyle = '#111820';
  ctx.fillRect(x, y, 320, 82);
  ctx.fillStyle = '#f2f0e4';
  ctx.fillRect(x + 5, y + 5, 310, 72);
  ctx.fillStyle = '#171f2b';
  ctx.fillRect(x + 8, y + 8, 304, 3);
  ctx.fillRect(x + 8, y + 71, 304, 3);
  ctx.fillStyle = '#d5d8d1';
  ctx.fillRect(x + 13, y + 16, 294, 48);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 17, y + 20, 286, 40);
  ctx.fillStyle = '#253446';
  ctx.font = 'bold 7px "Pixelify Sans", Arial, sans-serif';
  ctx.fillText('NOW ENTERING', x + 24, y + 32);
  ctx.fillStyle = '#172638';
  ctx.font = 'bold 16px "Pixelify Sans", Arial, sans-serif';
  const title = locationCard.name.toUpperCase();
  ctx.textAlign = 'center';
  ctx.fillText(title, x + 160, y + 52, 274);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5a6f78';
  ctx.font = 'bold 6px "Pixelify Sans", Arial, sans-serif';
  ctx.fillText('MELLORA REGION', x + 24, y + 66);
  ctx.fillStyle = '#9eafae';
  ctx.fillRect(x + 110, y + 63, 190, 1);
  ctx.restore();
}

async function afterStep() {
  if (S.room) return;
  for (const n of NPCS[S.map]) {
    if (n.trainer && !S.beaten[S.map + n.x + n.y] && Math.abs(n.x - S.x) + Math.abs(n.y - S.y) === 1) {
      return talk(n);
    }
  }
  const md = MAPS[S.map];
  if (tileAt(S.x, S.y) === 'G' && S.party.length && Math.random() < 0.12) {
    const name = md.grass[Math.floor(Math.random() * md.grass.length)];
    const lv = md.lv[0] + Math.floor(Math.random() * (md.lv[1] - md.lv[0] + 1));
    sfx.encounter();
    await battle([makeMal(name, lv)], null);
    return;
  }
  sfx.step();
  save();
}

async function interactTile(t, x, y) {
  if (t === 'R') return sayAll(['COVO TOWN — where every journey', 'fits in your pocket.']);
  if (t === 'E') {
    if (S.map === 'pocketown' && x === 15 && y === 12) return enterRoom('gym', x, y + 1);
    if (S.map === 'sunmeadow' && x === 15 && y === 12) {
      if (!S.badges.includes('Meadow Badge')) return say('The Solara City Gym is closed until you earn the Meadow Badge.');
      return enterRoom('gym2', x, y + 1);
    }
    if (S.map === 'whisperwood' && x === 15 && y === 13) {
      if (!S.flags.chapter1) return say('The Ombra Woods Gym is still closed. The forest needs help before the Gym can reopen.');
      return enterRoom('gym3', x - 1, y);
    }
    return;
  }
  if (t === 'B') {
    const key = S.map + x + y;
    if (S.wishbits.includes(key)) return say('Just a boulder.');
    S.wishbits.push(key);
    sfx.catch();
    return sayAll([`You found a shining WISHBIT! (${S.wishbits.length}/3)`, 'Professor Lotus might want to see this.']);
  }
  if (S.map !== 'pocketown') return;
  if (x === 4 && y === 3) {
    healAll();
    return sayAll(['Mom: Welcome home, sweetie!', 'Your mals look well rested now.']);
  }
  if (x === 15 && y === 3) return enterRoom('lab', x, y + 1);
  if (x === 4 && y === 8) return enterRoom('center', x, y + 1);
  if (x === 15 && y === 8) return shop();
}
function healAll() {
  S.party.forEach((m) => {
    m.cur = m.maxhp;
    ensureMovePP(m);
    for (const move of (m.moves || [])) m.pp[move] = maxMovePP(move);
  });
  sfx.heal();
  save();
}

function canClaimWishbitGift() {
  return Boolean(S.flags.starter) && S.wishbits.length >= 3 && !S.flags.wishbitGift;
}

async function claimWishbitGift() {
  await sayAll([
    'Professor Lotus: Three Wishbits! Their light has found a pattern...',
    'The stones glow together, and two small Pocketmals emerge from the glow.',
    'Professor Lotus: I promised you one of these as a research gift. Lovlittle and Malittle are both ready to join you, but you may choose only one.'
  ]);
  let pick = -1;
  while (pick < 0) {
    pick = await choose(['Lovlittle  /  FAIRY-NORMAL', 'Malittle  /  DARK-GHOST'], 'Choose your one Wishbit gift');
  }
  const name = ['Lovlittle', 'Malittle'][pick];
  // Record the one-time choice before adding the gift so the event cannot repeat.
  S.flags.wishbitGift = name;
  save();
  const gift = makeMal(name, 10, Math.random() < 1 / pocketmalShinyOdds());
  await addMal(gift);
  save();
  await sayAll([
    `Professor Lotus: ${name} is your gift. I'll record what we learned from the stones.`,
    `${name} joined your team, or was sent to the MALBOX if your party was full.`,
    'Professor Lotus: The other Pocketmal will remain here at the lab. This choice is yours alone.'
  ]);
}

async function pip() {
  if (!S.flags.starter) {
    let pick = -1;
    while (pick < 0) {
      pick = await choose(
        STARTER_NAMES.map((name) => `${name}  /  ${MALS[name].type.toUpperCase()}`),
        'Choose your first partner'
      );
    }

    const name = STARTER_NAMES[pick];
    await addMal(makeMal(name, 5));
    starterReveal = { name, start: frame };

    const rivalStarter = RIVAL_STARTERS[name];

    S.flags.starter = name;
    S.flags.rivalStarter = rivalStarter;
    S.flags.runningShoes = true;
    S.bag.Malball = 5;
    S.bag.Potion = 3;
    S.bag.Berry = 0;
    S.flags.maldex = true;
    S.flags.friendIntroduced = true;
    save();

    await sayAll([
      `Professor Lotus: Excellent choice. ${name} looks ready to explore Mellora with you.`,
      `Tessa: Then I'll choose ${rivalStarter}! I want to see how our partners grow together.`,
      'Professor Lotus: Your Maldex will record what you discover. I packed five Malballs and three Potions.',
      "Tessa: I will head for Route 1. Meet me out there — I want to compare notes!",
      'Professor Lotus: Be curious, observe carefully, and treat every Pocketmal with care.'
    ]);
    return;
  }

  if (canClaimWishbitGift()) return claimWishbitGift();

  return say(`Professor Lotus: Your Maldex records ${Object.keys(S.caught).length} of ${MAL_LIST.length} Pocketmals caught. Keep up your field research!`);
}
async function shop() {
  const catalog = { ...ITEMS, ...TMS };
  const names = Object.keys(catalog);
  while (true) {
    const i = await choose(names.map((n) => `${n}  $${catalog[n].price}`).concat(['Leave']), `Shop  Money $${S.money}`);
    if (i < 0 || i === names.length) return;
    const n = names[i];
    if (S.money < catalog[n].price) await say('Not enough money!');
    else {
      S.money -= catalog[n].price;
      S.bag[n] = (S.bag[n] || 0) + 1;
      sfx.ok();
      if (TMS[n]) await say(`${n} teaches ${TMS[n].move}. Use it from the Bag on a partner.`);
    }
  }
}

async function addMal(m, options = {}) {
  S.seen[m.name] = S.caught[m.name] = true;
  if (options.askNickname !== false) {
    await say(`Would you like to give ${m.name} a nickname?`);
    if (await choose(['Give a nickname', 'Keep species name'], 'Name your Pocketmal') === 0) {
      m.nickname = await askNickname(m.name) || '';
    }
  }
  if (S.party.length < 6) S.party.push(m);
  else {
    S.box.push(m);
    playMalCry(m.name, 'caught');
    return say(`${malName(m)} was sent to the MALBOX.`);
  }
  playMalCry(m.name, 'caught');
}

async function talk(n) {
  if (n.id === 'guard') {
    return sayAll([
      'Town Guide: The northern road leads to Route 1.',
      'Professor Lotus is expecting you at the research lab. You should choose a partner before heading out.'
    ]);
  }

  if (n.id === 'lumi') {
    if (!S.flags.lumiMet) {
      S.flags.lumiMet = true;
      S.bag.Malball = (S.bag.Malball || 0) + 3;
      S.bag.Berry = (S.bag.Berry || 0) + 2;
      save();
      await sayAll([
        'Mira: Oh, hello! I help Professor Lotus record Pocketmal sightings.',
        'I get a little shy meeting new trainers, but your partner seems kind.',
        'These spare Malballs and Berries might help you on Route 1.'
      ]);
    }
    if (!(S.bag['Shiny Charm'] > 0)) {
      S.bag['Shiny Charm'] = 1;
      save();
      sfx.itemGet();
      await say('Mira gave you the Shiny Charm!');
      await say('It gently improves your chance of meeting a shiny Pocketmal. I hope it brings you luck!');
    }
    return say('Mira: The best field notes come from watching Pocketmals patiently. They do all sorts of things when they think nobody is looking.');
  }

  if (n.id === 'lumi2') {
    return sayAll([
      'Mira: You made it to Solara City! I did too.',
      'A Pufflet landed beside my notebook today. I think it recognised its own song in my recording.',
      'Your partner looks happy following you. I hope I can be that confident with my own team one day.'
    ]);
  }

  if (n.id === 'mimi') {
    if (!S.flags.starter) return say("Tessa: Professor Lotus is waiting at the lab. Come on — this is the day we choose our partners!");
    if (!S.flags.sunmeadowVisited) {
      return sayAll([
        "Tessa: I have been practising my throws with my new partner.",
        "Let us make it to Solara City first. Then we can have our first proper battle!"
      ]);
    }

    const rival = S.flags.rivalStarter || RIVAL_STARTERS[S.flags.starter];

    await sayAll([
      "Tessa: There you are! I have been training with my partner since we left the lab.",
      "A battle is the best way to see how much we have learned. Ready?"
    ]);

    const won = await battle(
      [makeMal(rival, 7)],
      { name: 'Tessa', money: 350 }
    );

    if (won) {
      S.flags.rival = true;
      save();
      await sayAll([
        "Tessa: That was close! Your partner has really come a long way.",
        "I am going to keep training. Next time, I will not make it easy for you!"
      ]);
    } else {
      await say("Tessa: Do not worry. We will both get stronger with every trip along the routes.");
    }
    return;
  }

  if (n.trainer) {
    const key = S.map + n.x + n.y;
    if (S.beaten[key]) return say(`${n.trainer}: Well battled. Maybe we'll meet again on another route.`);
    const eliteWins = Array.isArray(S.flags.eliteFourWins) ? S.flags.eliteFourWins : [];
    if (n.eliteFour > 1 && !eliteWins.includes(n.eliteFour - 1)) return say(`${n.trainer}: The previous Elite Four member must be defeated before I can accept your challenge.`);
    if (n.champion && eliteWins.length < 4) return say('Champion Kael: Defeat all four members of the Elite Four before challenging me.');

    if (n.champion || n.eliteFour) {
      await sayAll(n.intro || []);
    } else if (n.boss) {
      await sayAll([
        'Admin Vex: So the professor sent children to interfere.',
        'Admin Vex: Team Meridian does not steal Wishbits for toys. We realign the meridian.',
        'Admin Vex: Bonded energy is wasted on sentiment. Watch how a true lattice is built.',
      ]);
    } else if (n.meridian) {
      await sayAll([
        `${n.trainer}: Halt. This sector is under Meridian authority.`,
        `${n.trainer}: Hand over any Wishbit readings — or prove you can stand in our way.`,
      ]);
    } else {
      await say(`${n.trainer}: Let's see what your Pocketmals can do!`);
    }

    const won = await battle(
      n.team.map(([nm, lv]) => makeMal(nm, lv)),
      { name: n.trainer, money: n.money }
    );

    if (won) {
      S.beaten[key] = true;
      if (n.eliteFour) {
        const wins = new Set(Array.isArray(S.flags.eliteFourWins) ? S.flags.eliteFourWins : []);
        wins.add(n.eliteFour);
        S.flags.eliteFourWins = [...wins].sort((a, b) => a - b);
        await sayAll(n.victory || []);
      }
      if (n.champion) {
        S.flags.leagueChampionDefeated = true;
        S.flags.melloraChampionSeen = true;
        S.bag['Champion Crest'] = 1;
        await sayAll([
          'Kael: You did it. Mellora has a new Champion.',
          'Your partners stood with you through every route, every Gym, and every challenge.',
          'Professor Lotus (via radio): Your fieldwork has become part of Mellora history. I could not be prouder.',
          'Tessa: Champion! I knew you and your partners could do it. Our next journey starts whenever you are ready.',
          'CHAMPION OF MELLORA',
          'You received the CHAMPION CREST. Your victory is saved.'
        ]);
      }
      save();
      if (n.boss) {
        S.flags.chapter1 = true;
        await sayAll([
          'Admin Vex: ...Impressive. But the meridian does not end in this wood.',
          'Admin Vex: Team Meridian will map every node from Solara City to the ridge.',
          'Admin Vex: Next time, sentiment will not save you.',
          'The indigo coats vanish between the trees. The Wishbit stones grow quieter.',
          'CHAPTER 1 COMPLETE',
          'Ombra Woods is free — for now. Report to Professor Lotus when you can.',
          'The Ombra Woods Gym can reopen. Alto Ridge still waits beyond the Grove Badge.',
        ]);
      }
    }
    return;
  }

  return sayAll(n.text || ['The person has nothing more to say.']);
}
async function interact() {
  if (S.room) {
    if (S.y >= 5 && S.y <= 9 && Math.abs(S.x - 10) <= 2) {
      if (S.room.type === 'lab') return pip();
      if (S.room.type.startsWith('gym')) return gymLeader();
      await say('Nurse Fern: Welcome to the Mellora Healing Center!');
      healAll();
      save();
      return say('Your Pocketmals are all healed. Your game has been saved!');
    }
    if (S.y === 13 && S.x === 10) {
      leaveRoom();
      return;
    }
    return say(S.room.type === 'lab'
      ? 'Professor Lotus is just ahead. Walk up to the counter to talk.'
      : S.room.type === 'gym'
        ? 'Leader Rowan is on the mat. Walk up to begin a friendly challenge.'
        : 'The healing counter is just ahead.');
  }
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[S.dir];
  const x = S.x + d[0], y = S.y + d[1];
  const n = npcAt(x, y);
  if (n) return talk(n);
  const t = tileAt(x, y);
  if ('DBRE'.includes(t)) return interactTile(t, x, y);
}

// ---------- Pause menu ----------
const MENU_ITEMS = [
  { label: 'PARTNER', page: 'party', color: '#53c7a5' },
  { label: 'MALDEX', page: 'dex', color: '#f08c74' },
  { label: 'BAG', page: 'bag', color: '#f3c857' },
  { label: 'TRAINER CARD', page: 'trainer', color: '#83aef2' },
  { label: 'SAVE', page: 'save', color: '#b887dc' },
  { label: 'OPTIONS', page: 'options', color: '#58ccb4' },
  { label: 'MALBOX', page: 'box', color: '#c28bd7' },
  { label: 'REGION MAP', page: 'map', color: '#83c66e' },
];
const BAG_CATEGORIES = ['MEDICINE', 'POKE BALLS', 'KEY ITEMS', 'OTHER'];
let menuState = null;
function pauseMenu() {
  menuState = { page: 'home', selection: 0, category: 0, dexView: false, boxScroll: 0 };
  mode = 'menu';
}
function closeMenu() {
  menuState = null;
  mode = 'world';
}
function menuBagItems() {
  const keys = Object.keys(S.bag).filter((name) => S.bag[name] > 0);
  if (menuState.category === 0) return keys.filter((name) => ['Potion', 'Super Potion', 'Berry'].includes(name));
  if (menuState.category === 1) return keys.filter((name) => name.includes('Malball'));
  if (menuState.category === 2) return [...(S.flags.maldex ? ['Maldex'] : []), ...(S.flags.runningShoes ? ['Running Shoes'] : [])];
  return keys.filter((name) => !['Potion', 'Super Potion', 'Berry'].includes(name) && !name.includes('Malball'));
}
function openMenuPage(page) {
  if (page === 'close') return closeMenu();
  if (page === 'save') {
    save();
    menuState.page = 'saved';
    menuState.selection = 0;
    return;
  }
  menuState.page = page;
  menuState.selection = 0;
  menuState.dexView = false;
}
function changeMenuSelection(delta) {
  if (menuState.page === 'home') {
    const col = menuState.selection % 2;
    const row = Math.floor(menuState.selection / 2);
    if (delta === 'left' || delta === 'right') {
      const candidate = row * 2 + (col === 0 ? 1 : 0);
      if (candidate < MENU_ITEMS.length) menuState.selection = candidate;
    } else {
      const rows = Math.ceil(MENU_ITEMS.length / 2);
      const nextRow = (row + (delta === 'up' ? rows - 1 : 1)) % rows;
      const candidate = nextRow * 2 + col;
      if (candidate < MENU_ITEMS.length) menuState.selection = candidate;
      else if (candidate - 1 < MENU_ITEMS.length) menuState.selection = candidate - 1;
    }
  } else if (menuState.page === 'bag') {
    if (delta === 'left' || delta === 'right') {
      menuState.category = (menuState.category + (delta === 'left' ? BAG_CATEGORIES.length - 1 : 1)) % BAG_CATEGORIES.length;
      menuState.selection = 0;
    } else {
      const count = menuBagItems().length;
      if (count) menuState.selection = (menuState.selection + (delta === 'up' ? count - 1 : 1)) % count;
    }
  } else if (menuState.page === 'party') {
    if (S.party.length) menuState.selection = (menuState.selection + (delta === 'up' ? S.party.length - 1 : 1)) % S.party.length;
  } else if (menuState.page === 'box') {
    const count = S.box.length;
    if (count) {
      const step = delta === 'left' ? -1 : delta === 'right' ? 1 : delta === 'up' ? -3 : 3;
      menuState.selection = Math.max(0, Math.min(count - 1, menuState.selection + step));
      menuState.boxScroll = Math.floor(menuState.selection / 12) * 12;
    }
  } else if (menuState.page === 'dex') {
    menuState.selection = (menuState.selection + (delta === 'up' ? MAL_LIST.length - 1 : 1)) % MAL_LIST.length;
  } else if (menuState.page === 'options' && (delta === 'up' || delta === 'down')) {
    const count = 6;
    menuState.selection = (menuState.selection + (delta === 'up' ? count - 1 : 1)) % count;
  }
}
function useMenuBagItem(name) {
  if (name === 'Maldex') {
    menuState.page = 'dex';
    menuState.selection = 0;
    menuState.dexView = false;
    return;
  }
  if (name === 'Running Shoes') {
    S.flags.running = !S.flags.running;
    return;
  }
  if (name === 'Malball' || name === 'Great Malball') return;
  if (!['Potion', 'Super Potion', 'Berry'].includes(name)) return;
  const mal = S.party.find((member) => member.cur > 0 && member.cur < member.maxhp);
  if (!mal) return;
  const healing = name === 'Potion' ? 25 : name === 'Super Potion' ? 60 : 15;
  mal.cur = Math.min(mal.maxhp, mal.cur + healing);
  S.bag[name]--;
  sfx.heal();
}
function activateMenuSelection() {
  if (menuState.page === 'dex') {
    if (menuState.dexView) menuState.dexView = false;
    else menuState.dexView = true;
    return;
  }
  if (menuState.page === 'home') {
    openMenuPage(MENU_ITEMS[menuState.selection].page);
  } else if (menuState.page === 'bag') {
    const name = menuBagItems()[menuState.selection];
    if (name) useMenuBagItem(name);
  } else if (menuState.page === 'party') {
    const [mal] = S.party.splice(menuState.selection, 1);
    if (mal) S.party.unshift(mal);
    menuState.selection = 0;
  } else if (menuState.page === 'box') {
    const index = menuState.selection;
    if (S.box[index]) {
      const [mal] = S.box.splice(index, 1);
      if (S.party.length < 6) {
        S.party.push(mal);
      } else {
        // With a full party, swap the selected stored Pocketmal with the lead.
        const oldLead = S.party[0];
        S.party[0] = mal;
        S.box.push(oldLead);
      }
      menuState.selection = Math.max(0, Math.min(index, S.box.length - 1));
      menuState.boxScroll = Math.floor(menuState.selection / 12) * 12;
      save();
    }
  } else if (menuState.page === 'options') {
    if (menuState.selection === 0) setMuted(!muted);
    else if (menuState.selection === 1) {
      gameSettings.soundEffects = !gameSettings.soundEffects;
      saveSettings();
    } else if (menuState.selection === 2) {
      gameSettings.textSpeed = (gameSettings.textSpeed + 1) % 3;
      saveSettings();
    } else if (menuState.selection === 3) {
      gameSettings.frameStyle = (gameSettings.frameStyle + 1) % 3;
      saveSettings();
    } else if (menuState.selection === 4) {
      if (S.flags.runningShoes) S.flags.running = !S.flags.running;
      else S.flags.runningShoes = true;
    } else {
      const seasons = ['spring', 'summer', 'autumn', 'winter'];
      setGameSeason(seasons[(seasons.indexOf(S.season || 'spring') + 1) % seasons.length]);
    }
  } else if (menuState.page === 'saved') {
    exportSaveFile();
    closeMenu();
  } else if (menuState.page === 'trainer') {
    save();
  }
}
function handleMenuKey(key) {
  if (!menuState) return;
  if (key === 'b') {
    if (menuState.page === 'dex' && menuState.dexView) {
      menuState.dexView = false;
      return;
    }
    if (menuState.page === 'home') closeMenu();
    else {
      menuState.page = 'home';
      menuState.selection = 0;
    }
    return;
  }
  if (key === 'y') {
    if (menuState.page === 'dex' && S.flags.maldex) {
      const speciesName = MAL_LIST[menuState.selection];
      if (S.seen[speciesName]) playMalCry(speciesName, 'preview');
      return;
    }
    if (S.flags.runningShoes) S.flags.running = !S.flags.running;
    return;
  }
  if (key === 'x' && menuState.page !== 'home') {
    if (menuState.page === 'dex' && menuState.dexView) { menuState.dexView = false; return; }
    menuState.page = 'home';
    menuState.selection = 0;
    return;
  }
  if (['up', 'down', 'left', 'right'].includes(key)) changeMenuSelection(key);
  if (key === 'a') activateMenuSelection();
}
function menuPanel(g, x, y, width, height, selected = false) {
  g.fillStyle = selected ? '#244d68' : '#182e45';
  g.fillRect(x, y, width, height);
  g.strokeStyle = selected ? '#55e2ed' : '#466581';
  g.lineWidth = selected ? 2 : 1;
  g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  g.lineWidth = 1;
}
function menuLabel(g, label, x, y, color = '#eaf5ff', size = 10) {
  g.fillStyle = color;
  g.font = `bold ${Math.max(9, Math.round(size * 1.3))}px "Pixelify Sans", Arial, sans-serif`;
  g.fillText(label, x, y);
}
function menuFrame(g, title) {
  g.fillStyle = '#101d31';
  g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#17283f';
  g.fillRect(5, 5, 310, 230);
  g.fillStyle = '#203953';
  g.fillRect(9, 9, 302, 22);
  menuLabel(g, title, 16, 24, '#d8f6ff', 10);
  menuLabel(g, `${S.name}   $${S.money}`, 184, 24, '#9bbbd1', 8);
  g.fillStyle = '#41637c';
  g.fillRect(11, 34, 298, 1);
}
function drawClassicMenuIcon(g, type, x, y, color) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  if (type === 'party') {
    g.beginPath();
    g.arc(16, 16, 13, Math.PI, 0);
    g.stroke();
    g.beginPath();
    g.arc(16, 16, 13, 0, Math.PI);
    g.stroke();
    g.fillRect(3, 15, 26, 3);
    g.beginPath();
    g.arc(16, 16, 4, 0, Math.PI * 2);
    g.stroke();
  } else if (type === 'dex') {
    g.strokeRect(6, 3, 21, 28);
    g.strokeRect(2, 7, 7, 21);
    g.beginPath();
    g.moveTo(12, 10); g.lineTo(22, 10);
    g.moveTo(12, 16); g.lineTo(22, 16);
    g.moveTo(12, 22); g.lineTo(19, 22);
    g.stroke();
  } else if (type === 'bag') {
    g.beginPath();
    g.moveTo(5, 11); g.lineTo(9, 6); g.lineTo(23, 6); g.lineTo(28, 12);
    g.lineTo(26, 29); g.lineTo(7, 29); g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(16, 11, 4, Math.PI, 0);
    g.stroke();
    g.fillRect(14, 17, 5, 5);
  } else if (type === 'trainer') {
    g.strokeRect(3, 6, 27, 21);
    g.beginPath();
    g.arc(11, 14, 3, 0, Math.PI * 2);
    g.fill();
    g.fillRect(17, 11, 9, 2);
    g.fillRect(17, 16, 7, 2);
    g.fillRect(7, 21, 20, 2);
  } else if (type === 'save') {
    g.beginPath();
    g.moveTo(5, 27); g.lineTo(9, 12); g.lineTo(25, 4); g.lineTo(22, 21); g.lineTo(12, 29); g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(11, 22); g.lineTo(22, 8);
    g.stroke();
  } else if (type === 'options') {
    g.strokeRect(3, 5, 27, 23);
    g.strokeRect(9, 9, 14, 10);
    g.fillRect(11, 22, 4, 2);
    g.fillRect(17, 22, 4, 2);
    g.beginPath();
    g.moveTo(7, 14); g.lineTo(11, 14);
    g.stroke();
  } else if (type === 'box') {
    g.strokeRect(3, 5, 27, 23);
    g.strokeRect(8, 10, 7, 7);
    g.strokeRect(18, 10, 7, 7);
    g.fillRect(8, 20, 17, 3);
  } else {
    g.beginPath();
    g.moveTo(3, 26); g.lineTo(11, 14); g.lineTo(17, 20); g.lineTo(23, 10); g.lineTo(30, 26); g.closePath();
    g.stroke();
    g.fillRect(4, 27, 26, 3);
  }
  g.restore();
}
function drawClassicMenuCard(g, item, index, x, y, width, height, selected) {
  g.beginPath();
  g.moveTo(x + 2, y + 2);
  g.lineTo(x + width * 0.39, y + 2);
  g.lineTo(x + width * 0.45, y + 9);
  g.lineTo(x + width - 2, y + 9);
  g.lineTo(x + width - 2, y + height - 2);
  g.lineTo(x + 2, y + height - 2);
  g.closePath();
  g.fillStyle = '#090b0d';
  g.fill();
  g.strokeStyle = selected ? '#82b9ff' : '#08090b';
  g.lineWidth = selected ? 2 : 1;
  g.stroke();
  g.fillStyle = selected ? '#225a7a' : '#3d3e40';
  g.fillRect(x + 6, y + 12, width - 12, height - 17);
  g.fillStyle = selected ? '#12354a' : '#1d1e20';
  g.beginPath();
  g.moveTo(x + 7, y + 12);
  g.lineTo(x + width * 0.4, y + 12);
  g.lineTo(x + width * 0.68, y + height - 5);
  g.lineTo(x + 7, y + height - 5);
  g.closePath();
  g.fill();
  g.strokeStyle = selected ? '#d4edff' : '#b5b7b9';
  g.lineWidth = 1;
  g.strokeRect(x + 5.5, y + 11.5, width - 11, height - 16);
  drawClassicMenuIcon(g, item.page, x + 12, y + 16, item.color);
  g.font = 'bold 11px "Pixelify Sans", Arial, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 2;
  g.strokeStyle = '#222';
  g.strokeText(item.label, x + width * 0.66, y + height * 0.64);
  g.fillStyle = '#f1f3f4';
  g.fillText(item.label, x + width * 0.66, y + height * 0.64);
  g.textAlign = 'left';
  g.lineWidth = 1;
}
function drawClassicMenuHome(g) {
  g.fillStyle = '#2c2d2f';
  g.fillRect(0, 0, 320, 240);
  for (let y = 24; y < 204; y += 16) {
    for (let x = 0; x < 320; x += 16) {
      g.fillStyle = ((x / 16 + y / 16) % 2) ? '#363739' : '#303133';
      g.fillRect(x, y, 14, 14);
      g.fillStyle = '#252628';
      g.fillRect(x + 14, y, 2, 14);
      g.fillRect(x, y + 14, 16, 2);
    }
  }
  g.fillStyle = '#101112';
  g.fillRect(0, 0, 320, 23);
  g.fillStyle = '#08090a';
  g.fillRect(0, 23, 320, 3);
  g.fillStyle = '#7b8b98';
  g.fillRect(0, 24, 320, 1);
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  menuLabel(g, clock, 8, 18, '#f2f3f3', 11);
  menuLabel(g, '■ IR   ■ ONLINE   ■ WIRELESS', 100, 17, '#505255', 8);
  g.strokeStyle = '#e6e9e9';
  g.lineWidth = 2;
  g.strokeRect(292, 5, 17, 15);
  g.fillStyle = '#e6e9e9';
  g.fillRect(296, 3, 9, 3);
  g.fillRect(296, 9, 9, 2);

  MENU_ITEMS.slice(0, 6).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawClassicMenuCard(g, item, index, 4 + col * 158, 31 + row * 57, 154, 52, index === menuState.selection);
  });
  g.fillStyle = '#101112';
  g.fillRect(0, 202, 320, 38);
  g.fillStyle = '#777c80';
  g.fillRect(0, 203, 320, 2);
  MENU_ITEMS.slice(6).forEach((item, offset) => {
    const index = offset + 6;
    const x = 8 + offset * 137;
    g.fillStyle = index === menuState.selection ? '#225a7a' : '#292b2d';
    g.fillRect(x, 210, 128, 22);
    g.strokeStyle = index === menuState.selection ? '#82b9ff' : '#777c80';
    g.strokeRect(x + 0.5, 210.5, 127, 21);
    menuLabel(g, `${index === menuState.selection ? '▶ ' : '  '}${item.label}`, x + 6, 225, '#eef0f1', 8);
  });
  g.strokeStyle = '#f04b3d';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(296, 213); g.lineTo(312, 230);
  g.moveTo(312, 213); g.lineTo(296, 230);
  g.stroke();
  g.lineWidth = 1;
}
function drawGameMenu(g) {
  const page = menuState.page;
  if (page === 'home') {
    drawClassicMenuHome(g);
    return;
  }
  const titles = {
    bag: 'BAG', party: 'YOUR PARTNER', dex: 'MALDEX / FIELD JOURNAL',
    trainer: 'TRAINER CARD', options: 'OPTIONS', box: 'MALBOX / STORAGE', map: 'MELLORA REGION',
    saved: 'GAME SAVED',
  };
  menuFrame(g, titles[page] || 'MENU');
  if (page === 'saved') {
    menuLabel(g, 'YOUR ADVENTURE IS SAVED IN THIS BROWSER.', 22, 70, '#e8f4ee', 8);
    menuLabel(g, 'A BACKUP FILE IS DOWNLOADING NOW.', 22, 92, '#ffe9a5', 8);
    menuLabel(g, 'KEEP pocketmals-save.json.', 22, 112, '#d5e4f1', 8);
    menuLabel(g, 'AFTER AN UPDATE, USE IMPORT SAVE', 22, 132, '#d5e4f1', 8);
    menuLabel(g, 'ON THE TITLE SCREEN.', 22, 148, '#d5e4f1', 8);
    menuLabel(g, 'Z CLOSES THIS SCREEN', 22, 180, '#9bbbd1', 8);
  }
  if (page === 'bag') {
    BAG_CATEGORIES.forEach((category, index) => {
      const y = 41 + index * 29;
      menuPanel(g, 12, y, 100, 25, index === menuState.category);
      menuLabel(g, category, 18, y + 16, index === menuState.category ? '#7fe6ed' : '#d5e4f1', 7);
    });
    const items = menuBagItems();
    menuPanel(g, 116, 41, 190, 122);
    menuLabel(g, BAG_CATEGORIES[menuState.category], 124, 55, '#70dce8', 8);
    if (!items.length) menuLabel(g, 'Nothing here yet.', 126, 82, '#aec3d2', 8);
    items.slice(0, 5).forEach((name, index) => {
      const y = 62 + index * 19;
      const selected = index === menuState.selection;
      if (selected) {
        g.fillStyle = '#28536b';
        g.fillRect(120, y - 11, 182, 17);
      }
      menuLabel(g, `${selected ? '>' : ' '} ${name}`, 125, y, selected ? '#fff4bb' : '#dae7f2', 8);
      const count = ['Maldex', 'Running Shoes', 'Bicycle', 'EXP Share', 'Shiny Charm'].includes(name) ? (name === 'Bicycle' ? (S.flags.bikeOn ? 'ON' : 'OFF') : name === 'EXP Share' ? (S.flags.expShareOn ? 'ON' : 'OFF') : name === 'Running Shoes' ? (S.flags.running ? 'ON' : 'OFF') : 'KEY') : `x${S.bag[name] || 0}`;
      menuLabel(g, count, 270, y, '#a9c4d5', 8);
    });
    menuPanel(g, 12, 166, 294, 39);
    const selectedItem = items[menuState.selection];
    const description = selectedItem === 'Maldex' ? 'A paper field journal with your Pocketmal research.'
      : selectedItem === 'Running Shoes' ? 'Toggle a quick dash while walking.'
      : selectedItem === 'Bicycle' ? 'Toggle your bicycle for faster travel.'
      : selectedItem === 'EXP Share' ? 'Share experience with your other partners.'
      : selectedItem === 'Shiny Charm' ? 'A lucky charm that improves the chance of meeting shiny Pocketmals.'
      : selectedItem ? ITEMS[selectedItem]?.desc || 'A useful thing for your journey.'
        : 'Choose a pocket to see what you are carrying.';
    menuLabel(g, description.slice(0, 48), 19, 183, '#d4e5f0', 8);
    menuLabel(g, 'LEFT/RIGHT POCKET   A USE   B BACK', 18, 222, '#9bbbd1', 7);
    return;
  }
  if (page === 'party') {
    if (!S.party.length) {
      menuLabel(g, 'Your adventure is waiting for a partner!', 24, 75, '#d4e5f0', 8);
    }
    S.party.forEach((mal, index) => {
      const y = 40 + index * 22;
      menuPanel(g, 12, y, 294, 20, index === menuState.selection);
      g.fillStyle = '#101e31';
      g.fillRect(15, y + 1, 22, 20);
      g.drawImage(malSprite(mal.name, Math.floor(frame / 6) % 8, 'front', !!mal.shiny), 16, y + 1, 20, 20);
      menuLabel(g, `${index === 0 ? 'LEAD ' : ''}${mal.shiny ? '★ ' : ''}${malName(mal).slice(0, 12)}`, 42, y + 13, mal.shiny ? '#ffe58b' : '#edf6fa', 8);
      menuLabel(g, `Lv${mal.lv}  ${mal.cur}/${mal.maxhp} HP`, 186, y + 13, '#b8d5e3', 8);
      g.fillStyle = '#3c5264';
      g.fillRect(284, y + 7, 15, 5);
      g.fillStyle = '#68ce8b';
      g.fillRect(284, y + 7, 15 * Math.max(0, Math.min(1, mal.cur / Math.max(1, mal.maxhp))), 5);
    });
    menuPanel(g, 12, 176, 294, 28);
    const lead = S.party[menuState.selection];
    menuLabel(g, lead ? `${MALS[lead.name].types.map((type) => type.toUpperCase()).join('/')}  /  ${MALS[lead.name].ability}` : 'Catch a Pocketmal to fill your team.', 19, 194, '#d4e5f0', 8);
    menuLabel(g, 'A ACTIONS   B BACK', 18, 222, '#9bbbd1', 7);
    return;
  }
  if (page === 'dex') {
    if (!S.flags.maldex) {
      menuPanel(g, 18, 57, 284, 122);
      menuLabel(g, 'NO FIELD JOURNAL YET', 44, 85, '#fff1b7', 10);
      menuLabel(g, 'Professor Lotus will give you a paper', 31, 111, '#d4e5f0', 8);
      menuLabel(g, 'Maldex when you choose your partner.', 29, 128, '#d4e5f0', 8);
      menuLabel(g, 'B BACK', 18, 220, '#9bbbd1', 8);
      return;
    }
    const name = MAL_LIST[menuState.selection];
    const species = MALS[name];
    if (menuState.dexView) {
      // The full entry is designed like a page in the paper field journal.
      g.fillStyle = '#f1e4bf';
      g.fillRect(12, 38, 296, 166);
      g.strokeStyle = '#b39a66';
      g.lineWidth = 2;
      g.strokeRect(13, 39, 294, 164);
      g.strokeStyle = '#d8c79d';
      g.lineWidth = 1;
      for (let py = 88; py < 198; py += 12) { g.beginPath(); g.moveTo(19, py); g.lineTo(301, py); g.stroke(); }
      g.strokeStyle = '#d99a8d';
      g.beginPath(); g.moveTo(250, 44); g.lineTo(250, 198); g.stroke();
      const owned = !!S.caught[name] || !!S.evolved[name];
      const seen = !!S.seen[name];
      menuLabel(g, `NO. ${String(species.id).padStart(3, '0')}  ${seen ? name.toUpperCase() : '???'}`, 20, 53, '#443727', 9);
      if (seen) {
        g.fillStyle = TYPE_COLORS[species.type];
        g.beginPath();
        g.arc(276, 64, 17, 0, Math.PI * 2);
        g.fill();
        g.drawImage(malSprite(name, Math.floor(frame / 6) % 8, 'front', !!S.shinyCaught?.[name]), 260, 48, 32, 32);
        menuLabel(g, `${species.types.map((type) => type.toUpperCase()).join('/')}  /  ${S.caught[name] ? 'CAUGHT' : S.evolved[name] ? 'EVOLVED' : 'SEEN'}`, 20, 69, '#665741', 7);
        if (!owned) {
          menuLabel(g, 'catch this Pocketmal to reveal its', 20, 96, '#514637', 8);
          menuLabel(g, 'complete research notes, stats, moves,', 20, 111, '#514637', 8);
          menuLabel(g, 'ability, and evolution information.', 20, 126, '#514637', 8);
          menuLabel(g, species.dex.slice(0, 38), 20, 151, '#665741', 7);
          menuLabel(g, 'FIELD NOTES: INCOMPLETE', 20, 180, '#9a6f24', 8);
        } else {
          menuLabel(g, species.dex.slice(0, 43), 20, 87, '#514637', 7);
          menuLabel(g, species.dex.slice(43, 86), 20, 98, '#514637', 7);
          menuLabel(g, `BASE HP ${species.hp}  ATK ${species.atk}  DEF ${species.def}`, 20, 116, '#443727', 7);
          menuLabel(g, `SPD ${species.spd}  ABILITY: ${species.ability.toUpperCase()}`, 20, 128, '#443727', 7);
          const movesText = `MOVES: ${species.moves.map((move) => `${move} ${MOVES[move][0][0].toUpperCase()}${MOVES[move][1]}`).join(', ')}`;
          menuLabel(g, movesText.slice(0, 44), 20, 143, '#514637', 7);
          menuLabel(g, movesText.slice(44, 88), 20, 154, '#514637', 7);
          const ev = EVOLUTIONS[name];
          if (ev?.to) menuLabel(g, `EVOLVES AT LV ${ev.level} INTO ${ev.to.toUpperCase()}`, 20, 172, '#39714b', 7);
          else if (ev?.from) menuLabel(g, `EVOLVED FROM ${ev.from.toUpperCase()}`, 20, 172, '#39714b', 7);
          else menuLabel(g, 'NO KNOWN EVOLUTION', 20, 172, '#665741', 7);
          menuLabel(g, 'RESEARCH COMPLETE', 20, 188, '#39714b', 7);
        }
      } else {
        menuLabel(g, 'UNDISCOVERED POCKETMAL', 30, 99, '#4f6b7a', 9);
        menuLabel(g, 'Meet one in the wild to begin', 27, 122, '#514637', 8);
        menuLabel(g, 'recording its field notes.', 46, 138, '#514637', 8);
      }
      menuLabel(g, 'Y PLAY CRY   A / B BACK TO LIST', 15, 220, '#655742', 7);
      return;
    }
    const start = Math.max(0, Math.min(menuState.selection - 3, MAL_LIST.length - 8));
    MAL_LIST.slice(start, start + 8).forEach((entryName, offset) => {
      const index = start + offset, y = 40 + offset * 20;
      const seen = !!S.seen[entryName], owned = !!S.caught[entryName] || !!S.evolved[entryName];
      menuPanel(g, 12, y, 129, 18, index === menuState.selection);
      menuLabel(g, `${String(index + 1).padStart(2, '0')} ${owned ? '●' : seen ? '○' : '·'} ${seen ? entryName : '???'}`, 17, y + 13, '#e2eff6', 7);
    });
    menuPanel(g, 148, 40, 158, 158);
    if (S.seen[name]) {
      g.fillStyle = TYPE_COLORS[species.type];
      g.beginPath();
      g.arc(227, 82, 28, 0, Math.PI * 2);
      g.fill();
      g.drawImage(malSprite(name, Math.floor(frame / 6) % 8, 'front', !!S.shinyCaught?.[name]), 205, 60, 44, 44);
      menuLabel(g, name.toUpperCase(), 160, 123, '#fff1b7', 8);
      menuLabel(g, `${species.types.map((type) => type.toUpperCase()).join('/')} / ${S.caught[name] ? 'CAUGHT' : S.evolved[name] ? 'EVOLVED' : 'SEEN'}`, 160, 138, '#b5d4e4', 7);
      if (S.caught[name] || S.evolved[name]) {
        menuLabel(g, 'FULL ENTRY UNLOCKED', 160, 157, '#87e3bc', 7);
        menuLabel(g, `HP ${species.hp} ATK ${species.atk}`, 160, 171, '#d4e5f0', 7);
        menuLabel(g, `DEF ${species.def} SPD ${species.spd}`, 160, 183, '#d4e5f0', 7);
      } else {
        menuLabel(g, 'catch it to reveal its', 160, 159, '#d4e5f0', 7);
        menuLabel(g, 'complete field notes!', 160, 172, '#d4e5f0', 7);
      }
    } else {
      menuLabel(g, 'UNKNOWN', 190, 89, '#d4e5f0', 9);
      menuLabel(g, 'A mystery to', 184, 111, '#80dce7', 8);
      menuLabel(g, 'discover...', 193, 128, '#d4e5f0', 8);
    }
    menuLabel(g, `SEEN ${Object.keys(S.seen).length}  CAUGHT ${Object.keys(S.caught).length}  A DETAILS  Y CRY`, 16, 220, '#9bbbd1', 7);
    return;
  }
  if (page === 'box') {
    menuPanel(g, 12, 38, 296, 163);
    const first = Math.floor(menuState.selection / 12) * 12;
    menuState.boxScroll = first;
    if (!S.box.length) {
      menuLabel(g, 'YOUR MALBOX IS EMPTY', 80, 95, '#fff1bd', 10);
      menuLabel(g, 'CAUGHT POCKETMALS WILL BE STORED HERE', 32, 116, '#bcd2df', 7);
    } else {
      S.box.slice(first, first + 12).forEach((mal, offset) => {
        const index = first + offset;
        const col = offset % 3, row = Math.floor(offset / 3);
        const x = 16 + col * 98, y = 43 + row * 39;
        const selected = index === menuState.selection;
        menuPanel(g, x, y, 94, 35, selected);
        g.fillStyle = '#0f1e31';
        g.fillRect(x + 3, y + 4, 27, 27);
        g.drawImage(malSprite(mal.name, Math.floor(frame / 6 + index) % 8, 'front', !!mal.shiny), x + 4, y + 4, 25, 25);
        menuLabel(g, malName(mal).slice(0, 9), x + 33, y + 13, mal.shiny ? '#ffe58b' : '#edf6fa', 7);
        menuLabel(g, `Lv${mal.lv}`, x + 33, y + 24, '#a9c4d5', 7);
        g.fillStyle = '#354b5f'; g.fillRect(x + 33, y + 28, 55, 3);
        g.fillStyle = hpRatio(mal) > .5 ? '#73c989' : '#e5b65c';
        g.fillRect(x + 33, y + 28, 55 * hpRatio(mal), 3);
      });
      menuLabel(g, `${first + 1}-${Math.min(first + 12, S.box.length)} / ${S.box.length}`, 240, 218, '#d6e7ef', 7);
    }
    menuPanel(g, 12, 205, 220, 23);
    menuLabel(g, 'A ACTIONS / WITHDRAW', 19, 220, '#fff0bd', 7);
    menuLabel(g, 'B BACK', 246, 220, '#9bbbd1', 8);
    return;
  }
  if (page === 'trainer') {
    menuPanel(g, 14, 43, 292, 147);
    menuLabel(g, S.name.toUpperCase(), 30, 67, '#fff2bc', 15);
    menuLabel(g, `TRAINER  /  ${S.gender.toUpperCase()}`, 30, 88, '#b7d8e8', 9);
    menuLabel(g, `POCKETMALS CAUGHT   ${Object.keys(S.caught).length} / ${MAL_LIST.length}`, 30, 119, '#e4edf5', 8);
    menuLabel(g, `LUNARO BADGES   ${S.badges.length} / 3`, 30, 139, '#f5db88', 8);
    menuLabel(g, `MONEY   $${S.money}`, 30, 159, '#e4edf5', 8);
    menuLabel(g, `${MAPS[S.map].name.toUpperCase()}   /   LUNARO`, 30, 179, '#b7d8e8', 8);
    menuLabel(g, 'A SAVE   B BACK', 17, 220, '#9bbbd1', 8);
    return;
  }
  if (page === 'options') {
    const options = [
      `MUSIC  ${muted ? 'OFF' : 'ON'}`,
      `SOUND EFFECTS  ${gameSettings.soundEffects ? 'ON' : 'OFF'}`,
      `TEXT SPEED  ${['SLOW', 'NORMAL', 'FAST'][gameSettings.textSpeed]}`,
      `FRAME STYLE  ${gameSettings.frameStyle + 1}`,
      `RUNNING SHOES  ${S.flags.running ? 'ON' : 'OFF'}`,
      `SEASON  ${(S.season || 'spring').toUpperCase()}`,
    ];
    options.forEach((label, index) => {
      const y = 38 + index * 27;
      menuPanel(g, 20, y, 280, 23, index === menuState.selection);
      menuLabel(g, label, 30, y + 15, '#eaf5ff', 8);
      menuLabel(g, 'A CHANGE', 247, y + 15, '#80dce7', 7);
    });
    menuLabel(g, 'SUMMER ADDS A STEEL-PAN STYLE MUSIC LAYER', 18, 208, '#9bbbd1', 7);
    menuLabel(g, 'UP/DOWN SELECT   A CHANGE   B BACK', 18, 224, '#9bbbd1', 8);
    return;
  }
  if (page === 'map') {
    const maps = Object.entries(MAPS);
    const positions = [[72, 48], [72, 91], [160, 91], [244, 48], [244, 137], [160, 171]];
    g.strokeStyle = '#5d91a0';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(72, 58); g.lineTo(72, 91); g.lineTo(160, 91); g.lineTo(244, 48); g.lineTo(244, 137);
    g.stroke();
    maps.forEach(([id, map], index) => {
      const [x, y] = positions[index] || [160, 171];
      g.fillStyle = S.map === id ? '#f1d66b' : '#79c7ac';
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      menuLabel(g, map.name.slice(0, 12).toUpperCase(), Math.max(4, Math.min(252, x - 29)), y + 18, '#dcebf0', 6);
    });
    menuLabel(g, `NOW EXPLORING ${MAPS[S.map].name.toUpperCase()}`, 45, 190, '#fff2bc', 9);
    menuLabel(g, `BADGES ${S.badges.length}/3  ELITE ${(S.flags.eliteFourWins || []).length}/4`, 62, 207, '#b7d8e8', 8);
    menuLabel(g, S.flags.leagueChampionDefeated ? 'MELLORA CHAMPION' : 'B BACK', 18, 226, '#9bbbd1', 8);
    return;
  }
  menuLabel(g, 'Your journey has been saved.', 54, 100, '#fff2bc', 11);
  menuLabel(g, 'Your Pocketmal friends will be here', 32, 127, '#d4e5f0', 8);
  menuLabel(g, 'when you are ready to continue.', 43, 144, '#d4e5f0', 8);
  menuPanel(g, 112, 170, 96, 25, true);
  menuLabel(g, 'A CONTINUE', 122, 187, '#eaf5ff', 8);
}
function handleMenuTap(event) {
  if (!menuState || mode !== 'menu') return;
  const bounds = lowerCanvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * W / bounds.width;
  const y = (event.clientY - bounds.top) * H / bounds.height;
  if (menuState.partyAction) {
    if (x >= 70 && x <= 250 && y >= 88 && y < 88 + 5 * 19) {
      menuState.actionSelection = Math.max(0, Math.min(4, Math.floor((y - 88) / 19)));
      activateMenuSelection();
    }
    return;
  }
  if (menuState.boxAction) {
    if (x >= 70 && x <= 250 && y >= 88 && y < 145) {
      menuState.actionSelection = Math.max(0, Math.min(2, Math.floor((y - 88) / 19)));
      activateMenuSelection();
    }
    return;
  }
  if (menuState.page === 'boxSwap' && y >= 58 && y < 58 + S.party.length * 25) {
    menuState.selection = Math.max(0, Math.min(S.party.length - 1, Math.floor((y - 58) / 25)));
    activateMenuSelection();
    return;
  }
  if (menuState.page === 'summary') {
    if (x < 60 && y > 205) changeMenuSelection('left');
    else if (x > 260 && y > 205) changeMenuSelection('right');
    else if (y > 210) handleMenuKey('b');
    return;
  }
  if (menuState.page === 'home') {
    if (y >= 31 && y < 197) {
      const col = Math.floor(x / 160);
      const row = Math.floor((y - 31) / 57);
      const index = row * 2 + col;
      if (col >= 0 && col < 2 && row >= 0 && row < 3 && index < 6) {
        menuState.selection = index;
        sfx.menu();
        activateMenuSelection();
      }
    } else if (y >= 205 && y < 235) {
      let index = -1;
      if (x >= 8 && x < 136) index = 6;
      else if (x >= 145 && x < 273) index = 7;
      else if (x >= 290) return closeMenu();
      if (index >= 0) {
        menuState.selection = index;
        sfx.menu();
        activateMenuSelection();
      }
    }
  } else if (menuState.page === 'bag') {
    if (x >= 12 && x <= 112 && y >= 41 && y < 41 + BAG_CATEGORIES.length * 29) {
      menuState.category = Math.floor((y - 41) / 29);
      menuState.selection = 0;
    } else if (x >= 116 && x <= 306 && y >= 62 && y < 157) {
      const index = Math.floor((y - 62) / 19);
      if (index < menuBagItems().length) {
        menuState.selection = index;
        activateMenuSelection();
      }
    }
  } else if (menuState.page === 'box' && x >= 16 && x < 310 && y >= 43 && y < 199) {
    const first = Math.floor(menuState.selection / 12) * 12;
    const col = Math.min(2, Math.max(0, Math.floor((x - 16) / 98)));
    const row = Math.min(3, Math.max(0, Math.floor((y - 43) / 39)));
    const index = first + row * 3 + col;
    if (index < S.box.length) {
      menuState.selection = index;
      activateMenuSelection();
    }
  } else if (menuState.page === 'party' && y >= 40 && y < 40 + S.party.length * 22) {
    menuState.selection = Math.floor((y - 40) / 22);
    activateMenuSelection();
  } else if (menuState.page === 'dex' && !menuState.dexView && x <= 145 && y >= 40 && y < 200) {
    const start = Math.max(0, Math.min(menuState.selection - 3, MAL_LIST.length - 8));
    menuState.selection = Math.min(MAL_LIST.length - 1, start + Math.floor((y - 40) / 20));
  } else if (menuState.page === 'dex') {
    if (S.flags.maldex) menuState.dexView = !menuState.dexView;
  } else if (menuState.page === 'options') {
    menuState.selection = Math.max(0, Math.min(2, Math.floor((y - 43) / 43)));
    activateMenuSelection();
  } else if (menuState.page === 'saved') {
    closeMenu();
  }
}
lowerCanvas.addEventListener('click', handleMenuTap);
async function regionMap() {
  await sayAll([
    'MELLORA REGION',
    'Covo Town — home, the Lab, and the first Gym.',
    'Route 1 leads north to Solara City, then Ombra Woods.',
    S.badges.includes('Grove Badge')
      ? 'Alto Ridge opens north of Ombra Woods after the Grove Badge.'
      : 'Earn all three Gym badges to open Alto Ridge.',
    'Your lower screen shows a detailed map of this area.',
    `You have earned ${S.badges.length} of 3 Mellora badges.`,
  ]);
}
async function gymLeader() {
  const gymType = S.room?.type || 'gym';
  const gyms = {
    gym: {
      leader: 'Rowan', badge: 'Meadow Badge', money: 700,
      intro: ['Leader Rowan: Welcome to the Covo Town Gym!', 'Here we test the bond between trainer and partner — the same bond Team Meridian would rather exploit.', 'Show me steady teamwork. No forced power. Just trust.'],
      team: [['Bramblet', 9], ['Yapup', 10]],
      win: ['Rowan: Clear heads. Kind hearts. That is how Mellora endures.', 'You earned the MEADOW BADGE!', 'Solara City Gym Leader Marina will accept your challenge now.'],
    },
    gym2: {
      leader: 'Marina', badge: 'Tide Badge', money: 1400,
      intro: ['Leader Marina: Welcome to the Solara City Gym!', 'Currents change. So do battles. Read the flow — do not force it the way Meridian forces the meridian lines.'],
      team: [['Ripfin', 14], ['Foamish', 15], ['Wavepup', 16]],
      win: ['Marina: You moved with the water, not against it.', 'You earned the TIDE BADGE!', 'Clear Ombra Woods of Team Meridian, and Leader Sylvan will open the Grove Gym.'],
    },
    gym3: {
      leader: 'Sylvan', badge: 'Grove Badge', money: 2200,
      intro: ['Leader Sylvan: Welcome to the Ombra Woods Gym.', 'Meridian tried to rewrite this wood into a machine. You helped stop them.', 'Now show me growth that was earned — not extracted.'],
      team: [['Florion', 19], ['Thornko', 20], ['Thornox', 21]],
      win: ['Sylvan: Roots hold when they are allowed to grow.', 'You earned the GROVE BADGE!', 'The three Gyms of Mellora recognise you.', 'North of here, Alto Ridge opens. Meridian still watches those heights — stay wary.'],
    },
  };
  const gym = gyms[gymType] || gyms.gym;
  if (gymType === 'gym' && !S.flags.sunmeadowVisited) {
    return say('Leader Rowan: Explore Route 1 and Solara City first. Then come back for a friendly Gym challenge!');
  }
  if (gymType === 'gym2' && !S.badges.includes('Meadow Badge')) {
    return say('Leader Marina: Earn the Meadow Badge in Covo Town before challenging this Gym.');
  }
  if (gymType === 'gym3' && !S.flags.chapter1) {
    return say('Leader Sylvan: Help Ombra Woods recover from Team Meridian first. Then our Gym doors will open.');
  }
  if (S.badges.includes(gym.badge)) {
    return say(`Leader ${gym.leader}: You already earned the ${gym.badge}. Keep exploring Mellora!`);
  }
  await sayAll(gym.intro);
  const won = await battle(gym.team.map(([name, level]) => makeMal(name, level)), {
    name: `Gym Leader ${gym.leader}`, money: gym.money,
  });
  if (won) {
    S.badges.push(gym.badge);
    if (gym.badge === 'Grove Badge') S.flags.starlitOpen = true;
    save();
    await sayAll(gym.win);
    if (gym.badge === 'Grove Badge' && !S.flags.melloraChampionSeen) {
      S.flags.melloraChampionSeen = true;
      await sayAll([
        'Professor Lotus (via radio): Three badges... outstanding fieldwork!',
        'Professor Lotus: Alto Ridge is now open for research teams.',
        'Professor Lotus: Keep filling the Maldex — Mellora still has secrets.',
      ]);
      save();
    }
  }
}
const malLabel = (m) => `${malName(m)} L${m.lv} ${m.cur}/${m.maxhp}`;
async function partyMenu() {
  const i = await choose(S.party.map(malLabel), 'Party (pick to view / lead)');
  if (i < 0) return;
  const m = S.party[i], sp = MALS[m.name];
  await say(`${malName(m)} (${m.name}) [${sp.types.join('/')}] Ability: ${sp.ability}`);
  await say(`ATK ${m.atk} DEF ${m.def} SPD ${m.spd} XP ${m.xp}/${xpNeed(m.lv)}`);
  await say('Moves: ' + m.moves.join(', '));
  if (i > 0 && (await choose(['Make lead', 'Cancel'])) === 0) S.party.unshift(S.party.splice(i, 1)[0]);
}
async function dexMenu() {
  let idx = 0;
  while (true) {
    const items = MAL_LIST.map((n, k) => `${String(k + 1).padStart(3, '0')} ${S.shinyCaught?.[n] ? '★ ' + n : S.caught[n] ? '● ' + n : S.seen[n] ? '○ ' + n : '???'}`);
    idx = await choose(items, `Maldex  caught ${Object.keys(S.caught).length}`, idx);
    if (idx < 0) return;
    const n = MAL_LIST[idx];
    if (S.seen[n]) await say(`${n} (${MALS[n].types.join('/')}): ${MALS[n].dex}`);
  }
}
async function boxMenu() {
  if (!S.box.length) return say('The Malbox is empty.');
  const i = await choose(S.box.map(malLabel), 'Malbox: pick to swap into party');
  if (i < 0) return;
  if (S.party.length < 6) S.party.push(S.box.splice(i, 1)[0]);
  else {
    const j = await choose(S.party.map(malLabel), 'Swap with...');
    if (j >= 0) [S.party[j], S.box[i]] = [S.box[i], S.party[j]];
  }
}
async function bagMenu(inBattle) {
  const names = Object.keys(S.bag).filter((n) => S.bag[n] > 0);
  const i = await choose(names.map((n) => `${n} x${S.bag[n]}`), 'Bag');
  if (i < 0) return null;
  const n = names[i];
  if (n.includes('Potion') || n === 'Berry') {
    const j = await choose(S.party.map(malLabel), 'Use on...');
    if (j < 0) return null;
    const m = S.party[j];
    if (m.cur <= 0 || m.cur === m.maxhp) {
      await say('It won\'t have any effect.');
      return null;
    }
    const healing = n === 'Potion' ? 25 : n === 'Super Potion' ? 60 : n === 'Hyper Potion' ? 120 : 15;
    m.cur = Math.min(m.maxhp, m.cur + healing);
    S.bag[n]--;
    sfx.heal();
    await say(`${malName(m)} recovered HP!`);
    return 'used';
  }
  if (n === 'Revive') {
    const fainted = S.party.filter((member) => member.cur <= 0);
    if (!fainted.length) {
      await say('It would have no effect.');
      return null;
    }
    const j = await choose(fainted.map(malLabel), 'Revive which partner?');
    if (j < 0) return null;
    const target = fainted[j];
    target.cur = Math.max(1, Math.floor(target.maxhp / 2));
    S.bag.Revive--;
    sfx.heal();
    await say(`${malName(target)} returned to the battle!`);
    return 'used';
  }
  if (TMS[n]) {
    if (inBattle) {
      await say('TMs can only be used outside of battle.');
      return null;
    }
    const move = TMS[n].move;
    const j = await choose(S.party.map(malLabel), `Teach ${move} to...`);
    if (j < 0) return null;
    const mal = S.party[j];
    if ((mal.moves || []).includes(move)) {
      await say(`${malName(mal)} already knows ${move}.`);
      return null;
    }
    if ((mal.moves || []).length < 4) {
      mal.moves.push(move);
      ensureMovePP(mal);
      S.bag[n]--;
      sfx.ok();
      await say(`${malName(mal)} learned ${move}!`);
      return 'used';
    }
    const forget = await choose(mal.moves.map((mv) => `Forget ${mv}`).concat(['Cancel']), `Replace which move with ${move}?`);
    if (forget < 0 || forget >= mal.moves.length) return null;
    const lost = mal.moves[forget];
    mal.moves[forget] = move;
    if (mal.pp) { delete mal.pp[lost]; mal.pp[move] = maxMovePP(move); }
    ensureMovePP(mal);
    S.bag[n]--;
    sfx.ok();
    await say(`1... 2... 3... Poof! ${malName(mal)} forgot ${lost} and learned ${move}!`);
    return 'used';
  }
  if (n === 'Repel') {
    if (!inBattle) {
      S.bag.Repel--;
      S.flags.repelSteps = 100;
      await say('A Repel is active. Wild encounters are kept away for 100 steps.');
      return 'used';
    }
    await say('Repel can only be used while exploring.');
    return null;
  }
  if (n === 'Escape Rope') {
    if (inBattle) {
      await say('You cannot use Escape Rope in battle.');
      return null;
    }
    S.bag[n]--;
    if (S.room) leaveRoom();
    S.map = 'pocketown';
    S.x = 4;
    S.y = 9;
    S.dir = 'down';
    moving = null;
    locationCard = { name: MAPS.pocketown.name, start: frame };
    flash = 0.72;
    musicTrack = '';
    sfx.ok();
    await say('You hurried back to Covo Town with the Escape Rope.');
    return 'used';
  }
  if (!inBattle) {
    await say('Use that in battle.');
    return null;
  }
  S.bag[n]--;
  return n;
}

// ---------- Battle ----------
function maxMovePP(move) {
  const power = MOVES[move]?.[1] || 40;
  return power >= 70 ? 10 : power >= 60 ? 15 : power >= 50 ? 20 : 25;
}
function ensureMovePP(mal) {
  if (!mal || !Array.isArray(mal.moves)) return;
  if (!mal.pp || typeof mal.pp !== 'object') mal.pp = {};
  for (const move of mal.moves) {
    if (!Number.isFinite(mal.pp[move])) mal.pp[move] = maxMovePP(move);
  }
}
function currentMovePP(mal, move) {
  ensureMovePP(mal);
  return Math.max(0, mal?.pp?.[move] ?? maxMovePP(move));
}

let B = null;
async function battle(foes, trainer) {
  const openingMal = S?.party?.find((m) => m && m.cur > 0);
  if (!openingMal) {
    await say('Your party has no healthy Pocketmals!');
    return false;
  }
  if (!Array.isArray(foes) || !foes.length || foes.some((mal) => !mal || !MALS[mal.name])) return false;
  mode = 'battle';
  B = { foes, foe: foes[0], me: openingMal, trainer, shake: 0, intro: { start: frame, kind: trainer ? 'trainer' : 'wild', name: trainer?.name || malName(foes[0]) } };
  foes.forEach((f) => { S.seen[f.name] = true; ensureMovePP(f); });
  S.party.forEach(ensureMovePP);
  await say(trainer
    ? (String(trainer.name).includes('Meridian')
      ? `${trainer.name} steps forward!`
      : `${trainer.name} would like to battle!`)
    : `A wild ${malName(B.foe)} appeared!`);
  playMalCry(B.foe.name, 'wild');
  if (trainer) {
    await say(`${trainer.name} sent out ${malName(B.foe)}!`);
    playMalCry(B.foe.name, 'sendout');
  }
  await say(`Go, ${malName(B.me)}!`);
  playMalCry(B.me.name, 'sendout');
  let result = null;
  while (result === null) {
    const act = await choose(['Fight', 'Bag', 'Mals', 'Run'], `What will ${malName(B.me)} do?`);
    let playerMove = null;
    if (act === 0) {
      const usableMoves = B.me.moves.filter((move) => currentMovePP(B.me, move) > 0);
      const moveOptions = usableMoves.length ? usableMoves : ['Struggle'];
      const mi = await choose(moveOptions.map((n) => {
        if (n === 'Struggle') return 'Struggle (normal 50)  PP --';
        const [t, p] = MOVES[n] || ['normal', 40];
        const eff = B.foe ? effectiveness(t, MALS[B.foe.name].types) : 1;
        const mark = eff > 1 ? ' ★' : eff < 1 ? ' ·' : '';
        return `${n} (${t} ${p})${mark}  PP ${currentMovePP(B.me, n)}/${maxMovePP(n)}`;
      }), 'Moves');
      if (mi < 0) continue;
      playerMove = moveOptions[mi];
    } else if (act === 1) {
      const used = await bagMenu(true);
      if (!used) continue;
      if (used.includes('Malball')) {
        if (trainer) {
          S.bag[used]++;
          await say('You can\'t catch a trainer\'s mal!');
          continue;
        } else if (await throwBall(used)) {
          result = true;
          break;
        }
      }
    } else if (act === 2) {
      if (!(await switchMal(false))) continue;
    } else if (act === 3 || act < 0) {
      if (trainer) {
        await say('No running from a trainer battle!');
        continue;
      }
      if (Math.random() < 0.8) {
        await say('Got away safely!');
        result = 'ran';
        break;
      }
      await say('Couldn\'t escape!');
    }
    const playerActor = B.me;
    const foeActor = B.foe;
    const availableFoeMoves = foeActor.moves.filter((move) => currentMovePP(foeActor, move) > 0);
    const foeMove = availableFoeMoves.length
      ? availableFoeMoves[Math.floor(Math.random() * availableFoeMoves.length)]
      : 'Struggle';
    const order = playerMove && playerActor.spd >= foeActor.spd ? ['me', 'foe'] : ['foe', 'me'];
    for (const who of order) {
      if (who === 'me' && playerMove) {
        await attack(playerActor, foeActor, playerMove, true);
      } else if (who === 'foe') {
        await attack(foeActor, playerActor, foeMove, false);
      } else {
        continue;
      }
      result = await checkFaint();
      if (result !== null) break;
      // A replacement enters next round and cannot inherit the previous creature's queued action.
      if (B.me !== playerActor || B.foe !== foeActor) break;
    }
  }
  if (result === false) {
    await say('You have no mals left! You blacked out...');
    S.money = Math.floor(S.money / 2);
    healAll();
    changeMap('pocketown', 4, 9);
  } else if (result === true && trainer) {
    S.money += trainer.money;
    await say(`You defeated ${trainer.name}! Got $${trainer.money}.`);
  }
  mode = 'world';
  B = null;
  return result === true;
}
async function attack(a, d, move, mine) {
  if (a.cur <= 0 || d.cur <= 0) return;
  const [type, pow, acc] = MOVES[move] || ['normal', 50, 100];
  if (move !== 'Struggle') {
    ensureMovePP(a);
    if (a.pp[move] <= 0) return say(`${malName(a)} has no PP left for ${move}!`);
    a.pp[move]--;
  }
  await say(`${mine ? '' : 'Foe '}${malName(a)} used ${move}!`);
  if (Math.random() * 100 > acc) return say('It missed!');
  B.action = { side: mine ? 'me' : 'foe', type, started: frame };
  await new Promise((resolve) => setTimeout(resolve, 300));
  B.action = null;
  const sp = MALS[a.name];
  let stab = sp.types.includes(type) ? 1.5 : 1;
  if (stab > 1 && a.cur < a.maxhp / 3) stab *= 1.3; // abilities boost own type at low HP
  const eff = effectiveness(type, MALS[d.name].types);
  const critical = Math.random() < 0.0625;
  const dmg = Math.max(1, Math.floor(((2 * a.lv / 5 + 2) * pow * a.atk / d.def / 40 + 2) * stab * eff * (critical ? 1.5 : 1) * (0.85 + Math.random() * 0.15)));
  d.cur = Math.max(0, d.cur - dmg);
  B.shake = mine ? -8 : 8;
  sfx.hit();
  if (critical) await say('A critical hit!');
  if (eff > 1) await say('It\'s super effective!');
  if (eff < 1) await say('It\'s not very effective...');
}
async function checkFaint() {
  if (B.foe.cur <= 0) {
    await say(`${B.trainer ? 'Foe ' : 'Wild '}${malName(B.foe)} fainted!`);
    await gainXp(B.me, Math.floor(B.foe.lv * 14 * (B.trainer ? 1.5 : 1)));
    const next = B.foes.find((f) => f.cur > 0);
    if (!next) return true;
    B.foe = next;
    await say(`${B.trainer?.name || 'The opponent'} sent out ${malName(next)}!`);
    playMalCry(next.name, 'sendout');
  }
  if (B.me.cur <= 0) {
    await say(`${malName(B.me)} fainted!`);
    if (!S.party.some((m) => m.cur > 0)) return false;
    await switchMal(true);
  }
  return null;
}
async function switchMal(forced) {
  while (true) {
    const i = await choose(S.party.map(malLabel), 'Choose a mal');
    if (i < 0 && !forced) return false;
    const m = S.party[i];
    if (m && m.cur > 0 && m !== B.me) {
      B.me = m;
      await say(`Go, ${malName(m)}!`);
      playMalCry(m.name, 'sendout');
      return true;
    }
  }
}
async function gainXp(m, xp) {
  m.xp += xp;
  await say(`${malName(m)} gained ${xp} XP!`);
  while (m.xp >= xpNeed(m.lv)) {
    m.xp -= xpNeed(m.lv);
    m.lv++;
    const old = m.maxhp;
    calc(m);
    m.cur += m.maxhp - old;
    sfx.heal();
    await say(`${malName(m)} grew to level ${m.lv}!`);
    const learn = MALS[m.name].moves[Math.floor(m.lv / 4)];
    if (learn && !m.moves.includes(learn)) {
      m.moves.push(learn);
      await say(`${malName(m)} learned ${learn}!`);
    }
    const evolution = EVOLUTIONS[m.name];
    if (evolution?.to && m.lv >= evolution.level) {
      await evolveMal(m, evolution.to);
    }
  }
}
async function evolveMal(m, nextName) {
  const oldName = m.name;
  await say(`Huh? ${malName(m)} is changing!`);
  const oldMax = m.maxhp;
  m.name = nextName;
  calc(m);
  m.cur = Math.min(m.maxhp, m.cur + (m.maxhp - oldMax));
  // Keep the nickname if there is one; the species beneath it has changed.
  const evolvedMove = MALS[nextName].moves[1] || MALS[nextName].moves[0];
  if (m.moves.length < 4 && !m.moves.includes(evolvedMove)) m.moves.push(evolvedMove);
  S.seen[nextName] = true;
  S.evolved = S.evolved || {};
  S.evolved[nextName] = true;
  sfx.catch();
  playMalCry(nextName, 'evolve');
  await sayAll([`Congratulations! ${oldName} evolved into ${nextName}!`, `${nextName}'s new form and full research notes are now recorded in your Maldex.`]);
  save();
}
const evolveMalOriginal = evolveMal;
evolveMal = async function(mal, nextName) {
  const result = await evolveMalOriginal(mal, nextName);
  if (mal.shiny) {
    S.shinyCaught = S.shinyCaught || {};
    S.shinyCaught[nextName] = true;
    save();
  }
  return result;
};

async function throwBall(ball) {
  await say(`You threw a ${ball}!`);
  const f = B.foe;
  const healthBonus = 0.28 * (1 - hpRatio(f));
  const levelBonus = Math.max(0, 12 - f.lv) * 0.008;
  const ballBonus = ball === 'Great Malball' ? 0.12 : 0;
  const catchRate = Math.min(0.92, 0.28 + healthBonus * 1.45 + levelBonus + ballBonus);
  const shakeRate = Math.cbrt(catchRate);
  B.ball = { shake: 0 };
  for (let i = 0; i < 3; i++) {
    B.ball.shake = i;
    beep(440 - i * 45, 0.08, 'triangle', 0.04);
    await say('...wobble...');
    if (Math.random() > shakeRate) {
      B.ball = 0;
      sfx.catchFail();
      await say(`Oh no! ${malName(f)} broke free!`);
      return false;
    }
  }
  B.ball = 0;
  sfx.catch();
  await say(`Gotcha! ${malName(f)} was caught!`);
  await addMal(f);
  save();
  await say(`${f.name}'s complete entry is now recorded in your paper Maldex. Open BAG > KEY ITEMS to read it.`);
  return true;
}

// ---------- Rendering ----------
let flash = 0, frame = 0;
let locationCard = null;
let teamArrival = null;
const TILE_COL = { T: '#285a38', '.': '#8fce6a', G: '#4ea53e', W: '#3b7fd8', '#': '#d8c08a', F: '#8fce6a', K: '#847d70', R: '#8fce6a', B: '#8fce6a' };
function drawTile(t, px, py, x, y) {
  const seed = (x * 17 + y * 31) >>> 0;
  ctx.fillStyle = TILE_COL[t] || '#8fce6a';
  ctx.fillRect(px, py, TS, TS);
  if (t === '.' || t === '#') {
    if (t === '.') {
      // Subtle checker-shading and varied grass flecks make ground tiles less flat.
      ctx.fillStyle = '#9bd978'; ctx.fillRect(px + (seed % 8), py + 1, 4, 1);
      ctx.fillStyle = '#78b85c'; ctx.fillRect(px + ((seed >>> 4) % 10), py + 14, 3, 1);
      ctx.fillStyle = '#b7e681';
      ctx.fillRect(px + 2 + seed % 11, py + 3 + seed % 9, 1, 1);
      ctx.fillStyle = '#6eaf59';
      ctx.fillRect(px + 4 + (seed >>> 3) % 9, py + 5 + (seed >>> 5) % 8, 1, 1);
      if (seed % 5 === 0) {
        ctx.fillStyle = '#79b95c';
        ctx.fillRect(px + 4 + seed % 7, py + 10, 1, 3);
        ctx.fillRect(px + 3 + seed % 7, py + 10, 2, 1);
      }
      if (seed % 13 === 0) {
        ctx.fillStyle = '#477d45';
        ctx.fillRect(px + 6, py + 11, 1, 3);
        ctx.fillRect(px + 4, py + 10, 2, 1);
        ctx.fillRect(px + 7, py + 9, 2, 1);
        ctx.fillStyle = '#f0d47a';
        ctx.fillRect(px + 5, py + 9, 1, 1);
      } else if (seed % 17 === 0) {
        ctx.fillStyle = '#887f68';
        ctx.fillRect(px + 9, py + 11, 3, 2);
        ctx.fillStyle = '#b2a88c';
        ctx.fillRect(px + 10, py + 11, 1, 1);
      }
    } else {
      ctx.fillStyle = '#ead6a6';
      ctx.fillRect(px + 2 + seed % 10, py + 3 + (seed >>> 2) % 8, 3, 1);
      ctx.fillStyle = '#b89d6e';
      ctx.fillRect(px + 7 + (seed >>> 4) % 6, py + 11 + (seed >>> 6) % 3, 2, 1);
      ctx.fillStyle = '#f3e2bd';
      ctx.fillRect(px, py, TS, 2);
      ctx.fillStyle = '#f2dcae';
      ctx.fillRect(px, py + 15, TS, 1);
      // Small worn stepping-stones and warm sand flecks.
      if (seed % 3 === 0) { ctx.fillStyle = '#b49b70'; ctx.fillRect(px + 2, py + 7, 3, 2); }
      if (seed % 4 === 1) { ctx.fillStyle = '#f6e6c4'; ctx.fillRect(px + 10, py + 4, 2, 1); }
      if (tileAt(x, y - 1) !== '#') {
        ctx.fillStyle = '#a98e65';
        ctx.fillRect(px, py, TS, 1);
      }
      if (tileAt(x - 1, y) !== '#') {
        ctx.fillStyle = '#bca074';
        ctx.fillRect(px, py, 1, TS);
      }
    }
  } else if (t === 'T') {
    ctx.fillStyle = '#71845a';
    ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = '#859268';
    ctx.fillRect(px + 2 + (seed % 9), py + 4 + (seed % 7), 2, 1);
    ctx.fillStyle = '#596f4d';
    ctx.fillRect(px + 4 + (seed % 5), py + 12, 3, 1);
    if (seed % 4 === 0) {
      ctx.fillStyle = '#8f8061';
      ctx.fillRect(px + 10, py + 8, 2, 1);
    }
  } else if (t === 'G') {
    ctx.fillStyle = '#286a34';
    for (let i = 0; i < 5; i++) {
      const sway = Math.round(Math.sin(frame / 12 + x * 2 + i) * 1.2);
      ctx.beginPath();
      ctx.moveTo(px + 1 + i * 3, py + 16);
      ctx.lineTo(px + 2 + i * 3 + sway, py + 3 + (i % 3) * 3);
      ctx.lineTo(px + 5 + i * 3, py + 16);
      ctx.fill();
    }
    ctx.fillStyle = '#76c95e';
    ctx.fillRect(px + 3, py + 11, 1, 3);
    ctx.fillRect(px + 10, py + 8, 1, 3);
    ctx.fillStyle = '#b1df76';
    ctx.fillRect(px + 6, py + 6, 1, 2);
    ctx.fillRect(px + 13, py + 11, 1, 2);
  } else if (t === 'W') {
    ctx.fillStyle = '#478bd0';
    ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = '#9cd0ff';
    ctx.fillRect(px + ((frame / 10 + x * 3) % 12), py + 5, 4, 1);
    ctx.fillStyle = '#c1e6ff';
    ctx.fillRect(px + ((frame / 13 + y * 2 + 6) % 13), py + 11, 3, 1);
    ctx.fillStyle = '#3977b7';
    ctx.fillRect(px, py + 15, TS, 1);
    ctx.fillStyle = '#b8e7f4';
    ctx.fillRect(px + ((frame / 17 + x * 5) % 10), py + 2, 3, 1);
  } else if (t === 'F') {
    const petal = (cx, cy, color) => {
      ctx.fillStyle = '#49884a';
      ctx.fillRect(px + cx, py + cy + 2, 1, 4);
      ctx.fillStyle = color;
      ctx.fillRect(px + cx - 1, py + cy, 3, 2);
      ctx.fillStyle = '#ffe986';
      ctx.fillRect(px + cx, py + cy, 1, 1);
    };
    petal(5, 5, (x + y) % 2 ? '#ff91a9' : '#fff0a0');
    petal(11, 9, (x + y) % 2 ? '#fff0a0' : '#ff91a9');
    ctx.fillStyle = '#477d45'; ctx.fillRect(px + 3, py + 12, 4, 2); ctx.fillRect(px + 10, py + 14, 3, 1);
    ctx.fillStyle = '#fff6d1'; ctx.fillRect(px + 4, py + 4, 1, 1); ctx.fillRect(px + 10, py + 8, 1, 1);
  } else if (t === 'K') {
    // Cliff face with a bright ledge, layered stone strata and grass at the lip.
    ctx.fillStyle = '#6f6d68'; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = '#aaa18d'; ctx.fillRect(px, py, TS, 4);
    ctx.fillStyle = '#c8bea7'; ctx.fillRect(px + 1, py + 1, 8, 2);
    ctx.fillStyle = '#8b8578'; ctx.fillRect(px + 1, py + 5, 13, 3);
    ctx.fillStyle = '#77766e'; ctx.fillRect(px + 3, py + 9, 12, 3);
    ctx.fillStyle = '#535c53'; ctx.fillRect(px, py + 14, TS, 2);
    ctx.fillStyle = '#d8c9a7'; ctx.fillRect(px + 5, py + 5, 3, 1);
    ctx.fillStyle = '#6da65a'; ctx.fillRect(px + 1, py + 3, 4, 1);
  } else if (t === 'B') {
    ctx.fillStyle = '#746d65';
    ctx.fillRect(px + 3, py + 7, 11, 8);
    ctx.fillStyle = '#9b9181';
    ctx.fillRect(px + 5, py + 4, 7, 6);
    ctx.fillStyle = '#c0b39d';
    ctx.fillRect(px + 7, py + 4, 3, 2);
    ctx.fillStyle = frame % 60 < 30 ? '#fff6a0' : '#b0a890';
    ctx.fillRect(px + 8, py + 8, 2, 2);
  } else if (t === 'R') {
    ctx.fillStyle = '#755039';
    ctx.fillRect(px + 3, py + 4, 10, 8);
    ctx.fillStyle = '#d7ad63';
    ctx.fillRect(px + 4, py + 4, 8, 2);
    ctx.fillStyle = '#73503a';
    ctx.fillRect(px + 7, py + 12, 2, 4);
  } else if ('HLCSDYE'.includes(t)) {
    const building = 'HLCSDYE';
    const roof = { H: '#bd6255', L: '#657bb0', C: '#459887', S: '#538bb1', Y: '#7568aa' };
    const walls = { H: '#f1dbb5', L: '#dce6e0', C: '#e9f0d7', S: '#e3e9dc', Y: '#ead8b3' };
    const above = tileAt(x, y - 1);
    const isRoof = !building.includes(above);
    ctx.fillStyle = isRoof ? roof[t] || '#bd6255' : walls[t] || '#ead8b3';
    ctx.fillRect(px, py, TS, TS);
    if (isRoof) {
      ctx.fillStyle = '#ffffff30';
      ctx.fillRect(px + 1, py + 1, TS - 2, 2);
      ctx.fillStyle = '#0002';
      ctx.fillRect(px, py + 12, TS, 4);
      ctx.fillStyle = '#ffffff24';
      ctx.fillRect(px + ((x + y) % 2 ? 2 : 8), py + 5, 3, 2);
      ctx.fillStyle = '#0002';
      ctx.fillRect(px + ((x + y) % 2 ? 9 : 3), py + 9, 4, 1);
      if (t === 'Y' && x === 15) {
        ctx.fillStyle = '#fff1bd';
        ctx.fillRect(px + 5, py + 5, 6, 6);
        ctx.fillStyle = '#7568aa';
        ctx.fillRect(px + 7, py + 6, 2, 4);
        ctx.fillRect(px + 6, py + 7, 4, 2);
      }
    } else if (t === 'D' || t === 'E') {
      ctx.fillStyle = '#624a3c';
      ctx.fillRect(px + 3, py + 3, 10, 13);
      ctx.fillStyle = '#d9b370';
      ctx.fillRect(px + 4, py + 4, 8, 2);
      ctx.fillStyle = '#f4d887';
      ctx.fillRect(px + 10, py + 9, 1, 1);
      ctx.fillStyle = '#0002';
      ctx.fillRect(px, py + 15, TS, 1);
    } else {
      ctx.fillStyle = '#83c1d1';
      ctx.fillRect(px + 3, py + 4, 10, 7);
      ctx.fillStyle = '#e6f5e9';
      ctx.fillRect(px + 4, py + 5, 3, 2);
      ctx.fillRect(px + 8, py + 9, 4, 1);
      ctx.fillStyle = '#8e7455';
      ctx.fillRect(px + 2, py + 11, 12, 2);
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = '#f5d781';
        ctx.fillRect(px + 7, py + 5, 2, 6);
      }
    }
  }
}
function drawForestCanopies(firstRow, lastRow) {
  for (let y = Math.max(0, firstRow); y <= Math.min(14, lastRow); y++) {
    if (y === 0 || y === 14) continue;
    for (let x = 1; x < 19; x++) {
      if (tileAt(x, y) !== 'T'
        || (x > 0 && tileAt(x - 1, y) === 'T')) continue;
      let end = x;
      while (end < 19 && tileAt(end + 1, y) === 'T') end++;
      const length = end - x + 1;
      let root = x + (length > 4 ? 1 + ((x + y) % 2) : 0);
      while (root <= end) {
        const variant = (root * 7 + y * 11) % 3;
        const width = variant === 1 ? 20 : variant === 2 ? 26 : 23;
        const height = variant === 1 ? 29 : variant === 2 ? 25 : 27;
        const centerX = root * TS + TS / 2;
        const bottomY = (y + 1) * TS;
        const left = Math.round(centerX - width / 2);
        const top = bottomY - height;

        ctx.fillStyle = '#354a35';
        ctx.fillRect(Math.round(centerX - 3), bottomY - 12, 6, 12);
        ctx.fillStyle = '#76543a';
        ctx.fillRect(Math.round(centerX - 2), bottomY - 12, 4, 11);
        ctx.fillStyle = '#a27a4d';
        ctx.fillRect(Math.round(centerX - 2), bottomY - 10, 1, 7);
        ctx.fillStyle = '#604831';
        ctx.fillRect(Math.round(centerX - 6), bottomY - 3, 5, 2);
        ctx.fillRect(Math.round(centerX + 1), bottomY - 2, 5, 1);

        ctx.fillStyle = '#1e4933';
        ctx.fillRect(left + 3, top + 11, width - 6, height - 13);
        ctx.fillRect(left + 1, top + 15, width - 2, 8);
        ctx.fillStyle = '#2c6841';
        if (variant === 1) {
          ctx.fillRect(left + 8, top + 3, width - 16, 8);
          ctx.fillRect(left + 5, top + 8, width - 10, 8);
          ctx.fillRect(left + 2, top + 14, width - 4, 8);
        } else if (variant === 2) {
          ctx.fillRect(left + 2, top + 10, 10, 11);
          ctx.fillRect(left + width - 12, top + 7, 10, 13);
          ctx.fillRect(left + 7, top + 4, width - 14, 11);
        } else {
          ctx.fillRect(left + 5, top + 6, width - 10, 15);
          ctx.fillRect(left + 8, top + 2, width - 16, 9);
          ctx.fillRect(left + 1, top + 12, 8, 8);
          ctx.fillRect(left + width - 9, top + 11, 8, 8);
        }
        ctx.fillStyle = '#43834e';
        ctx.fillRect(left + 5, top + 9, Math.max(4, width - 10), 5);
        ctx.fillRect(left + 7, top + 4, Math.max(3, width - 14), 4);
        ctx.fillStyle = '#70a95b';
        ctx.fillRect(left + 5 + ((root + y) % 5), top + 8, 3, 3);
        ctx.fillRect(left + width - 10, top + 13, 3, 2);
        ctx.fillStyle = '#a8cf72';
        ctx.fillRect(left + 8 + ((root * 3 + y) % 7), top + 6, 2, 1);
        ctx.fillRect(left + width - 7, top + 10, 1, 1);
        ctx.fillStyle = '#d3df8a';
        ctx.fillRect(Math.round(left + width / 2), top + 5 + (variant === 1 ? 0 : 4), 1, 1);
        ctx.fillStyle = '#493f32';
        ctx.fillRect(Math.round(centerX - 2), bottomY - 7, 4, 7);
        ctx.fillStyle = '#a27a4d';
        ctx.fillRect(Math.round(centerX - 1), bottomY - 6, 1, 4);
        ctx.fillStyle = '#604831';
        ctx.fillRect(Math.round(centerX - 4), bottomY - 2, 3, 2);
        ctx.fillRect(Math.round(centerX + 1), bottomY - 1, 4, 1);

        root += 3 + ((root + y) % 2);
      }
    }
  }
}

const HUMAN_SPRITE_ASSETS = Object.create(null);
const HUMAN_SPRITE_ROLES = ['player', 'player-boy', 'player-girl', 'professor', 'mom', 'tessa', 'shy', 'mimi', 'nurse', 'gymLeader', 'trainer', 'meridian', 'villager', 'robot'];
const HUMAN_SPRITE_DIRECTIONS = ['down', 'up', 'left', 'right'];
const HUMAN_SPRITE_DESIGN = {
  'player-boy': 0,
  'player-girl': 1,
  professor: 2,
  mimi: 3,
  tessa: 3
};
function loadHumanSpriteAssets() {
  if (typeof Image === 'undefined') return;
  const atlas = new Image();
  atlas.onload = () => { HUMAN_SPRITE_ASSETS.atlas = atlas; };
  atlas.onerror = () => { HUMAN_SPRITE_ASSETS.atlas = null; };
  atlas.src = './assets/sprites/humans/sprite-atlas.svg';
}
loadHumanSpriteAssets();

function drawPerson(px, py, color, dir, role = 'villager', motion = 'idle') {
  const isMeridian = role === 'meridian';
  const spriteRole = isMeridian ? 'meridian'
    : role === 'player' ? (S?.gender === 'girl' ? 'player-girl' : 'player-boy')
      : role === 'mimi' ? 'mimi'
        : (HUMAN_SPRITE_ROLES.includes(role) ? role : 'villager');
  const spriteDirection = ['down', 'up', 'left', 'right'].includes(dir) ? dir : 'down';
  const atlas = HUMAN_SPRITE_ASSETS.atlas;
  // The atlas currently contains only four approved character designs:
  // boy, girl, Professor Lotus, and Mira. Other named NPCs have their own
  // procedural chibi designs below; do not silently reuse someone else's art.
  const hasDedicatedAtlasSprite = ['player-boy', 'player-girl', 'professor', 'shy'].includes(spriteRole);
  if (hasDedicatedAtlasSprite && atlas?.complete && atlas.naturalWidth >= 768 && atlas.naturalHeight >= 288) {
    const isPlayerSprite = ['player', 'player-boy', 'player-girl'].includes(spriteRole);
    const walkingSprite = (isPlayerSprite && moving) || motion === 'walk';
    const design = ({ 'player-boy': 0, 'player-girl': 1, professor: 2, shy: 3 })[spriteRole];
    const directionIndex = HUMAN_SPRITE_DIRECTIONS.indexOf(spriteDirection);
    const frameIndex = walkingSprite ? Math.floor(frame / 5) % 4 : 0;
    const sourceX = design * 192 + frameIndex * 48;
    const sourceY = directionIndex * 72;
    const bob = walkingSprite ? (frameIndex % 2 ? -1 : 0)
      : motion === 'wave' ? Math.sin(frame / 9) * 1.3
        : motion === 'gesture' ? Math.sin(frame / 18) * 0.5
        : motion === 'research' ? Math.sin(frame / 22) * 0.35
          : Math.sin(frame / 28 + px * 0.11 + py * 0.07) * 0.35;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, sourceX, sourceY, 48, 72, Math.round(px - 4), Math.round(py - 9 + bob), 18, 27);
    ctx.restore();
    return;
  }
  const isPlayer = role === 'player';
  const walking = (isPlayer && moving) || motion === 'walk';
  const step = walking ? (motion === 'walk' ? (Math.floor(frame / 6) % 2 ? 1 : -1) : (moving.t < 0.5 ? 1 : -1)) : 0;
  const palette = {
    professor: { hair: '#484657', hairLight: '#d8cbbd', coat: '#f4f0df', shade: '#b7d0ca', shirt: '#2f7780', accent: '#d98668', pants: '#425b70' },
    mom: { hair: '#704b48', hairLight: '#c48b78', coat: '#b96b79', shade: '#854e5b', shirt: '#f6e4d2', accent: '#e6c17d', pants: '#59657a' },
    shy: { hair: '#4a3d59', hairLight: '#a58bb0', coat: '#6689b5', shade: '#405d8a', shirt: '#dff2ed', accent: '#67c5be', pants: '#354b68' },
    mimi: { hair: '#493b4e', hairLight: '#a8757b', coat: '#c85d70', shade: '#803f57', shirt: '#fff0d8', accent: '#efc66e', pants: '#344b65' },
    nurse: { hair: '#bd806f', hairLight: '#e5b59a', coat: '#fff0e8', shade: '#d4dfe0', shirt: '#df7181', accent: '#df7181', pants: '#6a8291' },
    gymLeader: { hair: '#57434a', hairLight: '#9a7061', coat: '#d6a64c', shade: '#9b713e', shirt: '#f4e4b9', accent: '#8e6fa6', pants: '#46516a' },
    trainer: { hair: '#493d47', hairLight: '#8d6c60', coat: color, shade: '#354c60', shirt: '#f4e5c5', accent: '#e5bd70', pants: '#3a4a5e' },
    villager: { hair: '#493d47', hairLight: '#907366', coat: color, shade: '#39566a', shirt: '#f1e5c9', accent: '#e7bf72', pants: '#435268' },
    robot: { hair: '#657d82', hairLight: '#bdd1ce', coat: '#758c9a', shade: '#41596a', shirt: '#b9d9d2', accent: '#f1cc66', pants: '#344658' },
    // Team Meridian: indigo field coats, amber meridian stripe, dark boots.
    meridian: { hair: '#1c1a24', hairLight: '#4a4658', coat: '#2a3550', shade: '#1a2035', shirt: '#c9a227', accent: '#f0d56a', pants: '#151822' },
  }[role] || { hair: '#493d47', hairLight: '#907366', coat: color, shade: '#39566a', shirt: '#f1e5c9', accent: '#e7bf72', pants: '#435268' };
  const skin = role === 'robot' ? '#b7c9c8' : '#f1c4a0';

  ctx.save();
  // A 16x24 character sprite is drawn with a 1px pixel grid and a little extra height.
  const bob = walking ? (Math.floor(frame / 6) % 2 ? -1 : 0)
    : motion === 'wave' ? Math.sin(frame / 9) * 1.5
      : motion === 'gesture' ? Math.sin(frame / 18) * 0.6
        : motion === 'research' ? Math.sin(frame / 22) * 0.45
        : Math.sin(frame / 28 + px * 0.11 + py * 0.07) * 0.4;
  ctx.translate(px - 4, py - 11 + bob);
  ctx.scale(isPlayer ? 1.12 : 1, isPlayer ? 1.12 : 1);
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const p = (points, fill, stroke = '#2f3946') => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  // ground shadow and shoes
  r(4, 25, 10, 2, '#23384a');
  r(4 + step, 23, 4, 3, '#293c50');
  r(9 - step, 23, 4, 3, '#293c50');
  r(3 + step, 25, 5, 1, '#e6d2ad');
  r(9 - step, 25, 5, 1, '#e6d2ad');

  ctx.save();
  ctx.translate(8, 0);
  // Chibi head proportions: make the head clearly dominate the compact body.
  // This is a redraw-scale adjustment to the pixel shapes, not image stretching.
  ctx.scale(1.5, 1.58);
  ctx.translate(-8, 0);

  // hair/back silhouette first, then face
  if (role === 'mom') {
    p([[2,4],[4,1],[8,0],[12,2],[14,5],[13,13],[11,15],[4,14],[2,9]], palette.hair);
    p([[4,3],[7,1],[10,2],[8,4],[5,5]], palette.hairLight, null);
    r(2, 7, 2, 7, palette.hair);
    r(12, 7, 2, 6, palette.hair);
    r(4, 2, 8, 1, '#e8c17a');
  } else if (role === 'professor') {
    p([[1,5],[3,2],[6,0],[11,1],[14,4],[15,9],[14,16],[15,19],[12,17],[11,10],[9,7],[7,7],[5,9],[4,16],[2,19],[1,14]], palette.hair);
    p([[3,3],[6,1],[9,1],[8,3],[5,4]], palette.hairLight, null);
    r(1, 8, 2, 8, palette.hair);
    r(13, 7, 2, 9, palette.hair);
    r(11, 2, 3, 1, '#e6c17d');
    r(3, 13, 1, 2, palette.hairLight);
    r(13, 4, 2, 2, '#4f9da0');
    r(2, 15, 2, 2, '#718d9e');
    r(13, 15, 2, 2, '#718d9e');
  } else if (role === 'shy') {
    p([[2,4],[4,1],[8,0],[12,2],[14,6],[13,13],[11,15],[4,14],[2,10]], palette.hair);
    r(3, 7, 2, 7, palette.hair);
    r(12, 6, 2, 8, palette.hair);
    p([[4,3],[7,1],[10,2],[8,4],[5,5]], palette.hairLight, null);
    // Mira's teal bow and tiny flower clip are her signature silhouette.
    p([[3,2],[0,0],[2,4],[0,6],[4,5]], '#64c7c1', '#315d68');
    r(4, 4, 2, 1, '#f3d78b');
  } else if (role === 'mimi') {
    p([[2,4],[4,1],[8,0],[12,2],[14,5],[13,12],[11,14],[4,13],[2,9]], palette.hair);
    p([[3,3],[6,1],[9,2],[7,4],[4,5]], palette.hairLight, null);
    r(2, 8, 2, 6, palette.hair);
    r(12, 7, 2, 6, palette.hair);
    // short cap, side ponytail and gold pin
    p([[2,3],[4,0],[11,0],[14,3],[12,5],[4,5]], '#e8bd73', '#574451');
    r(10, 1, 3, 1, '#fff0cc');
    r(13, 7, 2, 2, '#c66c79');
    r(4, 5, 8, 1, '#f7e9d1');
  } else if (role === 'robot') {
    // Latticebot's caretaker has a hard-edged metal cowl and lit side modules.
    p([[2,3],[4,0],[12,0],[15,4],[14,13],[11,16],[4,15],[1,11]], '#657d82', '#344958');
    r(2, 6, 2, 5, '#f1cc66');
    r(13, 6, 2, 5, '#f1cc66');
    r(4, 2, 8, 2, '#bdd1ce');
    r(6, 1, 4, 1, '#e7f3ed');
  } else if (isPlayer) {
    p([[2,3],[4,0],[11,0],[14,3],[13,6],[3,6]], '#344b67');
    r(3, 1, 9, 2, color);
    r(4, 0, 7, 2, '#e7f0ed');
    r(1, 4, 3, 2, '#344b67');
    r(12, 4, 3, 2, '#344b67');
    r(5, 5, 6, 2, skin);
    r(6, 6, 1, 1, '#fff');
  } else {
    p([[3,3],[5,0],[11,1],[14,4],[13,8],[3,8]], palette.hair);
    r(3, 5, 2, 5, palette.hair);
    r(12, 5, 2, 5, palette.hair);
    if (role === 'trainer') {
      p([[2,3],[4,0],[12,0],[14,3],[12,4],[4,4]], '#d7c58e', '#574b42');
    }
  }

  // Classic overworld NPC face: fixed eyes only, no mouth or blush.
  r(4, 4, 8, 6, skin);
  r(3, 6, 2, 3, skin);
  r(11, 6, 2, 3, skin);
  if (dir !== 'up') {
    const eyeX = dir === 'left' ? 5 : dir === 'right' ? 10 : 6;
    r(eyeX, 7, 1, 2, '#2b3543');
    r(dir === 'down' ? 9 : eyeX + 3, 7, 1, 2, '#2b3543');
  }
  if (role === 'professor') {
    // Round spectacles, silver-streaked bob, and a gentle, confident expression.
    // Rounded pixel spectacles: stepped corners keep the lenses circular at 1x.
    r(4, 6, 3, 1, '#315d68'); r(3, 7, 1, 2, '#315d68');
    r(4, 9, 3, 1, '#315d68'); r(7, 7, 1, 2, '#315d68');
    r(9, 6, 3, 1, '#315d68'); r(8, 7, 1, 2, '#315d68');
    r(9, 9, 3, 1, '#315d68'); r(12, 7, 1, 2, '#315d68');
    r(7, 7, 2, 1, '#315d68');
    r(5, 7, 1, 1, '#d7f2eb'); r(10, 7, 1, 1, '#d7f2eb');
    r(4, 6, 1, 1, palette.hair);
    r(12, 6, 1, 1, palette.hair);
    r(4, 10, 2, 1, '#e59a9b');
    r(10, 10, 2, 1, '#e59a9b');
    r(10, 2, 3, 1, palette.hairLight);
    r(12, 3, 2, 1, '#eee8d8');
  } else if (role === 'shy') {
    r(5, 10, 2, 1, '#ef9eaa');
    r(9, 10, 2, 1, '#ef9eaa');
  } else if (role === 'mimi') {
    r(5, 10, 2, 1, '#e9949d');
    r(9, 10, 2, 1, '#e9949d');
  } else if (role === 'robot') {
    // Two bright square optics replace the ordinary human eyes.
    r(4, 6, 3, 3, '#263b4b'); r(9, 6, 3, 3, '#263b4b');
    r(5, 7, 1, 1, '#ffe17d'); r(10, 7, 1, 1, '#ffe17d');
  }

  ctx.restore();

  ctx.save();
  // Keep the body short and compact beneath the enlarged head.
  ctx.translate(8, 12);
  ctx.scale(0.92, 0.88);
  ctx.translate(-8, -12);
  ctx.translate(0, 3);

  // clothing: layered jacket, collar, cuffs and accessories
  p([[3,11],[5,10],[11,10],[13,12],[14,19],[2,19]], palette.shade);
  p([[4,11],[6,10],[10,10],[12,12],[12,18],[4,18]], palette.coat, '#344958');
  p([[6,10],[8,12],[10,10],[9,16],[7,16]], palette.shirt, null);
  r(7, 12, 2, 5, palette.accent);
  r(4, 13, 2, 4, '#ffffff');
  r(10, 13, 2, 4, '#ffffff');
  r(5, 18, 6, 2, palette.pants);
  r(4, 17, 2, 2, palette.pants);
  r(10, 17, 2, 2, palette.pants);

  if (role === 'mom') {
    // Mum's warm cardigan, cream blouse, apron pocket and small pendant.
    p([[3,11],[5,10],[11,10],[13,12],[13,19],[3,19]], '#b96b79', '#704653');
    p([[6,10],[8,12],[10,10],[10,15],[6,15]], '#f6e4d2', null);
    r(7, 12, 2, 4, '#e6c17d');
    r(10, 16, 3, 2, '#f1d9bd');
    r(5, 18, 6, 2, '#59657a');
  } else if (role === 'professor') {
    // Long research coat, fitted teal skirt, notebook, and pen.
    p([[3,11],[5,10],[7,12],[8,20],[3,19]], '#f8f5e7', '#607a83');
    p([[13,11],[11,10],[9,12],[9,20],[14,19]], '#e4ece1', '#607a83');
    p([[6,11],[8,13],[7,16],[5,13]], '#4f9da0', null);
    p([[10,11],[8,13],[9,16],[11,13]], '#4f9da0', null);
    r(5, 15, 2, 2, '#d2aa6c');
    r(11, 15, 2, 3, '#557b99');
    r(12, 12, 2, 5, '#df936f');
    r(10, 20, 4, 2, '#52677a');
    r(2, 14, 2, 5, '#f4f0df');
    r(11, 12, 2, 4, '#d98668');
    r(4, 18, 2, 2, '#c9aa73');
    r(5, 18, 6, 2, '#547c7c');
    r(6, 18, 1, 2, '#86aaa0');
    r(9, 18, 1, 2, '#86aaa0');
    r(5, 20, 6, 1, '#3e596c');
  } else if (role === 'shy') {
    // Mira: layered blue jacket, oversized aqua scarf and a small field satchel.
    p([[3,11],[5,10],[11,10],[13,12],[13,19],[3,19]], '#718fb9', '#344958');
    r(5, 12, 7, 5, '#a8c8dc');
    p([[5,10],[8,13],[11,10],[10,14],[7,14]], '#62c4c2', '#356c77');
    r(7, 14, 3, 2, '#edf1e2');
    r(2, 15, 3, 4, '#d3a878');
    r(3, 15, 3, 1, '#f1d48e');
    r(11, 16, 3, 2, '#5b7caa');
    r(5, 20, 3, 2, '#f4e6d4');
    r(9, 20, 3, 2, '#f4e6d4');
  } else if (role === 'mimi') {
    // Tessa's sporty rose-and-cream jacket, gold scarf and field satchel.
    p([[3,11],[5,10],[11,10],[13,12],[13,19],[3,19]], '#c85d70', '#704653');
    r(5, 11, 7, 2, '#f3d17f');
    r(7, 13, 2, 5, '#fff0d8');
    p([[10,12],[12,13],[13,17],[11,18]], '#efc66e', null);
    r(2, 15, 3, 3, '#e1aa78');
    r(11, 18, 3, 2, '#344b65');
    r(4, 20, 3, 2, '#f1d9bd');
    r(3, 12, 2, 5, '#f3d17f');
    r(11, 13, 2, 3, '#f3d17f');
    r(9, 15, 3, 1, '#fff0d8');
  } else if (role === 'nurse') {
    r(7, 11, 2, 6, '#d95f75');
    r(5, 13, 6, 2, '#d95f75');
    r(4, 18, 8, 1, '#f3c6c6');
  } else if (role === 'gymLeader') {
    r(4, 12, 9, 6, '#d8aa53');
    r(5, 11, 7, 2, '#fff0c0');
    r(10, 14, 3, 3, '#8d6eaa');
    r(3, 16, 2, 3, '#e8cb8d');
  } else if (role === 'meridian') {
    // Team Meridian uniform: dark field coat, gold centre stripe and crest.
    p([[3,11],[5,10],[11,10],[13,12],[13,19],[3,19]], '#2a3550', '#151c2e');
    r(7, 11, 2, 8, '#c9a227');
    r(4, 12, 2, 3, '#f0d56a');
    r(11, 12, 2, 3, '#f0d56a');
    r(5, 17, 6, 1, '#71809a');
  } else if (role === 'robot') {
    // Segmented body plates, dark joints and a small status-light panel.
    p([[3,11],[5,10],[11,10],[13,12],[13,19],[3,19]], '#758c9a', '#344958');
    r(5, 12, 2, 5, '#b9d9d2');
    r(9, 12, 2, 5, '#b9d9d2');
    r(7, 13, 2, 4, '#344958');
    r(7, 14, 1, 1, '#f1cc66');
    r(8, 16, 1, 1, '#6dc7bd');
    r(4, 18, 8, 1, '#41596a');
  } else if (role === 'trainer') {
    // A small pack and shoulder strap distinguish route trainers from townsfolk.
    r(2, 12, 3, 6, '#9b624d');
    r(3, 13, 2, 3, '#d9a16a');
    r(5, 11, 1, 6, '#e5bd70');
    r(11, 17, 2, 1, '#f2d48e');
  }

  if (motion === 'research' && role === 'professor') {
    const page = Math.floor(frame / 28) % 2;
    r(11, 13, 4, 6, '#6d8f99');
    r(12, 14, 3, 4, '#f8f2df');
    r(13 + page, 15, 1, 2, '#7eb5ae');
    r(12, 12, 2, 3, palette.coat);
    r(13, 10, 2, 3, skin);
    if (Math.floor(frame / 42) % 3 === 0) r(15, 9, 1, 1, '#f2d47e');
  } else if (motion === 'wave' || motion === 'gesture') {
    const wave = motion === 'wave' ? Math.round(Math.sin(frame / 4) * 2) : Math.round(Math.sin(frame / 8) * 1);
    r(12, 12 - wave, 2, 4, palette.coat);
    r(13, 9 - wave, 2, 4, skin);
    r(12, 8 - wave, 3, 2, skin);
  } else if (walking) {
    r(2 - step, 13, 2, 5, palette.coat);
    r(12 + step, 13, 2, 5, palette.coat);
  }

  // movement detail and directional shading
  if (dir === 'up') {
    r(5, 5, 7, 4, palette.hair);
    r(6, 6, 5, 2, palette.hairLight);
  }
  if (walking) {
    r(4 + step, 23, 4, 2, '#293c50');
    r(9 - step, 23, 4, 2, '#293c50');
  }
  ctx.restore();
  ctx.restore();
}

function drawRoom() {
  const type = S.room.type;
  ctx.fillStyle = '#d8c8a0';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = type === 'center' ? '#a5d9d0' : type.startsWith('gym') ? '#c8b4d5' : '#cce8d9';
  ctx.fillRect(0, 0, W, 62);
  ctx.fillStyle = type === 'center' ? '#48a999' : type.startsWith('gym') ? '#87709b' : '#73ad9d';
  ctx.fillRect(0, 57, W, 5);
  for (let y = 64; y < H; y += TS) {
    for (let x = 0; x < W; x += TS) {
      ctx.fillStyle = type.startsWith('gym')
        ? ((x / TS + y / TS) % 2 ? '#e2d0b4' : '#d7c09d')
        : type === 'lab'
          ? ((x / TS + y / TS) % 2 ? '#f5f2eb' : '#e8e7df')
          : ((x / TS + y / TS) % 2 ? '#e9d8b3' : '#f0e3c4');
      ctx.fillRect(x, y, TS, TS);
    }
  }
  ctx.fillStyle = '#92c1d0';
  ctx.fillRect(24, 15, 32, 24);
  ctx.fillRect(264, 15, 32, 24);
  ctx.strokeStyle = '#fff3da';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 15, 32, 24);
  ctx.strokeRect(264, 15, 32, 24);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(39, 15, 2, 24);
  ctx.fillRect(279, 15, 2, 24);
  if (type === 'center') {
    // Warm cream walls and a familiar rose-red center stripe.
    ctx.fillStyle = '#fff1dc'; ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = '#e86f7e'; ctx.fillRect(0, 0, W, 7);
    ctx.fillStyle = '#f6a3a6'; ctx.fillRect(0, 7, W, 4);
    ctx.fillStyle = '#b84c65'; ctx.fillRect(0, 57, W, 6);
    ctx.fillStyle = '#fff8e9'; ctx.fillRect(8, 14, 72, 34);
    ctx.fillStyle = '#d7edf0'; ctx.fillRect(12, 18, 64, 26);
    ctx.fillStyle = '#fff8e9'; ctx.fillRect(240, 14, 72, 34);
    ctx.fillStyle = '#d7edf0'; ctx.fillRect(244, 18, 64, 26);
    // Wall badge and centre sign.
    ctx.fillStyle = '#fff8e9'; ctx.fillRect(94, 13, 132, 36);
    ctx.fillStyle = '#c94f68'; ctx.fillRect(98, 17, 124, 28);
    ctx.fillStyle = '#ffdae0'; ctx.fillRect(103, 21, 114, 20);
    ctx.fillStyle = '#c94f68'; ctx.fillRect(156, 24, 8, 14); ctx.fillRect(153, 27, 14, 8);
    text('POCKETMALS CENTER', 110, 20, '#fff', 7);
    // Left seating nook with cushions and a plant.
    ctx.fillStyle = '#765b52'; ctx.fillRect(16, 83, 58, 19);
    ctx.fillStyle = '#e88a9b'; ctx.fillRect(19, 80, 52, 15);
    ctx.fillStyle = '#f5c6cc'; ctx.fillRect(23, 83, 44, 9);
    ctx.fillStyle = '#765b52'; ctx.fillRect(20, 99, 5, 8); ctx.fillRect(64, 99, 5, 8);
    ctx.fillStyle = '#6eaa70'; ctx.fillRect(84, 73, 5, 24); ctx.fillRect(77, 78, 18, 5);
    ctx.fillStyle = '#8bc87c'; ctx.fillRect(74, 70, 9, 8); ctx.fillRect(87, 69, 10, 9);
    // Nurse's service counter and the glowing six-slot healing unit.
    ctx.fillStyle = '#8d5260'; ctx.fillRect(99, 101, 123, 31);
    ctx.fillStyle = '#f8d7d2'; ctx.fillRect(103, 99, 115, 24);
    ctx.fillStyle = '#d56d7d'; ctx.fillRect(103, 119, 115, 5);
    ctx.fillStyle = '#fff7e7'; ctx.fillRect(107, 104, 107, 13);
    ctx.fillStyle = '#b7e7e2'; ctx.fillRect(111, 107, 99, 6);
    const pulse = 0.7 + Math.sin(frame / 8) * 0.2;
    for (let i = 0; i < 6; i++) {
      const hx = 116 + i * 15;
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillRect(hx, 105, 9, 9);
      ctx.fillStyle = i % 2 ? '#e77a91' : '#75c7c1';
      ctx.fillRect(hx + 2, 107, 5, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(hx + 3, 108, 3, 3);
    }
    drawPerson(10 * TS, 4 * TS, '#d95d72', 'down', 'nurse');
    text('NURSE FERN', 130, 60, '#2d6d69', 7);
    // Malbox PC terminal to the right, with a screen, keyboard and storage icon.
    ctx.fillStyle = '#536b7b'; ctx.fillRect(250, 75, 55, 43);
    ctx.fillStyle = '#253e55'; ctx.fillRect(254, 79, 47, 28);
    ctx.fillStyle = '#9dd8d4'; ctx.fillRect(258, 83, 39, 19);
    ctx.fillStyle = '#eaf8e8'; ctx.fillRect(261, 86, 33, 3);
    ctx.fillStyle = '#f7d77c'; ctx.fillRect(270, 91, 12, 7);
    ctx.fillStyle = '#879ba5'; ctx.fillRect(267, 108, 22, 4);
    ctx.fillStyle = '#304c5d'; ctx.fillRect(259, 116, 37, 5);
    text('MALBOX PC', 253, 130, '#395868', 7);
    // An illuminated round floor pad creates a clear place to stand while healing.
    ctx.fillStyle = '#c9b8a3'; ctx.fillRect(119, 157, 82, 31);
    ctx.fillStyle = '#9fcfc8'; ctx.fillRect(124, 161, 72, 23);
    ctx.fillStyle = '#eaf9eb'; ctx.fillRect(129, 165, 62, 15);
    ctx.fillStyle = '#e98698'; ctx.fillRect(155, 168, 10, 8);
    ctx.fillStyle = '#fff'; ctx.fillRect(158, 166, 4, 12);
    // A small sign and soft floor accents finish the room.
    ctx.fillStyle = '#fff0d8'; ctx.fillRect(20, 148, 70, 28);
    ctx.strokeStyle = '#b97b80'; ctx.strokeRect(20.5, 148.5, 69, 27);
    text('REST & RECOVER', 26, 160, '#8b5860', 6);
    text('PARTNER CARE', 29, 169, '#8b5860', 6);
  } else if (type.startsWith('gym')) {
    ctx.fillStyle = '#584b69';
    ctx.fillRect(25, 71, 55, 38);
    ctx.fillStyle = '#d8cfeb';
    ctx.fillRect(29, 75, 47, 30);
    ctx.fillStyle = '#735f86';
    ctx.fillRect(35, 81, 8, 10);
    ctx.fillRect(51, 81, 8, 10);
    ctx.fillRect(59, 94, 12, 6);
    ctx.fillStyle = '#fff0bd';
    ctx.fillRect(62, 88, 6, 6);
    ctx.fillStyle = '#75608a';
    ctx.fillRect(69, 78, 20, 30);
    ctx.fillStyle = '#f6d974';
    ctx.fillRect(74, 82, 10, 3);
    ctx.fillStyle = '#f4e1bd';
    ctx.fillRect(230, 71, 60, 34);
    ctx.fillStyle = '#a68cb6';
    ctx.fillRect(234, 75, 52, 26);
    ctx.fillStyle = '#fff2c7';
    ctx.fillRect(246, 82, 28, 3);
    ctx.fillStyle = '#75608a';
    ctx.fillRect(245, 85, 30, 12);
    ctx.fillStyle = '#e9bd5d';
    ctx.fillRect(250, 88, 20, 4);
    ctx.fillStyle = '#8c6350';
    ctx.fillRect(89, 127, 142, 55);
    ctx.fillStyle = '#d09a69';
    ctx.fillRect(94, 132, 132, 45);
    ctx.strokeStyle = '#f2d7a0';
    ctx.strokeRect(100.5, 138.5, 119, 32);
    ctx.fillStyle = '#f5d781';
    ctx.fillRect(156, 145, 8, 8);
    ctx.fillStyle = '#fff0bd';
    ctx.fillRect(159, 141, 2, 16);
    ctx.fillRect(152, 148, 16, 2);
    drawPerson(10 * TS, 4 * TS, type === 'gym2' ? '#68a8b8' : type === 'gym3' ? '#72a46a' : '#edbd58', 'down', 'gymLeader');
    text(type === 'gym2' ? 'LEADER MARINA' : type === 'gym3' ? 'LEADER SYLVAN' : 'LEADER ROWAN', 119, 60, '#65517b', 7);
  } else if (type === 'lab') {
    ctx.fillStyle = '#d9f0e4'; ctx.fillRect(4, 5, 312, 51);
    ctx.fillStyle = '#b4dcca'; ctx.fillRect(4, 54, 312, 6);
    ctx.fillStyle = '#f2f7ee'; ctx.fillRect(9, 10, 65, 34);
    ctx.fillStyle = '#9dd2df'; ctx.fillRect(13, 14, 57, 26);
    ctx.fillStyle = '#d9eff0'; ctx.fillRect(39, 14, 2, 26);
    ctx.fillStyle = '#faf8ed'; ctx.fillRect(86, 10, 148, 42);
    ctx.fillStyle = '#596f7b'; ctx.fillRect(95, 14, 58, 31);
    ctx.fillStyle = '#9fe2d1'; ctx.fillRect(99, 18, 50, 23);
    ctx.fillStyle = '#f0de8c'; ctx.fillRect(103, 23, 18, 3);
    ctx.fillStyle = '#74b6a4'; ctx.fillRect(103, 30, 37, 2);
    ctx.fillRect(103, 35, 29, 2);
    ctx.fillStyle = '#c7a86f'; ctx.fillRect(161, 17, 63, 5);
    ctx.fillStyle = '#e1bd7d'; ctx.fillRect(165, 22, 55, 22);
    ctx.fillStyle = '#f8edc8'; ctx.fillRect(171, 27, 8, 13);
    ctx.fillStyle = '#83b8bd'; ctx.fillRect(183, 26, 13, 15);
    ctx.fillStyle = '#e6c879'; ctx.fillRect(201, 27, 12, 14);
    text('MELLORA FIELD LAB', 106, 51, '#526b69', 6);

    ctx.fillStyle = '#9c7658'; ctx.fillRect(13, 73, 72, 12);
    ctx.fillStyle = '#e6c38c'; ctx.fillRect(16, 70, 66, 7);
    ctx.fillStyle = '#c4e3d6'; ctx.fillRect(21, 64, 10, 6);
    ctx.fillStyle = '#f4f4e8'; ctx.fillRect(36, 64, 18, 6);
    ctx.fillStyle = '#7eb5ae'; ctx.fillRect(61, 63, 14, 7);
    ctx.fillStyle = '#9c7658'; ctx.fillRect(235, 73, 72, 12);
    ctx.fillStyle = '#e6c38c'; ctx.fillRect(238, 70, 66, 7);
    ctx.fillStyle = '#e4a66f'; ctx.fillRect(244, 62, 11, 8);
    ctx.fillStyle = '#d5e7ee'; ctx.fillRect(260, 62, 17, 8);
    ctx.fillStyle = '#84c0b5'; ctx.fillRect(283, 62, 13, 8);

    ctx.fillStyle = '#9eb6bd'; ctx.fillRect(91, 68, 29, 22);
    ctx.fillStyle = '#e8f4ee'; ctx.fillRect(94, 70, 23, 16);
    ctx.fillStyle = '#86b9ae'; ctx.fillRect(101, 87, 9, 5);
    ctx.fillStyle = '#9eb6bd'; ctx.fillRect(200, 68, 29, 22);
    ctx.fillStyle = '#e8f4ee'; ctx.fillRect(203, 70, 23, 16);
    ctx.fillStyle = '#86b9ae'; ctx.fillRect(210, 87, 9, 5);

    ctx.fillStyle = '#8b664d'; ctx.fillRect(93, 107, 134, 13);
    ctx.fillStyle = '#d6b27b'; ctx.fillRect(96, 104, 128, 5);
    ctx.fillStyle = '#6e9a9d'; ctx.fillRect(100, 120, 6, 17);
    ctx.fillRect(214, 120, 6, 17);
    for (let i = 0; i < 3; i++) {
      const sx = 103 + i * 43;
      ctx.fillStyle = '#8c735e'; ctx.fillRect(sx, 94, 30, 11);
      ctx.fillStyle = '#bddbd7'; ctx.fillRect(sx + 2, 90, 26, 5);
      ctx.fillStyle = '#f7fff0'; ctx.fillRect(sx + 5, 91, 20, 2);
      const name = STARTER_NAMES[i];
      const choosingStarter = ui?.kind === 'choose' && ui.title === 'Choose your first partner';
      const revealAge = starterReveal ? frame - starterReveal.start : -1;
      const isRevealing = starterReveal?.name === name && revealAge >= 0 && revealAge < 120;
      const isSelected = choosingStarter && ui.idx === i;
      drawMalball(ctx, sx + 15, 86, 7);
      if (isRevealing || isSelected) {
        const pulse = 0.35 + Math.sin(frame / 4) * 0.12;
        ctx.fillStyle = `rgba(255, 242, 173, ${pulse})`;
        ctx.fillRect(sx + 8, 63, 14, 2);
        drawMal(name, sx + 1, 53 + Math.sin(frame / 7 + i) * 2, 28, 31, Math.floor(frame / 6 + i * 2) % 8);
      }
    }

    const drawPlant = (x, y) => {
      ctx.fillStyle = '#d4bb93'; ctx.fillRect(x, y + 15, 20, 8);
      ctx.fillStyle = '#a36d50'; ctx.fillRect(x + 2, y + 10, 16, 8);
      ctx.fillStyle = '#468660'; ctx.fillRect(x + 9, y, 3, 14);
      ctx.fillStyle = '#579b68'; ctx.fillRect(x + 2, y + 3, 9, 7);
      ctx.fillRect(x + 11, y + 1, 8, 8);
      ctx.fillStyle = '#85bc70'; ctx.fillRect(x + 5, y + 2, 4, 3);
      ctx.fillRect(x + 13, y, 4, 3);
    };
    drawPlant(35, 175);
    drawPlant(265, 175);

    ctx.fillStyle = '#d3e2e7'; ctx.fillRect(6, 130, 72, 30);
    ctx.fillStyle = '#87afb9'; ctx.fillRect(10, 134, 64, 22);
    ctx.fillStyle = '#f4f2e7'; ctx.fillRect(14, 138, 56, 14);
    text('FIELD NOTES', 18, 148, '#51717a', 6);
    ctx.fillStyle = '#d3e2e7'; ctx.fillRect(242, 130, 72, 30);
    ctx.fillStyle = '#87afb9'; ctx.fillRect(246, 134, 64, 22);
    ctx.fillStyle = '#f4f2e7'; ctx.fillRect(250, 138, 56, 14);
    text('SPECIMENS', 258, 148, '#51717a', 6);

    // Research-room details: a framed region map, specimen shelf, lab plaque,
    // warm task lights and a floor runner give the lab a clear visual identity.
    ctx.fillStyle = '#486e78'; ctx.fillRect(116, 4, 88, 12);
    ctx.fillStyle = '#e8e0bf'; ctx.fillRect(119, 7, 82, 6);
    ctx.fillStyle = '#4e7780'; ctx.fillRect(122, 8, 76, 1);
    ctx.fillStyle = '#7bb3a4'; ctx.fillRect(125, 10, 13, 2);
    ctx.fillStyle = '#d9b66f'; ctx.fillRect(143, 10, 9, 2);
    ctx.fillStyle = '#8aaf9d'; ctx.fillRect(157, 10, 12, 2);
    ctx.fillStyle = '#d9b66f'; ctx.fillRect(174, 10, 17, 2);

    // Wall-mounted habitat map with small route pins.
    ctx.fillStyle = '#6e8790'; ctx.fillRect(13, 60, 62, 31);
    ctx.fillStyle = '#edf1dc'; ctx.fillRect(16, 63, 56, 25);
    ctx.fillStyle = '#b9d9c8'; ctx.fillRect(19, 66, 50, 19);
    ctx.fillStyle = '#78a98c'; ctx.fillRect(24, 69, 12, 7);
    ctx.fillRect(43, 74, 17, 6);
    ctx.fillStyle = '#d6a85f'; ctx.fillRect(31, 72, 3, 3);
    ctx.fillRect(51, 69, 3, 3);
    ctx.fillStyle = '#e58a7d'; ctx.fillRect(60, 78, 3, 3);

    // Specimen shelf: four glass jars, labels and a tiny desk lamp.
    ctx.fillStyle = '#805e4a'; ctx.fillRect(242, 91, 65, 5);
    ctx.fillStyle = '#d6bd91'; ctx.fillRect(245, 88, 59, 3);
    for (let i = 0; i < 4; i++) {
      const bx = 247 + i * 14;
      ctx.fillStyle = '#d9eee2'; ctx.fillRect(bx, 78, 8, 10);
      ctx.fillStyle = ['#79b6a9','#e5c778','#91a9d3','#d58a83'][i];
      ctx.fillRect(bx + 2, 81, 4, 5);
      ctx.fillStyle = '#fff6d7'; ctx.fillRect(bx + 2, 77, 4, 2);
    }
    ctx.fillStyle = '#d8bd83'; ctx.fillRect(292, 69, 3, 9);
    ctx.fillStyle = '#f7e5a5'; ctx.fillRect(288, 67, 11, 3);

    // A soft runner and compass emblem mark the centre work area.
    ctx.fillStyle = '#d1dfd1'; ctx.fillRect(108, 166, 104, 43);
    ctx.fillStyle = '#a7c8b8'; ctx.fillRect(112, 170, 96, 35);
    ctx.fillStyle = '#eaf0df'; ctx.fillRect(118, 174, 84, 27);
    ctx.fillStyle = '#6eaaa0'; ctx.fillRect(157, 181, 7, 13);
    ctx.fillStyle = '#e1bd70'; ctx.fillRect(153, 185, 15, 4);
    ctx.fillStyle = '#f7e9bb'; ctx.fillRect(159, 178, 3, 19);

    // Small alternating status lights and rising specimen bubbles.
    const labPulse = Math.floor(frame / 12) % 2;
    ctx.fillStyle = labPulse ? '#fff0a8' : '#8ed6c5';
    ctx.fillRect(143, 24, 3, 3);
    ctx.fillStyle = labPulse ? '#8ed6c5' : '#fff0a8';
    ctx.fillRect(147, 24, 3, 3);
    for (let i = 0; i < 3; i++) {
      const bubbleY = 88 - ((frame / 8 + i * 5) % 10);
      ctx.fillStyle = '#ffffffaa';
      ctx.fillRect(107 + i * 43, bubbleY, 2, 2);
    }

    drawPerson(8 * TS, 6 * TS, '#d96d78', 'down', 'mimi', 'wave');
    drawPerson(11 * TS, 5 * TS, '#f5f0d8', 'down', 'professor', 'research');
    text('TESSA', 112, 99, '#8a4e61', 6);
    text('PROF. LOTUS', 172, 81, '#425f71', 6);
  } else {
    ctx.fillStyle = '#8b664d';
    ctx.fillRect(22, 68, 52, 34);
    ctx.fillStyle = '#c49b6d';
    ctx.fillRect(24, 70, 48, 3);
    ctx.fillRect(24, 82, 48, 3);
    ctx.fillRect(24, 94, 48, 3);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = ['#e77e75', '#e6c75f', '#80bb9a', '#8b9fd0'][i % 4];
      ctx.fillRect(27 + (i % 4) * 11, 74 + Math.floor(i / 4) * 12, 7, 7);
    }
  }
  ctx.fillStyle = '#98734d';
  ctx.fillRect(144, 224, 32, 16);
  ctx.fillStyle = '#654a37';
  ctx.fillRect(150, 228, 20, 11);
  ctx.fillStyle = '#fff1cf';
  ctx.fillRect(150, 228, 20, 2);
  const px = moving ? (moving.fx + (S.x - moving.fx) * moving.t) * TS : S.x * TS;
  const py = moving ? (moving.fy + (S.y - moving.fy) * moving.t) * TS : S.y * TS;
  drawPerson(px, py, S.look, S.dir, 'player');
  ctx.fillStyle = '#17273b';
  ctx.fillRect(4, 4, 112, 14);
  text(type === 'center' ? 'POCKETMALS CENTER'
    : type.startsWith('gym') ? (type === 'gym2' ? 'SOLARA CITY GYM' : type === 'gym3' ? 'OMBRA WOODS GYM' : 'COVO TOWN GYM') : 'PROFESSOR LOTUS\'S LAB', 8, 14, '#fff', 7);
}
function drawBattleLower(g) {
  const player = B.me, foe = B.foe;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#14243a'; g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#25465a'; g.fillRect(4, 4, 312, 232);
  g.fillStyle = '#f1ead2'; g.fillRect(9, 9, 302, 222);
  g.fillStyle = '#2d4b61'; g.fillRect(9, 9, 302, 23);
  g.fillStyle = '#f8edcf'; g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
  g.fillText('POCKETMALS BATTLE CONSOLE', 17, 23);

  const cards = [
    { mal: player, x: 16, label: 'YOUR PARTNER' },
    { mal: foe, x: 166, label: 'OPPONENT' },
  ];
  for (const card of cards) {
    const m = card.mal, hp = Math.max(0, Math.min(1, m.cur / Math.max(1, m.maxhp)));
    g.fillStyle = '#e3e6d5'; g.fillRect(card.x, 39, 138, 39);
    g.strokeStyle = '#728982'; g.strokeRect(card.x + .5, 39.5, 137, 38);
    g.fillStyle = '#263d50'; g.font = 'bold 7px "Pixelify Sans", Arial, sans-serif';
    g.fillText(card.label, card.x + 6, 50);
    g.fillStyle = '#263d50'; g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`${malName(m).slice(0, 12)} Lv${m.lv}`, card.x + 6, 61);
    g.fillStyle = '#405765'; g.fillRect(card.x + 6, 66, 125, 5);
    g.fillStyle = hp > .5 ? '#59a86b' : hp > .2 ? '#d5ad4f' : '#c76561';
    g.fillRect(card.x + 6, 66, 125 * hp, 5);
    g.fillStyle = '#536b77'; g.font = '6px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`${m.cur}/${m.maxhp} HP`, card.x + 6, 75);
  }

  const command = ui?.kind === 'choose' && ui.title.startsWith('What will');
  const moves = ui?.kind === 'choose' && ui.title === 'Moves';
  const otherList = ui?.kind === 'choose' && !command && !moves;
  if (command) {
    const labels = ['FIGHT', 'BAG', 'POCKETMALS', 'RUN'];
    const hints = ['Choose a move', 'Use an item', 'Switch partner', 'Try to escape'];
    const colors = ['#cf765d', '#d7a74e', '#549cac', '#8a84ad'];
    for (let i = 0; i < 4; i++) {
      const x = 16 + (i % 2) * 145, y = 88 + Math.floor(i / 2) * 61;
      const selected = ui.idx === i;
      g.fillStyle = selected ? '#294d63' : '#dfe7dc'; g.fillRect(x, y, 139, 54);
      g.strokeStyle = selected ? '#e4b85e' : '#8fa19a'; g.lineWidth = selected ? 3 : 1;
      g.strokeRect(x + .5, y + .5, 138, 53); g.lineWidth = 1;
      g.fillStyle = colors[i]; g.fillRect(x + 8, y + 8, 23, 23);
      g.fillStyle = '#fff'; g.font = 'bold 11px "Pixelify Sans", Arial, sans-serif'; g.fillText(['F','B','P','R'][i], x + 16, y + 24);
      g.fillStyle = selected ? '#fff1cf' : '#2d4352'; g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif'; g.fillText(labels[i], x + 39, y + 20);
      g.fillStyle = selected ? '#d6e2dc' : '#657a7c'; g.font = '7px "Pixelify Sans", Arial, sans-serif'; g.fillText(hints[i], x + 39, y + 35);
    }
  } else if (moves) {
    for (let i = 0; i < Math.min(4, player.moves.length); i++) {
      const name = player.moves[i], info = MOVES[name] || ['normal', 40, 100];
      const x = 16 + (i % 2) * 145, y = 88 + Math.floor(i / 2) * 59;
      const selected = ui.idx === i, pp = currentMovePP(player, name);
      g.fillStyle = selected ? '#294d63' : '#dfe7dc'; g.fillRect(x, y, 139, 52);
      g.strokeStyle = selected ? '#e4b85e' : '#8fa19a'; g.lineWidth = selected ? 3 : 1;
      g.strokeRect(x + .5, y + .5, 138, 51); g.lineWidth = 1;
      g.fillStyle = TYPE_COLORS[info[0]] || '#aaa'; g.fillRect(x + 7, y + 8, 5, 34);
      g.fillStyle = selected ? '#fff1cf' : '#2d4352'; g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
      g.fillText(name.toUpperCase().slice(0, 17), x + 18, y + 18);
      g.fillStyle = selected ? '#d6e2dc' : '#657a7c'; g.font = '6px "Pixelify Sans", Arial, sans-serif';
      g.fillText(`${info[0].toUpperCase()}  PWR ${info[1]}  ACC ${info[2]}`, x + 18, y + 31);
      g.fillText(`PP ${pp}/${maxMovePP(name)}`, x + 18, y + 43);
      if (pp === 0) { g.fillStyle = '#c35d5b'; g.fillText('EMPTY', x + 99, y + 43); }
    }
  } else if (otherList) {
    g.fillStyle = '#263e50'; g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
    g.fillText(String(ui.title).toUpperCase().slice(0, 32), 18, 96);
    for (let i = 0; i < Math.min(6, ui.items.length); i++) {
      const y = 111 + i * 17;
      g.fillStyle = i === ui.idx ? '#d8e5d5' : '#f6f3e7'; g.fillRect(17, y - 10, 286, 15);
      g.fillStyle = i === ui.idx ? '#ad6255' : '#30495b'; g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
      const cursorBob = i === ui.idx ? Math.sin(frame * 0.18) * 1.5 : 0;
      g.fillText(`${i === ui.idx ? '▶' : ' '} ${String(ui.items[i]).slice(0, 39)}`, 23, y + cursorBob);
      if (i === ui.idx && ui.title && (ui.title.toLowerCase().includes('mal') || ui.title.toLowerCase().includes('swap with') || ui.title.toLowerCase().includes('use on')) && S.party[i]) {
        const chosen = S.party[i];
        g.drawImage(malSprite(chosen.name, Math.floor(frame / 6) % 8, 'front', !!chosen.shiny), 279, y - 10 + cursorBob, 14, 14);
      }
    }
  } else {
    g.fillStyle = '#30495b'; g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
    g.fillText('BATTLE STATUS', 20, 102);
    g.font = '8px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`PARTNER  ${malName(player).slice(0, 16)}`, 20, 126);
    g.fillText(`OPPONENT ${malName(foe).slice(0, 16)}`, 20, 144);
    g.fillText(`TURN ${B.turn || 1}`, 20, 162);
    g.fillStyle = '#72877e'; g.fillRect(20, 173, 280, 1);
    g.font = '7px "Pixelify Sans", Arial, sans-serif'; g.fillText('Z / ENTER CONFIRM     X / ESC BACK', 20, 192);
  }
  g.fillStyle = '#58717a'; g.fillRect(10, 224, 300, 1);
  g.fillStyle = '#617879'; g.font = '6px "Pixelify Sans", Arial, sans-serif';
  g.fillText('POCKETMALS FIELD BATTLE SYSTEM  /  LUNARO', 17, 235);
}

function drawStarterSelection(g) {
  const starters = STARTER_NAMES;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#14243a'; g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#25465a'; g.fillRect(4, 4, 312, 232);
  g.fillStyle = '#f5f0df'; g.fillRect(9, 9, 302, 222);
  g.fillStyle = '#2d4b61'; g.fillRect(9, 9, 302, 25);
  g.fillStyle = '#fff0c8'; g.font = 'bold 11px "Pixelify Sans", Arial, sans-serif';
  g.fillText('CHOOSE YOUR FIRST PARTNER', 17, 25);

  starters.forEach((name, index) => {
    const species = MALS[name];
    const x = 12 + index * 99;
    const selected = ui.idx === index;
    const y = 41;
    g.fillStyle = selected ? '#f8eab9' : '#e5ece0';
    g.fillRect(x, y, 94, 143);
    g.strokeStyle = selected ? '#c87945' : '#78928a';
    g.lineWidth = selected ? 3 : 1;
    g.strokeRect(x + 1.5, y + 1.5, 91, 140);
    g.lineWidth = 1;
    g.fillStyle = selected ? '#fff8df' : '#f5f7ea';
    g.fillRect(x + 5, y + 5, 84, 15);
    g.fillStyle = '#506c70';
    g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`PARTNER 0${index + 1}`, x + 10, y + 16);
    g.drawImage(malSprite(name, Math.floor(frame / 6 + index * 2) % 8, 'front'), x + 21, y + 23, 52, 52);
    g.fillStyle = '#2a3d4d';
    g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
    g.fillText(name.toUpperCase(), x + 7, y + 87);
    g.fillStyle = TYPE_COLORS[species.type];
    g.fillRect(x + 8, y + 94, 78, 13);
    g.fillStyle = '#172c3c';
    g.font = 'bold 7px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`${species.types.map((type) => type.toUpperCase()).join('/')}`, x + 22, y + 103);
    g.fillStyle = '#597174';
    g.font = '8px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`HP ${species.hp}  ATK ${species.atk}`, x + 11, y + 119);
    g.fillStyle = '#536b73';
    g.font = '7px "Pixelify Sans", Arial, sans-serif';
    g.fillText(STARTER_PERSONALITIES[index], x + 8, y + 132);
    drawMalball(g, x + 82, y + 132, 5);
  });

  g.fillStyle = '#314d60';
  g.fillRect(14, 192, 292, 1);
  g.fillStyle = '#536b73';
  g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
  g.fillText('UP / DOWN  SELECT PARTNER', 22, 208);
  g.fillText('Z / ENTER  CONFIRM     X / ESC  BACK', 22, 222);
}

function drawLowerScreen() {
  if (mode === 'battle' && B) { drawBattleLower(lowerCtx); return; }
  const g = lowerCtx;
  if (mode === 'title') {
    g.fillStyle = '#10213a';
    g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#1c3550';
    g.fillRect(5, 5, 310, 230);
    g.fillStyle = '#ffd45a';
    g.font = 'bold 16px "Pixelify Sans", Arial, sans-serif';
    g.fillText('MELLORA REGION', 16, 25);
    g.fillStyle = '#8197ae';
    g.fillRect(16, 33, 288, 1);

    const hasSave = hasValidSave();
    const profile = getTitleSaveProfile();
    const choices = titleChoices();
    if (titleSel >= choices.length) titleSel = 0;
    g.fillStyle = '#d8e8e5';
    g.fillRect(16, 42, 288, 44);
    g.fillStyle = '#31566b';
    g.fillRect(16, 42, 288, 13);
    g.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
    g.fillStyle = '#fff';
    g.fillText(hasSave ? 'ADVENTURE DATA' : 'NO SAVE YET', 23, 52);
    if (profile && hasSave) {
      g.fillStyle = profile.look || '#427fc0';
      g.fillRect(24, 60, 16, 20);
      g.fillStyle = '#f2d3ad';
      g.fillRect(27, 58, 10, 7);
      g.fillStyle = '#273645';
      g.fillRect(27, 70, 10, 9);
      g.fillStyle = '#203e4e';
      g.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
      g.fillText((profile.name || 'Trainer').slice(0, 12), 49, 68);
      g.font = '9px "Pixelify Sans", Arial, sans-serif';
      g.fillText(`${(MAPS[profile.map]?.name || 'Mellora').toUpperCase()}  ·  ${profile.badges?.length || 0} BADGES`, 49, 80);
    } else {
      g.fillStyle = '#203e4e';
      g.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
      g.fillText('Start fresh and meet Professor Lotus.', 23, 73);
    }

    choices.forEach((choice, index) => {
      const y = 96 + index * 31;
      const selected = titleSel === index;
      g.fillStyle = selected ? '#f8e9a9' : '#f4f2e5';
      g.fillRect(24, y, 272, 25);
      g.strokeStyle = selected ? '#2f6577' : '#8da5aa';
      g.lineWidth = selected ? 2 : 1;
      g.strokeRect(24.5, y + 0.5, 271, 24);
      g.font = 'bold 12px "Pixelify Sans", Arial, sans-serif';
      g.fillStyle = '#203e4e';
      g.fillText(`${selected ? '▶  ' : '   '}${choice.label}`, 34, y + 17);
    });

    g.fillStyle = '#b8c9da';
    g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
    g.fillText('PRESS START  ·  Z / ENTER SELECT', 18, 229);
    if (saveMessage) {
      g.fillStyle = '#ffe29a';
      g.fillText(saveMessage.slice(0, 30), 18, 215);
    }
    return;
  }
  if (mode === 'opening') {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 240);
    const glow = 8 + Math.sin(frame / 10) * 4;
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 27px "Pixelify Sans", Arial, sans-serif';
    g.shadowColor = '#f4ffff';
    g.shadowBlur = glow * 2;
    g.fillStyle = '#fff';
    g.fillText('POCKETMALS', 160, 120);
    g.shadowBlur = glow * 3;
    g.fillText('POCKETMALS', 160, 120);
    g.restore();
    return;
  }
  if (mode === 'menu' && menuState) {
    drawGameMenu(g);
    return;
  }
  if (ui?.kind === 'choose' && ui.title === 'Choose your first partner') {
    drawStarterSelection(g);
    return;
  }
  const type = S && S.room ? S.room.type : 'world';
  g.fillStyle = '#10213a';
  g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#293e59';
  g.fillRect(3, 3, 314, 234);
  g.fillStyle = '#ffd45a';
  g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
  g.fillText(type === 'center' ? 'POCKETMALS CENTER'
    : type === 'lab' ? 'PROFESSOR LOTUS\'S LAB'
      : type.startsWith('gym') ? (type === 'gym2' ? 'SOLARA CITY GYM' : type === 'gym3' ? 'OMBRA WOODS GYM' : 'COVO TOWN GYM')
      : MAPS[S ? S.map : 'pocketown'].name.toUpperCase(), 12, 17);
  g.fillStyle = '#8197ae';
  g.fillRect(12, 23, 296, 1);
  g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
  if (S && S.party.length) {
    g.fillStyle = '#b8c9da';
    g.fillText('POCKETMALS FIELD GUIDE', 12, 37);
    const miniMap = S.room ? null : MAPS[S.map];
    if (miniMap) {
      const tileColors = { T: '#315b44', '.': '#a7d17b', G: '#54994b', W: '#68a9d7', '#': '#d8bd83', F: '#edb866', K: '#8b8578', B: '#978c78', R: '#d8bd83', H: '#c77a68', L: '#8d85c0', C: '#60bca4', S: '#6d9dc2', Y: '#7769a7', D: '#655c56', E: '#655c56' };
      g.fillStyle = '#14243a';
      g.fillRect(12, 45, 111, 95);
      for (let y = 0; y < miniMap.rows.length; y++) {
        for (let x = 0; x < miniMap.rows[y].length; x++) {
          g.fillStyle = tileColors[miniMap.rows[y][x]] || '#a7d17b';
          g.fillRect(17 + x * 5, 50 + y * 5, 5, 5);
        }
      }
      g.fillStyle = '#ffef75';
      g.fillRect(17 + S.x * 5 + 1, 50 + S.y * 5 + 1, 3, 3);
      g.strokeStyle = '#8297aa';
      g.strokeRect(12.5, 45.5, 111, 95);
    } else {
      g.fillStyle = '#20384c';
      g.fillRect(12, 45, 111, 95);
      g.fillStyle = '#c8e8ed';
      g.fillRect(23, 57, 89, 5);
      g.fillStyle = '#d8c8a0';
      for (let i = 0; i < 6; i++) g.fillRect(23 + i * 14, 74, 12, 12);
      g.fillStyle = type === 'center' ? '#ee8f9a' : '#f5f0d8';
      g.fillRect(66, 96, 16, 16);
      g.strokeStyle = '#8297aa';
      g.strokeRect(12.5, 45.5, 111, 95);
    }
    g.fillStyle = '#b8c9da';
    g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    g.fillText('YOUR TEAM', 139, 51);
    g.font = '7px "Pixelify Sans", Arial, sans-serif';
    S.party.slice(0, 6).forEach((mal, i) => {
      const y = 58 + i * 26;
      g.fillStyle = '#1b2b40';
      g.fillRect(136, y, 171, 23);
      g.fillStyle = TYPE_COLORS[MALS[mal.name].type];
      g.fillRect(141, y + 4, 15, 15);
      g.imageSmoothingEnabled = false;
      g.drawImage(malSprite(mal.name, Math.floor(frame / 6) % 8, 'front', !!mal.shiny), 142, y + 5, 13, 13);
      g.fillStyle = '#edf1e7';
      g.fillText(malName(mal).slice(0, 13), 161, y + 10);
      g.fillStyle = '#91a5b8';
      g.fillText(`Lv${mal.lv}`, 161, y + 19);
      g.fillStyle = '#425665';
      g.fillRect(199, y + 6, 96, 5);
      g.fillStyle = hpRatio(mal) > 0.5 ? '#74c97a' : '#e5b65c';
      g.fillRect(199, y + 6, 96 * hpRatio(mal), 5);
      g.fillStyle = '#bac8cf';
      g.fillText(`${mal.cur}/${mal.maxhp} HP`, 199, y + 19);
    });
  } else {
    g.fillStyle = '#b8c9da';
    g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    g.fillText('YOUR ADVENTURE IS WAITING', 12, 37);
    g.fillStyle = '#8fa8bc';
    g.font = '7px "Pixelify Sans", Arial, sans-serif';
    g.fillText('Choose NEW GAME to meet Professor Lotus', 12, 54);
  }
  if (S) {
    g.fillStyle = '#ffd45a';
    g.font = 'bold 7px "Pixelify Sans", Arial, sans-serif';
    g.fillText(`BADGES ${S.badges.length}/3   SHOES ${S.flags.running ? 'RUN' : 'WALK'}`, 139, 202);
    if (S.flags.repelSteps > 0) g.fillText(`REPEL ${S.flags.repelSteps} STEPS`, 139, 214);
  }
  g.fillStyle = '#9cadc0';
  g.fillRect(12, 211, 296, 1);
  g.font = '7px "Pixelify Sans", Arial, sans-serif';
  g.fillText(S && S.room ? 'A TALK / HEAL   B MENU   DOWN AT DOOR TO EXIT' : 'ARROWS / WASD MOVE   SHIFT SHOES   Z A   X B', 12, 226);
}
function drawIntroRoom() {
  const sceneAge = frame - introSceneStarted;
  // The opening uses fixed, composed pixel-art scenes rather than a blank map screen.
  const drawWindow = (x, y, w, h, sky = '#8cc4dd') => {
    ctx.fillStyle = '#f4eddb'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#edf5dd'; ctx.fillRect(x, y + Math.floor(h * 0.56), w, 3);
    ctx.fillStyle = '#6b9b75'; ctx.fillRect(x, y + Math.floor(h * 0.72), w, Math.ceil(h * 0.28));
    ctx.fillStyle = '#f9f0d8'; ctx.fillRect(x + Math.floor(w / 2) - 2, y, 4, h);
    ctx.fillRect(x, y + Math.floor(h / 2), w, 3);
  };
  const introHeader = (left, right = 'MELLORA REGION') => {
    ctx.fillStyle = '#20384c'; ctx.fillRect(5, 5, 310, 17);
    text(left, 11, 17, '#fff0c5', 8);
    text(right, 220, 17, '#c9e4e1', 6);
  };

  if (introScene === 'town') {
    ctx.fillStyle = '#8dc6df'; ctx.fillRect(0, 0, W, 116);
    ctx.fillStyle = '#b5d9cf'; ctx.fillRect(0, 102, W, 22);
    // layered distant hills
    ctx.fillStyle = '#7ab28a';
    ctx.beginPath(); ctx.moveTo(0, 116); ctx.lineTo(35, 75); ctx.lineTo(72, 113); ctx.lineTo(121, 67); ctx.lineTo(165, 115); ctx.lineTo(213, 82); ctx.lineTo(269, 113); ctx.lineTo(300, 78); ctx.lineTo(320, 104); ctx.lineTo(320, 150); ctx.lineTo(0, 150); ctx.fill();
    ctx.fillStyle = '#55956b'; ctx.fillRect(0, 132, W, 108);
    ctx.fillStyle = '#d7c18c'; ctx.fillRect(0, 157, W, 83);
    ctx.fillStyle = '#f0dba8'; ctx.fillRect(0, 157, W, 5);
    // homes, flower beds, lamps and footpath
    ctx.fillStyle = '#efe0bd'; ctx.fillRect(15, 77, 67, 54);
    ctx.fillStyle = '#b86d61'; ctx.fillRect(10, 70, 77, 17);
    ctx.fillStyle = '#9d544d'; ctx.beginPath(); ctx.moveTo(8, 73); ctx.lineTo(48, 47); ctx.lineTo(90, 73); ctx.fill();
    ctx.fillStyle = '#87bdd0'; ctx.fillRect(24, 91, 18, 17); ctx.fillRect(55, 91, 17, 17);
    ctx.fillStyle = '#815d49'; ctx.fillRect(43, 105, 13, 26);
    ctx.fillStyle = '#f2e4c8'; ctx.fillRect(241, 69, 62, 62);
    ctx.fillStyle = '#668eaa'; ctx.fillRect(236, 62, 72, 15);
    ctx.fillStyle = '#527b98'; ctx.beginPath(); ctx.moveTo(235, 65); ctx.lineTo(272, 40); ctx.lineTo(309, 65); ctx.fill();
    ctx.fillStyle = '#a7d6d2'; ctx.fillRect(251, 88, 16, 16); ctx.fillRect(278, 88, 16, 16);
    ctx.fillStyle = '#f7d58b'; ctx.fillRect(15, 138, 5, 9); ctx.fillRect(297, 139, 5, 9);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#f7e9a2' : '#f2a1a7';
      ctx.fillRect(104 + i * 13, 146 + (i % 3) * 4, 3, 3);
      ctx.fillStyle = '#438b59'; ctx.fillRect(105 + i * 13, 149 + (i % 3) * 4, 1, 5);
    }
    const walkProgress = Math.min(1, sceneAge / 180);
    drawPerson(88 + walkProgress * 86, 145, S.look, 'right', 'player', walkProgress < 1 ? 'walk' : 'idle');
    drawPerson(48 + walkProgress * 86, 145, '#d96d78', 'right', 'mimi', walkProgress < 1 ? 'walk' : 'idle');
    introHeader('COVO TOWN  /  MORNING', 'A NEW DAY');
    ctx.fillStyle = '#20384c'; ctx.fillRect(5, 197, 310, 37);
    text('THE ROAD TO THE LAB', 15, 211, '#fff0c5', 8);
    text('Two friends. Three partners. One new adventure.', 15, 225, '#d7e9e3', 7);
    return;
  }

  // bedroom scene
  ctx.fillStyle = '#8bbbd5'; ctx.fillRect(0, 0, W, 104);
  ctx.fillStyle = '#c8dfdd'; ctx.fillRect(0, 104, W, 136);
  for (let y = 112; y < 240; y += 16) {
    for (let x = 0; x < 320; x += 16) {
      ctx.fillStyle = ((x / 16 + y / 16) % 2) ? '#e8d8bb' : '#f0e5ce';
      ctx.fillRect(x, y, 16, 16);
    }
  }
  // window and curtains
  drawWindow(24, 30, 91, 57, '#8cc5df');
  ctx.fillStyle = '#d27f83'; ctx.fillRect(17, 25, 12, 71); ctx.fillRect(111, 25, 12, 71);
  ctx.fillStyle = '#f3d49d'; ctx.fillRect(17, 91, 106, 5);
  // wall shelf, books and framed map poster
  ctx.fillStyle = '#8c674c'; ctx.fillRect(190, 33, 93, 5);
  ctx.fillStyle = '#d5ae77'; ctx.fillRect(196, 19, 12, 14); ctx.fillRect(212, 22, 10, 11); ctx.fillRect(227, 16, 13, 17);
  ctx.fillStyle = '#f3ead4'; ctx.fillRect(255, 42, 47, 39);
  ctx.fillStyle = '#6f9ca6'; ctx.fillRect(259, 46, 39, 31);
  ctx.fillStyle = '#83b777'; ctx.fillRect(263, 58, 30, 15);
  ctx.fillStyle = '#f0d58f'; ctx.fillRect(278, 50, 3, 3);
  // bed with quilt and pillow
  ctx.fillStyle = '#8b6558'; ctx.fillRect(25, 145, 116, 55);
  ctx.fillStyle = '#f4e9d6'; ctx.fillRect(30, 137, 105, 52);
  ctx.fillStyle = '#7ea9bf'; ctx.fillRect(33, 153, 99, 31);
  ctx.fillStyle = '#f0d7ad'; ctx.fillRect(39, 141, 40, 16);
  ctx.fillStyle = '#d98d90'; ctx.fillRect(33, 177, 99, 8);
  ctx.fillStyle = '#a66f58'; ctx.fillRect(21, 195, 124, 7);
  // desk and a small field notebook
  ctx.fillStyle = '#9a7251'; ctx.fillRect(185, 145, 112, 9); ctx.fillRect(194, 154, 7, 48); ctx.fillRect(282, 154, 7, 48);
  ctx.fillStyle = '#f5efd9'; ctx.fillRect(220, 130, 28, 16);
  ctx.fillStyle = '#d0bd91'; ctx.fillRect(223, 133, 22, 10);
  ctx.fillStyle = '#4c8194'; ctx.fillRect(225, 135, 15, 1); ctx.fillRect(225, 138, 12, 1);
  // door and morning sunbeam
  ctx.fillStyle = '#9f7658'; ctx.fillRect(155, 83, 27, 91);
  ctx.fillStyle = '#d8b98d'; ctx.fillRect(159, 88, 19, 82);
  ctx.fillStyle = '#e9c77f'; ctx.fillRect(171, 126, 3, 3);
  ctx.fillStyle = '#f7e6ae'; ctx.globalAlpha = 0.18;
  ctx.beginPath(); ctx.moveTo(119, 88); ctx.lineTo(191, 88); ctx.lineTo(245, 179); ctx.lineTo(102, 179); ctx.fill();
  ctx.globalAlpha = 1;

  const bedroomProgress = Math.min(1, sceneAge / 180);
  drawPerson(86 + bedroomProgress * 52, 158, S.look, 'right', 'player', bedroomProgress < 1 ? 'walk' : 'idle');
  drawPerson(222, 157, '#b96b79', 'down', 'mom', 'wave');
  drawPerson(177, 157, '#d96d78', 'left', 'mimi', 'wave');
  introHeader('COVO TOWN  /  YOUR ROOM', '07:30 AM');
  ctx.fillStyle = '#20384c'; ctx.fillRect(5, 207, 310, 27);
  text('A LETTER FROM PROFESSOR LOTUS IS ON THE DESK.', 13, 224, '#fff0c5', 7);
}
function drawWorld() {
  if (S.room) return drawRoom();
  const md = MAPS[S.map];
  let px = S.x * TS, py = S.y * TS;
  if (moving) {
    px = (moving.fx + (S.x - moving.fx) * moving.t) * TS;
    py = (moving.fy + (S.y - moving.fy) * moving.t) * TS;
  }
  // A close, player-centred camera reveals the route gradually instead of showing
  // the entire 20 x 15 map at once, like a handheld monster-catching RPG.
  const zoom = 1.5;
  ctx.save();
  ctx.translate(Math.round(W / 2 - (px + TS / 2) * zoom), Math.round(H / 2 - (py + TS / 2) * zoom));
  ctx.scale(zoom, zoom);
  const left = Math.max(0, Math.floor((px - W / zoom / 2) / TS) - 2);
  const right = Math.min(19, Math.ceil((px + W / zoom / 2) / TS) + 2);
  const top = Math.max(0, Math.floor((py - H / zoom / 2) / TS) - 2);
  const bottom = Math.min(14, Math.ceil((py + H / zoom / 2) / TS) + 2);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) drawTile(md.rows[y][x], x * TS, y * TS, x, y);
  }
  drawForestCanopies(top - 2, bottom + 1);
  for (const n of NPCS[S.map]) {
    if (npcAt(n.x, n.y)) {
      const role = n.id === 'mimi' ? 'mimi'
        : n.id === 'lumi' || n.id === 'lumi2' ? 'shy'
        : (n.meridian || n.boss) ? 'meridian'
        : n.champion ? 'gymLeader'
        : n.eliteFour ? 'gymLeader'
        : n.trainer ? 'trainer' : 'villager';
      drawPerson(n.x * TS, n.y * TS, n.c, 'down', role);
    }
  }
  // Tessa steps up beside the player for the first Ombra Woods story scene.
  if (teamArrival && S.map === 'whisperwood') {
    const sideX = Math.min(18, S.x + (S.x < 16 ? 1 : -1));
    drawPerson(sideX * TS, (S.y + 0.15) * TS, '#d96d78', 'left', 'mimi');
  }
  if (S.party.length) {
    const follower = S.party[0];
    let fx = px + 2, fy = py + 2;
    if (S.dir === 'up') fy += 11;
    if (S.dir === 'down') fy -= 11;
    if (S.dir === 'left') fx += 11;
    if (S.dir === 'right') fx -= 11;
    drawMal(follower.name, fx, fy, 12, 12, undefined, null, !!follower.shiny);
  }
  drawPerson(px, py, S.look, S.dir, 'player');
  ctx.restore();
  ctx.fillStyle = '#101b2cdd';
  ctx.fillRect(0, 0, 116, 17);
  ctx.fillStyle = '#e6edf0';
  ctx.fillRect(0, 16, 116, 1);
  text(md.name.toUpperCase() + (S.flags.chapter1 ? '  *' : ''), 6, 11, '#fff', 8);
  drawAreaTitleCard();
}
function text(s, x, y, c = '#222', size = 8) {
  ctx.fillStyle = c;
  ctx.font = `bold ${Math.max(9, Math.round(size * 1.45))}px "Pixelify Sans", Arial, sans-serif`;
  ctx.textRendering = 'geometricPrecision';
  ctx.fillText(s, x, y);
}
function hpRatio(m) {
  const current = Number(m?.cur);
  const maximum = Number(m?.maxhp);
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, current / maximum));
}
function hpBar(m, x, y, showXp = false) {
  const boxH = showXp ? 38 : 30;
  ctx.fillStyle = '#182638';
  ctx.fillRect(x + 2, y + 2, 120, boxH);
  ctx.fillStyle = '#fff9e9';
  ctx.fillRect(x, y, 120, boxH);
  ctx.strokeStyle = '#314d60';
  ctx.strokeRect(x + 0.5, y + 0.5, 119, boxH - 1);
  text(`${malName(m)}  Lv${m.lv}`, x + 5, y + 10, '#24384b');
  const r = Math.max(0, Math.min(1, m.cur / Math.max(1, m.maxhp)));
  ctx.fillStyle = '#364451';
  ctx.fillRect(x + 5, y + 15, 108, 6);
  ctx.fillStyle = r > 0.5 ? '#60b96b' : r > 0.2 ? '#e8b943' : '#db6861';
  ctx.fillRect(x + 5, y + 15, 108 * r, 6);
  ctx.fillStyle = '#526276';
  ctx.fillRect(x + 5, y + 15, 108 * r, 1);
  text(`${m.cur} / ${m.maxhp} HP`, x + 5, y + 28, '#526276', 7);
  if (showXp) {
    const xpProgress = Math.max(0, Math.min(1, m.xp / xpNeed(m.lv)));
    ctx.fillStyle = '#34445b';
    ctx.fillRect(x + 5, y + 32, 108, 3);
    ctx.fillStyle = '#55a9f5';
    ctx.fillRect(x + 5, y + 32, 108 * xpProgress, 3);
  }
}
function drawBattleStatus(mal, x, y, width, isPlayer = false) {
  const height = isPlayer ? 47 : 39;
  ctx.fillStyle = '#263e4b'; ctx.fillRect(x + 2, y + 2, width, height);
  ctx.fillStyle = '#f3efd9'; ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#4c6870'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x + 3, y + 3, width - 6, height - 6);
  text(malName(mal).toUpperCase().slice(0, 14), x + 7, y + 13, '#273c4a', 8);
  text(`Lv${mal.lv}`, x + width - 33, y + 13, '#273c4a', 7);
  ctx.fillStyle = '#475b62'; ctx.fillRect(x + 7, y + 19, width - 14, 6);
  const ratio = Math.max(0, Math.min(1, mal.cur / Math.max(1, mal.maxhp)));
  ctx.fillStyle = ratio > .5 ? '#62b673' : ratio > .2 ? '#e2b74b' : '#d86e63';
  ctx.fillRect(x + 8, y + 20, (width - 16) * ratio, 4);
  text('HP', x + 7, y + 34, '#52676b', 6);
  text(`${mal.cur}/${mal.maxhp}`, x + width - 49, y + 34, '#52676b', 6);
  if (isPlayer) {
    const xp = Math.max(0, Math.min(1, (mal.xp || 0) / xpNeed(mal.lv)));
    ctx.fillStyle = '#587082'; ctx.fillRect(x + 7, y + 39, width - 14, 3);
    ctx.fillStyle = '#55a8ec'; ctx.fillRect(x + 7, y + 39, (width - 14) * xp, 3);
  }
}

function drawBattle() {
  // layered sky, far ridge, and pixel vegetation create depth without smoothing.
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#8bc7e2'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b8dfeb'; ctx.fillRect(0, 54, W, 42);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 103 + Math.floor(frame * 0.12)) % (W + 54)) - 35;
    const y = 23 + (i % 2) * 23;
    ctx.fillStyle = '#e9f4e7';
    ctx.fillRect(x + 7, y, 20, 4); ctx.fillRect(x, y + 4, 33, 5); ctx.fillRect(x + 5, y + 9, 24, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 9, y + 1, 12, 2);
  }
  ctx.fillStyle = '#79b09b';
  ctx.beginPath(); ctx.moveTo(0,118); ctx.lineTo(35,88); ctx.lineTo(72,113); ctx.lineTo(111,84); ctx.lineTo(153,116); ctx.lineTo(206,91); ctx.lineTo(255,116); ctx.lineTo(292,95); ctx.lineTo(320,111); ctx.lineTo(320,145); ctx.lineTo(0,145); ctx.fill();
  ctx.fillStyle = '#4d8b66';
  for (let i = 0; i < 18; i++) {
    const x = i * 19 - 2, y = 112 + (i % 3) * 6;
    ctx.fillRect(x + 5, y - 13, 4, 17); ctx.fillRect(x + 1, y - 7, 12, 8); ctx.fillRect(x + 3, y - 12, 8, 7);
  }
  ctx.fillStyle = '#6ca45e'; ctx.fillRect(0, 139, W, 101);
  ctx.fillStyle = '#91bf71'; ctx.fillRect(0, 139, W, 4);
  for (let i = 0; i < 48; i++) {
    const x = (i * 43 + 17) % W, y = 147 + (i * 31) % 86;
    ctx.fillStyle = i % 3 ? '#4f8d52' : '#b0d17b';
    ctx.fillRect(x, y, 2, 3); ctx.fillRect(x + 2, y + 1, 2, 2);
  }
  // opponent's upper platform and player's larger foreground platform
  ctx.fillStyle = '#3e7651'; ctx.fillRect(181, 116, 107, 7); ctx.fillRect(190, 111, 90, 5);
  ctx.fillStyle = '#a4cb77'; ctx.fillRect(188, 109, 91, 5); ctx.fillRect(199, 106, 70, 3);
  ctx.fillStyle = '#d3e39a'; ctx.fillRect(207, 107, 54, 2);
  ctx.fillStyle = '#346d4c'; ctx.fillRect(12, 194, 148, 8); ctx.fillRect(22, 186, 128, 8);
  ctx.fillStyle = '#9fc96f'; ctx.fillRect(18, 184, 132, 6); ctx.fillRect(30, 183, 94, 2);
  ctx.fillStyle = '#d0e18e'; ctx.fillRect(42, 184, 71, 1);

  if (B.entered !== undefined && frame - B.entered < 24) {
    const alpha = 0.22 * (1 - (frame - B.entered) / 24);
    ctx.fillStyle = `rgba(255,255,240,${alpha})`; ctx.fillRect(0, 0, W, H);
  }
  if (B.shake) B.shake *= -0.78;
  if (Math.abs(B.shake) < 0.45) B.shake = 0;
  const introAge = B.intro ? frame - B.intro.start : 999;
  if (B.trainer && introAge < 72) {
    const avatarAlpha = Math.max(0, 1 - introAge / 72);
    ctx.save();
    ctx.globalAlpha = avatarAlpha;
    ctx.translate(246, 50);
    ctx.scale(2.05, 2.05);
    drawPerson(0, 0, B.trainer.name.includes('Tink') ? '#606070' : '#d18b68', 'left', 'trainer');
    ctx.restore();
    ctx.fillStyle = `rgba(17, 26, 38, ${Math.max(0, 0.82 - introAge / 55)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f4f1df';
    ctx.fillRect(18, 84, 284, 56);
    ctx.fillStyle = '#1b2938';
    ctx.fillRect(22, 88, 276, 48);
    ctx.fillStyle = '#f7f0d6';
    ctx.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(B.trainer.name.toUpperCase(), 160, 105, 260);
    ctx.font = 'bold 12px "Pixelify Sans", Arial, sans-serif';
    ctx.fillText('CHALLENGES YOU!', 160, 124, 260);
    ctx.textAlign = 'left';
  } else if (!B.trainer && introAge < 56) {
    const alpha = Math.max(0, 0.72 * (1 - introAge / 56));
    ctx.fillStyle = `rgba(255,255,245,${alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(25, 39, 48, ${Math.max(0, 0.84 - introAge / 64)})`;
    ctx.fillRect(0, 87, W, 44);
    ctx.fillStyle = '#f9f4df';
    ctx.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A WILD POCKETMAL APPEARED!', 160, 105, 306);
    ctx.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    ctx.fillText(malName(B.foe).toUpperCase(), 160, 120, 270);
    ctx.textAlign = 'left';
    for (let i = 0; i < 8; i++) {
      const sx = (i * 47 + frame * 9) % 350 - 15;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(sx, 137 + (i % 3) * 24, 13, 2);
    }
  }
  if (B.foe.cur > 0 && !B.ball) drawMal(B.foe.name, 203 + (B.shake > 0 ? B.shake : 0), 42, 70, 70, Math.floor(frame / 5) % 8, 'foe', !!B.foe.shiny);
  if (B.ball) {
    const cx = 237, cy = 111, angle = Math.sin(frame / 2 + B.ball.shake * Math.PI) * (B.ball.shake + 1) * 0.09;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.fillStyle = '#273a4b'; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#e7645a'; ctx.fillRect(-8, -8, 16, 8);
    ctx.fillStyle = '#f7f0dc'; ctx.fillRect(-8, 1, 16, 7);
    ctx.fillStyle = '#273a4b'; ctx.fillRect(-9, -1, 18, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#273a4b'; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  if (B.me.cur > 0) drawMal(B.me.name, 33 + (B.shake < 0 ? B.shake : 0), 99, 87, 87, Math.floor(frame / 5 + 3) % 8, 'me', !!B.me.shiny);

  if (B.action) {
    const colors = {
      normal:'#d0c4aa', fire:'#ff9a42', water:'#74dcf5', grass:'#8cdb64', electric:'#fff27a',
      ice:'#b8f5ff', fighting:'#f07b67', poison:'#d998de', ground:'#d5b16b', flying:'#d9fff4',
      psychic:'#ed9bf5', bug:'#c2d76d', rock:'#c8a77b', ghost:'#ab98dd', dragon:'#8d83f5',
      steel:'#bdc9d6', dark:'#8e7883', fairy:'#f6b6d0',
    };
    const targetX = B.action.side === 'me' ? 234 : 93;
    const targetY = B.action.side === 'me' ? 81 : 157;
    const progress = Math.min(1, (frame - B.action.started) / 16);
    for (let i = 0; i < 12; i++) {
      const angle = frame * 0.2 + i * Math.PI * 2 / 12;
      const radius = 8 + progress * 19 + (i % 3) * 3;
      const x = Math.round(targetX + Math.cos(angle) * radius);
      const y = Math.round(targetY + Math.sin(angle) * radius * .65);
      ctx.fillStyle = i % 3 === 0 ? '#fff8d6' : colors[B.action.type] || '#fff';
      ctx.fillRect(x, y, i % 2 ? 3 : 4, i % 2 ? 3 : 4);
    }
  }
  drawBattleStatus(B.foe, 9, 9, 143, false);
  drawBattleStatus(B.me, 168, 145, 143, true);
}

function drawUI() {
  if (!ui) return;
  if (mode === 'battle' && ui.kind === 'choose') return;
  if (ui.kind === 'say') {
    // Classic handheld message box: ivory panel, dual border, dark ink text.
    const style = { fill: '#f7f3e4', border: '#2f4a56', highlight: '#ffffff', shadow: '#1a2c35', text: '#1e2f3a', cursor: '#2f6577' };
    ctx.fillStyle = style.shadow;
    ctx.fillRect(6, 166, W - 8, 70);
    ctx.fillStyle = style.fill;
    ctx.fillRect(4, 164, W - 8, 70);
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.border;
    ctx.strokeRect(5.5, 165.5, W - 11, 67);
    ctx.lineWidth = 1;
    ctx.strokeStyle = style.highlight;
    ctx.strokeRect(8.5, 168.5, W - 17, 61);
    // corner accents like DS dialogue chrome
    ctx.fillStyle = '#c5d8de';
    ctx.fillRect(8, 168, 6, 6);
    ctx.fillRect(W - 14, 168, 6, 6);
    ctx.fillRect(8, 226, 6, 6);
    ctx.fillRect(W - 14, 226, 6, 6);
    const hasProfessorPortrait = /^PROFESSOR LOTUS:/i.test(ui.text);
    const visibleText = ui.text.slice(0, ui.revealed);
    wrap(visibleText, 14, 188, style.text, hasProfessorPortrait ? 236 : 282);
    if (hasProfessorPortrait) {
      ctx.fillStyle = '#d9e7df';
      ctx.fillRect(264, 170, 47, 62);
      ctx.strokeStyle = '#526f79';
      ctx.lineWidth = 2;
      ctx.strokeRect(264.5, 170.5, 46, 61);
      ctx.fillStyle = '#2f6577';
      ctx.fillRect(266, 172, 43, 9);
      text('PROF. LOTUS', 268, 180, '#fff3d4', 5);
      ctx.save();
      ctx.translate(269, 181);
      ctx.scale(1.6, 1.6);
      drawPerson(8, 10, '#f4f0df', 'down', 'professor', 'gesture');
      ctx.restore();
    }
    if (ui.revealed >= ui.text.length && frame % 40 < 20) {
      const bob = Math.sin(frame * 0.22) * 1.5;
      text('▼', W - 18, 229 + bob, style.cursor);
    }
  } else {
    const n = ui.items.length, vis = Math.min(n, 9);
    const start = Math.max(0, Math.min(ui.idx - 4, n - vis));
    const h = vis * 14 + (ui.title ? 18 : 6);
    const x = W - 186, y = H - h - 4;
    ctx.fillStyle = '#1a2c35';
    ctx.fillRect(x + 2, y + 2, 182, h);
    ctx.fillStyle = '#fbf8ee';
    ctx.fillRect(x, y, 182, h);
    ctx.strokeStyle = '#2f4a56';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, 181, h - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x + 2.5, y + 2.5, 177, h - 5);
    let yy = y + 12;
    if (ui.title) {
      text(ui.title.slice(0, 32), x + 6, yy, '#2f6577');
      yy += 12;
    }
    for (let i = start; i < start + vis; i++) {
      const selectedBob = i === ui.idx ? Math.sin(frame * 0.18) * 1.6 : 0;
      text((i === ui.idx ? '▶ ' : '  ') + ui.items[i], x + 6, yy + 2 + selectedBob);
      yy += 14;
    }
    if (ui.title && (ui.title.toLowerCase().includes('mal') || ui.title.toLowerCase().includes('swap with') || ui.title.toLowerCase().includes('use on')) && S?.party?.[ui.idx]) {
      const chosen = S.party[ui.idx];
      const bob = Math.sin(frame * 0.18) * 2.2;
      const px = Math.max(6, x - 44), py = Math.max(40, Math.min(190, y + 22));
      ctx.fillStyle = '#f1ead4';
      ctx.fillRect(px, py, 38, 38);
      ctx.strokeStyle = '#677f8b';
      ctx.strokeRect(px + 0.5, py + 0.5, 37, 37);
      ctx.drawImage(malSprite(chosen.name, Math.floor(frame / 6) % 8, 'front', !!chosen.shiny), px + 2, py + 2 + bob, 34, 34);
    }
  }
}
function wrap(s, x, y, color = '#fffdf3', maxWidth = 282) {
  const maxLines = 3;
  const makeLines = (fontSize) => {
    ctx.font = `bold ${fontSize}px "Pixelify Sans", Arial, sans-serif`;
    const words = String(s).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  let fontSize = 12;
  let lines = makeLines(fontSize);
  while (lines.length > maxLines && fontSize > 9) {
    fontSize -= 0.5;
    lines = makeLines(fontSize);
  }
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px "Pixelify Sans", Arial, sans-serif`;
  ctx.textRendering = 'geometricPrecision';
  ctx.textBaseline = 'alphabetic';
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * 15, maxWidth);
  });
}
function drawPixelCloud(x, y) {
  ctx.fillStyle = '#6c9fb4';
  ctx.fillRect(Math.round(x + 4), Math.round(y + 5), 22, 8);
  ctx.fillRect(Math.round(x + 9), Math.round(y + 1), 14, 12);
  ctx.fillRect(Math.round(x + 1), Math.round(y + 7), 7, 5);
  ctx.fillStyle = '#f2f8ec';
  ctx.fillRect(Math.round(x + 7), Math.round(y + 3), 14, 5);
  ctx.fillRect(Math.round(x + 4), Math.round(y + 7), 7, 3);
}

function getTitleSaveProfile() {
  if (S) return S;
  if (!hasValidSave()) return null;
  if (!titleSaveProfileLoaded) {
    const raw = readStoredSaveRaw();
    if (!raw) return null;
    try {
      titleSaveProfile = parseSaveText(raw);
      titleSaveProfileLoaded = true;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      console.error('Could not read the saved Pocketmals profile.', error);
      return null;
    }
  }
  return titleSaveProfile;
}

function drawTitle() {
  // Layered 16-bit title artwork: distant mountains, town roofline, forest and river.
  const sky = ctx.createLinearGradient(0, 0, 0, 180);
  sky.addColorStop(0, '#5e9fc4'); sky.addColorStop(0.58, '#a9d5dc'); sky.addColorStop(1, '#e8dfb8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    const x = (i * 82 - 20 + Math.sin(frame / 80 + i) * 3);
    drawPixelCloud(x, 37 + (i % 2) * 20);
  }
  ctx.fillStyle = '#759eab';
  ctx.beginPath(); ctx.moveTo(0, 131); ctx.lineTo(36, 78); ctx.lineTo(72, 122); ctx.lineTo(122, 65); ctx.lineTo(171, 128); ctx.lineTo(223, 78); ctx.lineTo(270, 124); ctx.lineTo(303, 83); ctx.lineTo(320, 111); ctx.lineTo(320, 175); ctx.lineTo(0, 175); ctx.fill();
  ctx.fillStyle = '#568c70'; ctx.fillRect(0, 143, W, 97);
  ctx.fillStyle = '#3f765c';
  for (let i = 0; i < 17; i++) {
    const x = i * 20 - 4;
    ctx.fillRect(x + 6, 129 - (i % 3) * 6, 5, 25);
    ctx.fillRect(x, 119 - (i % 3) * 6, 17, 18);
    ctx.fillRect(x + 3, 112 - (i % 3) * 6, 11, 12);
  }
  // town roofs peeking between the trees
  ctx.fillStyle = '#e7d5b5'; ctx.fillRect(15, 142, 49, 22); ctx.fillRect(244, 139, 59, 26);
  ctx.fillStyle = '#b86e64'; ctx.beginPath(); ctx.moveTo(10, 146); ctx.lineTo(39, 126); ctx.lineTo(69, 146); ctx.fill();
  ctx.fillStyle = '#678da5'; ctx.beginPath(); ctx.moveTo(238, 143); ctx.lineTo(273, 119); ctx.lineTo(309, 143); ctx.fill();
  // path leads from the player's feet to the region
  ctx.fillStyle = '#d6bd88'; ctx.beginPath(); ctx.moveTo(116, 240); ctx.lineTo(145, 163); ctx.lineTo(180, 163); ctx.lineTo(218, 240); ctx.fill();
  ctx.fillStyle = '#e9d5a5'; ctx.fillRect(151, 168, 17, 72);
  // starter trio on the foreground ridge
  drawMal(STARTER_NAMES[0], 39, 142 + Math.sin(frame / 18) * 2, 44, 44, Math.floor(frame / 7) % 8);
  drawMal(STARTER_NAMES[1], 136, 132 + Math.sin(frame / 18 + 1) * 2, 48, 48, Math.floor(frame / 7 + 2) % 8);
  drawMal(STARTER_NAMES[2], 235, 142 + Math.sin(frame / 18 + 2) * 2, 44, 44, Math.floor(frame / 7 + 4) % 8);
  ctx.fillStyle = '#18364b';
  ctx.fillRect(0, 192, W, 48);

  ctx.fillStyle = '#f8edcc';
  ctx.fillRect(43, 17, 234, 43);
  ctx.strokeStyle = '#355368';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 18, 232, 41);
  ctx.fillStyle = '#355368';
  ctx.font = 'bold 29px "Pixelify Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POCKETMALS', 160, 47);
  ctx.textAlign = 'left';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f8edcc'; ctx.fillRect(52, 63, 216, 13);

}

function drawOpening() {
  const elapsed = Math.max(0, frame - openingStartedAt);
  const sceneLength = 210;
  const scene = Math.min(3, Math.floor(elapsed / sceneLength));
  const sceneFrame = elapsed % sceneLength;
  const sceneFade = Math.max(0, 1 - Math.min(sceneFrame, sceneLength - sceneFrame) / 24);
  ctx.fillStyle = '#142a40'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  // A restrained camera drift keeps the establishing shots alive between cuts.
  const cameraDrift = Math.sin(elapsed / 86) * 4 + Math.sin(elapsed / 173) * 2;
  ctx.translate(cameraDrift, Math.sin(elapsed / 120) * 1.5);

  if (scene === 0) {
    // Wide establishing shot of Mellora.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5c9cc1'); sky.addColorStop(1, '#dce5c5');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawPixelCloud(38, 32); drawPixelCloud(218, 55);
    ctx.fillStyle = '#709baa'; ctx.beginPath(); ctx.moveTo(0,130); ctx.lineTo(40,77); ctx.lineTo(81,124); ctx.lineTo(134,63); ctx.lineTo(185,126); ctx.lineTo(240,76); ctx.lineTo(320,130); ctx.lineTo(320,180); ctx.lineTo(0,180); ctx.fill();
    ctx.fillStyle = '#4d8a69'; ctx.fillRect(0, 139, W, 101);
    ctx.fillStyle = '#367357';
    for (let i=0;i<16;i++) { const x=i*21; ctx.fillRect(x+7,123-(i%3)*5,5,22); ctx.fillRect(x,112-(i%3)*5,19,18); }
    ctx.fillStyle = '#72a9c3'; ctx.beginPath(); ctx.moveTo(0,195); ctx.lineTo(92,173); ctx.lineTo(146,192); ctx.lineTo(227,161); ctx.lineTo(320,189); ctx.lineTo(320,240); ctx.lineTo(0,240); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const birdX = (i * 73 + frame * 0.3) % 360 - 20;
      const birdY = 76 + Math.sin(frame / 16 + i) * 5;
      ctx.fillStyle = '#f2f1d8';
      ctx.fillRect(birdX, birdY, 5, 2);
      ctx.fillRect(birdX + 2, birdY - 2 - Math.abs(Math.sin(frame / 4 + i)) * 2, 2, 3);
    }
  } else if (scene === 1) {
    ctx.fillStyle = '#8bc5dc'; ctx.fillRect(0,0,W,132);
    ctx.fillStyle = '#9dcb81'; ctx.fillRect(0,132,W,108);
    ctx.fillStyle = '#5b9b61'; ctx.fillRect(0,154,W,86);
    for (let i=0;i<15;i++) {
      const x=i*23;
      ctx.fillStyle='#376f4b'; ctx.fillRect(x+7,107-(i%3)*8,5,40); ctx.fillRect(x,94-(i%3)*8,20,22);
    }
    drawMal(STARTER_NAMES[0], 30, 95, 58, 58, Math.floor(frame/7)%8);
    drawMal(STARTER_NAMES[1], 129, 86, 66, 66, Math.floor(frame/7+2)%8);
    drawMal(STARTER_NAMES[2], 238, 95, 58, 58, Math.floor(frame/7+4)%8);
    const leafDrift = frame % 340;
    ctx.fillStyle = '#e8d991';
    ctx.fillRect((leafDrift + 28) % 340 - 10, 112 + Math.sin(frame / 8) * 7, 3, 5);
    ctx.fillStyle = '#cde79c';
    ctx.fillRect((leafDrift + 177) % 340 - 10, 136 + Math.sin(frame / 11) * 5, 4, 3);
  } else if (scene === 2) {
    ctx.fillStyle = '#d4e5d6'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#8fb8b0'; ctx.fillRect(0,118,W,122);
    ctx.fillStyle = '#6f9d83'; ctx.fillRect(0,143,W,97);
    ctx.fillStyle = '#f0e2bd'; ctx.fillRect(20,95,280,62);
    ctx.fillStyle = '#6b8fa1'; ctx.fillRect(15,86,290,17);
    ctx.fillStyle = '#496f7d'; ctx.fillRect(27,108,266,8);
    drawPerson(80, 103, '#f4f0df', 'down', 'professor', 'gesture');
    drawPerson(235, 135, '#d96d78', 'down', 'mimi', 'wave');
    drawMal(STARTER_NAMES[0], 38, 148 + Math.sin(frame / 12) * 3, 42, 42, Math.floor(frame / 5) % 8);
    drawMal(STARTER_NAMES[1], 136, 136 + Math.sin(frame / 15 + 1) * 4, 48, 48, Math.floor(frame / 6 + 2) % 8);
    drawMal(STARTER_NAMES[2], 238, 148 + Math.sin(frame / 11 + 2) * 3, 42, 42, Math.floor(frame / 5 + 4) % 8);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#152746');
    sky.addColorStop(1, '#5d6e91');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d6d5bd';
    ctx.fillRect(0, 160, W, 80);
    ctx.fillStyle = '#7b8d91';
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(i * 42 - 12, 144 - (i % 3) * 9, 29, 96);
      ctx.fillRect(i * 42 - 19, 151 - (i % 3) * 9, 14, 56);
    }
    // Original legendary reveal: a readable, layered silhouette with a crest,
    // sweeping mantle, glowing core, and animated atmospheric rings.
    const pulse = 0.5 + Math.sin(frame / 9) * 0.12;
    const drift = Math.sin(frame / 24) * 3;
    ctx.save();
    ctx.translate(160, 105 + drift);
    ctx.strokeStyle = `rgba(155, 235, 241, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 5, 53 + Math.sin(frame / 11) * 4, 34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 5, 68, 19 + Math.sin(frame / 13) * 3, 0, 0, Math.PI * 2); ctx.stroke();
    // tail / flowing mantle
    ctx.fillStyle = '#162a49';
    ctx.beginPath();
    ctx.moveTo(-13, 21); ctx.lineTo(-46, 39); ctx.lineTo(-75, 29);
    ctx.lineTo(-53, 15); ctx.lineTo(-70, -2); ctx.lineTo(-39, 5);
    ctx.lineTo(-30, -20); ctx.lineTo(-13, -10); ctx.closePath(); ctx.fill();
    // body and angular shoulder fins
    ctx.beginPath();
    ctx.moveTo(0, -39); ctx.lineTo(13, -20); ctx.lineTo(34, -27);
    ctx.lineTo(25, -7); ctx.lineTo(39, 8); ctx.lineTo(19, 13);
    ctx.lineTo(12, 37); ctx.lineTo(0, 27); ctx.lineTo(-12, 37);
    ctx.lineTo(-19, 13); ctx.lineTo(-39, 8); ctx.lineTo(-25, -7);
    ctx.lineTo(-34, -27); ctx.lineTo(-13, -20); ctx.closePath(); ctx.fill();
    // crown-like antlers and luminous markings
    ctx.fillStyle = '#213d63';
    ctx.beginPath(); ctx.moveTo(-10,-29); ctx.lineTo(-24,-51); ctx.lineTo(-19,-26);
    ctx.lineTo(0,-44); ctx.lineTo(19,-26); ctx.lineTo(24,-51); ctx.lineTo(10,-29); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a6fff1';
    ctx.fillRect(-15, -4, 7, 3); ctx.fillRect(8, -4, 7, 3);
    ctx.fillRect(-3, 10, 6, 8);
    ctx.fillStyle = `rgba(184,255,244,${pulse})`;
    ctx.beginPath(); ctx.arc(0, 3, 8 + Math.sin(frame / 8) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

  }
  ctx.restore();

  // Short dissolves join the four visual beats into one continuous sequence.
  if (sceneFade > 0) {
    ctx.fillStyle = `rgba(9, 22, 37, ${sceneFade * 0.72})`;
    ctx.fillRect(0, 0, W, H);
  }
  // The opening is visual/audio only; no captions or on-screen instructions.

}
function playOpening(returnMode = 'title') {
  openingIndex = 0;
  openingStartedAt = frame;
  openingReturnMode = returnMode;
  mode = 'opening';
  sfx.opening();
  return returnMode === 'title' ? null : new Promise((resolve) => { finishOpening = resolve; });
}
function finishOpeningSequence() {
  mode = openingReturnMode;
  flash = Math.max(flash, 0.82);
  titleSel = 0;
  const resolve = finishOpening;
  finishOpening = null;
  if (resolve) resolve();
}

async function startNew() {
  mode = 'select';
  if (hasValidSave()) {
    const firstConfirm = await choose(['Yes, start over', 'No, keep my save'], 'Start a new game?');
    if (firstConfirm !== 0) { mode = 'title'; return; }
    const finalConfirm = await choose(['Yes, erase save', 'No, go back'], 'This replaces your saved game. Continue?');
    if (finalConfirm !== 0) { mode = 'title'; return; }
  }
  await playOpening('select');
  let gender = -1;
  while (gender < 0) gender = await choose(['Boy', 'Girl'], 'Choose your trainer');
  const name = await askTrainerName();

  // Start a new save without the forced Professor Lotus introduction/cutscene.
  newGame(gender === 0 ? 'boy' : 'girl', name || 'Trainer');
  S.room = null;
  S.map = 'pocketown';
  S.x = 9;
  S.y = 12;
  S.dir = 'up';
  moving = null;
  flash = 0.75;
  mode = 'world';
  await pip(); // Starter selection remains a normal gameplay menu.
  locationCard = { name: MAPS.pocketown.name, start: frame };
  save();
}

function update() {
  frame++;
  if (starterReveal && frame - starterReveal.start > 120) starterReveal = null;
  const k = pressed;
  pressed = null;
  if (mode === 'opening') {
    if (k === 'a' || k === 'start') {
      sfx.ok();
      finishOpeningSequence();
      return;
    }
    if (frame - openingStartedAt >= 840) finishOpeningSequence();
    return;
  }
  if (ui) {
    if (ui.kind === 'say') {
      const framesPerCharacter = [4, 2, 1][gameSettings.textSpeed];
      const revealTo = Math.min(ui.text.length, Math.floor((frame - ui.started) / framesPerCharacter));
      while (ui.revealed < revealTo) {
        sfx.typeTick(ui.revealed);
        ui.revealed++;
      }
      const promptCycle = Math.floor(frame / 80);
      if (ui.revealed >= ui.text.length && promptCycle > ui.lastPromptCycle) {
        sfx.prompt();
        ui.lastPromptCycle = promptCycle;
      }
    }
    if (k) handleUI(k);
    return;
  }
  if (mode === 'title') {
    const choices = titleChoices();
    if (titleSel >= choices.length) titleSel = 0;
    if (k === 'up' || k === 'down') {
      const dir = k === 'up' ? -1 : 1;
      titleSel = (titleSel + dir + choices.length) % choices.length;
      sfx.menu();
    }
    if (k === 'select') {
      titleSel = (titleSel + 1) % choices.length;
      sfx.menu();
    }
    if (k === 'b') { playOpening('title'); return; }
    if (k === 'a' || k === 'start') {
      const choice = choices[titleSel];
      if (!choice) return;
      if (choice.id === 'continue' && load()) mode = 'world';
      else if (choice.id === 'new') startNew().catch(showGameFailure);
      else if (choice.id === 'import') promptImportSave();
      else if (choice.id === 'export') exportSaveFile();
    }
    return;
  }
  if (mode === 'intro') return;
  if (mode === 'menu') {
    if (k) handleMenuKey(k);
    return;
  }
  if (mode !== 'world') return;
  if (k === 'start') return void pauseMenu();
  if (k === 'select') return void openQuickMenu('world');
  if (k === 'run') {
    if (S.flags.runningShoes) S.flags.running = !S.flags.running;
    return;
  }
  if (moving) {
    const stepSpeed = S.flags.bicycle && S.flags.bikeOn ? 0.5 : (S.flags.runningShoes && (S.flags.running || keys.run) ? 0.25 : 0.125);
    moving.t += stepSpeed;
    if (moving.t >= 1) {
      moving = null;
      afterStep().catch(showGameFailure);
    }
    return;
  }
  if (k === 'a') return void interact().catch(showGameFailure);
  if (k === 'b' || k === 'x') return void pauseMenu();
  for (const d of ['up', 'down', 'left', 'right']) {
    if (keys[d] || k === d) {
      const moveAction = tryMove(d);
      if (moveAction && typeof moveAction.catch === 'function') moveAction.catch(showGameFailure);
      break;
    }
  }
}
function render() {
  ctx.imageSmoothingEnabled = false;
  if (mode === 'opening') drawOpening();
  else if (mode === 'title' || mode === 'select') drawTitle();
  else if (mode === 'battle' && B) drawBattle();
  else if (mode === 'intro' && (introScene === 'bedroom' || introScene === 'town')) drawIntroRoom();
  else if (mode === 'intro' && S.room) drawRoom();
  else drawWorld();
  if (flash > 0) {
    ctx.fillStyle = `rgba(0,0,0,${flash})`;
    ctx.fillRect(0, 0, W, H);
    flash -= 0.05;
  }
  drawUI();
  drawLowerScreen();
}
// ============================================================
// POCKETMALS FIELD UPDATE: SHINIES, KEY ITEMS, QUICK MENU, SFX
// ============================================================

// The charm improves the standard shiny rate from 1/1,024 to 1/256.
const POCKETMALS_SHINY_ODDS = 1024;
function pocketmalShinyOdds() {
  return S?.bag?.['Shiny Charm'] > 0 ? 256 : POCKETMALS_SHINY_ODDS;
}
let activeMoveTypeForSfx = 'normal';
let shinyRenderContext = false;
const shinySpriteCache = {};
let quickState = null;
let quickReturnMode = 'world';
let bicycleStepCount = 0;

// Additional original, synthesized effects. No external audio samples are used.
function sfxNotes(notes, waveform = 'square', gap = 0.055, volume = 0.024) {
  if (!actx || !gameSettings.soundEffects) return;
  const start = actx.currentTime + 0.012;
  notes.forEach((note, index) => {
    if (Array.isArray(note)) {
      beep(note[0], note[1] ?? 0.075, note[2] || waveform, note[3] ?? volume, start + index * gap);
    } else {
      beep(note, 0.075, waveform, volume, start + index * gap);
    }
  });
}

Object.assign(sfx, {
  opening: () => sfxNotes([[392, 0.11, 'sine', 0.016], [587, 0.13, 'triangle', 0.018], [784, 0.19, 'sine', 0.016]], 'triangle', 0.085, 0.016),
  openingStep: () => sfxNotes([[659, 0.055, 'triangle', 0.012], [880, 0.075, 'sine', 0.012]], 'triangle', 0.045, 0.012),
  ok: () => sfxNotes([880, 1175], 'square', 0.045, 0.018),
  menu: () => sfxNotes([740, 988], 'triangle', 0.04, 0.018),
  release: () => sfxNotes([[392, 0.07, 'sine', 0.025], [784, 0.09, 'triangle', 0.03], [1175, 0.12, 'sine', 0.025]], 'triangle', 0.045, 0.02),
  bump: () => sfxNotes([[220, 0.045, 'sine', 0.006]], 'sine', 0.04, 0.006),
  pickup: () => sfxNotes([659, 784, 988], 'triangle', 0.065, 0.026),
  itemGet: () => sfxNotes([523, 659, 784, 1047, 1318], 'triangle', 0.075, 0.03),
  shiny: () => sfxNotes([784, 988, 1175, 1568, 1760], 'sine', 0.07, 0.031),
  bicycle: () => sfxNotes([[1320, 0.07, 'sine', 0.025], [1760, 0.09, 'sine', 0.018]], 'sine', 0.065, 0.02),
  bikeStep: () => {
    bicycleStepCount++;
    if (bicycleStepCount % 3 === 0) sfxNotes([[880, 0.035, 'triangle', 0.008], [660, 0.035, 'triangle', 0.006]], 'triangle', 0.03, 0.008);
  },
  levelUp: () => sfxNotes([523, 659, 784, 1047, 1318], 'square', 0.07, 0.025),
  typeTick: (index) => {
    if (!actx || !gameSettings.soundEffects || index % 3 !== 0) return;
    const when = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560 + (index % 5) * 24, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.0025, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.018);
    osc.connect(gain).connect(actx.destination);
    osc.start(when);
    osc.stop(when + 0.02);
  },
  prompt: () => {
    if (!actx || !gameSettings.soundEffects) return;
    const when = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, when);
    osc.frequency.exponentialRampToValueAtTime(350, when + 0.075);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.01, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    osc.connect(gain).connect(actx.destination);
    osc.start(when);
    osc.stop(when + 0.11);
  },
  hit: () => {
    const roots = {
      normal: 440, fire: 330, water: 520, grass: 740, electric: 1245, ice: 987, fighting: 392,
      poison: 587, ground: 220, flying: 880, psychic: 1046, bug: 784, rock: 196, ghost: 659,
      dragon: 523, steel: 294, dark: 349, fairy: 1175,
    };
    const root = roots[activeMoveTypeForSfx] || 440;
    beep(root, 0.075, activeMoveTypeForSfx === 'rock' || activeMoveTypeForSfx === 'ground' ? 'triangle' : 'square', 0.025);
    beep(root * 0.72, 0.095, 'triangle', 0.018, actx ? actx.currentTime + 0.035 : undefined);
    if (actx && gameSettings.soundEffects) {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(root * 1.7, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(65, root * 0.42), actx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.013, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.1);
      osc.connect(gain).connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.11);
    }
  },
});

// Add a bright alternate palette treatment while keeping each creature's own markings.
const malSpriteOriginal = malSprite;
malSprite = function(name, pose = 0, view = 'front', shiny = false) {
  const shouldShine = !!shiny || shinyRenderContext;
  if (!shouldShine) return malSpriteOriginal(name, pose, view);
  const key = `${name}:${pose}:${view}:shiny`;
  if (shinySpriteCache[key]) return shinySpriteCache[key];
  const normal = malSpriteOriginal(name, pose, view);
  const canvas = document.createElement('canvas');
  canvas.width = normal.width;
  canvas.height = normal.height;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  // Palette-shift the completed hand-drawn sprite: each species keeps its silhouette and detail.
  const filters = {
    normal: 'hue-rotate(75deg) saturate(1.35) brightness(1.12)',
    fire: 'hue-rotate(175deg) saturate(1.35) brightness(1.10)',
    water: 'hue-rotate(-42deg) saturate(1.55) brightness(1.08)',
    grass: 'hue-rotate(92deg) saturate(1.45) brightness(1.08)',
    electric: 'hue-rotate(115deg) saturate(1.35) brightness(1.10)',
    ice: 'hue-rotate(-70deg) saturate(1.4) brightness(1.08)',
    fighting: 'hue-rotate(155deg) saturate(1.3) brightness(1.08)',
    poison: 'hue-rotate(250deg) saturate(1.45) brightness(1.08)',
    ground: 'hue-rotate(35deg) saturate(1.2) brightness(1.08)',
    flying: 'hue-rotate(115deg) saturate(1.3) brightness(1.12)',
    psychic: 'hue-rotate(145deg) saturate(1.35) brightness(1.10)',
    bug: 'hue-rotate(65deg) saturate(1.3) brightness(1.1)',
    rock: 'hue-rotate(70deg) saturate(1.2) brightness(1.12)',
    ghost: 'hue-rotate(205deg) saturate(1.25) brightness(1.08)',
    dragon: 'hue-rotate(215deg) saturate(1.35) brightness(1.08)',
    steel: 'hue-rotate(45deg) saturate(0.7) brightness(1.15)',
    dark: 'hue-rotate(280deg) saturate(0.9) brightness(1.05)',
    fairy: 'hue-rotate(315deg) saturate(1.4) brightness(1.12)',
  };
  g.filter = filters[MALS[name]?.type] || 'hue-rotate(70deg) saturate(1.35) brightness(1.10)';
  g.drawImage(normal, 0, 0);
  g.filter = 'none';
  shinySpriteCache[key] = canvas;
  return canvas;
};

// Shiny Pocketmals use a palette variant only. No sparkle overlays are drawn.

// Preserve shiny data on newly created Pocketmals and safely migrate older saves.
const makeMalOriginal = makeMal;
makeMal = function(name, lv, shiny = false) {
  const mal = makeMalOriginal(name, lv);
  mal.shiny = !!shiny;
  ensureMovePP(mal);
  return mal;
};

const loadOriginal = load;
load = function() {
  const ok = loadOriginal();
  if (!ok || !S) return ok;
  S.flags = S.flags || {};
  S.bag = S.bag || {};
  S.wishbits = Array.isArray(S.wishbits) ? S.wishbits : [];
  S.shinyCaught = S.shinyCaught && typeof S.shinyCaught === 'object' ? S.shinyCaught : {};
  S.flags.bikeOn = !!S.flags.bikeOn;
  S.flags.expShareOn = !!S.flags.expShareOn;
  S.flags.bicycle = !!S.flags.bicycle;
  S.flags.expShare = !!S.flags.expShare;
  for (const mal of [...(S.party || []), ...(S.box || [])].filter((entry) => entry && typeof entry === 'object')) {
    mal.shiny = !!mal.shiny;
    if (mal.shiny) S.shinyCaught[mal.name] = true;
  }
  // Repair a save interrupted during the older Wispurr nickname step.
  const hasWispurr = [...(S.party || []), ...(S.box || [])].some((mal) => mal && mal.name === 'Wispurr');
  if (hasWispurr || S.caught.Wispurr) S.flags.wispurr = true;
  else if (S.flags.wispurr) S.flags.wispurr = false;
  return ok;
};

// A caught shiny is permanently recorded in the player's field research.
const addMalOriginal = addMal;
addMal = async function(mal, options = {}) {
  mal.shiny = !!mal.shiny;
  S.seen[mal.name] = true;
  S.caught[mal.name] = true;
  S.shinyCaught = S.shinyCaught || {};
  if (mal.shiny) {
    S.shinyCaught[mal.name] = true;
    sfx.shiny();
    await say(`A rare shiny ${mal.name}! Its colours shimmer in the light!`);
  }
  if (options.askNickname === false) {
    if (S.party.length < 6) S.party.push(mal);
    else S.box.push(mal);
    playMalCry(mal.name, 'caught');
    save();
    return;
  }
  await addMalOriginal(mal);
  save();
};

// Collecting a Wishbit now saves immediately, so the three-piece quest cannot vanish on refresh.
const interactTileOriginal = interactTile;
interactTile = async function(tile, x, y) {
  if (tile === 'D' && S.map === 'pocketown' && x === 4 && y === 3 && S.badges?.includes('Meadow Badge') && !S.flags.bicycle) {
    healAll();
    S.flags.bicycle = true;
    S.flags.bikeOn = false;
    save();
    sfx.itemGet();
    await sayAll([
      'Mom: You have earned your first Gym Badge! I am so proud of you.',
      'Mom: You have been travelling all over Mellora. Take this Bicycle to make the longer routes easier.',
      'You received the BICYCLE! Open BAG > KEY ITEMS or press Y for your quick menu.'
    ]);
    return;
  }
  if (tile === 'B') {
    const wishbitKey = S.map + x + y;
    const alreadyFound = S.wishbits.includes(wishbitKey);
    const result = await interactTileOriginal(tile, x, y);
    if (!alreadyFound) {
      save();
      sfx.pickup();
    }
    return result;
  }
  return interactTileOriginal(tile, x, y);
};

// Gift sequence is shown BEFORE the Pocketmal is added. Wispurr keeps its species name,
// avoiding the old nickname-form interruption that could leave the professor interaction stuck.
const pipOriginal = pip;
pip = async function() {
  if (canClaimWishbitGift()) return claimWishbitGift();

  const caughtCount = Object.keys(S.caught || {}).length;
  if (S.flags.starter && caughtCount >= 3 && !S.flags.expShare) {
    S.flags.expShare = true;
    S.flags.expShareOn = true;
    save();
    sfx.itemGet();
    return sayAll([
      'Professor Lotus: Your field research is coming along nicely. You have recorded three different Pocketmals!',
      'Take this EXP Share. It lets Pocketmals elsewhere in your party gain experience after battles.',
      'The EXP Share is now active. Press Y to open your quick menu and switch it on or off.'
    ]);
  }
  return pipOriginal();
};

// Dynamic key-item pocket. Bicycle and EXP Share are permanent registered key items.
const menuBagItemsOriginal = menuBagItems;
menuBagItems = function() {
  const normalItems = Object.keys(S.bag || {}).filter((name) => S.bag[name] > 0);
  if (menuState.category === 0) return normalItems.filter((name) => ['Potion', 'Super Potion', 'Berry', 'Revive', 'Repel'].includes(name));
  if (menuState.category === 1) return normalItems.filter((name) => name.includes('Malball'));
  if (menuState.category === 2) {
    return [
      ...(S.flags.maldex ? ['Maldex'] : []),
      ...(S.flags.runningShoes ? ['Running Shoes'] : []),
      ...(S.flags.bicycle ? ['Bicycle'] : []),
      ...(S.flags.expShare ? ['EXP Share'] : []),
      ...(S.bag['Shiny Charm'] > 0 ? ['Shiny Charm'] : []),
    ];
  }
  return normalItems.filter((name) => !['Potion', 'Super Potion', 'Berry', 'Revive', 'Repel'].includes(name) && !name.includes('Malball'));
};

const useMenuBagItemOriginal = useMenuBagItem;
useMenuBagItem = function(name) {
  if (name === 'Bicycle') {
    if (!S.flags.bicycle) return;
    S.flags.bikeOn = !S.flags.bikeOn;
    sfx.bicycle();
    save();
    return;
  }
  if (name === 'EXP Share') {
    if (!S.flags.expShare) return;
    S.flags.expShareOn = !S.flags.expShareOn;
    sfx.menu();
    save();
    return;
  }
  if (name === 'Running Shoes') {
    S.flags.running = !S.flags.running;
    sfx.menu();
    save();
    return;
  }
  if (name === 'Repel') {
    if ((S.bag.Repel || 0) < 1) return;
    S.bag.Repel--;
    S.flags.repelSteps = 100;
    sfx.menu();
    save();
    return;
  }
  if (name === 'Revive') {
    const fainted = S.party.find((member) => member.cur <= 0);
    if (!fainted || (S.bag.Revive || 0) < 1) return;
    fainted.cur = Math.max(1, Math.floor(fainted.maxhp / 2));
    S.bag.Revive--;
    sfx.heal();
    save();
    return;
  }
  return useMenuBagItemOriginal(name);
};

// EXP Share awards half of the active Pocketmal's battle XP to each other party member.
async function gainXpCore(mal, xp) {
  if (!mal || xp <= 0) return;
  mal.xp = (mal.xp || 0) + xp;
  await say(`${malName(mal)} gained ${xp} XP!`);
  while (mal.xp >= xpNeed(mal.lv)) {
    mal.xp -= xpNeed(mal.lv);
    mal.lv++;
    const oldMax = mal.maxhp;
    calc(mal);
    mal.cur = Math.min(mal.maxhp, mal.cur + mal.maxhp - oldMax);
    sfx.levelUp();
    await say(`${malName(mal)} grew to level ${mal.lv}!`);
    const learn = MALS[mal.name].moves[Math.floor(mal.lv / 4)];
    if (learn && !mal.moves.includes(learn)) {
      if (mal.moves.length < 4) {
        mal.moves.push(learn);
        ensureMovePP(mal);
        await say(`${malName(mal)} learned ${learn}!`);
      } else {
        await say(`${malName(mal)} wants to learn ${learn}, but it already knows four moves.`);
        const replaceIndex = await choose([...mal.moves.map((move) => `Forget ${move}`), 'Keep current moves'], 'Choose a move to replace');
        if (replaceIndex >= 0 && replaceIndex < 4) {
          const forgotten = mal.moves[replaceIndex];
          mal.moves[replaceIndex] = learn;
          ensureMovePP(mal);
          delete mal.pp[forgotten];
          mal.pp[learn] = maxMovePP(learn);
          await say(`${malName(mal)} forgot ${forgotten} and learned ${learn}!`);
        } else {
          await say(`${malName(mal)} did not learn ${learn}.`);
        }
      }
    }
    const evolution = EVOLUTIONS[mal.name];
    if (evolution?.to && mal.lv >= evolution.level) await evolveMal(mal, evolution.to);
  }
}
gainXp = async function(mal, xp) {
  await gainXpCore(mal, xp);
  if (S.flags.expShare && S.flags.expShareOn) {
    const recipients = (S.party || []).filter((member) => member !== mal && member.cur > 0);
    for (const recipient of recipients) {
      await gainXpCore(recipient, Math.max(1, Math.floor(xp * 0.5)));
    }
  }
  save();
};

// Wild encounters alone roll the shiny check; trainer rosters remain authored and predictable.
const afterStepOriginal = afterStep;
afterStep = async function() {
  if (S.room) return;
  for (const npc of NPCS[S.map]) {
    if (npc.trainer && !S.beaten[S.map + npc.x + npc.y] && Math.abs(npc.x - S.x) + Math.abs(npc.y - S.y) === 1) {
      return talk(npc);
    }
  }
  const map = MAPS[S.map];
  const repelActive = Number(S.flags.repelSteps || 0) > 0;
  if (repelActive) S.flags.repelSteps = Math.max(0, Number(S.flags.repelSteps) - 1);
  if (!repelActive && tileAt(S.x, S.y) === 'G' && S.party.length && Math.random() < 0.12) {
    const name = map.grass[Math.floor(Math.random() * map.grass.length)];
    const level = map.lv[0] + Math.floor(Math.random() * (map.lv[1] - map.lv[0] + 1));
    const shiny = Math.random() < 1 / pocketmalShinyOdds();
    sfx.encounter();
    await battle([makeMal(name, level, shiny)], null);
    save();
    return;
  }
  if (S.flags.bicycle && S.flags.bikeOn) sfx.bikeStep();
  else sfx.step();
  save();
};

// Shiny encounter announcement and sound before the normal battle intro.
const battleOriginal = battle;
battle = async function(foes, trainer) {
  if (!trainer && foes?.some((mal) => mal.shiny)) {
    flash = 0.7;
    sfx.shiny();
    await say('A rare shiny Pocketmal appeared! Its colours are different from the others!');
  }
  return battleOriginal(foes, trainer);
};

// Type-specific attack timbres are layered over the existing attack animation.
const attackOriginal = attack;
attack = async function(attacker, defender, move, mine) {
  const previousType = activeMoveTypeForSfx;
  activeMoveTypeForSfx = MOVES[move]?.[0] || 'normal';
  try {
    return await attackOriginal(attacker, defender, move, mine);
  } finally {
    activeMoveTypeForSfx = previousType;
  }
};

// Tiny bump effect for blocked movement, without changing the collision rules.
const tryMoveOriginal = tryMove;
tryMove = function(direction) {
  const beforeMap = S?.map;
  const beforeX = S?.x;
  const beforeY = S?.y;
  const beforeRoom = !!S?.room;
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  const targetX = delta ? beforeX + delta[0] : beforeX;
  const targetY = delta ? beforeY + delta[1] : beforeY;
  const targetTile = S && !beforeRoom && delta ? tileAt(targetX, targetY) : null;
  const isBlocked = !!(targetTile && SOLID.includes(targetTile) && !'DBRE'.includes(targetTile)) || !!(S && !beforeRoom && npcAt(targetX, targetY));
  const result = tryMoveOriginal(direction);
  if (isBlocked && S && S.map === beforeMap && S.x === beforeX && S.y === beforeY && !!S.room === beforeRoom && !moving) sfx.bump();
  return result;
};

// Y-button quick pocket, inspired by the registered-item shortcut on handheld RPGs.
function quickMenuItems() {
  const items = [];
  if (S.flags.bicycle) items.push({ id: 'bicycle', label: `BICYCLE  ${S.flags.bikeOn ? 'ON' : 'OFF'}`, hint: 'Toggle faster cycling' });
  if (S.flags.runningShoes) items.push({ id: 'shoes', label: `RUNNING SHOES  ${S.flags.running ? 'ON' : 'OFF'}`, hint: 'Toggle your running pace' });
  if (S.flags.expShare) items.push({ id: 'exp', label: `EXP SHARE  ${S.flags.expShareOn ? 'ON' : 'OFF'}`, hint: 'Share battle experience' });
  if (S.flags.maldex) items.push({ id: 'dex', label: 'MALDEX', hint: 'Open the paper field journal' });
  if (S.bag?.Potion > 0 || S.bag?.['Super Potion'] > 0) items.push({ id: 'potion', label: 'QUICK HEAL', hint: 'Heal your first injured partner' });
  if (S.bag?.Repel > 0) items.push({ id: 'repel', label: `REPEL  x${S.bag.Repel}`, hint: 'Avoid wild encounters for 100 steps' });
  return items;
}
function openQuickMenu(returnMode = 'world') {
  if (!S) return;
  quickReturnMode = returnMode;
  quickState = { selection: 0 };
  mode = 'quick';
  sfx.menu();
}
function closeQuickMenu() {
  quickState = null;
  mode = quickReturnMode;
  sfx.menu();
}
function activateQuickItem(item) {
  if (!item) return;
  if (item.id === 'bicycle') {
    S.flags.bikeOn = !S.flags.bikeOn;
    sfx.bicycle();
    save();
  } else if (item.id === 'shoes') {
    S.flags.running = !S.flags.running;
    sfx.menu();
    save();
  } else if (item.id === 'exp') {
    S.flags.expShareOn = !S.flags.expShareOn;
    sfx.menu();
    save();
  } else if (item.id === 'dex') {
    quickState = null;
    menuState = { page: 'dex', selection: 0, category: 0, dexView: false };
    mode = 'menu';
    sfx.menu();
  } else if (item.id === 'repel') {
    if (S.bag.Repel > 0) {
      S.bag.Repel--;
      S.flags.repelSteps = 100;
      sfx.menu();
      save();
    }
  } else if (item.id === 'potion') {
    const target = S.party.find((mal) => mal.cur > 0 && mal.cur < mal.maxhp);
    if (!target) {
      sfx.bump();
    } else {
      const itemName = S.bag['Super Potion'] > 0 ? 'Super Potion' : 'Potion';
      const amount = itemName === 'Super Potion' ? 60 : 25;
      target.cur = Math.min(target.maxhp, target.cur + amount);
      S.bag[itemName]--;
      sfx.heal();
      save();
    }
  }
}
function handleQuickKey(key) {
  const items = quickMenuItems();
  if (key === 'b' || key === 'y') return closeQuickMenu();
  if (!items.length) return closeQuickMenu();
  if (key === 'left' || key === 'up') quickState.selection = (quickState.selection + items.length - 1) % items.length;
  if (key === 'right' || key === 'down') quickState.selection = (quickState.selection + 1) % items.length;
  if (key === 'a') {
    const selected = items[quickState.selection];
    activateQuickItem(selected);
    if (mode === 'quick' && selected?.id !== 'dex') closeQuickMenu();
  }
}
function drawQuickMenu(g) {
  const items = quickMenuItems();
  g.fillStyle = '#10213a';
  g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#243d58';
  g.fillRect(5, 5, 310, 230);
  g.fillStyle = '#d9e8df';
  g.fillRect(10, 10, 300, 220);
  g.fillStyle = '#294b61';
  g.fillRect(10, 10, 300, 27);
  g.fillStyle = '#fff0bd';
  g.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
  g.fillText('Y  /  QUICK POCKET', 19, 27);
  g.fillStyle = '#546e78';
  g.font = '7px "Pixelify Sans", Arial, sans-serif';
  g.fillText('REGISTERED FIELD ITEMS', 19, 49);
  if (!items.length) {
    g.fillStyle = '#30485a';
    g.font = 'bold 9px "Pixelify Sans", Arial, sans-serif';
    g.fillText('No quick items yet.', 27, 91);
    g.font = '7px "Pixelify Sans", Arial, sans-serif';
    g.fillText('Earn key items during your journey.', 27, 108);
  }
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 17 + col * 145;
    const y = 60 + row * 62;
    const selected = index === quickState.selection;
    g.fillStyle = selected ? '#31566e' : '#d9e5dc';
    g.fillRect(x, y, 137, 54);
    g.strokeStyle = selected ? '#d7aa54' : '#81978d';
    g.lineWidth = selected ? 3 : 1;
    g.strokeRect(x + 0.5, y + 0.5, 136, 53);
    g.lineWidth = 1;
    g.fillStyle = selected ? '#fff2c8' : '#294657';
    g.font = 'bold 8px "Pixelify Sans", Arial, sans-serif';
    g.fillText(item.label.slice(0, 20), x + 7, y + 20);
    g.fillStyle = selected ? '#d5e4e0' : '#627879';
    g.font = '6px "Pixelify Sans", Arial, sans-serif';
    g.fillText(item.hint.slice(0, 25), x + 7, y + 36);
  });
  g.fillStyle = '#4c6670';
  g.font = '7px "Pixelify Sans", Arial, sans-serif';
  g.fillText('ARROWS SELECT   Z USE   X / Y BACK', 19, 218);
}

// Preserve the existing lower screen outside the quick-menu state.
const drawLowerScreenBeforeQuick = drawLowerScreen;
drawLowerScreen = function() {
  if (mode === 'quick' && quickState) {
    drawQuickMenu(lowerCtx);
    return;
  }
  drawLowerScreenBeforeQuick();
};

// In the Maldex, Y still plays the selected creature's cry. Elsewhere it opens Quick Pocket.
const handleMenuKeyOriginal = handleMenuKey;
handleMenuKey = function(key) {
  if (key === 'y' && menuState?.page === 'dex' && S.flags.maldex) {
    const speciesName = MAL_LIST[menuState.selection];
    if (S.seen[speciesName]) playMalCry(speciesName, 'preview');
    return;
  }
  if (key === 'y') return openQuickMenu('menu');
  return handleMenuKeyOriginal(key);
};

// Wrap update so Y opens a compact panel, while Shift still toggles running shoes.
const updateBeforeQuick = update;
update = function() {
  if (mode === 'quick') {
    frame++;
    const key = pressed;
    pressed = null;
    if (key) handleQuickKey(key);
    return;
  }
  if (!ui && mode === 'world' && pressed === 'y') {
    frame++;
    pressed = null;
    return openQuickMenu('world');
  }
  return updateBeforeQuick();
};

// ============================================================
// CLASSIC CREATURE MANAGEMENT: SELECTION BOB, SUMMARY, PARTY ORDER
// ============================================================

// The original game panels remain in place; this layer adds the familiar
// floating party cursor and makes the selected creature visibly rise/fall.
const drawGameMenuBeforeClassic = drawGameMenu;
drawGameMenu = function(g) {
  drawGameMenuBeforeClassic(g);

  if (menuState?.page === 'party' && S.party[menuState.selection]) {
    const index = menuState.selection;
    const mal = S.party[index];
    const y = 40 + index * 22;
    const bob = Math.sin(frame * 0.17) * 2.2;
    g.fillStyle = '#101e31';
    g.fillRect(15, y + 1, 22, 20);
    g.drawImage(malSprite(mal.name, Math.floor(frame / 6) % 8, 'front', !!mal.shiny), 16, y + 1 + bob, 20, 20);
    g.fillStyle = '#fff0a6';
    g.font = 'bold 11px "Pixelify Sans", Arial, sans-serif';
    g.fillText('▶', 2, y + 14 + bob);
  }

  if (menuState?.page === 'box' && S.box[menuState.selection]) {
    const index = menuState.selection;
    const mal = S.box[index];
    const first = Math.floor(index / 12) * 12;
    const offset = index - first;
    const col = offset % 3, row = Math.floor(offset / 3);
    const x = 16 + col * 98, y = 43 + row * 39;
    const bob = Math.sin(frame * 0.17) * 2.2;
    g.fillStyle = '#0f1e31';
    g.fillRect(x + 3, y + 4, 27, 27);
    g.drawImage(malSprite(mal.name, Math.floor(frame / 6 + index) % 8, 'front', !!mal.shiny), x + 4, y + 4 + bob, 25, 25);
    g.fillStyle = '#fff0a6';
    g.font = 'bold 10px "Pixelify Sans", Arial, sans-serif';
    g.fillText('▶', x - 5, y + 21 + bob);
  }

  if (menuState?.page === 'boxSwap') {
    drawPartySwapScreen(g, 'CHOOSE A PARTY MEMBER TO SWAP');
  }
  if (menuState?.page === 'summary') drawPocketmalSummary(g);
  if (menuState?.partyAction) drawActionPopup(g, 'PARTNER ACTIONS', ['SUMMARY', 'MAKE LEAD', 'SWITCH POSITION', 'SEND TO MALBOX', 'CANCEL'], menuState.actionSelection || 0);
  if (menuState?.boxAction) {
    const full = S.party.length >= 6;
    drawActionPopup(g, 'STORED POCKETMAL', ['SUMMARY', full ? 'SWAP WITH PARTY' : 'ADD TO PARTY', 'CANCEL'], menuState.actionSelection || 0);
  }
  if (menuState?.partySwitchFrom !== undefined && menuState.partySwitchFrom !== null) {
    g.fillStyle = '#fff0bd';
    g.font = 'bold 7px "Pixelify Sans", Arial, sans-serif';
    g.fillText('CHOOSE THE SLOT TO MOVE THIS PARTNER TO', 18, 232);
  }
};

function drawActionPopup(g, title, options, selected) {
  g.fillStyle = '#081421cc';
  g.fillRect(0, 0, 320, 240);
  menuPanel(g, 59, 61, 202, 126);
  menuLabel(g, title, 75, 80, '#ffe9a5', 9);
  options.forEach((option, index) => {
    const y = 88 + index * 19;
    menuPanel(g, 70, y, 180, 17, index === selected);
    const bob = index === selected ? Math.sin(frame * 0.17) * 1.5 : 0;
    menuLabel(g, `${index === selected ? '▶' : ' '} ${option}`, 78, y + 12 + bob, index === selected ? '#fff2c8' : '#d3e3ee', 8);
  });
  menuLabel(g, 'ARROWS SELECT   Z CONFIRM   X BACK', 65, 202, '#b9d4e4', 7);
}

function drawPartySwapScreen(g, title) {
  g.fillStyle = '#101d31';
  g.fillRect(0, 0, 320, 240);
  menuFrame(g, 'MALBOX  /  PARTY SWAP');
  menuLabel(g, title, 17, 48, '#ffe9a5', 8);
  S.party.forEach((mal, index) => {
    const y = 58 + index * 25;
    const selected = index === menuState.selection;
    menuPanel(g, 15, y, 290, 22, selected);
    const bob = selected ? Math.sin(frame * 0.17) * 2 : 0;
    g.fillStyle = '#101e31';
    g.fillRect(19, y + 1, 22, 20);
    g.drawImage(malSprite(mal.name, Math.floor(frame / 6) % 8, 'front', !!mal.shiny), 20, y + 1 + bob, 20, 20);
    if (selected) {
      menuLabel(g, '▶', 3, y + 14 + bob, '#fff0a6', 10);
    }
    menuLabel(g, `${malName(mal).slice(0, 15)}  Lv${mal.lv}`, 47, y + 14, '#edf6fa', 8);
    menuLabel(g, `${mal.cur}/${mal.maxhp} HP`, 225, y + 14, '#b8d5e3', 7);
  });
  menuLabel(g, 'Z SWAP   X CANCEL', 18, 222, '#9bbbd1', 8);
}

function drawPocketmalSummary(g) {
  const list = menuState.summarySource === 'box' ? S.box : S.party;
  const mal = list[menuState.summaryIndex];
  g.fillStyle = '#101d31';
  g.fillRect(0, 0, 320, 240);
  menuFrame(g, 'POCKETMAL SUMMARY');
  if (!mal) {
    menuLabel(g, 'THIS SLOT IS EMPTY.', 88, 112, '#fff0bd', 10);
    menuLabel(g, 'X BACK', 18, 222, '#9bbbd1', 8);
    return;
  }
  const species = MALS[mal.name];
  menuPanel(g, 14, 41, 108, 132);
  g.fillStyle = TYPE_COLORS[species.type] || '#6d9eae';
  g.beginPath();
  g.arc(68, 91, 34, 0, Math.PI * 2);
  g.fill();
  const bob = Math.sin(frame * 0.13) * 2;
  g.drawImage(malSprite(mal.name, Math.floor(frame / 6) % 8, 'front', !!mal.shiny), 39, 62 + bob, 58, 58);
  menuLabel(g, mal.shiny ? '★ SHINY' : 'PARTNER', 29, 143, mal.shiny ? '#ffe58b' : '#a8d2e4', 8);
  menuLabel(g, `No. ${String(species.id).padStart(3, '0')}`, 28, 159, '#d5e4f1', 7);
  menuPanel(g, 130, 41, 176, 132);
  menuLabel(g, malName(mal).toUpperCase().slice(0, 19), 140, 58, '#fff0bd', 10);
  menuLabel(g, `${mal.name.toUpperCase()}  /  Lv ${mal.lv}`, 140, 75, '#c6e0ea', 7);
  menuLabel(g, `${species.types.map((type) => type.toUpperCase()).join('/')} TYPE`, 140, 91, '#80dece', 8);
  menuLabel(g, `HP  ${mal.cur} / ${mal.maxhp}`, 140, 108, '#e8f0e4', 8);
  menuLabel(g, `ATK ${mal.atk}   DEF ${mal.def}`, 140, 126, '#e8f0e4', 7);
  menuLabel(g, `SPD ${mal.spd}`, 140, 141, '#e8f0e4', 7);
  menuLabel(g, `ABILITY  ${species.ability.toUpperCase()}`.slice(0, 27), 140, 158, '#e8c98b', 6);
  menuPanel(g, 14, 178, 292, 39);
  menuLabel(g, 'KNOWN MOVES', 22, 191, '#83d8de', 7);
  const moveList = (mal.moves || []).slice(0, 4);
  moveList.forEach((move, i) => {
    const x = 22 + (i % 2) * 140, y = 204 + Math.floor(i / 2) * 11;
    const pp = mal.pp?.[move] ?? maxMovePP(move);
    menuLabel(g, `${move.slice(0, 13)}  ${pp}/${maxMovePP(move)}`, x, y, '#eef5ee', 6);
  });
  menuLabel(g, `XP TO NEXT  ${Math.max(0, xpNeed(mal.lv) - (mal.xp || 0))}`, 18, 231, '#b9d4e4', 6);
  menuLabel(g, 'LEFT/RIGHT   Y CRY   X BACK', 176, 231, '#9bbbd1', 6);
}

const activateMenuSelectionBeforeClassic = activateMenuSelection;
activateMenuSelection = function() {
  if (!menuState) return;

  if (menuState.page === 'party') {
    if (menuState.partySwitchFrom !== undefined && menuState.partySwitchFrom !== null) {
      const from = menuState.partySwitchFrom, to = menuState.selection;
      if (from !== to && S.party[from] && S.party[to]) {
        [S.party[from], S.party[to]] = [S.party[to], S.party[from]];
        save();
        sfx.ok();
      }
      menuState.partySwitchFrom = null;
      return;
    }
    if (!menuState.partyAction) {
      if (!S.party[menuState.selection]) return;
      menuState.partyAction = true;
      menuState.actionSelection = 0;
      sfx.menu();
      return;
    }
    const index = menuState.selection;
    const action = menuState.actionSelection || 0;
    const mal = S.party[index];
    menuState.partyAction = false;
    if (!mal) return;
    if (action === 0) {
      menuState.summarySource = 'party';
      menuState.summaryIndex = index;
      menuState.page = 'summary';
    } else if (action === 1) {
      if (index > 0) {
        S.party.unshift(S.party.splice(index, 1)[0]);
        menuState.selection = 0;
        sfx.ok();
        save();
      } else sfx.bump();
    } else if (action === 2) {
      menuState.partySwitchFrom = index;
      menuState.selection = index;
    } else if (action === 3) {
      if (S.party.length <= 1) {
        say('You need to keep at least one partner in your party.');
      } else {
        S.box.push(S.party.splice(index, 1)[0]);
        menuState.selection = Math.max(0, Math.min(index, S.party.length - 1));
        save();
        sfx.ok();
      }
    }
    return;
  }

  if (menuState.page === 'box') {
    if (!menuState.boxAction) {
      if (!S.box[menuState.selection]) return;
      menuState.boxAction = true;
      menuState.actionSelection = 0;
      sfx.menu();
      return;
    }
    const index = menuState.selection;
    const mal = S.box[index];
    const action = menuState.actionSelection || 0;
    const full = S.party.length >= 6;
    menuState.boxAction = false;
    if (!mal) return;
    if (action === 0) {
      menuState.summarySource = 'box';
      menuState.summaryIndex = index;
      menuState.page = 'summary';
    } else if (action === 1 && !full) {
      S.party.push(S.box.splice(index, 1)[0]);
      menuState.selection = Math.max(0, Math.min(index, S.box.length - 1));
      save();
      sfx.ok();
    } else if (action === 1 && full) {
      menuState.page = 'boxSwap';
      menuState.boxSwapIndex = index;
      menuState.selection = 0;
    }
    return;
  }

  if (menuState.page === 'boxSwap') {
    const boxIndex = menuState.boxSwapIndex;
    const partyIndex = menuState.selection;
    if (S.box[boxIndex] && S.party[partyIndex]) {
      [S.box[boxIndex], S.party[partyIndex]] = [S.party[partyIndex], S.box[boxIndex]];
      menuState.page = 'box';
      menuState.selection = boxIndex;
      menuState.boxSwapIndex = null;
      save();
      sfx.ok();
    }
    return;
  }

  if (menuState.page === 'summary') {
    const list = menuState.summarySource === 'box' ? S.box : S.party;
    const mal = list[menuState.summaryIndex];
    if (mal) playMalCry(mal.name, 'preview');
    return;
  }

  return activateMenuSelectionBeforeClassic();
};

const changeMenuSelectionBeforeClassic = changeMenuSelection;
changeMenuSelection = function(delta) {
  if (!menuState) return;
  const previousSelection = menuState.selection;
  const previousCategory = menuState.category;
  const previousActionSelection = menuState.actionSelection;
  const playMoveSound = () => {
    if (menuState.selection !== previousSelection
      || menuState.category !== previousCategory
      || menuState.actionSelection !== previousActionSelection) sfx.menu();
  };
  if (menuState.page === 'party' && menuState.partyAction) {
    const count = 5;
    const dir = (delta === 'up' || delta === 'left') ? -1 : 1;
    menuState.actionSelection = ((menuState.actionSelection || 0) + dir + count) % count;
    playMoveSound();
    return;
  }
  if (menuState.page === 'box' && menuState.boxAction) {
    const count = 3;
    const dir = (delta === 'up' || delta === 'left') ? -1 : 1;
    menuState.actionSelection = ((menuState.actionSelection || 0) + dir + count) % count;
    playMoveSound();
    return;
  }
  if (menuState.page === 'boxSwap') {
    const count = S.party.length;
    if (!count) return;
    const amount = delta === 'up' || delta === 'down' ? (delta === 'up' ? -1 : 1) : (delta === 'left' ? -1 : 1);
    menuState.selection = (menuState.selection + amount + count) % count;
    playMoveSound();
    return;
  }
  if (menuState.page === 'summary') {
    const list = menuState.summarySource === 'box' ? S.box : S.party;
    if (list.length) {
      const dir = (delta === 'left' || delta === 'up') ? -1 : 1;
      menuState.summaryIndex = (menuState.summaryIndex + dir + list.length) % list.length;
      menuState.selection = menuState.summaryIndex;
      playMoveSound();
    }
    return;
  }
  changeMenuSelectionBeforeClassic(delta);
  playMoveSound();
};

const handleMenuKeyBeforeClassic = handleMenuKey;
handleMenuKey = function(key) {
  if (!menuState) return;
  if (key === 'b' || key === 'x') {
    if (menuState.partyAction) {
      menuState.partyAction = false;
      return;
    }
    if (menuState.boxAction) {
      menuState.boxAction = false;
      return;
    }
    if (menuState.partySwitchFrom !== undefined && menuState.partySwitchFrom !== null) {
      menuState.partySwitchFrom = null;
      return;
    }
    if (menuState.page === 'summary') {
      menuState.page = menuState.summarySource === 'box' ? 'box' : 'party';
      menuState.selection = menuState.summaryIndex;
      return;
    }
    if (menuState.page === 'boxSwap') {
      menuState.page = 'box';
      menuState.selection = menuState.boxSwapIndex || 0;
      menuState.boxSwapIndex = null;
      return;
    }
  }
  if (menuState.page === 'summary' && key === 'y') {
    const list = menuState.summarySource === 'box' ? S.box : S.party;
    const mal = list[menuState.summaryIndex];
    if (mal) playMalCry(mal.name, 'preview');
    return;
  }
  return handleMenuKeyBeforeClassic(key);
};

// A fainted Pocketmal can be restored with Revive from the field bag or in battle.
// The summary and party actions are save-compatible: they only rearrange existing records.

let gameLoopStarted = false;
function showGameFailure(error) {
  const bootStatus = document.getElementById('boot-status');
  if (bootStatus) {
    bootStatus.style.display = 'block';
    bootStatus.textContent = 'game stopped: ' + (error && error.message ? error.message : String(error));
  }
  console.error('Pocketmals stopped after a game-loop error:', error);
}
function loop() {
  try {
    update();
    render();
    const bootStatus = document.getElementById('boot-status');
    if (bootStatus) bootStatus.style.display = 'none';
    updateMusic();
    gameLoopStarted = true;
    requestAnimationFrame(loop);
  } catch (error) {
    showGameFailure(error);
  }
}
loop();
