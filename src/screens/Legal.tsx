import type { ReactNode } from "react";
import { version } from "../../package.json";
import { goHome, PRIVACY_PATH } from "../lib/nav";

const UPDATED = "23 septembre 2026";

function LegalPage({
  title,
  children,
  updated = UPDATED,
}: {
  title: string;
  children: ReactNode;
  updated?: string | null;
}) {
  return (
    <article className="panel legal-panel">
      <button className="nav-back" type="button" onClick={goHome}>
        Retour
      </button>
      <h1>{title}</h1>
      {updated ? <p className="legal-updated">Dernière mise à jour : {updated}</p> : null}
      {children}
    </article>
  );
}

const OFL = "https://openfontlicense.org/";
const MIT = "https://opensource.org/license/mit";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function CreditProjects({
  items,
}: {
  items: { name: string; href: string; license: string; licenseHref: string; note?: string }[];
}) {
  return (
    <ul className="credit-projects">
      {items.map((item) => (
        <li key={item.name}>
          <span>
            <ExternalLink href={item.href}>{item.name}</ExternalLink>
            {item.note ? <small>{item.note}</small> : null}
          </span>
          <ExternalLink href={item.licenseHref}>{item.license}</ExternalLink>
        </li>
      ))}
    </ul>
  );
}

