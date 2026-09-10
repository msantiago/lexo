import { useEffect, useState, type FormEvent } from "react";
import type {
  GameHistoryDetail,
  GameHistoryItem,
  ProfilePayload,
  WordFreq,
  WordStatsPayload,
} from "@shared/account";
import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeView } from "@shared/badges";
import { difficultyLabel } from "@shared/rules";
import type { Cell } from "@shared/types";
import WordLink from "../components/WordLink";
import { authClient, displayNameFromUser, sanitizePseudo } from "../lib/auth-client";

type Tab = "badges" | "words" | "games";

type Props = {
  onBack: () => void;
  onDisplayName: (name: string) => void;
};

export default function Profile({ onBack, onDisplayName }: Props) {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<Tab>("badges");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameHistoryDetail | null>(null);
  const [nick, setNick] = useState("");
  const [nickBusy, setNickBusy] = useState(false);
  const [nickSaved, setNickSaved] = useState(false);
  const label = displayNameFromUser(session?.user?.name, session?.user?.email);

  useEffect(() => {
    setNick(label);
  }, [label]);

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
    const res = await fetch(`/api/me/games/${item.id}`, { credentials: "include" });
    if (!res.ok) {
      setError("Impossible d’ouvrir cette partie.");
      return;
    }
    setGame((await res.json()) as GameHistoryDetail);
  };

  const saveNick = async (event: FormEvent) => {
    event.preventDefault();
    const next = sanitizePseudo(nick);
    if (!next) {
      setError("Choisis un pseudo (16 caractères max.).");
      return;
    }
    setError(null);
    setNickBusy(true);
    setNickSaved(false);
    try {
      const result = await authClient.updateUser({ name: next });
      if (result.error) {
        setError("Impossible d’enregistrer le pseudo.");
        return;
      }
      setNick(next);
      onDisplayName(next);
      setNickSaved(true);
      window.setTimeout(() => setNickSaved(false), 2200);
    } finally {
      setNickBusy(false);
    }
  };

  if (game) {
    return <GameDetail game={game} onBack={() => setGame(null)} />;
  }

  const earnedCount = profile?.badges.filter((b) => b.earned).length ?? 0;

  return (
    <div className="profile">
      <section className="panel profile-hero" aria-label="Ton profil">
        <div className="profile-head">
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            Retour
          </button>
          <div className="profile-identity">
            <span className="avatar account-avatar">{label.slice(0, 1).toUpperCase()}</span>
            <div className="meta">
              <h1>{label}</h1>
              {session?.user?.email && <span>{session.user.email}</span>}
            </div>
          </div>
        </div>
        <form className="profile-nick" onSubmit={saveNick}>
          <div className="field">
            <label htmlFor="profile-nick">Pseudo</label>
            <input
              id="profile-nick"
              maxLength={16}
              value={nick}
              autoComplete="nickname"
              onChange={(e) => {
                setNick(e.target.value);
                setNickSaved(false);
              }}
            />
          </div>
          <button
            className="btn btn-ivory"
            type="submit"
            disabled={nickBusy || sanitizePseudo(nick) === label || !sanitizePseudo(nick)}
          >
            {nickBusy ? "Enregistrement…" : nickSaved ? "Enregistré" : "Enregistrer"}
          </button>
        </form>
        {profile && (
          <div className="profile-stats">
            <Stat
              label="Parties"
              value={profile.stats.gamesPlayed}
              hint={partyHint(profile.stats)}
            />
            <Stat
              label="Mots"
              value={profile.stats.wordsFound}
              hint="Mots validés sur toutes tes manches, y compris ceux trouvés en même temps qu’un autre joueur."
            />
            <Stat
              label="Points"
              value={profile.stats.totalPoints}
              hint="Cumul de tes scores de manches. Les mots partagés rapportent tout de même leurs points."
            />
            <Stat
              label="Victoires"
              value={profile.stats.wins}
              hint="Nombre de fois où tu as fini premier d’une partie à plusieurs. Le solo ne compte pas."
            />
            <Stat
              label="Manches"
              value={profile.stats.roundsPlayed}
              hint="Grilles jouées jusqu’au bout. Une partie peut contenir plusieurs manches."
            />
            <Stat
              label="Mot le plus long"
              value={profile.stats.longestWord > 0 ? profile.stats.longestWord : "—"}
              hint={
                profile.stats.longestWord > 0
                  ? `${profile.stats.longestWord} lettre${profile.stats.longestWord > 1 ? "s" : ""} sur un seul mot validé.`
                  : "La longueur de ton plus long mot validé apparaîtra ici."
              }
            />
            <Stat
              label="Meilleure manche"
              value={profile.stats.bestRoundScore}
              hint={
                profile.stats.bestRoundWords > 0
                  ? `${profile.stats.bestRoundScore} pts · ${profile.stats.bestRoundWords} mot${profile.stats.bestRoundWords > 1 ? "s" : ""} sur une même grille.`
                  : "Ton meilleur score sur une seule grille."
              }
            />
            <Stat
              label="Mots uniques"
              value={profile.stats.uniqueWords}
              hint="Mots que tu étais seul à trouver. Les mots tapés en même temps que quelqu’un d’autre ne sont pas comptés ici."
            />
          </div>
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
          Mots {profile ? `(${profile.wordStats.distinct})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          className={`chip ${tab === "games" ? "on" : ""}`}
          aria-selected={tab === "games"}
          onClick={() => setTab("games")}
        >
          Parties {profile ? `(${profile.games.length})` : ""}
        </button>
      </div>

      {!profile && !error && <p className="hint">Chargement…</p>}

      {profile && tab === "badges" && <BadgeBoard badges={profile.badges} />}
      {profile && tab === "words" && <WordStatsBoard stats={profile.wordStats} />}
      {profile && tab === "games" && (
        <GameList games={profile.games} onOpen={openGame} />
      )}
    </div>
  );
}

function partyHint(stats: ProfilePayload["stats"]): string {
  const parts: string[] = [];
  if (stats.soloGames) parts.push(`${stats.soloGames} solo`);
  if (stats.multiGames) parts.push(`${stats.multiGames} à plusieurs`);
  if (parts.length === 0) {
    return "Parties terminées pendant que tu étais connecté.";
  }
  return `Terminées en étant connecté · ${parts.join(" · ")}.`;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="profile-stat">
      <b>{value}</b>
      <span>{label}</span>
      <p>{hint}</p>
    </div>
  );
}

function WordStatsBoard({ stats }: { stats: WordStatsPayload }) {
  if (stats.total === 0) {
    return (
      <p className="hint">
        Tes stats de mots apparaîtront ici. Joue connecté pour suivre tes fréquences, longueurs et
        lettres favorites.
      </p>
    );
  }

  const maxLengthCount = Math.max(1, ...stats.byLength.map((bucket) => bucket.count));
  const maxInitialCount = Math.max(1, ...stats.byInitial.map((bucket) => bucket.count));

  return (
    <div className="word-stats">
      <section className="panel word-stats-summary">
        <p>
          <b>{stats.total}</b> mot{stats.total > 1 ? "s" : ""} validé{stats.total > 1 ? "s" : ""} ·{" "}
          <b>{stats.distinct}</b> distinct{stats.distinct > 1 ? "s" : ""} · longueur moyenne{" "}
          <b>{stats.averageLength.toLocaleString("fr-FR")}</b> lettre
          {stats.averageLength > 1 ? "s" : ""}
        </p>
        <p className="muted">
          {stats.uniqueCount} trouvé{stats.uniqueCount > 1 ? "s" : ""} sans personne d’autre ·{" "}
          {stats.sharedCount} partagé{stats.sharedCount > 1 ? "s" : ""} · {stats.quCount} avec Qu
        </p>
      </section>

      <div className="word-stats-grid">
        <section className="panel">
          <h2>Fréquence</h2>
          <p className="muted word-stats-help">Les mots que tu as validés sur plusieurs grilles.</p>
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
          <p className="muted word-stats-help">Répartition de tes mots selon le nombre de lettres.</p>
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
          <p className="muted word-stats-help">Par quelle lettre tes mots commencent le plus.</p>
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
          <p className="muted word-stats-help">Tes records de longueur, toutes parties confondues.</p>
          <WordRankList words={stats.longest} mode="length" />
        </section>

        <section className="panel word-stats-span">
          <h2>Les plus rentables</h2>
          <p className="muted word-stats-help">
            Mots qui t’ont rapporté le plus de points au total (occurrences cumulées).
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
    <ol className="word-rank">
      {words.map((word, index) => (
        <li key={word.key}>
          <span className="word-rank-n">{index + 1}</span>
          <span className="word-rank-word">
            <WordLink word={word.display} />
          </span>
          <span className="word-rank-meta">
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
          </span>
        </li>
      ))}
    </ol>
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

function BadgeBoard({ badges }: { badges: BadgeView[] }) {
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
              {items.map((badge) => (
                <li
                  key={badge.id}
                  className={`badge-card ${badge.earned ? "earned" : "locked"}`}
                  title={badge.description}
                >
                  <span className="badge-icon" aria-hidden>
                    {badge.icon}
                  </span>
                  <strong>{badge.title}</strong>
                  <p>{badge.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function GameList({
  games,
  onOpen,
}: {
  games: GameHistoryItem[];
  onOpen: (game: GameHistoryItem) => void;
}) {
  if (games.length === 0) {
    return (
      <p className="hint">
        Tes parties enregistrées apparaîtront ici. Joue connecté pour les retrouver plus tard.
      </p>
    );
  }
  return (
    <ul className="history-list">
      {games.map((game) => (
        <li key={game.id}>
          <button className="history-card" type="button" onClick={() => onOpen(game)}>
            <div className="history-card-head">
              <span className={`lobby-room-phase ${game.solo ? "waiting" : "started"}`}>
                {game.solo ? "Solo" : "Multijoueur"}
              </span>
              <span className="muted">
                {game.roundCount} manche{game.roundCount > 1 ? "s" : ""} ·{" "}
                {difficultyLabel(game.difficulty)}
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
                    {p.you ? " (toi)" : ""}
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

function GameDetail({ game, onBack }: { game: GameHistoryDetail; onBack: () => void }) {
  return (
    <div className="profile profile-detail">
      <div className="profile-head">
        <button className="btn btn-ghost" type="button" onClick={onBack}>
          Parties
        </button>
        <h1>{game.solo ? "Partie solo" : "Partie à plusieurs"}</h1>
      </div>
      <p className="hint">
        {difficultyLabel(game.settings.difficulty)} · {game.rounds.length} manche
        {game.rounds.length > 1 ? "s" : ""}
      </p>
      {game.rounds.map((round) => (
        <section className="panel history-round" key={round.round}>
          <h2>Manche {round.round}</h2>
          <div className="history-round-body">
            {round.grid && <MiniGrid grid={round.grid} />}
            <div className="history-round-side">
              <ul className="lobby-room-players scored">
                {round.players.map((p) => (
                  <li className="lobby-room-player" key={`${round.round}-${p.name}-${p.color}`}>
                    <span className="avatar" style={{ background: p.color }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>
                      {p.name}
                      {p.you ? " (toi)" : ""}
                    </strong>
                    <span className="lobby-room-score">{p.score} pts</span>
                  </li>
                ))}
              </ul>
              {round.recap.map((block) => (
                <div key={block.playerId} className="recap-block">
                  <div className="recap-player">
                    <span className="avatar" style={{ background: block.color, width: 28, height: 28 }}>
                      {block.name.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{block.name}</strong>
                    <span className="muted">
                      {block.words.length} mot{block.words.length > 1 ? "s" : ""} · {block.roundScore} pts
                    </span>
                  </div>
                  <ul className="words recap-words">
                    {block.words.length === 0 && <li className="muted">Aucun mot</li>}
                    {block.words.map((w) => (
                      <li key={w.key} className={w.shared ? "shared" : ""}>
                        <span>
                          <WordLink word={w.display} />
                        </span>
                        <em>{w.points}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
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
