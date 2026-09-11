import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, RoomView } from "@shared/types";
import { socket } from "../socket";

export default function RoundChat({ room }: { room: RoomView }) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const messages = room.chat ?? [];

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    socket.emit("chat:send", { text });
    setDraft("");
  };

  return (
    <section className="card results-chat">
      <h2>Chat</h2>
      <p className="muted recap-help">Likes, badges et commentaires de la table</p>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && (
          <p className="muted">Encore rien ici. Like un mot ou lance la conversation.</p>
        )}
        {messages.map((message) => (
          <ChatLine key={message.id} message={message} youId={room.you.id} />
        ))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          id="round-chat"
          maxLength={200}
          placeholder="Un mot pour la table…"
          value={draft}
          autoComplete="off"
          aria-label="Message"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-ivory" type="submit" disabled={!draft.trim()}>
          Envoyer
        </button>
      </form>
    </section>
  );
}

function ChatLine({ message, youId }: { message: ChatMessage; youId: string }) {
  const mine = message.playerId === youId;
  if (message.kind === "system") {
    return <p className="chat-line system">{message.text}</p>;
  }
  if (message.kind === "like" && message.word) {
    return (
      <p className={`chat-line like ${mine ? "mine" : ""}`}>
        <span className="chat-avatar" style={{ background: message.color }}>
          {message.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <LikeCopy message={message} youId={youId} />
        </span>
      </p>
    );
  }
  if (message.kind === "badge" && message.badge) {
    return (
      <p className={`chat-line badge ${mine ? "mine" : ""}`}>
        <span className="chat-avatar" style={{ background: message.color }}>
          {message.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          {mine ? "Tu as débloqué" : `${message.name} a débloqué`} le badge{" "}
          <span aria-hidden>{message.badge.icon}</span> <strong>{message.badge.title}</strong>
        </span>
      </p>
    );
  }
  return (
    <p className={`chat-line text ${mine ? "mine" : ""}`}>
      <span className="chat-avatar" style={{ background: message.color }}>
        {message.name.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong style={{ color: message.color }}>{mine ? "Toi" : message.name}</strong>
        <span className="chat-text">{message.text}</span>
      </span>
    </p>
  );
}

function LikeCopy({ message, youId }: { message: ChatMessage; youId: string }) {
  const word = message.word;
  if (!word) return null;
  const mine = message.playerId === youId;
  const yours = word.ownerId === youId;
  const who = mine ? "Tu aimes" : `${message.name} aime`;
  const quoted = <em>{word.display}</em>;
  if (yours) {
    return (
      <>
        {who} ton mot {quoted}.
      </>
    );
  }
  return (
    <>
      {who} le mot {quoted} de {word.ownerName}.
    </>
  );
}
