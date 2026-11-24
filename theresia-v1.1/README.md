# Theresia V1.1

MCUG Launcher 的第三方前端：整体替换启动器界面，不改动官方界面代码、也不需要重新编译 Rust。

- **包名**：`com.theresia.mcugl`
- **显示名**：`Theresia V1.1`
- **版本**：`1.1.0`（新拟态重塑）
- **内核契约**：`mcugl.kernel/v1`（`^1.0.0`）
- **产物**：`release/com.theresia.mcugl-1.1.0.mcuglf`
- **sha256**：`4ab2507eeac6ae24880ee59fd0f9dc91c560b668e084bead94784fc08206644a`

---

## 0. 目录边界

```
MCUGLauncher-M/
├─ src/            官方内置界面（原版，随 tauri build 打包进二进制）
├─ index.html      ↑ 官方入口
├─ theresia-v1.1/    ← 本工程：所有 UI 开发都在这里
└─ src-tauri/      桌面端内核（Rust）
```

两套界面**没有任何共享文件**：各自带 `src/`、依赖和构建配置。改 `theresia-v1.1/` 不会影响官方界面，反过来也一样。

## 1. 它是什么

启动器支持在运行时把整个前端换成第三方实现（目录或 `.mcuglf` 包）。Theresia V1.1 就是这份实现：

- 页面、样式、交互全部重写，官方内置界面完全不加载；
- 通过 `window.__TAURI_INTERNALS__.invoke` 调用与官方界面**完全相同**的命令，因此读实例、账号、设置、启动游戏的权限与官方界面一致；
- 因为不编译 Rust，界面迭代只需要重新构建前端、刷新窗口（目录模式）或重装包（分发包模式）。

## 2. 目录结构

```
theresia-v1.1/
├─ src/                  界面源码（独立的 React + TS 工程）
│  ├─ theme/             16 色主色调 + 明暗模式的实现
│  ├─ styles/            设计令牌、基础样式、通用组件
│  ├─ shell/             外壳：悬浮胶囊导航、页面宿主、拖拽区
│  ├─ pages/             启动 / 发现 / 下载 / 账户 / 设置 / 实例
│  ├─ api/               按领域拆分的 invoke 封装
│  ├─ state/             命令驱动的全局状态容器
│  └─ demo/              演示后端（浏览器预览用假数据）
├─ public/               MCUGLogo.svg 等静态资源
├─ index.html            前端入口
├─ frontend.json         前端包清单
├─ release/              已打包的 .mcuglf（可直接分发/导入）
├─ vite.config.ts        base=./、产物输出到 dist/、构建时拷贝清单
├─ tsconfig.json
└─ package.json
```

## 3. 构建与预览

```powershell
cd theresia-v1.1

npm install          # 首次
npm run dev:demo     # 浏览器预览，端口 5175，用内存假数据
npm run build        # 构建 → dist/（根目录自带 frontend.json）
npm run pack         # 打包 → release/<identifier>-<version>.mcuglf
```

> `release/` 里的文件名带版本号，升版本时同步改 `package.json` 的 `pack` 参数与 `frontend.json` 的 `version`。

仓库根也有转发命令：`npm run theresia:install` / `theresia:dev` / `theresia:build` / `theresia:pack`。

> 预览不需要 Rust：`--mode demo` 会把 `window.__MCUGL_DEMO__` 写进 HTML，界面改用 `src/demo` 里的假数据，行为和正式环境一致。

## 4. 安装与启用

三种方式，任选其一：

1. **拖动安装（推荐）**：启动器 → 设置 → 开发者选项 → 把 `release/com.theresia.mcugl-1.1.0.mcuglf` 拖进虚线框。松手后自动完成「安装 → 启用 → 重启界面」，不需要再点按钮。
2. **按钮导入**：同一个卡片里点「导入前端包…」选文件 → 弹窗确认 → 列表里点「使用」→ 点「重启前端」。
3. **开发目录**：把 `MCUGL_FRONTEND` 指向 `dist/` 或 `.mcuglf` 绝对路径后启动，改完文件刷新窗口即生效（前端资源带 `Cache-Control: no-store`）。

加载优先级：`MCUGL_FRONTEND` > 设置里选中的已安装前端 > 官方内置界面。

**停用**：列表里点「停用」切回官方界面；**卸载**：点「卸载」删除该版本（若卸载的是当前启用项，自动切回官方）。

**逃生**：界面白屏或卡死时按 `Ctrl+Alt+C`，启动器会清空第三方前端选择并原地重建窗口，进程不退出。

## 5. 前端包规格（与启动器校验对齐）

`frontend.json` 字段：

