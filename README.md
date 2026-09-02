# Lexo

Jeu de lettres en temps réel (React, Express, Socket.IO).

En production : `npm run build` puis `npm start`. Le serveur sert le front et les WebSockets sur le même port (`PORT`, défaut 3001).

## Release → VM Oracle

Chaque **GitHub Release** déclenche `.github/workflows/deploy-release.yml`, qui SSH sur la VM, checkout le tag, rebuild et redémarre `lexo.service`.

Secrets du dépôt (`Settings → Secrets and variables → Actions`) :

| Secret | Valeur |
|---|---|
| `ORACLE_HOST` | IP publique de la VM |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | clé privée **dédiée** au déploiement (pas ta clé perso) |
