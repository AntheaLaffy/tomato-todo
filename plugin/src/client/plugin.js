// 客户端插件装配：把皮肤（全 DSH）与应用（番茄主视图/沉浸/HUD）接到 Cordis。
//
// 顺序有意义：installRuntime 先把 React 与 hooks 装进 runtime.js 的活绑定，
// 皮肤再接管主题与全局样式，最后挂应用（应用组件可能在首次渲染时读皮肤变量）。
import { installRuntime } from "./runtime.js";
import { registerSkin } from "./skin/main.js";
import { registerApp } from "./app/main.js";

export function createPlugin(require) {
  installRuntime(require);
  return {
    // slots/timer/theme/locale/layout 全是 DSH 的 Client Service；
    // 声明得越精确，插件被激活前的等待越短。
    inject: ["slots", "timer", "theme", "locale", "layout"],
    apply(ctx) {
      try {
        registerSkin(ctx);
        registerApp(ctx);
      } catch (error) {
        console.error("[tomato] client activation failed", error);
        throw error;
      }
    },
  };
}
