#!/usr/bin/env bash
set -euo pipefail

# Save exact cURL commands and real JSON responses for the AI grader.
GITHUB_USER="$1"
if [ -z "$GITHUB_USER" ]; then
  GITHUB_USER="DEEMALAJLAN132005"
fi
BASE="http://127.0.0.1:5000"
if [ -n "$(printenv BASE_URL || true)" ]; then
  BASE="$(printenv BASE_URL)"
fi
mkdir -p evidence
COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

capture() {
  local name="$1"
  shift
  local command
  printf -v command '%q ' "$@"
  printf '%s\n' "$command" > "evidence/$name"
  printf '%s\n' "$command"
  "$@" | tee -a "evidence/$name"
  printf '\n' | tee -a "evidence/$name"
}

capture getallbooks curl -fsS "$BASE/"
capture getbooksbyISBN curl -fsS "$BASE/isbn/1"
capture getbooksbyauthor curl -fsS "$BASE/author/Jane%20Austen"
capture getbooksbytitle curl -fsS "$BASE/title/Pride%20and%20Prejudice"
capture getbookreview curl -fsS "$BASE/review/1"

USER_NAME="reviewer_$(date +%s)"
DEMO_PASSWORD="BookDemoPassword!"
capture register curl -fsS -X POST "$BASE/register" -H 'Content-Type: application/json' -d "{\"username\":\"$USER_NAME\",\"password\":\"$DEMO_PASSWORD\"}"
capture login curl -fsS -c "$COOKIE_FILE" -X POST "$BASE/customer/login" -H 'Content-Type: application/json' -d "{\"username\":\"$USER_NAME\",\"password\":\"$DEMO_PASSWORD\"}"
capture reviewadded curl -fsS -b "$COOKIE_FILE" -X PUT "$BASE/customer/auth/review/1?review=Excellent%20book"
capture deletereview curl -fsS -b "$COOKIE_FILE" -X DELETE "$BASE/customer/auth/review/1"

# Task 11: Proof of upstream fork parent.
REPO_URL="https://api.github.com/repos/$GITHUB_USER/expressBookReviews"
printf 'curl -fsS %s | jq -r .parent.full_name\n' "$REPO_URL" > evidence/githubrepo
if command -v jq >/dev/null 2>&1; then
  curl -fsS "$REPO_URL" | jq -r '.parent.full_name' | tee -a evidence/githubrepo
else
  curl -fsS "$REPO_URL" | node -e 'let data="";process.stdin.on("data",x=>data+=x);process.stdin.on("end",()=>console.log(JSON.parse(data).parent.full_name));' | tee -a evidence/githubrepo
fi
printf '\nEvidence saved in evidence/\n'
