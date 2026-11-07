// 资料预览对话框：图片/音视频内联，PDF 走 iframe，文本与 Markdown 自己排版。
//
// 为什么独立成组件：应试教育页（索引文件）与项目页（已登记资源）都要预览，
// 旧实现各写一份，结果一个把 .md 丢进 iframe（浏览器按纯文本显示，表格挤成
// 一行），另一个连下载按钮都没有。这里统一：能内联的内联、文本走
// `Markdown` 渲染、其余给下载，并保留「用系统应用打开」的降级说明。
//
// 文本读取有上限（TEXT_LIMIT）：资料里几百页的 PDF 不读，但 2 MiB 以内的
// md/txt/csv 足够；超过就退回 iframe/下载，不把大文件塞进内存。

import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "./copy.js";
import { Modal, Btn, Skeleton } from "./ui.js";
import { Markdown } from "./markdown.js";

registerCopy("preview", {
  zh: {
    size: "大小",
    download: "下载原件",
    close: "关闭",
    unsupported: "这种类型或大小不能内联预览，请下载原件。",
    failed: "读取失败：{error}",
    tooLarge: "文件太大，不适合内联预览",
  },
  en: {
    size: "Size",
    download: "Download",
    close: "Close",
    unsupported:
      "This type or size cannot be previewed inline; download the file.",
    failed: "Could not read the file: {error}",
    tooLarge: "File is too large to preview inline",
  },
  ja: {
    size: "サイズ",
    download: "Download",
    close: "Close",
    unsupported:
      "This type or size cannot be previewed inline; download the file.",
    failed: "Could not read the file: {error}",
    tooLarge: "File is too large to preview inline",
  },
});

const TEXT_LIMIT = 2 * 1024 * 1024;

function isTextKind(kind, name) {
  const ext =
    String(name ?? "")
      .split(".")
      .pop()
      ?.toLowerCase() ?? "";
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (["txt", "csv", "json", "log", "yml", "yaml"].includes(ext)) return "text";
  if (
    kind === "doc" &&
    ["md", "markdown", "txt", "csv", "json"].includes(ext)
  ) {
    return ext === "md" || ext === "markdown" ? "markdown" : "text";
  }
  return null;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.name 文件名
 * @param {string} [props.kind] image/audio/video/pdf/doc/other
 * @param {number} [props.sizeBytes]
 * @param {string} [props.viewUrl] 内联读取地址（带 access token）
 * @param {string} [props.downloadUrl] 下载地址
 * @param {boolean} [props.previewable]
 * @param {string} [props.emptyHint] 不可预览时的说明
 */
export function FilePreview({
  open,
  onClose,
  name,
  kind = "other",
  sizeBytes,
  viewUrl,
  downloadUrl,
  previewable = true,
  emptyHint,
}) {
  const mode = isTextKind(kind, name);
  const [text, setText] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || mode === null || !previewable || !viewUrl) {
      setText(null);
      setError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setText(null);
    fetch(viewUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (blob.size > TEXT_LIMIT) throw new Error(t("preview.tooLarge"));
        return blob.text();
      })
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e && e.message ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, previewable, viewUrl, name]);

  if (!open) return null;

  let body;
  if (!previewable) {
    body = h(
      "div",
      { style: { fontSize: 12.5, color: "var(--tomato-ink-2)" } },
      emptyHint || t("preview.unsupported"),
    );
  } else if (mode !== null) {
    if (loading) body = h(Skeleton, { w: "100%", h: 240 });
    else if (error !== "")
      body = h(
        "div",
        { style: { fontSize: 12.5, color: "var(--tomato-brand-deep)" } },
        t("preview.failed", { error }),
      );
    else if (mode === "markdown")
      body = h(
        "div",
        { style: { maxHeight: "68vh", overflow: "auto", paddingRight: 6 } },
        h(Markdown, { text: text ?? "" }),
      );
    else
      body = h(
        "pre",
        {
          style: {
            maxHeight: "68vh",
            overflow: "auto",
            margin: 0,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--tomato-surface-2)",
            fontSize: 12.5,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          },
        },
        text ?? "",
      );
  } else if (kind === "image") {
    body = h("img", {
      src: viewUrl,
      alt: name,
      style: {
        display: "block",
        maxWidth: "100%",
        maxHeight: "68vh",
        margin: "0 auto",
        borderRadius: 8,
      },
    });
  } else if (kind === "audio") {
    body = h("audio", {
      controls: true,
      src: viewUrl,
      style: { width: "100%" },
    });
  } else if (kind === "video") {
    body = h("video", {
      controls: true,
      src: viewUrl,
      style: { display: "block", maxWidth: "100%", maxHeight: "68vh" },
    });
  } else {
    body = h("iframe", {
      title: name,
      src: viewUrl,
      style: {
        width: "100%",
        height: "68vh",
        border: "none",
        borderRadius: 8,
        background: "#fff",
      },
    });
  }

  return h(
    Modal,
    {
      open,
      onClose,
      icon: "eye",
      title: name,
      subtitle: `${t("preview.size")} ${formatBytes(sizeBytes)}`,
      width: 920,
      bodyStyle: { paddingTop: 6 },
      footer: h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          },
        },
        downloadUrl
          ? h(
              "a",
              {
                href: downloadUrl,
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--tomato-brand-deep)",
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 9,
                  background: "var(--tomato-brand-soft)",
                },
              },
              t("preview.download"),
            )
          : null,
        h(
          Btn,
          { variant: "ghost", size: "sm", onClick: onClose },
          t("preview.close"),
        ),
      ),
    },
    body,
  );
}
