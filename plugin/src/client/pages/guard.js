// 页面桩：专注保护。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "guard",
    order: 70,
    icon: "shield",
    ns: "guard",
    titleKey: "nav.guard",
    zhTitle: "专注保护",
    enTitle: "Focus guard",
  }),
);
