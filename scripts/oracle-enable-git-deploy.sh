#!/usr/bin/env bash
# À lancer UNE FOIS sur la VM Oracle (ubuntu@lexo) après le premier push GitHub.
# Usage: bash oracle-enable-git-deploy.sh https://github.com/USER/lexo.git
set -euo pipefail

REPO_URL="${1:?URL du dépôt GitHub manquante}"

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git

sudo tee /etc/sudoers.d/lexo-restart >/dev/null <<'EOF'
ubuntu ALL=(root) NOPASSWD: /bin/systemctl restart lexo, /bin/systemctl status lexo, /bin/systemctl is-active lexo
EOF
sudo chmod 440 /etc/sudoers.d/lexo-restart

if [[ -d /home/ubuntu/lexo/.git ]]; then
  echo "Le dossier ~/lexo est déjà un dépôt git."
  git -C /home/ubuntu/lexo remote -v
  exit 0
fi

if [[ -d /home/ubuntu/lexo ]]; then
  mv /home/ubuntu/lexo "/home/ubuntu/lexo.rsync.bak.$(date +%Y%m%d%H%M%S)"
fi

git clone "$REPO_URL" /home/ubuntu/lexo
cd /home/ubuntu/lexo
npm install
npm run build
sudo systemctl restart lexo
sleep 2
curl -fsS http://127.0.0.1:3001/health
echo
echo "OK — les prochaines releases GitHub mettront à jour ce clone."
