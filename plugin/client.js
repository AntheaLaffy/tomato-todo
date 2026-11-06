// Client half of @local/tomato-dsh (v2).
//
// Two surfaces, both driven by the same tiny external store:
//   1. conversation.composer.dock — a compact entry card: runtime health dot,
//      today's due count / focus minutes (GET /health + /api/today, polled),
//      and the button that opens the panel.
//   2. shell.overlay — the full-screen panel (id tomato-panel). The overlay
//      layer is click-through, so the panel root opts back into pointer
//      events and closes on mask click / Escape, matching host modal behavior.
//
// Why plain React.createElement and no @deepseek-ai/dsh-* imports: dynamic
// client halves run against the browser module table without type checks;
// a thrown component blanks the slot entry, so we depend only on the stable
// `react` baseline import and theme tokens (--dsw-alias-*). Literal colors
// appear only in artwork (the tomato mark, the timer ring).
window.__ModuleLoader__.load({
  id: '@local/tomato-dsh',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const API_BASE = 'http://127.0.0.1:43987';

    // ---- copy (locale prefix match, zh wins on `zh*`) ----
    const COPY = {
      zh: {
        title: '番茄 Todo',
        dockOk: '运行时在线',
        dockOff: '运行时离线',
        dockDue: '今日待办 {n} 件',
        dockFocus: '今日投入 {n} 分钟',
        dockNoData: '等待运行时数据…',
        dockHint: '请启动 tomato-runtime（--serve），卡片会自动恢复',
        open: '打开番茄 Todo',
        panelFocus: '今日专注',
        panelTasks: '全部任务',
        panelStats: '统计',
        panelSettings: '设置',
        close: '关闭',
        loading: '加载中…',
        connError: '无法连接番茄运行时（127.0.0.1:43987）',
        retry: '重试',
        modeFocus: '专注',
        modeShortBreak: '短休息',
        modeLongBreak: '长休息',
        running: '进行中',
        paused: '已暂停',
        idle: '未开始',
        start: '开始',
        pause: '暂停',
        stop: '停止',
        todayTasks: '今日任务',
        todayEmpty: '今天没有待办任务',
        writeFailed: '写入失败，请确认运行时可用',
        newPlaceholder: '新任务标题，回车添加',
        dueLabel: '截止 {date}',
        completedCount: '已完成 {n} 件',
        noTasks: '还没有任务，先加一件吧',
        untitled: '（无标题）',
        statTodayMin: '今日投入',
        statTodayPomo: '今日番茄',
        statStreak: '连续天数',
        statTotal: '累计投入',
        minutes: '{n} 分钟',
        hours: '{n} 小时',
        week: '近七天（分钟）',
        noStats: '暂无统计，专注一次后这里会出现数据',
        dataDir: '数据目录',
        runtime: '运行时',
        guard: '专注保护',
        runningYes: '运行中',
        notConnected: '未连接',
        guardNone: '未接入 guard（运行时未启动或 guard 未运行）',
        locked: '已锁定',
        unlocked: '未锁定',
        whitelist: '白名单 {n} 个',
        pid: 'PID {pid}',
        days: ['日', '一', '二', '三', '四', '五', '六'],
      },
      en: {
        title: 'Tomato Todo',
        dockOk: 'Runtime online',
        dockOff: 'Runtime offline',
        dockDue: '{n} tasks due today',
        dockFocus: '{n} min focused today',
        dockNoData: 'Waiting for runtime data…',
        dockHint: 'Start tomato-runtime (--serve) and the card recovers',
        open: 'Open Tomato Todo',
        panelFocus: "Today's focus",
        panelTasks: 'All tasks',
        panelStats: 'Stats',
        panelSettings: 'Settings',
        close: 'Close',
        loading: 'Loading…',
        connError: 'Cannot reach the tomato runtime (127.0.0.1:43987)',
        retry: 'Retry',
        modeFocus: 'Focus',
        modeShortBreak: 'Short break',
        modeLongBreak: 'Long break',
        running: 'Running',
        paused: 'Paused',
        idle: 'Idle',
        start: 'Start',
        pause: 'Pause',
        stop: 'Stop',
        todayTasks: "Today's tasks",
        todayEmpty: 'Nothing due today',
        writeFailed: 'Write failed, check that the runtime is running',
        newPlaceholder: 'New task, press Enter',
        dueLabel: 'Due {date}',
        completedCount: '{n} completed',
        noTasks: 'No tasks yet',
        untitled: '(untitled)',
        statTodayMin: 'Focused today',
        statTodayPomo: 'Pomodoros today',
        statStreak: 'Day streak',
        statTotal: 'Total focus',
        minutes: '{n} min',
        hours: '{n} h',
        week: 'Last 7 days (min)',
        noStats: 'No stats yet',
        dataDir: 'Data directory',
        runtime: 'Runtime',
        guard: 'Focus guard',
        runningYes: 'Running',
        notConnected: 'Not connected',
        guardNone: 'No guard (runtime stopped or guard not running)',
        locked: 'Locked',
        unlocked: 'Unlocked',
        whitelist: '{n} allowlisted',
        pid: 'PID {pid}',
        days: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      },
    };

    function t(copy, key, vars) {
      let text = copy[key] !== undefined ? copy[key] : key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) text = text.split('{' + k + '}').join(String(v));
      }
      return text;
    }

    // Same discovery pattern as v1: the client locale service publishes a
    // snapshot whose `active` field is the locale id.
    function pickCopy(ctx) {
      let active = '';
      const locale = ctx.get ? ctx.get('locale') : null;
      if (locale && typeof locale.getLocale === 'function') {
        const snapshot = locale.getLocale();
        active = String((snapshot && (snapshot.active || snapshot.locale)) || '');
      }
      return active.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
    }

    // ---- theme tokens (only --dsw-alias-*; literal colors are artwork) ----
    const T = {
      text: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      text3: 'var(--dsw-alias-label-tertiary)',
      base: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      brand: 'var(--dsw-alias-brand-primary)',
      brandInvert: 'var(--dsw-alias-brand-primary-invert)',
      success: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
    };

    // ---- runtime plumbing ----

    // Prefer the client `timer` mixin (ctx.interval, disposed with the fiber);
    // fall back to setInterval wrapped in ctx.effect for older contexts.
    function every(ctx, ms, fn) {
      if (typeof ctx.interval === 'function') return ctx.interval(fn, ms);
      return ctx.effect(() => {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
      });
    }

    async function fetchJson(url, opts = {}) {
      const { method = 'GET', body, timeoutMs = 6000 } = opts;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          signal: controller.signal,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    }

    const sendJson = (path, method, body) => fetchJson(API_BASE + path, { method, body });

    // Two slot entries cannot share React state through a common parent, so
    // the dock card and the panel talk through one per-apply external store.
    function makeStore(initial = false) {
      let value = initial;
      const listeners = new Set();
      return {
        get: () => value,
        set: (next) => {
          if (next === value) return;
          value = next;
          for (const l of listeners) l(value);
        },
        subscribe: (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
      };
    }

    function useStoreValue(store) {
      const [value, setValue] = useState(store.get());
      useEffect(() => store.subscribe(setValue), [store]);
      return value;
    }

    // ---- data normalization ----
    // The runtime workflow owns the endpoint shapes (API.md + README); these
    // narrowers keep the UI readable even while those shapes settle.

    function normalizeGuard(g) {
      if (!g || typeof g !== 'object') return null;
      return {
        available: g.available !== false,
        backend: typeof g.backend === 'string' ? g.backend : null,
        message: typeof g.message === 'string' ? g.message : null,
        locked: g.locked === true,
        whitelist: Array.isArray(g.whitelist) ? g.whitelist : [],
        pid: typeof g.pid === 'number' ? g.pid : null,
      };
    }

    function normalizeHealth(p) {
      if (!p || typeof p !== 'object') return null;
      return {
        ok: p.ok !== false,
        version: typeof p.version === 'string' ? p.version : null,
        service: typeof p.service === 'string' ? p.service : null,
        dataDir: typeof p.dataDir === 'string' ? p.dataDir : null,
        guard: normalizeGuard(p.guard),
      };
    }

    function normalizeToday(p) {
      if (!p || typeof p !== 'object') {
        return { today: null, dueCount: null, focusMinutes: null, tasks: null, timer: null };
      }
      const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
      const today = typeof p.today === 'string' ? p.today : null;
      const dueCount =
        typeof p.dueCount === 'number'
          ? p.dueCount
          : Array.isArray(p.tasks)
            ? p.tasks.filter((tk) => !tk.completed).length
            : null;
      let focusMinutes = null;
      if (typeof p.focusMinutes === 'number') focusMinutes = p.focusMinutes;
      else if (typeof p.todaySeconds === 'number') focusMinutes = Math.round(p.todaySeconds / 60);
      else if (typeof stats.todaySeconds === 'number') focusMinutes = Math.round(stats.todaySeconds / 60);
      return {
        today,
        dueCount,
        focusMinutes,
        tasks: Array.isArray(p.tasks) ? p.tasks : null,
        timer: p.timer && typeof p.timer === 'object' ? p.timer : null,
      };
    }

    function normalizeSnapshot(s) {
      const data = s && typeof s === 'object' && s.data ? s.data : {};
      const stats = s && typeof s === 'object' && s.stats ? s.stats : {};
      return {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        timer: data.timer && typeof data.timer === 'object' ? data.timer : null,
        stats,
        today: s && typeof s.today === 'string' ? s.today : null,
      };
    }

    // ---- shared pieces ----

    // The tomato mark is the project's artwork; its colors are literal by design.
    function TomatoIcon({ size = 22 }) {
      return h('svg', { viewBox: '0 0 512 512', width: size, height: size, 'aria-hidden': true }, [
        h('path', {
          key: 'body',
          d: 'M253 156C109 85 67 219 106 333c26 77 108 106 150 67 44 37 135 1 151-76 34-134-33-228-154-168Z',
          fill: '#d96d55',
        }),
        h('path', { key: 'leaf', d: 'm255 171-71-51 70 20 52-57-14 68 64 10-82 20', fill: '#80947b' }),
        h('path', {
          key: 'shine',
          d: 'M153 235c-9 35-1 64 12 80',
          fill: 'none',
          stroke: '#fffaf4',
          strokeOpacity: 0.8,
          strokeWidth: 22,
          strokeLinecap: 'round',
        }),
      ]);
    }

    function StatusDot({ ok, size = 8 }) {
      return h('span', {
        'aria-hidden': true,
        style: {
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          background: ok ? T.success : T.warn,
        },
      });
    }

    const dockCardStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderRadius: 12,
      border: `1px solid ${T.border1}`,
      background: T.layer1,
      color: T.text,
      fontSize: 13,
      lineHeight: 1.5,
      marginTop: 8,
    };
    const dockIconStyle = {
      width: 30,
      height: 30,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: T.layer2,
      flexShrink: 0,
    };
    const dockOpenStyle = {
      flexShrink: 0,
      border: 'none',
      cursor: 'pointer',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 12,
      fontWeight: 600,
      background: T.brand,
      color: T.brandInvert,
    };

    // ---- 1. composer.dock entry card ----
    function DockCard({ copy, every, store }) {
      const [health, setHealth] = useState(null);
      const [today, setToday] = useState(null);
      const [error, setError] = useState(null);

      // Poll both endpoints on one 30s clock. The first load runs immediately
      // so the card is right even if the runtime started before this session.
      useEffect(() => {
        let alive = true;
        const load = () => {
          fetchJson(API_BASE + '/health', { timeoutMs: 4000 })
            .then((d) => {
              if (alive) {
                setHealth(d);
                setError(null);
              }
            })
            .catch((e) => {
              if (alive) setError(e);
            });
          fetchJson(API_BASE + '/api/today', { timeoutMs: 4000 })
            .then((d) => {
              if (alive) setToday(d);
            })
            .catch(() => {
              if (alive) setToday(null);
            });
        };
        load();
        const stop = every(load, 30000);
        return () => {
          alive = false;
          if (typeof stop === 'function') stop();
        };
      }, [every]);

      const online = !!health;
      const tdy = normalizeToday(today);
      const parts = [];
      if (tdy.dueCount != null) parts.push(t(copy, 'dockDue', { n: tdy.dueCount }));
      if (tdy.focusMinutes != null) parts.push(t(copy, 'dockFocus', { n: tdy.focusMinutes }));
      const statLine = parts.length > 0
        ? parts.join(' · ')
        : online
          ? t(copy, 'dockNoData')
          : t(copy, 'dockHint');

      return h('div', { style: dockCardStyle }, [
        h('div', { key: 'icon', style: dockIconStyle, 'aria-hidden': true }, h(TomatoIcon, { size: 22 })),
        h('div', { key: 'main', style: { flex: 1, minWidth: 0 } }, [
          h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
            h(StatusDot, { key: 'dot', ok: online }),
            h('span', { key: 'title', style: { fontWeight: 600 } }, copy.title),
            h('span', {
              key: 'chip',
              style: {
                padding: '1px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 500,
                background: online
                  ? 'var(--dsw-alias-state-success-tertiary)'
                  : 'var(--dsw-alias-state-warn-tertiary)',
                color: T.text,
              },
            }, online ? t(copy, 'dockOk') : t(copy, 'dockOff')),
          ]),
          h('div', {
            key: 'line',
            style: {
              marginTop: 2,
              color: online ? T.text2 : T.warn,
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }, statLine),
        ]),
        h('button', { key: 'open', style: dockOpenStyle, onClick: () => store.set(true) }, copy.open),
      ]);
    }

    // ---- 2. shell.overlay panel (frame; tab bodies below) ----
    const maskStyle = {
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      pointerEvents: 'auto', // the overlay layer is click-through; we opt back in
      background: 'var(--dsw-alias-bg-mask-1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      boxSizing: 'border-box',
    };
    const panelStyle = {
      width: 'min(920px, 100%)',
      height: 'min(88vh, 780px)',
      display: 'flex',
      flexDirection: 'column',
      background: T.base,
      border: `1px solid ${T.border1}`,
      borderRadius: 16,
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
      overflow: 'hidden',
    };
    const panelHeaderStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 18px',
      borderBottom: `1px solid ${T.border2}`,
    };
    const panelCloseStyle = {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: T.text2,
      fontSize: 20,
      lineHeight: 1,
      width: 28,
      height: 28,
      borderRadius: 6,
    };
    const tabBarStyle = {
      display: 'flex',
      gap: 4,
      padding: '8px 14px 0',
      borderBottom: `1px solid ${T.border2}`,
    };
    const tabBtnStyle = (active) => ({
      border: 'none',
      background: active ? T.layer2 : 'transparent',
      color: active ? T.brand : T.text2,
      padding: '8px 14px',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      borderBottom: `2px solid ${active ? T.brand : 'transparent'}`,
      marginBottom: -1,
    });
    const panelBodyStyle = { flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 };

    function TomatoPanel({ copy, every, store }) {
      const open = useStoreValue(store);
      const [tab, setTab] = useState('focus');
      const [snapshot, setSnapshot] = useState(null);
      const [health, setHealth] = useState(null);
      const [connError, setConnError] = useState(null);
      const refreshRef = useRef(null);

      // Poll only while the panel is open: snapshot every 5s keeps the timer
      // ring ticking, health every 30s feeds the settings tab. Unmounting on
      // close disposes both timers through `every`.
      useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        const loadSnapshot = () =>
          fetchJson(API_BASE + '/api/snapshot', { timeoutMs: 4000 })
            .then((d) => {
              if (alive) {
                setSnapshot(d);
                setConnError(null);
              }
            })
            .catch((e) => {
              if (alive) setConnError(e);
            });
        const loadHealth = () =>
          fetchJson(API_BASE + '/health', { timeoutMs: 4000 })
            .then((d) => {
              if (alive) setHealth(d);
            })
            .catch(() => {
              if (alive) setHealth(null);
            });
        refreshRef.current = loadSnapshot;
        loadSnapshot();
        loadHealth();
        const stopSnap = every(loadSnapshot, 5000);
        const stopHealth = every(loadHealth, 30000);
        return () => {
          alive = false;
          refreshRef.current = null;
          stopSnap();
          stopHealth();
        };
      }, [open, every]);

      // Escape closes, like the host modals (ui practice: keep familiar behavior).
      useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
          if (e.key === 'Escape') store.set(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [open, store]);

      const refresh = useCallback(() => {
        if (refreshRef.current) refreshRef.current();
      }, []);

      if (!open) return null;

      const snap = normalizeSnapshot(snapshot);
      const hlt = normalizeHealth(health);
      const tabs = [
        { id: 'focus', label: t(copy, 'panelFocus') },
        { id: 'tasks', label: t(copy, 'panelTasks') },
        { id: 'stats', label: t(copy, 'panelStats') },
        { id: 'settings', label: t(copy, 'panelSettings') },
      ];

      return h('div', { style: maskStyle, onClick: () => store.set(false) }, [
        h('div', { key: 'panel', style: panelStyle, onClick: (e) => e.stopPropagation() }, [
          h('div', { key: 'header', style: panelHeaderStyle }, [
            h('div', { key: 'brand', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
              h(TomatoIcon, { key: 'icon', size: 26 }),
              h('span', { key: 'title', style: { fontSize: 16, fontWeight: 700, color: T.text } }, copy.title),
            ]),
            h('button', {
              key: 'close',
              style: panelCloseStyle,
              'aria-label': t(copy, 'close'),
              onClick: () => store.set(false),
            }, '×'),
          ]),
          h('div', { key: 'tabs', style: tabBarStyle }, tabs.map((tb) =>
            h('button', { key: tb.id, style: tabBtnStyle(tb.id === tab), onClick: () => setTab(tb.id) }, tb.label),
          )),
          h('div', { key: 'body', style: panelBodyStyle }, [
            connError && !snapshot
              ? h('div', { key: 'err', style: { display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, background: 'var(--dsw-alias-state-error-tertiary)' } }, [
                  h('span', { key: 'msg', style: { color: T.error, fontSize: 13 } }, t(copy, 'connError')),
                  h('button', {
                    key: 'retry',
                    style: { ...dockOpenStyle, flexShrink: 0 },
                    onClick: refresh,
                  }, t(copy, 'retry')),
                ])
              : null,
            !snapshot
              ? h('div', { key: 'loading', style: { color: T.text2, fontSize: 13, padding: 8 } }, t(copy, 'loading'))
              : tab === 'focus'
                ? h(FocusTab, { key: 'focus', copy, snap, refresh, every })
                : tab === 'tasks'
                  ? h(TasksTab, { key: 'tasks', copy, snap, refresh })
                  : tab === 'stats'
                    ? h(StatsTab, { key: 'stats', copy, snap, every })
                    : h(SettingsTab, { key: 'settings', copy, hlt, every }),
          ]),
        ]),
      ]);
    }

    // ---- tab bodies (spliced from plugin/src-client/tabs-a.js and tabs-b.js; see src-client/README.md) ----

