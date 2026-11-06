// 全 DSH 皮肤的主题层：把 DSH 的 --dsw-alias-* / --dsw-specific-* 令牌换成番茄纸色系。
//
// 用 overrideTokens 而不是 register+setTheme 的原因：
// - overrideTokens 不写用户偏好，浅/深两套值同时提交，system 跟随 OS 的行为
//   保持不变（register 的主题是单一 colorScheme，会强制把偏好钉死在一种）；
// - 卸载时自动回退，插件停用后 DSH 立刻恢复原貌。
//
// 覆盖范围按 DSH 的**实际令牌词汇表**（@deepseek-ai/dsh-client-ui-theme 的
// body 色板，108 个 alias + 一批 specific）。只改少数几个「文档点名」的令牌
// 是不够的：侧栏选中行、菜单表面、工具条、markdown 代码块、空状态插画这些
// 地方各用各的令牌，漏掉一个就会在纸色界面里露出一块冷蓝/纯黑。
//
// 两个关键的对比度取舍（浅色）：
// - label-primary #3b3128 on bg-base #f7f1e5 = 11.3:1，远高于 7:1；
// - label-secondary #7c6c59 = 4.5:1（次要文字 AA）；
// - label-tertiary 取 #8b7b67 = 3.6:1（DSH 用它放占位/三级信息，比纯装饰用的
//   --tomato-ink-3 略深，保证 3:1 可读）；
// - button-primary-fill 不用 --tomato-brand(#d96d55)，改用 brand-deep #b9573f：
//   浅色下 DSH 主按钮文字是 label-primary-foreground(#fffdf7)，白字压 #d96d55
//   只有 3.2:1，压 #b9573f 是 4.5:1。品牌亮红留给图标/进度/链接等非文字面。
// 深色对照：label-primary #f2eadf on #1c1916 = 14.7:1，foreground 反过来用深墨
// 压亮番茄 #e8886c = 6.9:1（深色主题的 DSH 默认语义也是「深字压亮底」）。
export const SKIN_SOURCE = "tomato-skin";

const L = (name, light, dark) => [name, { light, dark }];

