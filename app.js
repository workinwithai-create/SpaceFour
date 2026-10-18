const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const STEPS_PER_BAR = 16;
const TOTAL_BARS = 8;
const POCKET = 4;
const SPACE = 4;

const recipes = [
  { id: "hats-off", name: "Hats off", blurb: "Closed hats die. Air on the space." },
  { id: "one-chair", name: "One chair", blurb: "Only upright holds. Everything else steps out." },
  { id: "bass-pedal", name: "Bass pedal", blurb: "Bass holds the root. Piano thin." },
  { id: "stop-space", name: "Stop space", blurb: "Bar 7 is air until beat 4." },
  { id: "violin-hold", name: "Violin hold", blurb: "Violin sustains across the space." },
  { id: "nylon-sparse", name: "Nylon sparse", blurb: "Nylon chops on the ands, then out." },
  { id: "trumpet-door", name: "Trumpet door", blurb: "Trumpet on the last eighth of bar 8." },
  { id: "kit-thin", name: "Kit thin", blurb: "Kick on 1 only. Snare soft." }
];

function bar(symbol, piano, guitar, bass) { return { symbol, piano, guitar, bass }; }

const grooves = [
  { id: "amber", name: "Amber Walk", bpm: 92, key: "A minor",
    pocket: [bar("Am",[45,48,52,57],[45,52,57],33), bar("F",[41,45,48,53],[41,48,53],41), bar("C",[48,52,55,60],[48,52,55],36), bar("G",[43,47,50,55],[43,47,50],31)],
    space: [bar("Am",[45,48,52,57],[45,52,57],33), bar("Am",[45,48,52,57],[45,52,57],33), bar("G",[43,47,50,55],[43,47,50],31), bar("Am",[45,48,52,57],[45,52,57],33)] },
  { id: "porch", name: "Porch Climb", bpm: 86, key: "E major",
    pocket: [bar("E",[40,44,47,52],[40,47,52],28), bar("B",[35,39,42,47],[35,42,47],23), bar("C#m",[44,47,51,56],[44,51,56],32), bar("A",[33,37,40,45],[33,40,45],33)],
    space: [bar("E",[40,44,47,52],[40,47,52],28), bar("E",[40,44,47,52],[40,47,52],28), bar("A",[33,37,40,45],[33,40,45],33), bar("E",[40,44,47,52],[40,47,52],28)] },
  { id: "fold", name: "Fold Radio", bpm: 104, key: "D minor",
    pocket: [bar("Dm",[38,41,45,50],[38,45,50],26), bar("Bb",[34,38,41,46],[34,41,46],34), bar("F",[41,45,48,53],[41,48,53],29), bar("C",[36,40,43,48],[36,43,48],24)],
    space: [bar("Dm",[38,41,45,50],[38,45,50],26), bar("Dm",[38,41,45,50],[38,45,50],26), bar("C",[36,40,43,48],[36,43,48],24), bar("Dm",[38,41,45,50],[38,45,50],26)] }
];

const state = {
  groove: grooves[0],
  recipe: recipes[0],
  playing: false,
  bar: 0,
  mode: null,
  bpm: 92,
  key: "A minor",
  nextStepTime: 0,
  step: 0,
  activeSources: [],
  rawBuffers: {}
};

let ctx, master, compressor, timerId;
let sampleBuffers = {};
let missing = [];

async function loadSamples() {
  const files = [
    ["kick", `${CDN}/drums/kick.mp3`], ["snare", `${CDN}/drums/snare.mp3`], ["hat", `${CDN}/drums/hihat.mp3`], ["crash", `${CDN}/drums/crash.mp3`],
    ["pC3", `${CDN}/piano/C3.mp3`], ["pC4", `${CDN}/piano/C4.mp3`], ["pA3", `${CDN}/piano/A3.mp3`],
    ["bE1", `${CDN}/bass/E1.mp3`], ["bA1", `${CDN}/bass/A1.mp3`], ["bC2", `${CDN}/bass/C2.mp3`],
    ["gE2", `${CDN}/guitar/E2.mp3`], ["gA2", `${CDN}/guitar/A2.mp3`], ["gE3", `${CDN}/guitar/E3.mp3`],
    ["tC4", `${CDN}/trumpet/C4.mp3`], ["vA3", `${CDN}/violin/A3.mp3`]
  ];
  missing = [];
  let n = 0;
  const status = document.getElementById("status");
  for (const [k, url] of files) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const ab = await r.arrayBuffer();
      state.rawBuffers[k] = ab;
      sampleBuffers[k] = await ctx.decodeAudioData(ab.slice(0));
    } catch (e) {
      missing.push(k);
      console.warn("Missing", k, e);
    }
    n++;
    status.textContent = `Seating chairs ${n}/${files.length}`;
  }
  if (missing.length) {
    status.textContent = `Missing instruments: ${missing.join(", ")}`;
  } else {
    status.textContent = "Chairs seated · live FluidR3 + kit. Tap to start audio if needed.";
  }
}

