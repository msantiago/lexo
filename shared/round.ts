export function leadersByRoundScore<T extends { roundScore: number }>(players: readonly T[]): T[] {
  if (players.length === 0) return [];
  const best = Math.max(...players.map((player) => player.roundScore));
  return players.filter((player) => player.roundScore === best);
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** Titre de fin de manche. Une égalité n’est pas départagée par le score de la partie. */
export function roundHeadline(players: readonly { name: string; roundScore: number }[]): string {
  const leaders = leadersByRoundScore(players);
  if (leaders.length <= 1) return `${leaders[0]?.name ?? ""} gagne la manche`;
  return `${joinNames(leaders.map((player) => player.name))} sont ex æquo`;
}

export function leadersByTotalScore<T extends { totalScore: number }>(players: readonly T[]): T[] {
  if (players.length === 0) return [];
  const best = Math.max(...players.map((player) => player.totalScore));
  return players.filter((player) => player.totalScore === best);
}

/**
 * Score de la partie à l’écran.
 * Pendant la manche, le cumul stocké n’inclut pas encore les points en cours.
 */
export function matchScore(totalScore: number, roundScore: number, playing: boolean): number {
  return totalScore + (playing ? roundScore : 0);
}

/** Rang pendant la manche, 1 pour le meilleur score de partie. 0 s’il n’y a pas de classement. */
export function standingRank(
  players: readonly { id: string; totalScore: number; roundScore: number }[],
  playerId: string,
): number {
  if (players.length < 2) return 0;
  const mine = players.find((player) => player.id === playerId);
  if (!mine) return 0;
  const mineScore = matchScore(mine.totalScore, mine.roundScore, true);
  const ahead = players.filter(
    (player) => matchScore(player.totalScore, player.roundScore, true) > mineScore,
  ).length;
  return ahead + 1;
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "1er";
  if (rank > 1) return `${rank}e`;
  return "";
}

/** Titre du palmarès de fin de partie. */
export function matchHeadline(players: readonly { name: string; totalScore: number }[]): string {
  const leaders = leadersByTotalScore(players);
  if (leaders.length <= 1) return `${leaders[0]?.name ?? ""} remporte la partie`;
  return `${joinNames(leaders.map((player) => player.name))} sont ex æquo`;
}