// src-client splice source: FocusTab + TasksTab tab bodies (contract in src-client/README.md).

Object.assign(COPY.zh, {
  // ---- FocusTab (fa_) ----
  fa_loading: '加载中…',
  fa_loadFailed: '读取今日数据失败，稍后自动重试',
  fa_modeFocus: '专注',
  fa_modeShort: '短休息',
  fa_modeLong: '长休息',
  fa_running: '进行中',
  fa_paused: '已暂停',
  fa_idle: '未开始',
  fa_start: '开始',
  fa_resume: '继续',
  fa_pause: '暂停',
  fa_stop: '停止',
  fa_cycle: '第 {n} 轮',
  fa_writeFailed: '写入失败，请确认运行时可用',
  fa_statDueLabel: '今日待办',
  fa_statFocusLabel: '今日投入（分钟）',
  fa_todayTasks: '今日任务',
  fa_todayEmpty: '今天没有待办任务',
  fa_due: '截止 {date}',
  fa_remind: '提醒 {time}',
  fa_untitled: '（无标题）',
  // ---- TasksTab (ta_) ----
  ta_newPlaceholder: '新任务标题，回车添加',
  ta_add: '添加',
  ta_writeFailed: '写入失败，请确认运行时可用',
  ta_empty: '还没有任务，先加一件吧',
  ta_due: '截止 {date}',
  ta_untitled: '（无标题）',
  ta_markDone: '标记完成',
});

