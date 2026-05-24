#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd "$script_dir/.." && pwd)"
env_file="$deploy_dir/.env"
compose_file="$deploy_dir/docker-compose.example.yml"

if [[ ! -f "$env_file" ]]; then
  echo "Missing .env at $env_file"
  exit 1
fi

set -a
source "$env_file"
set +a

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_root="${RUSHI_BACKUP_DIR:-$deploy_dir/backups}"
target_dir="$backup_root/$timestamp"
mkdir -p "$target_dir"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$target_dir/postgres.dump"

collab_container="$(docker compose --env-file "$env_file" -f "$compose_file" ps -q rushi-collab)"
if [[ -n "$collab_container" ]]; then
  docker cp "$collab_container:/var/lib/rushi/files" "$target_dir/files"
fi

cp "$env_file" "$target_dir/.env.backup"
cp "$deploy_dir/caddy/Caddyfile.example" "$target_dir/Caddyfile.example"

echo "Backup written to $target_dir"