import { useEffect, useState } from "react";

/** 开发用：分别强制显示右上角的运行实例 / 下载任务按钮。 */
export type TopStatusTarget = "games" | "tasks";

const KEYS: Record<TopStatusTarget, string> = {
  games: "mcugl.topStatusForceGames",
  tasks: "mcugl.topStatusForceTasks",
};

/** 旧版是一个总开关；首次加载时迁移成两个独立开关。 */
const LEGACY_KEY = "mcugl.topStatusForce";

function migrateLegacyKey(): void {
  if (localStorage.getItem(LEGACY_KEY) !== "1") return;
  if (localStorage.getItem(KEYS.games) === null) localStorage.setItem(KEYS.games, "1");
  if (localStorage.getItem(KEYS.tasks) === null) localStorage.setItem(KEYS.tasks, "1");
  localStorage.removeItem(LEGACY_KEY);
}

migrateLegacyKey();

/*
 * 上一版把「强制下载动画 / 实例灯预览」写进了 localStorage，
 * 升级后这些残留会让下次启动凭空冒出下载球或绿色实例灯。
 * 预览类状态现在只存 sessionStorage，这里顺手把旧键清掉。
 */
for (const legacy of ["mcugl.topStatusPreviewInstances", "mcugl.topStatusForceDownloadAnim"]) {
  localStorage.removeItem(legacy);
}

const listeners = new Set<() => void>();

export function isTopStatusForced(target: TopStatusTarget): boolean {
  return localStorage.getItem(KEYS[target]) === "1";
}

export function setTopStatusForced(target: TopStatusTarget, value: boolean): void {
  if (value) localStorage.setItem(KEYS[target], "1");
  else localStorage.removeItem(KEYS[target]);
  listeners.forEach((listener) => listener());
}

/** 订阅某个按钮的强制显示开关；设置页改动后，右上角按钮同帧跟进。 */
export function useTopStatusForced(target: TopStatusTarget): boolean {
  const [value, setValue] = useState(() => isTopStatusForced(target));

  useEffect(() => {
    const listener = () => setValue(isTopStatusForced(target));
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [target]);

  return value;
}

/** 开发用：不看真实进程，直接把左下角的实例灯钉在某个状态上。 */
const PREVIEW_KEY = "mcugl.topStatusPreviewInstances";

/**
 * 预览类开关只存 sessionStorage：
 * 它们是给设计验收用的，重启后必须回到真实状态，
 * 否则上次留下的「强制动画」会让下次启动莫名其妙冒出下载球。
 */
const previewStorage = () => window.sessionStorage;

/** 实例灯的预览数量：0 表示不预览（按真实进程），1 / 2 表示钉死成这个数量。 */
export type InstancePreview = 0 | 1 | 2;

export function getInstancePreview(): InstancePreview {
  const raw = previewStorage().getItem(PREVIEW_KEY);
  return raw === "1" ? 1 : raw === "2" ? 2 : 0;
}

export function setInstancePreview(value: InstancePreview): void {
  if (value === 0) previewStorage().removeItem(PREVIEW_KEY);
  else previewStorage().setItem(PREVIEW_KEY, String(value));
  listeners.forEach((listener) => listener());
}

export function useInstancePreview(): InstancePreview {
  const [value, setValue] = useState<InstancePreview>(() => getInstancePreview());

  useEffect(() => {
    const listener = () => setValue(getInstancePreview());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}
/** 开发用：不看真实任务，循环播放「倒三角填充 → 变绿翻正 → 消失」的下载动画。 */
const ANIM_KEY = "mcugl.topStatusForceDownloadAnim";

export function isDownloadAnimForced(): boolean {
  return previewStorage().getItem(ANIM_KEY) === "1";
}

export function setDownloadAnimForced(value: boolean): void {
  if (value) previewStorage().setItem(ANIM_KEY, "1");
  else previewStorage().removeItem(ANIM_KEY);
  listeners.forEach((listener) => listener());
}

export function useDownloadAnimForced(): boolean {
  const [value, setValue] = useState(() => isDownloadAnimForced());

  useEffect(() => {
    const listener = () => setValue(isDownloadAnimForced());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}