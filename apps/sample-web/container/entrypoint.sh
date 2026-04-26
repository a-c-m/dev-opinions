#!/bin/sh
# Runtime env injection for sample-web — implements ADR 0019.
#
# The bundle was built with BUILD_MODE=true, so every VITE_* variable in the
# source has been baked as a placeholder token like ___KEY___. This script
# walks the served files, replaces each token with the real value from the
# container's environment, and hands off to nginx (the
# /docker-entrypoint.d/ shim that ships with nginx:alpine).
#
# If a variable has no value in the container env, we leave the placeholder
# in place and warn — better visible breakage than a silent default that
# pretends to be a real config.

set -eu

ROOT="${WEB_ROOT:-/usr/share/nginx/html}"

# Source of truth for which keys to replace. Add new ones here when env.ts
# (sample-web/src/env.ts) gains a new VITE_* variable.
KEYS="VITE_API_URL"

EXPRS=""
for KEY in $KEYS; do
  # POSIX-portable indirect lookup.
  VALUE="$(env | sed -n "s/^${KEY}=//p")"
  if [ -z "$VALUE" ]; then
    echo "warn: $KEY not set; leaving placeholder ___${KEY}___ in built bundle" >&2
    continue
  fi
  # Escape sed metacharacters in the value: $ / \ &
  ESC="$(printf '%s' "$VALUE" | sed -e 's/[$/&\\]/\\&/g')"
  EXPRS="$EXPRS -e s/___${KEY}___/${ESC}/g"
done

if [ -n "$EXPRS" ]; then
  echo "info: replacing placeholder env tokens in $ROOT"
  find "$ROOT" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 \
    | xargs -0 sed -i $EXPRS
fi

exit 0
