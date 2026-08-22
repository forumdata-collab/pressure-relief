# 🧘 釋放壓力空間 — Pressure Relief

> 呼吸 × 心率 × 冥想 × 音樂 — 單檔無後端減壓應用。純靜態部署，離線可用。

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://forumdata-collab.github.io/pressure-relief/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live:** https://forumdata-collab.github.io/pressure-relief/
**Repo:** https://github.com/forumdata-collab/pressure-relief

---

## ✨ 功能

| 模組 | 說明 |
|------|------|
| 🫁 呼吸引導 | 4-7-8 / 盒式 / 共振 5-5，rAF 驅動圓環縮放 + 進度條 |
| 📷 心跳偵測 | rPPG POS + FaceMesh 皮膚遮罩 + IIR bandpass + FFT 峰值 → BPM |
| 🎵 放鬆音樂 | Web Audio 合成：細雨 / 海浪 / 森林 / 冥想 drone |
| ⏱️ 冥想計時 | 3/5/10/20 分鐘，進度條 + 528Hz 完成鈴聲 |
| 📊 壓力指數 | SVG 弧形儀表 + 指針，依 BPM 映射壓力等級 |
| 📝 心情日記 | localStorage 持久化，最多 15 筆 |

---

## 🏗️ 架構

```
index.html          # 單檔應用（HTML/CSS/JS 合一）
wasm/
  face_mesh.wasm    # MediaPipe FaceMesh WASM（本地）
  face_mesh.js
  face_mesh_solution_packed_assets.data
```

- 零後端、零建置步驟，直接由 GitHub Pages 託管。
- FaceMesh WASM 本地化，首次載入後離線可用。

---

## 🔬 rPPG 實作細節

### 1. ROI 擷取

- **有 FaceMesh：** 468 關鍵點中選取額頭/臉頰/下巴皮膚點（`FACE_SKIN_IDS` 約 100 點），每點取 3×3 patch 平均，排除眼唇頭髮。
- **無 FaceMesh：** 橢圓 fallback（中心偏上 `cy=0.45h`，`rx=0.25w, ry=0.3h`），每 2 像素採樣。

### 2. POS 演算法（hschn58/rPPG）

滑動視窗 `WIN_LEN_SEC=1.6s, overlap=50%`：

```
r=R/mean(R), g=G/mean(G), b=B/mean(B)   # 視窗內正規化
X = 3r - 2g
Y = 1.5r + g - 1.5b
alpha = std(X) / (std(Y) + eps)
S = X - alpha * Y                       # POS 脈搏
pulse += S * hanning(L)                 # overlap-add
```

### 3. 帶通濾波

二階 IIR bandpass `0.7–4.0 Hz`（42–240 BPM），去除 DC 漂移與高頻雜訊。

### 4. FFT 峰值

256 點 DFT，僅計算 `0.7–4.0 Hz` 頻段，取最大幅值對應頻率 `bpm = f_peak * 60`。

### 5. 平滑

5 幀滾動平均防抖動，鉗制 `50–120 BPM`。

> 參考：[hschn58/rPPG](https://github.com/hschn58/rPPG) — Nature Sensors 2026

---

## 💻 本地運行

```bash
git clone https://github.com/forumdata-collab/pressure-relief
cd pressure-relief
python3 -m http.server 8000
# 開啟 http://localhost:8000
# 需 HTTPS 或 localhost 才能存取攝像頭
```

---

## 🚀 部署

已啟用 GitHub Pages（`main` 分支根目錄）。推送至 `main` 自動部署，約 1–2 分鐘生效。

---

## ⚠️ 免責聲明

- 心跳偵測為簡化 rPPG，僅供放鬆參考，**不能取代醫療設備**。
- 血壓偵測因準確度限制**未實作**。
- 如有健康疑慮請諮詢專業醫療人員。

---

## 📄 授權

MIT
