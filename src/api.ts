import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  AppData,
  DesktopStatus,
  GuardInfo,
  Snapshot,
  PlanFile,
} from "./types";
export const desktop = isTauri();
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
export const getSnapshot = () =>
  desktop ? invoke<Snapshot>("snapshot") : request<Snapshot>("snapshot");
export const dispatch = (action: Record<string, unknown>) =>
  desktop
    ? invoke<Snapshot>("dispatch", { action })
    : request<Snapshot>("action", action);
export const getGuard = () =>
  desktop ? invoke<GuardInfo>("guard_info") : request<GuardInfo>("guard");
export const getDesktopStatus = () => invoke<DesktopStatus>("desktop_status");
export const saveDesktopSettings = (autostart: boolean, closeToTray: boolean) =>
  invoke<DesktopStatus>("save_desktop_settings", { autostart, closeToTray });
export const hideToTray = () => invoke<void>("hide_to_tray");
export const quitApp = () => invoke<void>("quit_app");
export async function exportData(data: AppData): Promise<boolean> {
  if (desktop) return invoke<boolean>("export_data");
  return downloadJson(data, "tomato-todo-backup.json");
}
export async function exportPlan(): Promise<boolean> {
  if (desktop) return invoke<boolean>("export_data", { plan: true });
  return downloadJson(await request<PlanFile>("plan"), "tomato-todo-plan.json");
}
function downloadJson(data: unknown, filename: string): boolean {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export const readImport = () => readJson<AppData>(false);
export const readPlan = () => readJson<PlanFile>(true);
async function readJson<T>(plan: boolean): Promise<T | null> {
  if (desktop) return invoke<T | null>("read_import", { plan });
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("cancel", () => resolve(null));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > 20 * 1024 * 1024)
        return reject(new Error("文件不能超过 20 MB"));
      try {
        resolve(JSON.parse(await file.text()));
      } catch {
        reject(new Error("无法读取 JSON 文件"));
      }
    });
    input.click();
  });
}
