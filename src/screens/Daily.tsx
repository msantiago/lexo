import { useEffect, useRef, useState } from "react";
import {
  DAILY_DURATION_SEC,
  DAILY_STREAK_FULL,
  type DailyArchiveDetail,
  type DailyArchiveRow,
  type DailyFoundWord,
  type DailyOverview,
  type DailyPlayState,
  type DailySolution,
} from "@shared/daily";
import { COUNTDOWN_MS, countdownIndex, countdownRevealing, countdownShuffling } from "@shared/countdown";
import { extendTypedWord, findPathForWord, foldKey, pathToWord } from "@shared/dice";
import { joinNames } from "@shared/round";
import type { Cell, PossibleWord, WordFailReason } from "@shared/types";
import type { Crumb } from "../components/Breadcrumb";
import Avatar from "../components/Avatar";
import Board from "../components/Board";
import CountdownGate from "../components/CountdownGate";
import NewBadge from "../components/NewBadge";
import Timer from "../components/Timer";
import WordLink from "../components/WordLink";
import WordList from "../components/WordList";
import { FAIL_MESSAGES } from "../lib/format";
import {
  hapticFail,
  hapticSuccess,
  playFailSound,
  playLetterBack,
  playLetterSelect,
  playScoreSound,
  primeSounds,
  unlockAudio,
} from "../lib/sfx";

type Props = {
  overview: DailyOverview;
  onOverview: (next: DailyOverview) => void;
  onBack: () => void;
  onTrail?: (crumbs: Crumb[]) => void;
};

