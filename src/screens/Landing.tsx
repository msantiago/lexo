import NewBadge from "../components/NewBadge";
import { CONTACT_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "../lib/nav";

const GRID = ["L", "E", "X", "A", "B", "M", "O", "T", "R", "U", "S", "I", "P", "N", "D", "C"];
const WORD = new Set([5, 6, 7, 10]);

const STEPS = [
  {
    n: "01",
    title: "La grille tombe",
    text: "Seize dés. Par défaut, trois minutes pour trouver des mots d’au moins quatre lettres.",
  },
  {
    n: "02",
    title: "Tu traces un chemin",
    text: "Chaque dé une seule fois, de case en case, même en diagonale — au doigt ou au clavier. Le Q se lit Qu.",
  },
  {
    n: "03",
    title: "Les points s’additionnent",
    text: "Quatre lettres valent 1 point, puis 1 de plus par lettre. Un mot trouvé à plusieurs rapporte 0.",
  },
];

const KEEPS = [
  {
    title: "Badges",
    text: "Première table, mot long, manche pleine, victoire, Qu… Ils se débloquent en jouant.",
  },
  {
    title: "Stats",
    text: "Mots trouvés, points, longueurs, lettres favorites, mots uniques ou partagés.",
  },
  {
    title: "Historique",
    text: "Chaque partie terminée : manches, grille, règles et scores, pour y revenir.",
  },
];

const RULES = [
  {
    title: "Le temps",
    text: "De 30 secondes à 5 minutes. Trois minutes, si tu ne changes rien.",
  },
  {
    title: "La grille",
    text: "Très facile, facile, moyenne ou difficile. Plus c’est dur, moins il y a de mots possibles.",
  },
  {
    title: "La longueur",
    text: "Tu fixes le minimum : 3, 4 ou 5 lettres.",
  },
  {
    title: "Les dés",
    text: "Lettres à l’endroit, ou tournées au hasard comme sur une vraie table.",
  },
  {
    title: "Les formes",
    text: "Pluriels et féminins, acceptés ou non. Chaque table a sa convention.",
  },
  {
    title: "Les verbes",
    text: "Seulement les participes, ou toutes les conjugaisons.",
  },
];

type Props = {
  name?: string;
};

export default function Landing({ name }: Props) {
  const signedIn = name !== undefined;
  const hello = signedIn ? (
    <p className="landing-hello">
      Bonjour{name ? <>, <strong>{name}</strong></> : null}. Content de te revoir.
    </p>
  ) : (
    <div className="landing-cta">
      <a className="btn btn-gold" href={SIGN_UP_PATH}>
        Créer un compte
      </a>
      <a className="btn btn-ivory" href={SIGN_IN_PATH}>
        Se connecter
      </a>
    </div>
  );

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-copy">
          <h2>Seize dés. Tous les mots que tu y vois.</h2>
          <p>
            Relie les lettres voisines avant la fin du temps. Entraîne-toi en solo, ou ouvre une
            table jusqu’à dix joueurs. Avant de lancer, tu choisis les règles.
          </p>
          {hello}
        </div>
        <figure className="landing-board">
          <div className="board" aria-hidden="true">
            {GRID.map((letter, index) => (
              <div key={index} className={`die${WORD.has(index) ? " active" : ""}`}>
                <span className="die-face">{letter}</span>
              </div>
            ))}
          </div>
          <figcaption>MOTS, tracé sur la grille</figcaption>
        </figure>
      </section>

      <ol className="landing-steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span>{step.n}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <aside className="landing-grids" aria-labelledby="landing-grids-title">
        <div>
          <h2 id="landing-grids-title">Une grille qui a toujours des mots</h2>
          <p>
            Les dés ne tombent pas au hasard. Lexo les relance jusqu’à garantir des mots
            possibles, selon la difficulté et les règles de la table : au moins une quarantaine
            en difficile, plus de 140 en très facile.
          </p>
        </div>
        <p className="landing-grids-count">
          <strong>
            4×10<sup>25</sup>
          </strong>
          <span>grilles différentes ! 🤯</span>
        </p>
      </aside>

      <section className="landing-rules" aria-labelledby="landing-rules-title">
        <div className="landing-rules-intro">
          <h2 id="landing-rules-title">Les règles, c’est toi qui les choisis</h2>
          <p>
            Le maître du jeu les fixe avant la manche. En solo, c’est toi. Les autres voient le
            résumé avant de jouer.
          </p>
        </div>
        <ul>
          {RULES.map((rule) => (
            <li key={rule.title}>
              <strong>{rule.title}</strong>
              <p>{rule.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-rules" aria-labelledby="landing-keep-title">
        <div className="landing-rules-intro">
          <h2 id="landing-keep-title">
            Ton compte garde la trace
            <NewBadge />
          </h2>
          <p>Connecté, chaque partie laisse quelque chose : des badges, des stats, et l’historique.</p>
        </div>
        <ul>
          {KEEPS.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="landing-aside">
        Solo ou salon · au doigt ou au clavier · regarder une partie en cours · la définition d’un
        mot sans quitter Lexo
      </p>

      {signedIn ? (
        <p className="landing-hello landing-hello-end">
          La table t’attend{name ? <>, <strong>{name}</strong></> : null}.
        </p>
      ) : (
        <div className="landing-cta landing-cta-end">
          <a className="btn btn-gold" href={SIGN_UP_PATH}>
            Créer un compte
          </a>
          <a className="btn btn-ivory" href={SIGN_IN_PATH}>
            Se connecter
          </a>
        </div>
      )}

      <p className="landing-contact">
        Un bug, une idée, un mot qui devrait exister ? <a href={CONTACT_PATH}>Écris-moi</a>
      </p>
    </div>
  );
}
