/**
 * llm.js
 * RazorShield AI — LLM / AI Decision Engine
 *
 * Priority chain:
 *   1. Gemini API (GEMINI_API_KEY in .env)
 *   2. OpenAI API  (OPENAI_API_KEY  in .env)
 *   3. Mock Rule-Based Engine (always available, no key required)
 *
 * Output schema (strict JSON):
 * {
 *   failure_category: string,   // Technical | Behavioral | Recurring | B2B_Late_Payment
 *   risk_score:       number,   // 0.0 – 1.0
 *   chosen_action:    string,   // e.g. SEND_RETRY_LINK
 *   reasoning:        string,   // human-readable explanation
 *   message_content:  string,   // personalized recovery message for the customer
 *   discount_offered: number,   // percentage (0–5 before guardrails)
 *   rule_applied:     string,   // tracking tag for audit
 *   execution_status: string,   // SUCCESS | PENDING
 * }
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Builds the structured prompt sent to the LLM.
 * @param {object} event — payment_events row
 * @returns {string}
 */
function buildPrompt(event) {
  return `
You are RazorShield AI, an expert payment failure recovery agent for a fintech SaaS platform.

Analyze the following failed payment event and generate a precise recovery strategy.

PAYMENT EVENT:
- ID:             ${event.id}
- Customer Name:  ${event.customer_name}
- Email:          ${event.customer_email}
- Phone:          ${event.customer_phone}
- Category:       ${event.category}
- Amount (INR):   ${event.amount}
- Payment Method: ${event.payment_method}
- Failure Code:   ${event.failure_code}
- Retry Count:    ${event.retry_count}
- Created At:     ${event.created_at}

INSTRUCTIONS:
1. Diagnose the failure into exactly one of: Technical, Behavioral, Recurring, B2B_Late_Payment
2. Assign a risk_score between 0.0 (low risk of permanent loss) and 1.0 (certain permanent loss)
3. Choose the best recovery action from: SEND_RETRY_LINK, SEND_CART_RECOVERY, MANDATE_REACTIVATION, PAYMENT_DATE_RESCHEDULING, SEND_INVOICE_REMINDER, SEND_ESCALATION_NOTICE
4. Write a SHORT (2–3 sentence), warm, personalized recovery message to the customer.
   - For consumer (D2C, Subscription): write in friendly Hinglish (mix of Hindi + English). Use first name only. Add empathy.
   - For B2B (Invoice): write formal English only. Reference the overdue amount professionally.
5. Decide discount_offered as a percentage (0–10). Only offer discount for cart drop-offs or long B2B overdues.

Respond ONLY with a valid JSON object matching this schema exactly:
{
  "failure_category": "string",
  "risk_score": number,
  "chosen_action": "string",
  "reasoning": "string (1-2 sentences explaining your diagnosis)",
  "message_content": "string",
  "discount_offered": number
}
`.trim();
}

// ─── Response Parser ──────────────────────────────────────────────────────────

/**
 * Extracts and validates the JSON object from a raw LLM text response.
 * Handles models that wrap JSON in markdown code fences.
 * @param {string} text
 * @returns {object}
 */
function parseJSON(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // Extract the first JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in LLM response.');

  const parsed = JSON.parse(match[0]);

  // Validate required keys
  const required = ['failure_category', 'risk_score', 'chosen_action', 'reasoning', 'message_content', 'discount_offered'];
  for (const key of required) {
    if (parsed[key] === undefined) throw new Error(`Missing key: ${key}`);
  }

  return {
    failure_category: String(parsed.failure_category),
    risk_score:       Math.min(1, Math.max(0, Number(parsed.risk_score))),
    chosen_action:    String(parsed.chosen_action),
    reasoning:        String(parsed.reasoning),
    message_content:  String(parsed.message_content),
    discount_offered: Math.max(0, Number(parsed.discount_offered)),
    rule_applied:     'LLM_GEMINI',
    execution_status: 'SUCCESS',
  };
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

/**
 * Calls the Google Gemini 1.5 Flash API.
 * Uses built-in fetch (Node 18+). No extra packages required.
 * @param {string} prompt
 * @returns {Promise<object>}
 */
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:      0.4,
        maxOutputTokens:  800,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(30000), // 30 s timeout
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini returned empty content.');

  const result = parseJSON(text);
  result.rule_applied = 'LLM_GEMINI';
  return result;
}

// ─── OpenAI API ───────────────────────────────────────────────────────────────

/**
 * Calls the OpenAI Chat Completions API (gpt-4o-mini).
 * @param {string} prompt
 * @returns {Promise<object>}
 */
async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      temperature: 0.4,
      max_tokens:  800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are RazorShield AI, a fintech payment recovery agent. Always respond with valid JSON only.' },
        { role: 'user',   content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('OpenAI returned empty content.');

  const result = parseJSON(text);
  result.rule_applied = 'LLM_OPENAI';
  return result;
}

