import { useEffect, useRef, useState } from "react";
import type { GameHistoryDetail, GameHistoryItem, PublicProfile } from "@shared/account";
import Avatar from "../components/Avatar";
import type { Crumb } from "../components/Breadcrumb";
import ProfileStats, { gamesFor, wordStatsFor, type StatsMode } from "../components/ProfileStats";
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
  const [statsMode, setStatsMode] = useState<StatsMode>("all");
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
    const res = await fetch(`/api/users/${userId}/games/${encodeURIComponent(item.id)}`);
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
      crumbs.push({
        label:
          game.kind === "daily" ? "Lexo du jour" : game.solo ? "Partie solo" : "Partie à plusieurs",
      });
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
          <ProfileStats
            stats={profile.stats}
            modes={profile.modes}
            mode={statsMode}
            onModeChange={setStatsMode} voice="public"
          />
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
              Mots ({wordStatsFor(profile, statsMode).distinct})
            </button>
            <button
              type="button"
              role="tab"
              className={`chip ${tab === "games" ? "on" : ""}`}
              aria-selected={tab === "games"}
              onClick={() => setTab("games")}
            >
              Parties ({gamesFor(profile.games, statsMode).length})
            </button>
          </div>
          {tab === "badges" && <BadgeBoard badges={profile.badges} />}
          {tab === "words" && (
            <WordStatsBoard stats={wordStatsFor(profile, statsMode)} mode={statsMode} voice="public" />
          )}
          {tab === "games" && <GameList games={gamesFor(profile.games, statsMode)} mode={statsMode} voice="public" onOpen={openGame} />}
        </>
      )}
    </div>
  );
}


