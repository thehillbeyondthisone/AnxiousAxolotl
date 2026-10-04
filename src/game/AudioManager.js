/**
 * AudioManager — sample-based SFX + two looping music tracks.
 *
 * Plays the bundled WAV sound pack (see src/assets/Audio/) through Web Audio
 * with per-play random pitch so repeats don't grate, plus a title-screen
 * music track, a separate gameplay music track (crossfaded between the
 * two), and a tense low pulse while the player is being chased. The
 * AudioContext starts suspended (browser autoplay policy) and is resumed by
 * unlock() on the first user gesture.
 */

// Vite bundles every wav and hands us URLs keyed by path.
const wavUrls = import.meta.glob('../assets/Audio/*.wav', {
  eager: true, query: '?url', import: 'default'
});

import titleUrl from '../assets/Audio/anxious_axolotl.mp3';
import gameplayUrl from '../assets/Audio/anxious_axolotl_gameplay.m4a';

/** Map a logical sound name to one or more sample file stems (random pick). */
const SFX_GROUPS = {
  collect: ['squick_1', 'squick_2'],
  ui:      ['bip_1'],
  sell:    ['bing_1'],
  alert:   ['boo_1', 'boo_2'],
  caught:  ['punch_1', 'punch_2', 'punch_3'],
  refill:  ['blup_1', 'blup_2'],
  splash:  ['blup_1', 'blup_2'],
  hide:    ['squick_squick_1', 'squick_squick_2'],
  upgrade: ['flute_2'],
  phone:   ['phone_1'],
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};        // stem -> AudioBuffer
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.chaseMode = false;
    this._pulseTimer = null;
    this._loaded = false;
    this._musicVolume = 0.6;
    this._sfxVolume = 0.8;
    this._activeTrack = null; // 'title' | 'gameplay' | null
    this._fadeTimers = new Map(); // el -> interval id

    // Title-screen and gameplay music (plain HTMLAudioElements — simpler
    // for long compressed music files than decoding them into Web Audio
    // buffers). Both start silent; playTitle()/playGameplay() crossfade.
    this.titleEl = new Audio(titleUrl);
    this.titleEl.loop = true;
    this.titleEl.volume = 0;
    this.gameplayEl = new Audio(gameplayUrl);
    this.gameplayEl.loop = true;
    this.gameplayEl.volume = 0;
    for (const el of [this.titleEl, this.gameplayEl]) {
      el.addEventListener('error', () => {
        console.warn('[Audio] Music track failed to decode/load:', el.src, el.error && el.error.message);
      });
    }

    // Pause everything when the tab/window loses focus (backgrounded,
    // screen locked, etc.) and resume exactly what was playing when it
    // comes back — otherwise music (and SFX, via the suspended context)
    // keeps running silently behind a locked phone screen.
    this._wasPlayingOnHide = null;
    document.addEventListener('visibilitychange', () => this._handleVisibilityChange());
  }

  _handleVisibilityChange() {
    if (document.hidden) {
      this._wasPlayingOnHide = this._activeTrack;
      if (!this.titleEl.paused) this.titleEl.pause();
      if (!this.gameplayEl.paused) this.gameplayEl.pause();
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    } else {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      const el = this._wasPlayingOnHide === 'title' ? this.titleEl
        : this._wasPlayingOnHide === 'gameplay' ? this.gameplayEl : null;
      if (el && el.paused) el.play().catch(() => {});
      this._wasPlayingOnHide = null;
    }
  }

  /** Kept as plain properties historically but not applied to gain nodes —
   * these accessors make the volume sliders actually take effect. */
  get musicVolume() { return this._musicVolume; }
  set musicVolume(v) {
    this._musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = 0.35 * v / 0.6;
    // Re-apply to whichever track is actually audible right now (accounting
    // for the chase duck) rather than stomping on a track mid-fade to 0.
    const activeEl = this._activeTrack === 'gameplay' ? this.gameplayEl
      : this._activeTrack === 'title' ? this.titleEl : null;
    if (activeEl) {
      const duck = (this._activeTrack === 'gameplay' && this.chaseMode) ? 0.4 : 1;
      activeEl.volume = Math.max(0, Math.min(1, v * duck));
    }
  }
  get sfxVolume() { return this._sfxVolume; }
  set sfxVolume(v) {
    this._sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, v));
  }

  /** Smoothly ramp an <audio> element's volume, pausing it once faded to 0. */
  _fadeVolume(el, target, duration = 900) {
    const existing = this._fadeTimers.get(el);
    if (existing) clearInterval(existing);
    const steps = 20;
    const stepMs = Math.max(16, duration / steps);
    const start = el.volume;
    const delta = target - start;
    let i = 0;
    const id = setInterval(() => {
      i++;
      el.volume = Math.max(0, Math.min(1, start + delta * (i / steps)));
      if (i >= steps) {
        el.volume = Math.max(0, Math.min(1, target));
        clearInterval(id);
        this._fadeTimers.delete(el);
        if (target <= 0) el.pause();
      }
    }, stepMs);
    this._fadeTimers.set(el, id);
  }

  /** Crossfade into the title-screen track. */
  playTitle(duration = 900) {
    this._activeTrack = 'title';
    if (this.titleEl.paused) this.titleEl.play().catch((e) => console.warn('[Audio] Title music blocked/failed:', e));
    this._fadeVolume(this.titleEl, this._musicVolume, duration);
    this._fadeVolume(this.gameplayEl, 0, duration);
  }

  /** Crossfade into the gameplay track. */
  playGameplay(duration = 900) {
    this._activeTrack = 'gameplay';
    if (this.gameplayEl.paused) this.gameplayEl.play().catch((e) => console.warn('[Audio] Gameplay music blocked/failed:', e));
    const target = this.chaseMode ? this._musicVolume * 0.4 : this._musicVolume;
    this._fadeVolume(this.gameplayEl, target, duration);
    this._fadeVolume(this.titleEl, 0, duration);
  }

  /** Create the context and start decoding samples (safe pre-gesture). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35 * this._musicVolume / 0.6;
    this.musicGain.connect(this.master);

    // Decode all samples in the background.
    const jobs = Object.entries(wavUrls).map(async ([path, url]) => {
      const stem = path.split('/').pop().replace('.wav', '');
      try {
        const data = await (await fetch(url)).arrayBuffer();
        this.buffers[stem] = await this.ctx.decodeAudioData(data);
      } catch (e) { /* missing sample -> synth fallback keeps working */ }
    });
    Promise.all(jobs).then(() => { this._loaded = true; });
  }

  /** Resume the context on first user gesture. */
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * Play a named SFX. Falls back to a tiny synth blip while samples decode.
   * @param {string} name - key of SFX_GROUPS
   * @param {object} [opts] - { volume, rate }
   */
  play(name, opts = {}) {
    if (!this.ctx) return;
    const group = SFX_GROUPS[name];
    const stem = group && group[Math.floor(Math.random() * group.length)];
    const buf = stem && this.buffers[stem];
    if (!buf) { this._synthBlip(name); return; }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // ±8% random pitch, or explicit rate
    src.playbackRate.value = opts.rate || (0.92 + Math.random() * 0.16);
    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 0.9;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  /** Minimal oscillator blip used only before samples finish decoding. */
  _synthBlip(name) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(name === 'caught' ? 180 : 520, now);
    g.gain.setValueAtTime(0.08, now);
    g.gain.linearRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.12);
  }

  /** Toggle the looping rain wash (filtered noise, faded in/out). */
  setRain(on) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (on && !this._rainSrc) {
      if (!this._rainBuf) {
        // 2s of white noise, generated once
        const len = this.ctx.sampleRate * 2;
        this._rainBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const ch = this._rainBuf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = this._rainBuf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.10, now + 1.5);
      src.connect(filter); filter.connect(g); g.connect(this.master);
      src.start();
      this._rainSrc = src;
      this._rainGain = g;
    } else if (!on && this._rainSrc) {
      const src = this._rainSrc, g = this._rainGain;
      this._rainSrc = this._rainGain = null;
      g.gain.linearRampToValueAtTime(0.001, now + 1.5);
      setTimeout(() => { try { src.stop(); } catch (e) {} }, 1600);
    }
  }

  /** Toggle chase tension pulse (ducks the gameplay track under it). */
  setChase(on) {
    if (on === this.chaseMode) return;
    this.chaseMode = on;
    if (on) this._startPulse(); else this._stopPulse();
    if (this._activeTrack === 'gameplay') {
      this._fadeVolume(this.gameplayEl, this._musicVolume * (on ? 0.4 : 1), 400);
    }
  }

  /** Tense low heartbeat pulse while chased. */
  _startPulse() {
    if (!this.ctx || this._pulseTimer) return;
    const beat = () => {
      this._pulseTimer = setTimeout(beat, 480);
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(72, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(now); osc.stop(now + 0.28);
    };
    beat();
  }

  _stopPulse() {
    clearTimeout(this._pulseTimer);
    this._pulseTimer = null;
  }
}
