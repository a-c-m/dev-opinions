#!/bin/sh
# Runtime env injection for sample-web — implements ADR 0019.
#
# The bundle was built with @import-meta-env/unplugin in runtime mode, so
# index.html contains a single placeholder script that holds a sentinel
# JSON string. This step swaps that sentinel for a JSON object built from
# the container's environment, restricted to the keys allowlisted in
# .env.example. Bundle JS is never touched.
#
# Variables not present in the container env are left undefined in the
# emitted object; the in-browser zod schema in src/env.ts decides whether
# that is an error (required) or a default (optional).

set -eu

EXAMPLE="${IMV_EXAMPLE:-/etc/import-meta-env/.env.example}"
TARGET="${IMV_TARGET:-/usr/share/nginx/html/index.html}"

echo "info: replacing import-meta-env placeholder in $TARGET"
# --disposable: skip writing a .bak alongside the swapped index.html, which
# nginx would otherwise serve from the same directory.
import-meta-env --disposable -x "$EXAMPLE" -p "$TARGET"
