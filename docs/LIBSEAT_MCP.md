# 华南农业大学图书馆座位预约（libseat）逆向与读图实验

2026-10-11 的实测记录。目标站点：<https://libseat.scau.edu.cn/>（图书馆座位预约）。

本文件只记录**协议与实验结果**，可以公开：没有账号、没有凭据、没有可用的会话值
（示例里的 JSESSIONID 都是占位）。账号密码只存在于工作区 `mcp/libseat/.env`，
该目录整体被 `.gitignore` 排除，不入库。

做它的起因是 `docs/AGENT.md` 的「助手作为 MCP 客户端」缺一个真实例子：助手要核实
座位、开放时间这类外部事实，而不是靠猜；站点登录又卡在图形验证码上，于是顺带把
「人/模型读图到底有多准」量了一遍。

## 站点概览

| 项 | 结论 |
| --- | --- |
| 前端 | Vite 打包的 Vue SPA，逻辑都在 `/assets/index-*.js` 及其分块里 |
| 接口前缀 | `/api`（相对同源，前端写死 `fetch`） |
| 鉴权 | **只有 `JSESSIONID`**：`credentials:"include"`，没有任何 Authorization 头或 token |
| 后端 | nginx + 多实例（每次响应带 `x-debug-server: hit-this-server`） |
| 旁路登录 | `GET /sso/scau/?buildingId` → 302 `https://cas.scau.edu.cn/lyuapServer/login?service=…`（CAS，未采用） |
| 幂等头 | `/op/*` 需要 `Idempotent-Token`（先 `GET /api/op/idempotent/token`）；座位预约主流程用不到 |

## 接口

从前端 bundle 还原，全部联网实测过请求/响应形状。

| 用途 | 方法 | 路径 | 请求体 |
| --- | --- | --- | --- |
| 验证码 | GET | `/api/web/user/captcha?t=<ms>` | — → `image/jpeg` 120×40 + `Set-Cookie: JSESSIONID` |
| 登录 | POST | `/api/web/user/login` | `{userName, password, captcha}` |
| 登出 | POST | `/api/web/user/logout` | — |
| 当前用户 | POST | `/api/web/pc/user`、`/api/web/user/getMy` | — |
| 房间列表 | POST | `/api/public/home` | `{}` → `data.rooms[]`（实测 10 间） |
| 时间片/楼层标签 | POST | `/api/public/taglist` | — → `data.timspans[]`（半小时粒度，实测 31 个） |
| 座位占用（公开） | POST | `/api/public/seatState` | `{roomId, startTime, endTime}` → `[{seatname,count,seatid}]`，`count:"0"` 为空闲 |
| 座位占用（登录） | POST | `/api/web/user/seatState` | 同上 |
| **提交预约** | POST | `/api/web/user/due` | `{seatesid, duestartime, dueendtime, reason, memberids}` |
| 我的预约 | POST | `/api/web/user/duelist` | `{duetype, pageNum, pageSize, duestatus?, startDate?, endDate?}` |
| 预约详情 | POST | `/api/web/user/duedetail` | `{id}` |
| 取消 | POST | `/api/web/user/cancel` | `{id}` |
| 签到 | POST | `/api/web/user/checkin/sign` | `{id}` → `data.signin == 1` |
| 签退 | POST | `/api/web/user/signout` | `{id}` |
| 暂离/归位 | POST | `/api/web/user/tempout` | `{orderid, istempout}` |
| 续座 | POST | `/api/web/user/continueOrder` | `{orderid, continuetime}` |
| 状态流水 | POST | `/api/web/seatOrderStateLog/listByOrderId` | `{orderId}` |

字段上的坑（照抄前端，别自作聪明统一）：

- 「预约」在站点内部叫 **due**；`seatesid` 用的是座位表里的 `seatid`，不是房间 `code`。
- 时间段格式前后不一致：查座位用 `"YYYY-MM-DD HH:mm:ss"`，提交预约用 `"YYYY-MM-DD HH:mm"`；
  结束时间 = 所选最后一个半小时片 + 30 分钟。
