// 看板娘切换列：四个角色、当前角色高亮、头像对齐各自的 Q 版素材；
// 选择只认四个 id，换人后通知订阅者（浮层与 DSH 设置行共用同一份状态）。
//
// 为什么不放进 smoke-client：切换列按需渲染（指针靠近才出现），假 DOM 里的
// SSR 渲染永远停在关闭态；这里直接渲染 PersonaSwitch，能覆盖「打开后」的 markup。
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, "package.json"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const runtime = await import("../plugin/src/client/runtime.js");
runtime.installRuntime((name) => require(name));
const persona = await import("../plugin/src/client/app/persona.js");

const render = (currentId) =>
  renderToStaticMarkup(
    React.createElement(persona.PersonaSwitch, {
      currentId,
      onPick: () => {},
      panelRef: null,
    }),
  );

test("切换列渲染四个角色，只有当前角色高亮", () => {
  const html = render("natsuki");
  for (const file of ["default.webp", "calm.webp", "coach.webp", "senpai.webp"]) {
    assert.ok(html.includes(file), `缺少头像素材 ${file}`);
  }
  assert.equal((html.match(/class="t-persona-pick"/g) || []).length, 4);
  assert.equal((html.match(/data-active="true"/g) || []).length, 1);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(html.includes("换一位"));
  assert.ok(html.includes("冷静学伴"));
});

test("换人写入状态并通知订阅者，未知 id 被忽略", () => {
  const seen = [];
  const off = persona.subscribePersona((id) => seen.push(id));

  persona.setPersonaId("ryuji");
  assert.equal(persona.getPersonaId(), "ryuji");
  assert.equal(persona.personaAvatar(), "coach.webp");
  assert.equal(persona.personaFile(), "ryuji.png");

  persona.setPersonaId("nobody");
  assert.equal(persona.getPersonaId(), "ryuji");

  off();
  persona.setPersonaId("atri");
  assert.deepEqual(seen, ["ryuji"]);
  assert.equal(persona.getPersonaId(), "atri");
});

test("切换列抬到输入区上缘之上；输入区在立绘上方或不存在时不抬", () => {
  const rect = (top, bottom, height) => ({
    getBoundingClientRect: () => ({ top, bottom, height }),
  });
  const art = rect(600, 950, 350);
  const previous = globalThis.document;
  const seats = (...items) => ({ querySelectorAll: () => items });
  try {
    // 输入区贴着页面底部：列底边抬到输入区上缘再往上 12px，不压住发送按钮。
    globalThis.document = seats(rect(800, 995, 195));
    assert.equal(persona.composerLift(art), 162);

    // 多会话保留在 DOM 里：只认贴在页底的那个，藏在别处（高度 0）的不算。
    globalThis.document = seats(rect(0, 0, 0), rect(800, 995, 195));
    assert.equal(persona.composerLift(art), 162);

    // 新会话把输入框居中：整个在立绘上方，立绘那一带没有可挡的东西。
    globalThis.document = seats(rect(300, 520, 220));
    assert.equal(persona.composerLift(art), 0);

    // 番茄页/设置页没有输入区。
    globalThis.document = seats();
    assert.equal(persona.composerLift(art), 0);

    // 输入区再高也不把列抬过立绘头顶。
    globalThis.document = seats(rect(610, 995, 385));
    assert.equal(persona.composerLift(art), 310);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
