import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryUser } from "@shared/account";
import Avatar from "../components/Avatar";
import type { Crumb } from "../components/Breadcrumb";
import { WatchButton } from "../components/RoundActions";
import { displayNameFromUser } from "../lib/auth-client";
import { activityLabel } from "../lib/presence";
import UserDetail from "./UserDetail";

type Filter = "all" | "online" | "playing";
type SortKey = "name" | "status" | "points" | "games" | "words" | "wins";
type SortDir = "asc" | "desc";

type Props = {
  onBack?: () => void;
  onWatch?: (userId: string) => void;
  listRequest?: number;
  onTrail?: (crumbs: Crumb[]) => void;
};

export default function Users({ onBack, onWatch, listRequest = 0, onTrail }: Props) {
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "points", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasData = useRef(false);
  const closePlayer = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    setSelectedId(null);
  }, [listRequest]);

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
    const list = (users ?? []).filter((user) => {
      if (filter === "online" && !user.online) return false;
      if (filter === "playing" && !user.play) return false;
      if (!needle) return true;
      return displayNameFromUser(user.name, null).toLocaleLowerCase("fr").includes(needle);
    });
    const byName = (a: DirectoryUser, b: DirectoryUser) =>
      displayNameFromUser(a.name, null).localeCompare(displayNameFromUser(b.name, null), "fr");
    list.sort((a, b) => {
      const primary = compareUsers(a, b, sort.key);
      if (primary !== 0) return sort.dir === "asc" ? primary : -primary;
      return byName(a, b);
    });
    return list;
  }, [users, filter, query, sort]);

  const chooseSort = (key: SortKey) => {
    setSort((current) => {
      if (current.key === key) {
        return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "name" || key === "status" ? "asc" : "desc" };
    });
  };

  if (selectedId) {
    return (
      <UserDetail
        userId={selectedId}
        onBack={closePlayer}
        onWatch={onWatch}
        onTrail={onTrail}
      />
    );
  }

  return (
    <div className="users-page">
      <section className="panel users-hero">
        <div className="profile-head">
          {onBack && (
            <button className="nav-back" type="button" onClick={onBack}>
              Retour
            </button>
          )}
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
        <div className="player-table-wrap">
          <table className="player-table">
            <thead>
              <tr>
                <SortHeader label="Joueur" sortKey="name" sort={sort} onSort={chooseSort} />
                <SortHeader label="Statut" sortKey="status" sort={sort} onSort={chooseSort} wide />
                <SortHeader label="Score" sortKey="points" sort={sort} onSort={chooseSort} wide numeric />
                <SortHeader label="Parties" sortKey="games" sort={sort} onSort={chooseSort} wide numeric />
                <SortHeader label="Mots" sortKey="words" sort={sort} onSort={chooseSort} wide numeric />
                <SortHeader label="Victoires" sortKey="wins" sort={sort} onSort={chooseSort} wide numeric />
                <th className="col-wide col-action">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <PlayerRow
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

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  wide,
  numeric,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  wide?: boolean;
  numeric?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`${wide ? "col-wide" : ""} ${numeric ? "num" : ""}`.trim()}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        {active && <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function compareUsers(a: DirectoryUser, b: DirectoryUser, key: SortKey): number {
  switch (key) {
    case "name":
      return displayNameFromUser(a.name, null).localeCompare(displayNameFromUser(b.name, null), "fr");
    case "status":
      return presenceRank(a) - presenceRank(b);
    case "points":
      return a.stats.totalPoints - b.stats.totalPoints;
    case "games":
      return a.stats.gamesPlayed - b.stats.gamesPlayed;
    case "words":
      return a.stats.wordsFound - b.stats.wordsFound;
    case "wins":
      return a.stats.wins - b.stats.wins;
  }
}

function presenceRank(user: DirectoryUser): number {
  if (user.online && user.play) return 0;
  if (user.online) return 1;
  if (user.play) return 2;
  return 3;
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

function PlayerRow({
  user,
  onOpen,
  onWatch,
}: {
  user: DirectoryUser;
  onOpen: () => void;
  onWatch?: () => void;
}) {
  const name = displayNameFromUser(user.name, null);
  const status = playerStatus(user);
  const points = user.stats.totalPoints.toLocaleString("fr-FR");
  const watchButton = () => (user.play && onWatch ? <WatchButton onClick={onWatch} /> : null);
  return (
    <tr>
      <th scope="row">
        <button className="player-id" type="button" onClick={onOpen}>
          <Avatar online={user.online} name={name} image={user.image} />
          <strong>{name}</strong>
        </button>
      </th>
      <td className={`col-wide player-status ${status.kind}`} title={status.label}>
        {status.label}
      </td>
      <td className="col-wide num player-score">{points}</td>
      <td className="col-wide num">{user.stats.gamesPlayed.toLocaleString("fr-FR")}</td>
      <td className="col-wide num">{user.stats.wordsFound.toLocaleString("fr-FR")}</td>
      <td className="col-wide num">{user.stats.wins.toLocaleString("fr-FR")}</td>
      <td className="col-wide col-action">{watchButton()}</td>
      <td className="col-compact">
        <div className="player-side">
          <div className="player-line">
            <span className={`player-status ${status.kind}`}>{status.label}</span>
            <span className="player-score">{points} pts</span>
            {watchButton()}
          </div>
          <p className="player-meta">
            {countLabel(user.stats.gamesPlayed, "partie", "parties")}
            {" · "}
            {countLabel(user.stats.wordsFound, "mot", "mots")}
            {" · "}
            {countLabel(user.stats.wins, "victoire", "victoires")}
          </p>
        </div>
      </td>
    </tr>
  );
}

function playerStatus(user: DirectoryUser): { label: string; kind: string } {
  if (user.play) {
    return {
      label: activityLabel(user.play, user.online) ?? "En jeu",
      kind: user.play.observing ? "observing" : user.play.mode,
    };
  }
  if (user.online) return { label: "Au menu", kind: "idle" };
  return { label: "Hors ligne", kind: "offline" };
}

function countLabel(value: number, one: string, many: string): string {
  return `${value.toLocaleString("fr-FR")} ${value === 1 ? one : many}`;
}
