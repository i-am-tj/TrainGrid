#!/usr/bin/env bash
# Prints the CHANGELOG.md section for one version (without its heading).
#   scripts/release-notes.sh 0.2.0-beta
# Exits 1 if the version has no section or the section is empty.
set -euo pipefail
version="${1:?usage: release-notes.sh <version>}"
file="${2:-CHANGELOG.md}"
notes="$(awk -v v="$version" '
  index($0, "## [" v "]") == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found && /^\[[^]]+\]: / { next }
  found { print }
' "$file")"
# Trim leading and trailing blank lines.
notes="$(printf '%s\n' "$notes" | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"
if [ -z "$notes" ]; then
  echo "No CHANGELOG.md section for $version" >&2
  exit 1
fi
printf '%s\n' "$notes"
