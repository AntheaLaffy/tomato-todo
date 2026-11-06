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

    // Tab bodies land in the next edit; the frame renders while they are stubs.
    function FocusTab(props) {
      return h('div', { style: { color: T.text2, fontSize: 13, padding: 8 } }, t(props.copy, 'loading'));
    }
    function TasksTab(props) {
      return h('div', { style: { color: T.text2, fontSize: 13, padding: 8 } }, t(props.copy, 'loading'));
    }
    function StatsTab(props) {
      return h('div', { style: { color: T.text2, fontSize: 13, padding: 8 } }, t(props.copy, 'loading'));
    }
    function SettingsTab(props) {
      return h('div', { style: { color: T.text2, fontSize: 13, padding: 8 } }, t(props.copy, 'loading'));
    }

    return {
      inject: ['slots'],
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
