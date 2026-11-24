import { useCallback, useEffect, useRef, useState } from "react";
import navTasks from "../assets/icons/nav/nav-tasks.svg";
import { stopGame } from "../api/commands/games";
import { taskAction } from "../api/commands/tasks";
import SvgIcon from "../components/SvgIcon";
import { useLauncher } from "../state/launcher";
import type { GameSessionInfo, TaskInfo } from "../types/launcher";
import { useInstancePreview, useTopStatusForced } from "./topStatusPreference";
import "./TopStatusButtons.css";

type StatusKey = "games" | "tasks";

/** 与 TopStatusButtons.css 的淡出时长保持一致。 */
const EXIT_MS = 140;

/** 这些状态的任务已经结束，不再占用下载入口。 */
const TERMINAL_TASKS = new Set(["succeeded", "failed", "cancelled"]);

const TASK_ACTIONS: { key: string; label: string }[] = [
  { key: "pause", label: "暂停" },
  { key: "resume", label: "继续" },
  { key: "cancel", label: "取消" },
  { key: "delete", label: "删除" },
];

const TASK_STATUS: Record<string, string> = {
  queued: "排队中",
  running: "进行中",
  paused: "已暂停",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function statusText(value: string): string {
  return TASK_STATUS[value] ?? value;
}

function taskPercent(task: TaskInfo): number | null {
  const progress = task.progress;
  const total = progress?.total;
  if (!progress || total == null || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((progress.completed / total) * 100)));
}

/**
 * 两个独立的状态浮窗：
 * - 运行实例：左下角常驻圆形，屏幕红=没有实例在跑，绿=有；两个及以上在屏幕上显示数字。
 * - 下载任务：右上角圆形，只在有未结束任务时出现。
 */
