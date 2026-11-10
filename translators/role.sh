#!/bin/sh
# Make a site user a member of the translators' section with their roles, or
# set their roles anew. The user must have signed in to the site once.
#
#   ./translators/role.sh <uid> [editor] [maintainer] [admin]
#
# <uid> is the game uid the user signed in with (`dev-translator` for the
# development sign-in). Every member is a `translator`; add any of:
#   editor     — the lead: approves, exports for the game (Romanov);
#   maintainer — builds the pack: exports for the game, marks "went out in
#                pack <version>"; never approves (Kolooo);
#   admin      — all of it.
# The roles given replace the member's roles. Prints the member's row.
set -eu
cd "$(dirname "$0")/.."
UID_ARG="${1:?usage: $0 <uid> [editor] [maintainer] [admin]}"
shift
ROLES="translator"
for r in "$@"; do
    case "$r" in
    translator) ;;
    editor | maintainer | admin) ROLES="$ROLES,$r" ;;
    *) echo "role: editor, maintainer or admin" >&2; exit 2 ;;
    esac
done
OUT="$(docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v uid="$1" -v roles="$2"' sh "$UID_ARG" "$ROLES" <<'SQL'
SELECT COUNT(*) AS found FROM users WHERE uid = :'uid' \gset
\if :found
INSERT INTO translators.members (user_id, note, roles)
SELECT id, 'translators/role.sh', string_to_array(:'roles', ',') FROM users WHERE uid = :'uid'
ON CONFLICT (user_id) DO UPDATE SET roles = EXCLUDED.roles;
SELECT u.uid, COALESCE(u.nickname, '') AS nickname, array_to_string(m.roles, ', ') AS roles, m.added_at
FROM translators.members m JOIN users u ON u.id = m.user_id WHERE u.uid = :'uid';
\else
\echo 'NO_SUCH_USER'
\endif
SQL
)"
case "$OUT" in
*NO_SUCH_USER*) echo "No such user: they have to sign in to the site once." >&2; exit 1 ;;
esac
echo "$OUT"