- **密码明文提交**：没有 RSA/AES/SM2，也没有时间戳签名，`password` 就是原样 JSON 字段。

## 登录链路

```
GET  /api/web/user/captcha    ->  120×40 JPEG + Set-Cookie: JSESSIONID=<占位>
POST /api/web/user/login      ->  {userName, password, captcha}    ← 必须带同一条 JSESSIONID
```

错误约定：

| 响应 | 含义 |
| --- | --- |
| `{"isOk":false,"message":"验证码错误"}` | 验证码不对（或没带上那张图对应的会话） |
| `{"isOk":false,"message":"user can not find"}` | **验证码通过了**，报错落到账号层 |
| `{"code":401,"msg":"请登录访问"}` | 会话失效，`/web/*` 的通用未登录响应 |

### 「不用 cookie」怎么落地

验证码与 JSESSIONID 强绑定，cookie 是协议的一部分，绕不过去。所以这里的做法是
**不落盘、不复用、不导出任何 cookie**：只在进程内存里维持当前会话，启动、401、
验证码失败都重走一遍 `新会话 + 新验证码 + 登录`。持久化 cookie 反而是最脆的方案——
一失效就得人工重登，还要把凭据之外的会话状态存在磁盘上。

## 验证码

实测规则：

| 规则 | 证据 |
| --- | --- |
| 与 JSESSIONID 绑定 | 不带 cookie 提交、或换一条会话提交，一律 `验证码错误` |
| 区分大小写 | 人工读得 `FYRV` 提交 → `user can not find`；`fyrv` → `验证码错误` |
| 一次一图 | 校验失败、**或那次校验通过之后**，同一张图都不再可用 → 重试必须换图 + 换会话 |
| 先验码、后查账号 | 验证码正确但账号不存在 → `user can not find` |

最后一条是这套设计的关键：**不需要一个能登录成功的账号，就能判断一个码对不对**。
`libseat_captcha_probe` 与 `readcheck.mjs` 都拿它当客观判定：
`captcha_accepted`（码被接受）/ `captcha_rejected`（码错）。

### 真账号实测：码会被消费，会话里没有「验过码」的豁免

用真账号（学号 + 密码）跑 `logintest.mjs` 得到的第二个结论，比上面更硬：

```
#2 TWCU -> 验证码通过，但登录失败：password erro        ← 码被接受，且账号确实存在
随后在**同一条会话**上，全程不抓新图：
  - 不带验证码（captcha 留空）: 验证码错误
  - 复用刚才那个已被接受的码:    验证码错误
  - 故意给个乱码（对照）:        验证码错误
```

也就是说：**验证码在「被用过一次」之后就作废**，服务端不会因为这条会话刚验过码就免检。
每次 `POST /web/user/login` 都要配一张属于当前会话的新图。

（严格地说，`登录成功后`是否仍然如此还需要一次成功登录才能盖棺定论；但既有证据都指向
「逐次校验、用完即弃」，没有会话级的豁免。`logintest.mjs` 里的 T2 就是专门测这一点的，
账号密码一通就会给出答案。）

这条结论直接决定了怎么做「固化脚本」：

| 想省掉的东西 | 办法 |
| --- | --- |
| 每次登录都要解一张图 | 求解器（自带 OCR），或者 `LIBSEAT_LOGIN_RETRIES` 多试几张 |
| 反复登录 | **别反复登录**：会话没失效就一直用（MCP 进程内已经这么做了），只在 401 时重登 |
| 依赖 agent 读图 | 上面两条都不成立时才需要；会话寿命够长的话，agent 一天也就出场一两次 |

## Agent 读图实验（本次的核心数据）

方法：抓 N 张验证码（每张各自独立会话）→ 人/模型看图读码 → **按原会话**提交
（探测账号，不涉及真实账号）→ 以服务端判定为准。

```
第 1 轮（5 张）：XHG8 ✓   YPDY ✗   PHXG ✗   SEYJ ✓   FC9C ✗    2/5
第 2 轮（5 张）：K479 ✗   ALCH ✓   ATTL ✗   9RUE ✗   49XR ✗    1/5
合计：首次命中 3/10 = 30%
```

