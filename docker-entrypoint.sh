#!/bin/sh
set -e

attempt=1
max_attempts=30

until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Database was not reachable after $max_attempts attempts."
    exit 1
  fi

  echo "Database is not ready yet. Retrying migration in 2 seconds... ($attempt/$max_attempts)"
  attempt=$((attempt + 1))
  sleep 2
done

npx prisma db seed

exec "$@"
