#!/bin/sh
# Make a site user a member of the translators' section with a role, or
# change their role. The user must have signed in to the site once.
#
#   ./translators/role.sh <uid> [translator|editor|admin]
#
# <uid> is the game uid the user signed in with (`dev-translator` for the
# development sign-in). The role defaults to `translator`; `editor` is the
# lead who approves (one person). Prints the member's row.
set -eu
cd "$(dirname "$0")/.."
UID_ARG="${1:?usage: $0 <uid> [translator|editor|admin]}"
ROLE="${2:-translator}"
case "$ROLE" in translator | editor | admin) ;; *) echo "role: translator, editor or admin" >&2; exit 2 ;; esac
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v uid="$1" -v role="$2"' sh "$UID_ARG" "$ROLE" <<'SQL'
SELECT COUNT(*) AS found FROM users WHERE uid = :'uid' \gset
\if :found
INSERT INTO translators.members (user_id, note, role)
SELECT id, 'translators/role.sh', :'role' FROM users WHERE uid = :'uid'
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
SELECT u.uid, COALESCE(u.nickname, '') AS nickname, m.role, m.added_at
FROM translators.members m JOIN users u ON u.id = m.user_id WHERE u.uid = :'uid';
\else
\echo 'No such user: they have to sign in to the site once.'
\quit 1
\endif
SQL
