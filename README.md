# 🧘 釋放壓力空間 — Pressure Relief

> 呼吸 × 心率 × 冥想 × 音樂 — 無後端減壓應用。純靜態部署，離線可用。

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://forumdata-collab.github.io/pressure-relief/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live:** https://forumdata-collab.github.io/pressure-relief/
**Repo:** https://github.com/forumdata-collab/pressure-relief

---

## ✨ 功能

| 模組 | 說明 |
|------|------|
| 🫁 呼吸引導 | 4-7-8 / 盒式 / 共振 5-5，rAF 驅動圓環縮放 + 進度條 |
| 😊 面部心率 | rPPG：固定 3-ROI GRGB + bandpass + 諧波加成 FFT + ACF 交叉驗證 → BPM（60–180）＋SNR 品質燈 🟢🟡🔴 |
| 👆 手指心率 | 後鏡頭 + 手電筒透射式 PPG（Android），訊號最強最可靠，建議優先使用 |
| 📊 進階指標 | HRV (RMSSD) · 呼吸率（RSA tachogram，~60s 累計）· 壓力指數 · 心臟負荷 |
| 🎵 放鬆音樂 | Web Audio 合成：細雨 / 海浪 / 森林 / 冥想 drone |
| ⏱️ 冥想計時 | 3/5/10/20 分鐘，進度條 + 528Hz 完成鈴聲 |
| 📝 心情日記 | localStorage 持久化 |

---

## 🏗️ 架構

```
index.html       # UI + 採樣迴圈（requestVideoFrameCallback）
rppg-math.js     # 核心核心訊號數學（純函數、零依賴、可單元測試）
sw.js            # Service Worker — HTML network-first，資產 cache-first
test-rppg.js     # node test-rppg.js — 9 個邊界測試
```

- 零後端、零建置步驟，GitHub Pages 託管。
- 影像只在裝置本機處理，不會上傳。

---

## 🔬 rPPG 實作細節（v22+）

1. **採樣** — 影片 cover-crop 至 160×120 離屏 canvas，`getImageData` 每幀一次。
2. **ROI** — 固定比例三區（額頭 + 雙頰，正面居中假設）；手指模式取畫面中央大區域。
3. **GRGB 訊號** — `G/R + G/B` 三區平均（Casal 2023），光照不變式。
4. **濾波** — 移動平均 detrend（~1s 窗）→ 一階 HP+LP bandpass **1.0–3.0 Hz**（60–180 BPM）。
5. **峰值** — Hann DFT + **諧波加成評分**（自身能量 + 二次諧波能量；需 ≥10% max 自身門檻防次諧波鎖定）+ 幅度域拋物線內插亞 bin 精度。
6. **ACF 交叉驗證** — 自相關搵主週期；與 FFT 一致取平均，分歧且信心 r≥0.3 先信 ACF。
7. **顯示** — 中位數 of 5 平滑；SNR <1dB 及 45–160 BPM 以外丟棄；SNR 品質燈 🟢≥5dB 🟡≥2dB 🔴<2dB。

---

## 🧱 開發瓶頸與教訓

實際撞過嘅牆（按痛的程度排序），俾同樣做 browser rPPG 嘅人參考：

| # | 瓶頸 | 徵狀 | 解法 |
|---|------|------|------|
| 1 | **MediaPipe self-host 地獄** | npm 包入面有兩個唔同名嘅 `face_mesh.js`——攞錯嗰個（內部 ESM wasm 模組）`FaceMesh` 全域永遠不存在，靜默失敗；仲要 `binarypb`、SIMD wasm 等 7 個檔案齊先行到 | 最終整個移除 FaceMesh，改固定 ROI。要 self-host 就 copy 成個 npm tarball + headless browser 驗證 onResults 有 fire |
| 2 | **SW 快取食住舊版** | 改咗代碼用戶永遠見舊版。cache-first HTML + sw.js 本身有 10 分鐘 HTTP cache | HTML network-first；`skipWaiting` + `clients.claim()` + `register(…, {updateViaCache:'none'})` |
| 3 | **樣本數 vs 牆上時鐘** | buffer 上限用樣本數（300@60fps=5s），但顯示門檻查時間跨度（8s）→ 倒數永久凍結 | buffer 一律按時間跨度裁切，樣本數只做保險絲 |
| 4 | **呼吸諧波搶峰** | 心率長期讀 ~50：呼吸 15-17/min 嘅諧波正正落喺 0.75-0.85Hz | band 下限提到 1.0Hz + 諧波加成評分 + ACF 交叉驗證（信心門檻 r≥0.3，唔信冇憑證嘅 override——v29 盲信 ACF 反而被另一個假峰拉去 49-52） |
| 5 | **landmark 座標系不符** | FaceMesh normalize 到原生 video frame（多數橫向 640×480），硬拉去直向 canvas → 面變形、overlay 錯位 | cover-crop drawImage + landmark 用同一變換映射 |
| 6 | **每幀重活拖垮 fps** | 全幅 getImageData + JS pixel blur 每幀做 → fps 跌穿 12fps 門檻 → 數據永遠出唔到 | 降採樣 160×120、blur 刪除、rvfc 取代 rAF |
| 7 | **單位 bug** | IBI 序列（ms）餵俾 FFT 時 fs 寫錯 `60/meanMs`=0.07Hz → loBin>hiBin → 呼吸率恆定 null | `1000/meanMs`；所有物理量寫明單位 |

**最大教訓：** 盲改 10 個版本不如一次 headless Chromium + fake camera 實測——console 一行錯誤頂得上十輪猜測。

---

## 💻 本地運行

```bash
git clone https://github.com/forumdata-collab/pressure-relief
cd pressure-relief
python3 -m http.server 8000
# 開啟 http://localhost:8000
# 需 HTTPS 或 localhost 才能存取攝像頭
node test-rppg.js   # 核心數學自測
```

---

## 🚀 部署

Push 到 `main` 即自動由 GitHub Pages 發布。
每次改 `index.html` 必須同步 bump `sw.js` 的 `CACHE` 版本號及頁尾版本字串。

---

## 📄 License

MIT