export default function TopStatus() {
  const { games, tasks, instances, refreshGames, refreshTasks } = useLauncher();
  const forceTasks = useTopStatusForced("tasks");
  /** 开发者选项里的预览：把实例灯钉在 1 个 / 2 个的状态上 */
  const instancePreview = useInstancePreview();
  const gamesRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<HTMLDivElement>(null);

  const runningGames = games.filter((game) => game.status === "running");
  const activeTasks = tasks.filter((task) => !TERMINAL_TASKS.has(task.status));
  const showTasks = forceTasks || activeTasks.length > 0;

  const [open, setOpen] = useState<StatusKey | null>(null);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const closeTimer = useRef<number | null>(null);
  const pendingOpen = useRef<StatusKey | null | undefined>(undefined);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current === null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const closePanel = useCallback(
    (next: StatusKey | null) => {
      if (open === null) {
        if (next !== null) setOpen(next);
        return;
      }

      pendingOpen.current = next;
      if (closing) return;

      setClosing(true);
      clearCloseTimer();
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        const value = pendingOpen.current;
        pendingOpen.current = undefined;
        setClosing(false);
        setOpen(value === undefined ? null : value);
      }, EXIT_MS);
    },
    [open, closing, clearCloseTimer]
  );

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // 下载入口消失时，连带收掉它下面的浮窗。
  useEffect(() => {
    if (open === "tasks" && !showTasks) closePanel(null);
  }, [open, showTasks, closePanel]);

  // 点浮窗外面或按 Esc 关闭。
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (gamesRef.current?.contains(target) || tasksRef.current?.contains(target)) return;
      closePanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closePanel]);

  const toggle = (key: StatusKey) => {
    setStatus("");
    if (key === "games") void refreshGames();
    else void refreshTasks();
    closePanel(open === key ? null : key);
  };

  const instanceName = (id: string) =>
    instances?.items.find((item) => item.id === id)?.displayName ?? id;

  const closeGame = async (game: GameSessionInfo) => {
    setBusy(`stop:${game.sessionId}`);
    setStatus("");
    try {
      const result = await stopGame(game.sessionId);
      await refreshGames();
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  };

  const actTask = async (task: TaskInfo, action: string) => {
    setBusy(`${task.id}:${action}`);
    setStatus("");
    try {
      const result = await taskAction(task.id, action);
      await refreshTasks();
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  };

  const realCount = runningGames.length;
  const count = instancePreview > 0 ? instancePreview : realCount;
  const live = count > 0;

  return (
    <>
      {/* 左下角常驻：电脑屏幕就是状态灯 */}
      <div className="orb instances" ref={gamesRef}>
        <button
          type="button"
          className={`orb-button${live ? " is-live" : " is-idle"}${open === "games" ? " is-open" : ""}`}
          aria-label={live ? `${count} 个实例正在运行` : "没有正在运行的实例"}
          aria-haspopup="dialog"
          aria-expanded={open === "games"}
          data-tip={live ? `运行中：${count} 个实例` : "没有正在运行的实例"}
          data-tip-side="right"
          onClick={() => toggle("games")}
        >
          <span className="orb-monitor" aria-hidden="true">
            <span className="orb-screen">{count >= 2 ? count : null}</span>
            <span className="orb-stand" />
          </span>
        </button>

        {open === "games" ? (
          <div
            className={`orb-popover${closing ? " is-closing" : ""}`}
            role="dialog"
            aria-label="正在运行的实例"
          >
            {runningGames.length === 0 ? (
              <p className="top-status-empty">当前没有正在运行的实例。</p>
            ) : (
              <div className="top-status-list">
                {runningGames.map((game) => (
                  <article className="top-status-item" key={game.sessionId}>
                    <div className="top-status-item-head">
                      <span className="top-status-item-name">{instanceName(game.instanceId)}</span>
                      <span className="top-status-pill">运行中</span>
                    </div>
                    <span className="top-status-meta">
                      {game.pid === null ? "PID 未知" : `PID ${game.pid}`}
                    </span>
                    <div className="top-status-actions">
                      <button
                        type="button"
                        className="top-status-action"
                        disabled={busy !== ""}
                        onClick={() => void closeGame(game)}
                      >
                        关闭游戏
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {status ? (
              <p className="top-status-result" role="status">
                {status}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 右上角：下载任务，只有存在未结束任务时才出现 */}
      {showTasks ? (
        <div className="orb downloads" ref={tasksRef}>
          <button
            type="button"
            className={`orb-button${open === "tasks" ? " is-open" : ""}`}
            aria-label="下载任务"
            aria-haspopup="dialog"
            aria-expanded={open === "tasks"}
            data-tip="下载任务"
            data-tip-side="bottom"
            onClick={() => toggle("tasks")}
          >
            <SvgIcon className="orb-icon" src={navTasks} />
          </button>

          {open === "tasks" ? (
            <div
              className={`orb-popover is-right${closing ? " is-closing" : ""}`}
              role="dialog"
              aria-label="下载任务"
            >
              {activeTasks.length === 0 ? (
                <p className="top-status-empty">当前没有排队或运行中的任务。</p>
              ) : (
                <div className="top-status-list">
                  {activeTasks.map((task) => {
                    const percent = taskPercent(task);
                    const actions = TASK_ACTIONS.filter((action) =>
                      task.allowedActions.includes(action.key)
                    );
                    return (
                      <article className="top-status-item" key={task.id}>
                        <div className="top-status-item-head">
                          <span className="top-status-item-name">{task.name}</span>
                          <span className="top-status-pill">{statusText(task.status)}</span>
                        </div>
                        <span className="top-status-meta">
                          {task.phase}
                          {percent === null ? "" : ` · ${percent}%`}
                        </span>
                        {percent === null ? null : (
                          <div className="top-status-track" aria-hidden="true">
                            <span className="top-status-fill" style={{ width: `${percent}%` }} />
                          </div>
                        )}
                        {task.error ? <p className="top-status-error">{task.error.message}</p> : null}
                        {actions.length > 0 ? (
                          <div className="top-status-actions">
                            {actions.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                className="top-status-action"
                                disabled={busy !== ""}
                                onClick={() => void actTask(task, action.key)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
              {status ? (
                <p className="top-status-result" role="status">
                  {status}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
