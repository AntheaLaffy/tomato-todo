import { agentCall, desktop, native, dispatch } from "./api";
import { invoke } from "@tauri-apps/api/core";
import type { Resource } from "./education";
import type { Project, Snapshot } from "./types";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const resourceKinds: Record<string, string> = {
  syllabus: "考纲",
  course: "课程",
  book: "教材",
  pastPaper: "真题",
  mockPaper: "模拟题",
  reference: "参考资料",
  attachment: "聊天资料",
  answerSheet: "答题卡",
};
interface Check {
  id: string;
  state: string;
  sizeBytes: number | null;
  detail: string;
  references: string[];
}
interface Scan {
  checkedAt: number;
  resources: Check[];
}
interface Info {
  name: string;
  mimeType: string;
  sizeBytes: number;
  canPreview: boolean;
}
interface Hooks {
  accept: (s: Snapshot) => void;
  toast: (s: string) => void;
  modal: (s: string) => void;
}
const views = new Map<
  string,
  {
    query: string;
    kind: string;
    health: string;
    page: number;
    open: boolean;
    scan?: Scan;
  }
>();
const view = (id: string) => {
  if (!views.has(id))
    views.set(id, { query: "", kind: "", health: "", page: 0, open: false });
  return views.get(id)!;
};
let previewUrl: string | undefined;
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const resourceIndices = new WeakMap<Resource[], Map<string, Resource>>();
export function resourceLinks(
  ids: string[],
  resources: Resource[],
  label = "相关资料",
): string {
  if (!ids.length) return "";
  let index = resourceIndices.get(resources);
  if (!index) {
    index = new Map(resources.map((r) => [r.id, r]));
    resourceIndices.set(resources, index);
  }
  const entries = [...new Set(ids)]
    .map((id) => index!.get(id))
    .filter((r): r is Resource => !!r);
  return entries.length
    ? `<div class="education-resource-links"><strong>${esc(label)}</strong>${entries.map((r) => `<button class="text-button" data-resource-open="${esc(r.id)}">${esc(r.title)}</button>`).join("")}</div>`
    : "";
}
const catalogs = new WeakMap<
  Resource[],
  Map<string, { resource: Resource; search: string }[]>
