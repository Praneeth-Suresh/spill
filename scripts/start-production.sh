#!/bin/sh

# Exit on any error
set -e

echo "=========================================="
echo "Starting Spill Production Deployment"
echo "=========================================="

# Wait for database to be ready
echo "Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const mysql = require('mysql2/promise');
    const url = process.env.DATABASE_URL;
    mysql.createConnection(url)
      .then(conn => { conn.end(); process.exit(0); })
      .catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "Database is ready!"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Could not connect to database after $MAX_RETRIES attempts"
  exit 1
fi

# Run database migrations
echo "Running database migrations..."
pnpm db:push

# Check if seeding is needed (only if tables are empty)
echo "Checking if database needs seeding..."
FACILITY_COUNT=$(node -e "
  const mysql = require('mysql2/promise');
  const url = process.env.DATABASE_URL;
  mysql.createConnection(url)
    .then(async conn => {
      const [rows] = await conn.execute('SELECT COUNT(*) as count FROM facilities');
      console.log(rows[0].count);
      conn.end();
    })
    .catch(() => console.log('0'));
" 2>/dev/null || echo "0")

if [ "$FACILITY_COUNT" = "0" ]; then
  echo "Database is empty, running seed script..."
  pnpm exec tsx scripts/seed-db.ts
  echo "Database seeded successfully!"
else
  echo "Database already has data ($FACILITY_COUNT facilities), skipping seed."
fi

# Start the application
echo "Starting application server..."
echo "=========================================="
exec node dist/index.js