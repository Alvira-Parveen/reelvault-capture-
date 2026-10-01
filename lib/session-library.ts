export type SessionLibraryItem = { id: string; name?: string; duration: number; createdAt: string };

export function renameSession<T extends SessionLibraryItem>(sessions: T[], id: string, name: string): T[] {
  const trimmed = name.trim();
  if (!trimmed) return sessions;
  return sessions.map((session) => session.id === id ? { ...session, name: trimmed } : session);
}

export function deleteSession<T extends SessionLibraryItem>(sessions: T[], id: string): T[] {
  return sessions.filter((session) => session.id !== id);
}

export function searchSessions<T extends SessionLibraryItem>(sessions: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sessions;
  return sessions.filter((session) => `${session.name || ""} ${session.duration} ${session.createdAt}`.toLowerCase().includes(normalized));
}
