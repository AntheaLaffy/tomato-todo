// 主线节点图：把阶段节点画成一条可编辑的横向轨道。
//
// 主线本身是线性的（按时间排序、区间不重叠），所以图的基础是「卡片 + 顺序箭头」；
// 成功/失败/检查信号沿轨道向头或向尾传播，用顶部的彩色横条表示它能到哪、在哪个
// 阻断节点停下。任务串可以很长，因此卡片宽度固定、轨道横向滚动，并用缩略图导航。

import type {
  BlockRule,
  Goal,
  MainlineNode,
  NodeProgress,
  NodeSpec,
} from "./types";

export interface NodeGraphOptions {
  specs: NodeSpec[];
  goal: Goal | undefined;
  icon: (name: string, cls?: string) => string;
  escape: (value: unknown) => string;
  progress: (id: string) => NodeProgress | undefined;
  canDelete: (id: string) => boolean;
  verdict: (verdict: string | null | undefined) => string;
  signalLabel: (kind: string) => string;
  blockLabels: Record<BlockRule, string>;
  shiftDate: (date: string, days: number) => string;
}

const CARD_W = 184;
const CARD_H = 108;
const GAP = 34;
const RAIL_TOP = 6;
const RAIL_ROW = 20;
const PAD = 14;
const LABEL = "MM/DD";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

const x = (index: number) => index * (CARD_W + GAP);

function dayLabel(stamp: string) {
  const date = stamp.slice(0, 10);
  if (!date) return "—";
  const [, month, day] = date.split("-");
  return month && day ? `${month}/${day}` : date;
}

function timeLabel(stamp: string) {
  const clock = stamp.slice(11, 16);
  return clock && clock !== "00:00" ? ` ${clock}` : "";
}

interface SignalRange {
  from: number;
  to: number;
  blocked: boolean;
}

// A signal is accepted by the source and then travels until a node that blocks
// that kind. Conditional rules may let it pass depending on that node's state,
// so the drawn end is the conservative one and the node is marked as a barrier.
function signalRange(index: number, specs: NodeSpec[]): SignalRange | null {
  const signal = specs[index]?.signal;
  if (!signal) return null;
  const step = signal.direction === "head" ? -1 : 1;
  let end = index;
  for (let j = index + step; j >= 0 && j < specs.length; j += step) {
    if (signal.kind !== "check") {
      const rule =
        signal.kind === "success"
          ? specs[j].blockSuccess
          : specs[j].blockFailure;
      if (rule !== "never") break;
    }
    end = j;
  }
  const extreme = signal.direction === "head" ? 0 : specs.length - 1;
  return {
    from: Math.min(index, end),
    to: Math.max(index, end),
    blocked: end !== extreme,
  };
}

// Greedy interval colouring keeps overlapping signal bars on separate rows.
function assignRows(ranges: { index: number; range: SignalRange }[]) {
  const rows: { from: number; to: number }[][] = [];
  const placed = new Map<number, number>();
  for (const { index, range } of [...ranges].sort(
    (a, b) => a.range.from - b.range.from || a.range.to - b.range.to,
  )) {
    let row = 0;
    while (
      rows[row]?.some((used) => !(range.to < used.from || range.from > used.to))
    )
      row++;
    (rows[row] ??= []).push(range);
    placed.set(index, row);
  }
  return { placed, count: Math.max(1, rows.length) };
}

