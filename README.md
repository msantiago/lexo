# Lexo

Jeu de lettres en temps réel (React, Express, Socket.IO).

Le dictionnaire vient du lexique Grammalecte / Dicollecte 7.7 (variante Classique, MPL-2.0). Pour le régénérer : `npm run build:dict`.

En production : `npm run build` puis `npm start`. Le serveur sert le front et les WebSockets sur le même port (`PORT`, défaut 3001).

## Authentification

Les comptes sont optionnels : on peut encore jouer avec un prénom seul.

- E-mail + mot de passe (création de compte Lexo et connexion, avec « se souvenir de moi »)
- Google, Apple, Facebook, Microsoft, GitHub et Discord si les identifiants OAuth sont configurés
- Parties et badges enregistrés pour les joueurs connectés (`data/lexo.sqlite`)

Copie `.env.example` vers `.env`, renseigne `BETTER_AUTH_SECRET` (32+ caractères) et `BETTER_AUTH_URL`.

Redirect URIs OAuth : `{BETTER_AUTH_URL}/api/auth/callback/{google,apple,facebook,microsoft,github,discord}`

Apple exige du HTTPS (pas `localhost`). Les comptes sont stockés dans `data/auth.sqlite` (hors git).

## Release → VM Oracle

Chaque **GitHub Release** déclenche `.github/workflows/deploy-release.yml`, qui SSH sur la VM, checkout le tag, rebuild et redémarre `lexo.service`.

Secrets du dépôt (`Settings → Secrets and variables → Actions`) :

| Secret | Valeur |
|---|---|
| `ORACLE_HOST` | IP publique de la VM |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | clé privée **dédiée** au déploiement (pas ta clé perso) |
