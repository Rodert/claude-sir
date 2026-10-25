# Claude Sir

一个零依赖、纯静态的浏览器环境信号检测内核，同时提供原生 Web Component 和 iframe 两种嵌入方式。

## 它如何检测

检测按以下步骤完成：

1. 用 `Intl.DateTimeFormat().resolvedOptions()` 读取系统时区和 Intl 区域。
2. 用 `navigator.languages` 读取浏览器语言优先级。
3. 用 Canvas 文本宽度差异探测常见简体、繁体中文字体。
4. 用 `Date.getTimezoneOffset()` 读取当前 UTC 偏移。
5. 从 `navigator.userAgent` 和 `navigator.platform` 提取平台线索。
6. 每项产生 `0–1` 的命中强度，乘以固定权重后求和。

| 信号 | 权重 | 性质 |
| --- | ---: | --- |
| 系统时区 | 30 | 最接近参考项目所述 Claude Code 行为 |
| 浏览器语言 | 24 | 相关性线索 |
| 中文字体 | 20 | 相关性线索 |
| Intl 区域 | 10 | 相关性线索 |
| UTC 偏移 | 8 | 相关性线索 |
| 平台线索 | 8 | 相关性线索 |

0–30 为低相关，31–60 为中等相关，61–100 为高相关。这不是 Claude 官方判定，也不能证明用户的真实所在地。

## 架构

```text
src/detector.js             检测与评分，无 UI
src/claude-env-detector.js  原生 Web Component 与结果弹层
assets/robots/              红旗、蓝旗机器人 WebP 素材
vendor/three-turbine.min.js 按需加载的 3D 涡轮渲染器
embed.html                  iframe 入口
index.html                  最小集成示例
```

运行时没有包管理器、构建步骤、外部字体或第三方网络请求。普通静态文件服务器即可部署。组件只在用户开始检测后加载本地的 Three.js 涡轮渲染器，不影响首屏。

## 直接调用内核

```html
<script src="/src/detector.js"></script>
<script>
  const report = ClaudeDetector.detectEnvironment();
  console.log(report);
</script>
```

报告结构：

```js
{
  version: "1.0.0",
  measuredAt: "ISO timestamp",
  score: 0,
  band: { id: "low", label: "低相关" },
  signals: [
    {
      id: "timezone",
      label: "系统时区",
      source: "Intl.DateTimeFormat",
      evidence: "direct",
      weight: 30,
      value: "Asia/Shanghai",
      strength: 1,
      contribution: 30
    }
  ],
  disclaimer: "..."
}
```

## Web Component

```html
<script src="/src/detector.js"></script>
<script src="/src/claude-env-detector.js"></script>

<claude-env-detector id="detector"></claude-env-detector>

<script>
  const detector = document.getElementById("detector");

  detector.addEventListener("claude-env-result", (event) => {
    console.log(event.detail);
  });

  // 也可以由宿主代码主动执行
  const report = await detector.run();
</script>
```

`run()` 返回 `Promise<Report>`。检测期间组件显示全宽 3D 涡轮，六项信号读取完成后切换为结果视图，并在中央弹出机器人判定：只有 `score === 100` 才举蓝旗，其余分数均举红旗。弹层可用关闭按钮、背景点击或 `Esc` 收回。

支持 `auto` 属性自动检测：

```html
<claude-env-detector auto></claude-env-detector>
```

组件使用 Shadow DOM，不污染宿主页面。可通过 CSS 变量调整颜色：

```css
claude-env-detector {
  --detector-bg: #06111f;
  --detector-surface: #0b1f33;
  --detector-line: #24496b;
  --detector-text: #f5f1ea;
  --detector-muted: #8ea5bc;
  --detector-accent: #d97757;
  --detector-blue: #2f7df6;
}
```

如需替换机器人素材，可直接设置组件属性，路径按宿主页面解析：

```html
<claude-env-detector
  red-robot-src="/images/red-robot.webp"
  blue-robot-src="/images/blue-robot.webp"
></claude-env-detector>
```

## iframe

```html
<iframe
  src="https://your-domain.example/embed.html"
  title="环境信号检测"
  style="width:100%;height:640px;border:0"
></iframe>
```

iframe 完成检测后会向父页面发送：

```js
window.addEventListener("message", (event) => {
  if (event.data?.type === "claude-env-result") {
    console.log(event.data.report);
  }
});
```

父页面也可以主动触发检测：

```js
iframe.contentWindow.postMessage({ type: "claude-env-run" }, "*");
```

生产环境应在父页面校验 `event.origin`，并将 `postMessage` 的 `"*"` 替换为明确的目标源。

## 体积与许可

- 检测内核约 7 KB，组件约 26 KB，随首屏加载。
- 两张机器人 WebP 合计约 69 KB，只在展示对应结果时加载其中一张。
- Three.js 涡轮构建约 527 KB，gzip 后约 135 KB，仅在第一次检测时加载并由浏览器缓存。
- Three.js 使用 MIT 许可证，许可文本见 `vendor/THREE-LICENSE.txt`。

## 本地预览

```bash
python3 -m http.server 4173
```

打开 `http://localhost:4173`。