export function createNodeGraph(host: HTMLElement, options: NodeGraphOptions) {
  const { specs } = options;
  let selected: string | null = specs[0]?.id ?? null;

  const runtime = (id: string) =>
    options.goal?.nodes.find((node) => node.spec.id === id);
  const indexOf = (id: string) => specs.findIndex((spec) => spec.id === id);
  const isLast = (index: number) => index === specs.length - 1;

  const defaultTimes = (index: number) => {
    const previous = specs[index - 1];
    const next = specs[index];
    if (previous && next) {
      const start = previous.end;
      const end = next.start > start ? next.start : addDays(start, 7);
      return { start, end };
    }
    if (previous) return { start: previous.end, end: addDays(previous.end, 7) };
    if (next) {
      const start = shift(next.start, -7);
      return { start, end: next.start };
    }
    return {
      start: `${new Date().toISOString().slice(0, 10)}T00:00`,
      end: addDays(`${new Date().toISOString().slice(0, 10)}T00:00`, 7),
    };
  };
  const addDays = (stamp: string, days: number) =>
    `${options.shiftDate(stamp.slice(0, 10), days)}T${stamp.slice(11, 16) || "00:00"}`;
  const shift = (stamp: string, days: number) =>
    `${options.shiftDate(stamp.slice(0, 10), days)}T${stamp.slice(11, 16) || "00:00"}`;

  function newSpec(start: string, end: string): NodeSpec {
    return {
      id: crypto.randomUUID(),
      name: "",
      start,
      end,
      requiredTasks: 1,
      confirmationRequired: false,
      signal: {
        kind: "check",
        direction: "head",
        at: end,
        condition: "always",
      },
      blockSuccess: "never",
      blockFailure: "never",
    };
  }

  function insertAt(index: number) {
    const previous = specs[index - 1];
    if (previous?.signal?.kind === "check") {
      previous.signal = null;
      previous.blockSuccess = "never";
      previous.blockFailure = "never";
    }
    const { start, end } = defaultTimes(index);
    const spec = newSpec(start, end);
    specs.splice(index, 0, spec);
    selected = spec.id;
    render();
  }

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= specs.length || from === to) return;
    const step = to > from ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      const a = specs[i];
      const b = specs[i + step];
      [a.start, b.start] = [b.start, a.start];
      [a.end, b.end] = [b.end, a.end];
      specs[i] = b;
      specs[i + step] = a;
    }
    render();
    scrollTo(selected);
  }

  function deleteAt(id: string) {
    const index = indexOf(id);
    if (index < 0 || !options.canDelete(id)) return;
    specs.splice(index, 1);
    if (selected === id)
      selected = specs[Math.min(index, specs.length - 1)]?.id ?? null;
    render();
  }

  function laneMetrics() {
    const ranges = specs
      .map((spec, index) => ({ index, range: signalRange(index, specs) }))
      .filter(
        (entry): entry is { index: number; range: SignalRange } =>
          entry.range !== null,
      );
    const { placed, count } = assignRows(ranges);
    const cardsTop = RAIL_TOP + count * RAIL_ROW + 10;
    const width = Math.max(
      CARD_W,
      specs.length * CARD_W + (specs.length - 1) * GAP,
    );
    return {
      ranges,
      rows: placed,
      rowCount: count,
      cardsTop,
      width,
      height: cardsTop + CARD_H + PAD,
    };
  }

  function cardHtml(spec: NodeSpec, index: number, top: number) {
    const node = runtime(spec.id);
    const progress = options.progress(spec.id);
    const verdict = node?.result?.verdict ?? null;
    const signal = spec.signal;
    const badges: string[] = [];
    if (signal)
      badges.push(
        `<span class="node-badge signal-${signal.kind}">${options.signalLabel(signal.kind)}${signal.kind === "check" ? "" : signal.direction === "head" ? " · 向头" : " · 向尾"}</span>`,
      );
    if (spec.blockSuccess !== "never")
      badges.push(`<span class="node-badge block">挡成功</span>`);
    if (spec.blockFailure !== "never")
      badges.push(`<span class="node-badge block">挡失败</span>`);
    return `<article class="node-card ${selected === spec.id ? "selected" : ""} ${verdict ? `verdict-${verdict}` : ""}" data-node-row="${escapeHtml(spec.id)}" data-node-index="${index}" draggable="true" style="left:${x(index)}px;top:${top}px">
      <header><span class="node-order">${index + 1}</span><span class="node-verdict ${verdict ?? "open"}">${escapeHtml(options.verdict(verdict))}</span>${options.canDelete(spec.id) ? `<button type="button" class="node-remove" data-remove-node aria-label="移除节点">${options.icon("x")}</button>` : ""}</header>
      <strong class="node-name">${escapeHtml(spec.name || "未命名节点")}</strong>
      <span class="node-time">${dayLabel(spec.start)}${timeLabel(spec.start)} – ${dayLabel(spec.end)}${timeLabel(spec.end)}</span>
      <div class="node-badges">${badges.join("") || '<span class="node-badge muted">无信号</span>'}<span class="node-badge muted">配对 ${progress?.completedCount ?? 0}/${progress?.pairedCount ?? 0}</span></div>
    </article>`;
  }

  function signalHtml(
    index: number,
    range: SignalRange,
    row: number,
    top: number,
  ) {
    const spec = specs[index];
    const signal = spec.signal!;
    const left = x(range.from);
    const right = x(range.to) + CARD_W;
    const arrow = signal.direction === "head" ? "start" : "end";
    return `<div class="node-signal-bar signal-${signal.kind} arrow-${arrow}" style="left:${left}px;top:${top + row * RAIL_ROW}px;width:${right - left}px" title="${escapeHtml(options.signalLabel(signal.kind))}"></div>`;
  }

  function inspectorHtml() {
    const index = selected ? indexOf(selected) : -1;
    if (index < 0) return "";
    const spec = specs[index];
    const node = runtime(spec.id);
    const locked = !!node?.result;
    const emitted = !!node?.emitted;
    const field = (
      key: string,
      type: string,
      value: string | number,
      extra = "",
    ) =>
      `<input data-node-field="${key}" name="node${key}" type="${type}" value="${escapeHtml(String(value))}" ${extra}>`;
    const signal = spec.signal;
    const signalOptions = [
      ["none", "不发信号"],
      ["success", "裁定成功"],
      ["failure", "裁定失败"],
      ...(isLast(index)
        ? ([["check", "末节点检查"]] as [string, string][])
        : []),
    ];
    const select = (key: string, entries: [string, string][], value: string) =>
      `<select data-node-field="${key}">${entries.map(([id, label]) => `<option value="${id}" ${value === id ? "selected" : ""}>${label}</option>`).join("")}</select>`;
    const blocks = Object.entries(options.blockLabels) as [BlockRule, string][];
    return `<div class="node-inspector-head"><button type="button" class="icon-btn" data-move-node="-1" ${index === 0 ? "disabled" : ""} aria-label="前移">${options.icon("arrow-left")}</button><b>节点 ${index + 1}</b><button type="button" class="icon-btn" data-move-node="1" ${isLast(index) ? "disabled" : ""} aria-label="后移">${options.icon("arrow-right")}</button><span class="node-inspector-hint">拖动卡片也能重排</span></div>
    <label class="form-field"><span>节点名称</span>${field("name", "text", spec.name, 'required maxlength="80"')}</label>
    <div class="form-grid"><label class="form-field"><span>配对起始时间</span>${field("start", "datetime-local", spec.start, "required")}</label><label class="form-field"><span>配对结束时间（不含）</span>${field("end", "datetime-local", spec.end, "required")}</label></div>
    <details class="editor-details" ${spec.requiredTasks > 1 || spec.confirmationRequired ? "open" : ""}><summary>阶段完成要求 <small>默认配对任务全部完成</small></summary><label class="form-field"><span>至少配对几条任务</span>${field("requiredTasks", "number", spec.requiredTasks, 'min="1" max="50000" required')}</label><label class="settings-line"><span>还需要手动确认</span><input data-node-field="confirmationRequired" class="switch" type="checkbox" ${spec.confirmationRequired ? "checked" : ""}></label></details>
    <label class="form-field"><span>发出的信号</span>${select("signalKind", signalOptions as [string, string][], signal?.kind ?? "none")}<small>成功或失败都会报废配对实例，裁定不可撤销。</small></label>
    <div data-signal-controls ${signal ? "" : "hidden"}><div class="form-grid"><label class="form-field"><span>何时发出</span>${field("signalAt", "datetime-local", signal?.at ?? spec.end, "required")}</label><label class="form-field"><span>传播方向</span>${select(
      "direction",
      [
        ["head", "向头节点"],
        ["tail", "向尾节点"],
      ],
      signal?.direction ?? "head",
    )}</label><label class="form-field"><span>到时还需满足</span>${select(
      "condition",
      [
        ["always", "不检查自身完成情况"],
        ["completed", "自身节点已经完成"],
        ["incomplete", "自身节点尚未完成"],
      ],
      signal?.condition ?? "always",
    )}</label></div><details class="editor-details" ${spec.blockSuccess !== "never" || spec.blockFailure !== "never" ? "open" : ""}><summary>阻断外来报废信号</summary><label class="form-field"><span>接收成功信号时</span>${select("blockSuccess", blocks, spec.blockSuccess)}</label><label class="form-field"><span>接收失败信号时</span>${select("blockFailure", blocks, spec.blockFailure)}</label></details></div>
    ${locked ? `<p class="editor-hint">已裁定${escapeHtml(options.verdict(node!.result!.verdict))}，只能改名，规则与范围已冻结。</p>` : emitted ? '<p class="editor-hint">信号已发出，不能改写原信号。</p>' : ""}`;
  }

  function updateInspectorState() {
    const index = selected ? indexOf(selected) : -1;
    if (index < 0) return;
    const spec = specs[index];
    const node = runtime(spec.id);
    const inspector = host.querySelector<HTMLElement>("[data-node-inspector]");
    if (!inspector) return;
    const kind = spec.signal?.kind ?? "none";
    inspector
      .querySelectorAll<HTMLElement>("[data-signal-controls]")
      .forEach((el) => (el.hidden = kind === "none"));
    inspector
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-node-field]",
      )
      .forEach((input) => {
        const key = input.dataset.nodeField!;
        const signalField = [
          "signalAt",
          "direction",
          "condition",
          "blockSuccess",
          "blockFailure",
        ].includes(key);
        input.disabled =
          (!!node?.result && key !== "name") ||
          (!!node?.emitted &&
            ["signalKind", "signalAt", "direction", "condition"].includes(
              key,
            )) ||
          (signalField && kind === "none") ||
          (kind === "check" && ["direction", "condition"].includes(key));
        if (kind === "check" && key === "direction") input.value = "head";
        if (kind === "check" && key === "condition") input.value = "always";
      });
    const start = inspector.querySelector<HTMLInputElement>(
      '[data-node-field="start"]',
    );
    const end = inspector.querySelector<HTMLInputElement>(
      '[data-node-field="end"]',
    );
    if (start && end)
      end.setCustomValidity(
        end.value <= start.value ? "结束时间必须晚于起始时间" : "",
      );
  }

  function render() {
    const { ranges, rows, rowCount, cardsTop, width, height } = laneMetrics();
    host.innerHTML = `<div class="node-graph">
      <div class="node-graph-scroll" data-node-scroll>
        <div class="node-lane" style="width:${width}px;height:${height}px">
          ${ranges.map(({ index, range }) => signalHtml(index, range, rows.get(index) ?? 0, RAIL_TOP)).join("")}
          ${specs.map((spec, index) => cardHtml(spec, index, cardsTop)).join("")}
          ${specs.map((_, index) => `<button type="button" class="node-add" data-add-node="${index}" style="left:${index === 0 ? x(0) - GAP / 2 - 11 : x(index - 1) + CARD_W + GAP / 2 - 11}px;top:${cardsTop + CARD_H / 2 - 11}px" aria-label="插入节点">${options.icon("plus")}</button>`).join("")}
          <button type="button" class="node-add tail" data-add-node="${specs.length}" style="left:${specs.length ? x(specs.length - 1) + CARD_W + GAP / 2 - 11 : CARD_W / 2 - 11}px;top:${cardsTop + CARD_H / 2 - 11}px" aria-label="添加节点">${options.icon("plus")}</button>
        </div>
      </div>
      <div class="node-graph-foot"><div class="node-minimap" data-node-minimap>${specs
        .map(
          (spec, index) =>
            `<i class="node-mini ${runtime(spec.id)?.result ? `verdict-${runtime(spec.id)!.result!.verdict}` : ""}" data-mini-node="${index}" style="left:${(x(index) / width) * 100}%;width:${(CARD_W / width) * 100}%"></i>`,
        )
        .join(
          "",
        )}<span class="node-mini-window" data-node-window></span></div><span class="node-graph-count">${specs.length} 个节点</span></div>
      <div class="node-inspector" id="node-inspector" data-node-inspector>${inspectorHtml()}</div>
    </div>`;
    updateInspectorState();
    updateMinimap();
  }

  function updateMinimap() {
    const scroll = host.querySelector<HTMLElement>("[data-node-scroll]");
    const window = host.querySelector<HTMLElement>("[data-node-window]");
    const lane = host.querySelector<HTMLElement>(".node-lane");
    if (!scroll || !window || !lane) return;
    const total = lane.offsetWidth || 1;
    const ratio = scroll.clientWidth / total;
    window.style.left = `${(scroll.scrollLeft / total) * 100}%`;
    window.style.width = `${Math.min(100, ratio * 100)}%`;
  }

  function scrollTo(id: string | null) {
    if (!id) return;
    const index = indexOf(id);
    const scroll = host.querySelector<HTMLElement>("[data-node-scroll]");
    if (index < 0 || !scroll) return;
    const left = x(index);
    if (
      left < scroll.scrollLeft ||
      left + CARD_W > scroll.scrollLeft + scroll.clientWidth
    ) {
      scroll.scrollTo({ left: Math.max(0, left - 24), behavior: "smooth" });
      setTimeout(updateMinimap, 320);
    }
  }

  function updateCardText(id: string) {
    const card = host.querySelector<HTMLElement>(`[data-node-row="${id}"]`);
    const index = indexOf(id);
    const spec = specs[index];
    if (!card || !spec) return;
    card.querySelector(".node-name")!.textContent = spec.name || "未命名节点";
    card.querySelector(".node-time")!.textContent =
      `${dayLabel(spec.start)}${timeLabel(spec.start)} – ${dayLabel(spec.end)}${timeLabel(spec.end)}`;
  }

  host.addEventListener("click", (event) => {
    const target = event.target as Element;
    const add = target.closest<HTMLElement>("[data-add-node]");
    if (add) {
      insertAt(Number(add.dataset.addNode));
      return;
    }
    const remove = target.closest<HTMLElement>("[data-remove-node]");
    if (remove) {
      deleteAt(
        remove.closest<HTMLElement>("[data-node-row]")!.dataset.nodeRow!,
      );
      return;
    }
    const move = target.closest<HTMLElement>("[data-move-node]");
    if (move && selected) {
      const index = indexOf(selected);
      moveTo(index, index + Number(move.dataset.moveNode));
      return;
    }
    const card = target.closest<HTMLElement>("[data-node-row]");
    if (card) {
      selected = card.dataset.nodeRow!;
      render();
      return;
    }
    const mini = target.closest<HTMLElement>("[data-mini-node]");
    if (mini) {
      selected = specs[Number(mini.dataset.miniNode)]?.id ?? selected;
      const scroll = host.querySelector<HTMLElement>("[data-node-scroll]");
      const lane = host.querySelector<HTMLElement>(".node-lane");
      if (scroll && lane)
        scroll.scrollTo({
          left:
            (x(Number(mini.dataset.miniNode)) / lane.offsetWidth) *
            lane.offsetWidth,
          behavior: "smooth",
        });
      render();
      setTimeout(updateMinimap, 320);
    }
  });

  host.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    const key = input.dataset?.nodeField;
    if (!key || !selected) return;
    const spec = specs[indexOf(selected)];
    if (!spec) return;
    if (key === "confirmationRequired")
      spec.confirmationRequired = input.checked;
    else if (key === "requiredTasks") spec.requiredTasks = Number(input.value);
    else if (key === "name") spec.name = input.value;
    else if (key === "start") spec.start = input.value;
    else if (key === "end") {
      if (spec.signal && spec.signal.at === spec.end)
        spec.signal.at = input.value;
      spec.end = input.value;
    } else if (key === "signalKind") {
      if (input.value === "none") {
        spec.signal = null;
        spec.blockSuccess = "never";
        spec.blockFailure = "never";
      } else
        spec.signal = {
          kind: input.value as "success" | "failure" | "check",
          direction:
            input.value === "check"
              ? "head"
              : (spec.signal?.direction ?? "head"),
          at: spec.signal?.at ?? spec.end,
          condition:
            input.value === "check"
              ? "always"
              : (spec.signal?.condition ?? "always"),
        };
    } else if (key === "signalAt" && spec.signal) spec.signal.at = input.value;
    else if (key === "direction" && spec.signal)
      spec.signal.direction = input.value as "head" | "tail";
    else if (key === "condition" && spec.signal)
      spec.signal.condition = input.value as
        "always" | "completed" | "incomplete";
    else if (key === "blockSuccess")
      spec.blockSuccess = input.value as BlockRule;
    else if (key === "blockFailure")
      spec.blockFailure = input.value as BlockRule;
    // Selects rebuild the graph so badges and controls follow; free text stays in
    // place so an in-progress datetime never loses focus mid-edit.
    if (
      [
        "signalKind",
        "direction",
        "condition",
        "blockSuccess",
        "blockFailure",
      ].includes(key)
    )
      render();
    else {
      updateInspectorState();
      if (["name", "start", "end"].includes(key)) updateCardText(selected);
    }
  });

  host.addEventListener("change", () => updateInspectorState());
  host.addEventListener("scroll", () => updateMinimap(), {
    capture: true,
    passive: true,
  });
  host.addEventListener("dragover", (event) => {
    if ((event.target as Element).closest("[data-node-row]"))
      event.preventDefault();
  });
  host.addEventListener("drop", (event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      "[data-node-row]",
    );
    const moving = host.querySelector<HTMLElement>("[data-node-row].dragging");
    if (!target || !moving) return;
    event.preventDefault();
    moveTo(indexOf(moving.dataset.nodeRow!), indexOf(target.dataset.nodeRow!));
  });
  let dragging: HTMLElement | null = null;
  host.addEventListener("dragstart", (event) => {
    const card = (event.target as Element).closest<HTMLElement>(
      "[data-node-row]",
    );
    if (!card) return;
    dragging = card;
    card.classList.add("dragging");
  });
  host.addEventListener("dragend", () => {
    dragging?.classList.remove("dragging");
    dragging = null;
  });

  render();
  return {
    getSpecs: () => specs,
    refresh: () => render(),
  };
}
