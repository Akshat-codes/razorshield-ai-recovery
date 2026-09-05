# Architecture Overview
The Resurrect system is designed for high concurrency, fault tolerance, and absolute financial safety. It is partitioned into two primary layers: a React-based client dashboard and an autonomous Node.js recovery agent.

## System Workflow Pipeline

### 1. The Core Event Engine (`server/server.js`)
This is the brain of the backend. 
- **Ingestion**: It simulates receiving Razorpay webhook events for failed payments.
- **Routing**: It passes these events to the Guardrails layer first, before ever reaching the AI.
- **Concurrency & Transactions**: It updates the local SQLite database (`better-sqlite3`). To handle massive batch simulations, we wrote a specialized synchronous transaction wrapper that ensures database writes never lock up during asynchronous AI network requests.

### 2. The Guardrails System (`server/agent/guardrails.js`)
Autonomous AI in fintech requires strict boundaries. We use a two-step mathematical verification system:
- **Pre-Check (Input Guardrail)**: Analyzes incoming events for irrecoverable errors (e.g., `CARD_STOLEN`, `ACCOUNT_BLOCKED`, or `OPT_OUT`). If flagged, it instantly blocks the AI from attempting recovery, saving API costs and preventing spam.
- **Post-Check (Output Guardrail)**: After the LLM generates a strategy, this layer sanitizes the output. It enforces hard caps on `discount_offered` (e.g., strictly capping it at 5%) and mathematically verifies that the LLM's `chosen_action` maps to a registered, safe handler. 

### 3. The Decision Engine (`server/agent/llm.js`)
This is the reasoning layer that replaces static if/else logic.
- **Primary Agent**: Interfaces with Google's **Gemini 3.6 Flash** API. We pass it the failure context, and it returns a strict JSON payload containing a calculated Risk Score, a Failure Category, and a hyper-personalized, localized Hinglish SMS message.
- **Graceful Degradation (Fallback Agent)**: A deterministic mock rules engine. If the Google Gemini API throws a 429 Rate Limit error or times out, the system instantly hot-swaps to the fallback engine. This ensures the merchant *always* recovers revenue, achieving 100% uptime.

### 4. Database Schema & Auditability
Data integrity and explainability are paramount.
- **Events Table**: Tracks raw payment failures and their state machine status (`PENDING` -> `PROCESSING` -> `RECOVERED` or `FAILED`).
- **Audit Logs Ledger**: An immutable, cryptographic ledger recording every single step of the pipeline. It logs the exact Pre-Check status, the LLM's raw reasoning and risk scores, the exact Hinglish message sent, and the Post-Check discount enforcement. This completely solves the "Black Box" AI problem for enterprises.
