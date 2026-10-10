import type { SoundCue } from "./audio";
import type { Snapshot } from "./types";

export function pendingTaskReminder(snapshot: Snapshot) {
  const timer = snapshot.data.timer;
  if (
    timer.running ||
    timer.startedAt !== null ||
    timer.remainingSecs !== timer.durationSecs ||
    snapshot.data.lock.active
  )
    return undefined;
  return snapshot.data.tasks
    .filter((t) => !t.completed && t.reminderPending)
    .sort((a, b) =>
      `${a.dueDate} ${a.reminderTime} ${a.id}`.localeCompare(
        `${b.dueDate} ${b.reminderTime} ${b.id}`,
      ),
    )[0];
}

function reminderKey(snapshot: Snapshot) {
  const task = pendingTaskReminder(snapshot);
  return task ? `${task.id}/${task.dueDate}/${task.reminderTime}` : "";
}

// Choose one cue per snapshot. Completion wins over auto-start and reminder
// release, so a phase boundary never produces a stack of bells.
export function soundForTransition(
  previous: Snapshot | undefined,
  next: Snapshot,
  action?: Record<string, unknown>,
): SoundCue | null {
  if (!next.data.settings.sound || next.data.settings.soundVolume <= 0)
    return null;
  if (
    !previous ||
    ["import", "importPlan", "loadExample"].includes(String(action?.type))
  )
    return null;
  const before = previous.data;
  const after = next.data;
  if (!before.lock.active && after.lock.active) return "lockStart";
  if (before.lock.active && !after.lock.active) return "lockEnd";
  if (after.timer.completionSerial > before.timer.completionSerial)
    return after.timer.lastFinishedMode === "focus" ? "focusEnd" : "breakEnd";
  const reminder = reminderKey(next);
  if (reminder && reminder !== reminderKey(previous)) return "reminder";
  // Reward explicit completion, never imports or undoing a check mark.
  if (
    action?.type === "toggleTask" &&
    before.tasks.some((t) => t.id === action.id && !t.completed) &&
    after.tasks.some((t) => t.id === action.id && t.completed)
  )
    return "taskComplete";
  if (!before.timer.running && after.timer.running)
    return before.timer.startedAt !== null &&
      before.timer.mode === after.timer.mode
      ? "resume"
      : after.timer.mode !== "focus"
        ? "breakStart"
        : "start";
  if (
    before.timer.running &&
    !after.timer.running &&
    before.timer.mode === after.timer.mode &&
    after.timer.startedAt !== null
  )
    return "pause";
  if (
    ["resetTimer", "skipTimer", "emergencyUnlock", "setMode"].includes(
      String(action?.type),
    )
  ) {
    if (before.timer.mode !== after.timer.mode && after.timer.mode !== "focus")
      return "breakStart";
    if (before.timer.running || before.timer.startedAt !== null) return "stop";
  }
  return null;
}