| 字段 | 值 | 规则 |
| --- | --- | --- |
| `identifier` | `com.theresia.mcugl` | 反向域名，3–128 位 `[a-z0-9.-_]`，避开 Windows 保留名 |
| `name` | `Theresia V1.1` | 显示名 |
| `version` | `1.1.0` | semver |
| `kernelApi` | `^1.0.0` | 必须匹配启动器内核 `apiVersion` |
| `entry` | `index.html` | 包内相对路径，且文件必须存在 |
| `author` / `description` / `homepage` | 见文件 | 可选 |

包体约束（打包脚本与导入校验都检查）：单文件 ≤ 128 MiB、总解压 ≤ 256 MiB、条目 ≤ 2048、仅 store/deflate、条目名不含 `..`/盘符/前导斜杠。当前包 8 个条目、约 4.4 MiB。

资源路径全部相对（`base: "./"`），因此能被 `mcugl://` 协议按目录直接提供，不会出现 404。

## 6. 与官方界面的差异

| 维度 | 官方界面 | Theresia V1.1 |
| --- | --- | --- |
| 导航 | 顶部胶囊（5 项） | 同结构，白瓷胶囊 + 主色镂空图标（改用 mask 着色，图标随主色变） |
| 首页 | 壁纸 + 右下三张卡（角色/实例/启动） | 壁纸 + **左侧实例轨道**（版本·加载器·模组数、运行中标记、点击切换实例）+ 右下**启动坞**（角色胶囊 + 启动目标提示 + 启动按钮） |
| 主题 | 固定蓝白 | **16 套主色**（经典蓝/靛青/紫罗兰/品红/玫红/朱红/珊瑚橙/琥珀/柠檬绿/草绿/翡翠/青碧/天青/湖蓝/石板灰/咖啡）+ **明暗双模式** |
| 设置 | 单卡片堆叠 | 左标签右控件的行式布局 + 常驻保存条（未保存/需修正状态可见）+ 常用值 chips + 越界自动夹回 |
| 前端管理 | 导入/使用/重启 | 增加**拖放安装区**，停用与卸载按钮分离 |
| 窗口拖拽 | —— | 顶部 64px 导航带兼作无边框窗口拖拽区 |

### 主题实现要点

- 主色只定义 `base` 一个值，其余 9 个派生变量（`--app-accent` / hover / dark / deep / soft / tint / wash / glow / ink）由 `src/theme/palettes.ts` 按当前明暗模式推导：浅色往白里调，深色往底色里调。
- 明暗模式通过 `<html data-theme="dark">` 触发 `src/styles/tokens.css` 里的整套令牌反转（底色、文字、玻璃、阴影、状态色）。
- 启动时在 React 渲染前应用主题，避免深色模式闪白。
- 主题选择存在 `localStorage` 的 `mcugl.theme.v1`（键为 `{ accent, mode }`）。

## 7. 已知限制

- 主题偏好只落本地 `localStorage`，没有写进启动器配置（后端设置 DTO 暂无主题字段）。
- 界面上部分深层页面沿用了官方版本的布局，只继承了新的设计令牌，尚未逐屏重做。
- 本仓库的演示模式是浏览器内假数据；真实导入链路（校验 → 解压 → 切换 → 重载）需要在装有 Rust 工具链的环境里 `npm run tauri dev` 验证一次。

## 8. 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 拖入后没反应 | 文件不是 `.mcuglf` / `.zip` | 看卡片下方提示，只有这两种会被安装 |
| 导入报 `VALIDATION_ERROR` | 清单字段不合法 / `entry` 不存在 / `kernelApi` 不匹配 | 对照第 5 节逐项核对 |
| 界面白屏 | 前端运行时报错 | 按 `Ctrl+Alt+C` 切回官方，再看「运行日志」 |
| 停用后仍显示 Theresia V1.1 | 浏览器演示模式下前端不会真的重载 | 正式环境由内核重建窗口；演示时以 5174（官方）/ 5175（Theresia）两个端口对比 |

## 9. 版本记录

### 2.0.0

- 新拟态重塑：双投影软表面、内凹输入框、按压回弹；
- 壁纸加浅色雾化层，让软表面站得住；
- 16 色主色与明暗双模式沿用 1.0.0。

### 1.0.0

- 首个可分发版本：16 色主色 + 明暗双模式；
- 首页改为「实例轨道 + 启动坞」；
- 设置页启动分区重做为行式布局，加入校验、常驻保存条与常用值快捷项；
- 开发者选项加入拖放安装、停用/卸载分离；
- 图标统一改为 mask 着色，暗色模式下不再出现黑图标。
