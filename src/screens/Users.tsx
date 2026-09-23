import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryUser } from "@shared/account";
import Avatar from "../components/Avatar";
import { displayNameFromUser } from "../lib/auth-client";
import { activityLabel } from "../lib/presence";
import UserDetail from "./UserDetail";

type Filter = "all" | "online" | "playing";

type Props = {
  onBack: () => void;
  onWatch?: (userId: string) => void;
};

export default function Users({ onBack, onWatch }: Props) {
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error("Impossible de charger les joueurs.");
        const data = (await res.json()) as DirectoryUser[];
        if (cancelled) return;
        hasData.current = true;
        setUsers(data);
        setError(null);
      } catch {
        if (!cancelled && !hasData.current) setError("Impossible de charger les joueurs.");
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
  }, []);

  const counts = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      online: list.filter((user) => user.online).length,
      playing: list.filter((user) => user.play).length,
    };
  }, [users]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return (users ?? []).filter((user) => {
      if (filter === "online" && !user.online) return false;
      if (filter === "playing" && !user.play) return false;
      if (!needle) return true;
      return displayNameFromUser(user.name, null).toLocaleLowerCase("fr").includes(needle);
    });
  }, [users, filter, query]);

  if (selectedId) {
    return (
      <UserDetail
        userId={selectedId}
        onBack={() => setSelectedId(null)}
        onWatch={onWatch}
      />
    );
  }

  return (
    <div className="users-page">
      <section className="panel users-hero">
        <div className="profile-head">
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            Retour
          </button>
          <div className="profile-identity">
            <div className="meta">
              <h1>Joueurs</h1>
              <span>
                {users
                  ? `${counts.total} compte${counts.total > 1 ? "s" : ""} · ${counts.online} en ligne · ${counts.playing} en jeu`
                  : "Comptes enregistrés, présence et stats"}
              </span>
            </div>
          </div>
        </div>
        <div className="users-tools">
          <div className="account-tabs" role="tablist">
            <FilterChip label="Tous" count={counts.total} on={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip
              label="En ligne"
              count={counts.online}
              on={filter === "online"}
              onClick={() => setFilter("online")}
            />
            <FilterChip
              label="En jeu"
              count={counts.playing}
              on={filter === "playing"}
              onClick={() => setFilter("playing")}
            />
          </div>
          <div className="field users-search">
            <label htmlFor="users-query">Rechercher</label>
            <input
              id="users-query"
              value={query}
              placeholder="Pseudo"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </section>

      {error && <p className="account-error">{error}</p>}
      {!users && !error && <p className="hint">Chargement des joueurs…</p>}

      {users && visible.length === 0 && (
        <p className="hint">
          {users.length === 0 ? "Aucun compte pour le moment." : "Aucun joueur ne correspond."}
        </p>
      )}

      {visible.length > 0 && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Présence</th>
                <th className="num">Parties</th>
                <th className="num">Mots</th>
                <th className="num">Points</th>
                <th className="num">Victoires</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onOpen={() => setSelectedId(user.id)}
                  onWatch={onWatch ? () => onWatch(user.id) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" role="tab" className={`chip ${on ? "on" : ""}`} aria-selected={on} onClick={onClick}>
      {label} ({count})
    </button>
  );
}

function UserRow({
  user,
  onOpen,
  onWatch,
}: {
  user: DirectoryUser;
  onOpen: () => void;
  onWatch?: () => void;
}) {
  const name = displayNameFromUser(user.name, null);
  const activity = activityLabel(user.play, user.online);
  return (
    <tr className={user.online ? "online" : "offline"}>
      <th scope="row">
        <button className="user-name" type="button" onClick={onOpen}>
          <Avatar className="account-avatar" name={name} image={user.image} />
          <span>
            {user.online && <i className="presence-dot" aria-hidden />}
            {name}
          </span>
        </button>
      </th>
      <td>
        <div className="user-presence">
          <span className={`user-status ${user.online ? "online" : "offline"}`}>
            {user.online ? "En ligne" : "Hors ligne"}
          </span>
          {activity && (
            <span className={`user-play ${user.play?.observing ? "observing" : user.play?.mode ?? "idle"}`}>
              {activity}
            </span>
          )}
          {user.play && onWatch && (
            <button className="btn btn-gold btn-compact" type="button" onClick={onWatch}>
              Regarder
            </button>
          )}
        </div>
      </td>
      <td className="num">{user.stats.gamesPlayed.toLocaleString("fr-FR")}</td>
      <td className="num">{user.stats.wordsFound.toLocaleString("fr-FR")}</td>
      <td className="num">{user.stats.totalPoints.toLocaleString("fr-FR")}</td>
      <td className="num">{user.stats.wins.toLocaleString("fr-FR")}</td>
    </tr>
  );
}