Object.assign(COPY.en, {
  // ---- FocusTab (fa_) ----
  fa_loading: 'Loading…',
  fa_loadFailed: "Couldn't read today's data; retrying automatically",
  fa_modeFocus: 'Focus',
  fa_modeShort: 'Short break',
  fa_modeLong: 'Long break',
  fa_running: 'Running',
  fa_paused: 'Paused',
  fa_idle: 'Idle',
  fa_start: 'Start',
  fa_resume: 'Resume',
  fa_pause: 'Pause',
  fa_stop: 'Stop',
  fa_cycle: 'Round {n}',
  fa_writeFailed: 'Write failed, check that the runtime is running',
  fa_statDueLabel: 'Due today',
  fa_statFocusLabel: 'Focused (min)',
  fa_todayTasks: "Today's tasks",
  fa_todayEmpty: 'Nothing due today',
  fa_due: 'Due {date}',
  fa_remind: 'Remind {time}',
  fa_untitled: '(untitled)',
  // ---- TasksTab (ta_) ----
  ta_newPlaceholder: 'New task, press Enter',
  ta_add: 'Add',
  ta_writeFailed: 'Write failed, check that the runtime is running',
  ta_empty: 'No tasks yet',
  ta_due: 'Due {date}',
  ta_untitled: '(untitled)',
  ta_markDone: 'Mark as done',
});

