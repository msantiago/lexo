import { useState } from "react";
import DefinitionDialog from "./DefinitionDialog";

export default function WordLink({ word }: { word: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="word-label word-define"
        aria-haspopup="dialog"
        aria-label={`Définition de ${word}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {word}
      </button>
      {open && <DefinitionDialog word={word} onClose={() => setOpen(false)} />}
    </>
  );
}
