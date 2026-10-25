(function (root) {
  "use strict";

  const scriptUrl = document.currentScript && document.currentScript.src;
  const threeUrl = new URL(
    "../vendor/three-turbine.min.js",
    scriptUrl || document.baseURI
  ).href;
  const redRobotUrl = new URL(
    "../assets/robots/red-flag.webp",
    scriptUrl || document.baseURI
  ).href;
  const blueRobotUrl = new URL(
    "../assets/robots/blue-flag.webp",
    scriptUrl || document.baseURI
  ).href;
  let threePromise;

  function loadThree() {
    if (root.ClaudeThree) return Promise.resolve(root.ClaudeThree);
    if (threePromise) return threePromise;
    threePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = threeUrl;
      script.onload = () => resolve(root.ClaudeThree);
      script.onerror = () => reject(new Error("Unable to load the 3D renderer."));
      document.head.appendChild(script);
    });
    return threePromise;
  }

  const wait = (ms) => new Promise((resolve) => root.setTimeout(resolve, ms));

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load the result image."));
      image.src = source;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to create the result image."));
      }, "image/png");
    });
  }

  function fitText(context, value, maxWidth) {
    const text = String(value);
    if (context.measureText(text).width <= maxWidth) return text;
    let output = text;
    while (output.length && context.measureText(`${output}...`).width > maxWidth) {
      output = output.slice(0, -1);
    }
    return `${output}...`;
  }

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        --detector-bg: #06111f;
        --detector-surface: #0b1f33;
        --detector-line: #24496b;
        --detector-text: #f5f1ea;
        --detector-muted: #8ea5bc;
        --detector-accent: #d97757;
        --detector-blue: #2f7df6;
        display: block;
        color: var(--detector-text);
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        letter-spacing: 0;
      }
      * { box-sizing: border-box; }
      .panel {
        position: relative;
        width: 100%;
        border: 1px solid var(--detector-line);
        background: var(--detector-bg);
      }
      .header, .summary, .signal, .footer { display: flex; align-items: center; }
      .header {
        min-height: 48px;
        padding: 0 16px;
        border-bottom: 1px solid var(--detector-line);
        font-size: 12px;
        font-weight: 700;
      }
      .privacy-bar {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border-bottom: 1px solid var(--detector-line);
        color: var(--detector-muted);
        font-size: 9px;
        line-height: 1.3;
        text-align: center;
      }
      .privacy-bar span {
        padding: 10px 6px;
        overflow-wrap: anywhere;
      }
      .privacy-bar span + span {
        border-left: 1px solid var(--detector-line);
      }
      .scan-stage {
        position: relative;
        display: none;
        width: 100%;
        height: clamp(300px, 58vw, 430px);
        overflow: hidden;
        border-bottom: 1px solid var(--detector-line);
        background:
          linear-gradient(var(--detector-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--detector-line) 1px, transparent 1px),
          var(--detector-surface);
        background-size: 40px 40px;
      }
      .panel[data-scanning] .scan-stage { display: block; }
      .panel[data-scanning] .summary,
      .panel[data-scanning] .signals { display: none; }
      .scan-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      .fallback-rotor {
        position: absolute;
        left: 50%;
        top: 46%;
        width: 150px;
        aspect-ratio: 1;
        border: 18px dashed var(--detector-accent);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        animation: fallback-spin 650ms linear infinite;
      }
      .scan-stage[data-webgl] .fallback-rotor { display: none; }
      @keyframes fallback-spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
      .scan-hud {
        position: absolute;
        inset: auto 18px 18px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 16px;
        pointer-events: none;
      }
      .scan-label { font-size: 11px; font-weight: 700; }
      .scan-count {
        color: var(--detector-accent);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .scan-progress {
        grid-column: 1 / -1;
        height: 3px;
        background: var(--detector-line);
      }
      .scan-progress span {
        display: block;
        width: 0;
        height: 100%;
        background: var(--detector-accent);
        transition: width 220ms linear;
      }
      .summary {
        align-items: stretch;
        min-height: 150px;
        border-bottom: 1px solid var(--detector-line);
      }
      .score-wrap {
        flex: 0 0 42%;
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 24px 16px;
        border-right: 1px solid var(--detector-line);
      }
      .score {
        color: var(--detector-accent);
        font-size: clamp(58px, 13vw, 92px);
        font-weight: 700;
        line-height: .8;
        font-variant-numeric: tabular-nums;
      }
      .out-of { color: var(--detector-muted); font-size: 11px; }
      .result {
        flex: 1;
        display: grid;
        align-content: center;
        gap: 12px;
        min-width: 0;
        padding: 24px 18px;
      }
      .band { font-size: 15px; }
      .description {
        margin: 0;
        color: var(--detector-muted);
        font-size: 10px;
        line-height: 1.6;
      }
      .rail { height: 3px; background: var(--detector-line); overflow: hidden; }
      .rail span {
        display: block;
        width: 0;
        height: 100%;
        background: var(--detector-accent);
        transition: width 420ms ease;
      }
      .signals { margin: 0; padding: 0; list-style: none; }
      .signal {
        display: grid;
        grid-template-columns: minmax(110px, .8fr) minmax(120px, 1.3fr) 56px;
        min-height: 55px;
        border-bottom: 1px solid var(--detector-line);
        font-size: 10px;
      }
      .signal > span { min-width: 0; padding: 12px 14px; overflow-wrap: anywhere; }
      .signal > span + span { border-left: 1px solid var(--detector-line); }
      .name { display: grid; gap: 2px; font-weight: 700; }
      .name small, .value { color: var(--detector-muted); font-size: 9px; }
      .points {
        color: var(--detector-accent);
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .footer {
        justify-content: space-between;
        gap: 14px;
        min-height: 58px;
        padding: 10px 14px;
      }
      .note { margin: 0; color: var(--detector-muted); font-size: 9px; line-height: 1.5; }
      .actions {
        display: flex;
        flex: none;
        gap: 8px;
      }
      .run-button, .share-button {
        flex: none;
        min-width: 98px;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 0;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0;
        cursor: pointer;
      }
      .run-button {
        border: 1px solid var(--detector-accent);
        background: var(--detector-accent);
        color: var(--detector-bg);
      }
      .run-button:hover { background: transparent; color: var(--detector-accent); }
      .share-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        border: 1px solid var(--detector-blue);
        background: transparent;
        color: var(--detector-blue);
      }
      .share-button:hover { background: var(--detector-blue); color: var(--detector-text); }
      .download-icon {
        position: relative;
        width: 12px;
        height: 13px;
        border-bottom: 1px solid currentColor;
      }
      .download-icon::before {
        content: "";
        position: absolute;
        left: 5px;
        top: 0;
        width: 1px;
        height: 8px;
        background: currentColor;
      }
      .download-icon::after {
        content: "";
        position: absolute;
        left: 3px;
        top: 4px;
        width: 5px;
        height: 5px;
        border-right: 1px solid currentColor;
        border-bottom: 1px solid currentColor;
        transform: rotate(45deg);
      }
      .run-button:disabled, .share-button:disabled {
        cursor: not-allowed;
        opacity: .45;
      }
      button:focus-visible { outline: 2px solid var(--detector-text); outline-offset: 2px; }
      .verdict {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        min-height: 100%;
        padding: 24px;
        overflow: hidden;
        background: rgba(6, 17, 31, .84);
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 220ms ease;
      }
      .verdict[hidden] { display: none; }
      .verdict[data-open] { opacity: 1; }
      .verdict-card {
        position: relative;
        width: min(430px, 100%);
        border: 1px solid var(--verdict-color, var(--detector-accent));
        background: var(--detector-surface);
        box-shadow:
          0 0 0 1px rgba(6, 17, 31, .8),
          0 24px 70px rgba(0, 0, 0, .55),
          0 0 44px var(--verdict-glow, rgba(217, 119, 87, .22));
        transform: translateY(72px) scale(.72);
        transform-origin: 50% 100%;
        opacity: 0;
        transition:
          transform 460ms cubic-bezier(.16, 1, .3, 1),
          opacity 220ms ease;
      }
      .verdict[data-open] .verdict-card {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .verdict[data-closing] .verdict-card {
        transform: translateY(110px) scale(.12, .06);
        opacity: 0;
        transition-timing-function: cubic-bezier(.7, 0, .84, 0);
        transition-duration: 320ms;
      }
      .verdict[data-pass] {
        --verdict-color: var(--detector-blue);
        --verdict-glow: rgba(47, 125, 246, .3);
      }
      .verdict-image-wrap {
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        background: #edf5ff;
      }
      .verdict-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .verdict-scanline {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: repeating-linear-gradient(
          0deg,
          transparent 0 5px,
          rgba(6, 17, 31, .035) 5px 6px
        );
      }
      .verdict-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2;
        width: 38px;
        height: 38px;
        padding: 0;
        border: 1px solid rgba(245, 241, 234, .6);
        border-radius: 0;
        background: rgba(6, 17, 31, .9);
        color: var(--detector-text);
        cursor: pointer;
      }
      .verdict-close::before,
      .verdict-close::after {
        content: "";
        position: absolute;
        left: 10px;
        top: 17px;
        width: 16px;
        height: 2px;
        background: currentColor;
      }
      .verdict-close::before { transform: rotate(45deg); }
      .verdict-close::after { transform: rotate(-45deg); }
      .verdict-close:hover {
        border-color: var(--verdict-color);
        color: var(--verdict-color);
      }
      .verdict-copy {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: 8px 20px;
        padding: 18px 20px 20px;
        border-top: 1px solid var(--verdict-color, var(--detector-accent));
      }
      .verdict-title { font-size: 18px; }
      .verdict-score {
        grid-row: 1 / 3;
        grid-column: 2;
        color: var(--verdict-color, var(--detector-accent));
        font-size: 32px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .verdict-detail {
        margin: 0;
        color: var(--detector-muted);
        font-size: 10px;
      }
      @media (max-width: 440px) {
        .scan-stage { height: 340px; }
        .summary { display: block; }
        .score-wrap { border-right: 0; border-bottom: 1px solid var(--detector-line); }
        .signal {
          grid-template-columns: minmax(100px, .8fr) minmax(100px, 1.2fr) 48px;
        }
        .footer { align-items: flex-start; flex-direction: column; }
        .actions { width: 100%; }
        .run-button, .share-button { flex: 1 1 0; min-width: 0; }
        .verdict { padding: 14px; }
        .verdict-card { width: min(360px, 100%); }
        .verdict-copy { padding: 14px 16px 16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rail span, .scan-progress span { transition: none; }
        .fallback-rotor { animation: none; }
        .verdict, .verdict-card { transition: none; }
      }
    </style>
    <section class="panel" part="panel" aria-label="Claude 环境信号检测">
      <header class="header" part="header">
        <span>环境信号检测</span>
      </header>
      <div class="privacy-bar" part="privacy" aria-label="隐私与开放性说明">
        <span>浏览器内执行</span>
        <span>不上传数据</span>
        <span>开源代码</span>
      </div>
      <div class="scan-stage" part="scan-stage" aria-live="polite">
        <canvas class="scan-canvas" aria-label="旋转的三维检测涡轮"></canvas>
        <div class="fallback-rotor" aria-hidden="true"></div>
        <div class="scan-hud">
          <span class="scan-label">准备检测</span>
          <span class="scan-count">00 / 06</span>
          <div class="scan-progress"><span></span></div>
        </div>
      </div>
      <div class="summary" part="summary">
        <div class="score-wrap">
          <strong class="score" part="score">--</strong>
          <span class="out-of">/100</span>
        </div>
        <div class="result">
          <strong class="band">尚未检测</strong>
          <div class="rail" aria-hidden="true"><span></span></div>
          <p class="description">读取浏览器可见的六项环境数据，不调用 Claude。</p>
        </div>
      </div>
      <ol class="signals" part="signals"></ol>
      <footer class="footer" part="footer">
        <p class="note">本结果基于公开资料与浏览器可见信号推算，仅供参考，不代表 Claude 官方判定。出现偏差时，欢迎反馈和吐槽。</p>
        <div class="actions">
          <button class="share-button" type="button" part="share-button" disabled>
            <span class="download-icon" aria-hidden="true"></span>
            <span class="share-label">分享结果</span>
          </button>
          <button class="run-button" type="button" part="button">开始检测</button>
        </div>
      </footer>
      <div class="verdict" part="verdict" hidden>
        <div class="verdict-card" role="dialog" aria-modal="true" aria-labelledby="verdict-title">
          <button class="verdict-close" type="button" aria-label="关闭检测结果" title="关闭"></button>
          <div class="verdict-image-wrap">
            <img class="verdict-image" alt="" width="900" height="900">
            <span class="verdict-scanline" aria-hidden="true"></span>
          </div>
          <div class="verdict-copy">
            <strong class="verdict-title" id="verdict-title"></strong>
            <span class="verdict-score"></span>
            <p class="verdict-detail"></p>
          </div>
        </div>
      </div>
    </section>
  `;

  function createBladeGeometry(THREE) {
    const geometry = new THREE.BufferGeometry();
    const positions = [
      -0.11, 0.34, 0.08,  0.15, 0.34, 0.08,
       0.50, 2.18, 0.08, -0.30, 2.38, 0.08,
      -0.11, 0.34,-0.08,  0.15, 0.34,-0.08,
       0.50, 2.18,-0.08, -0.30, 2.38,-0.08
    ];
    const indices = [
      0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6,
      4, 0, 3, 4, 3, 7, 1, 5, 6, 1, 6, 2,
      3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0
    ];
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  class ClaudeEnvDetector extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._report = null;
      this._pending = null;
      this._raf = 0;
      this._sceneDisposables = [];
      this._panel = this.shadowRoot.querySelector(".panel");
      this._stage = this.shadowRoot.querySelector(".scan-stage");
      this._canvas = this.shadowRoot.querySelector(".scan-canvas");
      this._button = this.shadowRoot.querySelector(".run-button");
      this._shareButton = this.shadowRoot.querySelector(".share-button");
      this._shareLabel = this.shadowRoot.querySelector(".share-label");
      this._verdict = this.shadowRoot.querySelector(".verdict");
      this._verdictImage = this.shadowRoot.querySelector(".verdict-image");
      this._verdictClose = this.shadowRoot.querySelector(".verdict-close");
      this._verdictTimer = 0;
      this._sharePending = false;
      this._onKeyDown = (event) => {
        if (event.key === "Escape" && !this._verdict.hidden) this._hideVerdict();
      };
      this._button.addEventListener("click", () => this.run());
      this._shareButton.addEventListener("click", () => this.downloadResult());
      this._verdictClose.addEventListener("click", () => this._hideVerdict());
      this._verdict.addEventListener("click", (event) => {
        if (event.target === this._verdict) this._hideVerdict();
      });
    }

    connectedCallback() {
      if (this.hasAttribute("auto") && !this._report) this.run();
    }

    disconnectedCallback() {
      this._stopTurbine();
      this._hideVerdict(true);
    }

    get report() {
      return this._report;
    }

    run() {
      if (this._pending) return this._pending;
      this._pending = this._execute().finally(() => {
        this._pending = null;
      });
      return this._pending;
    }

    async downloadResult() {
      if (!this._report || this._sharePending) return null;
      this._sharePending = true;
      this._shareButton.disabled = true;
      this._shareLabel.textContent = "生成中";
      try {
        const report = this._report;
        const passed = report.score === 100;
        const robotSource = passed
          ? this.getAttribute("blue-robot-src") || blueRobotUrl
          : this.getAttribute("red-robot-src") || redRobotUrl;
        let robot = null;
        try {
          robot = await loadImage(robotSource);
        } catch (_) {
          // Custom images may be unavailable or blocked by their origin.
        }

        let canvas = this._renderShareCanvas(report, robot);
        let blob;
        try {
          blob = await canvasToBlob(canvas);
        } catch (_) {
          canvas = this._renderShareCanvas(report, null);
          blob = await canvasToBlob(canvas);
        }

        const date = String(report.measuredAt || new Date().toISOString()).slice(0, 10);
        const fileName = this.getAttribute("download-name") ||
          `claude-sir-${report.score}-${date}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        root.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.dispatchEvent(new CustomEvent("claude-env-share", {
          detail: { fileName, score: report.score },
          bubbles: true,
          composed: true
        }));
        return blob;
      } finally {
        this._sharePending = false;
        this._shareButton.disabled = false;
        this._shareLabel.textContent = "分享结果";
      }
    }

    async _execute() {
      if (!root.ClaudeDetector) {
        throw new Error("ClaudeDetector core must be loaded before the component.");
      }
      this._hideVerdict(true);
      this._button.disabled = true;
      this._shareButton.disabled = true;
      this._button.textContent = "检测中";
      this._panel.setAttribute("data-scanning", "");
      this._stage.removeAttribute("data-webgl");
      this._setProgress("准备检测", 0, 6);

      const report = root.ClaudeDetector.detectEnvironment();
      try {
        const THREE = await loadThree();
        this._startTurbine(THREE);
      } catch (_) {
        this._canvas.hidden = true;
      }

      for (let index = 0; index < report.signals.length; index += 1) {
        const signal = report.signals[index];
        this._setProgress(`正在读取：${signal.label}`, index + 1, report.signals.length);
        await wait(240);
      }
      this._setProgress("正在计算评分", report.signals.length, report.signals.length);
      await wait(360);

      this._stopTurbine();
      this._panel.removeAttribute("data-scanning");
      this._report = report;
      this._render(report);
      this._showVerdict(report);
      this._button.disabled = false;
      this._shareButton.disabled = false;
      this._button.textContent = "重新检测";
      this.dispatchEvent(new CustomEvent("claude-env-result", {
        detail: report,
        bubbles: true,
        composed: true
      }));
      return report;
    }

    _showVerdict(report) {
      const passed = report.score === 100;
      const source = passed
        ? this.getAttribute("blue-robot-src") || blueRobotUrl
        : this.getAttribute("red-robot-src") || redRobotUrl;
      root.clearTimeout(this._verdictTimer);
      this._verdictImage.src = source;
      this._verdictImage.alt = passed
        ? "机器人举起蓝旗，表示满分通过"
        : "机器人举起红旗，表示未通过";
      this.shadowRoot.querySelector(".verdict-title").textContent =
        passed ? "满分通过" : "未通过";
      this.shadowRoot.querySelector(".verdict-score").textContent =
        `${report.score}/100`;
      this.shadowRoot.querySelector(".verdict-detail").textContent = passed
        ? "六项环境信号均达到满分。"
        : "检测未达到 100 分。";
      this._verdict.toggleAttribute("data-pass", passed);
      this._verdict.removeAttribute("data-closing");
      this._verdict.hidden = false;
      document.addEventListener("keydown", this._onKeyDown);
      root.requestAnimationFrame(() => {
        this._verdict.setAttribute("data-open", "");
        this._verdictClose.focus({ preventScroll: true });
      });
    }

    _hideVerdict(immediate) {
      root.clearTimeout(this._verdictTimer);
      document.removeEventListener("keydown", this._onKeyDown);
      if (!this._verdict || this._verdict.hidden) return;
      const finish = () => {
        this._verdict.hidden = true;
        this._verdict.removeAttribute("data-open");
        this._verdict.removeAttribute("data-closing");
      };
      if (immediate || (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        finish();
        return;
      }
      this._verdict.setAttribute("data-closing", "");
      this._verdict.removeAttribute("data-open");
      this._verdictTimer = root.setTimeout(finish, 340);
    }

    _setProgress(label, current, total) {
      this.shadowRoot.querySelector(".scan-label").textContent = label;
      this.shadowRoot.querySelector(".scan-count").textContent =
        `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      this.shadowRoot.querySelector(".scan-progress span").style.width =
        `${(current / total) * 100}%`;
    }

    _startTurbine(THREE) {
      this._canvas.hidden = false;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 7.2);

      const renderer = new THREE.WebGLRenderer({
        canvas: this._canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));

      const rotor = new THREE.Group();
      rotor.rotation.x = -0.18;
      rotor.rotation.y = 0.22;
      scene.add(rotor);

      const bladeGeometry = createBladeGeometry(THREE);
      const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd97757,
        emissive: 0x4c1f18,
        metalness: 0.82,
        roughness: 0.24
      });
      for (let index = 0; index < 12; index += 1) {
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.rotation.z = (index / 12) * Math.PI * 2;
        rotor.add(blade);
      }

      const hubGeometry = new THREE.CylinderGeometry(0.46, 0.62, 0.42, 32);
      const hubMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f1ea,
        metalness: 0.95,
        roughness: 0.18
      });
      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = 0.16;
      rotor.add(hub);

      const ringGeometry = new THREE.TorusGeometry(2.7, 0.035, 8, 96);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x2f7df6 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.z = -0.18;
      scene.add(ring);

      const particlePositions = [];
      for (let index = 0; index < 90; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.9 + Math.random() * 2.8;
        particlePositions.push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          -1.2 + Math.random() * 1.8
        );
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(particlePositions, 3)
      );
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x2f7df6,
        size: 0.035,
        transparent: true,
        opacity: 0.7
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      scene.add(new THREE.AmbientLight(0xbcd7ff, 1.35));
      const light = new THREE.PointLight(0xd97757, 42, 18);
      light.position.set(2.8, 3.4, 5);
      scene.add(light);
      const blueLight = new THREE.PointLight(0x2f7df6, 28, 15);
      blueLight.position.set(-3.4, -2.2, 3.5);
      scene.add(blueLight);

      const resize = () => {
        const width = Math.max(1, this._stage.clientWidth);
        const height = Math.max(1, this._stage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(this._stage);

      this._sceneDisposables = [
        bladeGeometry, bladeMaterial, hubGeometry, hubMaterial,
        ringGeometry, ringMaterial, particleGeometry, particleMaterial,
        renderer, resizeObserver
      ];
      this._stage.setAttribute("data-webgl", "");

      const startedAt = performance.now();
      const reducedMotion = root.matchMedia &&
        root.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const frame = (time) => {
        const elapsed = time - startedAt;
        const speed = Math.min(0.018, 0.002 + elapsed / 110000);
        if (!reducedMotion) {
          rotor.rotation.z += speed;
          ring.rotation.z -= speed * 0.16;
          particles.rotation.z += speed * 0.035;
          camera.position.z = 7.2 - Math.min(0.8, elapsed / 2200);
        }
        renderer.render(scene, camera);
        this._raf = root.requestAnimationFrame(frame);
      };
      this._raf = root.requestAnimationFrame(frame);
    }

    _stopTurbine() {
      root.cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._sceneDisposables.forEach((item) => {
        if (item && typeof item.disconnect === "function") item.disconnect();
        if (item && typeof item.dispose === "function") item.dispose();
      });
      this._sceneDisposables = [];
      this._stage.removeAttribute("data-webgl");
    }

    _renderShareCanvas(report, robot) {
      const width = 1200;
      const margin = 54;
      const headerHeight = 96;
      const privacyHeight = 68;
      const summaryHeight = 380;
      const rowHeight = 112;
      const footerHeight = 180;
      const rowsHeight = report.signals.length * rowHeight;
      const height = margin * 2 + headerHeight + privacyHeight +
        summaryHeight + rowsHeight + footerHeight;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      const styles = getComputedStyle(this);
      const color = (name, fallback) =>
        styles.getPropertyValue(name).trim() || fallback;
      const colors = {
        bg: color("--detector-bg", "#06111f"),
        surface: color("--detector-surface", "#0b1f33"),
        line: color("--detector-line", "#24496b"),
        text: color("--detector-text", "#f5f1ea"),
        muted: color("--detector-muted", "#8ea5bc"),
        accent: color("--detector-accent", "#d97757"),
        blue: color("--detector-blue", "#2f7df6")
      };
      const passed = report.score === 100;
      const signalColor = passed ? colors.blue : colors.accent;
      const mono = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
      const innerWidth = width - margin * 2;
      const contentLeft = margin + 26;
      const contentRight = width - margin - 26;
      const drawLine = (x1, y1, x2, y2, lineWidth, stroke) => {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.lineWidth = lineWidth || 1;
        context.strokeStyle = stroke || colors.line;
        context.stroke();
      };
      const drawText = (value, x, y, size, fill, weight, align) => {
        context.font = `${weight || 400} ${size}px ${mono}`;
        context.fillStyle = fill || colors.text;
        context.textAlign = align || "left";
        context.textBaseline = "alphabetic";
        context.fillText(String(value), x, y);
      };
      const drawWrappedText = (value, x, y, maxWidth, lineHeight, maxLines) => {
        const characters = Array.from(String(value));
        const lines = [];
        let line = "";
        characters.forEach((character) => {
          const next = line + character;
          if (line && context.measureText(next).width > maxWidth) {
            lines.push(line);
            line = character;
          } else {
            line = next;
          }
        });
        if (line) lines.push(line);
        lines.slice(0, maxLines).forEach((item, index) => {
          const lastVisible = index === maxLines - 1 && lines.length > maxLines;
          context.fillText(
            lastVisible ? fitText(context, `${item}...`, maxWidth) : item,
            x,
            y + index * lineHeight
          );
        });
      };

      context.fillStyle = colors.bg;
      context.fillRect(0, 0, width, height);
      context.save();
      context.globalAlpha = 0.22;
      for (let x = 0; x <= width; x += 48) drawLine(x, 0, x, height, 1, colors.line);
      for (let y = 0; y <= height; y += 48) drawLine(0, y, width, y, 1, colors.line);
      context.restore();

      context.fillStyle = colors.bg;
      context.fillRect(margin, margin, innerWidth, height - margin * 2);
      context.strokeStyle = colors.line;
      context.lineWidth = 2;
      context.strokeRect(margin, margin, innerWidth, height - margin * 2);

      const headerBottom = margin + headerHeight;
      drawText("CLAUDE SIR", contentLeft, margin + 60, 28, colors.text, 700);
      let measuredAt = "";
      const measuredDate = new Date(report.measuredAt || "");
      if (!Number.isNaN(measuredDate.getTime())) {
        measuredAt = measuredDate.toLocaleString("zh-CN", { hour12: false });
      }
      drawText(measuredAt, contentRight, margin + 58, 18, colors.muted, 400, "right");
      drawLine(margin, headerBottom, width - margin, headerBottom, 2);

      const privacyBottom = headerBottom + privacyHeight;
      const privacyLabels = ["浏览器内执行", "不上传数据", "开源代码"];
      const privacyCellWidth = innerWidth / privacyLabels.length;
      privacyLabels.forEach((label, index) => {
        const cellLeft = margin + index * privacyCellWidth;
        if (index) drawLine(cellLeft, headerBottom, cellLeft, privacyBottom, 1);
        drawText(
          label,
          cellLeft + privacyCellWidth / 2,
          headerBottom + 43,
          18,
          colors.muted,
          400,
          "center"
        );
      });
      drawLine(margin, privacyBottom, width - margin, privacyBottom, 2);

      const summaryBottom = privacyBottom + summaryHeight;
      context.fillStyle = colors.surface;
      context.fillRect(margin, privacyBottom, innerWidth, summaryHeight);
      drawText("环境信号检测报告", contentLeft, privacyBottom + 60, 24, colors.text, 700);
      drawText(String(report.score).padStart(2, "0"), contentLeft, privacyBottom + 218, 144, signalColor, 700);
      drawText("/100", contentLeft + 345, privacyBottom + 216, 28, colors.muted, 400);
      drawText(report.band.label, contentLeft, privacyBottom + 286, 27, colors.text, 700);
      drawText(passed ? "满分通过" : "未通过", contentLeft + 180, privacyBottom + 286, 24, signalColor, 700);
      context.fillStyle = colors.line;
      context.fillRect(contentLeft, privacyBottom + 324, 600, 5);
      context.fillStyle = signalColor;
      context.fillRect(contentLeft, privacyBottom + 324, 600 * report.score / 100, 5);

      const robotSize = 310;
      const robotX = contentRight - robotSize;
      const robotY = privacyBottom + 34;
      context.fillStyle = colors.bg;
      context.fillRect(robotX, robotY, robotSize, robotSize);
      if (robot) {
        context.drawImage(robot, robotX, robotY, robotSize, robotSize);
      } else {
        drawText(
          passed ? "满分通过" : "未通过",
          robotX + robotSize / 2,
          robotY + robotSize / 2 + 10,
          28,
          signalColor,
          700,
          "center"
        );
      }
      context.strokeStyle = signalColor;
      context.lineWidth = 2;
      context.strokeRect(robotX, robotY, robotSize, robotSize);
      drawLine(margin, summaryBottom, width - margin, summaryBottom, 2);

      report.signals.forEach((signal, index) => {
        const rowTop = summaryBottom + index * rowHeight;
        const rowBottom = rowTop + rowHeight;
        const valueX = margin + 390;
        const pointsX = width - margin - 132;
        drawText(signal.label, contentLeft, rowTop + 44, 22, colors.text, 700);
        drawText(signal.source, contentLeft, rowTop + 78, 16, colors.muted, 400);
        context.font = `400 18px ${mono}`;
        drawText(
          fitText(context, signal.value, pointsX - valueX - 42),
          valueX + 26,
          rowTop + 64,
          18,
          colors.muted,
          400
        );
        drawText(`+${signal.contribution}`, contentRight, rowTop + 65, 23, signalColor, 700, "right");
        drawLine(valueX, rowTop, valueX, rowBottom, 1);
        drawLine(pointsX, rowTop, pointsX, rowBottom, 1);
        drawLine(margin, rowBottom, width - margin, rowBottom, 1);
      });

      const footerTop = summaryBottom + rowsHeight;
      context.font = `400 18px ${mono}`;
      context.fillStyle = colors.muted;
      context.textAlign = "left";
      drawWrappedText(
        "本结果基于公开资料与浏览器可见信号推算，仅供参考，不代表 Claude 官方判定。出现偏差时，欢迎反馈和吐槽。",
        contentLeft,
        footerTop + 57,
        innerWidth - 52,
        30,
        2
      );
      drawText("开源环境信号检测", contentLeft, footerTop + 137, 17, colors.muted, 400);
      drawText(`${report.score}/100`, contentRight, footerTop + 140, 32, signalColor, 700, "right");
      return canvas;
    }

    _render(report) {
      const descriptions = {
        low: "当前浏览器暴露的中国地区相关信号较少。",
        medium: "当前浏览器暴露了部分中国地区相关信号。",
        high: "当前浏览器暴露了较多中国地区相关信号。"
      };
      this.shadowRoot.querySelector(".score").textContent =
        String(report.score).padStart(2, "0");
      this.shadowRoot.querySelector(".band").textContent = report.band.label;
      this.shadowRoot.querySelector(".description").textContent =
        descriptions[report.band.id];
      this.shadowRoot.querySelector(".rail span").style.width =
        `${report.score}%`;

      const list = this.shadowRoot.querySelector(".signals");
      list.replaceChildren();
      report.signals.forEach((signal) => {
        const row = document.createElement("li");
        row.className = "signal";
        row.setAttribute("part", "signal");
        const name = document.createElement("span");
        name.className = "name";
        const label = document.createElement("strong");
        label.textContent = signal.label;
        const source = document.createElement("small");
        source.textContent = signal.source;
        name.append(label, source);
        const value = document.createElement("span");
        value.className = "value";
        value.textContent = signal.value;
        const points = document.createElement("span");
        points.className = "points";
        points.textContent = `+${signal.contribution}`;
        row.append(name, value, points);
        list.appendChild(row);
      });
    }
  }

  if (!customElements.get("claude-env-detector")) {
    customElements.define("claude-env-detector", ClaudeEnvDetector);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