export function Credits() {
  return (
    <LegalPage title="Crédits" updated={null}>
      <p>
        Lexo est un jeu de lettres créé par Marc-Antoine Santiago en septembre 2026. Version{" "}
        {version}. Le jeu lui-même n’est pas un logiciel libre. Les éléments ci-dessous viennent
        de projets tiers, avec leur licence.
      </p>

      <h2>Dictionnaire</h2>
      <p>
        Les mots acceptés viennent du{" "}
        <ExternalLink href="https://grammalecte.net/">lexique Grammalecte</ExternalLink> 7.7,
        variante Classique (orthographe traditionnelle), issu de Dicollecte. Licence{" "}
        <ExternalLink href="https://www.mozilla.org/MPL/2.0/">
          Mozilla Public License 2.0
        </ExternalLink>
        .
      </p>

      <h2>Définitions</h2>
      <p>
        Les définitions affichées dans une partie proviennent du{" "}
        <ExternalLink href="https://fr.wiktionary.org/">Wiktionnaire</ExternalLink>, un projet de
        la Wikimedia Foundation. Les textes sont sous licence{" "}
        <ExternalLink href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr">
          Creative Commons Attribution-Partage dans les mêmes conditions 4.0
        </ExternalLink>
        .
      </p>

      <h2>Caractères</h2>
      <p>
        Nunito (Vernon Adams), Fraunces (Undercase Type) et Fredoka (Milena Brandão) sont
        distribuées par Google Fonts sous la{" "}
        <ExternalLink href={OFL}>SIL Open Font License 1.1</ExternalLink>.
      </p>
      <CreditProjects
        items={[
          {
            name: "Nunito",
            href: "https://fonts.google.com/specimen/Nunito",
            license: "SIL OFL 1.1",
            licenseHref: OFL,
          },
          {
            name: "Fraunces",
            href: "https://fonts.google.com/specimen/Fraunces",
            license: "SIL OFL 1.1",
            licenseHref: OFL,
          },
          {
            name: "Fredoka",
            href: "https://fonts.google.com/specimen/Fredoka",
            license: "SIL OFL 1.1",
            licenseHref: OFL,
          },
        ]}
      />

      <h2>Logiciels libres</h2>
      <p>Bibliothèques utilisées pour faire tourner le jeu.</p>
      <CreditProjects
        items={[
          { name: "React", href: "https://react.dev/", license: "MIT", licenseHref: MIT },
          { name: "React DOM", href: "https://react.dev/", license: "MIT", licenseHref: MIT },
          { name: "Express", href: "https://expressjs.com/", license: "MIT", licenseHref: MIT },
          {
            name: "Socket.IO",
            href: "https://socket.io/",
            license: "MIT",
            licenseHref: MIT,
          },
          {
            name: "Framer Motion",
            href: "https://github.com/motiondivision/motion",
            license: "MIT",
            licenseHref: MIT,
          },
          {
            name: "better-auth",
            href: "https://better-auth.com/",
            license: "MIT",
            licenseHref: MIT,
          },
          {
            name: "better-sqlite3",
            href: "https://github.com/WiseLibs/better-sqlite3",
            license: "MIT",
            licenseHref: MIT,
            note: "Le moteur SQLite intégré est dans le domaine public.",
          },
          { name: "jose", href: "https://github.com/panva/jose", license: "MIT", licenseHref: MIT },
          {
            name: "dotenv",
            href: "https://github.com/motdotla/dotenv",
            license: "BSD 2-Clause",
            licenseHref: "https://opensource.org/license/bsd-2-clause",
          },
        ]}
      />

      <h2>Outils de développement</h2>
      <p>Ils servent à construire Lexo. Ils ne font pas partie de la partie jouée.</p>
      <CreditProjects
        items={[
          { name: "Vite", href: "https://vite.dev/", license: "MIT", licenseHref: MIT },
          {
            name: "TypeScript",
            href: "https://www.typescriptlang.org/",
            license: "Apache 2.0",
            licenseHref: "https://www.apache.org/licenses/LICENSE-2.0",
          },
          { name: "tsx", href: "https://tsx.hirok.io/", license: "MIT", licenseHref: MIT },
          {
            name: "@vitejs/plugin-react",
            href: "https://github.com/vitejs/vite-plugin-react",
            license: "MIT",
            licenseHref: MIT,
          },
          {
            name: "concurrently",
            href: "https://github.com/open-cli-tools/concurrently",
            license: "MIT",
            licenseHref: MIT,
          },
        ]}
      />
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Lexo est un jeu de lettres en ligne édité par Marc-Antoine Santiago. Cette page explique
        quelles données sont traitées quand tu joues, notamment si tu te connectes avec Google ou
        un autre compte.
      </p>

      <h2>Qui est responsable</h2>
      <p>
        Le responsable du traitement est Marc-Antoine Santiago, éditeur de Lexo. Pour toute
        question ou demande relative à tes données, utilise le contact indiqué sur l’écran de
        consentement Google, ou le nom affiché en bas de chaque page.
      </p>

      <h2>Données collectées</h2>
      <p>Un compte est nécessaire pour jouer. Tu te connectes avec un e-mail ou via un prestataire proposé (Google, Apple, etc.).</p>
      <ul>
        <li>
          <strong>Compte Lexo</strong> : adresse e-mail, mot de passe (stocké sous forme hachée,
          jamais en clair), pseudo, et l’avatar que tu choisis (icône ou photo).
        </li>
        <li>
          <strong>Connexion via Google, Apple, Facebook, Microsoft, GitHub ou Discord</strong> : le
          prestataire nous transmet l’identifiant de ton compte, ton nom et ton e-mail. Lexo ne
          reçoit pas ton mot de passe chez ces services.
        </li>
        <li>
          <strong>Profil et parties</strong> : parties jouées, grilles, mots trouvés, scores,
          badges, et les pseudos des autres joueurs de ces parties.
        </li>
        <li>
          <strong>Session</strong> : un cookie de session pour rester connecté, et le pseudo du
          compte mémorisé sur cet appareil.
        </li>
      </ul>
      <p>Lexo n’utilise pas de publicité, ni d’outil d’analyse d’audience tiers.</p>

      <h2>Pourquoi ces données</h2>
      <ul>
        <li>te permettre de jouer et de retrouver tes parties ;</li>
        <li>créer et sécuriser un compte, y compris via OAuth ;</li>
        <li>afficher ton pseudo, ton avatar, tes scores et tes badges ;</li>
        <li>faire fonctionner les salons en temps réel.</li>
      </ul>
      <p>
        La base légale est ton consentement (création de compte ou bouton « Continuer avec Google »)
        et l’exécution du service de jeu une fois le compte créé.
      </p>

      <h2>Partage</h2>
      <p>
        Tes données de jeu restent sur le serveur Lexo. Elles ne sont pas vendues. Elles ne sont
        transmises à un tiers que si tu cliques toi-même sur un bouton de connexion sociale : Google
        (ou un autre prestataire) traite alors l’authentification selon sa propre politique.
      </p>
      <p>
        L’hébergement du serveur et les copies de sauvegarde techniques, s’il y en a, sont
        strictement nécessaires au fonctionnement du service.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les données de compte, d’historique et de badges sont conservées tant que le compte existe.
        Les salons en cours disparaissent quand la partie se termine ou que le serveur les ferme. Un
        cookie de session expire au plus tard après 30 jours si tu as coché « se souvenir de moi ».
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données depuis ton profil Lexo, rectifier ton pseudo et ton avatar, et
        demander la suppression de ton compte et des parties associées. Tu peux aussi retirer l’accès à Lexo
        depuis les paramètres de ton compte Google (ou de l’autre prestataire).
      </p>
      <p>
        Si tu es dans l’Union européenne, tu disposes des droits prévus par le RGPD (accès,
        rectification, effacement, limitation, portabilité, opposition) et du droit d’introduire une
        réclamation auprès de la CNIL.
      </p>

      <h2>Cookies</h2>
      <p>
        Lexo dépose uniquement des cookies (ou équivalents) nécessaires à la session de connexion.
        Pas de cookies publicitaires.
      </p>

      <h2>Mineurs</h2>
      <p>
        Lexo n’est pas destiné aux enfants de moins de 16 ans. Si un compte a été créé par erreur,
        contacte l’éditeur pour le faire supprimer.
      </p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Conditions d’utilisation">
      <p>
        En utilisant Lexo, tu acceptes ces conditions. Si tu n’es pas d’accord, n’utilise pas le
        service.
      </p>

      <h2>Le service</h2>
      <p>
        Lexo est un jeu de lettres en temps réel, proposé gratuitement. Pour jouer, crée un compte
        (e-mail ou connexion Google et autres prestataires) : tes parties, tes stats et tes badges
        sont alors conservés.
      </p>
      <p>
        Le jeu, les salons et les classements fonctionnent « en l’état ». L’éditeur peut modifier,
        interrompre ou arrêter le service, y compris pour maintenance, sans garantie de
        disponibilité.
      </p>

      <h2>Compte</h2>
      <ul>
        <li>Un compte est requis pour créer un salon, lancer une partie solo ou rejoindre une partie.</li>
        <li>Tu es responsable de la confidentialité de tes identifiants.</li>
        <li>Le pseudo ne doit pas usurper l’identité d’autrui ni être injurieux.</li>
        <li>
          L’éditeur peut suspendre ou supprimer un compte en cas d’abus, de triche manifeste ou
          d’usage contraire à ces conditions.
        </li>
      </ul>

      <h2>Règles de jeu</h2>
      <p>
        Tu t’engages à jouer de bonne foi : pas d’automatisation pour trouver les mots, pas de
        sabotage des salons, pas d’usurpation de session. Les mots acceptés dépendent du dictionnaire
        du jeu (lexique Grammalecte / Dicollecte). Un mot refusé peut parfois être proposé à
        l’adoption selon les règles affichées en partie.
      </p>

      <h2>Contenu</h2>
      <p>
        Le nom Lexo, l’interface et le code du jeu appartiennent à leur auteur. Le dictionnaire est
        utilisé sous la licence du lexique Grammalecte / Dicollecte. Tes mots trouvés et ton pseudo
        sont utilisés uniquement pour faire fonctionner le jeu et ton historique.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Lexo est un jeu amateur. L’éditeur ne saurait être tenu responsable des interruptions, pertes
        de parties, ou dommages indirects liés à l’utilisation du service, dans la limite autorisée
        par la loi.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la{" "}
        <a href={PRIVACY_PATH}>politique de confidentialité</a>. La connexion via Google (ou un
        autre prestataire) implique aussi leurs conditions et leur politique de confidentialité.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Ces conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux
        compétents, sous réserve des dispositions impératives de protection du consommateur.
      </p>

      <h2>Modifications</h2>
      <p>
        Ces conditions peuvent être mises à jour. La date en tête de page fait foi. Continuer à
        jouer après une mise à jour vaut acceptation des nouvelles conditions.
      </p>
    </LegalPage>
  );
}
