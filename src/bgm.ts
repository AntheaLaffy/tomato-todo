export interface BgmTrack {
  name: string;
  duration: number;
  file: Blob;
}

// Keep the file itself: moving the original must not break a later study session.
async function storage<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tomato-bgm", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("tracks");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("无法打开本地 BGM 存储"));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("tracks", mode);
      const request = operation(transaction.objectStore("tracks"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(new Error("BGM 保存失败，请检查本机存储空间"));
      transaction.onerror = () => {};
    });
  } finally {
    db.close();
  }
}

export function loadBgm(): Promise<BgmTrack | undefined> {
  return storage("readonly", (store) => store.get("homework"));
}

export function removeBgm() {
  return storage("readwrite", (store) => store.delete("homework"));
}

export async function importBgm(file: File): Promise<BgmTrack> {
  // Metadata reads stream the compressed file; decoding an hour into PCM would
  // consume hundreds of megabytes before playback even begins.
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () =>
        reject(
          new Error("无法读取音频，请选择可播放的 MP3、WAV、OGG 或 M4A 文件"),
        );
      audio.src = url;
    });
    if (!Number.isFinite(duration) || duration < 3600)
      throw new Error("写作业 BGM 时长必须至少 1 小时（60 分钟）");
    const track = { name: file.name, duration, file };
    await storage("readwrite", (store) => store.put(track, "homework"));
    return track;
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

let player: HTMLAudioElement | undefined;
let playerUrl: string | undefined;
let playerFile: Blob | undefined;

export async function playBgm(track: BgmTrack, volume: number) {
  if (playerFile !== track.file) {
    stopBgm();
    playerUrl = URL.createObjectURL(track.file);
    player = new Audio(playerUrl);
    player.loop = true;
    playerFile = track.file;
  }
  player!.volume = volume;
  await player!.play();
}

export function pauseBgm() {
  player?.pause();
}

export function setBgmVolume(volume: number) {
  if (player) player.volume = volume;
}

export function stopBgm() {
  player?.pause();
  player?.removeAttribute("src");
  player?.load();
  if (playerUrl) URL.revokeObjectURL(playerUrl);
  player = undefined;
  playerUrl = undefined;
  playerFile = undefined;
}