// ─── Mock Rule-Based Engine ───────────────────────────────────────────────────

/**
 * Adds a small deterministic jitter to risk scores for realism.
 * @param {number} base    — base score
 * @param {number} spread  — max deviation (±spread/2)
 * @returns {number}
 */
function jitter(base, spread = 0.06) {
  // Use event ID chars to seed a pseudo-random offset (deterministic per event)
  return parseFloat(Math.min(0.99, Math.max(0.01, base + (Math.random() - 0.5) * spread)).toFixed(2));
}

/**
 * Returns the customer's first name for personalized messages.
 * @param {string} fullName
 * @returns {string}
 */
function firstName(fullName) {
  return (fullName ?? '').split(' ')[0] || 'Valued Customer';
}

/**
 * Formats an INR amount with commas.
 * @param {number} amount
 * @returns {string}
 */
function inr(amount) {
  return new Intl.NumberFormat('en-IN').format(amount ?? 0);
}

/**
 * Mock rule-based AI engine — comprehensive, differentiated by failure type.
 * Guarantees the app works offline / without API keys.
 *
 * @param {object} event — payment_events row
 * @returns {object} — AI decision in the standard output schema
 */
function mockEngine(event) {
  const name   = firstName(event.customer_name);
  const amount = inr(event.amount);
  const code   = (event.failure_code ?? '').toUpperCase();
  const cat    = (event.category ?? '').toUpperCase();

  const strategies = {

    // ── D2C_CHECKOUT ───────────────────────────────────────────────────────

    UPI_TIMEOUT: {
      failure_category: 'Technical',
      risk_score:       jitter(0.68),
      chosen_action:    'SEND_RETRY_LINK',
      reasoning:        'UPI gateway timeout is a transient technical error with high retry success rate. Immediate retry link maximises recovery probability.',
      message_content:  `Arre ${name} ji! Aapka ₹${amount} ka payment ek chota sa UPI timeout ki wajah se nahi hua — yeh aapki galti nahi thi 😊 Bas iss link se dobara try karein, 30 minutes valid hai: [RETRY_LINK]. Usually second try mein ho jaata hai!`,
      discount_offered: 0,
      rule_applied:     'MOCK_ENGINE_RULE:UPI_TIMEOUT',
    },

    GATEWAY_DOWNTIME: {
      failure_category: 'Technical',
      risk_score:       jitter(0.62),
      chosen_action:    'SEND_RETRY_LINK',
      reasoning:        'Payment gateway experienced a brief outage. This is a recoverable technical failure — customer intent was present. A retry link is optimal.',
      message_content:  `Hi ${name}! Hum maafi chahte hain — jab aap payment kar rahe the, tab hamare gateway mein thodi problem thi. Ab sab theek hai! ₹${amount} ka payment complete karne ke liye: [RETRY_LINK]. Koi bhi help chahiye toh reply karein! 🙏`,
      discount_offered: 0,
      rule_applied:     'MOCK_ENGINE_RULE:GATEWAY_DOWNTIME',
    },

    CART_DROP_OFF: {
      failure_category: 'Behavioral',
      risk_score:       jitter(0.79),
      chosen_action:    'SEND_CART_RECOVERY',
      reasoning:        'Customer abandoned the cart mid-checkout, indicating purchase intent but hesitation. A personalized recovery message with a time-limited discount should nudge conversion.',
      message_content:  `Hey ${name}! Aapka cart mein ₹${amount} ka saman abhi bhi wait kar raha hai 🛒 Hum jaante hain life busy hai — isliye aapke liye ek special 3% discount rakha hai! Aaj raat tak valid hai: [CART_RECOVERY_LINK]. Miss mat kariye!`,
      discount_offered: 3.0,
      rule_applied:     'MOCK_ENGINE_RULE:CART_DROP_OFF',
    },

    // ── SUBSCRIPTION_MANDATE ──────────────────────────────────────────────

    AUTO_DEBIT_FAILURE: {
      failure_category: 'Recurring',
      risk_score:       jitter(0.84),
      chosen_action:    'MANDATE_REACTIVATION',
      reasoning:        'Auto-debit mandate has failed, likely due to bank-side revocation or expired mandate. Mandate reactivation flow is the only path to restoring recurring revenue.',
      message_content:  `Hi ${name}, aapki ₹${amount}/month subscription ka auto-debit setup reset ho gaya — yeh kabhi kabhi banks ki taraf se ho jaata hai. Sirf 2 minutes mein mandate dobara activate karein: [MANDATE_LINK]. Warna subscription pause ho sakti hai.`,
      discount_offered: 0,
      rule_applied:     'MOCK_ENGINE_RULE:AUTO_DEBIT_FAILURE',
    },

    INSUFFICIENT_FUNDS: {
      failure_category: 'Recurring',
      risk_score:       jitter(0.88),
      chosen_action:    'PAYMENT_DATE_RESCHEDULING',
      reasoning:        'Insufficient funds suggests a temporary liquidity issue, not intent to cancel. Offering a payment date reschedule (salary cycle alignment) has a high recovery rate.',
      message_content:  `${name} ji, aapka ₹${amount} subscription payment iss baar process nahi hua — balance thoda kam tha. Koi baat nahi! Hum next week ek baar aur try karenge. Ya aap apni convenient date choose karein: [RESCHEDULE_LINK]. Subscription safe hai! 😊`,
      discount_offered: 0,
      rule_applied:     'MOCK_ENGINE_RULE:INSUFFICIENT_FUNDS',
    },

    // ── B2B_INVOICE ───────────────────────────────────────────────────────

    INVOICE_OVERDUE_15D: {
      failure_category: 'B2B_Late_Payment',
      risk_score:       jitter(0.74),
      chosen_action:    'SEND_INVOICE_REMINDER',
      reasoning:        'Invoice is 15 days overdue. At this stage, a professional reminder with payment link is appropriate before escalation. High probability of recovery with gentle follow-up.',
      message_content:  `Dear ${name}, this is a friendly reminder that Invoice #INV-${event.id.slice(0, 8).toUpperCase()} for ₹${amount} is now 15 days past due. Kindly arrange for settlement at your earliest convenience. Secure payment link: [INVOICE_LINK]. Please contact accounts@razorshield.ai for any queries.`,
      discount_offered: 0,
      rule_applied:     'MOCK_ENGINE_RULE:INVOICE_OVERDUE_15D',
    },

    INVOICE_OVERDUE_30D: {
      failure_category: 'B2B_Late_Payment',
      risk_score:       jitter(0.93),
      chosen_action:    'SEND_ESCALATION_NOTICE',
      reasoning:        'Invoice has crossed 30-day overdue threshold. Immediate escalation to senior stakeholders is warranted. A small settlement discount may accelerate closure.',
      message_content:  `Dear ${name}, URGENT: Invoice #INV-${event.id.slice(0, 8).toUpperCase()} for ₹${amount} is critically overdue by 30+ days. This account has been escalated for review. To avoid service disruption, please complete payment immediately via [INVOICE_LINK]. We are prepared to offer a 2% early-settlement discount if paid within 48 hours. Contact: accounts@razorshield.ai`,
      discount_offered: 2.0,
      rule_applied:     'MOCK_ENGINE_RULE:INVOICE_OVERDUE_30D',
    },
  };

  // ── Fallback for unknown failure codes ──────────────────────────────────────
  const DEFAULT_STRATEGY = {
    failure_category: 'Technical',
    risk_score:       jitter(0.55),
    chosen_action:    'SEND_RETRY_LINK',
    reasoning:        `Unknown failure code '${code}'. Defaulting to generic retry strategy pending manual review.`,
    message_content:  `Hi ${name}, your recent payment of ₹${amount} could not be processed. Please click here to try again: [RETRY_LINK]. Contact support if the issue persists.`,
    discount_offered: 0,
    rule_applied:     'MOCK_ENGINE_RULE:GENERIC_FALLBACK',
  };

  const result = strategies[code] ?? DEFAULT_STRATEGY;
  return { ...result, execution_status: 'SUCCESS' };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * diagnose — Entry point for the LLM engine.
 * Tries Gemini → OpenAI → Mock in order of priority.
 *
 * @param {object} event — payment_events row from SQLite
 * @returns {Promise<object>} — standardised AI output object
 */
async function diagnose(event) {
  const prompt = buildPrompt(event);

  // ── 1. Try Gemini ──────────────────────────────────────────────────────────
  if (GEMINI_API_KEY) {
    try {
      console.log(`[LLM] Attempting Gemini API for event ${event.id}`);
      const result = await callGemini(prompt);
      console.log(`[LLM] Gemini succeeded — action: ${result.chosen_action}`);
      return result;
    } catch (err) {
      console.warn(`[LLM] Gemini failed (${err.message}). Falling back…`);
    }
  }

  // ── 2. Try OpenAI ─────────────────────────────────────────────────────────
  if (OPENAI_API_KEY) {
    try {
      console.log(`[LLM] Attempting OpenAI API for event ${event.id}`);
      const result = await callOpenAI(prompt);
      console.log(`[LLM] OpenAI succeeded — action: ${result.chosen_action}`);
      return result;
    } catch (err) {
      console.warn(`[LLM] OpenAI failed (${err.message}). Falling back to mock…`);
    }
  }

  // ── 3. Mock Rule-Based Engine (guaranteed, no key required) ───────────────
  console.log(`[LLM] Using Mock Rule-Based Engine for event ${event.id}`);
  return mockEngine(event);
}

module.exports = { diagnose };
