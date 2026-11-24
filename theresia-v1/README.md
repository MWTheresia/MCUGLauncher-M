# Theresia V1（已冻结）

V1 是这条 UI 线的**成品归档**，源码已从工作区移除，只保留可分发的包：

```
theresia-v1/
├─ release/com.theresia.mcugl-1.0.0.mcuglf   4.4 MB，可直接导入启动器
└─ README.md                                 本文件
```

- **显示名**：`Theresia V1`
- **版本**：`1.0.0`（玻璃拟态：三级玻璃 + 壁纸 + 16 色主题 + 明暗双模式）
- **sha256**：`edd16e29a70fa0fb5915b6fce5d62786b20ef6c81112b46ab2b780811e4b65bd`
- **内核契约**：`mcugl.kernel/v1`（`^1.0.0`）

## 怎么用

拖进启动器「设置 → 开发者选项 → 前端（第三方 UI）」的虚线框即可安装；
或者「导入前端包…」选中后在列表里点「使用」→「重启前端」。

## 源码在哪

V1 的完整源码在 git 历史里，不在当前工作区：

```powershell
# 看 V1 最后那个提交
git show 3aace68 --stat
# 需要改动时，把源码取出来
git checkout 3aace68 -- theresia-v1
```

后续 UI 开发都在 [`theresia-v2`](../theresia-v2) 上进行——V2 是基于 V1 的新拟态重塑，
文件结构与 V1 完全相同，改 V2 不会影响这个已发布的包。
