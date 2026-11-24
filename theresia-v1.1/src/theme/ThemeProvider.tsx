import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACCENTS,
  MATERIALS,
  applyTheme,
  loadTheme,
  saveTheme,
  type AccentPalette,
  type MaterialPalette,
  type ThemeMode,
  type ThemeState,
} from "./palettes";

interface ThemeContextValue {
  accent: string;
  mode: ThemeMode;
  /** 背景图标的材质色，空串表示默认 */
  logo: string;
  palettes: AccentPalette[];
  materials: MaterialPalette[];
  setAccent: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  setLogoMaterial: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 主题容器：持有当前主色与明暗模式，写进 <html> 并持久化到 localStorage。
 * 首帧之前 main.tsx 已经调用过 applyTheme，这里只管后续切换。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadTheme);

  useEffect(() => {
    applyTheme(state);
    saveTheme(state);
  }, [state]);

  const setAccent = useCallback((accent: string) => {
    setState((current) => ({ ...current, accent }));
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setState((current) => ({ ...current, mode }));
  }, []);

  const setLogoMaterial = useCallback((logo: string) => {
    setState((current) => ({ ...current, logo }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      accent: state.accent,
      mode: state.mode,
      logo: state.logo,
      palettes: ACCENTS,
      materials: MATERIALS,
      setAccent,
      setMode,
      setLogoMaterial,
    }),
    [state.accent, state.mode, state.logo, setAccent, setMode, setLogoMaterial],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return context;
}
