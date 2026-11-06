// 把 @tomato/core 打进 runtime 的单文件产物，保证随插件分发的 runtime 零外部依赖。
// TODO(lead)：@tomato/core（packages/core/src/index.ts）落地后启用：
//   1. pnpm install --allow-build=esbuild（根仓库，安装 esbuild devDependency）
//   2. node scripts/bundle-core.mjs → 生成 src/core.bundle.mjs
//   3. 把 src/engine.ts 的桩实现替换为 import core from "./core.bundle.mjs"，
//      外部 JSON 形状（runtime/src/types.ts 与 API.md）保持不变。
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "..", "packages", "core", "src", "index.ts");
const outfile = join(root, "src", "core.bundle.mjs");

let esbuild;
try {
  esbuild = await import("esbuild");
} catch {
  console.error("bundle-core: 缺少 devDependency esbuild，先运行 pnpm install --allow-build=esbuild");
  process.exit(1);
}

if (!existsSync(entry)) {
  console.error(`bundle-core: @tomato/core 尚未落地（缺 ${entry}），core-port 完成后重试。`);
  process.exit(1);
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  outfile,
  sourcemap: true,
  banner: {
    js: "// 由 runtime/scripts/bundle-core.mjs 生成：@tomato/core 打进单文件，勿手改。",
  },
});
console.error(`bundle-core: 已生成 ${outfile}`);
