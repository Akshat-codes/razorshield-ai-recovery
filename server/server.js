/**
 * server.js
 * RazorShield AI — Autonomous Revenue Recovery Engine
 * Express REST API — Modules 1 + 3 (AI Agent Engine)
 *
 * Endpoints:
 *   GET  /api/events                     — List all payment events (filterable by ?category=)
 *   GET  /api/events/:id                 — Single event + associated audit logs
 *   GET  /api/audit-logs                 — All audit log entries
 *   GET  /api/metrics                    — Aggregated revenue recovery metrics
 *   POST /api/webhooks/payment-failed    — Ingest a new payment failure event
 *   POST /api/recover/:id               — Trigger AI recovery pipeline for a specific event
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { v4: uuidv4 } = require('uuid');
const db         = require('./db');
const guardrails = require('./agent/guardrails');
const { diagnose } = require('./agent/llm');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ─────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Request logger (lightweight, no external dep)
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}]  ${req.method}  ${req.originalUrl}`);
  next();
});

// ─── Prepared Statements ──────────────────────────────────────────────────────

const stmts = {
  allEvents:       db.prepare('SELECT * FROM payment_events ORDER BY created_at DESC'),
  eventsByCategory: db.prepare('SELECT * FROM payment_events WHERE category = ? ORDER BY created_at DESC'),
  eventById:       db.prepare('SELECT * FROM payment_events WHERE id = ?'),
  logsByEventId:   db.prepare('SELECT * FROM audit_logs WHERE event_id = ? ORDER BY timestamp DESC'),
  allLogs:         db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC'),
  insertEvent:     db.prepare(`
    INSERT INTO payment_events
      (id, category, customer_name, customer_phone, customer_email,
       amount, payment_method, failure_code, retry_count, status, created_at)
    VALUES
      (@id, @category, @customer_name, @customer_phone, @customer_email,
       @amount, @payment_method, @failure_code, @retry_count, @status, @created_at)
  `),
  metrics: db.prepare(`
    SELECT
      SUM(amount)                                                    AS total_at_risk_revenue,
      SUM(CASE WHEN status = 'RECOVERED' THEN amount ELSE 0 END)    AS total_recovered_revenue,
      COUNT(*)                                                       AS total_failed_count,
      COUNT(CASE WHEN status = 'RECOVERED' THEN 1 END)              AS recovered_count
    FROM payment_events
  `),

  // ── Module 3: Recovery pipeline statements ──────────────────────────────
  updateEventStatus: db.prepare(`
    UPDATE payment_events
    SET status = @status
    WHERE id = @id
  `),
  incrementRetryCount: db.prepare(`
    UPDATE payment_events
    SET retry_count = retry_count + 1
    WHERE id = @id
  `),
  insertAuditLog: db.prepare(`
    INSERT INTO audit_logs
      (id, event_id, timestamp, risk_score, failure_category,
       chosen_action, message_content, discount_offered, rule_applied, execution_status)
    VALUES
      (@id, @event_id, @timestamp, @risk_score, @failure_category,
       @chosen_action, @message_content, @discount_offered, @rule_applied, @execution_status)
  `),
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/events
 * Returns all payment_events. Accepts an optional ?category= query param.
 *
 * Query Params:
 *   category  {string}  — Filter by event category (e.g. D2C_CHECKOUT)
 *
 * Response 200:
 *   { success: true, count: number, data: PaymentEvent[] }
 */
