#!/usr/bin/env node
// 把 npm 上已发布的版本同步进 market/index.json（插件市场的格式 1 索引）。
//
// 索引里的 `publishTimestamp` 与版本列表是事实，手写必然漂移；这里从 registry
// 读 deps 里声明的包名，取未废弃版本，按 semver 降序写入，并保留标题/图标等
// 人工维护的展示字段。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INDEX = join(ROOT, "market/index.json");
const index = JSON.parse(readFileSync(INDEX, "utf8"));
const plugin = index.plugins[0];
const pkg = JSON.parse(readFileSync(join(ROOT, "plugin/package.json"), "utf8"));

const raw = execFileSync("npm", ["view", pkg.name, "time", "--json"], {
  encoding: "utf8",
});
const times = JSON.parse(raw);
const versions = Object.entries(times)
  .filter(([key]) => /^\d+\.\d+\.\d+/.test(key))
  .map(([version, iso]) => ({
    version,
    publishTimestamp: Math.floor(new Date(iso).getTime() / 1000),
  }))
  .sort((a, b) => b.publishTimestamp - a.publishTimestamp);

if (versions.length === 0) {
  console.error(`npm 上没有 ${pkg.name} 的版本，先发布再跑本脚本`);
  process.exit(1);
}

plugin.versions = versions.map(({ version, publishTimestamp }) => ({
  version,
  publishTimestamp,
  source: { type: "npm" },
  engines: { dsh: pkg.engines?.dsh ?? undefined },
}));
writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);
console.log(`已更新 ${pkg.name}：${versions.length} 个版本`);
