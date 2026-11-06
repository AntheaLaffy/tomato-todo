// 全 DSH 皮肤的主题层：把 DSH 的 --dsw-alias-* 令牌替换成番茄纸色系。
//
// 用 overrideTokens 而不是 register+setTheme 的原因：
// - overrideTokens 不写用户偏好，浅/深两套值同时提交，system 跟随 OS 的行为
//   保持不变（register 的主题是单一 colorScheme，会强制把偏好钉死在一种）；
// - 卸载时自动回退，插件停用后 DSH 立刻恢复原貌。
// 令牌名与取值见 docs/SKIN.md 第 2 节。
export const SKIN_SOURCE = "tomato-skin";

const L = (name, light, dark) => [name, { light, dark }];

/** --dsw-alias-* 覆盖层：每项 {light, dark}。 */
export const SKIN_TOKENS = Object.fromEntries([
  // 面
  L("--dsw-alias-bg-base", "#f7f1e5", "#1c1916"),
  L("--dsw-alias-bg-layer-1", "#fffdf7", "#262019"),
  L("--dsw-alias-bg-layer-2", "#f4ecdf", "#2e2822"),
  L("--dsw-alias-bg-layer-3", "#efe5d5", "#3a322a"),
  L("--dsw-alias-bg-overlay", "#fffdf7", "#262019"),
  L("--dsw-alias-bg-multi-select", "#efe7d8", "#2f2821"),
  L("--dsw-alias-bg-skeleton", "#0000000a", "#ffffff14"),
  L("--dsw-alias-bg-document-preview", "#f4ecdf", "#221d18"),
  L("--dsw-alias-bg-mask-1", "#2b1d1240", "#00000073"),
  L("--dsw-alias-bg-mask-2", "#2b1d1220", "#00000040"),
  L("--dsw-alias-bg-mask-3", "#2b1d1270", "#0000007a"),
  // 线
  L("--dsw-alias-border-l1", "#0000000f", "#ffffff12"),
  L("--dsw-alias-border-l2", "#0000001a", "#ffffff1f"),
  L("--dsw-alias-border-l3", "#00000024", "#ffffff29"),
  L("--dsw-alias-border-l4", "#0000002e", "#ffffff33"),
  // 墨
  L("--dsw-alias-label-primary", "#3b3128", "#f2eadf"),
  L("--dsw-alias-label-secondary", "#7c6c59", "#b3a593"),
  L("--dsw-alias-label-tertiary", "#a2927d", "#86796a"),
  L("--dsw-alias-label-dimmed", "#e0d5c0", "#3a322a"),
  L("--dsw-alias-label-caption", "#7c6c59", "#b3a593"),
  // 品牌与状态
  L("--dsw-alias-brand-primary", "#d96d55", "#e8886c"),
  L("--dsw-alias-brand-text", "#b9573f", "#e8a088"),
  L("--dsw-alias-button-primary-fill", "#d96d55", "#e8886c"),
  L("--dsw-alias-button-primary-hover", "#b9573f", "#d2705a"),
  L("--dsw-alias-state-success-primary", "#6f8f60", "#93ab84"),
  L("--dsw-alias-state-warn-primary", "#c2913f", "#dcb06b"),
  L("--dsw-alias-state-warn-label", "#a87b2d", "#dcb06b"),
  L("--dsw-alias-state-error-primary", "#b8503f", "#e07f6a"),
  L("--dsw-alias-state-idle-primary", "#c3b7a3", "#86796a"),
  L("--dsw-alias-state-done-primary", "#8a9a72", "#b98fa2"),
  L("--dsw-alias-link", "#b9573f", "#e8a088"),
  L("--dsw-alias-markdown-citation", "#b9573f", "#e8a088"),
  // 交互面
  L("--dsw-alias-interactive-bg-hover", "#5a3d2612", "#ffffff12"),
  L("--dsw-alias-interactive-bg-active", "#5a3d2620", "#ffffff20"),
  L("--dsw-alias-interactive-bg-hover-solid", "#f1e9da", "#2e2822"),
  L("--dsw-alias-button-floating-fill", "#fffdf7", "#262019"),
  L("--dsw-alias-button-floating-hover", "#f1e9da", "#2e2822"),
  L("--dsw-alias-button-ghost-active-fill", "#f1e9da", "#3a322a"),
  L("--dsw-alias-button-ghost-active-hover", "#e9dfcc", "#443b31"),
  L("--dsw-alias-button-tool-bar-fill", "#f4ecdf", "#2e2822"),
  L("--dsw-alias-button-tool-bar-hover", "#e9dfcc", "#3a322a"),
  L("--dsw-alias-settings-card-fill", "#f4ecdf", "#2a241d"),
  L("--dsw-alias-settings-card-stroke", "#0000001a", "#ffffff1f"),
  L("--dsw-alias-menu-group-header-fill", "#f8f2e6f0", "#2e2822f0"),
  L("--dsw-alias-menu-icon", "#7c6c59", "#b3a593"),
  L("--dsw-alias-toast-bg", "#3b3128", "#3a322a"),
  L("--dsw-alias-toast-label", "#fffdf7", "#f2eadf"),
  L("--dsw-alias-tooltip-bg", "#3b3128", "#3a322a"),
  L("--dsw-alias-switch-thumb", "#fffdf7", "#f2eadf"),
  L("--dsw-alias-scrollbar-bg-l1", "#e6dcc8", "#3a322a"),
  L("--dsw-alias-scrollbar-bg-l2", "#e6dcc8", "#3a322a"),
  L("--dsw-alias-scrollbar-hover-l1", "#d8cab2", "#4a4036"),
  L("--dsw-alias-scrollbar-hover-l2", "#d8cab2", "#4a4036"),
  L("--dsw-alias-markdown-code-block", "#f4ecdf", "#221d18"),
  L("--dsw-alias-markdown-code-block-banner", "#efe5d5", "#2a241d"),
  L("--dsw-alias-markdown-inline-code", "#f1e9da", "#2e2822"),
  L("--dsw-alias-turn-trigger-bg", "#f4ecdf", "#2e2822"),
  L("--dsw-alias-turn-trigger-bg-hover", "#e9dfcc", "#3a322a"),
  // 侧栏与专用面
  L("--dsw-specific-sidebar-fill", "#f4ecdd", "#221d18"),
  L("--dsw-specific-bubble", "#fffdf7", "#2a241d"),
  L("--dsw-specific-bubble-highlight", "#f6efe2", "#332c24"),
  L("--dsw-specific-input-major", "#f4ecdf", "#2a241d"),
  L("--dsw-specific-menu", "#fffdf7", "#262019"),
]);
