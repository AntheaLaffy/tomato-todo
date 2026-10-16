# 内置角色素材

完整立绘使用《ATRI》官网原始 PNG，按原始比例完整显示，权利归原权利方；Q 版头像使用内置 imagegen，参考用户提供的表情头像与同角色官方立绘生成。头像编码为 512 × 512 WebP，质量 88，保留透明背景。

| 人格 | 生成头像 | 原始立绘 | 来源 |
| --- | --- | --- | --- |
| 小迷妹 | default.webp | atri.png | [官方角色页](https://atri-anime.com/character/atri.html) · [原始 PNG](https://atri-anime.com/assets/img/character/ph/ph_atri.png) |
| 冷静学伴 | calm.webp | natsuki.png | [官方角色页](https://atri-anime.com/character/natsuki.html) · [原始 PNG](https://atri-anime.com/assets/img/character/ph/ph_natsuki.png) |
| 严格教练 | coach.webp | ryuji.png | [官方角色页](https://atri-anime.com/character/ryuji.html) · [原始 PNG](https://atri-anime.com/assets/img/character/ph/ph_ryuji.png) |
| 温柔学姐 | senpai.webp | minamo.png | [官方角色页](https://atri-anime.com/character/minamo.html) · [原始 PNG](https://atri-anime.com/assets/img/character/ph/ph_minamo.png) |

角色卡可展开查看完整立绘。应用背景板默认关闭，在「偏好设置 → 体验与提醒 → 角色背景板」打开；跟随当前人格，沉浸和专注保护界面隐藏，自定义人格没有内置立绘时隐藏。助手通过现有 `get_snapshot` → `dispatch(saveSettings)` 修改 `settings.personaBackdrop`，保留其他设置。

## 生成提示词

每张头像使用下列共同提示词，加上对应人物补充。输入图 1 是用户提供的 Q 版表情头像样式参考，输入图 2 是对应人物的官方立绘；使用内置 imagegen，`transparent_background: true`。

```text
Use case: illustration-story.
Asset type: a square transparent-background chibi reaction avatar for a character card, meant to be immediately readable at 72px.
Image 1 is a STYLE AND PROPORTION REFERENCE from the user: the cute small Atri chibi with an enormous rounded head, tiny narrow shoulders and little upper torso, simple expressive features, fine warm dark outlines and flat soft cel colors. Ignore the surrounding white UI, shadow and text.
Image 2 is the CHARACTER IDENTITY REFERENCE: official standing art. Keep the character's distinctive hair silhouette, hair color, eye color and clothing.
Create a new chibi head-and-tiny-upper-body sticker in the visual language of Image 1. Head is about 75–80% of the character's visible height; shoulders distinctly narrower than the head, tiny neck, compact little body, simplified hands only if needed. Sweet confident anime SD proportions, hand-drawn outlines, restrained flat cel shading, lively readable expression. No realistic broad shoulders, painterly bust portrait, adult realistic anatomy, elaborate gradients, 3D or photorealism.
Composition: exactly one character, centered in a square, full hair and accessories inside the frame with 5% clear margin; upper torso reaches the lower edge, face large and easy to read. Genuinely transparent background. No text, captions, letters, emoji symbols floating outside the character, watermark, logo, frame or UI. Fully clothed and wholesome.
```

### 小迷妹

```text
Atri-inspired 小迷妹: long pale golden-beige hair, tiny navy side ribbons and one ahoge, ivory sailor top with teal collar and red ribbon. Expression like the user's sample: eyes happily closed in a proud smug little 'hmph-hmph' smile, rosy cheeks and confident cheeky delight. Tiny hands on hips or folded close to body; do not widen silhouette.
```

### 冷静学伴

```text
Natsuki-inspired 冷静学伴: charcoal layered hair and central fringe, blue eyes, white collared shirt. Expression: awake, attentive, quietly pleased with a tiny confident smile; naturally open bright focused blue eyes, not sleepy, droopy, blank or lifeless. Tiny neat silhouette. Keep his calm personality in a cute chibi reaction.
```

### 严格教练

```text
Ryuji-inspired 严格教练: short olive-brown hair, olive-green eyes, red athletic tank with dark trim and small cord pendant. Expression: lively determined eyebrow and confident toothy grin, tiny fist raised close to chest in encouraging 'let's do it' pose. Lean tiny body and narrow shoulders; not bulky or bodybuilder proportions, not angry.
```

### 温柔学姐

```text
Minamo-inspired 温柔学姐: rose-red layered shoulder-length hair with side fringe, teal-green eyes, dark sailor blouse with ivory collar and red bow. Expression: warm gentle reassuring smile with bright open eyes and a little blush; tiny hand giving a small wave close to cheek. Shoulders narrower than big chibi head.
```



