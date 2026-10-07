import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "lexo:room-session";

export type RoomSession = { playerId: string; code: string; observing?: boolean };

export async function loadRoomSession(): Promise<RoomSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomSession;
    if (typeof parsed?.playerId !== "string" || typeof parsed?.code !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRoomSession(session: RoomSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearRoomSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function sameRoomSession(a: RoomSession | null, b: RoomSession | null): boolean {
  return Boolean(a && b && a.code === b.code && a.playerId === b.playerId);
}
