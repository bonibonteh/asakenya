#!/bin/bash
# Local-only helper: fresh DB -> stub -> 001 -> 002 -> (again) -> optional extra scripts
# usage: run_local.sh <socketdir> <port> [extra.sql ...]
set -e
D=$(cd "$(dirname "$0")/.." && pwd)
P="psql -U postgres -h $1 -p $2 -X -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists asa_test" -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" -c "create database asa_test"
P="$P -d asa_test"
$P -f $D/tests/local_stub.sql
$P -f $D/migrations/001_opportunities_and_roles.sql
$P -f $D/migrations/002_graduate_hub.sql
$P -f $D/migrations/003_events_and_announcements.sql
echo "== second run (idempotency) =="
$P -f $D/migrations/001_opportunities_and_roles.sql
$P -f $D/migrations/002_graduate_hub.sql
$P -f $D/migrations/003_events_and_announcements.sql
shift 2
for f in "$@"; do $P -f "$f"; done
