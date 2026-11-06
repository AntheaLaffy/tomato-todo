// 页面桩：全部任务。lead 占位，由对应页面工作流替换实现（导出自己的 Page + registerPage）。
import { registerPage } from "../app/registry.js";
import { makeStub } from "./stub.js";

registerPage(
  makeStub({
    id: "tasks",
    order: 20,
    icon: "tasks",
    ns: "tasks",
    titleKey: "nav.tasks",
    zhTitle: "全部任务",
    enTitle: "All tasks",
  }),
);
