# MoneyA — USDC Settlement Layer for Francophone Students (Solana Devnet)

A backend-driven USDC payment system built on **Solana Devnet** for Francophone students in Ghana. It processes mobile-money on-ramp/off-ramp webhooks (Kotani Pay), settles them as USDC transfers on Solana, and flags suspicious transactions with a built-in fraud engine.

> **This is a Devnet MVP.** All tokens are fake. No real money is involved.

---

## Table of Contents

1. [How It Works (Plain English)](#how-it-works-plain-english)
2. [Architecture](#architecture)
3. [What You Need to Install](#what-you-need-to-install)
4. [Project Structure](#project-structure)
5. [Setup (Step by Step)](#setup-step-by-step)
6. [Running the Backend](#running-the-backend)
7. [API Reference](#api-reference)
8. [Integrating from a Frontend or Mobile App](#integrating-from-a-frontend-or-mobile-app)
9. [Observability (Surfpool)](#observability-surfpool)
10. [Common Errors](#common-errors)
11. [Glossary](#glossary)

---

## How It Works (Plain English)

```
Mobile Money (GHS)          MoneyA Backend             Solana Devnet
─────────────────     ──────────────────────     ─────────────────────
Student pays via      Backend receives webhook,   USDC token transfer
Kotani / MoMo    ──►  checks for fraud,       ──► recorded permanently
                      calls Solana program         on blockchain
```

1. A student sends mobile money (e.g. via Kotani Pay).
2. Kotani fires a **webhook** to the MoneyA backend with `amount`, `reference`, and `student_wallet`.
3. The backend validates the payload, runs a **fraud score**, and calls the **Solana program** to transfer USDC from a treasury to the student's wallet.
4. The transaction is recorded both **on-chain** (Solana) and **off-chain** (SQLite).
5. If fraud score > 75, the student's account is flagged on-chain.

**You never need to write Solana code yourself** — the backend handles all blockchain interactions. Your frontend/mobile app only talks to the backend via normal HTTP REST calls.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Frontend / Mobile App  (React, Flutter, etc.)   │
│  ─ Only talks to the Backend via HTTP            │
└──────────────────┬───────────────────────────────┘
                   │  HTTP POST/GET
                   ▼
┌──────────────────────────────────────────────────┐
│  Backend  (Node.js + Express + TypeScript)        │
│  ├── POST /kotani/webhook   (receive payments)    │
│  ├── GET  /health           (status check)        │
│  ├── SQLite DB              (local persistence)   │
│  ├── Fraud Engine           (scoring pipeline)    │
│  └── Solana Client          (signs & sends txns)  │
└──────────────────┬───────────────────────────────┘
                   │  Solana RPC (JSON-RPC over HTTP)
                   ▼
┌──────────────────────────────────────────────────┐
│  Solana Devnet  (blockchain)                      │
│  └── franco_student_pay program (Anchor/Rust)     │
│      ├── Treasury PDA        (holds USDC pool)    │
│      ├── Student PDAs        (per-user accounts)  │
│      └── Transaction Records (idempotent logs)    │
└──────────────────────────────────────────────────┘
```

---

## What You Need to Install

### Required (everyone)

| Tool | Version | What it does | Install |
|------|---------|-------------|---------|
| **Node.js** | 18+ | Runs the backend server | [nodejs.org](https://nodejs.org/) or `nvm install 18` |
| **npm** | 9+ | Installs JS packages | Comes with Node.js |

### Required (only if deploying/modifying the Solana program)

| Tool | Version | What it does | Install |
|------|---------|-------------|---------|
| **Rust** | 1.79+ | Compiles the Solana program | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Solana CLI** | 1.18+ | Manages wallets, deploys programs | [docs.solanalabs.com](https://docs.solanalabs.com/cli/install) |
| **Anchor CLI** | 0.30+ | Builds Anchor programs | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install latest && avm use latest` |

### Optional

| Tool | What it does |
|------|-------------|
| **tsx** | Runs TypeScript files directly (used by scripts) — installed automatically via npm |
| **curl** or **Postman** | Test the API endpoints manually |

### Quick version check

```bash
node -v          # should print v18.x or higher
npm -v           # should print 9.x or higher
# Only if working on the Solana program:
solana --version # should print 1.18.x or higher
anchor --version # should print 0.30.x or higher
```

---

## Project Structure

```
moneyA/
├── README.md                          ← you are here
├── programs/
│   └── franco_student_pay/
│       └── src/lib.rs                 ← Solana program (Rust/Anchor)
├── target/
│   ├── deploy/
│   │   └── franco_student_pay.so     ← compiled program binary
│   └── idl/
│       └── franco_student_pay.json   ← auto-generated IDL (API schema)
├── backend/
│   ├── src/
│   │   ├── server.ts                 ← Express entry point
│   │   ├── routes/kotani.ts          ← webhook endpoint
│   │   ├── solana/client.ts          ← talks to Solana
│   │   ├── fraud/engine.ts           ← fraud scoring
│   │   ├── db/schema.ts              ← SQLite connection
│   │   ├── db/init.ts                ← table creation
│   │   └── observe/surfpool.ts       ← event subscriber
│   ├── .env                          ← backend config (create from .env.example)
│   └── package.json
├── scripts/
│   ├── devnet_usdc_mint.ts           ← creates fake USDC on devnet
│   └── treasury_setup.ts            ← initializes the treasury account
├── Anchor.toml                        ← Anchor project config
├── .env                               ← root config (create from .env.example)
└── package.json                       ← root scripts
```

---

## Setup (Step by Step)

### 1. Clone and install dependencies

```bash
git clone <repo-url> moneyA
cd moneyA

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Create a Solana wallet (if you don't have one)

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com

# Get free devnet SOL (needed to pay transaction fees)
solana airdrop 2
```

### 3. Build and deploy the Solana program

```bash
# Build the program (compiles Rust → BPF binary + generates IDL)
anchor build

# Deploy to devnet
anchor deploy

# Sync the program ID into source files
anchor keys sync
```

After deploy, note the **Program ID** printed (e.g. `BBZjnEN1JFj7caLdBMeXCvBAbntAi3Hd2Z9pxQ78zMJV`).

### 4. Create a devnet USDC mint and fund the treasury

```bash
# Create a fake USDC mint and mint 50,000 tokens to your wallet
npm run scripts:mint
# Output: { "usdcMint": "AbC123...", ... }

# Copy the usdcMint value and set it in your .env files (see step 5)

# Initialize treasury on-chain and fund it with 10,000 USDC
npm run scripts:treasury
```

### 5. Configure environment variables

Copy the example files and fill in real values:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

**Root `.env`:**
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your-program-id-from-step-3>
USDC_MINT=<your-usdc-mint-from-step-4>
BACKEND_KEYPAIR_PATH=~/.config/solana/id.json
```

**`backend/.env`:**
```env
PORT=8080
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your-program-id-from-step-3>
USDC_MINT=<your-usdc-mint-from-step-4>
SQLITE_PATH=./moneya.sqlite
BACKEND_KEYPAIR_PATH=~/.config/solana/id.json
KOTANI_MODE=simulate
```

---

## Running the Backend

```bash
# Development mode (auto-reloads on file changes)
npm run backend:dev

# You should see:
# backend listening on :8080
```

Verify it's running:

```bash
curl http://localhost:8080/health
# → {"ok":true}
```

---

## API Reference

### `GET /health`

Health check.

**Response:**
```json
{ "ok": true }
```

### `POST /kotani/webhook`

Simulates a Kotani Pay on-ramp notification. This is the main endpoint your frontend calls to trigger a USDC settlement.

**Request body:**
```json
{
  "amount": 1000000,
  "reference": "KOT-2024-001",
  "student_wallet": "StudentPublicKeyBase58Here"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `amount` | integer | Amount in USDC base units (1 USDC = 1,000,000). So `1000000` = 1.00 USDC |
| `reference` | string | Unique payment reference (1–64 chars). Prevents duplicate processing |
| `student_wallet` | string | Solana public key of the student (base58 string, 32+ chars) |

**Success response (200):**
```json
{
  "ok": true,
  "kotani_ok": true,
  "solana_signature": "5Uj...xyz",
  "fraud_score": 28
}
```

**Duplicate reference (200, idempotent):**
```json
{
  "ok": true,
  "idempotent": true
}
```

**Validation error (400):**
```json
{
  "ok": false,
  "error": "invalid_payload",
  "details": { ... }
}
```

**Processing error (500):**
```json
{
  "ok": false,
  "error": "processing_failed"
}
```

---

## Integrating from a Frontend or Mobile App

### The key idea

**Your app only talks to the backend over HTTP.** You never need to import Solana libraries, manage wallets, or sign transactions in the frontend. The backend does all of that.

### Example: React / Next.js

```typescript
// utils/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function settleOnramp(params: {
  amount: number;        // USDC base units (1 USDC = 1_000_000)
  reference: string;     // unique payment ID from Kotani
  studentWallet: string; // Solana public key (base58)
}) {
  const res = await fetch(`${API_BASE}/kotani/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: params.amount,
      reference: params.reference,
      student_wallet: params.studentWallet,
    }),
  });
  return res.json();
}
```

```tsx
// components/PaymentButton.tsx
import { settleOnramp } from "../utils/api";

function PaymentButton({ studentWallet }: { studentWallet: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await settleOnramp({
        amount: 5_000_000,  // 5 USDC
        reference: `PAY-${Date.now()}`,
        studentWallet,
      });
      setResult(res);
    } catch (err) {
      console.error("Payment failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePay} disabled={loading}>
      {loading ? "Processing..." : "Send 5 USDC"}
    </button>
  );
}
```

### Example: Flutter / Dart

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> settleOnramp({
  required int amount,
  required String reference,
  required String studentWallet,
}) async {
  final response = await http.post(
    Uri.parse('http://YOUR_BACKEND_IP:8080/kotani/webhook'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'amount': amount,
      'reference': reference,
      'student_wallet': studentWallet,
    }),
  );
  return jsonDecode(response.body);
}
```

### Example: curl (for testing)

```bash
curl -X POST http://localhost:8080/kotani/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000000,
    "reference": "KOT-TEST-001",
    "student_wallet": "YourStudentPublicKeyHere"
  }'
```

### Understanding the response

| Field | What it means |
|-------|--------------|
| `ok` | `true` if the payment was processed successfully |
| `idempotent` | `true` if this exact `reference` was already processed (safe to retry) |
| `solana_signature` | The on-chain transaction ID. View it at `https://explorer.solana.com/tx/<sig>?cluster=devnet` |
| `fraud_score` | 0–100. Scores > 75 trigger on-chain flagging |
| `kotani_ok` | Whether the Kotani API call succeeded (always `true` in simulate mode) |

### USDC amounts

USDC has **6 decimal places**. All amounts in the API are in **base units** (smallest denomination):

| Human-readable | Base units (what you send) |
|---------------|---------------------------|
| 1.00 USDC | `1000000` |
| 0.50 USDC | `500000` |
| 10.00 USDC | `10000000` |
| 100.00 USDC | `100000000` |

### Where does the student's wallet address come from?

On Devnet, you create a wallet with Solana CLI:
```bash
solana-keygen new --outfile student-wallet.json
solana address -k student-wallet.json
# → prints the public key (base58 string) to use as student_wallet
```

In production, students would connect a wallet (Phantom, Solflare) or the app would generate/manage keys.

---

## Observability (Surfpool)

The Surfpool subscriber watches the Solana program for events and outputs structured JSON logs — useful for dashboards, alerting, or debugging.

```bash
# In a separate terminal:
npm run backend:observe
```

Output looks like:
```json
{"type":"OnRampSettled","timestamp":1708790400,"student":"7xK...","amount":2000000,"reference":"KOT-TEST-001","flagged":false}
{"type":"FraudFlagged","timestamp":1708790401,"student":"7xK...","amount":5000000000,"reference":"SUSPICIOUS-001","score":82,"flagged":true}
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `"invalid_payload"` | Missing or wrong types in webhook body | Check `amount` is an integer, `reference` is a string 1–64 chars, `student_wallet` is 32+ chars |
| `"processing_failed"` | Solana transaction failed | Check backend logs. Usually means the student isn't registered on-chain or treasury has no funds |
| `ECONNREFUSED` on port 8080 | Backend isn't running | Run `npm run backend:dev` |
| `IDL not found` | Program hasn't been built | Run `anchor build` in the project root |
| `insufficient funds` | Devnet wallet needs SOL | Run `solana airdrop 2` |
| `Account not found` | Student PDA doesn't exist on-chain | The student must be registered via the `register_student` instruction first |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Solana** | A fast blockchain (like Ethereum but cheaper and faster) |
| **Devnet** | Solana's test network — free to use, no real money |
| **USDC** | A stablecoin pegged 1:1 to USD. On devnet we use a fake version |
| **SPL Token** | Solana's standard for tokens (like ERC-20 on Ethereum) |
| **Anchor** | A framework for writing Solana programs in Rust (like Express for Solana) |
| **PDA** | Program Derived Address — a special account owned by a program, not a person |
| **IDL** | Interface Description Language — a JSON file describing the program's API (like an OpenAPI spec) |
| **Keypair** | A private key + public key pair. The private key signs transactions; the public key is your address |
| **Base58** | An encoding format for Solana addresses (like `BBZjnEN1...`) |
| **Webhook** | An HTTP callback — Kotani calls our server when a payment happens |
| **Idempotent** | Safe to retry — sending the same webhook twice won't cause a double payment |
| **Treasury** | The on-chain USDC pool that funds student payments |
| **Fraud Score** | 0–100 risk score computed by the backend. > 75 = flagged |
| **On-ramp** | Converting fiat (GHS) → crypto (USDC) |
| **Off-ramp** | Converting crypto (USDC) → fiat (GHS) |
| **CPI** | Cross-Program Invocation — one Solana program calling another |

---

## License

MIT
