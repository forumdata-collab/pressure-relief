// rPPG core signal math — pure functions, no DOM, no globals.
// Browser: window.RPPG_MATH.  Node: require('./rppg-math.js').
// Kept separate so it is unit-testable without a camera/DOM.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.RPPG_MATH = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ---- GRGB constants (rPPG band of interest) ----
  const BAND_LOW = 0.7, BAND_HIGH = 3.0, WIN_SEC = 10;

  // Mean RGB of an elliptical region (fractions of canvas). Stride 2 px.
  function _roiMean(d, w, h, [cx, cy, rx, ry]) {
    const x0 = Math.max(1, ((cx - rx) * w) | 0), x1 = Math.min(w - 2, ((cx + rx) * w) | 0);
    const y0 = Math.max(1, ((cy - ry) * h) | 0), y1 = Math.min(h - 2, ((cy + ry) * h) | 0);
    let r = 0, g = 0, b = 0, c = 0;
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; c++;
    }
    return c ? { r: r / c, g: g / c, b: b / c } : null;
  }

  // GRGB signal: per-frame G/R + G/B averaged across ROIs (light-invariant).
  function buildSignal(buf) {
    if (!buf || !buf.length) return new Float32Array(0);
    const N = buf.length;
    const sig = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, n = 0;
      for (const k of ['f', 'l', 'r']) {
        const o = buf[i][k];
        if (o.r > 1 && o.b > 1) { s += (o.g / o.r) + (o.g / o.b); n++; }
      }
      sig[i] = n ? s / n : 0;
    }
    return sig;
  }

  // Smoothness-prior detrend (moving-average subtract, ~1s window).
  function detrendSig(sig, lambda = 100) {
    const N = sig.length;
    const win = Math.max(2, Math.round(N / 10));
    const out = new Float32Array(N);
    let acc = 0; const q = [];
    for (let i = 0; i < N; i++) {
      q.push(sig[i]); acc += sig[i];
      if (q.length > win) acc -= q.shift();
      out[i] = sig[i] - acc / q.length;
    }
    return out;
  }

  // One-pole HP+LP cascade bandpass.
  function bandpass(sig, fs, lo, hi) {
    const out = new Float32Array(sig.length), dt = 1 / fs;
    const aL = dt / (1 / (2 * Math.PI * lo) + dt), aH = (1 / (2 * Math.PI * hi)) / (1 / (2 * Math.PI * hi) + dt);
    let hp = 0, lp = 0;
    for (let i = 0; i < sig.length; i++) {
      hp = aH * (hp + sig[i] - (i > 0 ? sig[i - 1] : 0));
      lp += aL * (hp - lp);
      out[i] = lp;
    }
    return out;
  }

  function hanning(n) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    return w;
  }

  // Hann-windowed DFT peak + parabolic interp + SNR. Returns {bpm, snr}.
  function fftPeak(sig, fs, loHz, hiHz) {
    if (!sig || sig.length < 4 || !fs) return { bpm: null, snr: 0 };
    let N = 1; while (N < sig.length) N <<= 1;
    const seg = new Float64Array(N);
    seg.set(sig);
    const hw = hanning(sig.length);
    for (let i = 0; i < sig.length; i++) seg[i] *= hw[i];
    const binHz = fs / N;
    const loBin = Math.max(1, Math.floor(loHz / binHz));
    const hiBin = Math.min(Math.floor(hiHz / binHz), N >> 1);
    let bestK = -1, bestMag = -1;
    const mags = [];
    for (let k = loBin; k <= hiBin; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; re += seg[n] * Math.cos(a); im += seg[n] * Math.sin(a); }
      const m = re * re + im * im; mags.push(m);
      if (m > bestMag) { bestMag = m; bestK = k; }
    }
    if (bestK < 0 || !mags.length) return { bpm: null, snr: 0 };
    const idx = bestK - loBin;
    let delta = 0;
    if (idx > 0 && idx < mags.length - 1) {
      const a = Math.log(mags[idx - 1] + 1e-12), b = Math.log(mags[idx] + 1e-12), c = Math.log(mags[idx + 1] + 1e-12);
      delta = 0.5 * (a - c) / (a - 2 * b + c || 1e-12);
    }
    const devBins = Math.round(0.2 / binHz);
    let sigP = 0, noiseP = 0;
    mags.forEach((m, i) => {
      const k = i + loBin;
      if (Math.abs(k - bestK) <= devBins || Math.abs(k - 2 * bestK) <= devBins) sigP += m;
      else noiseP += m;
    });
    const snr = 10 * Math.log10((sigP + 1e-9) / (noiseP + 1e-9));
    return { bpm: (bestK + delta) * binHz * 60, snr };
  }

  return { BAND_LOW, BAND_HIGH, WIN_SEC, _roiMean, buildSignal, detrendSig, bandpass, hanning, fftPeak };
});
