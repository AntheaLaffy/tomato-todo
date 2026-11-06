// 页面桩：应试教育。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "education",
    order: 60,
    icon: "education",
    ns: "education",
    titleKey: "nav.education",
    zhTitle: "应试教育",
    enTitle: "Study projects",
  }),
);
