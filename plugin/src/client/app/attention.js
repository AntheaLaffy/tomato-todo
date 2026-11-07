// 到点音效的跃迁判定：纯函数，不碰 React / DOM / 存储。
//
// 为什么单独一层：这里最容易写错成「状态成立就执行」，而跃迁只有在同一份
// 已加载快照之间才存在。抽出来才能在 node:test 里用假快照覆盖「刷新后的
// 首帧」与「运行中真的发生了新提醒 / 一轮结束」的差别。
//
// 背景（一次真实回归）：刷新浏览器时 HUD 的上一份快照是空的（store 里还
// 没有数据），数据到达后 completionSerial 从 0 涨到 N、提醒数从 0 涨到 N，
// 被当成刚刚发生的跃迁：每次刷新都补播完成音效，旧版还会把 DSH 面板拉回
// 今日专注。只判断「上一份快照是不是 null」挡不住这一次跃迁，所以快照必须
// 带 hydrated 标记。
//
// 「该不该切界面」不在这里：那是 navigation.js 的 shouldGrab 判定表；提醒
// 只播音效，一轮结束才切页。

/**
 * 状态跃迁 → 该播哪一声提示音（complete/reminder/start/resume/pause/null）。
 *
 * 只看跃迁，轮询重复渲染不重复响；同时发生时以「一轮结束」优先。
 * 两端都必须 hydrated：刷新时首帧是空状态，不补播历史节点音效。
 */
export function attentionCue(prev, next) {
  if (!prev || !next) return null;
  if (!prev.hydrated || !next.hydrated) return null;
  if (Number(next.serial) > Number(prev.serial)) return "complete";
  if (!prev.running && next.running)
    return next.mode === "focus" ? "start" : "resume";
  if (prev.running && !next.running && next.paused) return "pause";
  if (Number(next.reminders) > Number(prev.reminders)) return "reminder";
  return null;
}
