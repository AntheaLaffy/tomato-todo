// 一段可以直接看的示范脚本：让助手的手带用户认识课表阻塞时段。
// 用来校动画节奏与音效，也是以后「助手演示一遍怎么做」的样板。
import type { HandScript } from "./hand";

export function blocksTour(): HandScript {
  return {
    label: "助手",
    steps: [
      { kind: "move", target: '[data-page="schedule"]' },
      { kind: "say", lines: ["先看一眼这一周的日程。"] },
      { kind: "click", target: '[data-page="schedule"]' },
      { kind: "wait", ms: 700 },
      { kind: "move", target: ".blocks-card" },
      { kind: "highlight", target: ".blocks-card", ms: 900 },
      {
        kind: "say",
        lines: [
          "方块是任务，背景色带是课表占用。",
          "标成「需专心」的课里排任务会被提示冲突；标成「水课」的课签到就行，课上写作业是计划内的事。",
        ],
      },
      { kind: "move", target: '[data-action="new-block"]' },
      { kind: "click", target: '[data-action="new-block"]' },
      { kind: "wait", ms: 500 },
      {
        kind: "type",
        target: '#block-form [name="title"]',
        text: "模式识别与机器学习",
        cps: 9,
      },
      { kind: "say", lines: ["只上某几周的课，把周次写进备注就不会记错。"] },
      { kind: "move", target: "#block-form .modal-actions .button.primary" },
      {
        kind: "say",
        lines: ["填好星期和时间就能保存——剩下的交给你。"],
        hold: true,
      },
      { kind: "hide" },
    ],
  };
}
