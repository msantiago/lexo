import { useEffect, useState } from "react";
import type {
  GameHistoryDetail,
  GameHistoryItem,
  ProfilePayload,
  WordFreq,
  WordStatsPayload,
} from "@shared/account";
import type { RoundSummary, SharedWord, SummaryWord, WordRecap } from "@shared/types";
import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeView } from "@shared/badges";
import { parseDailyGameId } from "@shared/daily";
import { difficultyLabel } from "@shared/rules";
import type { Cell } from "@shared/types";
import Avatar from "../components/Avatar";
import { BadgeButton } from "../components/BadgeDialog";
import ProfileStats, { gamesFor, wordStatsFor, type StatsMode } from "../components/ProfileStats";
import type { Crumb } from "../components/Breadcrumb";
import WordTables, { PossibleWords } from "../components/WordTables";
import WordLink from "../components/WordLink";
import { authClient, displayNameFromUser } from "../lib/auth-client";
import Preferences from "./Preferences";

type Tab = "badges" | "words" | "games";
type View = "profile" | "preferences";

type Props = {
  onBack?: () => void;
  onDisplayName: (name: string) => void;
  onSignOut?: () => void;
  onTrail?: (crumbs: Crumb[]) => void;
  resetRequest?: number;
};

export default function Profile({ onBack, onDisplayName, onSignOut, onTrail, resetRequest = 0 }: Props) {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<Tab>("badges");
  const [statsMode, setStatsMode] = useState<StatsMode>("all");
  const [view, setView] = useState<View>("profile");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameHistoryDetail | null>(null);

  useEffect(() => {
    setGame(null);
    setView("profile");
  }, [resetRequest]);

  useEffect(() => {
    if (!onTrail) return;
    if (view === "preferences") {
      onTrail([
        { label: "Compte", onClick: () => setView("profile") },
        { label: "Préférences" },
      ]);
      return () => onTrail([]);
    }
    if (!game) {
      onTrail([]);
      return;
    }
    onTrail([
      { label: "Compte", onClick: () => setGame(null) },
      {
        label:
          game.kind === "daily" ? "Lexo du jour" : game.solo ? "Partie solo" : "Partie à plusieurs",
      },
    ]);
    return () => onTrail([]);
  }, [game, view, onTrail]);

  const label = displayNameFromUser(session?.user?.name, session?.user?.email);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Impossible de charger le profil.");
        return res.json() as Promise<ProfilePayload>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openGame = async (item: GameHistoryItem) => {
    setError(null);
    const res = await fetch(`/api/me/games/${encodeURIComponent(item.id)}`, {
      credentials: "include",
    });
    if (!res.ok) {
      setError("Impossible d’ouvrir cette partie.");
      return;
    }
    setGame((await res.json()) as GameHistoryDetail);
  };

  if (view === "preferences") {
    return <Preferences onDisplayName={onDisplayName} />;
  }

  if (game) {
    return <GameDetail game={game} />;
  }

  const earnedCount = profile?.badges.filter((b) => b.earned).length ?? 0;

  return (
    <div className="profile">
      <section className="panel profile-hero" aria-label="Ton profil">
        <div className="profile-head">
          {onBack && (
            <button className="nav-back" type="button" onClick={onBack}>
              Retour
            </button>
          )}
          <div className="profile-identity">
            <Avatar className="account-avatar" name={label} image={session?.user?.image} />
            <div className="meta">
              <h1>{label}</h1>
              {session?.user?.email && <span>{session.user.email}</span>}
            </div>
          </div>
          <div className="profile-head-actions">
            <button className="text-action" type="button" onClick={() => setView("preferences")}>
              Préférences
            </button>
            {onSignOut && (
              <button className="text-action" type="button" onClick={onSignOut}>
                Déconnexion
              </button>
            )}
          </div>
        </div>
        {profile && (
          <ProfileStats
            stats={profile.stats}
            modes={profile.modes}
            mode={statsMode}
            onModeChange={setStatsMode}
          />
        )}
      </section>

      {error && <p className="account-error">{error}</p>}

      <div className="account-tabs profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`chip ${tab === "badges" ? "on" : ""}`}
          aria-selected={tab === "badges"}
          onClick={() => setTab("badges")}
        >
          Badges {profile ? `(${earnedCount}/${profile.badges.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          className={`chip ${tab === "words" ? "on" : ""}`}
          aria-selected={tab === "words"}
          onClick={() => setTab("words")}
        >
          Mots {profile ? `(${wordStatsFor(profile, statsMode).distinct})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          className={`chip ${tab === "games" ? "on" : ""}`}
          aria-selected={tab === "games"}
          onClick={() => setTab("games")}
        >
          Parties {profile ? `(${gamesFor(profile.games, statsMode).length})` : ""}
        </button>
      </div>

      {!profile && !error && <p className="hint">Chargement…</p>}

      {profile && tab === "badges" && <BadgeBoard badges={profile.badges} />}
      {profile && tab === "words" && (
        <WordStatsBoard stats={wordStatsFor(profile, statsMode)} mode={statsMode} />
      )}
      {profile && tab === "games" && (
        <GameList games={gamesFor(profile.games, statsMode)} mode={statsMode} onOpen={openGame} />
      )}
    </div>
  );
}



export function WordStatsBoard({
  stats,
  mode = "all",
  voice = "self",
}: {
  stats: WordStatsPayload;
  mode?: StatsMode;
  voice?: "self" | "public";
}) {
  if (stats.total === 0) {
    return (
      <p className="hint">
        {mode === "solo"
          ? "Aucun mot validé en solo pour l’instant."
          : mode === "multi"
            ? "Aucun mot validé à plusieurs pour l’instant."
            : voice === "public"
              ? "Pas encore de stats de mots."
              : "Tes stats de mots apparaîtront ici. Joue connecté pour suivre tes fréquences, longueurs et lettres favorites."}
      </p>
    );
  }

  const maxLengthCount = Math.max(1, ...stats.byLength.map((bucket) => bucket.count));
  const maxInitialCount = Math.max(1, ...stats.byInitial.map((bucket) => bucket.count));

  return (
    <div className="word-stats">
      <section className="panel word-stats-summary">
        {mode !== "all" && (
          <p className="daily-kicker">{mode === "solo" ? "Parties solo" : "Parties à plusieurs"}</p>
        )}
        <p>
          <b>{stats.total}</b> mot{stats.total > 1 ? "s" : ""} validé{stats.total > 1 ? "s" : ""} ·{" "}
          <b>{stats.distinct}</b> distinct{stats.distinct > 1 ? "s" : ""} · longueur moyenne{" "}
          <b>{stats.averageLength.toLocaleString("fr-FR")}</b> lettre
          {stats.averageLength > 1 ? "s" : ""}
        </p>
        <p className="muted">
          {mode === "solo" ? (
            <>{stats.quCount} avec Qu</>
          ) : (
            <>
              {stats.uniqueCount} trouvé{stats.uniqueCount > 1 ? "s" : ""} sans personne d’autre ·{" "}
              {stats.sharedCount} partagé{stats.sharedCount > 1 ? "s" : ""} · {stats.quCount} avec Qu
            </>
          )}
        </p>
      </section>

      <div className="word-stats-grid">
        <section className="panel">
          <h2>Fréquence</h2>
          <p className="muted word-stats-help">
            {voice === "public"
              ? "Mots validés sur plusieurs grilles."
              : "Les mots que tu as validés sur plusieurs grilles."}
          </p>
          {stats.mostFrequent.length === 0 ? (
            <p className="hint">
              Aucun mot n’est encore sorti deux fois. Chaque manche a un nouveau tirage, donc les
              répétitions n’apparaissent qu’après plusieurs parties.
            </p>
          ) : (
            <WordRankList words={stats.mostFrequent} mode="count" />
          )}
        </section>

        <section className="panel">
          <h2>Longueur</h2>
          <p className="muted word-stats-help">
            {voice === "public"
              ? "Répartition des mots selon le nombre de lettres."
              : "Répartition de tes mots selon le nombre de lettres."}
          </p>
          <BarList
            items={stats.byLength
              .filter((bucket) => bucket.count > 0 || (bucket.length >= 3 && bucket.length <= 8))
              .map((bucket) => ({
                key: String(bucket.length),
                label: `${bucket.length}`,
                value: bucket.count,
                hint: bucket.count
                  ? `${bucket.points} pt${bucket.points > 1 ? "s" : ""}`
                  : undefined,
              }))}
            max={maxLengthCount}
          />
        </section>

        <section className="panel">
          <h2>Première lettre</h2>
          <p className="muted word-stats-help">
            {voice === "public"
              ? "Lettre initiale des mots validés."
              : "Par quelle lettre tes mots commencent le plus."}
          </p>
          {stats.byInitial.length === 0 ? (
            <p className="hint">Pas encore de données.</p>
          ) : (
            <BarList
              items={stats.byInitial.map((bucket) => ({
                key: bucket.letter,
                label: bucket.letter,
                value: bucket.count,
              }))}
              max={maxInitialCount}
            />
          )}
        </section>

        <section className="panel">
          <h2>Plus longs</h2>
          <p className="muted word-stats-help">
            {voice === "public"
              ? "Records de longueur."
              : "Tes records de longueur."}
          </p>
          <WordRankList words={stats.longest} mode="length" />
        </section>

        <section className="panel word-stats-span">
          <h2>Les plus rentables</h2>
          <p className="muted word-stats-help">
            {voice === "public"
              ? "Mots qui ont rapporté le plus de points au total (occurrences cumulées)."
              : "Mots qui t’ont rapporté le plus de points au total (occurrences cumulées)."}
          </p>
          <WordRankList words={stats.richest} mode="points" />
        </section>
      </div>
    </div>
  );
}

function WordRankList({
  words,
  mode,
}: {
  words: WordFreq[];
  mode: "count" | "length" | "points";
}) {
  if (words.length === 0) {
    return <p className="hint">Pas encore de mots.</p>;
  }
  return (
    <div className="recap-table-wrap">
      <table className="recap-table rank-table">
        <tbody>
          {words.map((word, index) => (
            <tr key={word.key}>
              <td>{index + 1}</td>
              <td>
                <WordLink word={word.display} />
              </td>
              <td className="recap-pts">
                {mode === "count" && (
                  <>
                    {word.count}× · {word.letters} l.
                  </>
                )}
                {mode === "length" && (
                  <>
                    {word.letters} lettre{word.letters > 1 ? "s" : ""}
                    {word.count > 1 ? ` · ${word.count}×` : ""}
                  </>
                )}
                {mode === "points" && (
                  <>
                    {word.points} pt{word.points > 1 ? "s" : ""}
                    {word.count > 1 ? ` · ${word.count}×` : ""}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarList({
  items,
  max,
}: {
  items: { key: string; label: string; value: number; hint?: string }[];
  max: number;
}) {
  return (
    <ul className="stat-bars">
      {items.map((item) => (
        <li key={item.key} className="stat-bar">
          <span className="stat-bar-label">{item.label}</span>
          <span className="stat-bar-track" aria-hidden>
            <i style={{ width: `${Math.max(item.value === 0 ? 0 : 6, (item.value / max) * 100)}%` }} />
          </span>
          <b>{item.value}</b>
          {item.hint ? <span className="stat-bar-hint">{item.hint}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function BadgeBoard({ badges }: { badges: BadgeView[] }) {
  const categories: BadgeCategory[] = ["welcome", "games", "words", "score", "length", "special"];
  return (
    <div className="badge-board">
      {categories.map((category) => {
        const items = badges.filter((badge) => badge.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="panel badge-group">
            <h2>{BADGE_CATEGORY_LABELS[category]}</h2>
            <ul className="badge-grid">
              {items.map((badge) => {
                const body = (
                  <>
                    <span className="badge-icon" aria-hidden>
                      {badge.icon}
                    </span>
                    <strong>{badge.title}</strong>
                    <span className="badge-desc">{badge.description}</span>
                  </>
                );
                return (
                  <li key={badge.id}>
                    {badge.earned ? (
                      <BadgeButton badge={badge} className="badge-card earned">
                        {body}
                      </BadgeButton>
                    ) : (
                      <div className="badge-card locked" title={badge.description}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function GameList({
  games,
  onOpen,
  mode = "all",
  voice = "self",
}: {
  games: GameHistoryItem[];
  onOpen: (game: GameHistoryItem) => void;
  mode?: StatsMode;
  voice?: "self" | "public";
}) {
  if (games.length === 0) {
    return (
      <p className="hint">
        {mode === "solo"
          ? "Aucune partie solo enregistrée."
          : mode === "multi"
            ? "Aucune partie à plusieurs enregistrée."
            : voice === "public"
              ? "Aucune partie enregistrée."
              : "Tes parties enregistrées apparaîtront ici. Joue connecté pour les retrouver plus tard."}
      </p>
    );
  }
  return (
    <ul className="history-list">
      {games.map((game) => (
        <li key={game.id}>
          <button className="history-card" type="button" onClick={() => onOpen(game)}>
            <div className="history-card-head">
              <span
                className={`lobby-room-phase ${
                  game.kind === "daily" ? "results" : game.solo ? "waiting" : "started"
                }`}
              >
                {game.kind === "daily" ? "Lexo du jour" : game.solo ? "Solo" : "Multijoueur"}
              </span>
              <span className="muted">
                {game.kind === "daily"
                  ? formatDailyDay(game.id)
                  : `${game.roundCount} manche${game.roundCount > 1 ? "s" : ""} · ${difficultyLabel(game.difficulty)}`}
              </span>
              <time className="muted" dateTime={new Date(game.updatedAt).toISOString()}>
                {formatWhen(game.updatedAt)}
              </time>
            </div>
            <ul className="lobby-room-players scored">
              {game.players.map((p) => (
                <li className="lobby-room-player" key={`${game.id}-${p.name}-${p.color}`}>
                  <span className="avatar" style={{ background: p.color }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <strong>
                    {p.name}
                    {p.you && voice === "self" ? " (toi)" : ""}
                  </strong>
                  <span className="lobby-room-score">{p.score} pts</span>
                </li>
              ))}
            </ul>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function GameDetail({
  game,
  voice = "self",
}: {
  game: GameHistoryDetail;
  voice?: "self" | "public";
}) {
  const daily = game.kind === "daily";
  return (
    <div className="profile profile-detail">
      <div className="profile-head">
        <h1>
          {daily ? "Lexo du jour" : game.solo ? "Partie solo" : "Partie à plusieurs"}
        </h1>
      </div>
      <p className="hint">
        {daily
          ? `${formatDailyDay(game.id)} · ${difficultyLabel(game.settings.difficulty)}`
          : `${difficultyLabel(game.settings.difficulty)} · ${game.rounds.length} manche${
              game.rounds.length > 1 ? "s" : ""
            }`}
      </p>
      {game.rounds.map((round) => {
        const summary = withEntryOrder(round.summary ?? summaryFromRecap(round.recap), round.recap);
        return (
          <section className="panel history-round" key={round.round}>
            <h2>{daily ? "Grille du jour" : `Manche ${round.round}`}</h2>
            <div className="history-round-body">
              {round.grid && <MiniGrid grid={round.grid} />}
              <ul className="lobby-room-players scored">
                {round.players.map((p) => (
                  <li className="lobby-room-player" key={`${round.round}-${p.name}-${p.color}`}>
                    <span className="avatar" style={{ background: p.color }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>
                      {p.name}
                      {p.you && voice === "self" ? " (toi)" : ""}
                    </strong>
                    <span className="lobby-room-score">{p.score} pts</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="history-words">
              <h3 className="recap-title">Synthèse de la manche</h3>
              <WordTables summary={summary} />
              {round.summary && <PossibleWords summary={round.summary} collapsible />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function withEntryOrder(summary: RoundSummary, recap: WordRecap[]): RoundSummary {
  const known = [...summary.unique, ...summary.shared, ...(summary.rejected ?? [])].some(
    (word) => word.order != null,
  );
  if (known) return summary;
  const orderByKey = new Map<string, number>();
  let next = 0;
  for (const block of recap) {
    for (const word of [...block.words].reverse()) {
      if (!orderByKey.has(word.key)) orderByKey.set(word.key, next++);
    }
  }
  const stamp = <T extends { key: string }>(word: T) => ({
    ...word,
    order: orderByKey.get(word.key),
  });
  return {
    ...summary,
    unique: summary.unique.map(stamp),
    shared: summary.shared.map(stamp),
    rejected: (summary.rejected ?? []).map(stamp),
  };
}

function summaryFromRecap(recap: WordRecap[]): RoundSummary {
  const unique: SummaryWord[] = [];
  const shared = new Map<string, SharedWord>();
  let next = 0;
  for (const block of recap) {
    for (const word of [...block.words].reverse()) {
      if (word.shared) {
        const existing = shared.get(word.key);
        if (existing) {
          existing.names.push({ name: block.name, color: block.color });
          existing.playerIds.push(block.playerId);
        } else {
          shared.set(word.key, {
            key: word.key,
            display: word.display,
            letters: word.letters,
            names: [{ name: block.name, color: block.color }],
            playerIds: [block.playerId],
            likedBy: [],
            order: next++,
          });
        }
      } else {
        unique.push({
          key: `${block.playerId}-${word.key}`,
          display: word.display,
          letters: word.letters,
          points: word.points,
          playerId: block.playerId,
          name: block.name,
          color: block.color,
          likedBy: [],
          order: next++,
        });
      }
    }
  }
  return {
    unique,
    shared: [...shared.values()],
    rejected: [],
    missed: [],
    possibleCount: 0,
  };
}

function MiniGrid({ grid }: { grid: Cell[] }) {
  return (
    <div className="mini-board" aria-label="Grille de la manche">
      {grid.map((cell, i) => (
        <div key={i} className={`mini-die ${cell.letter === "QU" ? "qu" : ""}`}>
          <span className="die-face" style={{ transform: `rotate(${cell.rotation}deg)` }}>
            {cell.display}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fr", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function formatDailyDay(gameId: string): string {
  const day = parseDailyGameId(gameId);
  if (!day) return "Lexo du jour";
  const [year, month, date] = day.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("fr", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, (month || 1) - 1, date || 1)));
  } catch {
    return day;
  }
}