export default function Daily({ overview, onOverview, onBack, onTrail }: Props) {
  const [play, setPlay] = useState<DailyPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const openArchive = () => {
    setArchive(true);
    setSelectedDay(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openDay = (day: string) => {
    setArchive(true);
    setSelectedDay(day);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeArchive = () => {
    setArchive(false);
    setSelectedDay(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!onTrail) return;
    if (play || !archive) {
      onTrail([]);
      return () => onTrail([]);
    }
    const crumbs: Crumb[] = [{ label: "Lexo du jour", onClick: closeArchive }];
    if (selectedDay) {
      crumbs.push({ label: "Archives", onClick: () => setSelectedDay(null) });
      crumbs.push({ label: formatDay(selectedDay) });
    } else {
      crumbs.push({ label: "Archives" });
    }
    onTrail(crumbs);
    return () => onTrail([]);
  }, [onTrail, play, archive, selectedDay]);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      await primeSounds();
      const res = await fetch("/api/daily/start", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { play?: DailyPlayState; done?: DailyOverview; error?: string };
      if (!res.ok) {
        setError(data.error || "Impossible de lancer le Lexo du jour.");
        return;
      }
      if (data.done) {
        onOverview(data.done);
        setPlay(null);
        return;
      }
      if (data.play) setPlay(data.play);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const res = await fetch("/api/daily/finish", { method: "POST", credentials: "include" });
    if (!res.ok) return;
    onOverview((await res.json()) as DailyOverview);
    setPlay(null);
  };

  if (play) {
    return (
      <DailyPlay
        play={play}
        onPlay={setPlay}
        onFinish={() => void finish()}
        onLeave={() => setPlay(null)}
      />
    );
  }

  if (selectedDay) {
    return <ArchiveDetail day={selectedDay} />;
  }

  if (archive) {
    return <ArchiveList onOpen={openDay} />;
  }

  return (
    <div className="daily">
      <button className="nav-back" type="button" onClick={onBack}>
        Retour
      </button>
      <header className="daily-head">
        <h1>
          Lexo du jour <NewBadge />
        </h1>
        <p>
          Une grille moyenne, la même pour tout le monde, tirée à minuit. Trois minutes, une seule
          fois. Les solutions arrivent le lendemain.
        </p>
        <ul className="daily-rules">
          <li>4 lettres minimum</li>
          <li>Noms communs uniquement</li>
          <li>Pas de féminin d’adjectif, pas de pluriels</li>
          <li>Verbes : Infinitif, participe passé et participe présent</li>
        </ul>
      </header>

      {overview.played ? (
        <section className="panel daily-score">
          <p className="daily-kicker">Aujourd’hui</p>
          <b>{overview.score ?? 0}</b>
          <span>
            {overview.wordCount ?? 0} mot{(overview.wordCount ?? 0) > 1 ? "s" : ""}
          </span>
          <p className="muted">Les solutions de cette grille seront visibles demain.</p>
          {overview.words.length > 0 && (
            <div className="daily-found">
              <h3>Tes mots</h3>
              <ul>
                {overview.words.map((word) => (
                  <li key={word.key}>
                    <WordLink word={word.display} />
                    <b>{word.points}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <button className="btn btn-gold btn-lg daily-start" type="button" disabled={busy} onClick={() => void start()}>
          {overview.inProgress ? "Reprendre le Lexo du jour" : "Jouer le Lexo du jour"}
        </button>
      )}
      {error && <p className="account-error">{error}</p>}

      <Leaderboard overview={overview} />
      <button className="daily-archive-link" type="button" onClick={openArchive}>
        Tous les Lexo du jour
      </button>
      {overview.yesterday && <Yesterday solution={overview.yesterday} />}
    </div>
  );
}

function DailyPlay({
  play,
  onPlay,
  onFinish,
  onLeave,
}: {
  play: DailyPlayState;
  onPlay: (next: DailyPlayState) => void;
  onFinish: () => void;
  onLeave: () => void;
}) {
  const [path, setPath] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean; id: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lockedRef = useRef(false);
  const rejectTimer = useRef(0);
  const pathRef = useRef(path);
  const typedRef = useRef(typed);
  const playRef = useRef(play);
  playRef.current = play;
  const finishedRef = useRef(false);
  pathRef.current = path;
  typedRef.current = typed;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const startedAt = play.endsAt - COUNTDOWN_MS - DAILY_DURATION_SEC * 1000;
  const counting = countdownIndex(startedAt, now) != null;
  const remaining = counting ? DAILY_DURATION_SEC * 1000 : Math.max(0, play.endsAt - now);
  lockedRef.current = locked || counting || remaining <= 0;
  useEffect(() => {
    if (remaining > 0 || finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [remaining, onFinish]);

  const clearWord = () => {
    window.clearTimeout(rejectTimer.current);
    setPath([]);
    setTyped("");
    setFlash(null);
    setLocked(false);
  };

  const showReject = (text: string, clearPath: boolean) => {
    window.clearTimeout(rejectTimer.current);
    setFeedback({ text, ok: false, id: Date.now() });
    setFlash(null);
    window.setTimeout(() => setFlash("fail"), 0);
    playFailSound();
    hapticFail();
    if (clearPath) setLocked(true);
    rejectTimer.current = window.setTimeout(() => {
      setFlash((current) => (current === "fail" ? null : current));
      if (!clearPath) return;
      setPath([]);
      setTyped("");
      setLocked(false);
    }, 680);
  };

  const submit = async (cells: number[]) => {
    const current = playRef.current;
    if (lockedRef.current || cells.length === 0 || Date.now() >= current.endsAt) return;
    const built = pathToWord(current.grid, cells);
    if (built.letters < 4) {
      showReject(FAIL_MESSAGES["too-short"], true);
      return;
    }
    setLocked(true);
    const res = await fetch("/api/daily/word", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cells }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      reason?: WordFailReason;
      words?: DailyFoundWord[];
      score?: number;
      finished?: boolean;
    };
    if (data.finished) {
      onFinish();
      return;
    }
    if (!data.ok || !data.words) {
      showReject(FAIL_MESSAGES[data.reason ?? "unknown"], true);
      return;
    }
    const found = data.words[data.words.length - 1];
    onPlay({ ...current, words: data.words, score: data.score ?? current.score });
    setFlash("success");
    setFeedback({ text: found?.display ?? "", ok: true, id: Date.now() });
    playScoreSound(found?.letters ?? 4);
    hapticSuccess();
    window.setTimeout(clearWord, 280);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector("[data-confirm-dialog]")) return;
      unlockAudio();
      if (lockedRef.current || Date.now() >= play.endsAt) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setPath([]);
        setTyped("");
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        const current = pathRef.current;
        if (!current.length) return;
        const next = current.slice(0, -1);
        setPath(next);
        setTyped(next.length ? pathToWord(play.grid, next).key : "");
        playLetterBack();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void submit(pathRef.current);
        return;
      }
      const letter = foldKey(event.key);
      if (!letter) return;
      event.preventDefault();
      const base = typedRef.current || (pathRef.current.length ? pathToWord(play.grid, pathRef.current).key : "");
      let nextTyped = extendTypedWord(play.grid, base, letter);
      if (nextTyped === null && base) nextTyped = extendTypedWord(play.grid, "", letter);
      if (nextTyped === null) {
        showReject("Pas sur la grille", false);
        return;
      }
      if (nextTyped === typedRef.current && pathRef.current.length) return;
      setTyped(nextTyped);
      const nextPath = findPathForWord(play.grid, nextTyped);
      setPath(nextPath ?? []);
      playLetterSelect(nextPath?.length || nextTyped.length);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [play.endsAt, play.grid]);

  const preview = path.length ? pathToWord(play.grid, path).display : "";

  return (
    <div className="play daily-play">
      <div className="play-top">
        <div className="play-top-meta">
          <div className="muted">Lexo du jour</div>
          <div className="muted">{play.score} pts</div>
          <div className="daily-rules-line">
            4 lettres · pas de féminin d’adjectif · infinitif et participes
          </div>
        </div>
        <Timer remainingMs={remaining} totalMs={DAILY_DURATION_SEC * 1000} />
        <div className="play-top-actions">
          <button className="text-action" type="button" onClick={onLeave}>
            Quitter
          </button>
        </div>
      </div>
      <div className="stage">
        <div key={feedback?.id} className={`feedback ${feedback?.ok ? "ok" : ""}`} aria-live="polite">
          {feedback?.text ?? ""}
        </div>
        <CountdownGate startedAt={startedAt} now={now}>
          <Board
            grid={play.grid}
            path={path}
            flash={flash}
            disabled={locked || counting || remaining <= 0}
            shuffling={countdownShuffling(startedAt, now)}
            revealing={countdownRevealing(startedAt, now)}
            onPathChange={(next) => {
              if (lockedRef.current) return;
              setTyped("");
              setPath(next);
            }}
            onSubmit={(next) => void submit(next)}
          />
        </CountdownGate>
        <p className={`preview ${preview ? "" : "empty"}`}>{preview || "Glisse ou tape un mot"}</p>
        <p className="hint">Clavier · Entrée pour valider · Qu = Q ou Qu</p>
        <WordList words={play.words.map((word) => ({ ...word, shared: false }))} />
      </div>
    </div>
  );
}

type DailySortKey = "name" | "rating" | "plays" | "average" | "today";
type DailySortDir = "asc" | "desc";

function Leaderboard({ overview }: { overview: DailyOverview }) {
  const [sort, setSort] = useState<{ key: DailySortKey; dir: DailySortDir }>({
    key: "rating",
    dir: "desc",
  });
  const chooseSort = (key: DailySortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  };
  const rows = [...overview.leaderboard].sort((a, b) => compareStandings(a, b, sort.key, sort.dir));

  return (
    <section className="panel daily-board">
      <h2>Palmarès</h2>
      <p className="muted">
        Le meilleur score du jour vaut 100 %, les autres un pourcentage de ce score. L’indice est la
        moyenne de ta série : elle ne compte pleinement qu’au bout de {DAILY_STREAK_FULL} jours
        d’affilée. Il se met à jour le lendemain. Un jour sans jouer, tu repars à 0.
      </p>
      {rows.length === 0 ? (
        <p className="hint">Personne n’a encore joué. La première place est libre.</p>
      ) : (
        <div className="recap-table-wrap">
          <table className="recap-table daily-table">
            <thead>
              <tr>
                <DailySortHeader label="Joueur" sortKey="name" sort={sort} onSort={chooseSort} />
                <DailySortHeader label="Indice" sortKey="rating" sort={sort} onSort={chooseSort} />
                <DailySortHeader label="Jours" sortKey="plays" sort={sort} onSort={chooseSort} />
                <DailySortHeader label="Moy." sortKey="average" sort={sort} onSort={chooseSort} />
                <DailySortHeader label="Aujourd’hui" short="Auj." sortKey="today" sort={sort} onSort={chooseSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className={row.you ? "daily-you" : undefined}>
                  <td>
                    <span className="daily-player">
                      <Avatar name={row.name} image={row.image} />
                      <strong>
                        {row.name}
                        {row.you ? " (toi)" : ""}
                      </strong>
                    </span>
                  </td>
                  <td className="recap-pts">{formatIndex(row.rating)}</td>
                  <td>{row.plays}</td>
                  <td>{row.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                  <td>{row.today === null ? "—" : row.today}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DailySortHeader({
  label,
  short,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  short?: string;
  sortKey: DailySortKey;
  sort: { key: DailySortKey; dir: DailySortDir };
  onSort: (key: DailySortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} aria-label={short ? label : undefined}>
        {short ? (
          <>
            <span className="sort-long">{label}</span>
            <span className="sort-short" aria-hidden="true">
              {short}
            </span>
          </>
        ) : (
          label
        )}
        {active && <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function formatIndex(rating: number): string {
  return `${rating.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function compareStandings(
  a: DailyOverview["leaderboard"][number],
  b: DailyOverview["leaderboard"][number],
  key: DailySortKey,
  dir: DailySortDir,
): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "today") {
    if (a.today === null && b.today !== null) return 1;
    if (b.today === null && a.today !== null) return -1;
    if (a.today !== null && b.today !== null && a.today !== b.today) return (a.today - b.today) * sign;
  } else if (key === "name") {
    const byName = a.name.localeCompare(b.name, "fr");
    if (byName !== 0) return byName * sign;
  } else {
    const delta = a[key] - b[key];
    if (delta !== 0) return delta * sign;
  }
  return a.name.localeCompare(b.name, "fr");
}

function ArchiveList({ onOpen }: { onOpen: (day: string) => void }) {
  const [rows, setRows] = useState<DailyArchiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily/archive", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return (await res.json()) as DailyArchiveRow[];
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les archives.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="daily">
      <header className="daily-head">
        <h1>Archives</h1>
        <p>Les Lexo des jours passés, avec leur grille et leurs solutions.</p>
      </header>
      {error && <p className="account-error">{error}</p>}
      {!rows && !error && <p className="hint">Chargement…</p>}
      {rows && rows.length === 0 && <p className="hint">Aucun Lexo du jour pour l’instant.</p>}
      {rows && rows.length > 0 && (
        <div className="recap-table-wrap">
          <table className="recap-table daily-table daily-archive-table">
            <thead>
              <tr>
                <th>Date</th>
                <ArchiveHeader label="Mots possibles" short="Mots" />
                <ArchiveHeader label="Points possibles" short="Points" />
                <th>Joueurs</th>
                <ArchiveHeader label="Meilleur score" short="Record" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day}>
                  <td>
                    <button className="daily-archive-date" type="button" onClick={() => onOpen(row.day)}>
                      {formatDay(row.day, true)}
                    </button>
                  </td>
                  <td>{row.wordCount}</td>
                  <td>{row.possiblePoints}</td>
                  <td>{row.players}</td>
                  <td>{bestLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ArchiveHeader({ label, short }: { label: string; short: string }) {
  return (
    <th aria-label={label}>
      <span className="sort-long">{label}</span>
      <span className="sort-short" aria-hidden="true">
        {short}
      </span>
    </th>
  );
}

function ArchiveDetail({ day }: { day: string }) {
  const [detail, setDetail] = useState<DailyArchiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/daily/archive/${day}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return (await res.json()) as DailyArchiveDetail;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible d’ouvrir ce Lexo du jour.");
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  return (
    <div className="daily">
      <header className="daily-head">
        <h1>{formatDay(day, true)}</h1>
      </header>
      {error && <p className="account-error">{error}</p>}
      {!detail && !error && <p className="hint">Chargement…</p>}
      {detail && (
        <section className="panel daily-yesterday">
          <p className="muted">
            {detail.wordCount} mots · {detail.possiblePoints} points · {detail.players} joueur
            {detail.players > 1 ? "s" : ""}
            {detail.bestScore !== null ? ` · meilleur score ${bestLabel(detail)}` : ""}
          </p>
          {detail.revealed && detail.grid && detail.words ? (
            <SolutionBody grid={detail.grid} words={detail.words} />
          ) : (
            <p>La grille et les solutions seront visibles demain.</p>
          )}
        </section>
      )}
    </div>
  );
}

function bestLabel(row: Pick<DailyArchiveRow, "bestScore" | "bestNames">): string {
  if (row.bestScore === null) return "—";
  const names = joinNames(row.bestNames);
  return names ? `${row.bestScore} · ${names}` : String(row.bestScore);
}

function Yesterday({ solution }: { solution: DailySolution }) {
  return (
    <section className="panel daily-yesterday">
      <h2>Solution d’hier</h2>
      <p className="muted">La grille du {formatDay(solution.day)}, maintenant dévoilée.</p>
      <SolutionBody grid={solution.grid} words={solution.words} />
    </section>
  );
}

function SolutionBody({ grid, words }: { grid: Cell[]; words: PossibleWord[] }) {
  const groups = new Map<number, PossibleWord[]>();
  for (const word of words) {
    const list = groups.get(word.letters) ?? [];
    list.push(word);
    groups.set(word.letters, list);
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);
  return (
    <>
      <MiniGrid grid={grid} />
      {lengths.map((length) => (
        <div key={length} className="daily-length">
          <h3>
            {length} lettre{length > 1 ? "s" : ""}
          </h3>
          <p>
            {groups.get(length)?.map((word) => (
              <WordLink key={word.key} word={word.display} />
            ))}
          </p>
        </div>
      ))}
    </>
  );
}

function MiniGrid({ grid }: { grid: Cell[] }) {
  return (
    <div className="mini-board daily-grid" aria-hidden>
      {grid.map((cell, index) => (
        <div key={index} className={`mini-die ${cell.letter === "QU" ? "qu" : ""}`}>
          <span className="die-face" style={{ transform: `rotate(${cell.rotation}deg)` }}>
            {cell.display}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatDay(day: string, withWeekday = false): string {
  const [year, month, date] = day.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("fr", {
      weekday: withWeekday ? "long" : undefined,
      day: "numeric",
      month: "long",
    }).format(new Date(year, (month || 1) - 1, date || 1));
  } catch {
    return day;
  }
}
