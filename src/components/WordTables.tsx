import { useState } from "react";
import type {
  PossibleWord,
  RejectedWord,
  RoundSummary,
  SharedWord,
  SummaryWord,
  WordLike,
} from "@shared/types";
import { wordPoints } from "@shared/dice";
import WordLink from "./WordLink";
import { socket } from "../socket";

type Props = {
  summary: RoundSummary;
  youId?: string;
  canLike?: boolean;
  admin?: boolean;
  onAddWord?: (key: string) => void;
};

export default function WordTables({ summary, youId, canLike = false, admin, onAddWord }: Props) {
  const interactive = Boolean(youId);
  const rejected = summary.rejected ?? [];
  const empty =
    summary.unique.length === 0 &&
    summary.shared.length === 0 &&
    rejected.length === 0;

  return (
    <>
      {empty && <p className="muted">Aucun mot trouvé.</p>}

      {summary.unique.length > 0 && (
        <>
          <h3 className="recap-title">Mots uniques</h3>
          <div className="recap-table-wrap">
            <table className="recap-table">
              <tbody>
                {summary.unique.map((word) => (
                  <UniqueWordRow
                    key={word.key}
                    word={word}
                    youId={youId}
                    canLike={canLike}
                    interactive={interactive}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {summary.shared.length > 0 && (
        <>
          <h3 className="recap-title">Mots en commun (0 pt)</h3>
          <div className="recap-table-wrap">
            <table className="recap-table">
              <tbody>
                {summary.shared.map((word) => (
                  <SharedWordRow
                    key={word.key}
                    word={word}
                    youId={youId}
                    canLike={canLike}
                    interactive={interactive}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h3 className="recap-title">Pas dans le dico (à vérifier)</h3>
          <div className="recap-table-wrap">
            <table className="recap-table">
              <tbody>
                {rejected.map((word) => (
                  <tr key={word.key}>
                    <td>
                      <WordLink word={word.display} />
                    </td>
                    <td className="recap-who">
                      <PlayerNames names={word.names ?? []} />
                    </td>
                    {interactive && (
                      <td className="recap-action">
                        <RejectedAction word={word} admin={admin} onAddWord={onAddWord} />
                      </td>
                    )}
                    <td className="recap-pts">{wordPoints(word.letters, (word.names ?? []).length > 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function UniqueWordRow({
  word,
  youId,
  canLike,
  interactive,
}: {
  word: SummaryWord;
  youId?: string;
  canLike: boolean;
  interactive: boolean;
}) {
  const likedBy = word.likedBy ?? [];
  const mine = youId != null && word.playerId === youId;

  return (
    <tr>
      <td>
        <WordLink word={word.display} />
      </td>
      <td className="recap-who" style={{ color: word.color }}>
        {word.name}
      </td>
      {interactive && youId && (
        <td className="recap-action">
          <WordLikeControl
            wordKey={word.key}
            display={word.display}
            likedBy={likedBy}
            youId={youId}
            canLike={canLike && !mine}
            showCount={!canLike || mine}
          />
        </td>
      )}
      <td className="recap-pts">{word.points}</td>
    </tr>
  );
}

function SharedWordRow({
  word,
  youId,
  canLike,
  interactive,
}: {
  word: SharedWord;
  youId?: string;
  canLike: boolean;
  interactive: boolean;
}) {
  const likedBy = word.likedBy ?? [];
  const foundIt = youId != null && (word.playerIds ?? []).includes(youId);

  return (
    <tr>
      <td>
        <WordLink word={word.display} />
      </td>
      <td className="recap-who">
        <PlayerNames names={word.names ?? []} />
      </td>
      {interactive && youId && (
        <td className="recap-action">
          <WordLikeControl
            wordKey={word.key}
            display={word.display}
            likedBy={likedBy}
            youId={youId}
            canLike={canLike && !foundIt}
            showCount={foundIt}
          />
        </td>
      )}
      <td className="recap-pts">0</td>
    </tr>
  );
}

function RejectedAction({
  word,
  admin,
  onAddWord,
}: {
  word: RejectedWord;
  admin?: boolean;
  onAddWord?: (key: string) => void;
}) {
  if (word.added) return <em className="added">ajouté</em>;
  if (admin && onAddWord) {
    return (
      <button type="button" className="chip on add-word" onClick={() => onAddWord(word.key)}>
        Ajouter
      </button>
    );
  }
  return null;
}

function PlayerNames({ names }: { names: { name: string; color: string }[] }) {
  return (
    <>
      {names.map((player, index) => (
        <span key={`${player.name}-${index}`} style={{ color: player.color }}>
          {index > 0 ? ", " : ""}
          {player.name}
        </span>
      ))}
    </>
  );
}

function WordLikeControl({
  wordKey,
  display,
  likedBy,
  youId,
  canLike,
  showCount,
}: {
  wordKey: string;
  display: string;
  likedBy: WordLike[];
  youId: string;
  canLike: boolean;
  showCount: boolean;
}) {
  const youLiked = likedBy.some((like) => like.playerId === youId);
  const names = likedBy.map((like) => (like.playerId === youId ? "toi" : like.name)).join(", ");

  if (canLike) {
    return (
      <button
        type="button"
        className={`word-like ${youLiked ? "on" : ""}`}
        aria-pressed={youLiked}
        aria-label={youLiked ? `Retirer le like de ${display}` : `Liker ${display}`}
        title={names ? `Aimé par ${names}` : "Liker ce mot"}
        onClick={() => socket.emit("chat:like", { key: wordKey })}
      >
        ♥{likedBy.length > 0 ? ` ${likedBy.length}` : ""}
      </button>
    );
  }
  if (showCount && likedBy.length > 0) {
    return (
      <span className="word-like-count" title={`Aimé par ${names}`}>
        ♥ {likedBy.length}
      </span>
    );
  }
  return null;
}

type ListedWord = PossibleWord & {
  owners: { name: string; color: string }[];
};

function listedPossibleWords(summary: RoundSummary): ListedWord[] {
  const byKey = new Map<string, ListedWord>();
  for (const w of summary.missed ?? []) {
    byKey.set(w.key, { ...w, owners: [] });
  }
  for (const w of summary.unique) {
    byKey.set(w.key, {
      key: w.key,
      display: w.display,
      letters: w.letters,
      points: w.points,
      owners: [{ name: w.name, color: w.color }],
    });
  }
  for (const w of summary.shared) {
    byKey.set(w.key, {
      key: w.key,
      display: w.display,
      letters: w.letters,
      points: 0,
      owners: w.names ?? [],
    });
  }
  return [...byKey.values()];
}

export function PossibleWords({
  summary,
  collapsible = false,
}: {
  summary: RoundSummary;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const words = listedPossibleWords(summary);
  const groups = new Map<number, ListedWord[]>();
  for (const word of words) {
    const list = groups.get(word.letters);
    if (list) list.push(word);
    else groups.set(word.letters, [word]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.display.localeCompare(b.display, "fr"));
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);
  const foundCount = summary.unique.length + summary.shared.length;
  const missed = summary.missed ?? [];
  const possibleCount = summary.possibleCount ?? 0;
  const summaryText = `${foundCount} mot${foundCount > 1 ? "s" : ""} trouvé${foundCount > 1 ? "s" : ""} sur ${possibleCount} possible${possibleCount > 1 ? "s" : ""} dans la grille${missed.length > 0 ? ` · ${missed.length} oublié${missed.length > 1 ? "s" : ""}` : ""}`;

  const details = (
    <>
      {foundCount > 0 && <p className="muted recap-help">Vert : un joueur. Rouge : plusieurs.</p>}
      {words.length === 0 ? (
        <p className="muted">Aucun mot possible avec ces règles.</p>
      ) : (
        <>
          {missed.length === 0 && possibleCount > 0 && (
            <p>Tous les mots de la grille ont été trouvés. Bravo !</p>
          )}
          <div className="possible-tables">
            {lengths.map((n) => {
              const list = groups.get(n)!;
              const pts = wordPoints(n, false);
              return (
                <div key={n} className="possible-table">
                  <table>
                    <caption>
                      {n} lettre{n > 1 ? "s" : ""} ({pts} point{pts > 1 ? "s" : ""}) · {list.length}
                    </caption>
                    <tbody>
                      <tr>
                        {list.map((w) => {
                          const foundClass =
                            w.owners.length > 1
                              ? "found-shared"
                              : w.owners.length === 1
                                ? "found-unique"
                                : "";
                          const owners = w.owners.map((p) => p.name).join(", ");
                          return (
                            <td key={w.key} className={foundClass} title={owners || undefined}>
                              <WordLink word={w.display} />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  return (
    <section className={`card history-possible${collapsible && !open ? " is-collapsed" : ""}`}>
      {collapsible ? (
        <button
          type="button"
          className="possible-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{summaryText}</span>
          <i className="possible-chevron" aria-hidden="true" />
        </button>
      ) : (
        <>
          <h2>Mots possibles</h2>
          <p className="muted recap-help">{summaryText}</p>
        </>
      )}
      {open && details}
    </section>
  );
}