function rateFromMidi(midi, baseMidi) {
  const semis = midi - baseMidi;
  const clamped = Math.max(-4, Math.min(4, semis));
  return Math.pow(2, clamped / 12);
}

function chordAt(i) {
  if (i < POCKET) return state.groove.pocket[i % POCKET];
  return state.groove.space[(i - POCKET) % SPACE];
}

function zone(i) { return i < POCKET ? "pocket" : "space"; }

function playBuf(name, when, rate = 1, gain = 0.4, duration = 0.2) {
  if (missing.includes(name) || !sampleBuffers[name] || !ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = sampleBuffers[name];
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.01);
  g.gain.setValueAtTime(gain, when + Math.max(0.05, duration - 0.02));
  g.gain.linearRampToValueAtTime(0, when + duration);
  src.connect(g);
  g.connect(master);
  src.start(when);
  src.stop(when + duration + 0.05);
  state.activeSources.push(src);
  src.onended = () => {
    const idx = state.activeSources.indexOf(src);
    if (idx > -1) state.activeSources.splice(idx, 1);
  };
}

function scheduleStep(step, time) {
  const barIndex = Math.floor(step / STEPS_PER_BAR) % TOTAL_BARS;
  const s = step % STEPS_PER_BAR;
  const ch = chordAt(barIndex);
  const z = zone(barIndex);
  const rec = state.recipe.id;
  const onSpace = z === "space";
  const stepDur = 60 / state.bpm / 4;

  // Kit
  if (s % 2 === 0) {
    const hatGain = onSpace && rec === "hats-off" ? 0 : 0.07;
    if (hatGain > 0) playBuf("hat", time, 1, hatGain, 0.15);
  }
  if (s === 0) playBuf("kick", time, 1, onSpace && rec === "kit-thin" ? 0.5 : 0.7, 0.3);
  if (s === 8 && !(onSpace && rec === "stop-space" && barIndex === 6)) playBuf("snare", time, 1, onSpace ? 0.3 : 0.45, 0.25);

  if (onSpace && rec === "stop-space" && barIndex === 6 && s < 12) return;

  // Bass
  if (s === 0) {
    let bassMidi = ch.bass;
    playBuf("bA1", time, rateFromMidi(bassMidi, 33), onSpace && rec === "one-chair" ? 0.5 : 0.45, onSpace && rec === "bass-pedal" ? 1.8 : 0.4);
  }

  // Piano
  if (s === 0 && !(onSpace && rec === "one-chair")) {
    playBuf("pC4", time, rateFromMidi(ch.piano[2] || 60, 60), onSpace ? 0.18 : 0.28, 0.5);
    playBuf("pA3", time, rateFromMidi(ch.piano[1] || 57, 57), 0.16, 0.5);
  }

  // Guitar
  if (s === 0 && !(onSpace && (rec === "one-chair" || rec === "bass-pedal"))) {
    playBuf("gA2", time, rateFromMidi(ch.guitar[0] || 45, 45), onSpace && rec === "nylon-sparse" ? 0.15 : 0.22, 0.35);
  }
  if (onSpace && rec === "nylon-sparse" && s === 8) playBuf("gE3", time, rateFromMidi((ch.guitar[1] || 52) + 1, 52), 0.2, 0.2);

  // Violin hold
  if (onSpace && rec === "violin-hold" && s === 0) {
    playBuf("vA3", time, rateFromMidi(ch.piano[2] || 60, 57), 0.25, 3.5);
  }

  // Trumpet
  if (onSpace && rec === "trumpet-door" && barIndex === 7 && s === 14) {
    playBuf("tC4", time, rateFromMidi(ch.piano[3] || 69, 60), 0.38, 0.4);
  }
}

