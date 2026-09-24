import { useEffect, useRef, useState } from "react";
import type { GameHistoryDetail, GameHistoryItem, PublicProfile } from "@shared/account";
import Avatar from "../components/Avatar";
import type { Crumb } from "../components/Breadcrumb";
import { WatchButton } from "../components/RoundActions";
import { displayNameFromUser } from "../lib/auth-client";
import { activityLabel, formatJoined } from "../lib/presence";
import { BadgeBoard, GameDetail, GameList, WordStatsBoard } from "./Profile";

type Tab = "badges" | "words" | "games";

type Props = {
  userId: string;
  onBack: () => void;
  onWatch?: (userId: string) => void;
  onTrail?: (crumbs: Crumb[]) => void;
};

export default function UserDetail({ userId, onBack, onWatch, onTrail }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("badges");
  const [game, setGame] = useState<GameHistoryDetail | null>(null);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasData.current = false;
    setProfile(null);
    setError(null);
    setGame(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) throw new Error("Joueur introuvable.");
        const data = (await res.json()) as PublicProfile;
        if (!cancelled) {
          hasData.current = true;
          setProfile(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && !hasData.current) {
          setError(err instanceof Error ? err.message : "Impossible de charger ce joueur.");
        }
      }
    };
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    const timer = window.setInterval(tick, 4000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId]);

  const openGame = async (item: GameHistoryItem) => {
    setError(null);
    const res = await fetch(`/api/users/${userId}/games/${item.id}`);
    if (!res.ok) {
      setError("Impossible d’ouvrir cette partie.");
      return;
    }
    setGame((await res.json()) as GameHistoryDetail);
  };

  const name = displayNameFromUser(profile?.name, null);

  useEffect(() => {
    if (!onTrail) return;
    const crumbs: Crumb[] = [{ label: "Joueurs", onClick: onBack }];
    if (game) {
      crumbs.push({ label: name || "Joueur", onClick: () => setGame(null) });
      crumbs.push({ label: game.solo ? "Partie solo" : "Partie à plusieurs" });
    } else {
      crumbs.push({ label: name || "Joueur" });
    }
    onTrail(crumbs);
    return () => onTrail([]);
  }, [onTrail, onBack, name, game]);

  if (game) {
    return <GameDetail game={game} voice="public" />;
  }

  const earnedCount = profile?.badges.filter((badge) => badge.earned).length ?? 0;
  const activity = profile ? activityLabel(profile.play, profile.online) : null;
  const joined = profile ? formatJoined(profile.createdAt) : "";

  return (
    <div className="profile">
      <section className="panel profile-hero" aria-label={name || "Joueur"}>
        <div className="profile-head">
          <div className="profile-identity">
            <Avatar
              className="account-avatar"
              online={profile?.online}
              name={name}
              image={profile?.image}
            />
            <div className="meta">
              <h1>{profile ? name : "Joueur"}</h1>
              {joined && <span>Inscrit le {joined}</span>}
            </div>
          </div>
          {profile?.play && (
            <div className="user-presence">
              {activity && (
                <span
                  className={`user-play ${profile.play.observing ? "observing" : profile.play.mode}`}
                >
                  {activity}
                </span>
              )}
              {onWatch && <WatchButton onClick={() => onWatch(userId)} />}
            </div>
          )}
        </div>
        {profile && (
          <div className="profile-stats">
            <Stat
              label="Parties"
              value={profile.stats.gamesPlayed}
              hint={partyHint(profile.stats.soloGames, profile.stats.multiGames)}
            />
            <Stat
              label="Mots"
              value={profile.stats.wordsFound}
              hint="Mots validés sur toutes les manches."
            />
            <Stat
              label="Points"
              value={profile.stats.totalPoints}
              hint="Cumul des scores de manches."
            />
            <Stat
              label="Victoires"
              value={profile.stats.wins}
              hint="Premières places en partie à plusieurs."
            />
            <Stat
              label="Manches"
              value={profile.stats.roundsPlayed}
              hint="Grilles jouées jusqu’au bout."
            />
            <Stat
              label="Mot le plus long"
              value={profile.stats.longestWord > 0 ? profile.stats.longestWord : "—"}
              hint={
                profile.stats.longestWord > 0
                  ? `${profile.stats.longestWord} lettre${profile.stats.longestWord > 1 ? "s" : ""} sur un mot validé.`
                  : "Longueur du plus long mot validé."
              }
            />
            <Stat
              label="Meilleure manche"
              value={profile.stats.bestRoundScore}
              hint={
                profile.stats.bestRoundWords > 0
                  ? `${profile.stats.bestRoundScore} pts · ${profile.stats.bestRoundWords} mot${profile.stats.bestRoundWords > 1 ? "s" : ""} sur une grille.`
                  : "Meilleur score sur une seule grille."
              }
            />
            <Stat
              label="Mots uniques"
              value={profile.stats.uniqueWords}
              hint="Mots trouvés sans un autre joueur."
            />
          </div>
        )}
      </section>

      {error && <p className="account-error">{error}</p>}
      {!profile && !error && <p className="hint">Chargement…</p>}

      {profile && (
        <>
          <div className="account-tabs profile-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`chip ${tab === "badges" ? "on" : ""}`}
              aria-selected={tab === "badges"}
              onClick={() => setTab("badges")}
            >
              Badges ({earnedCount}/{profile.badges.length})
            </button>
            <button
              type="button"
              role="tab"
              className={`chip ${tab === "words" ? "on" : ""}`}
              aria-selected={tab === "words"}
              onClick={() => setTab("words")}
            >
              Mots ({profile.wordStats.distinct})
            </button>
            <button
              type="button"
              role="tab"
              className={`chip ${tab === "games" ? "on" : ""}`}
              aria-selected={tab === "games"}
              onClick={() => setTab("games")}
            >
              Parties ({profile.games.length})
            </button>
          </div>
          {tab === "badges" && <BadgeBoard badges={profile.badges} />}
          {tab === "words" && <WordStatsBoard stats={profile.wordStats} voice="public" />}
          {tab === "games" && <GameList games={profile.games} voice="public" onOpen={openGame} />}
        </>
      )}
    </div>
  );
}

function partyHint(soloGames: number, multiGames: number): string {
  const parts: string[] = [];
  if (soloGames) parts.push(`${soloGames} solo`);
  if (multiGames) parts.push(`${multiGames} à plusieurs`);
  return parts.length > 0 ? parts.join(" · ") : "Parties terminées en étant connecté.";
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
      <b>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</b>
      <span>{label}</span>
      <p>{hint}</p>
    </div>
  );
}