// ---------------------------------------------------------------- FocusTab (fa_)

const FA_DEFAULT_SECONDS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

function fa_num(x) {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function fa_mode_of(m) {
  const s = typeof m === 'string' ? m.toLowerCase() : '';
  if (s === 'short' || s === 'shortbreak' || s === 'short_break' || s === 'break') return 'short';
  if (s === 'long' || s === 'longbreak' || s === 'long_break') return 'long';
  return 'focus';
}

// Tolerant narrow: the timer shape is not finalized, so accept several field
// spellings (remainingSeconds|remaining|secondsLeft, totalSeconds|duration)
// and fall back to sane per-mode defaults when fields are missing.
function fa_timer(t) {
  const out = { status: 'idle', mode: 'focus', remaining: FA_DEFAULT_SECONDS.focus, total: FA_DEFAULT_SECONDS.focus, cycle: null };
  if (!t || typeof t !== 'object') return out;
  const st = typeof t.status === 'string' ? t.status.toLowerCase() : '';
  out.status =
    st === 'running' || st === 'active' || st === 'started'
      ? 'running'
      : st === 'paused'
        ? 'paused'
        : 'idle';
  out.mode = fa_mode_of(t.mode);
  let remaining = fa_num(t.remainingSeconds);
  if (remaining == null) remaining = fa_num(t.remaining);
  if (remaining == null) remaining = fa_num(t.secondsLeft);
  let total = fa_num(t.totalSeconds);
  if (total == null) total = fa_num(t.duration);
  if (total == null) total = fa_num(t.durationSeconds);
  if (total == null || total <= 0) total = FA_DEFAULT_SECONDS[out.mode] || FA_DEFAULT_SECONDS.focus;
  if (remaining == null) remaining = total;
  out.remaining = Math.min(total, Math.max(0, remaining));
  out.total = total;
  let cycle = fa_num(t.cycle);
  if (cycle == null) cycle = fa_num(t.round);
  out.cycle = Number.isInteger(cycle) && cycle >= 1 ? cycle : null;
  return out;
}

function fa_task(tk) {
  if (!tk || typeof tk !== 'object') return null;
  const title =
    typeof tk.title === 'string' && tk.title.trim() !== ''
      ? tk.title
      : typeof tk.name === 'string' && tk.name.trim() !== ''
        ? tk.name
        : null;
  return {
    id: tk.id != null ? String(tk.id) : null,
    title,
    completed: tk.completed === true || tk.done === true,
    due: typeof tk.dueDate === 'string' ? tk.dueDate : typeof tk.due_date === 'string' ? tk.due_date : null,
    reminder:
      typeof tk.reminderTime === 'string'
        ? tk.reminderTime
        : typeof tk.remindAt === 'string'
          ? tk.remindAt
          : null,
  };
}

function fa_mmss(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function fa_taskMeta(copy, tk) {
  if (tk.due) return t(copy, 'fa_due', { date: tk.due });
  if (tk.reminder) return t(copy, 'fa_remind', { time: tk.reminder });
  return null;
}

const fa_safe = (fn) => () => {
  try {
    fn();
  } catch (err) {
    // event handlers must not throw
  }
};

// Timer ring artwork: track uses the theme border token, the progress arc is
// the project's literal tomato red (allowed for artwork only).
function fa_ring(timer) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const frac = timer.total > 0 ? Math.min(1, Math.max(0, timer.remaining / timer.total)) : 0;
  const children = [
    h('circle', { key: 'track', cx: 64, cy: 64, r: R, fill: 'none', stroke: T.border2, strokeWidth: 9 }),
  ];
  if (frac > 0) {
    children.push(
      h('circle', {
        key: 'arc',
        cx: 64,
        cy: 64,
        r: R,
        fill: 'none',
        stroke: '#d96d55',
        strokeWidth: 9,
        strokeLinecap: 'round',
        strokeDasharray: String(C),
        strokeDashoffset: String(C * (1 - frac)),
        transform: 'rotate(-90 64 64)',
      }),
    );
  }
  return h('svg', { viewBox: '0 0 128 128', width: 136, height: 136, 'aria-hidden': true }, children);
}

const fa_rootStyle = { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' };
const fa_cardStyle = { background: T.layer1, border: '1px solid ' + T.border1, borderRadius: 12, padding: 16 };
const fa_timerCardStyle = {
  ...fa_cardStyle,
  width: 240,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
};
const fa_ringStyle = { position: 'relative', width: 136, height: 136 };
const fa_ringTextStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  gap: 2,
};
const fa_chipRowStyle = { display: 'flex', alignItems: 'center', gap: 8 };
const fa_chipStyle = (bg, color) => ({
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  background: bg,
  color: color || T.text,
});
const fa_btnRowStyle = { display: 'flex', gap: 8, marginTop: 2 };
const fa_btnBase = { border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600 };
const fa_btnPrimary = (disabled) => ({
  ...fa_btnBase,
  background: T.brand,
  color: T.brandInvert,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});
const fa_btnGhost = (disabled) => ({
  ...fa_btnBase,
  background: T.layer2,
  color: T.text,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});
const fa_btnPlain = (disabled) => ({
  ...fa_btnBase,
  background: 'transparent',
  border: '1px solid ' + T.border1,
  color: T.text2,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});
const fa_errorStyle = { color: T.error, fontSize: 12 };
const fa_statRowStyle = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const fa_statCardStyle = {
  flex: 1,
  minWidth: 120,
  background: T.layer1,
  border: '1px solid ' + T.border1,
  borderRadius: 12,
  padding: '12px 14px',
};
const fa_statValueStyle = { fontSize: 20, fontWeight: 700, color: T.text };
const fa_statLabelStyle = { fontSize: 12, color: T.text2, marginTop: 2 };
const fa_listCardStyle = { ...fa_cardStyle, flex: 1, minWidth: 260 };
const fa_listHeadStyle = { fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 };
const fa_taskRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '6px 0',
};

