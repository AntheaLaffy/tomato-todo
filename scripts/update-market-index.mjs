#!/usr/bin/env node
// 把 npm 上已发布的版本同步进 market/index.json（插件市场的格式 1 索引）。
//
// 索引里的版本列表与发布时间是事实，手写必然漂移。这里直接读 registry 的包文档：
// - 只收「声明了 dsh.bundle.patch」的版本——没有这个字段的包根本装不进 DSH，
//   列进索引只会让用户在安装时失败（发布过程中的占位版本就是这样）；
// - 跳过 deprecated 的版本；
// - 按发布时间倒序写入，标题/图标/描述等展示字段保持人工维护。
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INDEX = join(ROOT, "market/index.json");
const index = JSON.parse(readFileSync(INDEX, "utf8"));
const plugin = index.plugins[0];
const pkg = JSON.parse(readFileSync(join(ROOT, "plugin/package.json"), "utf8"));

// 要完整文档：简版（install-v1）会裁掉 `dsh` 这类自定义字段，就看不到 bundle 声明。
const response = await fetch(`https://registry.npmjs.org/${pkg.name}`);
if (!response.ok) {
  console.error(`读取 ${pkg.name} 失败：HTTP ${response.status}`);
  process.exit(1);
}
const doc = await response.json();
const times = doc.time ?? {};
const versions = Object.entries(doc.versions ?? {})
  .filter(([version, manifest]) => {
    if (!/^\d+\.\d+\.\d+/.test(version)) return false;
    if (manifest.deprecated !== undefined) return false;
    return typeof manifest.dsh?.bundle?.patch === "string";
  })
  .map(([version, manifest]) => ({
    version,
    publishTimestamp: Math.floor(new Date(times[version]).getTime() / 1000),
    bundle: manifest.dsh.bundle.patch,
  }))
  .sort((a, b) => b.publishTimestamp - a.publishTimestamp);

if (versions.length === 0) {
  console.error(`${pkg.name} 还没有声明 dsh.bundle 的已发布版本`);
  process.exit(1);
}

plugin.versions = versions.map(({ version, publishTimestamp }) => ({
  version,
  publishTimestamp,
  source: { type: "npm" },
  engines: { dsh: pkg.engines?.dsh ?? undefined },
}));
writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `已更新 ${pkg.name}：${plugin.versions.map((v) => v.version).join(", ")}`,
);