>();
function catalog(resources: Resource[], id: string) {
  let groups = catalogs.get(resources);
  if (!groups) {
    groups = new Map();
    for (const resource of resources) {
      const entries = groups.get(resource.projectId) || [];
      entries.push({
        resource,
        search: [
          resource.title,
          resource.path,
          resource.source,
          resource.edition,
          ...resource.topics,
        ]
          .join(" ")
          .toLocaleLowerCase(),
      });
      groups.set(resource.projectId, entries);
    }
    catalogs.set(resources, groups);
  }
  return groups.get(id) || [];
}
function rows(snapshot: Snapshot, id: string) {
  const state = view(id),
    checks = new Map(state.scan?.resources.map((r) => [r.id, r]));
  const query = state.query.toLocaleLowerCase().trim();
  const entries = catalog(snapshot.data.education.resources, id)
    .filter(
      ({ resource: r, search }) =>
        (!state.kind || r.kind === state.kind) &&
        (!query || search.includes(query)) &&
        (!state.health || checks.get(r.id)?.state === state.health),
    )
    .map(({ resource }) => resource);
  const pages = Math.max(1, Math.ceil(entries.length / 40));
  state.page = Math.min(state.page, pages - 1);
  return `<p class="subtle">匹配 ${entries.length} 项 · 第 ${state.page + 1} / ${pages} 页${state.scan ? ` · 检查于 ${new Date(state.scan.checkedAt * 1000).toLocaleTimeString()}` : " · 尚未检查文件状态"}</p>${
    entries
      .slice(state.page * 40, (state.page + 1) * 40)
      .map((r) => {
        const check = checks.get(r.id);
        return `<article class="resource-row" data-resource-row="${esc(r.id)}"><div><strong>${esc(r.title)}</strong><small>${esc(resourceKinds[r.kind] || r.kind)} · ${esc(r.edition)} · ${esc(r.source)}</small><small>${esc(r.path)}</small>${r.topics.length ? `<small>${esc(r.topics.join("、"))}</small>` : ""}<small>${check ? `${esc({ available: "文件可用", missing: "文件缺失", unavailable: "暂不可用" }[check.state] || check.state)}${check.sizeBytes !== null ? ` · ${size(check.sizeBytes)}` : ""} · ${check.references.length} 处引用${check.detail ? ` · ${esc(check.detail)}` : ""}` : "文件状态未检查"}</small>${check?.references.length ? `<details><summary>查看引用</summary>${check.references.map((r) => `<p>${esc(r)}</p>`).join("")}</details>` : ""}</div><div class="button-row"><button class="text-button" data-resource-open="${esc(r.id)}">预览 / 下载</button><button class="text-button" data-resource-repair="${esc(r.id)}">修复路径</button>${check && !check.references.length ? `<button class="text-button" data-resource-remove="${esc(r.id)}">移除登记</button>` : ""}</div></article>`;
      })
      .join("") || `<p>没有匹配的资源。</p>`
  }<div class="button-row"><button class="button secondary small-button" data-resource-page="-1" ${state.page === 0 ? "disabled" : ""}>上一页</button><button class="button secondary small-button" data-resource-page="1" ${state.page + 1 >= pages ? "disabled" : ""}>下一页</button></div>`;
}
export function resourceLibrary(snapshot: Snapshot, project: Project): string {
  const state = view(project.id),
    count = snapshot.data.education.resources.filter(
      (r) => r.projectId === project.id,
    ).length;
  const mounted = [
    ...document.querySelectorAll<HTMLDetailsElement>(".resource-library"),
  ].find((el) => el.dataset.resourceProject === project.id);
  if (mounted) state.open = mounted.open;
  return `<details class="resource-library" data-resource-project="${esc(project.id)}" ${state.open ? "open" : ""}><summary>项目资源 ${count}</summary><div class="resource-filters"><label class="form-field"><span>搜索资料</span><input type="search" data-resource-query value="${esc(state.query)}" placeholder="名称、路径、知识点、来源或版本"></label><label class="form-field"><span>资料类型</span><select data-resource-kind><option value="">全部类型</option>${Object.entries(
    resourceKinds,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}" ${state.kind === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="form-field"><span>文件状态</span><select data-resource-health>${[
    ["", "全部状态"],
    ["available", "文件可用"],
    ["missing", "文件缺失"],
    ["unavailable", "暂不可用"],
  ]
    .map(
      ([k, v]) =>
        `<option value="${k}" ${state.health === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label></div><div class="button-row"><button class="button secondary small-button" data-resource-scan>检查失效登记</button><button class="button secondary small-button" data-resource-clean>清理缺失且无引用的登记</button></div><p data-explanation>检查只读取文件状态。修复保留原资源 ID；清理只移除未被引用的登记，磁盘原件保留。目录暂不可用时请先重新授权。</p><div data-resource-results>${rows(snapshot, project.id)}</div></details>`;
}
async function download(id: string) {
  if (desktop)
    return invoke<boolean>("save_project_resource", { resourceId: id });
  if (native) throw new Error("此平台尚未接入项目资料目录");
  // Navigation lets the browser stream to its download manager, without a Blob or Base64 copy.
  const a = document.createElement("a");
  a.href = `/api/project-resource?id=${encodeURIComponent(id)}`;
  a.download = "";
  a.click();
  return true;
}
export function mountResources(snapshot: Snapshot, hooks: Hooks): void {
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      hooks.toast(String(e));
    }
  };
  const show = async (id: string) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = undefined;
    }
    const resource = snapshot.data.education.resources.find((r) => r.id === id);
    if (!resource) return;
    const info = await agentCall<Info>({
      op: "project_resource_info",
      resourceId: id,
    });
    hooks.modal(
      `<header class="modal-heading"><h2 id="modal-title">${esc(resource.title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">×</button></header><p>${esc(info.name)} · ${size(info.sizeBytes)}</p><div class="button-row"><button class="button primary" id="resource-download">下载原件</button>${desktop ? `<button class="button secondary" id="resource-system-open">用系统应用打开</button>` : ""}</div><div class="resource-preview" id="resource-preview">${info.canPreview ? "正在加载预览…" : "此文件较大或格式不支持内嵌预览，请下载原件"}</div>`,
    );
    document.querySelector<HTMLButtonElement>("#resource-download")!.onclick =
      () => void run(() => download(id));
    const opener = document.querySelector<HTMLButtonElement>(
      "#resource-system-open",
    );
    if (opener)
      opener.onclick = () =>
        void run(() => invoke("open_project_resource", { resourceId: id }));
    if (!info.canPreview) return;
    const panel = document.querySelector<HTMLElement>("#resource-preview")!;
    try {
      const file = await agentCall<{ data: string; mimeType: string }>({
        op: "preview_project_resource",
        resourceId: id,
      });
      if (!panel.isConnected) return;
      const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
      if (file.mimeType === "text/plain") {
        const content = new TextDecoder().decode(bytes);
        panel.innerHTML = `${content.length > 200000 ? "<p>预览显示前20万字符，完整内容请下载原件。</p>" : ""}<pre></pre>`;
        panel.querySelector("pre")!.textContent = content.slice(0, 200000);
      } else {
        previewUrl = URL.createObjectURL(
          new Blob([bytes], { type: file.mimeType }),
        );
        panel.innerHTML =
          file.mimeType === "application/pdf"
            ? `<iframe title="PDF资料预览" src="${previewUrl}"></iframe>`
            : `<img alt="${esc(resource.title)}" src="${previewUrl}">`;
      }
    } catch (e) {
      panel.textContent = String(e);
    }
  };
  const repair = async (id: string) => {
    const resource = snapshot.data.education.resources.find(
      (r) => r.id === id,
    )!;
    const path = prompt(
      "输入资源在已授权项目目录中的新相对路径（保留现有引用）",
      resource.path,
    );
    if (!path || path === resource.path) return;
    view(resource.projectId).scan = undefined;
    hooks.accept(
      await agentCall<Snapshot>({
        op: "repair_project_resource",
        resourceId: id,
        path,
      }),
    );
    hooks.toast("路径已修复，教学引用保留");
  };
  document
    .querySelectorAll<HTMLElement>("[data-resource-open]")
    .forEach((el) => {
      el.onclick = () => void run(() => show(el.dataset.resourceOpen!));
    });
  document
    .querySelectorAll<HTMLDetailsElement>(".resource-library")
    .forEach((library) => {
      const id = library.dataset.resourceProject!,
        state = view(id);
      library.ontoggle = () => {
        state.open = library.open;
      };
      const refresh = () => {
        library.querySelector("[data-resource-results]")!.innerHTML = rows(
          snapshot,
          id,
        );
      };
      const query = library.querySelector<HTMLInputElement>(
        "[data-resource-query]",
      )!;
      query.oninput = () => {
        state.query = query.value;
        state.page = 0;
        refresh();
      };
      for (const [selector, key] of [
        ["[data-resource-kind]", "kind"],
        ["[data-resource-health]", "health"],
      ] as const) {
        const select = library.querySelector<HTMLSelectElement>(selector)!;
        select.onchange = () => {
          state[key] = select.value;
          state.page = 0;
          refresh();
        };
      }
      library.onclick = (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          "button",
        );
        if (!button) return;
        // Delegate newly filtered rows as well as the initial list.
        event.stopPropagation();
        void run(async () => {
          if (button.dataset.resourceOpen) {
            await show(button.dataset.resourceOpen);
            return;
          }
          if (button.dataset.resourceRepair) {
            await repair(button.dataset.resourceRepair);
            return;
          }
          if (button.hasAttribute("data-resource-page")) {
            state.page += Number(button.dataset.resourcePage);
            refresh();
            return;
          }
          if (button.hasAttribute("data-resource-scan")) {
            button.disabled = true;
            try {
              state.scan = await agentCall<Scan>({
                op: "scan_project_resources",
                projectId: id,
              });
              refresh();
            } finally {
              button.disabled = false;
            }
            return;
          }
          let ids: string[] = [];
          if (button.dataset.resourceRemove)
            ids = [button.dataset.resourceRemove];
          if (button.hasAttribute("data-resource-clean")) {
            if (!state.scan) {
              hooks.toast("请先检查失效登记");
              return;
            }
            ids = state.scan.resources
              .filter((r) => r.state === "missing" && !r.references.length)
              .map((r) => r.id);
          }
          if (!ids.length) {
            hooks.toast("没有可清理的缺失且无引用登记");
            return;
          }
          if (!confirm(`将移除 ${ids.length} 条资源登记，磁盘文件保留。继续？`))
            return;
          state.scan = undefined;
          hooks.accept(
            button.hasAttribute("data-resource-clean")
              ? await agentCall<Snapshot>({
                  op: "clean_missing_resources",
                  ids,
                })
              : await dispatch({
                  type: "education",
                  command: { op: "removeResources", ids },
                }),
          );
          hooks.toast(`已移除 ${ids.length} 条资源登记`);
        });
      };
      // The library's delegated handler owns its resource buttons.
      library
        .querySelectorAll<HTMLElement>("[data-resource-open]")
        .forEach((el) => {
          el.onclick = null;
        });
    });
}
