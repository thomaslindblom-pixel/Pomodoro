'use strict';

const MIN = 60 * 1000;
const DURATIONS = {
  work: 25 * MIN,
  short: 5 * MIN,
  long: 25 * MIN,
};
const SESSIONS_PER_CYCLE = 3;
const LABELS = { work: 'Fokus', short: 'Kort paus', long: 'Lång paus' };
const STORAGE_KEY = 'pomodoro-state-v1';

const els = {
  phase: document.getElementById('phase'),
  time: document.getElementById('time'),
  progress: document.getElementById('progress'),
  dots: [...document.querySelectorAll('.dot')],
  info: document.getElementById('info'),
  toggle: document.getElementById('toggle'),
  reset: document.getElementById('reset'),
  skip: document.getElementById('skip'),
};

const CIRC = 2 * Math.PI * 54;
els.progress.style.strokeDasharray = CIRC;

// phase: 'work' | 'short' | 'long'
// sessionIndex: which work session in the cycle (0..2) we are on, or just finished if on a break
// endsAt: timestamp when the running phase ends (null when paused)
// remaining: ms left when paused
let state = load() || freshState();

function freshState() {
  return { phase: 'work', sessionIndex: 0, endsAt: null, remaining: DURATIONS.work };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && DURATIONS[s.phase]) return s;
  } catch (e) {}
  return null;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function nextPhase(s) {
  if (s.phase === 'work') {
    const isLast = s.sessionIndex === SESSIONS_PER_CYCLE - 1;
    return { phase: isLast ? 'long' : 'short', sessionIndex: s.sessionIndex };
  }
  if (s.phase === 'long') return { phase: 'work', sessionIndex: 0 };
  return { phase: 'work', sessionIndex: s.sessionIndex + 1 };
}

function remainingMs() {
  return state.endsAt ? Math.max(0, state.endsAt - Date.now()) : state.remaining;
}

function advance(autoStart, startAt) {
  const n = nextPhase(state);
  state.phase = n.phase;
  state.sessionIndex = n.sessionIndex;
  state.remaining = DURATIONS[n.phase];
  state.endsAt = autoStart ? startAt + DURATIONS[n.phase] : null;
}

// If the app was in the background, catch up on all phases that ended meanwhile.
function catchUp() {
  let finished = false;
  while (state.endsAt && state.endsAt <= Date.now()) {
    advance(true, state.endsAt);
    finished = true;
  }
  return finished;
}

function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function render() {
  const ms = remainingMs();
  const running = !!state.endsAt;

  document.body.dataset.phase = state.phase;
  els.phase.textContent = LABELS[state.phase];
  els.time.textContent = fmt(ms);
  els.progress.style.strokeDashoffset = CIRC * (1 - ms / DURATIONS[state.phase]);
  els.toggle.textContent = running ? 'Paus' : (ms < DURATIONS[state.phase] ? 'Fortsätt' : 'Starta');

  els.dots.forEach((d, i) => {
    const done = i < state.sessionIndex || (i === state.sessionIndex && state.phase !== 'work');
    d.classList.toggle('done', done);
    d.classList.toggle('current', i === state.sessionIndex && state.phase === 'work');
  });

  const n = nextPhase(state);
  const nextText = n.phase === 'work'
    ? `arbetspass ${n.sessionIndex + 1} av ${SESSIONS_PER_CYCLE}`
    : LABELS[n.phase].toLowerCase() + ` (${DURATIONS[n.phase] / MIN} min)`;
  els.info.textContent = state.phase === 'work'
    ? `Arbetspass ${state.sessionIndex + 1} av ${SESSIONS_PER_CYCLE} · Sedan: ${nextText}`
    : `Sedan: ${nextText}`;

  document.title = running ? `${fmt(ms)} · ${LABELS[state.phase]}` : 'Pomodoro';
}

// --- Sound (Web Audio; must be unlocked by a user tap on iOS) ---
let audioCtx = null;
function unlockAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function chime() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = t0 + i * 0.25;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// --- Keep the screen on while running, where supported ---
let wakeLock = null;
async function updateWakeLock() {
  try {
    if (state.endsAt && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!state.endsAt && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {}
}

// --- Controls ---
els.toggle.addEventListener('click', () => {
  unlockAudio();
  if (state.endsAt) {
    state.remaining = remainingMs();
    state.endsAt = null;
  } else {
    state.endsAt = Date.now() + state.remaining;
  }
  save(); render(); updateWakeLock();
});

els.skip.addEventListener('click', () => {
  unlockAudio();
  advance(false);
  save(); render(); updateWakeLock();
});

els.reset.addEventListener('click', () => {
  if (!confirm('Nollställ och börja om från första arbetspasset?')) return;
  state = freshState();
  save(); render(); updateWakeLock();
});

function tick() {
  if (catchUp()) {
    chime();
    save();
  }
  render();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Phases that ended in the background are advanced silently.
    if (catchUp()) save();
    render();
    updateWakeLock();
  }
});

setInterval(tick, 250);
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
