// 页面装配：按 order 引入页面模块（模块内自注册到 app/registry.js）。
// 新增/替换页面只需改自己的文件；这个清单只在「加一页」时由 lead 维护。
// project 不在侧栏九页导航里（registry 的 hidden），只能从项目列表进入。
import "./focus.js";
import "./tasks.js";
import "./project.js";
import "./habits.js";
import "./stats.js";
import "./calendar.js";
import "./education.js";
import "./guard.js";
import "./schedule.js";
import "./preferences.js";
