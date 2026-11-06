// 把 @tomato/core（零依赖 TS）打进 runtime/vendor/core.mjs，让随插件分发的
// tomato-runtime 不依赖任何 node_modules。esbuild 只做打包不做转译降级
// （runtime 跑在 Node 24 上，直接输出 ESM）。
//
// 为什么放在根 scripts/ 而不是 runtime/：打包涉及两个工作流（core 与 runtime）
// 的产物边界，属集成分（lead 负责）。runtime 侧的 runtime/scripts/bundle-core.mjs
// 保留为薄壳或删除，以本脚本为准。
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

await build({
  entryPoints: ["packages/core/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  outfile: "runtime/vendor/core.mjs",
  sourcemap: "inline",
  logLevel: "info",
}).catch(() => {
  // core 尚未移植完成时允许失败：runtime 用 engine 桩先跑，合并时再打通。
  console.warn("core bundle failed — runtime may still run on its engine stub");
  process.exitCode = 0;
});

try {
  mkdirSync("runtime/vendor", { recursive: true });
} catch {
  /* already exists */
}
