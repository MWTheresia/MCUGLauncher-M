/**
 * 主题：16 套主色 + 明暗两种模式。
 *
 * 主色只在这里定义一次（base），其余 8 个斜变量由 buildAccentVars() 按当前模式推导：
 * 浅色模式往白色里调，深色模式往底色里调，保证同一套色板在两种模式下都有足够对比度。
 * 结果以 CSS 变量写到 <html> 上，页面 CSS 只认 --app-accent* 这组变量。
 */

export type ThemeMode = "light" | "dark";

export interface AccentPalette {
  id: string;
  label: string;
  base: string;
}

/** 16 色板：名称为界面里显示的中文名，base 是主色本身。 */
export const ACCENTS: AccentPalette[] = [
  { id: "blue", label: "经典蓝", base: "#3b82f6" },
  { id: "indigo", label: "靛青", base: "#6366f1" },
  { id: "violet", label: "紫罗兰", base: "#8b5cf6" },
  { id: "fuchsia", label: "品红", base: "#d946ef" },
  { id: "rose", label: "玫红", base: "#f43f5e" },
  { id: "red", label: "朱红", base: "#ef4444" },
  { id: "coral", label: "珊瑚橙", base: "#f97316" },
  { id: "amber", label: "琥珀", base: "#f59e0b" },
  { id: "lime", label: "柠檬绿", base: "#84cc16" },
  { id: "green", label: "草绿", base: "#22c55e" },
  { id: "emerald", label: "翡翠", base: "#10b981" },
  { id: "teal", label: "青碧", base: "#14b8a6" },
  { id: "cyan", label: "天青", base: "#06b6d4" },
  { id: "sky", label: "湖蓝", base: "#0ea5e9" },
  { id: "slate", label: "石板灰", base: "#64748b" },
  { id: "coffee", label: "咖啡", base: "#b45309" },
];

/**
 * 材质：只用来给背景那枚大图标换色，不影响界面主色。
 * 顺序按 Minecraft 的挖掘等级（harvest level）排：木/金 0、石 1、铁 2、钻石 3、下界合金 4。
 */
export interface MaterialPalette {
  id: string;
  label: string;
  level: number;
  base: string;
  /** 该材质的明度系数：石/下界合金压暗，铁提亮，避免同色相的两档看起来一样 */
  tone: number;
}

export const MATERIALS: MaterialPalette[] = [
  { id: "wood", label: "木", level: 0, base: "#a9773f", tone: 0.95 },
  { id: "gold", label: "金", level: 0, base: "#e0b23c", tone: 1.08 },
  { id: "stone", label: "石", level: 1, base: "#7d838a", tone: 0.78 },
  { id: "iron", label: "铁", level: 2, base: "#dadfe4", tone: 1.16 },
  { id: "diamond", label: "钻石", level: 3, base: "#3fb9ad", tone: 1 },
  { id: "netherite", label: "下界合金", level: 4, base: "#6b5a76", tone: 0.86 },
];

export interface ThemeState {
  accent: string;
  mode: ThemeMode;
  /** 背景图标的材质色；空串表示默认（保留 logo 原色） */
  logo: string;
}

const STORAGE_KEY = "mcugl.theme.v1";
const DARK_SURFACE = "#0c1117";

export const DEFAULT_THEME: ThemeState = { accent: "blue", mode: "light", logo: "" };

/* ---------------- 颜色计算 ---------------- */

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

const toHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 线性插值：ratio=0 取 a，ratio=1 取 b。 */
function mix(a: string, b: string, ratio: number): string {
  const one = hexToRgb(a);
  const two = hexToRgb(b);
  return rgbToHex({
    r: one.r + (two.r - one.r) * ratio,
    g: one.g + (two.g - one.g) * ratio,
    b: one.b + (two.b - one.b) * ratio,
  });
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** 供 CSS 用 rgb(var(--app-accent-rgb) / x%) 拼半透明主色。 */
function rgbTriplet(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/** 相对亮度，用来决定主色上的文字用黑还是白。 */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/* ---------------- 变量推导 ---------------- */

/** 由 base 与模式推导 9 个主色变量。 */
export function buildAccentVars(base: string, mode: ThemeMode): Record<string, string> {
  const ink = luminance(base) > 0.62 ? "#10161f" : "#ffffff";

  if (mode === "light") {
    return {
      "--app-accent": base,
      "--app-accent-rgb": rgbTriplet(base),
      "--app-accent-hover": mix(base, "#000000", 0.1),
      "--app-accent-dark": mix(base, "#000000", 0.18),
      "--app-accent-deep": mix(base, "#000000", 0.3),
      "--app-accent-soft": mix(base, "#ffffff", 0.62),
      "--app-accent-tint": mix(base, "#ffffff", 0.85),
      "--app-accent-wash": mix(base, "#ffffff", 0.94),
      "--app-accent-glow": rgba(base, 0.3),
      "--app-accent-ink": ink,
    };
  }

  return {
    /* 深色下主色提亮一档，避免大面积深蓝在暗底上看不清 */
    "--app-accent": mix(base, "#ffffff", 0.1),
    "--app-accent-rgb": rgbTriplet(mix(base, "#ffffff", 0.1)),
    "--app-accent-hover": mix(base, "#ffffff", 0.2),
    "--app-accent-dark": mix(base, "#ffffff", 0.3),
    /* deep 在深色模式里是「带色文字」，因此要往亮里调 */
    "--app-accent-deep": mix(base, "#ffffff", 0.58),
    "--app-accent-soft": mix(base, DARK_SURFACE, 0.32),
    "--app-accent-tint": mix(base, DARK_SURFACE, 0.72),
    "--app-accent-wash": mix(base, DARK_SURFACE, 0.86),
    "--app-accent-glow": rgba(base, 0.42),
    "--app-accent-ink": ink,
  };
}

/* ---------------- 读取 / 应用 / 保存 ---------------- */

export function loadTheme(): ThemeState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    const accent = ACCENTS.some((item) => item.id === parsed.accent) ? parsed.accent! : DEFAULT_THEME.accent;
    const mode: ThemeMode = parsed.mode === "dark" ? "dark" : "light";
    const logo = MATERIALS.some((item) => item.id === parsed.logo) ? parsed.logo! : "";
    return { accent, mode, logo };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(state: ThemeState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式或配额满：主题只是偏好，存不上也不该影响启动 */
  }
}

/** 把主题写到 <html>：data-theme 控制明暗，内联变量控制主色。 */
export function applyTheme(state: ThemeState): void {
  const root = document.documentElement;
  const palette = ACCENTS.find((item) => item.id === state.accent) ?? ACCENTS[0];
  root.dataset.theme = state.mode;
  const head = logoHeadColor(state);
  if (head) {
    root.style.setProperty("--logo-head-color", head);
    root.dataset.logoHead = "on";
  } else {
    root.style.removeProperty("--logo-head-color");
    delete root.dataset.logoHead;
  }

  const vars = buildAccentVars(palette.base, state.mode);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/* ---------------- 背景图标的配色 ---------------- */

/**
 * 背景大图标只换色、不换形：
 * 先用 sepia 把彩图压成单色，再用 hue-rotate 旋到目标材质色，最后补一点亮度。
 * 返回 null 表示「默认」，交给 CSS 里的 --shell-logo-filter 兜底。
 */
/**
 * 背景大图标里的镐头换成所选材质色：
 * 只有镐头区域被盖住，木柄、六边形外框和 MCUG 字样保持原样。
 * 返回 null 表示不改，保留 logo 原本的钻石镐青色。
 */
export function logoHeadColor(state: ThemeState): string | null {
  const material = MATERIALS.find((item) => item.id === state.logo);
  if (!material) return null;
  return state.mode === "dark" ? mix(material.base, "#ffffff", 0.18) : material.base;
}