function scheduler() {
  if (!state.playing) return;
  while (state.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(state.step, state.nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    state.nextStepTime += stepDur;
    state.step = (state.step + 1) % (TOTAL_BARS * STEPS_PER_BAR);
    state.bar = Math.floor(state.step / STEPS_PER_BAR);
  }
}

function start(mode) {
  if (ctx.state === "suspended") ctx.resume();
  stop();
  state.playing = true;
  state.mode = mode;
  state.step = mode === "eight" ? POCKET * STEPS_PER_BAR : 0;
  state.nextStepTime = ctx.currentTime + 0.1;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  requestAnimationFrame(updatePlayhead);
}

function stop() {
  state.playing = false;
  state.mode = null;
  if (timerId) clearInterval(timerId);
  timerId = null;
  state.activeSources.forEach(src => { try { src.stop(); } catch (e) {} });
  state.activeSources = [];
  paintBars();
}

function updatePlayhead() {
  if (!state.playing) return;
  const stepDur = 60 / state.bpm / 4;
  const approxStep = Math.floor((ctx.currentTime - 0.1) / stepDur) % (TOTAL_BARS * STEPS_PER_BAR);
  state.bar = Math.floor(approxStep / STEPS_PER_BAR);
  paintBars();
  requestAnimationFrame(updatePlayhead);
}

function punch() {
  const g = state.groove, r = state.recipe;
  return `SpaceFour punch list\n${g.name} · ${state.bpm} BPM · ${state.key} · ${r.name}\n\nThe problem: the chorus slams at full height with no air. Session players write four live bars of space, then the hook lands.\nThe move: ${r.blurb}\n\nPocket (bars 1-4)\n${g.pocket.map((b,i)=>`  ${i+1}. ${b.symbol}`).join("\n")}\n\nSpace (bars 5-8) — ${r.name}\n${g.space.map((b,i)=>`  ${i+5}. ${b.symbol}`).join("\n")}\n\nLive chairs only. Distinct from TagFour, LiftTwo, ModEight, PreEight, AfterHook, EndEight, LastHook.\nDrop the WAV on bars 5-8. Do not slam without the air.`;
}

function paintGrooves() {
  const el = document.getElementById("grooves"); el.innerHTML = "";
  grooves.forEach(g => {
    const b = document.createElement("button");
    b.className = "card" + (state.groove.id === g.id ? " on" : "");
    b.innerHTML = `<b>${g.name}</b><span>${g.bpm} BPM · ${g.key}</span>`;
    b.onclick = () => { state.groove = g; state.bpm = g.bpm; document.getElementById("bpm").value = g.bpm; render(); };
    el.appendChild(b);
  });
}

function paintRecipes() {
  const el = document.getElementById("recipes"); el.innerHTML = "";
  recipes.forEach(r => {
    const b = document.createElement("button");
    b.className = "card" + (state.recipe.id === r.id ? " on" : "");
    b.innerHTML = `<b>${r.name}</b><span>${r.blurb}</span>`;
    b.onclick = () => { state.recipe = r; render(); };
    el.appendChild(b);
  });
}

function paintBars() {
  const el = document.getElementById("bars"); el.innerHTML = "";
  for (let i = 0; i < TOTAL_BARS; i++) {
    const ch = chordAt(i); const z = zone(i);
    const d = document.createElement("div");
    d.className = "bar " + z + (state.playing && state.bar === i ? " active" : "");
    const label = z === "pocket" ? "P" : "S";
    d.innerHTML = `<div class="n">${i+1} · ${label}</div><div class="c">${ch.symbol}</div>`;
    el.appendChild(d);
  }
}

function render() { paintGrooves(); paintRecipes(); paintBars(); document.getElementById("punch").textContent = punch(); }

async function exportWav(withTail = false) {
  if (missing.length) { alert("Cannot export: missing samples " + missing.join(", ")); return; }
  const sampleRate = 48000;
  const bars = TOTAL_BARS;
  const bpm = state.bpm;
  const length = Math.round(bars * 4 * 60 / bpm * sampleRate);
  const tailSamples = sampleRate * 2;
  const offline = new OfflineAudioContext(2, length + tailSamples, sampleRate);

  const offlineBuffers = {};
  for (const [k, ab] of Object.entries(state.rawBuffers)) {
    try {
      offlineBuffers[k] = await offline.decodeAudioData(ab.slice(0));
    } catch (e) { console.warn("Offline decode failed", k); }
  }

  const offlineMaster = offline.createGain();
  offlineMaster.gain.value = 0.7;
  const offlineComp = offline.createDynamicsCompressor();
  offlineComp.threshold.value = -12;
  offlineComp.ratio.value = 20;
  offlineMaster.connect(offlineComp);
  offlineComp.connect(offline.destination);

  function playOffline(name, when, rate = 1, gain = 0.4, duration = 0.2) {
    if (!offlineBuffers[name]) return;
    const src = offline.createBufferSource();
    src.buffer = offlineBuffers[name];
    src.playbackRate.value = rate;
    const g = offline.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.setValueAtTime(gain, when + Math.max(0.05, duration - 0.02));
    g.gain.linearRampToValueAtTime(0, when + duration);
    src.connect(g);
    g.connect(offlineMaster);
    src.start(when);
    src.stop(when + duration + 0.05);
  }

  let nextTime = 0;
  const stepDur = 60 / bpm / 4;
  for (let step = 0; step < bars * STEPS_PER_BAR; step++) {
    const barIndex = Math.floor(step / STEPS_PER_BAR) % bars;
    const s = step % STEPS_PER_BAR;
    const ch = chordAt(barIndex);
    const z = zone(barIndex);
    const rec = state.recipe.id;
    const onSpace = z === "space";

    if (s % 2 === 0) {
      const hatGain = onSpace && rec === "hats-off" ? 0 : 0.07;
      if (hatGain > 0) playOffline("hat", nextTime, 1, hatGain, 0.15);
    }
    if (s === 0) playOffline("kick", nextTime, 1, onSpace && rec === "kit-thin" ? 0.5 : 0.7, 0.3);
    if (s === 8 && !(onSpace && rec === "stop-space" && barIndex === 6)) playOffline("snare", nextTime, 1, onSpace ? 0.3 : 0.45, 0.25);

    if (onSpace && rec === "stop-space" && barIndex === 6 && s < 12) { nextTime += stepDur; continue; }

    if (s === 0) {
      let bassMidi = ch.bass;
      playOffline("bA1", nextTime, rateFromMidi(bassMidi, 33), onSpace && rec === "one-chair" ? 0.5 : 0.45, onSpace && rec === "bass-pedal" ? 1.8 : 0.4);
    }
    if (s === 0 && !(onSpace && rec === "one-chair")) {
      playOffline("pC4", nextTime, rateFromMidi(ch.piano[2] || 60, 60), onSpace ? 0.18 : 0.28, 0.5);
      playOffline("pA3", nextTime, rateFromMidi(ch.piano[1] || 57, 57), 0.16, 0.5);
    }
    if (s === 0 && !(onSpace && (rec === "one-chair" || rec === "bass-pedal"))) {
      playOffline("gA2", nextTime, rateFromMidi(ch.guitar[0] || 45, 45), onSpace && rec === "nylon-sparse" ? 0.15 : 0.22, 0.35);
    }
    if (onSpace && rec === "nylon-sparse" && s === 8) playOffline("gE3", nextTime, rateFromMidi((ch.guitar[1] || 52) + 1, 52), 0.2, 0.2);
    if (onSpace && rec === "violin-hold" && s === 0) {
      playOffline("vA3", nextTime, rateFromMidi(ch.piano[2] || 60, 57), 0.25, 3.5);
    }
    if (onSpace && rec === "trumpet-door" && barIndex === 7 && s === 14) {
      playOffline("tC4", nextTime, rateFromMidi(ch.piano[3] || 69, 60), 0.38, 0.4);
    }
    nextTime += stepDur;
  }

  const rendered = await offline.startRendering();
  const dataL = rendered.getChannelData(0);
  const dataR = rendered.getChannelData(1);
  if (!withTail) {
    for (let i = 0; i < Math.min(tailSamples, length); i++) {
      dataL[i] += dataL[length + i] || 0;
      dataR[i] += dataR[length + i] || 0;
    }
  }
  let peak = 0;
  const checkLen = withTail ? rendered.length : length;
  for (let i = 0; i < checkLen; i++) {
    peak = Math.max(peak, Math.abs(dataL[i]), Math.abs(dataR[i]));
  }
  const scale = peak > 0 ? (Math.pow(10, -1/20) / peak) : 1;
  for (let i = 0; i < checkLen; i++) {
    dataL[i] *= scale;
    dataR[i] *= scale;
  }

  const outLength = withTail ? rendered.length : length;
  const outBuffer = offline.createBuffer(2, outLength, sampleRate);
  outBuffer.copyToChannel(dataL.subarray(0, outLength), 0);
  outBuffer.copyToChannel(dataR.subarray(0, outLength), 1);

  const wav = encodeWAV(outBuffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `spacefour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/ /g, "")}${withTail ? "-withtail" : ""}.wav`;
  a.click();
}

function encodeWAV(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 3;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferOut = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bufferOut);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 24, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = Math.floor(sample * 0x7FFFFF);
      view.setUint8(offset, sample & 0xFF);
      view.setUint8(offset + 1, (sample >> 8) & 0xFF);
      view.setUint8(offset + 2, (sample >> 16) & 0xFF);
      offset += 3;
    }
  }
  return bufferOut;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function exportMidi() {
  const bpm = state.bpm;
  const ppq = 480;
  const bars = TOTAL_BARS;
  const ticksPerBar = ppq * 4;

  function midiFile(tracks) {
    const header = new Uint8Array([0x4D,0x54,0x68,0x64, 0,0,0,6, 0,1, 0,tracks.length, (ppq>>8)&0xFF, ppq&0xFF]);
    let data = header;
    tracks.forEach(t => {
      const trackData = new Uint8Array(t);
      const len = trackData.length;
      const chunk = new Uint8Array(8 + len);
      chunk.set([0x4D,0x54,0x72,0x6B, (len>>24)&0xFF, (len>>16)&0xFF, (len>>8)&0xFF, len&0xFF], 0);
      chunk.set(trackData, 8);
      const merged = new Uint8Array(data.length + chunk.length);
      merged.set(data); merged.set(chunk, data.length);
      data = merged;
    });
    return data;
  }

  const usPerQuarter = Math.round(60000000 / bpm);
  const tempoTrack = [
    0x00, 0xFF, 0x51, 0x03, (usPerQuarter>>16)&0xFF, (usPerQuarter>>8)&0xFF, usPerQuarter&0xFF,
    0x00, 0xFF, 0x2F, 0x00
  ];

  const noteTrack = [0x00, 0xC0, 0x00];
  for (let b = 0; b < bars; b++) {
    const delta = b === 0 ? 0 : ticksPerBar;
    noteTrack.push((delta >> 8) & 0xFF, delta & 0xFF, 0x90, 36, 100);
    noteTrack.push(0x00, 0x80, 36, 0);
  }
  noteTrack.push(0x00, 0xFF, 0x2F, 0x00);

  const blob = new Blob([midiFile([tempoTrack, noteTrack])], { type: "audio/midi" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `spacefour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/ /g, "")}.mid`;
  a.click();
}

document.getElementById("playA").onclick = () => start("loop");
document.getElementById("playB").onclick = () => start("cut");
document.getElementById("play8").onclick = () => start("eight");
document.getElementById("stop").onclick = stop;
document.getElementById("copy").onclick = () => navigator.clipboard.writeText(punch());
document.getElementById("exportWav").onclick = () => exportWav(false);
document.getElementById("exportTail").onclick = () => exportWav(true);
document.getElementById("exportMidi").onclick = exportMidi;
document.getElementById("bpm").onchange = (e) => { state.bpm = Math.max(60, Math.min(180, +e.target.value)); render(); };
document.getElementById("key").onchange = (e) => { state.key = e.target.value; render(); };

document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });

async function init() {
  ctx = new AudioContext();
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  await loadSamples();
  render();
  const saved = localStorage.getItem("spacefour");
  if (saved) {
    const p = JSON.parse(saved);
    state.bpm = p.bpm || 92;
    state.key = p.key || "A minor";
    document.getElementById("bpm").value = state.bpm;
    document.getElementById("key").value = state.key;
  }
  window.addEventListener("beforeunload", () => {
    localStorage.setItem("spacefour", JSON.stringify({ bpm: state.bpm, key: state.key }));
  });
}

init();
