/**
 * seed.js
 * Seeds the database with 18 realistic payment failure events:
 *   - 6 × D2C_CHECKOUT
 *   - 6 × SUBSCRIPTION_MANDATE
 *   - 6 × B2B_INVOICE
 *
 * Run via: npm run seed
 */

'use strict';

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns an ISO-8601 timestamp offset by `daysAgo` from now.
 * @param {number} daysAgo
 * @returns {string}
 */
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const events = [
  // ── D2C_CHECKOUT (6 records) ────────────────────────────────────────────────
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Arjun Mehta',
    customer_phone: '+919876543210',
    customer_email: 'arjun.mehta@gmail.com',
    amount: 3499.00,
    payment_method: 'UPI',
    failure_code: 'UPI_TIMEOUT',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(0),
  },
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Priya Sharma',
    customer_phone: '+919812345678',
    customer_email: 'priya.sharma@outlook.com',
    amount: 1899.50,
    payment_method: 'UPI',
    failure_code: 'UPI_TIMEOUT',
    retry_count: 2,
    status: 'FAILED',
    created_at: pastDate(1),
  },
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Rohan Kapoor',
    customer_phone: '+919900112233',
    customer_email: 'rohan.kapoor@yahoo.com',
    amount: 5999.00,
    payment_method: 'CREDIT_CARD',
    failure_code: 'GATEWAY_DOWNTIME',
    retry_count: 0,
    status: 'FAILED',
    created_at: pastDate(1),
  },
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Sneha Iyer',
    customer_phone: '+918877665544',
    customer_email: 'sneha.iyer@gmail.com',
    amount: 799.00,
    payment_method: 'NET_BANKING',
    failure_code: 'GATEWAY_DOWNTIME',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(2),
  },
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Vikram Nair',
    customer_phone: '+917766554433',
    customer_email: 'vikram.nair@protonmail.com',
    amount: 12499.00,
    payment_method: 'DEBIT_CARD',
    failure_code: 'CART_DROP_OFF',
    retry_count: 0,
    status: 'FAILED',
    created_at: pastDate(2),
  },
  {
    id: uuidv4(),
    category: 'D2C_CHECKOUT',
    customer_name: 'Ananya Pillai',
    customer_phone: '+916655443322',
    customer_email: 'ananya.pillai@gmail.com',
    amount: 2349.00,
    payment_method: 'UPI',
    failure_code: 'CART_DROP_OFF',
    retry_count: 0,
    status: 'FAILED',
    created_at: pastDate(3),
  },

  // ── SUBSCRIPTION_MANDATE (6 records) ───────────────────────────────────────
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Karan Bhatia',
    customer_phone: '+919988776655',
    customer_email: 'karan.bhatia@gmail.com',
    amount: 499.00,
    payment_method: 'UPI_AUTOPAY',
    failure_code: 'AUTO_DEBIT_FAILURE',
    retry_count: 3,
    status: 'FAILED',
    created_at: pastDate(1),
  },
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Meera Joshi',
    customer_phone: '+919977665544',
    customer_email: 'meera.joshi@hotmail.com',
    amount: 999.00,
    payment_method: 'UPI_AUTOPAY',
    failure_code: 'AUTO_DEBIT_FAILURE',
    retry_count: 2,
    status: 'FAILED',
    created_at: pastDate(2),
  },
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Siddharth Rao',
    customer_phone: '+918866554433',
    customer_email: 'siddharth.rao@gmail.com',
    amount: 1499.00,
    payment_method: 'NACH',
    failure_code: 'INSUFFICIENT_FUNDS',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(3),
  },
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Divya Krishnan',
    customer_phone: '+917755443322',
    customer_email: 'divya.krishnan@gmail.com',
    amount: 2999.00,
    payment_method: 'NACH',
    failure_code: 'INSUFFICIENT_FUNDS',
    retry_count: 2,
    status: 'FAILED',
    created_at: pastDate(4),
  },
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Rahul Gupta',
    customer_phone: '+916644332211',
    customer_email: 'rahul.gupta@rediffmail.com',
    amount: 599.00,
    payment_method: 'UPI_AUTOPAY',
    failure_code: 'INSUFFICIENT_FUNDS',
    retry_count: 4,
    status: 'FAILED',
    created_at: pastDate(5),
  },
  {
    id: uuidv4(),
    category: 'SUBSCRIPTION_MANDATE',
    customer_name: 'Pooja Desai',
    customer_phone: '+915533221100',
    customer_email: 'pooja.desai@gmail.com',
    amount: 1999.00,
    payment_method: 'NACH',
    failure_code: 'AUTO_DEBIT_FAILURE',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(6),
  },

  // ── B2B_INVOICE (6 records) ─────────────────────────────────────────────────
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Nexus Technologies Pvt. Ltd.',
    customer_phone: '+911140203040',
    customer_email: 'accounts@nexustech.in',
    amount: 125000.00,
    payment_method: 'BANK_TRANSFER',
    failure_code: 'INVOICE_OVERDUE_15D',
    retry_count: 0,
    status: 'FAILED',
    created_at: pastDate(15),
  },
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Vertex Solutions LLP',
    customer_phone: '+912240506070',
    customer_email: 'finance@vertexsol.com',
    amount: 87500.00,
    payment_method: 'BANK_TRANSFER',
    failure_code: 'INVOICE_OVERDUE_15D',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(17),
  },
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Orion Enterprises',
    customer_phone: '+913340607080',
    customer_email: 'payments@orionent.co.in',
    amount: 210000.00,
    payment_method: 'CHEQUE',
    failure_code: 'INVOICE_OVERDUE_15D',
    retry_count: 0,
    status: 'FAILED',
    created_at: pastDate(16),
  },
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Catalyst Infra Pvt. Ltd.',
    customer_phone: '+914450708090',
    customer_email: 'ap@catalystinfra.com',
    amount: 345000.00,
    payment_method: 'BANK_TRANSFER',
    failure_code: 'INVOICE_OVERDUE_30D',
    retry_count: 2,
    status: 'FAILED',
    created_at: pastDate(32),
  },
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Pinnacle Retail Group',
    customer_phone: '+915560809010',
    customer_email: 'finance@pinnacleretail.in',
    amount: 178500.00,
    payment_method: 'BANK_TRANSFER',
    failure_code: 'INVOICE_OVERDUE_30D',
    retry_count: 3,
    status: 'FAILED',
    created_at: pastDate(35),
  },
  {
    id: uuidv4(),
    category: 'B2B_INVOICE',
    customer_name: 'Stellar Logistics Ltd.',
    customer_phone: '+916670910020',
    customer_email: 'accounts@stellarlogistics.com',
    amount: 92000.00,
    payment_method: 'CHEQUE',
    failure_code: 'INVOICE_OVERDUE_30D',
    retry_count: 1,
    status: 'FAILED',
    created_at: pastDate(30),
  },
];

// ─── Seed Execution ──────────────────────────────────────────────────────────

function seed() {
  // Run inside a transaction for atomicity
  const seedTransaction = db.transaction(() => {
    // Clear existing records (order matters due to any future FK constraints)
    db.prepare('DELETE FROM audit_logs').run();
    db.prepare('DELETE FROM payment_events').run();

    const insert = db.prepare(`
      INSERT INTO payment_events
        (id, category, customer_name, customer_phone, customer_email,
         amount, payment_method, failure_code, retry_count, status, created_at)
      VALUES
        (@id, @category, @customer_name, @customer_phone, @customer_email,
         @amount, @payment_method, @failure_code, @retry_count, @status, @created_at)
    `);

    for (const event of events) {
      insert.run(event);
    }

    return events.length;
  });

  const count = seedTransaction();
  console.log(`\n✅  Database successfully seeded with ${count} records!\n`);
}

seed();
db.close();
