(function (root, factory) {
  const api = factory(root);
  root.ClaudeDetector = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const CN_TIMEZONES = new Set([
    "Asia/Shanghai", "Asia/Urumqi", "Asia/Chongqing",
    "Asia/Chungking", "Asia/Harbin", "Asia/Kashgar"
  ]);
  const GREATER_CN_TIMEZONES = new Set([
    "Asia/Hong_Kong", "Asia/Macau", "Asia/Taipei"
  ]);
  const SIMPLIFIED_FONTS = [
    "Microsoft YaHei", "Microsoft YaHei UI", "SimSun", "NSimSun",
    "SimHei", "KaiTi", "FangSong", "DengXian", "PingFang SC",
    "Hiragino Sans GB", "STHeiti", "STSong", "Songti SC",
    "Source Han Sans CN", "Source Han Sans SC", "Noto Sans CJK SC",
    "Noto Serif CJK SC", "WenQuanYi Micro Hei", "WenQuanYi Zen Hei"
  ];
  const TRADITIONAL_FONTS = [
    "Microsoft JhengHei", "PMingLiU", "MingLiU", "DFKai-SB",
    "PingFang TC", "PingFang HK", "Source Han Sans TW",
    "Noto Sans CJK TC"
  ];

  const SIGNALS = Object.freeze([
    { id: "timezone", label: "系统时区", source: "Intl.DateTimeFormat", weight: 30, evidence: "direct" },
    { id: "language", label: "浏览器语言", source: "navigator.languages", weight: 24, evidence: "heuristic" },
    { id: "fonts", label: "中文字体", source: "Canvas 2D", weight: 20, evidence: "heuristic" },
    { id: "locale", label: "Intl 区域", source: "Intl locale", weight: 10, evidence: "heuristic" },
    { id: "offset", label: "UTC 偏移", source: "Date.getTimezoneOffset", weight: 8, evidence: "heuristic" },
    { id: "platform", label: "平台线索", source: "navigator.userAgent", weight: 8, evidence: "heuristic" }
  ]);

  function safeResolvedOptions() {
    try {
      return root.Intl.DateTimeFormat().resolvedOptions();
    } catch (_) {
      return {};
    }
  }

  function normalizedLanguages() {
    const nav = root.navigator || {};
    const values = nav.languages && nav.languages.length
      ? nav.languages
      : [nav.language];
    return values.filter(Boolean).map((value) => String(value).toLowerCase());
  }

  function isFontAvailable(font, context) {
    const sample = "中文字体检测ABCabc012";
    return ["monospace", "sans-serif", "serif"].some((fallback) => {
      context.font = `72px ${fallback}`;
      const baseline = context.measureText(sample).width;
      context.font = `72px "${font}", ${fallback}`;
      return Math.abs(context.measureText(sample).width - baseline) > 0.5;
    });
  }

  const detectors = {
    timezone() {
      const value = safeResolvedOptions().timeZone || "unknown";
      const strength = CN_TIMEZONES.has(value)
        ? 1
        : GREATER_CN_TIMEZONES.has(value) ? 0.6 : 0;
      return { value, strength };
    },

    language() {
      const values = normalizedLanguages();
      const primary = values[0] || "";
      const isHans = (value) =>
        value === "zh" || value.startsWith("zh-cn") || value.includes("hans");
      const isHant = (value) =>
        value.startsWith("zh-tw") || value.startsWith("zh-hk") ||
        value.startsWith("zh-mo") || value.includes("hant");
      let strength = 0;
      if (isHans(primary)) strength = 1;
      else if (isHant(primary)) strength = 0.5;
      else if (values.some(isHans)) strength = 0.7;
      else if (values.some((value) => value.startsWith("zh"))) strength = 0.4;
      return { value: values.join(", ") || "unknown", strength };
    },

    fonts() {
      const doc = root.document;
      const context = doc && doc.createElement("canvas").getContext("2d");
      if (!context) return { value: "canvas unavailable", strength: 0 };
      const simplified = SIMPLIFIED_FONTS.filter((font) =>
        isFontAvailable(font, context)
      );
      const traditional = TRADITIONAL_FONTS.filter((font) =>
        isFontAvailable(font, context)
      );
      const matches = simplified.concat(traditional);
      const strength = simplified.length
        ? Math.min(1, 0.75 + 0.08 * simplified.length)
        : traditional.length ? 0.5 : 0;
      const value = matches.length
        ? matches.slice(0, 4).join(", ") +
          (matches.length > 4 ? ` +${matches.length - 4}` : "")
        : "none";
      return { value, strength };
    },

    locale() {
      const value = safeResolvedOptions().locale || "unknown";
      const normalized = value.toLowerCase();
      const strength =
        normalized === "zh" || normalized.startsWith("zh-cn") ||
        normalized.includes("hans")
          ? 1
          : normalized.startsWith("zh") ? 0.5 : 0;
      return { value, strength };
    },

    offset() {
      const offset = new root.Date().getTimezoneOffset();
      const hours = -offset / 60;
      const value = `UTC${hours >= 0 ? "+" : "-"}${Math.abs(hours)}`;
      return { value, strength: offset === -480 ? 0.7 : 0 };
    },

    platform() {
      const nav = root.navigator || {};
      const probe = `${nav.platform || ""} ${nav.userAgent || ""}`.toLowerCase();
      let value = "Unknown";
      if (/iphone|ipad|ipod|mac/.test(probe)) value = "Apple";
      else if (/android|cros/.test(probe)) value = "Google";
      else if (/win/.test(probe)) value = "Microsoft";
      else if (/linux/.test(probe)) value = "Linux / Other";
      const strengths = {
        Apple: 0.25,
        Google: 0.35,
        Microsoft: 0.4,
        "Linux / Other": 0.5,
        Unknown: 0.4
      };
      return { value, strength: strengths[value] };
    }
  };

  function getBand(score) {
    if (score <= 30) return { id: "low", label: "低相关" };
    if (score <= 60) return { id: "medium", label: "中等相关" };
    return { id: "high", label: "高相关" };
  }

  function detectEnvironment(options) {
    const config = options || {};
    const results = SIGNALS.map((definition) => {
      let outcome;
      try {
        outcome = detectors[definition.id]();
      } catch (_) {
        outcome = { value: "unavailable", strength: 0 };
      }
      const contribution = Math.round(outcome.strength * definition.weight);
      const result = Object.freeze({
        id: definition.id,
        label: definition.label,
        source: definition.source,
        evidence: definition.evidence,
        weight: definition.weight,
        value: outcome.value,
        strength: outcome.strength,
        contribution
      });
      if (typeof config.onSignal === "function") config.onSignal(result);
      return result;
    });
    const score = Math.min(
      100,
      results.reduce((total, signal) => total + signal.contribution, 0)
    );
    return Object.freeze({
      version: VERSION,
      measuredAt: new root.Date().toISOString(),
      score,
      band: Object.freeze(getBand(score)),
      signals: Object.freeze(results),
      disclaimer: "Browser environment correlation only; not an official Claude decision."
    });
  }

  return Object.freeze({
    VERSION,
    SIGNALS,
    detectEnvironment,
    getBand
  });
});
