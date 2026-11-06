// 页面桩：定时锁机。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "schedule",
    order: 80,
    icon: "moon",
    ns: "schedule",
    titleKey: "nav.schedule",
    zhTitle: "定时锁机",
    enTitle: "Scheduled lock",
  }),
);
