import { describe, expect, it } from "vitest";

import { addScroll, createSession, stopRecording, tickCountdown, tickRecording, togglePause } from "../lib/capture-session";

describe("capture session state machine", () => {
  it("moves from countdown into recording after the final tick", () => {
    let state = createSession(30);
    state = tickCountdown(state, 30);
    state = tickCountdown(state, 30);
    expect(state).toEqual({ phase: "countdown", seconds: 1 });
    state = tickCountdown(state, 30);
    expect(state).toEqual({ phase: "recording", remaining: 30, paused: false, scrollCount: 0 });
  });

  it("does not decrement while paused", () => {
    let state = tickCountdown(createSession(30), 30);
    state = tickCountdown(state, 30);
    state = tickCountdown(state, 30);
    state = togglePause(state);
    expect(tickRecording(state)).toEqual(state);
  });

  it("counts explicit swipe actions and completes on stop", () => {
    let state = tickCountdown(createSession(60), 60);
    state = tickCountdown(state, 60);
    state = tickCountdown(state, 60);
    state = addScroll(addScroll(state));
    expect(state.phase === "recording" && state.scrollCount).toBe(2);
    expect(stopRecording(state)).toEqual({ phase: "completed", duration: 60, scrollCount: 2 });
  });

  it("completes naturally when the last second is reached", () => {
    let state = tickCountdown(createSession(1), 1);
    state = tickCountdown(state, 1);
    state = tickCountdown(state, 1);
    expect(tickRecording(state)).toEqual({ phase: "completed", duration: 1, scrollCount: 0 });
  });
});