结论：**能读，但一次读对的概率只有三成**，错例集中在连笔造成的字形歧义
（K/X、4/A、0/O、9/g）和那条横穿全图的干扰线。

这对登录流程的含义是：单图 30% 并不等于登录成功率 30%，因为**读错只损失一张图**，
不是损失一次登录机会。默认重试 5 次：

| 单图命中率 | 5 次重试 | 10 次重试 |
| --- | --- | --- |
| 30% | 83% | 97% |
| 60% | 99% | ≈100% |

所以 `login` 的语义是「失败 → 换新会话 + 新图 → 再来」，不需要人介入；读图能力本身
只决定要来回几次，不决定能不能登进去。

## 实现落点

工作区 `mcp/libseat/`（整个 `/mcp/` 已 gitignore，运行时安装，不入库）：

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | stdio MCP server，16 个 `libseat_*` 工具 |
| `session.mjs` | 会话状态机：换图重试、401 自动重登、人工读图的两步握手 |
| `http.mjs` | 内存 cookie jar + 请求层（含 `/op/*` 的 `Idempotent-Token`） |
| `captcha.mjs` | 抓图、落盘、manifest、可插拔求解（command / http / manual / none） |
| `api.mjs` `flows.mjs` | 接口表 + 探针流程（含时间窗格式归一） |
| `doctor.mjs` | 自检 CLI：配置、公共接口、抓图、真实登录、求解器探针 |
| `readcheck.mjs` | 读图能力自测：`capture N` / `submit CODE…`，输出命中率 |
| `smoke.mjs` | MCP 协议层烟雾测试（initialize / tools/list / tools/call） |
| `install.sh` | 运行时安装：装依赖、生成 `.env`、注册到 Codex、自检 |
| `solvers/ddddocr_cli.py` | 求解器接口契约的参考实现（不保证命中率） |

抓到的每张图都留三件套：**字节确定的图 + 它的 JSESSIONID + 那次登录判定**，
写成 `captcha-samples/<时间戳>-<sha256前8位>.jpg` 与 `manifest.jsonl`，
求解器可以离线回放、调参、算准确率。

安装与生效：

```bash
bash mcp/libseat/install.sh          # 装依赖 + 生成 .env + codex mcp add libseat + 自检
$EDITOR mcp/libseat/.env             # LIBSEAT_USER / LIBSEAT_PASS
node mcp/libseat/doctor.mjs --login  # 真实登录一次
```

软件内置助手侧也接同一份配置（与 `state.json` 同目录的 `mcp.json`，形状见 `docs/AGENT.md`），
工具名会变成 `mcp__seat__*` 这类；`env` 里传 `LIBSEAT_ENV_FILE` 指向 `.env` 即可。
注意助手的自动唤醒轮次不加载任何 MCP 服务器，座位这类服务器只在用户主动发起的对话里连接。

## 复现

```bash
cd mcp/libseat
node doctor.mjs                      # 配置 + 公共接口 + 抓一张验证码
node doctor.mjs --rooms              # 房间与空位
node doctor.mjs --probe 20           # 求解器命中率（确定性判定）
node readcheck.mjs capture 5         # 抓 5 张供人/模型读
node readcheck.mjs submit XXXX YYYY  #  按顺序提交读到的码 → 命中率
node smoke.mjs libseat_rooms '{"query":"研讨间"}'
```

放大读图（120×40 直接看太糊）：

```bash
magick <file>.jpg -colorspace Gray -normalize -filter Lanczos -resize 600% /tmp/cap.png
```

## 扩展方向：把 30% 抬上去

### 已经落地的第一步：ddddocr 基线（44%）

不用等自研模型，通用 OCR 先接上来就有明显收益：

```bash
uv run --python 3.12 --with ddddocr python solvers/ddddocr_cli.py <图片>
```

