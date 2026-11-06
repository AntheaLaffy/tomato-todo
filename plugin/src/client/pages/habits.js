// 页面桩：习惯愿景。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "habits",
    order: 30,
    icon: "habit",
    ns: "habits",
    titleKey: "nav.habits",
    zhTitle: "习惯愿景",
    enTitle: "Habits & visions",
  }),
);
