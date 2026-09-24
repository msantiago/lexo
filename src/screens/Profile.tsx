import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  GameHistoryDetail,
  GameHistoryItem,
  ProfilePayload,
  WordFreq,
  WordStatsPayload,
} from "@shared/account";
import type { RoundSummary, SharedWord, SummaryWord, WordRecap } from "@shared/types";
import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeView } from "@shared/badges";
import {
  AVATAR_PRESETS,
  LETTER_AVATAR_ID,
  PHOTO_AVATAR_ID,
  customAvatarSrc,
  encodeAvatar,
  parseAvatarId,
} from "@shared/avatars";
import { difficultyLabel } from "@shared/rules";
import type { Cell } from "@shared/types";
import Avatar from "../components/Avatar";
import AvatarCropper from "../components/AvatarCropper";
import type { Crumb } from "../components/Breadcrumb";
import WordTables, { PossibleWords } from "../components/WordTables";
import WordLink from "../components/WordLink";
import { authClient, displayNameFromUser, sanitizePseudo } from "../lib/auth-client";
import { loadImageFile } from "../lib/crop-avatar";

type Tab = "badges" | "words" | "games";

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
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameHistoryDetail | null>(null);
  const [nick, setNick] = useState("");
  const [nickBusy, setNickBusy] = useState(false);
  const [nickSaved, setNickSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setGame(null);
  }, [resetRequest]);

  useEffect(() => {
    if (!onTrail) return;
    if (!game) {
      onTrail([]);
      return;
    }
    onTrail([
      { label: "Compte", onClick: () => setGame(null) },
      { label: game.solo ? "Partie solo" : "Partie à plusieurs" },
    ]);
    return () => onTrail([]);
  }, [game, onTrail]);

  const label = displayNameFromUser(session?.user?.name, session?.user?.email);
  const avatarId = parseAvatarId(session?.user?.image);
  const userId = session?.user?.id;
  const photoSrc =
    avatarId === PHOTO_AVATAR_ID && session?.user?.image
      ? session.user.image
      : userId
        ? customAvatarSrc(userId)
        : null;

  useEffect(() => {
    setNick(label);
  }, [label]);

  useEffect(() => {
    if (avatarId === PHOTO_AVATAR_ID) setHasPhoto(true);
  }, [avatarId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Impossible de charger le profil.");
        return res.json() as Promise<ProfilePayload>;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          if (data.hasCustomAvatar) setHasPhoto(true);
        }
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

  const saveAvatar = async (id: string) => {
    if (id === avatarId || avatarBusy) return;
    setError(null);
    setAvatarBusy(true);
    try {
      const image =
        id === PHOTO_AVATAR_ID && userId ? customAvatarSrc(userId, Date.now()) : encodeAvatar(id);
      const result = await authClient.updateUser({ image });
      if (result.error) setError("Impossible d’enregistrer l’avatar.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setCropImage(await loadImageFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire cette image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmPhoto = async (dataUrl: string) => {
    setError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const payload = (await res.json().catch(() => null)) as { image?: string; error?: string } | null;
      if (!res.ok || !payload?.image) {
        setError(payload?.error || "Impossible d’enregistrer la photo.");
        return;
      }
      const result = await authClient.updateUser({ image: payload.image });
      if (result.error) {
        setError("La photo est enregistrée, mais le profil n’a pas été mis à jour.");
        return;
      }
      setHasPhoto(true);
      setCropImage(null);
    } finally {
      setAvatarBusy(false);
    }
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
          {onSignOut && (
            <button className="text-action" type="button" onClick={onSignOut}>
              Déconnexion
            </button>
          )}
        </div>
        <fieldset className="avatar-picker" disabled={avatarBusy}>
          <legend>Avatar</legend>
          <input
            ref={fileRef}
            className="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            aria-label="Importer une image"
            onChange={(e) => void onPhotoFile(e.target.files?.[0])}
          />
          <div className="avatar-options" role="listbox" aria-label="Choisir un avatar">
            {hasPhoto && photoSrc ? (
              <button
                type="button"
                role="option"
                aria-selected={avatarId === PHOTO_AVATAR_ID}
                className={`avatar-option ${avatarId === PHOTO_AVATAR_ID ? "on" : ""}`}
                title="Photo"
                aria-label="Photo"
                onClick={() => saveAvatar(PHOTO_AVATAR_ID)}
              >
                <Avatar name={label} image={photoSrc} />
              </button>
            ) : (
              <button
                type="button"
                className="avatar-option avatar-option-add"
                title="Importer une image"
                aria-label="Importer une image"
                onClick={pickPhoto}
              >
                <span className="avatar avatar-add" aria-hidden>
                  +
                </span>
              </button>
            )}
            <button
              type="button"
              role="option"
              aria-selected={avatarId === LETTER_AVATAR_ID}
              className={`avatar-option ${avatarId === LETTER_AVATAR_ID ? "on" : ""}`}
              title="Initiale"
              aria-label="Initiale"
              onClick={() => saveAvatar(LETTER_AVATAR_ID)}
            >
              <Avatar name={label} image={encodeAvatar(LETTER_AVATAR_ID)} />
            </button>
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={avatarId === preset.id}
                className={`avatar-option ${avatarId === preset.id ? "on" : ""}`}
                title={preset.label}
                aria-label={preset.label}
                onClick={() => saveAvatar(preset.id)}
              >
                <Avatar name={label} image={encodeAvatar(preset.id)} />
              </button>
            ))}
          </div>
          <button className="btn btn-ghost avatar-import" type="button" onClick={pickPhoto}>
            {hasPhoto ? "Changer la photo" : "Importer une image"}
          </button>
        </fieldset>
        {cropImage && (
          <AvatarCropper
            image={cropImage}
            busy={avatarBusy}
            onCancel={() => setCropImage(null)}
            onConfirm={(dataUrl) => void confirmPhoto(dataUrl)}
          />
        )}
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

export function WordStatsBoard({
  stats,
  voice = "self",
}: {
  stats: WordStatsPayload;
  voice?: "self" | "public";
}) {
  if (stats.total === 0) {
    return (
      <p className="hint">
        {voice === "public"
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
              ? "Records de longueur, toutes parties confondues."
              : "Tes records de longueur, toutes parties confondues."}
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

export function GameList({
  games,
  onOpen,
  voice = "self",
}: {
  games: GameHistoryItem[];
  onOpen: (game: GameHistoryItem) => void;
  voice?: "self" | "public";
}) {
  if (games.length === 0) {
    return (
      <p className="hint">
        {voice === "public"
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
  return (
    <div className="profile profile-detail">
      <div className="profile-head">
        <h1>{game.solo ? "Partie solo" : "Partie à plusieurs"}</h1>
      </div>
      <p className="hint">
        {difficultyLabel(game.settings.difficulty)} · {game.rounds.length} manche
        {game.rounds.length > 1 ? "s" : ""}
      </p>
      {game.rounds.map((round) => {
        const summary = round.summary ?? summaryFromRecap(round.recap);
        return (
          <section className="panel history-round" key={round.round}>
            <h2>Manche {round.round}</h2>
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

function summaryFromRecap(recap: WordRecap[]): RoundSummary {
  const unique: SummaryWord[] = [];
  const shared = new Map<string, SharedWord>();
  for (const block of recap) {
    for (const word of block.words) {
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
