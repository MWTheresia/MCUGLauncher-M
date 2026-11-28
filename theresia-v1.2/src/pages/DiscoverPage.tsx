import { useEffect, useState } from "react";
import { launchToServer } from "../api/commands/launch";
import {
  deleteServer as deleteServerCommand,
  pingServer,
  saveServer as saveServerCommand,
} from "../api/commands/servers";
import type { AnnouncementInfo, RecommendationInfo, SavedServerInfo, ServerPingInfo } from "../types/launcher";
import navAnnouncement from "../assets/icons/nav/nav-announcement.svg";
import navBookmarks from "../assets/icons/nav/nav-bookmarks.svg";
import navRecommend from "../assets/icons/nav/nav-recommend.svg";
import navServers from "../assets/icons/nav/nav-servers.svg";
import Field from "../components/Field";
import { AppInput, AppSelect } from "../components/AppInput";
import type { NavItem } from "../components/SectionNav";
import SplitPage from "../components/SplitPage";
import Markdown from "../components/Markdown";
import Modal from "../components/Modal";
import SvgIcon from "../components/SvgIcon";
import { useLauncher } from "../state/launcher";
import { useServerStatusPreview } from "../shell/topStatusPreference";
import BookmarksSection from "./discover/BookmarksSection";
import "./DiscoverPage.css";

interface ServerDraft {
  name: string;
  address: string;
  instanceId: string | null;
}

interface DialogState {
  editing: SavedServerInfo | null;
  draft: ServerDraft;
  status: string;
}

interface MenuState {
  item: RecommendationInfo;
  x: number;
  y: number;
}

const EMPTY_DRAFT: ServerDraft = { name: "", address: "", instanceId: null };

export type DiscoverSectionKey = "servers" | "bookmarks" | "announcements" | "recommendations";

const NAV_GROUPS: NavItem[][] = [
  [
    { key: "servers", label: "服务器收藏", icon: navServers },
    { key: "bookmarks", label: "我的收藏", icon: navBookmarks },
  ],
  [
    { key: "announcements", label: "群公告", icon: navAnnouncement },
    { key: "recommendations", label: "群友推荐", icon: navRecommend },
  ],
];