function FocusTab({ copy, snap, refresh, every }) {
  const [todayRaw, setTodayRaw] = useState(null);
  const [faFetchFailed, setFaFetchFailed] = useState(false);
  const [faBusy, setFaBusy] = useState(null); // 'start' | 'pause' | 'stop' | null
  const [faError, setFaError] = useState(false);

  const fa_load = useCallback(() => {
    fetchJson(API_BASE + '/api/today', { timeoutMs: 4000 })
      .then((d) => {
        setTodayRaw(d);
        setFaFetchFailed(false);
      })
      .catch(() => setFaFetchFailed(true));
  }, []);

  useEffect(() => {
    fa_load();
    const stop = every(fa_load, 3000);
    return () => {
      if (typeof stop === 'function') stop();
    };
  }, [fa_load, every]);

  const fa_send = (action) => {
    if (faBusy) return;
    setFaBusy(action);
    sendJson('/api/focus/' + action, 'POST', {})
      .then(() => {
        setFaError(false);
        refresh();
        fa_load();
      })
      .catch(() => setFaError(true))
      .finally(() => setFaBusy(null));
  };

  if (todayRaw == null) {
    return h(
      'div',
      { style: { color: faFetchFailed ? T.error : T.text2, fontSize: 13, padding: 8 } },
      t(copy, faFetchFailed ? 'fa_loadFailed' : 'fa_loading'),
    );
  }

  const tdy = normalizeToday(todayRaw);
  const timer = fa_timer(tdy.timer);
  const todayTasks = Array.isArray(tdy.tasks) ? tdy.tasks.map(fa_task).filter((tk) => tk !== null) : [];
  const statusLabel =
    timer.status === 'running' ? t(copy, 'fa_running') : timer.status === 'paused' ? t(copy, 'fa_paused') : t(copy, 'fa_idle');
  const modeLabel =
    timer.mode === 'short' ? t(copy, 'fa_modeShort') : timer.mode === 'long' ? t(copy, 'fa_modeLong') : t(copy, 'fa_modeFocus');
  const statusBg =
    timer.status === 'running'
      ? 'var(--dsw-alias-state-success-tertiary)'
      : timer.status === 'paused'
        ? 'var(--dsw-alias-state-warn-tertiary)'
        : T.layer2;
  const busy = faBusy !== null;
  const startLabel = timer.status === 'paused' ? t(copy, 'fa_resume') : t(copy, 'fa_start');

  const stats = [];
  if (tdy.dueCount != null) {
    stats.push(
      h('div', { key: 'due', style: fa_statCardStyle }, [
        h('div', { key: 'v', style: fa_statValueStyle }, String(tdy.dueCount)),
        h('div', { key: 'l', style: fa_statLabelStyle }, t(copy, 'fa_statDueLabel')),
      ]),
    );
  }
  if (tdy.focusMinutes != null) {
    stats.push(
      h('div', { key: 'focus', style: fa_statCardStyle }, [
        h('div', { key: 'v', style: fa_statValueStyle }, String(tdy.focusMinutes)),
        h('div', { key: 'l', style: fa_statLabelStyle }, t(copy, 'fa_statFocusLabel')),
      ]),
    );
  }

  return h('div', { style: fa_rootStyle }, [
    h('div', { key: 'timer', style: fa_timerCardStyle }, [
      h('div', { key: 'ring', style: fa_ringStyle }, [
        fa_ring(timer),
        h('div', { key: 'text', style: fa_ringTextStyle }, [
          h(
            'div',
            { key: 'clock', style: { fontSize: 26, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' } },
            fa_mmss(timer.remaining),
          ),
          h('div', { key: 'sub', style: { fontSize: 11, color: T.text3 } }, statusLabel),
        ]),
      ]),
      h('div', { key: 'chips', style: fa_chipRowStyle }, [
        h('span', { key: 'mode', style: fa_chipStyle(T.layer2) }, modeLabel),
        timer.cycle != null
          ? h('span', { key: 'cycle', style: fa_chipStyle(T.layer2, T.text2) }, t(copy, 'fa_cycle', { n: timer.cycle }))
          : null,
      ]),
      h('div', { key: 'btns', style: fa_btnRowStyle }, [
        h(
          'button',
          {
            key: 'start',
            style: fa_btnPrimary(busy || timer.status === 'running'),
            disabled: busy || timer.status === 'running',
            onClick: fa_safe(() => fa_send('start')),
          },
          busy && faBusy === 'start' ? startLabel + '…' : startLabel,
        ),
        h(
          'button',
          {
            key: 'pause',
            style: fa_btnGhost(busy || timer.status !== 'running'),
            disabled: busy || timer.status !== 'running',
            onClick: fa_safe(() => fa_send('pause')),
          },
          busy && faBusy === 'pause' ? t(copy, 'fa_pause') + '…' : t(copy, 'fa_pause'),
        ),
        h(
          'button',
          {
            key: 'stop',
            style: fa_btnPlain(busy || timer.status === 'idle'),
            disabled: busy || timer.status === 'idle',
            onClick: fa_safe(() => fa_send('stop')),
          },
          busy && faBusy === 'stop' ? t(copy, 'fa_stop') + '…' : t(copy, 'fa_stop'),
        ),
      ]),
      faError ? h('div', { key: 'err', style: fa_errorStyle }, t(copy, 'fa_writeFailed')) : null,
    ]),
    h('div', { key: 'side', style: { flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 } }, [
      stats.length > 0 ? h('div', { key: 'stats', style: fa_statRowStyle }, stats) : null,
      h('div', { key: 'tasks', style: fa_listCardStyle }, [
        h('div', { key: 'head', style: fa_listHeadStyle }, t(copy, 'fa_todayTasks')),
        todayTasks.length === 0
          ? h('div', { key: 'empty', style: { color: T.text2, fontSize: 13, paddingTop: 4 } }, t(copy, 'fa_todayEmpty'))
          : todayTasks.map((tk, i) =>
              h(
                'div',
                {
                  key: tk.id != null ? 't' + tk.id : 't' + i,
                  style: i > 0 ? { ...fa_taskRowStyle, borderTop: '1px solid ' + T.border2 } : fa_taskRowStyle,
                },
                [
                  h(
                    'span',
                    {
                      key: 'title',
                      style: {
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        color: tk.completed ? T.text3 : T.text,
                        textDecoration: tk.completed ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    },
                    tk.title != null ? tk.title : t(copy, 'fa_untitled'),
                  ),
                  fa_taskMeta(copy, tk) != null
                    ? h('span', { key: 'meta', style: { fontSize: 11, color: T.text3, flexShrink: 0 } }, fa_taskMeta(copy, tk))
                    : null,
                ],
              ),
            ),
      ]),
    ]),
  ]);
}

// ---------------------------------------------------------------- TasksTab (ta_)

function ta_task(tk) {
  if (!tk || typeof tk !== 'object') return null;
  const title =
    typeof tk.title === 'string' && tk.title.trim() !== ''
      ? tk.title
      : typeof tk.name === 'string' && tk.name.trim() !== ''
        ? tk.name
        : null;
  return {
    id: tk.id != null ? String(tk.id) : null,
    title,
    completed: tk.completed === true || tk.done === true,
    due: typeof tk.dueDate === 'string' ? tk.dueDate : typeof tk.due_date === 'string' ? tk.due_date : null,
    project: typeof tk.project === 'string' && tk.project.trim() !== '' ? tk.project : null,
    reminder: typeof tk.reminderTime === 'string' ? tk.reminderTime : null,
  };
}

// Incomplete first; within each group sort by due date ascending, tasks
// without a due date last (Array#sort is stable, so ties keep source order).
function ta_sort(list) {
  const arr = list.slice();
  const dueKey = (tk) => (tk.due ? tk.due : '\uffff');
  arr.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = dueKey(a);
    const db = dueKey(b);
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
  return arr;
}

// The completed checkmark is artwork; the literal tomato red is by design.
function ta_checkIcon(size) {
  return h('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true }, [
    h('path', {
      d: 'M3.5 8.5 6.5 11.5 12.5 5',
      fill: 'none',
      stroke: '#d96d55',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  ]);
}

const ta_safe = (fn) => () => {
  try {
    fn();
  } catch (err) {
    // event handlers must not throw
  }
};

const ta_rootStyle = { display: 'flex', flexDirection: 'column' };
const ta_formStyle = { display: 'flex', gap: 8, marginBottom: 12 };
const ta_inputStyle = {
  flex: 1,
  minWidth: 0,
  background: T.layer1,
  border: '1px solid ' + T.border1,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
};
const ta_addBtnStyle = (disabled) => ({
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  background: T.brand,
  color: T.brandInvert,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});
const ta_errorStyle = { color: T.error, fontSize: 12, marginBottom: 8 };
const ta_listStyle = { background: T.layer1, border: '1px solid ' + T.border1, borderRadius: 12, overflow: 'hidden' };
const ta_rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' };
const ta_checkStyle = (disabled) => ({
  width: 18,
  height: 18,
  borderRadius: 6,
  border: '1px solid ' + T.border1,
  background: 'transparent',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  flexShrink: 0,
});
const ta_dueChipStyle = { padding: '1px 8px', borderRadius: 999, fontSize: 11, background: T.layer2, color: T.text2 };

function TasksTab({ copy, snap, refresh }) {
  const [taTitle, setTaTitle] = useState('');
  const [taAdding, setTaAdding] = useState(false);
  const [taAddError, setTaAddError] = useState(false);
  const [taBusyId, setTaBusyId] = useState(null); // task id whose complete request is in flight
  const [taRowError, setTaRowError] = useState(null); // task id whose complete request failed

  const tasks = useMemo(
    () => ta_sort((snap && Array.isArray(snap.tasks) ? snap.tasks : []).map(ta_task).filter((tk) => tk !== null)),
    [snap],
  );

  const ta_submit = () => {
    try {
      const title = typeof taTitle === 'string' ? taTitle.trim() : '';
      if (!title || taAdding) return;
      setTaAdding(true);
      sendJson('/api/tasks', 'POST', { title })
        .then(() => {
          setTaTitle('');
          setTaAddError(false);
          refresh();
        })
        .catch(() => setTaAddError(true))
        .finally(() => setTaAdding(false));
    } catch (err) {
      // never throw from a handler
    }
  };

  const ta_complete = (task) => {
    try {
      if (!task || task.id == null || taBusyId != null) return;
      setTaBusyId(task.id);
      sendJson('/api/tasks/' + encodeURIComponent(task.id) + '/complete', 'POST', {})
        .then(() => {
          setTaRowError(null);
          refresh();
        })
        .catch(() => setTaRowError(task.id))
        .finally(() => setTaBusyId(null));
    } catch (err) {
      // never throw from a handler
    }
  };

  return h('div', { style: ta_rootStyle }, [
    h('div', { key: 'form', style: ta_formStyle }, [
      h('input', {
        key: 'in',
        style: ta_inputStyle,
        value: taTitle,
        placeholder: t(copy, 'ta_newPlaceholder'),
        disabled: taAdding,
        onChange: (e) => setTaTitle(e.target.value),
        onKeyDown: (e) => {
          if (e.key === 'Enter') ta_submit();
        },
      }),
      h(
        'button',
        {
          key: 'add',
          style: ta_addBtnStyle(taAdding),
          disabled: taAdding,
          onClick: ta_safe(ta_submit),
        },
        taAdding ? t(copy, 'ta_add') + '…' : t(copy, 'ta_add'),
      ),
    ]),
    taAddError ? h('div', { key: 'adderr', style: ta_errorStyle }, t(copy, 'ta_writeFailed')) : null,
    tasks.length === 0
      ? h('div', { key: 'empty', style: { color: T.text2, fontSize: 13, padding: '16px 4px' } }, t(copy, 'ta_empty'))
      : h('div', { key: 'list', style: ta_listStyle }, tasks.map((task, i) =>
          h(
            'div',
            {
              key: task.id != null ? task.id : 'row' + i,
              style: i > 0 ? { ...ta_rowStyle, borderTop: '1px solid ' + T.border2 } : ta_rowStyle,
            },
            [
              h(
                'button',
                {
                  key: 'check',
                  style: ta_checkStyle(task.id == null || taBusyId != null),
                  disabled: task.id == null || taBusyId != null,
                  'aria-label': t(copy, 'ta_markDone'),
                  title: t(copy, 'ta_markDone'),
                  onClick: ta_safe(() => ta_complete(task)),
                },
                task.completed ? ta_checkIcon(12) : null,
              ),
              h('div', { key: 'body', style: { flex: 1, minWidth: 0 } }, [
                h(
                  'div',
                  {
                    key: 'title',
                    style: {
                      fontSize: 13,
                      color: task.completed ? T.text3 : T.text,
                      textDecoration: task.completed ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                  task.title != null ? task.title : t(copy, 'ta_untitled'),
                ),
                task.due || task.project
                  ? h('div', { key: 'meta', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 } }, [
                      task.due
                        ? h('span', { key: 'due', style: ta_dueChipStyle }, t(copy, 'ta_due', { date: task.due }))
                        : null,
                      task.project
                        ? h('span', { key: 'proj', style: { fontSize: 11, color: T.text3 } }, task.project)
                        : null,
                    ])
                  : null,
                taRowError === task.id
                  ? h('div', { key: 'rowerr', style: { fontSize: 11, color: T.error, marginTop: 3 } }, t(copy, 'ta_writeFailed'))
                  : null,
              ]),
            ],
          ),
        )),
  ]);
}

// tabs-b.js — 拼接源：整段复制进 plugin/client.js 工厂函数体内，替换 StatsTab/SettingsTab 占位。
// 只依赖工厂作用域已有名字（h、T、t、COPY、API_BASE、fetchJson、normalizeHealth、StatusDot），无 import/export/顶层 return。

Object.assign(COPY.zh, {
  st_loading: '加载中…',
  st_noStats: '暂无统计数据——连上番茄运行时并专注一次后，这里会出现图表',
  st_todayMin: '今日投入（分钟）',
  st_todayPomo: '今日番茄（个）',
  st_todayDone: '今日完成（件）',
  st_streak: '连续天数（天）',
  st_totalHr: '累计投入（小时）',
  st_week: '近七天（分钟）',
  se_runtime: '运行时',
  se_status: '连接状态',
  se_online: '在线',
  se_offline: '未连接',
  se_service: '服务',
  se_version: '版本',
  se_guard: '专注保护',
  se_attach: '接入状态',
  se_attachYes: '已接入',
  se_backend: '后端',
  se_lockState: '锁定状态',
  se_locked: '已锁定',
  se_unlocked: '未锁定',
  se_whitelistLabel: '白名单',
  se_whitelistCount: '{n} 个',
  se_guardNone: '未接入 guard——专注保护是可选组件，由运行时拉起；当前运行时未上报 guard 状态',
  se_dataDir: '数据目录',
  se_readOnly: '此处为只读状态展示；runtime 与 guard 的配置由安装脚本与运行时管理。',
});

Object.assign(COPY.en, {
  st_loading: 'Loading…',
  st_noStats: 'No stats yet — connect the tomato runtime and finish a focus session to see charts here',
  st_todayMin: 'Focused today (min)',
  st_todayPomo: 'Pomodoros today',
  st_todayDone: 'Completed today',
  st_streak: 'Day streak',
  st_totalHr: 'Total focus (h)',
  st_week: 'Last 7 days (min)',
  se_runtime: 'Runtime',
  se_status: 'Connection',
  se_online: 'Online',
  se_offline: 'Not connected',
  se_service: 'Service',
  se_version: 'Version',
  se_guard: 'Focus guard',
  se_attach: 'Attached',
  se_attachYes: 'Attached',
  se_backend: 'Backend',
  se_lockState: 'Lock state',
  se_locked: 'Locked',
  se_unlocked: 'Unlocked',
  se_whitelistLabel: 'Whitelist',
  se_whitelistCount: '{n} allowlisted',
  se_guardNone: 'No guard attached. Focus protection is an optional component started by the runtime; the runtime is not reporting guard status.',
  se_dataDir: 'Data directory',
  se_readOnly: 'Read-only status view. Runtime and guard configuration is managed by install scripts and the runtime.',
});

// ---- 统计页签：容忍式窄化与格式化（st_ 前缀）----

function st_num(...vals) {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

// 'YYYY-MM-DD' → 本地时区 Date；日期必须真实存在（拒绝 2 月 30 这类）。
function st_parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function st_dateKey(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
}

// 每天一条：{date, seconds} 或 {date, minutes}，统一折算成秒。
function st_daySeconds(d) {
  if (!d || typeof d !== 'object') return 0;
  if (typeof d.seconds === 'number' && Number.isFinite(d.seconds)) return Math.max(0, Math.round(d.seconds));
  if (typeof d.minutes === 'number' && Number.isFinite(d.minutes)) return Math.max(0, Math.round(d.minutes * 60));
  return 0;
}

// 把服务端的天数组收敛成恰好 7 个槽位（旧→新）：
// 有可解析日期时，以最大日期为锚补齐缺失的日历日（缺某天补 0）；
// 完全没有日期时，把条目（旧→新）铺到以今天结尾的最近 N 天上，星期标签仍然有意义。
function st_weekSlots(days) {
  if (!Array.isArray(days) || days.length === 0) return [];
  const parsed = days.map((d) => ({
    dt: st_parseDate(d && d.date),
    seconds: st_daySeconds(d),
  }));
  const dated = parsed.filter((e) => e.dt);
  if (dated.length === 0) {
    const count = Math.min(parsed.length, 7);
    const today = new Date();
    const slots = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
      const idx = parsed.length - count + (i - (7 - count));
      slots.push({ dt, seconds: idx >= 0 && idx < parsed.length ? parsed[idx].seconds : 0 });
    }
    return slots;
  }
  let maxDt = dated[0].dt;
  for (const e of dated) if (e.dt > maxDt) maxDt = e.dt;
  const byKey = new Map();
  for (const e of parsed) if (e.dt) byKey.set(st_dateKey(e.dt), e.seconds);
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(maxDt.getFullYear(), maxDt.getMonth(), maxDt.getDate() - (6 - i));
    slots.push({ dt, seconds: byKey.get(st_dateKey(dt)) || 0 });
  }
  return slots;
}

// 容忍多种字段名（camelCase / snake_case）与 {stats: {...}} 嵌套；读不出任何字段时返回 null。
function st_normalizeStats(p) {
  if (!p || typeof p !== 'object') return null;
  const inner = p.stats && typeof p.stats === 'object' ? p.stats : p;
  let days = null;
  const rawDays = Array.isArray(inner.days)
    ? inner.days
    : Array.isArray(inner.last7Days)
      ? inner.last7Days
      : Array.isArray(inner.week)
        ? inner.week
        : null;
  if (rawDays) {
    days = rawDays.map((d) => ({
      date: d && typeof d.date === 'string' ? d.date : null,
      seconds: st_daySeconds(d),
    }));
  }
  const todaySeconds = st_num(inner.todaySeconds, inner.today_seconds);
  const todayPomodoros = st_num(inner.todayPomodoros, inner.today_pomodoros);
  const todayCompleted = st_num(inner.todayCompleted, inner.today_completed);
  const streakDays = st_num(inner.streakDays, inner.streak);
  const totalSeconds = st_num(inner.totalSeconds, inner.total_seconds);
  const hasAny =
    todaySeconds !== null ||
    todayPomodoros !== null ||
    todayCompleted !== null ||
    streakDays !== null ||
    totalSeconds !== null ||
    days !== null;
  if (!hasAny) return null;
  return { todaySeconds, todayPomodoros, todayCompleted, streakDays, totalSeconds, days };
}

// 全 0 且没有 days 数组视为无数据（空态）；有 days 就画图，哪怕全是 0。
function st_hasData(s) {
  if (!s) return false;
  if (s.days && s.days.length > 0) return true;
  return (
    (s.todaySeconds != null && s.todaySeconds > 0) ||
    (s.todayPomodoros != null && s.todayPomodoros > 0) ||
    (s.todayCompleted != null && s.todayCompleted > 0) ||
    (s.streakDays != null && s.streakDays > 0) ||
    (s.totalSeconds != null && s.totalSeconds > 0)
  );
}

function st_fmtInt(n) {
  return n == null ? '—' : String(Math.round(n));
}

function st_fmtMin(n) {
  return n == null ? '—' : String(Math.round(n / 60));
}

// 累计投入（小时），四舍五入到 0.1。
function st_fmtHours(n) {
  return n == null ? '—' : (Math.round((n / 3600) * 10) / 10).toFixed(1);
}

const st_BAR_MAX = 96;
const st_BAR_MIN = 6;

// 高度按当日最大值归一；最大为 0 时全部给最低高度。
function st_barHeights(slots) {
  let max = 0;
  for (const s of slots) if (s.seconds > max) max = s.seconds;
  return slots.map((s) =>
    max === 0 ? st_BAR_MIN : st_BAR_MIN + Math.round((s.seconds / max) * (st_BAR_MAX - st_BAR_MIN)),
  );
}

const st_gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: 12,
};
const st_cardStyle = {
  background: T.layer1,
  border: `1px solid ${T.border1}`,
  borderRadius: 12,
  padding: '14px 16px',
};
const st_emptyStyle = {
  padding: '36px 12px',
  textAlign: 'center',
  color: T.text2,
  fontSize: 13,
  lineHeight: 1.6,
};

function StatsTab({ copy, snap, every }) {
  const [stats, setStats] = useState(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchJson(API_BASE + '/api/stats', { timeoutMs: 4000 })
        .then((d) => {
          if (alive) setStats(st_normalizeStats(d));
        })
        .catch(() => {
          // 取不到就保留上次结果；snap.stats 继续充当回退。
        })
        .finally(() => {
          if (alive) setSettled(true);
        });
    };
    load();
    const stop = every(load, 30000);
    return () => {
      alive = false;
      if (typeof stop === 'function') stop();
    };
  }, [every]);

  // snap.stats 只作首屏回退；自取成功后就以 /api/stats 为准。
  const snapStats = st_normalizeStats(snap && snap.stats);
  const shown = stats || snapStats;

  if (!shown) {
    return h('div', { style: st_emptyStyle }, t(copy, settled ? 'st_noStats' : 'st_loading'));
  }
  if (!st_hasData(shown)) {
    return h('div', { style: st_emptyStyle }, t(copy, 'st_noStats'));
  }

  const slots = st_weekSlots(shown.days);
  const heights = st_barHeights(slots);
  const daysArr = Array.isArray(copy.days) && copy.days.length === 7 ? copy.days : null;

  const cards = [
    { key: 'st_todayMin', value: st_fmtMin(shown.todaySeconds) },
    { key: 'st_todayPomo', value: st_fmtInt(shown.todayPomodoros) },
    { key: 'st_todayDone', value: st_fmtInt(shown.todayCompleted) },
    { key: 'st_streak', value: st_fmtInt(shown.streakDays) },
    { key: 'st_totalHr', value: st_fmtHours(shown.totalSeconds) },
  ];

  return h('div', { style: { display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'cards', style: st_gridStyle }, cards.map((c) =>
      h('div', { key: c.key, style: st_cardStyle }, [
        h('div', {
          key: 'num',
          style: {
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.1,
            color: T.text,
            fontVariantNumeric: 'tabular-nums',
          },
        }, c.value),
        h('div', { key: 'label', style: { marginTop: 6, fontSize: 12, color: T.text2 } }, t(copy, c.key)),
      ]),
    )),
    slots.length > 0
      ? h('div', { key: 'chart', style: { ...st_cardStyle, marginTop: 12 } }, [
          h('div', { key: 'head', style: { fontSize: 13, fontWeight: 600, color: T.text } }, t(copy, 'st_week')),
          h('div', { key: 'bars', style: { display: 'flex', gap: 8, marginTop: 14 } }, slots.map((s, i) =>
            h('div', {
              key: i,
              style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' },
            }, [
              h('div', {
                key: 'slot',
                style: { height: st_BAR_MAX + 8, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
              }, [
                h('div', {
                  key: 'bar',
                  'aria-hidden': true,
                  style: {
                    width: '58%',
                    maxWidth: 30,
                    minWidth: 8,
                    height: heights[i],
                    borderRadius: '5px 5px 0 0',
                    background: '#d96d55',
                  },
                }),
              ]),
              h('div', {
                key: 'min',
                style: { marginTop: 8, fontSize: 11, color: T.text2, fontVariantNumeric: 'tabular-nums' },
              }, String(Math.round(s.seconds / 60))),
              h('div', { key: 'day', style: { marginTop: 2, fontSize: 11, color: T.text3 } }, daysArr ? daysArr[s.dt.getDay()] : ''),
            ]),
          )),
        ])
      : null,
  ]);
}

// ---- 设置页签：只读状态展示（se_ 前缀）----

const se_cardStyle = {
  background: T.layer1,
  border: `1px solid ${T.border1}`,
  borderRadius: 12,
  padding: '14px 16px',
};
const se_cardHeadStyle = { fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 };
const se_rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '7px 0',
  borderBottom: `1px solid ${T.border2}`,
};
const se_labelStyle = { color: T.text2, fontSize: 12, flexShrink: 0 };
const se_valueStyle = {
  color: T.text,
  fontSize: 13,
  fontWeight: 500,
  textAlign: 'right',
  minWidth: 0,
  overflowWrap: 'anywhere',
};
const se_noteStyle = { marginTop: 12, fontSize: 12, lineHeight: 1.6, color: T.text3 };
const se_monoStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12,
  color: T.text,
  overflowWrap: 'anywhere',
  padding: '7px 0',
};

