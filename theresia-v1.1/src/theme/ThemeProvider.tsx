import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACCENTS,
  applyTheme,
  loadTheme,
  saveTheme,
  type AccentPalette,
  type ThemeMode,
  type ThemeState,
} from "./palettes";

interface ThemeContextValue {
  accent: string;
  mode: ThemeMode;
  palettes: AccentPalette[];
  setAccent: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
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



  const value = useMemo<ThemeContextValue>(
    () => ({
      accent: state.accent,
      mode: state.mode,
      palettes: ACCENTS,
      setAccent,
      setMode,
    }),
    [state.accent, state.mode, setAccent, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return context;
}
