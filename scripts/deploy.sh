#!/usr/bin/env bash
# 本地构建并发布到 GitHub Pages（gh-pages 分支）
# 需要本地已配置 GitHub 凭据（HTTPS token 或 SSH）
set -e
cd "$(dirname "$0")/.."

REMOTE="${DEPLOY_REMOTE:-https://github.com/NanoTurtle1145/h2zbmh-site.git}"

echo "==> 构建"
npm run build

echo "==> 组装发布目录"
rm -rf .deploy
mkdir -p .deploy
cp -a public/. .deploy/
[ -f static/CNAME ] && cp -f static/CNAME .deploy/CNAME
touch .deploy/.nojekyll

echo "==> 推送 gh-pages"
cd .deploy
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-NanoTurtle1145}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-198453844+NanoTurtle1145@users.noreply.github.com}" \
    commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git -c http.version=HTTP/1.1 push -f "$REMOTE" gh-pages
cd ..
rm -rf .deploy
echo "==> 完成 https://www.h2zbmh.cn/"