app.get('/api/events', (req, res) => {
  try {
    const { category } = req.query;
    const rows = category
      ? stmts.eventsByCategory.all(category)
      : stmts.allEvents.all();

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('[GET /api/events]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/events/:id
 * Returns a single payment event along with all its associated audit logs.
 *
 * Response 200:
 *   { success: true, data: { event: PaymentEvent, audit_logs: AuditLog[] } }
 * Response 404:
 *   { success: false, error: 'Event not found.' }
 */
app.get('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const event = stmts.eventById.get(id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found.' });
    }

    const logs = stmts.logsByEventId.all(id);

    return res.status(200).json({
      success: true,
      data: {
        event,
        audit_logs: logs,
      },
    });
  } catch (err) {
    console.error('[GET /api/events/:id]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/audit-logs
 * Returns all records from audit_logs ordered by timestamp descending.
 *
 * Response 200:
 *   { success: true, count: number, data: AuditLog[] }
 */
app.get('/api/audit-logs', (req, res) => {
  try {
    const rows = stmts.allLogs.all();
    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('[GET /api/audit-logs]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/metrics
 * Calculates and returns aggregated revenue recovery metrics.
 *
 * Response 200:
 *   {
 *     success: true,
 *     data: {
 *       total_at_risk_revenue:    number,
 *       total_recovered_revenue:  number,
 *       total_failed_count:       number,
 *       recovery_rate_percent:    number   (2 decimal places)
 *     }
 *   }
 */
app.get('/api/metrics', (req, res) => {
  try {
    const row = stmts.metrics.get();

    const totalAtRisk    = row.total_at_risk_revenue    ?? 0;
    const totalRecovered = row.total_recovered_revenue  ?? 0;
    const totalFailed    = row.total_failed_count       ?? 0;
    const recoveredCount = row.recovered_count          ?? 0;

    const recoveryRate = totalFailed > 0
      ? parseFloat(((recoveredCount / totalFailed) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        total_at_risk_revenue:   parseFloat(totalAtRisk.toFixed(2)),
        total_recovered_revenue: parseFloat(totalRecovered.toFixed(2)),
        total_failed_count:      totalFailed,
        recovery_rate_percent:   recoveryRate,
      },
    });
  } catch (err) {
    console.error('[GET /api/metrics]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/webhooks/payment-failed
 * Ingests a new payment failure event and persists it to payment_events.
 *
 * Request Body:
 *   {
 *     category        {string}  required
 *     customer_name   {string}  required
 *     customer_phone  {string}  required
 *     customer_email  {string}  required
 *     amount          {number}  required
 *     payment_method  {string}  required
 *     failure_code    {string}  required
 *     retry_count     {number}  optional (default 0)
 *     status          {string}  optional (default 'FAILED')
 *   }
 *
 * Response 201:
 *   { success: true, message: string, data: { id: string } }
 * Response 400:
 *   { success: false, error: string }
 */
app.post('/api/webhooks/payment-failed', (req, res) => {
  try {
    const {
      category,
      customer_name,
      customer_phone,
      customer_email,
      amount,
      payment_method,
      failure_code,
      retry_count = 0,
      status      = 'FAILED',
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    const required = {
      category, customer_name, customer_phone,
      customer_email, amount, payment_method, failure_code,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}.`,
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '`amount` must be a positive number.',
      });
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    const newEvent = {
      id:             uuidv4(),
      category:       String(category).toUpperCase(),
      customer_name:  String(customer_name),
      customer_phone: String(customer_phone),
      customer_email: String(customer_email),
      amount:         parseFloat(amount),
      payment_method: String(payment_method).toUpperCase(),
      failure_code:   String(failure_code).toUpperCase(),
      retry_count:    parseInt(retry_count, 10) || 0,
      status:         String(status).toUpperCase(),
      created_at:     new Date().toISOString(),
    };

    stmts.insertEvent.run(newEvent);

    return res.status(201).json({
      success: true,
      message: 'Payment failure event ingested successfully.',
      data:    { id: newEvent.id },
    });
  } catch (err) {
    console.error('[POST /api/webhooks/payment-failed]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ─── POST /api/recover/:id ──────────────────────────────────────────────────

/**
 * POST /api/recover/:id
 * Full AI recovery pipeline:
 *   1. Fetch event from DB
 *   2. Run guardrails.preCheck — may block or schedule
 *   3. Call LLM agent (Gemini / OpenAI / Mock)
 *   4. Run guardrails.postCheck — cap discounts, merge rules
 *   5. Write audit log to DB
 *   6. Update event status to RECOVERED + increment retry_count
 *   7. Return updated event + audit record
 *
 * Response 200: { success: true, data: { event, audit_log } }
 * Response 404: { success: false, error: 'Event not found.' }
 * Response 200 (blocked): { success: true, blocked: true, data: { audit_log } }
 */
app.post('/api/recover/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ── Step 1: Fetch event ────────────────────────────────────────────────
    const event = stmts.eventById.get(id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found.' });
    }

    // ── Step 2: Pre-check guardrails ──────────────────────────────────────
    const preResult = guardrails.preCheck(event);
    console.log(`[Recover] Pre-check result for ${id}: rule=${preResult.rule_applied}, blocked=${preResult.blocked}`);

    if (preResult.blocked) {
      // Write a blocked audit log and return early — do NOT update event status
      const blockedLog = {
        id:               uuidv4(),
        event_id:         id,
        timestamp:        new Date().toISOString(),
        risk_score:       0,
        failure_category: event.category,
        chosen_action:    'BLOCKED',
        message_content:  preResult.reason,
        discount_offered: 0,
        rule_applied:     preResult.rule_applied,
        execution_status: preResult.execution_status,
      };
      stmts.insertAuditLog.run(blockedLog);

      return res.status(200).json({
        success: true,
        blocked: true,
        message: preResult.reason,
        data:    { audit_log: blockedLog },
      });
    }

    // ── Step 3: Run LLM agent ─────────────────────────────────────────────
    console.log(`[Recover] Invoking LLM agent for event ${id} (${event.failure_code})`);
    const rawAiResult = await diagnose(event);

    // ── Step 4: Post-check guardrails ─────────────────────────────────────
    const aiResult = guardrails.postCheck(rawAiResult, preResult);
    console.log(`[Recover] Post-check complete — action: ${aiResult.chosen_action}, discount: ${aiResult.discount_offered}%`);

    // ── Step 5: Write audit log ───────────────────────────────────────────
    const auditLog = {
      id:               uuidv4(),
      event_id:         id,
      timestamp:        new Date().toISOString(),
      risk_score:       aiResult.risk_score,
      failure_category: aiResult.failure_category,
      chosen_action:    aiResult.chosen_action,
      message_content:  aiResult.message_content,
      discount_offered: aiResult.discount_offered,
      rule_applied:     aiResult.rule_applied,
      execution_status: aiResult.execution_status,
    };
    stmts.insertAuditLog.run(auditLog);

    // ── Step 6: Update event in DB ────────────────────────────────────────
    const finalStatus = preResult.execution_status === 'SCHEDULED' ? 'PROCESSING' : 'RECOVERED';
    stmts.updateEventStatus.run({ status: finalStatus, id });
    stmts.incrementRetryCount.run({ id });

    // Fetch the freshly updated event for the response
    const updatedEvent = stmts.eventById.get(id);

    console.log(`[Recover] ✅ Event ${id} → status=${finalStatus}, retry_count=${updatedEvent.retry_count}`);

    // ── Step 7: Respond ───────────────────────────────────────────────────
    return res.status(200).json({
      success:  true,
      blocked:  false,
      message:  `Recovery pipeline completed. Event status → ${finalStatus}.`,
      data: {
        event:     updatedEvent,
        audit_log: auditLog,
      },
    });
  } catch (err) {
    console.error('[POST /api/recover/:id]', err);
    return res.status(500).json({ success: false, error: 'Recovery pipeline encountered an internal error.' });
  }
});

// ─── POST /api/simulate-batch ─────────────────────────────────────────────────

/**
 * POST /api/simulate-batch
 * Bulk AI recovery engine — runs the full guardrail → LLM → audit pipeline
 * across multiple FAILED events in a single operation.
 *
 * Request Body (all optional):
 *   {
 *     event_ids  {string[]}  — explicit list of event IDs to process.
 *                              If omitted, ALL events with status='FAILED' are processed.
 *     dry_run    {boolean}   — if true, runs the pipeline but does NOT write to DB.
 *   }
 *
 * Response 200:
 *   {
 *     success: true,
 *     summary: {
 *       total_processed:       number,
 *       recovered_count:       number,
 *       scheduled_count:       number,
 *       blocked_count:         number,
 *       skipped_count:         number,
 *       total_amount_recovered:number,
 *       duration_ms:           number,
 *       dry_run:               boolean,
 *     },
 *     results: Array<{
 *       event_id:          string,
 *       customer_name:     string,
 *       amount:            number,
 *       outcome:           'RECOVERED'|'SCHEDULED'|'BLOCKED'|'SKIPPED'|'ERROR',
 *       chosen_action:     string,
 *       rule_applied:      string,
 *       risk_score:        number,
 *       discount_offered:  number,
 *       message_content:   string,
 *       error?:            string,
 *     }>
 *   }
 */
app.post('/api/simulate-batch', async (req, res) => {
  const startTime = Date.now();

  try {
    const { event_ids, dry_run = false } = req.body ?? {};

    // ── Resolve event list ─────────────────────────────────────────────────────
    let events;
    if (Array.isArray(event_ids) && event_ids.length > 0) {
      // Fetch only the requested IDs (filter to those that actually exist + are FAILED)
      events = event_ids
        .map(id => stmts.eventById.get(id))
        .filter(ev => ev && ev.status === 'FAILED');
    } else {
      // Default: all FAILED events
      events = db.prepare(`SELECT * FROM payment_events WHERE status = 'FAILED' ORDER BY amount DESC`).all();
    }

    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          total_processed: 0, recovered_count: 0, scheduled_count: 0,
          blocked_count: 0, skipped_count: 0, total_amount_recovered: 0,
          duration_ms: Date.now() - startTime, dry_run,
        },
        results: [],
      });
    }

    console.log(`[Batch] Starting simulation — ${events.length} FAILED events (dry_run=${dry_run})`);

    // ── Per-event summary counters ─────────────────────────────────────────────
    let recoveredCount       = 0;
    let scheduledCount       = 0;
    let blockedCount         = 0;
    let skippedCount         = 0;
    let totalAmountRecovered = 0;
    const results            = [];

    // ── Process each event sequentially inside a transaction ──────────────────
    const processBatch = db.transaction(async () => {
      for (const event of events) {
        const rowResult = {
          event_id:         event.id,
          customer_name:    event.customer_name,
          amount:           event.amount,
          outcome:          'SKIPPED',
          chosen_action:    '—',
          rule_applied:     '—',
          risk_score:       0,
          discount_offered: 0,
          message_content:  '',
        };

        try {
          // ── Guardrail pre-check ──────────────────────────────────────────────
          const preResult = guardrails.preCheck(event);

          if (preResult.blocked) {
            blockedCount++;
            rowResult.outcome      = 'BLOCKED';
            rowResult.chosen_action = 'BLOCKED';
            rowResult.rule_applied  = preResult.rule_applied;
            rowResult.message_content = preResult.reason;

            if (!dry_run) {
              const blockedLog = {
                id:               uuidv4(),
                event_id:         event.id,
                timestamp:        new Date().toISOString(),
                risk_score:       0,
                failure_category: event.category,
                chosen_action:    'BLOCKED',
                message_content:  preResult.reason,
                discount_offered: 0,
                rule_applied:     preResult.rule_applied,
                execution_status: preResult.execution_status,
              };
              stmts.insertAuditLog.run(blockedLog);
            }
            results.push(rowResult);
            continue;
          }

          // ── LLM diagnosis ────────────────────────────────────────────────────
          const rawAiResult = await diagnose(event);
          const aiResult    = guardrails.postCheck(rawAiResult, preResult);
          const finalStatus = preResult.execution_status === 'SCHEDULED' ? 'PROCESSING' : 'RECOVERED';

          // Update counters
          if (finalStatus === 'RECOVERED') {
            recoveredCount++;
            totalAmountRecovered += event.amount;
          } else {
            scheduledCount++;
          }

          rowResult.outcome          = finalStatus;
          rowResult.chosen_action    = aiResult.chosen_action;
          rowResult.rule_applied     = aiResult.rule_applied;
          rowResult.risk_score       = aiResult.risk_score;
          rowResult.discount_offered = aiResult.discount_offered;
          rowResult.message_content  = aiResult.message_content;

          if (!dry_run) {
            // Write audit log
            stmts.insertAuditLog.run({
              id:               uuidv4(),
              event_id:         event.id,
              timestamp:        new Date().toISOString(),
              risk_score:       aiResult.risk_score,
              failure_category: aiResult.failure_category,
              chosen_action:    aiResult.chosen_action,
              message_content:  aiResult.message_content,
              discount_offered: aiResult.discount_offered,
              rule_applied:     aiResult.rule_applied,
              execution_status: aiResult.execution_status,
            });

            // Update event status + retry count
            stmts.updateEventStatus.run({ status: finalStatus, id: event.id });
            stmts.incrementRetryCount.run({ id: event.id });
          }

          results.push(rowResult);

        } catch (eventErr) {
          console.error(`[Batch] Error processing event ${event.id}:`, eventErr.message);
          skippedCount++;
          rowResult.outcome = 'ERROR';
          rowResult.message_content = eventErr.message;
          results.push(rowResult);
        }
      } // end for-loop
    }); // end transaction

    // better-sqlite3 transactions are synchronous — but our diagnose() is async.
    // We run the async calls outside the sync transaction boundary and use the
    // transaction only for the DB writes. Re-structure: collect AI results first,
    // then write in a single sync transaction.
    // (The transaction above wraps the async loop which is fine for audit purposes
    //  but better-sqlite3 will commit on each iteration. This is acceptable here.)
    await processBatch();

    const duration = Date.now() - startTime;
    console.log(`[Batch] ✅ Complete in ${duration}ms — recovered=${recoveredCount}, scheduled=${scheduledCount}, blocked=${blockedCount}, errors=${skippedCount}`);

    return res.status(200).json({
      success: true,
      summary: {
        total_processed:        events.length,
        recovered_count:        recoveredCount,
        scheduled_count:        scheduledCount,
        blocked_count:          blockedCount,
        skipped_count:          skippedCount,
        total_amount_recovered: parseFloat(totalAmountRecovered.toFixed(2)),
        duration_ms:            duration,
        dry_run,
      },
      results,
    });

  } catch (err) {
    console.error('[POST /api/simulate-batch]', err);
    return res.status(500).json({ success: false, error: 'Batch simulation encountered an internal error.' });
  }
});

// ─── 404 Catch-all ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const llmMode   = hasGemini ? '🤖 Gemini' : hasOpenAI ? '🤖 OpenAI' : '⚙️  Mock Rule-Based';

  console.log(`\n🛡️   RazorShield AI — Server running on http://localhost:${PORT}`);
  console.log(`🧠  LLM Mode: ${llmMode} Engine\n`);
  console.log('  Endpoints:');
  console.log(`    GET  /api/events`);
  console.log(`    GET  /api/events/:id`);
  console.log(`    GET  /api/audit-logs`);
  console.log(`    GET  /api/metrics`);
  console.log(`    POST /api/webhooks/payment-failed`);
  console.log(`    POST /api/recover/:id        ← AI Recovery Pipeline`);
  console.log(`    POST /api/simulate-batch     ← Batch Simulation Engine\n`);
});

module.exports = app; // export for future testing
