// 页面桩：数据统计。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "stats",
    order: 40,
    icon: "stats",
    ns: "stats",
    titleKey: "nav.stats",
    zhTitle: "数据统计",
    enTitle: "Statistics",
  }),
);
