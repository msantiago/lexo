# Lexo Mobile (Expo)

Client React Native / Expo pour iOS et Android. Partage la logique métier du dépôt via `@shared/*` (`../shared`).

## Prérequis

- Node 22+
- Serveur Lexo local (`npm run dev:server` à la racine) avec `BETTER_AUTH_SECRET` / `.env`
- Expo Go, ou `npx expo start` puis web / simulateur

## Démarrage

```bash
cd mobile
cp .env.example .env   # optionnel
npm start
```

Sur un téléphone physique, mets l’IP LAN de ta machine dans `EXPO_PUBLIC_API_URL` (pas `127.0.0.1`), puis ouvre `exp://<IP>:8081` dans Expo Go.

## Fonctionnalités

- Auth e-mail / mot de passe (Better Auth + SecureStore)
- Accueil : solo, créer un salon, rejoindre, observer, Lexo du jour, compte
- Lobby : joueurs, réglages hôte (`room:settings`), partage du code, démarrer / quitter
- Reprise de session (`room:rejoin` via SecureStore)
- Play : grille tactile, timer, countdown, scores live, `word:shared`
- Résultats : classement, badges, synthèse (`WordTables`), chat de manche, prêt / rematch
- Lexo du jour (HTTP `/api/daily`)
- Profil (badges, stats, parties) + préférences (pseudo, avatars)

Hors scope pour l’instant : OAuth social, annuaire utilisateurs, définitions, sons/haptics, deep links Universal Links, admin.

## Scripts

| Commande | Effet |
|---|---|
| `npm start` | Metro / Expo |
| `npm run web` | Smoke test navigateur |
| `npm run typecheck` | `tsc --noEmit` |

Voir la stratégie produit : store du projet → `docs/lexo-mobile-strategy.md`.
