import { useEffect, useRef, useState } from "react";
import LaunchPlayIcon from "../assets/icons/capsule/LaunchPlayIcon.svg";
import SwitchPlayerIcon from "../assets/icons/app/SwitchPlayerIcon.svg";
import closeIcon from "../assets/icons/ui/close.svg";
import cubeIcon from "../assets/icons/ui/cube.svg";
import jumpIcon from "../assets/icons/ui/jump.svg";
import SvgIcon from "../components/SvgIcon";
import { launchGame } from "../api/commands/launch";
import { selectInstance } from "../api/commands/state";
import type { PlayerInfo } from "../types/view-models";
import { currentFrontend } from "../shell/frontendContext";
import { useHomeAlignment } from "../shell/homeAlignment";
import { useNavigation } from "../shell/navigation";
import { useToast } from "../shell/toast";
import { useLauncher } from "../state/launcher";
import LaunchToast from "./home/LaunchToast";
import "./HomePage.css";

/** 角色类型的中文说明；外置登录附带验证服务器名。 */
function playerTypeText(player: PlayerInfo): string {
  if (player.playerType === "microsoft") return "微软账号";
  if (player.playerType === "offline") return "离线账号";
  if (player.playerType === "mua") {
    return player.authServer.length > 0 ? `MUA 账号 · ${player.authServer}` : "MUA 账号";
  }
  return player.playerType;
}

const LOADER_LABEL: Record<string, string> = {
  vanilla: "原版",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
  quilt: "Quilt",
};

/** 实例卡的第二行：版本 · 加载器 · 模组数 */
function instanceMeta(item: { minecraft: string; loader: string; mods: number }): string {
  return [
    item.minecraft,
    LOADER_LABEL[item.loader] ?? item.loader,
    item.mods > 0 ? `${item.mods} 模组` : "",
  ]
    .filter((part) => part.length > 0)
    .join(" · ");
}

/**
 * 主页：左侧实例轨道 + 右下启动坞。
 * 轨道负责「选哪个实例」，启动坞负责「用哪个账号、什么时候启动」。
 */
