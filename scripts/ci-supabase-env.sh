#!/usr/bin/env bash
# Prints the LOCAL Supabase stack's URL and keys as KEY=value lines, in the
# names the app and the tests read. CI appends the output to $GITHUB_ENV
# (.github/workflows/ci.yml). These are the stack's fixed development keys,
# never production values; the script refuses any non-local URL.
set -euo pipefail

status="$(npx supabase status -o env 2>/dev/null)"

value() {
  printf '%s\n' "${status}" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" | head -n 1
}

url="$(value API_URL)"
publishable="$(value PUBLISHABLE_KEY)"
secret="$(value SECRET_KEY)"

case "${url}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing a non-local Supabase URL: '${url}'" >&2; exit 1 ;;
esac
if [ -z "${publishable}" ] || [ -z "${secret}" ]; then
  echo "supabase status did not print PUBLISHABLE_KEY and SECRET_KEY" >&2
  exit 1
fi

echo "NEXT_PUBLIC_SUPABASE_URL=${url}"
echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}"
echo "SUPABASE_SECRET_KEY=${secret}"
