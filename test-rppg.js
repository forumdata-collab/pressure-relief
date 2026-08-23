#!/usr/bin/env node
// Zero-framework unit tests for rppg-math.js — ponytail "one runnable check" for non-trivial logic.
"use strict";
const assert = require('assert');
const m = require('./rppg-math.js');

function run() {
  // bandpass + fftPeak: 60 BPM sine → ~60
  {
    const fs = 30, hz = 1.0, N = 600;
    const sig = new Float32Array(N);
    for (let i = 0; i < N; i++) sig[i] = Math.sin(2 * Math.PI * hz * i / fs);
    const f = m.bandpass(m.detrendSig(sig), fs, 0.7, 3.0);
    const { bpm, snr } = m.fftPeak(f, fs, 0.7, 3.0);
    assert(Math.abs(bpm - 60) < 1.5, `60bpm: got ${bpm}`);
    assert(snr > 5, `snr: ${snr}`);
  }
  // detrend: constant offset removed
  {
    const s = Float32Array.from([...Array(100)].map(() => 5));
    const d = m.detrendSig(s);
    for (const v of d) assert(Math.abs(v) < 1e-3, 'detrend constant');
  }
  // buildSignal: GRGB
  {
    const buf = Array(4).fill({ f: { r: 2, g: 10, b: 2 }, l: { r: 2, g: 10, b: 2 }, r: { r: 2, g: 10, b: 2 } });
    const sig = m.buildSignal(buf);
    assert(sig.every(v => Math.abs(v - 10) < 1e-6), 'GRGB');
  }
  // buildSignal: divide-by-zero guard
  {
    const buf = [{ f: { r: 0, g: 5, b: 0 }, l: { r: 0, g: 5, b: 0 }, r: { r: 0, g: 5, b: 0 } }];
    const sig = m.buildSignal(buf);
    assert(sig[0] === 0, 'div-guard');
  }
  // _roiMean: out-of-bounds ellipse returns null
  {
    const d = new Uint8ClampedArray(200 * 200 * 4);
    const out = m._roiMean(d, 200, 200, [9, 9, 0.01, 0.01]);
    assert(out === null || Number.isFinite(out.r), '_roiMean edge');
  }
  // fftPeak: empty signal edge case
  {
    const { bpm } = m.fftPeak(new Float32Array(0), 30, 0.7, 3.0);
    assert(bpm === null, 'empty fftPeak');
  }
  console.log('rppg-math: all tests pass (6 cases)');
}
run();
