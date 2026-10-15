import { agentCall, saveAgentFile } from "./api";
import { chatEscape as esc, type ChatAttachment } from "./agent-chat";

type ImageFile = { attachment: ChatAttachment; data: string };
const cache = new Map<string, ImageFile>();
const loading = new Map<string, Promise<ImageFile>>();
async function imageFile(id: string): Promise<ImageFile> {
  const saved = cache.get(id);
  if (saved) return saved;
  let request = loading.get(id);
  if (!request) {
    request = agentCall<ImageFile>({ op: "download_attachment", id })
      .then((file) => {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(
            file.attachment.mimeType,
          )
        )
          throw new Error("该附件不是可预览的图片");
        cache.set(id, file);
        return file;
      })
      .finally(() => loading.delete(id));
    loading.set(id, request);
  }
  return request;
}
const source = (file: ImageFile) =>
  `data:${file.attachment.mimeType};base64,${file.data}`;
export function hydrateAgentImages() {
  document
    .querySelectorAll<HTMLImageElement>("#agent-root img[data-image-id]")
    .forEach((img) => {
      if (img.dataset.loading) return;
      img.dataset.loading = "true";
      void imageFile(img.dataset.imageId!)
        .then((file) => {
          if (img.isConnected) img.src = source(file);
        })
        .catch(() => {
          img.alt = "预览加载失败，点击可重试";
        });
    });
}
export async function previewAgentImage(
  id: string,
  reuse: (attachment: ChatAttachment) => void,
  toast: (text: string) => void,
) {
  const file = await imageFile(id),
    previous = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog");
  dialog.className = "agent-image-viewer";
  dialog.setAttribute("aria-label", `图片预览：${file.attachment.name}`);
  dialog.innerHTML = `<header><strong>${esc(file.attachment.name)}</strong><button type="button" class="button small" data-image-action="download">下载</button><button type="button" class="button small" data-image-action="edit">用于图片编辑</button><button type="button" class="button small" data-image-action="close">关闭</button></header><p class="error" role="alert" hidden></p><img src="${source(file)}" alt="${esc(file.attachment.name)}">`;
  const report = (error: unknown) => {
    const alert = dialog.querySelector<HTMLElement>('[role="alert"]')!;
    alert.hidden = false;
    alert.textContent = String(error);
    toast(String(error));
  };
  dialog.addEventListener("click", (event) => {
    const name = (event.target as Element).closest<HTMLElement>(
      "[data-image-action]",
    )?.dataset.imageAction;
    if (name === "close") dialog.close();
    if (name === "edit") {
      try {
        reuse({ ...file.attachment, preview: source(file) });
        dialog.close();
      } catch (error) {
        report(error);
      }
    }
    if (name === "download") {
      const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
      void saveAgentFile(
        bytes.buffer,
        file.attachment.name,
        file.attachment.mimeType,
      ).catch(report);
    }
  });
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      previous?.focus();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
}
