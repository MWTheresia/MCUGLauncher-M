import { useRef, useState } from "react";
import { resetWindow as resetWindowCommand } from "../../api/commands/settings";
import { AppSelect } from "../../components/AppInput";
import { useI18n } from "../../i18n";
import { setHomeAlignment, useHomeAlignment } from "../../shell/homeAlignment";
import { useTheme } from "../../theme/ThemeProvider";
import type { ThemeMode } from "../../theme/palettes";
import SettingRow from "./SettingRow";
import SettingsCard from "./SettingsCard";

interface AppearanceSettingsProps {
  active: boolean;
}

/** 外观：主题（16 色板 + 明暗）、语言、主页对齐与窗口。 */
export default function AppearanceSettings({ active }: AppearanceSettingsProps) {
  const { locale, setLocale, t, packs, labelOf, builtinCodes, importPack, removePack } = useI18n();
  const { accent, mode, logo, palettes, materials, setAccent, setMode, setLogoMaterial } = useTheme();
  const [languageStatus, setLanguageStatus] = useState("");
  const [windowStatus, setWindowStatus] = useState("");
  const homeAlignment = useHomeAlignment();
  const languageInput = useRef<HTMLInputElement>(null);

  if (!active) return null;

  const importLanguageFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const pack = importPack(await file.text());
      setLanguageStatus(
        t("settings.languageImported", {
          name: pack.nativeName ?? pack.name ?? pack.code,
          code: pack.code,
        }),
      );
    } catch (error) {
      setLanguageStatus(error instanceof Error ? error.message : "导入失败。");
    } finally {
      if (languageInput.current) languageInput.current.value = "";
    }
  };

  return (
    <div className="settings-cards">
      <SettingsCard title="主题">
        <div className="setting-field">
          <span className="setting-field-label">主色调</span>
          <div className="setting-field-body">
            <div className="theme-swatches" role="radiogroup" aria-label="主色调">
              {palettes.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  role="radio"
                  aria-checked={accent === palette.id}
                  aria-label={palette.label}
                  title={palette.label}
                  className={`theme-swatch${accent === palette.id ? " is-selected" : ""}`}
                  style={{ ["--swatch-color" as string]: palette.base }}
                  onClick={() => setAccent(palette.id)}
                >
                  <span className="theme-swatch-dot" />
                  <span className="theme-swatch-label">{palette.label}</span>
                </button>
              ))}
            </div>
            <span className="setting-field-note">
              主色会用在按钮、选中态、进度条与强调文字上，切换立即生效并记住。
            </span>
          </div>
        </div>


        <div className="setting-field">
          <span className="setting-field-label">背景图标</span>
          <div className="setting-field-body">
            <div className="logo-materials" role="radiogroup" aria-label="背景图标材质色">
              <button
                type="button"
                role="radio"
                aria-checked={logo === ""}
                aria-label="默认"
                title="默认：保留 logo 原色"
                className={`logo-material${logo === "" ? " is-selected" : ""}`}
                onClick={() => setLogoMaterial("")}
              >
                <span className="logo-material-icon logo-material-icon-default" />
                <span className="logo-material-label">默认</span>
              </button>
              {materials.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  role="radio"
                  aria-checked={logo === material.id}
                  aria-label={material.label}
                  title={`${material.label} · 挖掘等级 ${material.level}`}
                  className={`logo-material${logo === material.id ? " is-selected" : ""}`}
                  style={{ ["--material-color" as string]: material.base }}
                  onClick={() => setLogoMaterial(material.id)}
                >
                  <span className="pickaxe" aria-hidden="true">
                    <span className="pickaxe-handle" />
                    <span className="pickaxe-head" />
                  </span>
                  <span className="logo-material-label">{material.label}</span>
                </button>
              ))}
            </div>
            <span className="setting-field-note">
              只把背景图标里那把镐的镐头换成对应材质，木柄和外框保持原样；按挖掘等级排列：木/金 0、石 1、铁 2、钻石 3、下界合金 4。
            </span>
          </div>
        </div>
        <div className="setting-field">
          <span className="setting-field-label">明暗模式</span>
          <div className="setting-field-body">
            <div className="segmented" role="radiogroup" aria-label="明暗模式">
              {(
                [
                  ["light", "浅色"],
                  ["dark", "深色"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  className={`segmented-option${mode === value ? " is-selected" : ""}`}
                  onClick={() => setMode(value as ThemeMode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="setting-field-note">
              深色模式会压暗壁纸、把面板换成深色玻璃；两套模式共用同一组主色。
            </span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="界面">
        <SettingRow
          title={<>{t("settings.language")}</>}
          control={
            <div className="settings-actions">
              <AppSelect
                style={{ width: 260 }}
                value={locale}
                onChange={(event) => {
                  setLocale(event.target.value);
                  setLanguageStatus("");
                }}
              >
                {packs.map((pack) => (
                  <option key={pack.code} value={pack.code}>
                    {labelOf(pack)}
                  </option>
                ))}
              </AppSelect>
              <button type="button" className="btn ghost" onClick={() => languageInput.current?.click()}>
                {t("settings.languageImport")}
              </button>
              {builtinCodes.includes(locale) ? null : (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    removePack(locale);
                    setLanguageStatus("");
                  }}
                >
                  {t("settings.languageRemove")}
                </button>
              )}
            </div>
          }
        >
          {languageStatus.length > 0 ? <span className="muted">{languageStatus}</span> : null}
        </SettingRow>
        <input
          ref={languageInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void importLanguageFile(event.target.files)}
        />

        <SettingRow
          title={<>主页按钮对齐</>}
          control={
            <div className="segmented" role="radiogroup" aria-label="主页按钮对齐">
              {(
                [
                  ["right", "向右对齐"],
                  ["center", "居中对齐"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={homeAlignment === value}
                  className={`segmented-option${homeAlignment === value ? " is-selected" : ""}`}
                  onClick={() => setHomeAlignment(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <div className="settings-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => void resetWindowCommand().then((result) => setWindowStatus(result.message))}
          >
            恢复默认窗口 1200 × 780
          </button>
          <span className="status">{windowStatus}</span>
        </div>
      </SettingsCard>
    </div>
  );
}
