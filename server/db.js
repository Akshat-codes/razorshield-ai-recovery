/**
 * db.js
 * Initializes and exports the SQLite database connection.
 * Uses better-sqlite3 for synchronous, high-performance DB access.
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'recovery.db');

const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema Bootstrap ──────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_events (
    id               TEXT    PRIMARY KEY,
    category         TEXT    NOT NULL,
    customer_name    TEXT    NOT NULL,
    customer_phone   TEXT    NOT NULL,
    customer_email   TEXT    NOT NULL,
    amount           REAL    NOT NULL,
    payment_method   TEXT    NOT NULL,
    failure_code     TEXT    NOT NULL,
    retry_count      INTEGER NOT NULL DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'FAILED',
    created_at       TEXT    NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id                 TEXT  PRIMARY KEY,
    event_id           TEXT  NOT NULL,
    timestamp          TEXT  NOT NULL,
    risk_score         REAL  NOT NULL,
    failure_category   TEXT  NOT NULL,
    chosen_action      TEXT  NOT NULL,
    message_content    TEXT  NOT NULL,
    discount_offered   REAL  NOT NULL DEFAULT 0,
    rule_applied       TEXT  NOT NULL,
    execution_status   TEXT  NOT NULL
  );
`);

module.exports = db;
