#!/usr/bin/env bash
# Startet lokale Postgres, Mock-Supabase und App-Server, dann den Zwei-Geräte-Test.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
B=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
rm -rf /tmp/pgt && mkdir -p /tmp/pgt && chown postgres /tmp/pgt 2>/dev/null || true
su postgres -c "$B/initdb -D /tmp/pgt/d -A trust >/dev/null && $B/pg_ctl -D /tmp/pgt/d -o '-k /tmp/pgt -p 5499' -l /tmp/pgt/log start >/dev/null"
sleep 2
P="psql -h /tmp/pgt -p 5499 -U postgres -q -v ON_ERROR_STOP=1"
$P -c "create role anon nologin; create role authenticated nologin;"
sed 's/HIER_EUER_REISECODE/testcode/' "$ROOT/supabase.sql" | $P
cd "$ROOT/tests"
python3 mock_supabase.py & M=$!
(cd "$ROOT" && python3 -m http.server 8080 >/dev/null 2>&1) & H=$!
sleep 1
python3 e2e.py || true
kill $M $H; su postgres -c "$B/pg_ctl -D /tmp/pgt/d stop" >/dev/null
