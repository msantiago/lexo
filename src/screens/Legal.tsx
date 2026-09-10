import type { ReactNode } from "react";
import LexoLogo from "../components/LexoLogo";
import { goHome, PRIVACY_PATH, TERMS_PATH } from "../lib/nav";

const UPDATED = "10 septembre 2026";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="screen legal">
      <div className="logo legal-logo">
        <LexoLogo />
        <p>Les mots sont sur la table</p>
      </div>
      <article className="panel legal-panel">
        <button className="btn btn-ghost" type="button" onClick={goHome}>
          Retour
        </button>
        <h1>{title}</h1>
        <p className="legal-updated">Dernière mise à jour : {UPDATED}</p>
        {children}
        <nav className="legal-switch" aria-label="Autres pages légales">
          <a href={PRIVACY_PATH}>Confidentialité</a>
          <a href={TERMS_PATH}>Conditions d’utilisation</a>
        </nav>
      </article>
    </div>
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
        consentement Google, ou le nom affiché en bas de la page d’accueil.
      </p>

      <h2>Données collectées</h2>
      <p>Lexo ne te demande un compte que si tu le souhaites. Tu peux jouer en invité avec un prénom.</p>
      <ul>
        <li>
          <strong>Compte Lexo</strong> : adresse e-mail, mot de passe (stocké sous forme hachée,
          jamais en clair), pseudo.
        </li>
        <li>
          <strong>Connexion via Google, Apple, Facebook, Microsoft, GitHub ou Discord</strong> : le
          prestataire nous transmet l’identifiant de ton compte, ton nom et ton e-mail. Lexo ne
          reçoit pas ton mot de passe chez ces services.
        </li>
        <li>
          <strong>Profil et parties</strong> (si tu es connecté) : parties jouées, grilles, mots
          trouvés, scores, badges, et les prénoms des autres joueurs de ces parties.
        </li>
        <li>
          <strong>Session</strong> : un cookie de session pour rester connecté, et éventuellement
          le prénom choisi sur cet appareil.
        </li>
        <li>
          <strong>Invité</strong> : le prénom affiché dans le salon reste en mémoire le temps de la
          partie. Il n’est pas enregistré comme un compte.
        </li>
      </ul>
      <p>Lexo n’utilise pas de publicité, ni d’outil d’analyse d’audience tiers.</p>

      <h2>Pourquoi ces données</h2>
      <ul>
        <li>te permettre de jouer et de retrouver tes parties ;</li>
        <li>créer et sécuriser un compte, y compris via OAuth ;</li>
        <li>afficher ton pseudo, tes scores et tes badges ;</li>
        <li>faire fonctionner les salons en temps réel.</li>
      </ul>
      <p>
        La base légale est ton consentement (création de compte ou bouton « Continuer avec Google »)
        et l’intérêt légitime de faire tourner le jeu si tu joues en invité.
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
        Les salons d’invités disparaissent quand la partie se termine ou que le serveur les ferme. Un
        cookie de session expire au plus tard après 30 jours si tu as coché « se souvenir de moi ».
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données depuis ton profil Lexo, rectifier ton pseudo, et demander la
        suppression de ton compte et des parties associées. Tu peux aussi retirer l’accès à Lexo
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
        Lexo est un jeu de lettres en temps réel, proposé gratuitement. Tu peux jouer en invité avec
        un prénom, ou créer un compte (e-mail ou connexion Google et autres prestataires) pour
        conserver tes parties, tes stats et tes badges.
      </p>
      <p>
        Le jeu, les salons et les classements fonctionnent « en l’état ». L’éditeur peut modifier,
        interrompre ou arrêter le service, y compris pour maintenance, sans garantie de
        disponibilité.
      </p>

      <h2>Compte</h2>
      <ul>
        <li>Le compte est facultatif.</li>
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
        sont utilisés uniquement pour faire fonctionner le jeu et, si tu as un compte, ton historique.
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
