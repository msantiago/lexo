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

Sur un téléphone physique, mets l’IP de ta machine dans `EXPO_PUBLIC_API_URL`.

## MVP actuel

- Auth e-mail / mot de passe (Better Auth + SecureStore via `@better-auth/expo`)
- Accueil : solo, créer un salon, rejoindre (code ou liste)
- Salon lobby : joueurs, règles, démarrer (hôte) / quitter
- Placeholders pour la phase Play (prochaine itération)

## Scripts

| Commande | Effet |
|---|---|
| `npm start` | Metro / Expo |
| `npm run web` | Smoke test navigateur |
| `npm run typecheck` | `tsc --noEmit` |

Voir la stratégie produit : store du projet → `docs/lexo-mobile-strategy.md`.
