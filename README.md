# Razorshield — AI-Powered Revenue Recovery Engine

An autonomous, AI-driven revenue recovery engine designed for the Razorpay Buildathon (Track 03). It uses Google Gemini to dynamically analyze failed payment events and generate contextual recovery actions (e.g., localized SMS messages, retry links, or escalation notices) based on the failure category.

## Features
- **AI-Powered Diagnostics**: Uses Google Gemini to interpret failed payment webhooks and categorize risks.
- **Rule-Based Fallbacks**: Gracefully degrades to a deterministic rule-based engine if the LLM API limit is reached or the network fails.
- **Safety Guardrails**: Implements strict pre-execution and post-execution guardrails to block excessive discounts and prevent hallucinated actions.
- **Batch Simulation**: Includes an internal simulator to process bulk historic events.
- **Modern Tech Stack**: 
  - Backend: Node.js, Express, better-sqlite3
  - Frontend: React 18, Vite, Tailwind CSS v4, Lucide React

## 🚀 How to Run Locally (Crucial for Judges)

> [!IMPORTANT]
> The application requires **two separate terminal windows** to run simultaneously—one for the Node.js backend and one for the React frontend.

### 🔑 Prerequisites
- Node.js (v18 or higher)
- A valid Google Gemini API Key (get one free at [Google AI Studio](https://aistudio.google.com/))

---

### Step 1: Boot the AI Backend (Terminal 1)
The backend powers the SQLite database, the AI endpoints, and the guardrails.
```bash
# 1. Navigate to the server folder
cd server

# 2. Install dependencies
npm install

# 3. Create the environment file
# Create a new file named `.env` in the /server folder and paste this exact line:
GEMINI_API_KEY=your_api_key_here

# 4. Seed the database with mock failures
npm run seed

# 5. Start the engine
npm start
```
> [!NOTE]
> The server will start on `http://localhost:5000`. Keep this terminal open!

---

### Step 2: Boot the Client Dashboard (Terminal 2)
The frontend powers the sleek Tailwind dashboard.
```bash
# 1. Open a new, separate terminal window
# 2. Navigate to the client folder
cd client

# 3. Install dependencies
npm install

# 4. Start the dashboard
npm run dev
```
> [!TIP]
> Once the frontend boots, it will output a local URL (e.g., `http://localhost:5173`). Open this link in your browser to view the Command Centre!
