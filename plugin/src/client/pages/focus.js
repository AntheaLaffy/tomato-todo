// 页面桩：今日专注。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "focus",
    order: 10,
    icon: "focus",
    ns: "focus",
    titleKey: "nav.focus",
    zhTitle: "今日专注",
    enTitle: "Today",
  }),
);
