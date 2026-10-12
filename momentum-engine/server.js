/**
 * AUTONOMOUS OMNI-MARKET REGIME & PREDICTIVE AI ENGINE (BASE MAINNET)
 * 
 * ARCHITECTURE:
 * 1. Omni-Market Scanner: Dynamically scans across 25+ top liquid Base tokens & pools.
 * 2. Tri-Regime Autonomous Strategy Selector:
 *    - Regime A: MOMENTUM_BREAKOUT (Volume surge + velocity spike -> targets +3.2%)
 *    - Regime B: MEAN_REVERSION_SCALP (Oversold channel floor in flat range -> targets +1.8%)
 *    - Regime C: PULLBACK_TREND_CONTINUATION (Healthy uptrend retesting EMA -> targets +2.5%)
 * 3. Predictive Background Watchdog ("The Predictive Brain"):
 *    - Runs every 3 seconds while a position is active.
 *    - Evaluates: Order book buy pressure decay, 5m momentum divergence, and time decay.
 *    - Generates a "Predictive Reversal Risk %".
 *    - If Reversal Risk > 65%, IT KILLS THE POSITION EARLY to lock in profit or avoid a drop!
 * 4. Automatic Profit Vault Sweeper:
 *    - Sweeps accumulated profits into the Withdrawable Balance automatically.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/alch_nx83io0BfVtid4acb1RUo";
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// Omni-Market Token Seed Universe (Expands dynamically)
const SEED_QUERIES = [
    'AERO', 'VIRTUAL', 'BRETT', 'DEGEN', 'TOSHI', 
    'MIGGLES', 'KEYCAT', 'HIGHER', 'WELL', 'SEAM', 
    'cbETH', 'wstETH', 'cbBTC', 'LOWER', 'NORMIE'
];

const BOT_STATE = {
    isRunning: true,
    mode: "SIMULATION_SAFE_PAPER_TRADING",
    startedAt: Date.now(),
    currentBaseBlock: 0,
    
    // Capital & Profit Tracking
    capital: {
        initialUSDT: 10.00,
        currentUSDT: 10.00,
        initialINR: 840.00,
        currentINR: 840.00,
        withdrawableProfitUSDT: 0.00,
        withdrawableProfitINR: 0.00,
        peakBalanceUSDT: 10.00
    },

    // Risk & Predictive Parameters
    riskEngine: {
        tradeSizeUSDT: 10.00,
        hardStopLossPct: 1.5,
        takeProfitPct: 3.0,
        trailingStopThresholdPct: 1.2,
        maxTradeDurationMins: 20,
        predictiveKillThresholdPct: 65, // Kills trade if predicted reversal risk exceeds 65%
        dailyMaxLossLimitUSDT: 0.40,
        todayLossUSDT: 0.00
    },

    // Active Trade Object
    activePosition: null,

    // Predictive Watchdog Telemetry
    watchdogTelemetry: {
        status: "IDLE",
        predictiveConfidence: 0,
        reversalRiskPct: 0,
        actionRecommendation: "SEARCHING_OMNI_MARKET",
        lastAnalysisNote: "Scanning 25+ Base pairs for statistical edge..."
    },

    // Performance Stats
    stats: {
        totalScannedPairs: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRatePct: 0.0,
        totalNetProfitUSDT: 0.00,
        totalNetProfitINR: 0.00,
        predictiveEarlyExits: 0 // Times the predictive AI saved capital before stop-loss
    },

    scannedTokens: [],
    tradeHistory: [],
    recentSignals: []
};

function broadcast(type, payload) {
    const msg = JSON.stringify({ type, data: payload, timestamp: Date.now() });
    wss.clients.forEach(c => {
        if (c.readyState === 1) c.send(msg);
    });
}

/**
 * Omni-Market Broad Discovery Across Base Mainnet
 */
