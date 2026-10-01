import { describe, expect, it } from "vitest";

import { deleteSession, renameSession, searchSessions } from "../lib/session-library";

const sessions = [
  { id: "a", name: "Morning review", duration: 30, createdAt: "2026-09-10T08:00:00.000Z" },
  { id: "b", duration: 60, createdAt: "2026-09-10T09:00:00.000Z" },
];

describe("session library helpers", () => {
  it("renames a session and trims whitespace", () => {
    expect(renameSession(sessions, "a", "  Commute review  ")[0].name).toBe("Commute review");
  });

  it("deletes only the selected session", () => {
    expect(deleteSession(sessions, "a")).toEqual([sessions[1]]);
  });

  it("searches by name, duration, or timestamp", () => {
    expect(searchSessions(sessions, "morning")).toHaveLength(1);
    expect(searchSessions(sessions, "60")).toHaveLength(1);
    expect(searchSessions(sessions, "   ")).toHaveLength(2);
  });
});
