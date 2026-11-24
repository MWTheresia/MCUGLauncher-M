import { useEffect, useState } from "react";
import {
  installFrontend,
  listFrontends,
  readFrontendIcon,
  reloadFrontend,
  removeFrontend,
  useFrontend,
  type FrontendSummary,
} from "../../api/commands/frontend";
import { pickFile } from "../../api/commands/pathPicker";
import { openFolder as openFolderCommand, readLog as readLogCommand } from "../../api/commands/settings";
import { AppTextarea } from "../../components/AppInput";
import Modal from "../../components/Modal";
import SvgIcon from "../../components/SvgIcon";
import cubeIcon from "../../assets/icons/ui/cube.svg";
import downloadIcon from "../../assets/icons/ui/download.svg";
import {
  setInstancePreview,
  setTopStatusForced,
  useDownloadAnimForced,
  useInstancePreview,
  useTopStatusForced,
  setDownloadAnimForced,
  type InstancePreview,
} from "../../shell/topStatusPreference";
import SettingRow from "./SettingRow";
import SettingsCard from "./SettingsCard";
import { useSettingsData } from "./SettingsData";
import { useSettingsStatus } from "./useSettingsStatus";

interface DeveloperSettingsProps {
  active: boolean;
}

type PendingAction =
  | { kind: "install"; path: string }
  | { kind: "remove"; item: FrontendSummary }
  | null;