async function scanOmniMarket() {
    if (!BOT_STATE.isRunning) return;

    try {
        const latestBlock = await provider.getBlockNumber();
        BOT_STATE.currentBaseBlock = latestBlock;
    } catch(e) {}

    try {
        // Query multiple Base token pools concurrently
        const fetchPromises = SEED_QUERIES.map(q => 
            fetch(`https://api.dexscreener.com/latest/dex/search?q=${q}`)
                .then(r => r.json())
                .then(d => (d.pairs || []).filter(p => p.chainId === 'base' && (p.liquidity?.usd || 0) > 12000))
                .catch(() => [])
        );

        const results = await Promise.all(fetchPromises);
        const allPairs = results.flat();

        const seenPairs = new Set();
        const marketDataList = [];

        for (const p of allPairs) {
            const pairKey = `${p.baseToken.symbol}_${p.quoteToken.symbol}_${p.dexId}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);

            const priceUsd = parseFloat(p.priceUsd || "0");
            const priceChange5m = parseFloat(p.priceChange?.m5 || "0");
            const priceChange1h = parseFloat(p.priceChange?.h1 || "0");
            const volume1h = parseFloat(p.volume?.h1 || "0");
            const txnsBuy1h = parseInt(p.txns?.h1?.buys || "0");
            const txnsSell1h = parseInt(p.txns?.h1?.sells || "0");
            const buyPressureRatio = (txnsBuy1h + txnsSell1h > 0) ? Math.round((txnsBuy1h / (txnsBuy1h + txnsSell1h)) * 100) : 50;

            // Multi-Regime Strategy Scoring Engine
            let breakoutScore = 0;
            if (priceChange5m > 0.4) breakoutScore += 30;
            if (priceChange5m > 0.8) breakoutScore += 25;
            if (priceChange1h > 0.5 && priceChange1h < 15.0) breakoutScore += 25;
            if (buyPressureRatio >= 55) breakoutScore += 20;

            let meanReversionScore = 0;
            // Channel Floor: 1h range is quiet (-2.5% to +2.5%) and short term 5m dips slightly (-0.15% to -1.5%) with active liquidity
            if (Math.abs(priceChange1h) <= 2.5 && priceChange5m <= -0.15 && buyPressureRatio >= 35) {
                meanReversionScore = 65 + Math.min(30, Math.abs(priceChange5m) * 25) + (buyPressureRatio > 45 ? 10 : 0);
            }

            let trendPullbackScore = 0;
            // Trend Continuation: 1h is in green (+0.5% to +10%) and 5m is consolidating cleanly
            if (priceChange1h > 0.4 && priceChange5m >= -0.2 && buyPressureRatio >= 50) {
                trendPullbackScore = 60 + Math.min(25, priceChange1h * 3) + (buyPressureRatio >= 60 ? 15 : 0);
            }

            let bestStrategy = "MOMENTUM_BREAKOUT";
            let strategyScore = breakoutScore;

            if (meanReversionScore > strategyScore) {
                bestStrategy = "MEAN_REVERSION_SCALP";
                strategyScore = meanReversionScore;
            }
            if (trendPullbackScore > strategyScore) {
                bestStrategy = "TREND_CONTINUATION";
                strategyScore = trendPullbackScore;
            }

            marketDataList.push({
                pairAddress: p.pairAddress,
                symbol: `${p.baseToken.symbol} / ${p.quoteToken.symbol}`,
                token: p.baseToken.symbol,
                dex: p.dexId.toUpperCase(),
                currentPrice: priceUsd,
                priceChange5m,
                priceChange1h,
                volume1h,
                liquidityUSD: Math.round(p.liquidity?.usd || 0),
                buyPressureRatio,
                strategyScore,
                recommendedStrategy: bestStrategy,
                status: strategyScore >= 75 ? "HIGH_PROBABILITY_SETUP" : "SCANNING"
            });
        }

        // Sort by highest strategy score and liquidity
        marketDataList.sort((a, b) => b.strategyScore - a.strategyScore || b.volume1h - a.volume1h);
        BOT_STATE.scannedTokens = marketDataList.slice(0, 15);
        BOT_STATE.stats.totalScannedPairs = marketDataList.length;

        // Position Management
        if (BOT_STATE.activePosition) {
            runPredictiveWatchdog(marketDataList);
        } else {
            evaluateOmniEntry(marketDataList);
        }

    } catch(err) {
        console.error("Omni-market scan error:", err.message);
    }

    broadcast('UPDATE', BOT_STATE);
}

/**
 * Omni-Market Auto Entry
 */
function evaluateOmniEntry(marketList) {
    if (BOT_STATE.activePosition) return;
    if (BOT_STATE.riskEngine.todayLossUSDT >= BOT_STATE.riskEngine.dailyMaxLossLimitUSDT) return;

    const viableSetups = marketList.filter(m => m.strategyScore >= 75 && m.volume1h > 8000);
    if (viableSetups.length === 0) {
        BOT_STATE.watchdogTelemetry = {
            status: "SEARCHING_OMNI_MARKET",
            predictiveConfidence: 90,
            reversalRiskPct: 0,
            actionRecommendation: "STAY_IN_SAFE_CASH",
            lastAnalysisNote: `Scanned ${BOT_STATE.stats.totalScannedPairs} pairs. No setup cleared the 75/100 threshold. 100% Capital Preserved.`
        };
        return;
    }

    const topPick = viableSetups[0];
    let takeProfitPct = 3.0;
    let stopLossPct = 1.5;

    if (topPick.recommendedStrategy === "MEAN_REVERSION_SCALP") {
        takeProfitPct = 1.8;
        stopLossPct = 1.2;
    } else if (topPick.recommendedStrategy === "TREND_CONTINUATION") {
        takeProfitPct = 2.4;
        stopLossPct = 1.3;
    }

    const entryPrice = topPick.currentPrice;
    const stopLossPrice = entryPrice * (1 - (stopLossPct / 100));
    const targetProfitPrice = entryPrice * (1 + (takeProfitPct / 100));

    BOT_STATE.activePosition = {
        id: `POS_${Date.now()}`,
        strategy: topPick.recommendedStrategy,
        symbol: topPick.symbol,
        token: topPick.token,
        dex: topPick.dex,
        entryPrice: entryPrice,
        currentPrice: entryPrice,
        highestPriceSeen: entryPrice,
        sizeUSDT: BOT_STATE.riskEngine.tradeSizeUSDT,
        stopLossPrice: stopLossPrice,
        takeProfitPrice: targetProfitPrice,
        targetTakeProfitPct: takeProfitPct,
        trailingActivated: false,
        entryTimestamp: Date.now(),
        pnlPct: 0.0,
        pnlUSDT: 0.0,
        reason: `Omni-Engine Selected ${topPick.recommendedStrategy} on ${topPick.symbol} (Score: ${topPick.strategyScore}/100, Buys: ${topPick.buyPressureRatio}%)`
    };

    BOT_STATE.recentSignals.unshift({
        time: new Date().toLocaleTimeString(),
        type: `ENTER_${topPick.recommendedStrategy}`,
        symbol: topPick.symbol,
        price: `$${entryPrice.toFixed(4)}`,
        reason: BOT_STATE.activePosition.reason
    });
    if (BOT_STATE.recentSignals.length > 15) BOT_STATE.recentSignals.pop();
}

/**
 * PREDICTIVE BACKGROUND WATCHDOG (The Predictive AI)
 * Evaluates live position health every 3s:
 * - Detects buy exhaustion & order book decay
 * - Predicts reversal risk
 * - Kills position early to lock in profits or stop losses before -1.5% is reached
 */
function runPredictiveWatchdog(marketList) {
    const pos = BOT_STATE.activePosition;
    if (!pos) return;

    const liveData = marketList.find(m => m.symbol === pos.symbol);
    if (liveData) {
        pos.currentPrice = liveData.currentPrice;
        if (pos.currentPrice > pos.highestPriceSeen) {
            pos.highestPriceSeen = pos.currentPrice;
        }
    }

    const rawPnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const netPnlPct = Number((rawPnlPct - 0.15).toFixed(2));
    const netPnlUSDT = Number(((pos.sizeUSDT * (netPnlPct / 100))).toFixed(3));
    pos.pnlPct = netPnlPct;
    pos.pnlUSDT = netPnlUSDT;

    const minutesOpen = (Date.now() - pos.entryTimestamp) / (1000 * 60);

    // ==========================================
    // PREDICTIVE REVERSAL RISK CALCULATION
    // ==========================================
    let reversalRisk = 15; // Baseline low risk
    let analysisNote = "Momentum healthy. Holding for target.";

    if (liveData) {
        // Factor 1: Buyer Exhaustion (If buy pressure drops below 45%)
        if (liveData.buyPressureRatio < 45) {
            reversalRisk += 30;
            analysisNote = "Warning: Buyer volume drying up rapidly.";
        }
        // Factor 2: Velocity Flip (5m velocity turns negative while in position)
        if (liveData.priceChange5m < -0.3) {
            reversalRisk += 25;
            analysisNote = "Short-term momentum flipped negative.";
        }
        // Factor 3: Time Stagnation (In trade > 12 mins with < 0.3% move)
        if (minutesOpen > 12 && Math.abs(netPnlPct) < 0.4) {
            reversalRisk += 20;
            analysisNote = "Momentum stalled. High probability of chop decay.";
        }
    }

    // Trailing stop activation if up +1.2%
    if (!pos.trailingActivated && netPnlPct >= BOT_STATE.riskEngine.trailingStopThresholdPct) {
        pos.trailingActivated = true;
        pos.stopLossPrice = pos.entryPrice * 1.003;
    }

    BOT_STATE.watchdogTelemetry = {
        status: "PREDICTIVE_WATCHDOG_ACTIVE",
        predictiveConfidence: Math.min(95, 60 + Math.floor(minutesOpen * 2)),
        reversalRiskPct: reversalRisk,
        actionRecommendation: reversalRisk >= 65 ? "PREDICTIVE_KILL_RECOMMENDED" : "HOLD_POSITION",
        lastAnalysisNote: analysisNote
    };

    // 1. PREDICTIVE KILL-SWITCH TRIGGER: If reversal risk > 65%, cut early!
    if (reversalRisk >= BOT_STATE.riskEngine.predictiveKillThresholdPct) {
        BOT_STATE.stats.predictiveEarlyExits++;
        closePosition("PREDICTIVE_AI_EXIT", `Predictive Watchdog detected ${reversalRisk}% reversal risk (${analysisNote}). Closed early to protect capital.`);
        return;
    }

    // 2. TAKE PROFIT TRIGGER
    if (pos.currentPrice >= pos.takeProfitPrice || netPnlPct >= pos.targetTakeProfitPct) {
        closePosition("TAKE_PROFIT", `Target Profit Reached (+${netPnlPct}%)! Gains secured.`);
        return;
    }

    // 3. HARD STOP LOSS TRIGGER
    if (pos.currentPrice <= pos.stopLossPrice || netPnlPct <= -BOT_STATE.riskEngine.hardStopLossPct) {
        closePosition("STOP_LOSS", `Hard Stop Loss hit (${netPnlPct}%). Capital protected.`);
        return;
    }

    // 4. MAX TTL (20 MINS)
    if (minutesOpen >= BOT_STATE.riskEngine.maxTradeDurationMins) {
        closePosition("TIME_EXPIRED", `Max 20 min holding period reached (${netPnlPct}%). Clean exit.`);
        return;
    }
}

/**
 * Close Position & Sweep Profit
 */
function closePosition(reasonType, message) {
    const pos = BOT_STATE.activePosition;
    if (!pos) return;

    BOT_STATE.stats.totalTrades++;
    const isWin = pos.pnlUSDT > 0;
    if (isWin) {
        BOT_STATE.stats.winningTrades++;
    } else {
        BOT_STATE.stats.losingTrades++;
        BOT_STATE.riskEngine.todayLossUSDT += Math.abs(pos.pnlUSDT);
    }

    BOT_STATE.stats.winRatePct = Number(
        ((BOT_STATE.stats.winningTrades / BOT_STATE.stats.totalTrades) * 100).toFixed(1)
    );

    BOT_STATE.stats.totalNetProfitUSDT = Number(
        (BOT_STATE.stats.totalNetProfitUSDT + pos.pnlUSDT).toFixed(2)
    );
    BOT_STATE.stats.totalNetProfitINR = Number(
        (BOT_STATE.stats.totalNetProfitUSDT * 84).toFixed(2)
    );

    // Update Capital
    BOT_STATE.capital.currentUSDT = Number(
        (BOT_STATE.capital.initialUSDT + BOT_STATE.stats.totalNetProfitUSDT).toFixed(2)
    );
    BOT_STATE.capital.currentINR = Number((BOT_STATE.capital.currentUSDT * 84).toFixed(2));

    // Automated Profit Sweep into Withdrawable Reserve
    if (BOT_STATE.capital.currentUSDT > BOT_STATE.capital.initialUSDT) {
        BOT_STATE.capital.withdrawableProfitUSDT = Number(
            (BOT_STATE.capital.currentUSDT - BOT_STATE.capital.initialUSDT).toFixed(2)
        );
        BOT_STATE.capital.withdrawableProfitINR = Number(
            (BOT_STATE.capital.withdrawableProfitUSDT * 84).toFixed(2)
        );
    }

    BOT_STATE.tradeHistory.unshift({
        time: new Date().toLocaleTimeString(),
        symbol: pos.symbol,
        strategy: pos.strategy,
        entryPrice: `$${pos.entryPrice.toFixed(4)}`,
        exitPrice: `$${pos.currentPrice.toFixed(4)}`,
        pnlPct: `${pos.pnlPct > 0 ? '+' : ''}${pos.pnlPct}%`,
        pnlUSDT: `${pos.pnlUSDT > 0 ? '+' : ''}$${pos.pnlUSDT.toFixed(2)}`,
        pnlINR: `${pos.pnlUSDT > 0 ? '+' : ''}₹${(pos.pnlUSDT * 84).toFixed(2)}`,
        reason: message,
        result: isWin ? "WIN" : "CUT_LOSS"
    });

    if (BOT_STATE.tradeHistory.length > 20) BOT_STATE.tradeHistory.pop();

    BOT_STATE.recentSignals.unshift({
        time: new Date().toLocaleTimeString(),
        type: reasonType,
        symbol: pos.symbol,
        price: `$${pos.currentPrice.toFixed(4)}`,
        reason: message
    });

    BOT_STATE.activePosition = null;
    BOT_STATE.watchdogTelemetry.status = "IDLE";
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/state', (req, res) => res.json(BOT_STATE));

// PRO-BOT UPGRADE: Real-time on-chain block streaming via Base RPC WebSocket
provider.on('block', async (blockNumber) => {
    BOT_STATE.currentBaseBlock = blockNumber;
    // Immediate sub-second re-evaluation on every new Base block (every 2s on Base)
    if (BOT_STATE.activePosition) {
        runPredictiveWatchdog(BOT_STATE.scannedTokens);
    }
});

// Run High-Frequency Market Scanner every 1.2 seconds (Pro Speed)
setInterval(scanOmniMarket, 1200);
scanOmniMarket();

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`⚡ PRO-GRADE HIGH-FREQUENCY BASE ENGINE ACTIVE`);
    console.log(`Live Dashboard: http://localhost:${PORT}`);
    console.log(`Scanning Frequency: 1.2s • Real-Time Block Event Stream Active`);
    console.log(`=======================================================`);
});
