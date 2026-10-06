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

/** Titre du palmarès de fin de partie. */
export function matchHeadline(players: readonly { name: string; totalScore: number }[]): string {
  const leaders = leadersByTotalScore(players);
  if (leaders.length <= 1) return `${leaders[0]?.name ?? ""} remporte la partie`;
  return `${joinNames(leaders.map((player) => player.name))} sont ex æquo`;
}
