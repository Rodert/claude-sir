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
        justify-content: space-between;
        min-height: 48px;
        padding: 0 16px;
        border-bottom: 1px solid var(--detector-line);
        font-size: 12px;
        font-weight: 700;
      }
      .local { color: var(--detector-muted); font-size: 10px; font-weight: 400; }
      .local::before {
        content: "";
        display: inline-block;
        width: 7px;
        height: 7px;
        margin-right: 8px;
        background: var(--detector-accent);
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
      .run-button {
        flex: none;
        min-width: 98px;
        min-height: 36px;
        padding: 0 14px;
        border: 1px solid var(--detector-accent);
        border-radius: 0;
        background: var(--detector-accent);
        color: var(--detector-bg);
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0;
        cursor: pointer;
      }
      .run-button:hover { background: transparent; color: var(--detector-accent); }
      .run-button:disabled { cursor: wait; opacity: .5; }
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
        .run-button { width: 100%; }
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
        <span class="local">仅本地运行</span>
      </header>
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
        <p class="note">结果是环境相关性估算，不是 Claude 官方判定。</p>
        <button class="run-button" type="button" part="button">开始检测</button>
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
      this._verdict = this.shadowRoot.querySelector(".verdict");
      this._verdictImage = this.shadowRoot.querySelector(".verdict-image");
      this._verdictClose = this.shadowRoot.querySelector(".verdict-close");
      this._verdictTimer = 0;
      this._onKeyDown = (event) => {
        if (event.key === "Escape" && !this._verdict.hidden) this._hideVerdict();
      };
      this._button.addEventListener("click", () => this.run());
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

    async _execute() {
      if (!root.ClaudeDetector) {
        throw new Error("ClaudeDetector core must be loaded before the component.");
      }
      this._hideVerdict(true);
      this._button.disabled = true;
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