function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 开发者选项：状态栏按钮、第三方前端与运行日志。 */
export default function DeveloperSettings({ active }: DeveloperSettingsProps) {
  const forceTasks = useTopStatusForced("tasks");
  const instancePreview = useInstancePreview();
  const downloadAnimForced = useDownloadAnimForced();
  const { say, statusAt } = useSettingsStatus();
  const { resourceVersions, refreshSettingsResources } = useSettingsData();
  const [log, setLog] = useState("");
  const [frontends, setFrontends] = useState<FrontendSummary[] | null>(null);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [activeFrontend, setActiveFrontend] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  /** 拖拽悬停中：整张卡片高亮成投放区 */
  const [dragging, setDragging] = useState(false);

  const revision = resourceVersions.settings?.revision ?? 0;

  const readLog = async () => {
    setLog(await readLogCommand());
    say("developer:logs", "");
  };

  const refreshFrontends = async () => {
    try {
      const list = await listFrontends();
      setFrontends(list.items);
      setActiveFrontend(list.active);
    } catch (error) {
      setFrontends([]);
      say("developer:frontends", error instanceof Error ? error.message : "读取已安装前端失败。");
    }
  };

  useEffect(() => {
    if (!active) return;
    void readLogCommand().then(setLog);
    void refreshFrontends();
  }, [active]);

  // 图标单独取：列表只负责“有没有”，真正显示时再按需读成 data URL。
  useEffect(() => {
    const wanted = (frontends ?? []).filter((item) => item.hasIcon);
    if (wanted.length === 0) {
      setIcons({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      wanted.map(async (item) => {
        const key = `${item.identifier}@${item.version}`;
        try {
          return [key, await readFrontendIcon(item.identifier, item.version)] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setIcons(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [frontends]);

  /**
   * 拖进来就完事：安装 → 启用 → 重启界面，中间不需要再点任何按钮。
   * 只接受 .mcuglf / .zip，拖错文件只提示、不会尝试安装。
   */
  const installAndApply = async (path: string) => {
    const lower = path.toLowerCase();
    if (!lower.endsWith(".mcuglf") && !lower.endsWith(".zip")) {
      say("developer:frontends", "只接受 .mcuglf 或 .zip 前端包，这个文件不会被安装。");
      return;
    }
    setBusy(true);
    say("developer:frontends", `正在安装 ${fileName(path)}…`);
    try {
      const item = await installFrontend(path);
      await refreshFrontends();
      const applied = await useFrontend(item.identifier, revision);
      await refreshSettingsResources(applied.changed);
      // 列表与「当前使用」也要立刻刷新，否则拖完还显示旧的官方前端
      await refreshFrontends();
      say("developer:frontends", `已启用 ${item.name} ${item.version}，正在重启界面…`);
      await reloadFrontend();
      // 正常情况下窗口已经被新界面替换，下面这行多半执行不到
      say("developer:frontends", `已启用 ${item.name} ${item.version}。`);
    } catch (error) {
      say("developer:frontends", error instanceof Error ? error.message : "安装前端失败。");
    } finally {
      setBusy(false);
    }
  };

  /*
   * Tauri 窗口会拦截原生文件拖放，DOM 的 drop 事件拿不到路径，
   * 所以正式环境走 webview 的拖放事件（payload 里带绝对路径）。
   */
  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "over") {
          setDragging(true);
        } else if (event.payload.type === "drop") {
          setDragging(false);
          const path = event.payload.paths?.[0];
          if (path) void installAndApply(path);
        } else {
          setDragging(false);
        }
      });
      dispose = unlisten;
    })();
    return () => {
      cancelled = true;
      dispose?.();
    };
    // installAndApply 只依赖当前 revision，重新挂监听没有必要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  const importFrontend = async () => {
    const path = await pickFile({ title: "选择前端包（.mcuglf）" });
    if (path) setPending({ kind: "install", path });
  };


  const switchFrontend = async (identifier: string | null) => {
    setBusy(true);
    say("developer:frontends", "正在切换…");
    try {
      const result = await useFrontend(identifier, revision);
      await refreshSettingsResources(result.changed);
      await refreshFrontends();
      say("developer:frontends", result.message);
    } catch (error) {
      say("developer:frontends", error instanceof Error ? error.message : "切换前端失败。");
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true);
    say("developer:frontends", "正在重启前端…");
    try {
      const result = await reloadFrontend();
      // 正常情况下这个 Promise 还没走完，窗口就已经被新窗口替换了。
      say("developer:frontends", result.message);
    } catch (error) {
      say("developer:frontends", error instanceof Error ? error.message : "重启前端失败。");
    } finally {
      setBusy(false);
    }
  };

  const removeFrontendVersion = async (item: FrontendSummary) => {
    setBusy(true);
    say("developer:frontends", "正在卸载…");
    try {
      const result = await removeFrontend(item.identifier, item.version, revision);
      await refreshSettingsResources(result.changed);
      await refreshFrontends();
      say("developer:frontends", result.message);
    } catch (error) {
      say("developer:frontends", error instanceof Error ? error.message : "卸载前端失败。");
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.kind === "install") {
      setBusy(true);
      say("developer:frontends", "正在导入…");
      try {
        const item = await installFrontend(action.path);
        await refreshFrontends();
        say(
          "developer:frontends",
          `已导入 ${item.name} ${item.version}。点「使用」选中，再点「重启前端」生效。`,
        );
      } catch (error) {
        say("developer:frontends", error instanceof Error ? error.message : "导入前端失败。");
      } finally {
        setBusy(false);
      }
      return;
    }
    await removeFrontendVersion(action.item);
  };

  const frontendStatus = statusAt("developer:frontends");
  /** 演示模式没有文件系统：拖放能模拟，但「导入前端包」弹不出原生选择框。 */
  const demo = typeof window !== "undefined" && "__MCUGL_DEMO__" in window;
  const activeName = activeFrontend
    ? frontends?.find((item) => item.identifier === activeFrontend)?.name ?? activeFrontend
    : "官方前端";

  return (
    <div className="settings-cards">
      <SettingsCard
        title={
          <>
            开发者选项
          </>
        }
      >
        <SettingRow
          title={
            <>
              强制显示下载任务按钮
            </>
          }
          control={
            <button
              type="button"
              role="switch"
              aria-checked={forceTasks}
              aria-label="强制显示下载任务按钮"
              className={`switch${forceTasks ? " on" : ""}`}
              onClick={() => setTopStatusForced("tasks", !forceTasks)}
            >
              <span className="switch-thumb" />
            </button>
          }
        />
        <SettingRow
          title={<>强制播放下载动画</>}
          control={
            <button
              type="button"
              role="switch"
              aria-checked={downloadAnimForced}
              aria-label="强制播放下载动画"
              className={`switch${downloadAnimForced ? " on" : ""}`}
              onClick={() => setDownloadAnimForced(!downloadAnimForced)}
            >
              <span className="switch-thumb" />
            </button>
          }
        >
          <span className="muted">
            循环播放：倒三角红色自下而上填满 → 翻成正三角变绿 → 消失。
          </span>
        </SettingRow>
        <SettingRow
          title={<>实例状态灯预览</>}
          control={
            <div className="segmented" role="radiogroup" aria-label="实例状态灯预览">
              {(
                [
                  [0, "按实际"],
                  [1, "1 个实例"],
                  [2, "2 个实例"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={instancePreview === value}
                  className={`segmented-option${instancePreview === value ? " is-selected" : ""}`}
                  onClick={() => setInstancePreview(value as InstancePreview)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <span className="muted">
            选「1 个实例」是绿屏无数字，「2 个实例」是绿屏带数字；只看效果，不会真的启动游戏。
          </span>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title={
          <>
            前端（第三方 UI）
          </>
        }
      >
        <span className="muted">
          导入 `.mcuglf` 包即可用别人的界面替换本启动器界面。第三方前端通过
          mcugl.kernel/v1 访问与官方界面相同的命令，因此拥有完整的数据读写权限，只导入你信任的文件。
          切换后点「重启前端」立即生效；如果第三方界面白屏或卡死，按 Ctrl+Alt+C
          可强制切回官方前端，启动器不会退出。
        </span>

        {/* 傻瓜式入口：把包拖进来就自动安装、启用并重启，不需要再点任何按钮 */}
        <div
          className={`frontend-drop${dragging ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void installAndApply(file.name);
          }}
        >
          <SvgIcon src={downloadIcon} className="frontend-drop-icon" />
          <span className="frontend-drop-text">
            <span className="frontend-drop-title">把 .mcuglf 拖到这里</span>
            <span className="muted">松开后自动安装、启用并重启界面，不用再点任何按钮</span>
          </span>
        </div>
        {demo ? (
          <span className="status">
            演示模式：拖放会走模拟安装；「导入前端包…」在这里不会弹出选择框，桌面端才走原生文件对话框。
          </span>
        ) : null}

        <div className="settings-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void importFrontend()}
          >
            导入前端包…
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void reload()}
          >
            重启前端
          </button>
          <span className="status">当前使用：{activeName}</span>
          <span className="status">{frontendStatus}</span>
        </div>

        {frontends === null ? (
          <span className="muted">正在读取已安装前端…</span>
        ) : frontends.length === 0 ? (
          <span className="muted">
            还没有安装第三方前端。可以用 npm run frontend:pack 把示例目录打成 `.mcuglf` 再导入。
          </span>
        ) : (
          frontends.map((item) => {
            const key = `${item.identifier}@${item.version}`;
            const icon = icons[key];
            return (
            <div className="setting-row" key={key}>
              <div className="frontend-info">
                {icon ? (
                  <img className="frontend-icon" src={icon} alt={`${item.name} 图标`} />
                ) : (
                  <span className="frontend-icon fallback" aria-hidden="true">
                    <SvgIcon src={cubeIcon} className="frontend-icon-glyph" />
                  </span>
                )}
                <div className="setting-copy">
                  <span className="setting-title">
                    {item.name} <span className="muted">{item.version}</span>
                    {item.active ? <span className="status"> · 使用中</span> : null}
                  </span>
                  <span className="muted">
                    {item.identifier}
                    {item.author ? ` · ${item.author}` : ""} · 内核 {item.kernelApi}
                  </span>
                  {item.description ? <span className="muted">{item.description}</span> : null}
                </div>
              </div>
              {/* 停用/启用与卸载分开：前者只是切回官方界面，后者才动文件，两者不该挤在同一个位置 */}
              <div className="frontend-actions">
                {item.active ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => void switchFrontend(null)}
                  >
                    停用
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => void switchFrontend(item.identifier)}
                  >
                    使用
                  </button>
                )}
                <span className="frontend-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="btn ghost danger"
                  disabled={busy}
                  onClick={() => setPending({ kind: "remove", item })}
                >
                  卸载
                </button>
              </div>
            </div>
            );
          })
        )}
      </SettingsCard>

      <SettingsCard
        title={
          <>
            运行日志
          </>
        }
      >
        <div className="settings-actions">
          <button type="button" className="btn primary" onClick={() => void readLog()}>
            刷新日志
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              void openFolderCommand("config").then((result) =>
                say("developer:logs", result.message),
              )
            }
          >
            打开日志目录
          </button>
          <span className="status">{statusAt("developer:logs")}</span>
        </div>
        <AppTextarea className="log-box" readOnly value={log} />
      </SettingsCard>

      {pending ? (
        <Modal
          title={pending.kind === "install" ? "导入第三方前端" : "卸载前端"}
          onClose={() => setPending(null)}
          footer={(close) => (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => close()}
              >
                取消
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => close(() => void confirmPending())}
              >
                {pending.kind === "install" ? "确认导入" : "确认卸载"}
              </button>
            </>
          )}
        >
          {pending.kind === "install" ? (
            <div className="stack">
              <span>
                即将导入 <strong>{fileName(pending.path)}</strong>。
              </span>
              <span className="muted">
                第三方前端会获得与官方界面相同的权限（读取实例、账号、设置，调用内核命令）。只导入你信任来源的文件。
              </span>
            </div>
          ) : (
            <div className="stack">
              <span>
                卸载 <strong>{pending.item.name}</strong> {pending.item.version}？
              </span>
              <span className="muted">
                如果这是当前使用的前端，卸载后会切回官方前端；改动在重启后完全生效。
              </span>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
