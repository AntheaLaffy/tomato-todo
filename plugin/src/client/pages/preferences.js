// 页面桩：偏好设置。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "preferences",
    order: 90,
    icon: "settings",
    ns: "preferences",
    titleKey: "nav.preferences",
    zhTitle: "偏好设置",
    enTitle: "Preferences",
  }),
);
