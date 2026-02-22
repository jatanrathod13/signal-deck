#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '../src/supabase/migrations');

if (!fs.existsSync(migrationsDir)) {
  console.error(`Migration directory not found: ${migrationsDir}`);
  process.exit(1);
}

const migrations = fs.readdirSync(migrationsDir)
  .filter((entry) => entry.endsWith('.sql'))
  .sort();

if (migrations.length === 0) {
  console.log('No SQL migrations found.');
  process.exit(0);
}

console.log('Supabase SQL migrations:');
for (const migration of migrations) {
  console.log(`- ${migration}`);
}