/** --dsw-alias-* 覆盖层：每项 {light, dark}。取值顺序 = 面 / 线 / 墨 / 品牌状态 / 交互 / 代码 / 浮层 / 其它。 */
export const SKIN_TOKENS = Object.fromEntries([
  // ---- 面：纸、卡片、层叠、遮罩 ----
  L("--dsw-alias-bg-base", "#f7f1e5", "#1c1916"),
  L("--dsw-alias-bg-layer-1", "#fffdf7", "#262019"),
  L("--dsw-alias-bg-layer-2", "#f1e9da", "#2e2822"),
  L("--dsw-alias-bg-layer-3", "#e9dfcc", "#3a322a"),
  L("--dsw-alias-bg-layer-4", "#e2d5bf", "#443b31"),
  // 旧别名（部分 DSH 子包仍引用）：与 layer 对齐，避免落回冷灰默认值。
  L("--dsw-alias-bg-l1", "#f4ecdf", "#2a241d"),
  L("--dsw-alias-bg-l2", "#fffdf7", "#262019"),
  L("--dsw-alias-bg-overlay", "#fffdf7", "#262019"),
  L("--dsw-alias-bg-multi-select", "#f1e9da", "#2e2822"),
  L("--dsw-alias-bg-skeleton", "#0000000a", "#ffffff14"),
  L("--dsw-alias-bg-document-preview", "#fffdf7", "#221d18"),
  L("--dsw-alias-bg-document-selection", "#d96d5533", "#e8886c33"),
  L("--dsw-alias-bg-module-platform", "#f1e9da", "#2e2822"),
  L("--dsw-alias-bg-mask-1", "#2b1d1240", "#00000073"),
  L("--dsw-alias-bg-mask-2", "#2b1d1220", "#00000040"),
  L("--dsw-alias-bg-mask-3", "#2b1d1270", "#0000007a"),
  L("--dsw-alias-bg-mask-photo", "#1c120ecc", "#000000e0"),
  L("--dsw-alias-bg-mask-drop", "#f7f1e5b3", "#1c1916b3"),
  // ---- 线：半透明黑/白合成暖纸色，任何一档都不会出现冷灰边 ----
  L("--dsw-alias-border-l1", "#00000014", "#ffffff14"),
  L("--dsw-alias-border-l2", "#0000001f", "#ffffff1f"),
  L("--dsw-alias-border-l3", "#00000024", "#ffffff24"),
  L("--dsw-alias-border-l4", "#00000033", "#ffffff33"),
  L("--dsw-alias-border-l2-darkmode-thin", "#0000001a", "#ffffff12"),
  L("--dsw-alias-border-inverted", "#00000000", "#ffffff0f"),
  L("--dsw-alias-border-inverted2", "#00000000", "#ffffff14"),
  L("--dsw-alias-separator-primary", "#0000001f", "#ffffff1f"),
  // ---- 墨：≥7 / ≥4.5 / ≥3 三级可读性 ----
  L("--dsw-alias-label-primary", "#3b3128", "#f2eadf"),
  L("--dsw-alias-label-secondary", "#7c6c59", "#b3a593"),
  L("--dsw-alias-label-tertiary", "#8b7b67", "#8f8172"),
  L("--dsw-alias-label-quaternary", "#b7a892", "#786b5c"),
  L("--dsw-alias-label-dimmed", "#e0d5c0", "#3a322a"),
  L("--dsw-alias-label-caption", "#8b7b67", "#9a8b7a"),
  L("--dsw-alias-label-primary-dimmed", "#3b3128", "#f2eadf"),
  L("--dsw-alias-label-primary-bluish", "#3b3128", "#f2eadf"),
  L("--dsw-alias-label-document-preview", "#7c6c59", "#b3a593"),
  L("--dsw-alias-label-error", "#b8503f", "#e07f6a"),
  L("--dsw-alias-label-shimmer", "#3b31284d", "#f2eadf4d"),
  L("--dsw-alias-label-deep-diving", "#a34c36", "#e8a088"),
  L("--dsw-alias-label-deep-diving-shimmer", "#d96d55", "#d2705a"),
  // 反色语义：浅色是「白字压深底」，深色是「深字压亮底」。
  L("--dsw-alias-label-primary-foreground", "#fffdf7", "#241511"),
  L("--dsw-alias-label-primary-inverted", "#fffdf7", "#2a241d"),
  // 链接/品牌文字在纸底上要 ≥4.5：比 brand-deep(#b9573f, 4.15) 再深一档。
  L("--dsw-alias-link", "#a34c36", "#e8a088"),
  L("--dsw-alias-markdown-citation", "#b9573f", "#e8886c"),
  // ---- 品牌与状态色 ----
  L("--dsw-alias-brand-primary", "#d96d55", "#e8886c"),
  L("--dsw-alias-brand-text", "#a34c36", "#e8a088"),
  L("--dsw-alias-brand-primary-invert", "#3b3128", "#f7f1e5"),
  L("--dsw-alias-button-primary-fill", "#b9573f", "#e8886c"),
  L("--dsw-alias-button-primary-hover", "#a34c36", "#d2705a"),
  L("--dsw-alias-button-primary-dimmed", "#f6e0d6", "#4a2f28"),
  L("--dsw-alias-button-contrast-fill", "#3b3128", "#e9dfcc"),
  L("--dsw-alias-button-info-fill", "#e9a178", "#d99a72"),
  L("--dsw-alias-button-info-hover", "#d98c5f", "#c9835c"),
  L("--dsw-alias-state-success-primary", "#6f8f60", "#93ab84"),
  L("--dsw-alias-state-success-secondary", "#8aa77a", "#a8bf98"),
  L("--dsw-alias-state-success-tertiary", "#e3ecdc", "#2a3a26"),
  L("--dsw-alias-state-warn-primary", "#c2913f", "#dcb06b"),
  L("--dsw-alias-state-warn-label", "#a87b2d", "#dcb06b"),
  L("--dsw-alias-state-warn-secondary", "#d5a553", "#e2bd78"),
  L("--dsw-alias-state-warn-tertiary", "#f3e8d2", "#43331c"),
  L("--dsw-alias-state-error-primary", "#b8503f", "#e07f6a"),
  L("--dsw-alias-state-error-secondary", "#cf6a55", "#e89a86"),
  L("--dsw-alias-state-idle-primary", "#a2927d", "#86796a"),
  L("--dsw-alias-state-done-primary", "#7e9a6e", "#93ab84"),
  // 焦点环回退色（DSH CSS 里 --dsw-focus-ring-color 缺省取它）：用品牌红。
  L("--dsw-alias-state-business-primary", "#d96d55", "#e8886c"),
  L("--dsw-alias-state-business-tertiary", "#f6e0d6", "#4a2f28"),
  // ---- 交互面 ----
  L("--dsw-alias-interactive-bg-hover", "#5a3d2612", "#ffffff12"),
  L("--dsw-alias-interactive-bg-active", "#5a3d2620", "#ffffff20"),
  L("--dsw-alias-interactive-bg-hover-solid", "#f1e9da", "#2e2822"),
  L("--dsw-alias-interactive-bg-hover-accent", "#d96d5520", "#e8886c24"),
  L("--dsw-alias-interactive-bg-hover-danger", "#b8503f10", "#e07f6a1a"),
  L("--dsw-alias-button-floating-fill", "#fffdf7", "#262019"),
  L("--dsw-alias-button-floating-hover", "#f1e9da", "#2e2822"),
  L("--dsw-alias-button-elevated-fill", "#fffdf7", "#2a241d"),
  L("--dsw-alias-button-ghost-active-fill", "#f1e9da", "#3a322a"),
  L("--dsw-alias-button-ghost-active-hover", "#e9dfcc", "#443b31"),
  L("--dsw-alias-button-ghost-active-border", "#c3b7a3", "#6f6355"),
  L("--dsw-alias-button-tool-bar-fill", "#f4ecdf", "#2e2822"),
  L("--dsw-alias-button-tool-bar-hover", "#e9dfcc", "#3a322a"),
  L("--dsw-alias-button-tool-bar-fill-invisible", "#2b1d1224", "#00000040"),
  // ---- markdown / 代码 / 终端 ----
  L("--dsw-alias-markdown-code-block", "#f4ecdf", "#221d18"),
  L("--dsw-alias-markdown-code-block-banner", "#e9dfcc", "#2a241d"),
  L("--dsw-alias-markdown-inline-code", "#f1e9da", "#2e2822"),
  L("--dsw-alias-markdown-code-segment-selected", "#fffdf7", "#2e2822"),
  L("--dsw-alias-markdown-code-segment-unselected", "#efe5d5", "#221d18"),
  L("--dsw-alias-markdown-placeholder", "#efe5d5", "#2a241d"),
  L("--dsw-alias-markdown-tag", "#efe5d5", "#2e2822"),
  L("--dsw-alias-turn-trigger-bg", "#f4ecdf", "#2e2822"),
  L("--dsw-alias-turn-trigger-bg-hover", "#e9dfcc", "#3a322a"),
  L("--dsw-alias-code-diff-added", "#5d8a5220", "#7fa87226"),
  L("--dsw-alias-code-diff-deleted", "#b8503f1c", "#e07f6a26"),
  L("--dsw-alias-file-diff-added-bg", "#e7f0e2", "#223026"),
  L("--dsw-alias-file-diff-added-gutter", "#eff5eb", "#1a261d"),
  L("--dsw-alias-file-diff-added-marker", "#5d8a52", "#7fa872"),
  L("--dsw-alias-file-diff-deleted-bg", "#f8e3dc", "#3a241f"),
  L("--dsw-alias-file-diff-deleted-gutter", "#fcece6", "#2a1a16"),
  L("--dsw-alias-file-diff-deleted-marker", "#b8503f", "#e07f6a"),
  // ---- 浮层：菜单 / tooltip / toast / 开关 ----
  L("--dsw-alias-menu-group-header-fill", "#f6efe2f0", "#2e2822f0"),
  L("--dsw-alias-menu-icon", "#7c6c59", "#b3a593"),
  L("--dsw-alias-tooltip-bg", "#3b3128", "#3a322a"),
  L("--dsw-alias-tooltip-key-bg", "#4f4539", "#4a4036"),
  L("--dsw-alias-toast-bg", "#3b3128", "#3a322a"),
  L("--dsw-alias-toast-label", "#fffdf7", "#f2eadf"),
  L("--dsw-alias-switch-thumb", "#fffdf7", "#f2eadf"),
  // ---- 其它成体系的表面（漏掉会在纸底上露出冷色） ----
  L("--dsw-alias-scrollbar-bg-l1", "#e6dcc8", "#3a322a"),
  L("--dsw-alias-scrollbar-bg-l2", "#e6dcc8", "#3a322a"),
  L("--dsw-alias-scrollbar-hover-l1", "#d8cab2", "#4a4036"),
  L("--dsw-alias-scrollbar-hover-l2", "#d8cab2", "#4a4036"),
  L("--dsw-alias-settings-card-fill", "#f4ecdf", "#2a241d"),
  L("--dsw-alias-settings-card-stroke", "#0000001f", "#ffffff1f"),
  // 空状态插画：DSH 自带线描插画用这几个令牌，暖化成纸上铅笔稿。
  L("--dsw-alias-illustration-background", "#f4ecdf", "#2a241d"),
  L("--dsw-alias-illustration-backing", "#e6dbc6", "#3a322a"),
  L("--dsw-alias-illustration-detail", "#cdbfa8", "#57493b"),
  L("--dsw-alias-illustration-inset", "#f8f2e6", "#332c24"),
  L("--dsw-alias-illustration-shadow", "#e0d3bc", "#221d18"),
  L("--dsw-alias-illustration-surface", "#efe5d5", "#332c24"),
  L("--dsw-alias-onboarding-accent", "#d96d55", "#e8886c"),
  L("--dsw-alias-onboarding-card-fill", "#fffdf7", "#2a241d"),
  L("--dsw-alias-onboarding-checkbox-border", "#00000033", "#ffffff33"),
  L("--dsw-alias-onboarding-secondary-fill", "#f4ecdf", "#2e2822"),
  // 杂项填充（focus 行、选中行等）。
  L("--dsw-alias-fill-l1", "#efe5d5", "#332c24"),
  L("--dsw-alias-fill-l2", "#e9dfcc", "#3a322a"),
  L("--dsw-alias-fill-tertiary", "#f4ecdf", "#2a241d"),
  L("--dsw-alias-fill-tsp-secondary", "#5a3d2612", "#ffffff12"),
  // ---- --dsw-specific-*：侧栏、气泡、输入、菜单、选择器 ----
  L("--dsw-specific-sidebar-fill", "#f4ecdd", "#221d18"),
  L("--dsw-specific-sidebar-nav-item-active", "#e9dfcc", "#3a322a"),
  L("--dsw-specific-sidebar-nav-item-active-accent", "#f6e0d6", "#4a2f28"),
  L("--dsw-specific-bubble", "#fffdf7", "#2a241d"),
  L("--dsw-specific-bubble-highlight", "#f6efe2", "#332c24"),
  L("--dsw-specific-input-major", "#f4ecdf", "#2a241d"),
  L("--dsw-specific-login-input", "#fffdf7", "#2a241d"),
  L("--dsw-specific-menu", "#fffdf7", "#262019"),
  L("--dsw-specific-selector", "#f1e9da", "#2e2822"),
  L("--dsw-specific-tip", "#f1e9da", "#2e2822"),
  // 菜单表面是半透明的（带背景模糊），单独给一个带 alpha 的纸面。
  L("--dsw-menu-surface-fill", "#fffdf7e6", "#262019e6"),
]);
