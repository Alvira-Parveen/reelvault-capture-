export type CaptureState =
  | { phase: "idle" }
  | { phase: "countdown"; seconds: number }
  | { phase: "recording"; remaining: number; paused: boolean; scrollCount: number }
  | { phase: "completed"; duration: number; scrollCount: number };

export function createSession(duration: number): CaptureState {
  return { phase: "countdown", seconds: 3 };
}

export function tickCountdown(state: CaptureState, duration: number): CaptureState {
  if (state.phase !== "countdown") return state;
  return state.seconds > 1 ? { phase: "countdown", seconds: state.seconds - 1 } : { phase: "recording", remaining: duration, paused: false, scrollCount: 0 };
}

export function tickRecording(state: CaptureState): CaptureState {
  if (state.phase !== "recording" || state.paused) return state;
  return state.remaining > 1
    ? { ...state, remaining: state.remaining - 1 }
    : { phase: "completed", duration: 1, scrollCount: state.scrollCount };
}

export function togglePause(state: CaptureState): CaptureState {
  if (state.phase !== "recording") return state;
  return { ...state, paused: !state.paused };
}

export function addScroll(state: CaptureState): CaptureState {
  if (state.phase !== "recording") return state;
  return { ...state, scrollCount: state.scrollCount + 1 };
}

export function stopRecording(state: CaptureState): CaptureState {
  if (state.phase !== "recording") return state;
  return { phase: "completed", duration: Math.max(1, state.remaining), scrollCount: state.scrollCount };
}
