// DSH 客户端半入口：只做一件事 —— 注册工厂。
//
// 打包产物（plugin/client.js）在脚本执行时调用 __ModuleLoader__.load，
// 其余模块（含样式注入、页面自注册）都在工厂被 materialize 时才运行，
// 符合 DSH「lazy CJS」加载模型（见 dsh-client-modules 的模块文档）。
import { createPlugin } from "./plugin.js";

window.__ModuleLoader__.load({
  id: "@local/tomato-dsh",
  factory(require) {
    return createPlugin(require);
  },
});
