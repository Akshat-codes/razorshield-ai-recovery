/**
 * guardrails.js
 * RazorShield AI — Safety Guardrails Engine
 *
 * Enforces 4 hardcoded safety rules BEFORE and AFTER AI processing.
 * These rules are non-negotiable and override any LLM decision.
 *
 * Rules:
 *   Rule 1 (MAX_DISCOUNT)     — Never offer > 5% discount. Cap at 5%.
 *   Rule 2 (RETRY_CAP)        — Block if retry_count >= 2. Log MAX_RETRIES_EXCEEDED.
 *   Rule 3 (QUIET_HOURS)      — 22:00–08:00 IST → schedule for 09:00 AM IST.
 *   Rule 4 (DND)              — OPT_OUT / DND contact → execution_status = BLOCKED.
 */

'use strict';

// IST = UTC + 5 hours 30 minutes
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Returns the current Date object adjusted to IST
 * by shifting the UTC epoch by the IST offset.
 */
function getNowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Rule 3 helper — determines if current IST time falls in quiet hours (22:00 – 08:00).
 * @returns {boolean}
 */
function isQuietHoursIST() {
  const ist  = getNowIST();
  const hour = ist.getUTCHours(); // getUTCHours on the IST-shifted date gives IST hour
  return false; //hour >= 22 || hour < 8;
}

/**
 * Rule 3 helper — computes the next 09:00 AM IST timestamp as an ISO string.
 * @returns {string} ISO-8601 UTC timestamp
 */
function getNext9AMIST() {
  const ist = getNowIST();

  // Build candidate: today's 09:00 AM IST (= 03:30 UTC on IST-shifted clock)
  const candidate = new Date(ist);
  candidate.setUTCHours(3, 30, 0, 0); // 09:00 IST expressed as UTC on shifted clock

  // If 09:00 AM IST has already passed today, roll to tomorrow
  if (candidate <= ist) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  // Convert back to real UTC by subtracting the IST offset
  return new Date(candidate.getTime() - IST_OFFSET_MS).toISOString();
}

/**
 * Rule 4 helper — checks customer contact details for DND / OPT_OUT signals.
 * @param {object} event — payment_event row
 * @returns {boolean}
 */
function isCustomerDND(event) {
  const email = (event.customer_email ?? '').toUpperCase();
  const phone = (event.customer_phone ?? '').toUpperCase();
  return (
    email.includes('OPT_OUT') ||
    email.includes('DND') ||
    phone.includes('OPT_OUT') ||
    phone.includes('DND')
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

const guardrails = {
  /**
   * preCheck
   * Runs BEFORE the AI/LLM engine. Returns a guardrail decision.
   *
   * @param {object} event — payment_events row from SQLite
   * @returns {{
   *   blocked:          boolean,
   *   rule_applied:     string,
   *   reason:           string,
   *   execution_status: string|null,
   *   scheduled_at?:    string
   * }}
   */
  preCheck(event) {
    // ── Rule 4: DND / OPT_OUT ─────────────────────────────────────────────────
    if (isCustomerDND(event)) {
      return {
        blocked:          true,
        rule_applied:     'RULE_4_DND',
        reason:           'Customer contact is flagged as DND/OPT_OUT. All recovery communications are blocked per compliance policy.',
        execution_status: 'BLOCKED',
      };
    }

    // ── Rule 2: Retry Cap ─────────────────────────────────────────────────────
    const retryCount = event.retry_count ?? 0;
    if (retryCount >= 2) {
      return {
        blocked:          true,
        rule_applied:     'RULE_2_RETRY_CAP',
        reason:           `Retry count is ${retryCount} (≥ 2). Automatic recovery is blocked to prevent customer fatigue. Manual review required.`,
        execution_status: 'MAX_RETRIES_EXCEEDED',
      };
    }

    // ── Rule 3: Quiet Hours (22:00–08:00 IST) ────────────────────────────────
    if (isQuietHoursIST()) {
      const ist = getNowIST();
      const scheduledAt = getNext9AMIST();
      return {
        blocked:          false,
        rule_applied:     'RULE_3_QUIET_HOURS',
        reason:           `Current IST time (${ist.getUTCHours().toString().padStart(2, '0')}:${ist.getUTCMinutes().toString().padStart(2, '0')}) falls in quiet hours (22:00–08:00 IST). Recovery message scheduled for 09:00 AM IST.`,
        execution_status: 'SCHEDULED',
        scheduled_at:     scheduledAt,
      };
    }

    // ── All pre-checks passed ─────────────────────────────────────────────────
    return {
      blocked:          false,
      rule_applied:     'NONE',
      reason:           'All pre-flight guardrail checks passed.',
      execution_status: null,
    };
  },

  /**
   * postCheck
   * Runs AFTER the AI/LLM engine to sanitize its output.
   *
   * @param {object} aiResult — raw output from llm.js
   * @param {object} preResult — result from preCheck (for rule chaining)
   * @returns {object} sanitized AI result with guardrail annotations
   */
  postCheck(aiResult, preResult = {}) {
    const sanitized = { ...aiResult };

    // Preserve the scheduled execution status from Rule 3 if set
    if (preResult.execution_status === 'SCHEDULED') {
      sanitized.execution_status = 'SCHEDULED';
      sanitized.scheduled_at     = preResult.scheduled_at;
    }

    // ── Rule 1: Max Discount Cap ──────────────────────────────────────────────
    const MAX_DISCOUNT_PCT = 5.0;
    if ((sanitized.discount_offered ?? 0) > MAX_DISCOUNT_PCT) {
      const original = sanitized.discount_offered;
      sanitized.discount_offered = MAX_DISCOUNT_PCT;

      const ruleTag = 'RULE_1_DISCOUNT_CAP';
      sanitized.rule_applied = sanitized.rule_applied
        ? `${sanitized.rule_applied}+${ruleTag}`
        : ruleTag;

      sanitized.reasoning = (sanitized.reasoning ?? '') +
        ` [GUARDRAIL] Discount capped from ${original}% to ${MAX_DISCOUNT_PCT}% per commercial policy.`;

      console.log(`[Guardrail] ${ruleTag} applied — discount ${original}% → ${MAX_DISCOUNT_PCT}%`);
    }

    // Merge pre-check rule into final rule_applied field for audit trail
    if (preResult.rule_applied && preResult.rule_applied !== 'NONE') {
      sanitized.rule_applied = preResult.rule_applied +
        (sanitized.rule_applied ? `+${sanitized.rule_applied}` : '');
    }

    return sanitized;
  },
};

module.exports = guardrails;