实测（假探针账号，`--probe 12`，服务端判定为准）：**9 张出码、4 张被接受，单图 44%**，
另外 3 张 ddddocr 只吐了 3 个字符（`R3u`）或吐了个汉字（`又6bc`）——它的字符集包含中文，
需要过滤。两个要点：

- **输出必须转大写**：ddddocr 的大小写不稳定（把真值 `TWCU` 读成 `TwCu`、`P9TV` 读成 `pgtv`），
  而站点校验区分大小写；已确认的正确答案全是大写字母 + 数字，所以统一 `.upper()`。
- **放大预处理没用**：3× Lanczos 之后输出仍是 `)R3u` / `又6bc`，别在这上面花时间。

44% 配 `LIBSEAT_LOGIN_RETRIES=5` 已经是 ≈95% 的登录成功率，验证码这一环不再需要人。

要再往上抬（目标单图 ≥95%），就得自己做求解器。两个方向：

1. **去干扰线预处理**：本站验证码固定带一条横穿图面的直线。按行统计黑像素比例，
   超过阈值的行整体提亮，再二值化 —— 去线后连普通 OCR 都能上一个台阶。
2. **扭曲文字 OCR**：字形是连笔手写体，通用 OCR 不友好，适合用这套
   `capture` 出来的样本训一个小模型（切分 + CNN，或直接 CTC）。

评测已经准备好了，不需要再搭一套：`doctor.mjs --probe N` 与 `readcheck.mjs`
都是拿服务端判定当标签，`manifest.jsonl` 里也留了 `jsessionid` 与判定结果，
可以直接算回归基线。接入方式就是满足 `command`（`{file}` 占位、stdout 出 4 位码）
或 `http` 契约，其余代码不用动。

## 真账号登录实测（2026-10-11）

求解器接上以后，登录链路一路跑到了密码校验那一层：

```
第 3 张 3RPF -> password erro      ← 验证码被接受，账号存在，密码不对
第 1 张 9CAF -> password erro
```

试过的候选密码（用户提供）全部被拒：新门户密码、旧系统的两个候选。
三次都回 `password erro`（不是 `user can not find`，所以**账号本身在系统里是存在的**），
说明这个站点要的是它自己那套凭据，跟门户密码不是一回事。为避免账号被锁，
失败到第 4 次就停了——凭据问题得由本人确认或重置，不该由程序去试。

顺带确认了统一身份认证（CAS）那一侧的情况：

| 探测 | 结果 |
| --- | --- |
| 登录页入口 | 有「统一身份认证登录」按钮 → `/sso/scau/` → 302 `cas.scau.edu.cn/lyuapServer/login` |
| `GET /lyuapServer/kaptcha` | `{"kaptchaType":"1","content":"-1","uid":-1}` —— 看起来是「本次不需要验证码」 |
| `POST /lyuapServer/v1/tickets`（CAS REST） | `500 系统内部错误`，REST 没开 |
| CAS 前端 | 是 SPA（`app.<hash>.js`），登录接口与密码加密方式还得再逆一轮 |

也就是说：**CAS 那条路很可能根本不弹验证码**（kaptchaType=1），代价是要再逆一轮 CAS 的 SPA；
而本地登录这条路的验证码已经被 ddddocr 拿下了，卡点只剩密码本身。

## 边界与未验证

- 已验证：公共接口（房间/时间片/座位）、验证码下发与全部规则、登录链路**一直到账号查询**
  （人工读对码 → `user can not find`）、401 约定、MCP 协议层（16 工具 + 真实取数）。
- 未验证：`due` 提交、`duelist`/`duedetail`、`cancel`/`checkin`/`signout`/`tempout`
  的**成功**分支——它们需要真实账号；字段与路径来自前端 bundle，站点改版时用
  `libseat_api` 逃生舱对一下即可。
- 站方规则（每人每天最多 3 次、开馆时段、开始后 15 分钟内签到、离馆 40 分钟内归位）
  仍然由服务端强制；自动化预约可能与用户协议冲突，先确认学校是否允许，别拿去做高频轮询或帮别人刷座。