export default function HomePage() {
  const { openAccount, openInstanceManager } = useNavigation();
  const { notify } = useToast();
  const { overview, accounts, instances: instanceCatalog, games, avatar, refreshState } = useLauncher();
  const homeAlignment = useHomeAlignment();
  const [bumping, setBumping] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; scale: number }[]>([]);
  /** 启动进度 toast：显示在按钮栏上方（居中时位于启动按钮正上方）；cancelled 由启动按钮的 X 触发 */
  const [launching, setLaunching] = useState<{
    id: number;
    name: string;
    task: Promise<void>;
    cancelled?: boolean;
  } | null>(null);
  /** 取消标记：启动请求回来时据此吞掉成功/失败提示 */
  const launchCancelled = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [playerPickerClosing, setPlayerPickerClosing] = useState(false);

  // 角色浮层：点空白处或按 Esc 收起
  useEffect(() => {
    if (!playerPickerOpen) return;
    const close = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest(".player-pin, .player-picker")) return;
      if (playerPickerClosing) return;
      setPlayerPickerClosing(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (playerPickerClosing) return;
      setPlayerPickerClosing(true);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [playerPickerOpen, playerPickerClosing]);

  // 浮层先淡出，动画结束后再卸载
  useEffect(() => {
    if (!playerPickerClosing) return;
    const timer = window.setTimeout(() => {
      setPlayerPickerOpen(false);
      setPlayerPickerClosing(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [playerPickerClosing]);

  const openPlayerPicker = () => {
    setPlayerPickerClosing(false);
    setPlayerPickerOpen(true);
  };

  const closePlayerPicker = () => {
    if (playerPickerOpen && !playerPickerClosing) setPlayerPickerClosing(true);
  };

  if (!overview || !accounts || !instanceCatalog) {
    return (
      <div className="page">
        <div className="empty">正在加载启动器状态…</div>
      </div>
    );
  }

  const centered = homeAlignment === "center";
  const instances = instanceCatalog.items.filter((item) => item.name.length > 0 && !item.isPlaceholder);
  const current = instances.find((item) => item.id === overview.selectedInstanceId);
  const runningIds = new Set(
    games
      .filter((game) => ["preparing", "starting", "running", "stopping"].includes(game.status))
      .map((game) => game.instanceId)
  );

  // 账号列表来自 list_accounts；头像只对当前账号可用
  const players: PlayerInfo[] =
    accounts.length > 0
      ? accounts.map((account) => ({
          id: account.id,
          name: account.player.length > 0 ? account.player : "未登录",
          playerType: account.kind,
          authServer: "",
          avatar: account.id === overview.activeAccountId ? avatar?.image ?? "" : "",
        }))
      : [
          {
            id: "current",
            name: "未登录",
            playerType: "offline",
            authServer: "",
            avatar: avatar?.image ?? "",
          },
        ];
  const selectedPlayer = players.find((item) => item.id === overview.activeAccountId) ?? players[0];

  /** 水波：以启动按钮为圆心铺开，半径覆盖整页。居中对齐时按钮在页面中线上，
   *  水平圆心直接取页面中线，水波严格左右对称。 */
  const spawnRipple = (button: HTMLElement) => {
    const host = hostRef.current;
    if (!host) return;
    const area = host.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const x = centered ? area.width / 2 : rect.left + rect.width / 2 - area.left;
    const y = rect.top + rect.height / 2 - area.top;
    const reach = Math.hypot(Math.max(x, area.width - x), Math.max(y, area.height - y));
    const id = Date.now() + Math.random();
    setRipples((previous) => [...previous, { id, x, y, scale: (reach * 2) / 20 }]);
    window.setTimeout(() => setRipples((previous) => previous.filter((item) => item.id !== id)), 900);
  };

  /** 相邻两张卡的跟随抖动：重置类名以便重复触发。 */
  const bumpCards = () => {
    setBumping(false);
    window.requestAnimationFrame(() => setBumping(true));
  };

  /** 真正发起启动：进度层只关心它什么时候 settle */
  const runLaunch = async (instanceId: string) => {
    try {
      const result = await launchGame(instanceId, overview.activeAccountId ?? "");
      if (launchCancelled.current) return;
      await refreshState();
      notify(`启动请求已接受：${result.sessionId}`);
    } catch (error) {
      if (launchCancelled.current) return;
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const launch = (button: HTMLElement) => {
    if (launching) return;
    spawnRipple(button);
    bumpCards();
    if (!current) {
      notify("请先安装或选择实例。");
      return;
    }
    launchCancelled.current = false;
    setLaunching({ id: Date.now(), name: current.name, task: runLaunch(current.id) });
  };

  /** 启动按钮在进度期间变成 X：点它取消，进度 toast 立刻滑出 */
  const cancelLaunch = () => {
    if (!launching || launching.cancelled) return;
    launchCancelled.current = true;
    setLaunching((current) => (current ? { ...current, cancelled: true } : current));
    notify("已取消启动。");
  };

  /** 角色切换目前由「账号」页完成，这里只做跳转。 */
  const choosePlayer = (id: string) => {
    closePlayerPicker();
    if (id === selectedPlayer.id) return;
    notify("在「账号」页切换登录的角色。");
    openAccount();
  };

  /** 轨道里选中一个实例：写回后端并刷新，当前实例决定启动坞的启动目标。 */
  const chooseInstance = async (id: string) => {
    if (current?.id === id || switching !== null) return;
    setSwitching(id);
    try {
      await selectInstance(id);
      await refreshState();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSwitching(null);
    }
  };

  const running = current ? runningIds.has(current.id) : false;
  /** 作为第三方前端加载时，界面上要标出自己是谁，避免和官方界面混淆。 */
  const frontend = currentFrontend();

  return (
    <div className="home" ref={hostRef}>
      {/* 点击启动时的水波层，位于按钮之下、胶囊之下的同一平面 */}
      <div className="ripple-layer" aria-hidden="true">
        {ripples.map((item) => (
          <span
            key={item.id}
            className="ripple"
            style={{
              left: item.x,
              top: item.y,
              ["--ripple-scale" as string]: item.scale,
            }}
          />
        ))}
      </div>

      <aside className="home-rail" aria-label="我的实例">
        <div className="rail-brand">
          <img className="rail-brand-logo" src="/MCUGLogo.svg" alt="" />
          <div className="rail-brand-text">
            <span className="rail-brand-name">MCUG Launcher</span>
            <span className="rail-brand-ver">
              v{overview.appVersion}
              {frontend ? ` · ${frontend.name}` : ""}
            </span>
          </div>
        </div>

        <div className="rail-head">
          <span className="rail-title">我的实例</span>
          <span className="rail-count">{instances.length}</span>
        </div>

        <div className="rail-list">
          {instances.length === 0 ? (
            <p className="rail-empty">还没有实例，先到「下载」装一个版本。</p>
          ) : (
            instances.map((item) => {
              const isCurrent = item.id === current?.id;
              const isRunning = runningIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`instance-tile${isCurrent ? " is-current" : ""}`}
                  aria-pressed={isCurrent}
                  aria-busy={switching === item.id}
                  onClick={() => void chooseInstance(item.id)}
                >
                  <span className="tile-cube">
                    <SvgIcon src={cubeIcon} />
                  </span>
                  <span className="tile-body">
                    <span className="tile-name">{item.name}</span>
                    <span className="tile-meta">{instanceMeta(item)}</span>
                  </span>
                  {isRunning ? <span className="tile-live">运行中</span> : null}
                </button>
              );
            })
          )}
        </div>

        <button type="button" className="rail-more" onClick={() => openInstanceManager()}>
          全部实例
          <SvgIcon src={jumpIcon} />
        </button>
      </aside>

      {/* 右下启动坞：角色 + 启动；进度 toast 浮在坞上方 */}
      <div className={`home-launch${centered ? " is-centered" : ""}`}>
        {launching ? (
          <LaunchToast
            key={launching.id}
            name={launching.name}
            task={launching.task}
            cancelled={launching.cancelled ?? false}
            onExit={() => setLaunching(null)}
          />
        ) : null}

        <div className={`launch-row${bumping ? " is-bumping" : ""}`}>
          <div className={`player-pin${playerPickerOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="player-pin-main"
              aria-expanded={playerPickerOpen}
              onClick={() => {
                if (playerPickerOpen && !playerPickerClosing) closePlayerPicker();
                else openPlayerPicker();
              }}
            >
              {selectedPlayer.avatar.length > 0 ? (
                <img className="player-pin-avatar" src={selectedPlayer.avatar} alt="" />
              ) : (
                <span className="player-pin-avatar is-blank" />
              )}
              <span className="player-pin-text">
                <span className="player-pin-name">{selectedPlayer.name}</span>
                <span className="player-pin-type">{playerTypeText(selectedPlayer)}</span>
              </span>
              <SvgIcon className="player-pin-switch" src={SwitchPlayerIcon} />
            </button>

            {playerPickerOpen ? (
              <div
                className={`player-picker${playerPickerClosing ? " is-closing" : ""}`}
                role="listbox"
                aria-label="选择角色"
              >
                {players.length === 0 ? (
                  <p className="muted player-picker-empty">还没有登录的角色。</p>
                ) : (
                  players.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      role="option"
                      aria-selected={player.id === selectedPlayer.id}
                      className={`player-picker-item ${player.id === selectedPlayer.id ? "selected" : ""}`}
                      onClick={() => choosePlayer(player.id)}
                    >
                      <span className="player-picker-radio" />
                      {player.avatar.length > 0 ? (
                        <img className="player-picker-avatar" src={player.avatar} alt="" />
                      ) : null}
                      <span className="player-picker-text">
                        <span className="player-picker-name">{player.name}</span>
                        <span className="player-picker-type">{playerTypeText(player)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="launch-stack">
            <span className="launch-caption">
              {running
                ? "运行中"
                : current
                  ? `启动 ${current.name}`
                  : "未选择实例"}
            </span>
            <button
              type="button"
              className="btn launch-square"
              aria-label={launching ? "取消启动" : "启动游戏"}
              onClick={(event) => (launching ? cancelLaunch() : void launch(event.currentTarget))}
              disabled={!current && !launching}
            >
              {launching ? (
                <SvgIcon src={closeIcon} className="launch-cancel-icon" />
              ) : (
                <img src={LaunchPlayIcon} alt="" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