/** 发现：服务器收藏、群公告、群友推荐与语录（原主页右栏内容）。 */
export default function DiscoverPage({
  section,
  onSectionChange,
}: {
  section: DiscoverSectionKey;
  onSectionChange: (section: DiscoverSectionKey) => void;
}) {
  const { overview, instances: instanceCatalog, servers, community, refreshState, refreshCommunity } = useLauncher();
  const [pings, setPings] = useState<Record<string, ServerPingInfo>>({});
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [announcement, setAnnouncement] = useState<AnnouncementInfo | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  /** 卡片右下角「更多」菜单当前展开的地址 */
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /** 二次确认删除的地址 */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /**
   * 开发者选项里的服务器状态预览：
   * 演示内核的 ping_server 没实现，实际只可能是离线，所以这里直接覆盖掉真实结果，
   * 「查询中」用一个永远 pending 的空值表示。
   */
  const serverPreview = useServerStatusPreview();
  const previewPing: ServerPingInfo | undefined =
    serverPreview === "online"
      ? {
          id: "preview",
          online: true,
          players: 12,
          max: 100,
          ping: 42,
          motd: "演示服务器 · 不会真正连接",
          version: "1.21.1",
          error: "",
        }
      : serverPreview === "offline"
        ? {
            id: "preview",
            online: false,
            players: 0,
            max: 0,
            ping: 0,
            motd: "",
            version: "",
            error: "预览：已强制为离线",
          }
        : undefined;
  const pingOf = (address: string): ServerPingInfo | undefined =>
    serverPreview === "pending" ? undefined : previewPing ?? pings[address];

  useEffect(() => {
    if (!servers) return;
    let alive = true;
    for (const server of servers) {
      void pingServer(server.address)
        .then((info) => {
          if (alive) setPings((previous) => ({ ...previous, [info.id]: info }));
        })
        .catch(() => {
          if (!alive) return;
          setPings((previous) => ({
            ...previous,
            [server.address]: {
              id: server.address,
              online: false,
              players: 0,
              max: 0,
              ping: 0,
              motd: "",
              version: "",
              error: "内核未提供 ping_server",
            },
          }));
        });
    }
    return () => {
      alive = false;
    };
  }, [servers]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  if (!overview || !instanceCatalog || !servers || !community) {
    return (
      <div className="page">
        <div className="empty">正在读取社区内容…</div>
      </div>
    );
  }

  const instances = instanceCatalog.items.filter((item) => item.name.length > 0 && !item.isPlaceholder);
  const quote = community.quotes[quoteIndex];

  const openServerDialog = (server?: SavedServerInfo, message?: string) => {
    setDialog({
      editing: server ?? null,
      draft: server
        ? { name: server.name, address: server.address, instanceId: server.instanceId }
        : { ...EMPTY_DRAFT },
      status: message ?? "",
    });
  };

  const saveServer = async (close?: (after?: () => void) => void) => {
    if (!dialog) return;
    const address = dialog.draft.address.trim();
    if (address.length === 0) {
      setDialog({ ...dialog, status: "请填写服务器网页。" });
      return;
    }
    setDialog({ ...dialog, status: "正在保存…" });
    const result = await saveServerCommand(
      dialog.draft.name.trim(),
      address,
      dialog.editing?.id ?? "",
      dialog.draft.instanceId
    );
    // 有淡出动画时交给弹层收尾，否则直接关
    if (close) close();
    else setDialog(null);
    await refreshState();
    setStatus(result.message);
  };

  /** 地址是这张卡最重要的信息，点一下就能复制 */
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setStatus(`已复制 ${address}`);
    } catch {
      setStatus("复制失败，请手动选中地址");
    }
  };

  const deleteServer = async (server: SavedServerInfo) => {
    const result = await deleteServerCommand(server.id);
    setPings((previous) => {
      const next = { ...previous };
      delete next[server.address];
      return next;
    });
    await refreshState();
    setStatus(result.message);
  };

  const queryServer = async (server: SavedServerInfo) => {
    try {
      const info = await pingServer(server.address);
      setPings((previous) => ({ ...previous, [info.id]: info }));
    } catch (error) {
      /* 内核没实现 / 网络不通：落到「离线」而不是一直转圈 */
      setPings((previous) => ({
        ...previous,
        [server.address]: {
          id: server.address,
          online: false,
          players: 0,
          max: 0,
          ping: 0,
          motd: "",
          version: "",
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
    setStatus("服务器状态已刷新。");
  };

  const openServer = async (server: SavedServerInfo) => {
    if (!server.instanceId) {
      openServerDialog(server, "先给这台服务器绑定实例，保存后就能一键进服。");
      return;
    }
    const instanceName =
      instanceCatalog.items.find((item) => item.id === server.instanceId)?.displayName ?? server.instanceId;
    setStatus(`正在用 ${instanceName} 打开 ${server.address}…`);
    const result = await launchToServer(server.instanceId, overview.activeAccountId ?? "", server.address);
    setStatus(`启动请求已接受：${result.sessionId}`);
  };

  const favorite = async (item: RecommendationInfo) => {
    setMenu(null);
    const address = item.url.trim();
    if (address.length === 0) {
      setStatus("这条推荐没有附带服务器地址，无法收藏。");
      return;
    }
    if (servers.some((server) => server.address.toLowerCase() === address.toLowerCase())) {
      setStatus(`「${item.name.length > 0 ? item.name : address}」已经在收藏里了。`);
      return;
    }
    const result = await saveServerCommand(item.name.trim(), address, "");
    await refreshState();
    setStatus(result.message);
  };

  const quoteCard = (
    <section className="card quote-card discover-quote">
      <span className="quote-mark">“</span>
      <div className="stack" style={{ gap: 4 }}>
        <p className="quote-text">
          {quote ? (quote.type === "image" ? `[图片语录] ${quote.text}` : quote.text) : "暂无语录。"}
        </p>
        <p className="muted">
          {[quote?.author ?? "", quote?.source ?? ""].filter((value) => value.length > 0).join(" · ")}
        </p>
      </div>
      <button
        type="button"
        className="btn link"
        disabled={community.quotes.length === 0}
        onClick={() => setQuoteIndex((previous) => (previous + 1) % Math.max(1, community.quotes.length))}
      >
        换一条
      </button>
    </section>
  );

  return (
    <>
      <SplitPage
        title="发现"
        navLabel="发现分区"
        groups={NAV_GROUPS}
        active={section}
        onSelect={(key) => onSectionChange(key as DiscoverSectionKey)}
        contentClassName="discover-content"
        footer={quoteCard}
      >
        {(shown) => (
          <>
            {shown === "bookmarks" ? <BookmarksSection /> : null}
            {shown === "servers" ? (
              <section className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <h2 className="h2">服务器收藏</h2>
                  <span className="spacer" />
                  <span className="muted">
                    {servers.length > 0
                      ? (() => {
                          const online = servers.filter((s) => pingOf(s.address)?.online).length;
                          const offline = servers.filter((s) => Boolean(pingOf(s.address)) && !pingOf(s.address)?.online).length;
                          const pending = servers.length - online - offline;
                          return [
                            `${online} 在线`,
                            offline > 0 ? `${offline} 离线` : null,
                            pending > 0 ? `${pending} 查询中` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                        })()
                      : ""}
                  </span>
                  <button type="button" className="btn link" onClick={() => openServerDialog()}>
                    添加服务器
                  </button>
                </div>

                {servers.length === 0 ? (
                  <div className="empty">
                    {"还没有收藏服务器。\n点右上角「添加服务器」，填好网页与实例后就能在这里一键进服。"}
                  </div>
                ) : (
                  <div className="server-grid">
                    {servers.map((server) => {
                      const ping = pingOf(server.address);
                      const state = !ping ? "pending" : ping.online ? "online" : "offline";
                      const instanceName = server.instanceId
                        ? instanceCatalog.items.find((item) => item.id === server.instanceId)?.displayName ??
                          server.instanceId
                        : "";
                      const confirming = confirmDelete === server.address;
                      return (
                        <article className="server-card" key={server.address} data-state={state}>
                          <div className="server-card-head">
                            <span className={`server-icon ${state === "online" ? "online" : ""}`}>
                              <SvgIcon src={navServers} className="server-icon-glyph" />
                            </span>
                            <span className="server-name">
                              {server.name.length > 0 ? server.name : server.address}
                            </span>
                            <button
                              type="button"
                              className="server-status"
                              data-state={state}
                              onClick={() => void queryServer(server)}
                              title="点击重新查询"
                            >
                              <span className="server-status-dot" />
                              {state === "pending" ? (
                                "查询中…"
                              ) : state === "online" ? (
                                `${ping?.ping ?? 0} ms`
                              ) : (
                                "离线"
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            className="server-address"
                            onClick={() => void copyAddress(server.address)}
                            title="点击复制地址"
                          >
                            {server.address}
                          </button>

                          <div className="server-meta">
                            <span className={`server-chip${instanceName ? "" : " is-empty"}`}>
                              {instanceName || "未绑定实例"}
                            </span>
                            {ping?.online && ping.motd ? (
                              <span className="server-motd">{ping.motd}</span>
                            ) : null}
                            {ping?.online ? (
                              <span className="server-players">
                                {ping.players}/{ping.max}
                              </span>
                            ) : null}
                          </div>

                          <div className="server-actions">
                            <button
                              type="button"
                              className="btn soft server-cta"
                              onClick={() => void openServer(server)}
                            >
                              {instanceName ? "启动到服务器" : "选择实例"}
                            </button>
                            <div className="server-more">
                              <button
                                type="button"
                                className="btn ghost server-more-btn"
                                aria-label="更多操作"
                                aria-haspopup="menu"
                                aria-expanded={openMenu === server.address}
                                onClick={() =>
                                  setOpenMenu(openMenu === server.address ? null : server.address)
                                }
                              >
                                ⋯
                              </button>
                              {openMenu === server.address ? (
                                <div className="server-menu" role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      void queryServer(server);
                                    }}
                                  >
                                    查询状态
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      void copyAddress(server.address);
                                    }}
                                  >
                                    复制地址
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      openServerDialog(server);
                                    }}
                                  >
                                    编辑
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="is-danger"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      setConfirmDelete(server.address);
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {confirming ? (
                            <div className="server-confirm" role="alertdialog">
                              <span>删除这台服务器？</span>
                              <button
                                type="button"
                                className="btn ghost"
                                onClick={() => setConfirmDelete(null)}
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                className="btn ghost is-danger"
                                onClick={() => {
                                  setConfirmDelete(null);
                                  void deleteServer(server);
                                }}
                              >
                                确认删除
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}                  </div>
                )}
              </section>
            ) : null}

            {shown === "announcements" ? (
              <section className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <h2 className="h2">群公告</h2>
                  <span className="spacer" />
                  <span className="muted">{community.announcements.length} 条</span>
                </div>

                {community.announcements.length === 0 ? (
                  <p className="muted">暂无公告，新的群公告会出现在这里。</p>
                ) : (
                  community.announcements.map((item) => (
                    <button key={item.id} type="button" className="ann-row" onClick={() => setAnnouncement(item)}>
                      <span className="ann-title">
                        {item.tag.length > 0 ? `[${item.tag}] ${item.title}` : item.title}
                      </span>
                      {item.body.length > 0 ? <span className="ann-body">{item.body}</span> : null}
                      <span className="muted">
                        {[item.author, item.publishedAt?.slice(0, 10) ?? "", item.imageUrl ? "含配图" : ""]
                          .filter((value) => value.length > 0)
                          .join(" · ")}
                      </span>
                    </button>
                  ))
                )}
              </section>
            ) : null}

            {shown === "recommendations" ? (
              <section className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <h2 className="h2">群友推荐</h2>
                  <span className="spacer" />
                  <button type="button" className="btn link" onClick={() => void refreshCommunity()}>
                    刷新社区内容
                  </button>
                </div>

                {community.recommendations.length === 0 ? (
                  <p className="muted">暂无群友推荐。</p>
                ) : (
                  community.recommendations.slice(0, 5).map((item) => (
                    <div
                      className="rec-row"
                      key={item.id}
                      onContextMenu={(event) => {
                        if (item.type !== "server") return;
                        event.preventDefault();
                        setMenu({ item, x: event.clientX, y: event.clientY });
                      }}
                    >
                      <span className={`rec-icon ${item.type}`}>
                        {item.type === "material" ? "◆" : item.type === "shader" ? "✦" : "▣"}
                      </span>
                      <div className="stack" style={{ gap: 2 }}>
                        <span className="rec-name">{item.name}</span>
                        <span className="muted">
                          {item.type === "material" ? "材质包" : item.type === "shader" ? "光影" : "服务器"} · 由{" "}
                          {item.author} 推荐
                          {item.tags.length > 0 ? ` · ${item.tags.join(" / ")}` : ""}
                        </span>
                        {item.description.length > 0 ? <span className="muted">{item.description}</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </section>
            ) : null}

            <p className="status">{status}</p>
          </>
        )}
      </SplitPage>

      {dialog ? (
        <Modal
          title={dialog.editing ? "编辑服务器" : "添加服务器"}
          onClose={() => setDialog(null)}
          footer={(close) => (
            <>
              <button type="button" className="btn ghost" onClick={() => close()}>
                取消
              </button>
              <button type="button" className="btn primary" onClick={() => void saveServer(close)}>
                保存
              </button>
            </>
          )}
        >
          <p className="muted">保存后会作为一张卡片出现在「正在开设的服务器」里。</p>
          <Field label="服务器名称" hint="可留空，默认显示地址">
            <AppInput maxLength={60}
              placeholder="例如：MCUG 生存服"
              value={dialog.draft.name}
              onChange={(event) => setDialog({ ...dialog, draft: { ...dialog.draft, name: event.target.value } })}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveServer();
              }}
            />
          </Field>
          <Field label="网页" hint="填域名或 host:port 才能查询人数并直接进服；带 / 的网页链接只能作记录。">
            <AppInput placeholder="play.example.com:25565"
              value={dialog.draft.address}
              onChange={(event) => setDialog({ ...dialog, draft: { ...dialog.draft, address: event.target.value } })}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveServer();
              }}
            />
          </Field>
          <Field label="打开所用的实例" hint="绑定后用卡片上的「打开」直连服务器；不绑定只能手动进入。">
            <AppSelect value={dialog.draft.instanceId ?? ""}
              onChange={(event) =>
                setDialog({
                  ...dialog,
                  draft: {
                    ...dialog.draft,
                    instanceId: event.target.value.length > 0 ? event.target.value : null,
                  },
                })
              }
            >
              <option value="">不绑定实例</option>
              {instances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName} · {item.loader} · {item.minecraft}
                </option>
              ))}
              {dialog.draft.instanceId && !instances.some((item) => item.id === dialog.draft.instanceId) ? (
                <option value={dialog.draft.instanceId}>{dialog.draft.instanceId}（当前未安装）</option>
              ) : null}
            </AppSelect>
          </Field>
          {dialog.status.length > 0 ? <p className="status">{dialog.status}</p> : null}
        </Modal>
      ) : null}

      {announcement ? (
        <Modal
          title={announcement.title}
          width={640}
          onClose={() => setAnnouncement(null)}
          footer={(close) => (
            <button type="button" className="btn primary" onClick={() => close()}>
              关闭
            </button>
          )}
        >
          <p className="muted">
            {[announcement.tag, announcement.author, announcement.publishedAt?.slice(0, 10) ?? ""]
              .filter((value) => value.length > 0)
              .join(" · ")}
          </p>
          {announcement.imageUrl.length > 0 ? (
            <img className="announcement-image" src={announcement.imageUrl} alt="" />
          ) : null}
          <Markdown text={announcement.markdown.length > 0 ? announcement.markdown : announcement.body} />
        </Modal>
      ) : null}

      {menu ? (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" onClick={() => void favorite(menu.item)}>
            收藏
          </button>
        </div>
      ) : null}
    </>
  );
}
