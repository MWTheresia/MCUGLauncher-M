import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { copyFileSync } from "node:fs";
// @ts-expect-error type error without @types/node package
import { resolve } from "node:path";

/**
 * Theresia V1 前端包构建。
 *
 * - 这是一份独立前端：自带 index.html、src 与依赖，不参与启动器本体（根目录 src）的构建。
 * - 产物 dist/ 根目录带 frontend.json，资源一律相对路径，可被 mcugl:// 协议按目录加载，
 *   也可以打包成 .mcuglf 导入。
 * - 演示模式（--mode demo）用内存假数据在本机浏览器里预览，端口 5175，避免和官方 5174 冲突。
 */
const DEMO_FLAG = '<script>window.__MCUGL_DEMO__ = true;</script>';

export default defineConfig(({ mode }) => {
  const demo = mode === "demo";

  return {
    base: "./",
    plugins: [
      react(),
      {
        name: "mcugl-demo-flag",
        transformIndexHtml(html) {
          return demo ? html.replace("<head>", `<head>${DEMO_FLAG}`) : html;
        },
      },
      {
        name: "mcugl-frontend-manifest",
        closeBundle() {
          copyFileSync(resolve("frontend.json"), resolve("dist/frontend.json"));
        },
      },
    ],
    build: { outDir: "dist", emptyOutDir: true },
    clearScreen: false,
    server: {
      port: demo ? 5175 : 5176,
      strictPort: true,
      host: false,
    },
  };
});
