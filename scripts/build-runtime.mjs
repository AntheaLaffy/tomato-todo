// 把 @tomato/core（零依赖 TS）打进 runtime/vendor/core.mjs，让随插件分发的
// tomato-runtime 不依赖任何 node_modules。esbuild 只做打包不做转译降级
// （runtime 跑在 Node 24 上，直接输出 ESM）。
//
// 为什么放在根 scripts/ 而不是 runtime/：打包涉及两个工作流（core 与 runtime）
// 的产物边界，属集成分（lead 负责）。产物 runtime/vendor/core.mjs 与
// runtime/bin/tomato-runtime 保持兄弟关系，安装脚本按相对位置复制 vendor/。
//
// 产物入库（与 plugin/client.js 同理）：CI 的 runtime 测试直接 import
// ../vendor/core.mjs，不额外跑构建；core/ 改动后必须重新执行本脚本并提交产物。
import { build } from "esbuild";

await build({
  entryPoints: ["packages/core/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  outfile: "runtime/vendor/core.mjs",
  sourcemap: "inline",
  logLevel: "info",
});
