#!/bin/sh
set -e
# Apply pending database migrations before starting (disable with RUN_MIGRATIONS=false).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations…"
  prisma migrate deploy --schema ./prisma/schema.prisma
fi
exec "$@"
