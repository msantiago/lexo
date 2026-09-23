import type { DirectoryPlay, DirectoryStats, DirectoryUser } from "../shared/account.ts";
import { listAuthUsers } from "./auth.ts";
import { listUserSeats } from "./rooms.ts";
import { listAllStats } from "./store.ts";

const EMPTY_STATS: DirectoryStats = {
  gamesPlayed: 0,
  soloGames: 0,
  multiGames: 0,
  wordsFound: 0,
  totalPoints: 0,
  wins: 0,
};

function presenceRank(user: DirectoryUser): number {
  if (user.online && user.play) return 0;
  if (user.online) return 1;
  if (user.play) return 2;
  return 3;
}

export function playFor(userId: string): DirectoryPlay | null {
  const seat = listUserSeats().find((item) => item.userId === userId);
  if (!seat) return null;
  return {
    mode: seat.solo ? "solo" : "room",
    phase: seat.phase,
    observing: seat.observing,
  };
}

export function buildDirectory(onlineUserIds: Iterable<string>): DirectoryUser[] {
  const online = new Set(onlineUserIds);
  const seats = new Map(listUserSeats().map((seat) => [seat.userId, seat]));
  const stats = listAllStats();
  const users = listAuthUsers().map((user) => {
    const seat = seats.get(user.id);
    const row = stats.get(user.id);
    return {
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      online: online.has(user.id),
      play: seat
        ? {
            mode: seat.solo ? ("solo" as const) : ("room" as const),
            phase: seat.phase,
            observing: seat.observing,
          }
        : null,
      stats: row
        ? {
            gamesPlayed: row.gamesPlayed,
            soloGames: row.soloGames,
            multiGames: row.multiGames,
            wordsFound: row.wordsFound,
            totalPoints: row.totalPoints,
            wins: row.wins,
          }
        : { ...EMPTY_STATS },
    };
  });
  users.sort(
    (a, b) => presenceRank(a) - presenceRank(b) || a.name.localeCompare(b.name, "fr"),
  );
  return users;
}
