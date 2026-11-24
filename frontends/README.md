# 前端工程目录

这个目录放的是**第三方前端**，启动器本体（仓库根目录的 `src/`）保持原版官方界面不动。

```
MCUGLauncher-M/
├─ src/                     官方内置界面（原版，随 tauri build 打包进二进制）
├─ index.html               ↑ 官方入口
├─ dist/                    官方构建产物（不提交）
└─ frontends/
   └─ theresia-v1/          Theresia V1：整套重设计的第三方前端
      ├─ src/               独立的一套界面代码
      ├─ index.html
      ├─ frontend.json      前端包清单（identifier / name / version / kernelApi）
      ├─ release/           已打包的 .mcuglf 分发文件
      └─ dist/              构建产物（不提交）
```

## 两套界面的边界

| | 官方界面 | Theresia V1 |
| --- | --- | --- |
| 代码位置 | 仓库根 `src/`、`index.html` | `frontends/theresia-v1/src/`、`index.html` |
| 构建命令 | `npm run build`（仓库根） | `npm --prefix frontends/theresia-v1 run build` |
| 产物 | `dist/`，被 Rust 打进可执行文件 | `frontends/theresia-v1/dist/`，打成 `.mcuglf` |
| 怎么生效 | 启动器默认加载 | 开发者选项里导入并启用，或 `MCUGL_FRONTEND` 指向目录/包 |
| 停用后 | —— | 卸下第三方前端，回到官方界面 |

两套代码**没有任何共享文件**（各自带 `src/`、依赖和构建配置），所以改 Theresia V1 不会影响官方界面，反过来也一样。

## 常用命令

```powershell
# 官方界面
npm run build            # → dist/
npm run dev:demo         # 浏览器预览官方界面（端口 5174）

# Theresia V1
npm run theresia:install # 首次：安装子工程依赖
npm run theresia:dev     # 浏览器预览（端口 5175）
npm run theresia:build   # → frontends/theresia-v1/dist/
npm run theresia:pack    # → frontends/theresia-v1/dist/ 打成 .mcuglf
```

上面四条 `theresia:*` 是仓库根 `package.json` 里转发到子工程的快捷方式，等价于 `cd frontends/theresia-v1` 后直接跑。
