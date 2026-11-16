/* WebAudio-synthesised sound effects. No audio files. */
(function () {
  'use strict';
  var ac = null, master = null, muted = false, holds = {}, last = {};
  function held() { for (var k in holds) if (holds[k]) return true; return false; }
  function ensure() {
    if (ac) return ac;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      ac = new C();
      master = ac.createGain(); master.gain.value = 0.55;
      var comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
    } catch (e) { ac = null; }
    return ac;
  }
  function sync() {
    if (!ac) return;
    try {
      if (muted || held()) { if (ac.state === 'running') ac.suspend().catch(function () {}); }
      else if (ac.state !== 'running') ac.resume().catch(function () {});
    } catch (e) {}
  }
  function unlock() { if (muted || held()) return; ensure(); sync(); }

  function tone(type, f0, f1, dur, vol, delay, lp) {
    var t0 = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = o;
    if (lp) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function buzz(dur, vol, base) {
    var t0 = ac.currentTime;
    var o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator();
    var g = ac.createGain(), lg = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t0); o.frequency.linearRampToValueAtTime(base * 1.25, t0 + dur);
    o2.frequency.setValueAtTime(base * 1.01, t0); o2.frequency.linearRampToValueAtTime(base * 1.27, t0 + dur);
    lfo.frequency.value = 32; lg.gain.value = vol * 0.5;
    f.type = 'lowpass'; f.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    [o, o2, lfo].forEach(function (x) { x.start(t0); x.stop(t0 + dur + 0.05); });
  }
  var S = {
    send: function () { buzz(0.38, 0.09, 170); },
    good: function () { tone('sine', 520, 980, 0.13, 0.16); tone('triangle', 780, 1300, 0.1, 0.06, 0.03); },
    bad: function () { tone('square', 320, 110, 0.2, 0.07, 0, 1400); },
    // hive taken: a low thump, a short swarm buzz, then a bright rising chord with a sparkle on top
    capture: function () {
      tone('sine', 190, 55, 0.22, 0.32);
      buzz(0.28, 0.07, 230);
      [523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, f * 1.01, 0.32, 0.17, 0.06 + i * 0.06); });
      tone('sine', 2093, 2637, 0.18, 0.06, 0.32);
    },
    lostHive: function () { tone('sine', 330, 150, 0.35, 0.16); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, f, 0.28, 0.15, i * 0.12); }); [523, 659, 784].forEach(function (f) { tone('sine', f, f, 0.9, 0.07, 0.5); }); },
    lose: function () { tone('sawtooth', 196, 92, 1.1, 0.12, 0, 600); tone('sine', 147, 70, 1.2, 0.12, 0.1); },
    click: function () { tone('sine', 900, 600, 0.06, 0.08); },
    sting: function () { tone('square', 1900, 1500, 0.035, 0.025, 0, 3000); },
    portal: function () { tone('sine', 300, 1300, 0.28, 0.12); },
    fight: function () { tone('square', 220, 140, 0.12, 0.05, 0, 900); },
    ability: function () { tone('triangle', 440, 880, 0.2, 0.12); tone('sine', 660, 1320, 0.25, 0.08, 0.06); },
    star: function () { tone('triangle', 1046, 1568, 0.16, 0.12); }
  };
  function play(name) {
    if (muted || held() || !ac || ac.state !== 'running' || !S[name]) return;
    var now = (window.performance && performance.now()) || Date.now();
    if (last[name] && now - last[name] < 70) return;
    last[name] = now;
    try { S[name](); } catch (e) {}
  }
  window.Sfx = {
    unlock: unlock, play: play,
    setMuted: function (m) { muted = !!m; sync(); },
    hold: function (reason) { holds[reason] = true; sync(); },
    release: function (reason) { holds[reason] = false; sync(); },
    get muted() { return muted; }
  };
})();
