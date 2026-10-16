import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

test("persona artwork: default off, settings, agent control and current character", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tomato-personas-"));
  const url = "http://127.0.0.1:4358";
  const server = spawn("target/debug/tomato-preview", [], {
    env: {
      ...process.env,
      TOMATO_PORT: "4358",
      TOMATO_DATA_PATH: join(dir, "data.sqlite3"),
    },
    stdio: "pipe",
  });
  let browser,
    output = "";
  server.stderr.on("data", (data) => (output += data));
  const agent = async (name, args = {}) => {
    const response = await fetch(url + "/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "tool", name, arguments: args }),
    });
    assert.ok(response.ok, await response.clone().text());
    return response.json();
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "/api/snapshot")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/personas/") && response.status() >= 400)
        errors.push(response.url() + ": " + response.status());
    });
    await page.goto(url);
    const backdrop = page.locator("#persona-backdrop");
    await expect(backdrop).toBeHidden();
    await expect(backdrop.locator("img")).toHaveCount(0);
    await page.locator('[data-page="settings"]').click();
    const toggle = page.locator('[name="personaBackdrop"]');
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.locator('[data-page="agent"]').click();
    await expect(backdrop).toBeVisible();
    await expect(backdrop.locator("img")).toHaveAttribute(
      "src",
      "/personas/atri.png",
    );
    await page.locator(".agent-persona-badge").click();
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({
      path: "artifacts/persona-chibi-cards.png",
      fullPage: true,
    });
    const illustrations = {
      default: "atri",
      calm: "natsuki",
      coach: "ryuji",
      senpai: "minamo",
    };
    for (const [id, reference] of Object.entries(illustrations)) {
      const card = page.locator('.agent-persona[data-id="' + id + '"]');
      await card.locator(".agent-persona-avatar").click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".agent-persona-badge img")).toHaveAttribute(
        "src",
        "/personas/" + id + ".webp",
      );
      await expect(backdrop.locator("img")).toHaveAttribute(
        "src",
        "/personas/" + reference + ".png",
      );
      await expect
        .poll(() => backdrop.locator("img").evaluate((img) => img.naturalWidth))
        .toBe(721);
      assert.equal(
        await card
          .locator(".agent-persona-avatar img")
          .evaluate((img) => img.naturalWidth),
        512,
      );
    }
    const current = await page
      .locator(".agent-persona.current")
      .getAttribute("data-id");
    const art = page.locator(
      '.agent-persona[data-id="default"] .agent-persona-art',
    );
    await art.locator("summary").click();
    await expect(art.locator("img")).toBeVisible();
    await expect(page.locator(".agent-persona.current")).toHaveAttribute(
      "data-id",
      current,
    );
    await expect(art.locator("img")).toHaveAttribute(
      "src",
      "/personas/atri.png",
    );
    await page.locator('[data-agent="close-sheet"]').click();
    await page.locator('[data-page="focus"]').first().click();
    await expect(backdrop).toBeVisible();
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({
      path: "artifacts/persona-backdrop-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "进入沉浸模式" }).click();
    await expect(backdrop).toBeHidden();
    await page.getByRole("button", { name: "退出沉浸模式" }).click();
    await expect(backdrop).toBeVisible();
    await page.reload();
    await expect(backdrop.locator("img")).toHaveAttribute(
      "src",
      "/personas/minamo.png",
    );
    const settings = (await agent("get_snapshot")).data.settings;
    await agent("dispatch", {
      action: {
        type: "saveSettings",
        settings: { ...settings, personaBackdrop: false },
      },
    });
    await expect(backdrop).toBeHidden();
    await agent("dispatch", {
      action: {
        type: "saveSettings",
        settings: { ...settings, personaBackdrop: true },
      },
    });
    await expect(backdrop).toBeVisible();
    await agent("save_persona", {
      id: "portrait-test",
      name: "自定义人格",
      emoji: "🌱",
      identity: "验证自定义图标。",
    });
    await agent("switch_persona", { id: "portrait-test" });
    await expect(backdrop).toBeHidden();
    await page.locator('[data-page="agent"]').click();
    await expect(
      page.locator(".agent-persona-badge .agent-persona-avatar"),
    ).toHaveText("🌱");
    await expect(page.locator(".agent-persona-badge img")).toHaveCount(0);
    await agent("switch_persona", { id: "default" });
    await expect(backdrop.locator("img")).toHaveAttribute(
      "src",
      "/personas/atri.png",
    );
    await page.locator('[data-page="focus"]').first().click();
    await page.locator('[data-action="theme"]').click();
    await page.screenshot({
      path: "artifacts/persona-backdrop-dark.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await backdrop.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        right: rect.right,
        width: rect.width,
        pointerEvents: style.pointerEvents,
      };
    });
    assert.ok(layout.right <= 391 && layout.width <= 390);
    assert.equal(layout.pointerEvents, "none");
    await expect(backdrop).toHaveAttribute("aria-hidden", "true");
    await page.screenshot({
      path: "artifacts/persona-backdrop-mobile.png",
      fullPage: true,
    });
    await page.locator('[data-page="settings"]').click();
    await expect(page.locator('[name="personaBackdrop"]')).toBeChecked();
    await page.locator('[name="personaBackdrop"]').uncheck();
    await page.locator('[data-page="focus"]').first().click();
    await expect(backdrop).toBeHidden();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
});
