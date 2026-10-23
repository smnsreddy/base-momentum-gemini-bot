# ⚡ Base Momentum & Regime Engine (Gemini 3.5 AI Powered)

An institutional-grade, high-velocity momentum and regime detection trading engine built specifically for **Base Layer 2**. Features continuous DEX order-flow scanning, real-world AMM slippage deduction, and real-time quantitative validation powered by **Google Gemini 3.5 Flash-Lite**.

![Base L2](https://img.shields.io/badge/Base_L2-Active-0052FF?style=for-the-badge&logo=coinbase)
![Gemini AI](https://img.shields.io/badge/Gemini_3.5_AI-Audited-8E75C4?style=for-the-badge&logo=google)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🌟 Key Architecture & Capabilities

- 🧠 **Google Gemini 3.5 Flash-Lite Brain**: Evaluates candidate setups with quantitative multi-timeframe tape analysis (5m tape buy pressure, 1h volume, 6h/24h macro trends, AMM pool liquidity depth). Rejects overextended wicks, illiquid rug traps, and false breakouts before execution.
- 🛡️ **Rapid Break-Even Capital Shield**: Automatically shifts Stop Loss to Entry + All Network Fees as soon as net profit crosses `+0.18%`, ensuring green gains are protected against sudden reversals.
- 🏦 **Multi-Tranche Profit Harvester**: Banks gains in stepped tranches (`+0.35%`, `+0.80%`, and dynamic target) directly into the vault.
- ⚡ **Base L2 Execution Engine**: Direct DEX router integration with Aerodrome and Uniswap v3 on Base Mainnet with sub-block priority fee tips.
- 🔬 **Real-World AMM Slippage Modeling**: Paper trading simulates real pool slippage, DEX pool swap fees (0.05% Bluechip, 0.30% Microcap), and Base L2 gas costs so paper metrics reflect live on-chain reality.

---

## 📁 Repository Structure

```
├── momentum-engine/          # High-frequency trading server & live web dashboard
│   ├── server.js             # Dual-mode engine, Gemini AI quantitative auditor & DEX routers
│   ├── public/index.html     # Real-time WebSocket terminal, orderbook radar & AI watchdog
│   ├── TRADING_RESULTS.md    # Automated live trade performance ledger
│   └── render.yaml           # 1-click 24/7 cloud deployment configuration
├── arb-test/                 # Foundry smart contracts for on-chain Base MEV & routing
└── TRADING_RESULTS.md        # Synced live trade ledger
```

---

## 🛠️ Quick Start (Local)

### 1. Clone the repository
```bash
git clone https://github.com/smnsreddy/base-momentum-gemini-bot.git
cd base-momentum-gemini-bot/momentum-engine
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file inside `momentum-engine`:
```bash
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
BASE_RPC_URL=https://mainnet.base.org
```

### 4. Launch the Engine
```bash
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser to view the real-time live trading dashboard and Gemini AI telemetry.

---

## ☁️ 24/7 Cloud Deployment (100% Free on Render / Koyeb)

### Deploying to Render.com:
1. Go to [Render.com](https://dashboard.render.com/) and create a free account.
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository: `smnsreddy/base-momentum-gemini-bot`.
4. Render will auto-detect the Node.js environment:
   - **Root Directory**: `momentum-engine`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: `your_gemini_api_key`
   - `BASE_RPC_URL`: `https://mainnet.base.org`
6. Click **Deploy Web Service**. Your trading bot will run 24/7 and give you a public URL (e.g. `https://your-bot.onrender.com`) to monitor live trades from anywhere!

---

## 📊 Live Trade Ledger

Live trading results, win rates, and harvested profits are tracked in [`TRADING_RESULTS.md`](TRADING_RESULTS.md).

---

## 📜 License
MIT License
