// 页面桩：本周日程。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "calendar",
    order: 50,
    icon: "calendar",
    ns: "calendar",
    titleKey: "nav.calendar",
    zhTitle: "本周日程",
    enTitle: "This week",
  }),
);