function se_dotText(ok, text) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } }, [
    h(StatusDot, { key: 'dot', ok }),
    h('span', { key: 't' }, text),
  ]);
}

function se_kvRow(label, value, key) {
  return h('div', { key, style: se_rowStyle }, [
    h('span', { key: 'k', style: se_labelStyle }, label),
    h('span', { key: 'v', style: se_valueStyle }, value),
  ]);
}

function SettingsTab({ copy, hlt, every }) {
  const [self, setSelf] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchJson(API_BASE + '/health', { timeoutMs: 4000 })
        .then((d) => {
          const n = normalizeHealth(d);
          if (alive && n) setSelf(n);
        })
        .catch(() => {
          // 自取失败保留上次结果；hlt 继续充当实时回退。
        });
    };
    load();
    const stop = every(load, 30000);
    return () => {
      alive = false;
      if (typeof stop === 'function') stop();
    };
  }, [every]);

  // 自取成功以自取为准；未成功过就用面板持续轮询的 hlt（prop 变化时自动跟随）。
  const health = self || hlt;
  const online = !!health && health.ok !== false;
  const g = health ? health.guard : null;
  const attached = !!g && g.available !== false;

  return h('div', { style: { display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'runtime', style: se_cardStyle }, [
      h('div', { key: 'head', style: se_cardHeadStyle }, t(copy, 'se_runtime')),
      se_kvRow(t(copy, 'se_status'), se_dotText(online, t(copy, online ? 'se_online' : 'se_offline')), 'status'),
      se_kvRow(t(copy, 'se_service'), health && health.service ? health.service : '—', 'service'),
      se_kvRow(t(copy, 'se_version'), health && health.version ? health.version : '—', 'version'),
    ]),
    h('div', { key: 'guard', style: { ...se_cardStyle, marginTop: 12 } }, [
      h('div', { key: 'head', style: se_cardHeadStyle }, t(copy, 'se_guard')),
      attached
        ? [
            se_kvRow(t(copy, 'se_attach'), se_dotText(true, t(copy, 'se_attachYes')), 'attach'),
            se_kvRow(t(copy, 'se_backend'), g.backend ? g.backend : '—', 'backend'),
            se_kvRow(t(copy, 'se_lockState'), t(copy, g.locked ? 'se_locked' : 'se_unlocked'), 'locked'),
            se_kvRow(
              t(copy, 'se_whitelistLabel'),
              t(copy, 'se_whitelistCount', { n: Array.isArray(g.whitelist) ? g.whitelist.length : 0 }),
              'whitelist',
            ),
            se_kvRow('PID', g.pid != null ? String(g.pid) : '—', 'pid'),
            g.message
              ? h('div', { key: 'msg', style: { marginTop: 8, fontSize: 12, color: T.text3 } }, g.message)
              : null,
          ]
        : h('div', {
            key: 'none',
            style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 13, color: T.text2 },
          }, se_dotText(false, t(copy, 'se_guardNone'))),
    ]),
    h('div', { key: 'data', style: { ...se_cardStyle, marginTop: 12 } }, [
      h('div', { key: 'head', style: se_cardHeadStyle }, t(copy, 'se_dataDir')),
      h('div', { key: 'dir', style: se_monoStyle }, health && health.dataDir ? health.dataDir : '—'),
    ]),
    h('div', { key: 'note', style: se_noteStyle }, t(copy, 'se_readOnly')),
  ]);
}

    return {
      inject: ['slots', 'timer'],
      apply(ctx) {
        const copy = pickCopy(ctx);
        // One store per apply: both slot entries share it, and a plugin reload
        // starts from a fresh closed state instead of inheriting module state.
        const store = makeStore(false);
        const everyTick = (fn, ms) => every(ctx, ms, fn);

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            { name: 'conversation.composer.dock', id: 'tomato-dsh', order: 5 },
            () => h(DockCard, { copy, every: everyTick, store }),
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'tomato-panel', order: 100 },
            () => h(TomatoPanel, { copy, every: everyTick, store }),
          ),
        );
      },
    };
  },
});
