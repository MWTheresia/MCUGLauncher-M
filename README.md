# MCUGLauncher

MCUGLauncher 是基于 Tauri、React 与 TypeScript 的 Minecraft 启动器前端。UI 仅通过 Tauri `invoke` 契约访问 Rust 后端，不直接读写本地业务数据，也不依赖事件才能完成状态同步。

当前仓库提供内存演示后端，用于验证 UI 与 V2 契约。尚未接入的安装、启动、在线认证及部分系统能力会返回结构化 `UNSUPPORTED`，不会伪造执行成功。

## 开发

安装依赖前，请查看[开发环境要求](docs/DEVELOPMENT_ENVIRONMENT.md)，确认 Node.js、Rust 和桌面平台依赖。

```bash
npm install
npm run tauri dev
```

仅构建前端：

```bash
npm run build
```

重新生成并检查 DTO：

```bash
npm run dto:generate
npm run dto:check
```

检查 Rust 后端：

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml
```

## 契约文档

- [当前后端契约](docs/BACKEND_CONTRACT.md)
- [V2 状态与迁移方案](docs/BACKEND_V2.md)
- [UI 迁移说明](docs/UI_PORTING.md)
- [DTO JSON Schema](schemas/launcher.schema.json)

## 第三方前端（Theresia V1）

本仓库自带一套完整的第三方前端，位于 [`theresia-v1`](theresia-v1)：
16 色主色 + 明暗双模式、实例轨道首页、行式设置页。它**不影响**上面的官方界面代码，
构建成 `.mcuglf` 后在启动器里导入即可整体替换界面。

**约定：后续所有 UI 开发（新页面、主题、组件）都在 `theresia-v1/` 里进行**，
官方界面 `src/` 保持原版不动。

```bash
npm run theresia:install   # 首次安装子工程依赖
npm run theresia:dev       # 浏览器预览（端口 5175，假数据）
npm run theresia:build     # 构建 → theresia-v1/dist/
npm run theresia:pack      # 打包 → theresia-v1/release/*.mcuglf
```

已构建好的分发包在 `theresia-v1/release/com.theresia.mcugl-1.0.0.mcuglf`，
直接拖进「设置 → 开发者选项 → 前端（第三方 UI）」的虚线框即可安装并启用。
详细说明见 [Theresia V1 说明](theresia-v1/README.md)。
