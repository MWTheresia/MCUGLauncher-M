import { useEffect, useMemo, useState } from "react";
import { saveSettings as saveSettingsCommand } from "../../api/commands/settings";
import { AppInput, AppSelect } from "../../components/AppInput";
import JavaPrompt from "../../components/JavaPrompt";
import PathPrompt from "../../components/PathPrompt";
import { LIMITS } from "../../constants";
import type { AppSettingsPatch } from "../../types/launcher";
import SettingsCard from "./SettingsCard";
import { useSettingsData } from "./SettingsData";
import { useSettingsStatus } from "./useSettingsStatus";

interface LaunchSettingsProps {
  active: boolean;
}

/** 窗口尺寸常用值：点一下就把宽高填好，省得手输错数字。 */
const WINDOW_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "1280 × 720", width: 1280, height: 720 },
  { label: "1440 × 900", width: 1440, height: 900 },
  { label: "1600 × 900", width: 1600, height: 900 },
  { label: "1920 × 1080", width: 1920, height: 1080 },
];

/** 内存常用值（MB）。 */
const RAM_PRESETS = [2048, 4096, 8192, 16384];

const inRange = (value: string, min: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

/** 启动：游戏目录、Java、内存、窗口与玩家名。 */
export default function LaunchSettings({ active }: LaunchSettingsProps) {
  const { overview, settings, accounts, resourceVersions, refreshSettingsResources } = useSettingsData();
  const { say, statusAt } = useSettingsStatus();
  const [root, setRoot] = useState("");
  const [java, setJava] = useState("");
  const [ram, setRam] = useState("4096");
  const [width, setWidth] = useState("1280");
  const [height, setHeight] = useState("720");
  const [player, setPlayer] = useState("");
  const [autoMemory, setAutoMemory] = useState(true);
  const [autoChinese, setAutoChinese] = useState(true);
  const [prompt, setPrompt] = useState<null | "root" | "java">(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    setRoot(settings.root);
    setJava(settings.java);
    setRam(String(settings.ram));
    setWidth(String(settings.width));
    setHeight(String(settings.height));
    setPlayer(accounts.find((account) => account.id === overview.activeAccountId)?.player ?? "");
    setAutoMemory(settings.autoMemory);
    setAutoChinese(settings.autoChinese);
    setHydrated(true);
  }, [hydrated, settings, accounts, overview]);

  const activeAccount = accounts.find((account) => account.id === overview.activeAccountId);
  const offline = activeAccount?.kind === "offline";
  const savedPlayer = activeAccount?.player ?? "";

  /** 校验：全部规则集中在一处，保存按钮与行内提示都读它。 */
  const errors = useMemo(() => {
    const result = {
      root: root.trim().length === 0 ? "请先选择游戏目录，启动器需要知道游戏装在哪。" : "",
      ram:
        !autoMemory && !inRange(ram, LIMITS.ramMin, LIMITS.ramMax)
          ? `需在 ${LIMITS.ramMin}–${LIMITS.ramMax} MB 之间。`
          : "",
      width: !inRange(width, LIMITS.windowWidthMin, LIMITS.windowWidthMax)
        ? `需在 ${LIMITS.windowWidthMin}–${LIMITS.windowWidthMax} 之间。`
        : "",
      height: !inRange(height, LIMITS.windowHeightMin, LIMITS.windowHeightMax)
        ? `需在 ${LIMITS.windowHeightMin}–${LIMITS.windowHeightMax} 之间。`
        : "",
      player: offline && player.trim().length === 0 ? "离线账号必须填写玩家名。" : "",
    };
    return result;
  }, [root, autoMemory, ram, width, height, offline, player]);

  const invalidCount = Object.values(errors).filter((message) => message.length > 0).length;

  if (!active) return null;

  /** 与已保存的值逐项比对：没有改动时保存按钮置灰，避免无意义的写入。 */
  const dirty =
    root.trim() !== settings.root ||
    java.trim() !== settings.java ||
    (autoMemory ? settings.ram : Number.parseInt(ram, 10)) !== settings.ram ||
    Number.parseInt(width, 10) !== settings.width ||
    Number.parseInt(height, 10) !== settings.height ||
    autoMemory !== settings.autoMemory ||
    autoChinese !== settings.autoChinese ||
    (offline && player.trim() !== savedPlayer);

  const roots = Array.from(new Set([...settings.gameRoots, settings.root, root])).filter(
    (value) => value.length > 0,
  );

  const saveLaunch = async () => {
    if (invalidCount > 0) {
      say("launch:settings", "还有未修正的项，先按提示改好再保存。");
      return;
    }
    setSaving(true);
    say("launch:settings", "正在保存…");
    const patch: AppSettingsPatch = {
      root: root.trim(),
      java: java.trim(),
      ram: Number.parseInt(ram, 10),
      width: Number.parseInt(width, 10),
      height: Number.parseInt(height, 10),
      autoMemory,
      autoChinese,
      ...(offline ? { player: player.trim() } : {}),
    };
    try {
      const result = await saveSettingsCommand(patch, resourceVersions.settings?.revision ?? 0);
      await refreshSettingsResources(result.changed);
      say("launch:settings", result.message);
    } catch (error) {
      say("launch:settings", error instanceof Error ? error.message : "保存启动设置失败。");
    } finally {
      setSaving(false);
    }
  };

  /** 数字框失焦时把超范围的值夹回边界，避免留着非法值又点不到保存。 */
  const clampOnBlur = (value: string, min: number, max: number, apply: (next: string) => void) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      apply(String(min));
      return;
    }
    if (parsed < min) apply(String(min));
    else if (parsed > max) apply(String(max));
  };

  const status = statusAt("launch:settings");
  const windowPresetActive = (preset: { width: number; height: number }) =>
    Number.parseInt(width, 10) === preset.width && Number.parseInt(height, 10) === preset.height;

  return (
    <>
      <SettingsCard title="启动">
        <div className="setting-field">
          <span className="setting-field-label">游戏目录</span>
          <div className="setting-field-body">
            <div className="settings-actions">
              <AppInput
                placeholder="游戏根目录"
                value={root}
                aria-invalid={errors.root.length > 0}
                onChange={(event) => setRoot(event.target.value)}
              />
              <button type="button" className="btn ghost" onClick={() => setPrompt("root")}>
                选择…
              </button>
            </div>
            {errors.root.length > 0 ? <span className="setting-field-error">{errors.root}</span> : null}
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">已保存目录</span>
          <div className="setting-field-body">
            <div className="settings-actions">
              <AppSelect value={root} onChange={(event) => setRoot(event.target.value)}>
                {roots.length === 0 ? <option value="">还没有保存过目录</option> : null}
                {roots.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </AppSelect>
            </div>
            <span className="setting-field-note">切换后同样要点「保存设置」才生效。</span>
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">Java 路径</span>
          <div className="setting-field-body">
            <div className="settings-actions">
              <AppInput
                placeholder="留空时由启动核心自动选择"
                value={java}
                onChange={(event) => setJava(event.target.value)}
              />
              <button type="button" className="btn ghost" onClick={() => setPrompt("java")}>
                选择…
              </button>
            </div>
            <span className="setting-field-note">留空不会报错，启动时按 PATH 与常见安装位置查找。</span>
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">内存上限</span>
          <div className="setting-field-body">
            <button
              type="button"
              role="switch"
              aria-checked={autoMemory}
              aria-label="自动分配内存"
              className={`switch${autoMemory ? " on" : ""}`}
              onClick={() => setAutoMemory((value) => !value)}
            >
              <span className="switch-thumb" />
            </button>
            <span className="setting-unit">自动分配</span>
            <AppInput
              className="setting-num"
              value={ram}
              disabled={autoMemory}
              inputMode="numeric"
              aria-invalid={errors.ram.length > 0}
              onChange={(event) => setRam(event.target.value)}
              onBlur={() => clampOnBlur(ram, LIMITS.ramMin, LIMITS.ramMax, setRam)}
            />
            <span className="setting-unit">MB</span>
            <div className="setting-chips">
              {RAM_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`setting-chip${
                    !autoMemory && Number.parseInt(ram, 10) === value ? " is-active" : ""
                  }`}
                  disabled={autoMemory}
                  onClick={() => {
                    setAutoMemory(false);
                    setRam(String(value));
                  }}
                >
                  {value / 1024} GB
                </button>
              ))}
            </div>
            {errors.ram.length > 0 ? (
              <span className="setting-field-error">{errors.ram}</span>
            ) : (
              <span className="setting-field-note">
                {autoMemory
                  ? "按系统内存自动计算上限，关闭后可手动填写。"
                  : `范围 ${LIMITS.ramMin}–${LIMITS.ramMax} MB。`}
              </span>
            )}
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">游戏窗口</span>
          <div className="setting-field-body">
            <AppInput
              className="setting-num"
              value={width}
              inputMode="numeric"
              aria-label="游戏窗口宽"
              aria-invalid={errors.width.length > 0}
              onChange={(event) => setWidth(event.target.value)}
              onBlur={() => clampOnBlur(width, LIMITS.windowWidthMin, LIMITS.windowWidthMax, setWidth)}
            />
            <span className="setting-unit">×</span>
            <AppInput
              className="setting-num"
              value={height}
              inputMode="numeric"
              aria-label="游戏窗口高"
              aria-invalid={errors.height.length > 0}
              onChange={(event) => setHeight(event.target.value)}
              onBlur={() => clampOnBlur(height, LIMITS.windowHeightMin, LIMITS.windowHeightMax, setHeight)}
            />
            <div className="setting-chips">
              {WINDOW_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`setting-chip${windowPresetActive(preset) ? " is-active" : ""}`}
                  onClick={() => {
                    setWidth(String(preset.width));
                    setHeight(String(preset.height));
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {errors.width.length > 0 || errors.height.length > 0 ? (
              <span className="setting-field-error">
                {errors.width || errors.height}
              </span>
            ) : null}
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">语言</span>
          <div className="setting-field-body">
            <button
              type="button"
              role="switch"
              aria-checked={autoChinese}
              aria-label="启动时自动设置简体中文"
              className={`switch${autoChinese ? " on" : ""}`}
              onClick={() => setAutoChinese((value) => !value)}
            >
              <span className="switch-thumb" />
            </button>
            <span className="setting-unit">启动时自动设置简体中文</span>
            <span className="setting-field-note">仅当版本缺少语言选项时生效，不会覆盖你已有的选择。</span>
          </div>
        </div>

        <div className="setting-field">
          <span className="setting-field-label">玩家名</span>
          <div className="setting-field-body">
            <AppInput
              className="setting-name"
              value={player}
              disabled={!offline}
              placeholder={offline ? "填写离线游戏内名称" : ""}
              aria-invalid={errors.player.length > 0}
              onChange={(event) => setPlayer(event.target.value)}
              onBlur={() => setPlayer((value) => value.trim())}
            />
            {errors.player.length > 0 ? (
              <span className="setting-field-error">{errors.player}</span>
            ) : (
              <span className="setting-field-note">
                {offline ? "离线账号用这个名称进游戏。" : "在线账号的名称由登录信息决定，不可修改。"}
              </span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <span
            className={`settings-footer-note${invalidCount > 0 ? " is-error" : dirty ? " is-dirty" : ""}`}
          >
            {invalidCount > 0 ? (
              `${invalidCount} 项需要修正`
            ) : dirty ? (
              <>
                <span className="settings-dot" />
                有未保存的修改
              </>
            ) : status.length > 0 ? (
              status
            ) : (
              "所有修改已保存"
            )}
          </span>
          <button
            type="button"
            className="btn primary"
            disabled={invalidCount > 0 || !dirty || saving}
            onClick={() => void saveLaunch()}
          >
            {saving ? "保存中…" : dirty ? "保存设置" : "已保存"}
          </button>
        </div>
      </SettingsCard>

      {prompt === "root" ? (
        <PathPrompt
          title="选择游戏目录"
          label="游戏根目录"
          initial={root}
          hint="目录必须已存在。"
          onCancel={() => setPrompt(null)}
          onConfirm={(path) => {
            setPrompt(null);
            setRoot(path);
          }}
        />
      ) : null}

      {prompt === "java" ? (
        <JavaPrompt
          initial={java}
          onCancel={() => setPrompt(null)}
          onConfirm={(path) => {
            setPrompt(null);
            setJava(path);
          }}
        />
      ) : null}
    </>
  );
}
