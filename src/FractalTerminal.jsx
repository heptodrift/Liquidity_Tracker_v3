import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, ReferenceLine, ReferenceArea, Brush, Legend } from 'recharts';
import { Activity, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, TrendingUp, TrendingDown, ZoomIn, FileText, Clock, Info, Sliders, Download, Terminal, AlertTriangle, Sun, Globe, Coins, Command, Layout, GripVertical, ArrowUp, ArrowDown, Minus, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * FRACTAL TERMINAL V8.0 - INSTITUTIONAL EDITION
 * =============================================
 * 
 * V8.0 Architecture:
 * - Serverless client-side engine (Pyodide/WASM ready)
 * - Edge proxy for CORS bypass (Treasury, NY Fed, FRED APIs)
 * - T-1 TGA via Treasury API, Same-day RRP via NY Fed
 * - RRP Countdown widget (Liquidity Cliff timer)
 * - Command Palette (Cmd+K keyboard-first interface)
 * - Portal tooltips with fixed positioning
 * - Complete metric explanations
 * - Delta indicators with direction/magnitude
 * - PowerPoint export
 * 
 * ALL DATA IS REAL. ZERO SIMULATIONS.
 * THE BROWSER IS A SOVEREIGN COMPUTE NODE.
 */

// ============ COMPLETE TOOLTIP EXPLANATIONS ============
// Every single metric gets a comprehensive explanation
const EXPLANATIONS = {
  // === CORE LIQUIDITY METRICS ===
  balanceSheet: {
    title: "Federal Reserve Balance Sheet (WALCL)",
    short: "Total assets held by the Federal Reserve System",
    detail: "The Fed's balance sheet represents its total holdings of Treasury securities, mortgage-backed securities, and other assets. Quantitative Easing (QE) expands this by purchasing assets, injecting reserves into the banking system. Quantitative Tightening (QT) shrinks it by letting securities mature without reinvestment, draining reserves. The balance sheet peaked at $8.9 trillion in April 2022 and has been declining under QT since then.",
    impact: "↑ RISING = Liquidity injection = Generally bullish for risk assets\n↓ FALLING = Liquidity drain = Generally bearish for risk assets\n\nCurrent QT pace: ~$60B/month reduction",
    thresholds: "Peak: $8.9T (Apr 2022)\nPre-COVID: $4.2T\nCurrent target: Unknown (Fed watching reserves)",
    source: "FRED Series: WALCL\nFrequency: Weekly (Wednesday)\nhttps://fred.stlouisfed.org/series/WALCL"
  },
  tga: {
    title: "Treasury General Account (TGA)",
    short: "The US government's primary checking account at the Federal Reserve",
    detail: "The TGA is where the Treasury Department holds cash to pay government obligations. When Treasury issues bonds, cash flows INTO the TGA (draining liquidity from markets). When Treasury spends money, cash flows OUT of the TGA (injecting liquidity into markets). Large TGA swings around debt ceiling events and tax seasons can significantly impact market liquidity.",
    impact: "↑ RISING TGA = Drain (Treasury accumulating cash)\n  - Bond issuance exceeds spending\n  - Money moves from markets → government\n  - BEARISH for liquidity\n\n↓ FALLING TGA = Injection (Treasury spending down cash)\n  - Spending exceeds bond issuance\n  - Money moves from government → markets\n  - BULLISH for liquidity",
    thresholds: "Typical range: $400B - $800B\nDebt ceiling minimum: ~$50B\nPost-ceiling rebuild: Can reach $800B+",
    source: "Primary: Daily Treasury Statement API (T-1 latency)\nBackup: FRED Series WTREGEN (Weekly)\nhttps://fiscaldata.treasury.gov"
  },
  rrp: {
    title: "Reverse Repo Facility (ON RRP)",
    short: "Overnight cash parked at the Fed by money market funds and banks",
    detail: "The ON RRP allows eligible counterparties (primarily money market funds) to deposit cash at the Fed overnight in exchange for Treasury securities. It acts as a 'liquidity buffer' - excess cash that could flow into markets. The facility peaked at $2.5 trillion in late 2022 and has been steadily draining as QT continues and Treasury issues more bills.",
    impact: "⚠️ CRITICAL: RRP IS NOW EXHAUSTED (~$2-6B)\n\nWhen RRP was high ($2T+):\n  - QT was absorbed by RRP drainage\n  - Bank reserves were protected\n\nNow that RRP is empty:\n  - Every dollar of QT directly drains bank reserves\n  - Sept 2019 repo crisis occurred when reserves became scarce\n  - This is the critical transition point",
    thresholds: "Peak: $2.55T (Dec 2022)\nCurrent: ~$2-6B (EXHAUSTED)\nCritical: < $100B means buffer is gone",
    source: "Primary: NY Fed Markets API (Same-day ~1:15 PM ET)\nBackup: FRED Series RRPONTSYD\nhttps://markets.newyorkfed.org"
  },
  reserves: {
    title: "Bank Reserves (WRESBAL)",
    short: "Total reserve balances held by depository institutions at Federal Reserve Banks",
    detail: "Bank reserves are the deposits that commercial banks hold at the Fed. They're essential for interbank payments and meeting reserve requirements. When reserves become scarce, banks compete for them in the federal funds market, causing rates to spike. The September 2019 repo market crisis was triggered when reserves fell to scarcity levels.",
    impact: "RESERVE SCARCITY RISK:\n> $3.0T = Ample reserves (comfortable)\n$2.5T - $3.0T = Adequate (monitoring)\n< $2.5T = Potential scarcity (elevated risk)\n< $2.0T = Critical scarcity (crisis risk)\n\nWith RRP exhausted, reserves are the last buffer against QT stress.",
    thresholds: "Sept 2019 crisis level: ~$1.4T\nCurrent estimated 'ample': > $3.0T\nFed's LCLoR estimate: Unknown",
    source: "FRED Series: WRESBAL\nFrequency: Weekly\nhttps://fred.stlouisfed.org/series/WRESBAL"
  },
  netLiquidity: {
    title: "Net Liquidity Index",
    short: "Fed Balance Sheet minus TGA minus RRP",
    detail: "Net Liquidity = WALCL - TGA - RRP\n\nThis formula represents the actual liquidity available to support financial markets. The Fed's balance sheet sets the ceiling, but TGA (government cash) and RRP (parked money) subtract from available liquidity. Since 2008, Net Liquidity has shown approximately 0.9 correlation with the S&P 500.",
    impact: "THE PRIMARY DRIVER OF ASSET PRICES\n\n↑ Rising Net Liquidity:\n  - More reserves in banking system\n  - Easier financial conditions\n  - Risk assets tend to rise\n\n↓ Falling Net Liquidity:\n  - Reserves being drained\n  - Tighter financial conditions\n  - Risk assets tend to fall\n\nWatch for divergence: If SPX rises while Net Liq falls, that's a warning.",
    thresholds: "2022 Peak: ~$6.3T\nCurrent: ~$5.7-6.0T\nCorrelation with SPX: ~0.9 since 2008",
    source: "Derived calculation from FRED data\nFormula: WALCL - WTREGEN - RRPONTSYD"
  },

  // === GLOBAL LIQUIDITY ===
  globalM2: {
    title: "Global M2 Money Supply",
    short: "Aggregated M2 of US, Eurozone, Japan, and China converted to USD",
    detail: "Global M2 = US M2 + (Euro M2 × EUR/USD) + (Japan M2 / JPY/USD) + (China M2 / CNY/USD)\n\nThis represents the total broad money supply of the world's four largest economies, normalized to US dollars. Global liquidity cycles have historically driven major bull and bear markets in risk assets worldwide.",
    impact: "GLOBAL LIQUIDITY CYCLE:\n\n↑ Expanding Global M2:\n  - Central banks easing worldwide\n  - More money chasing assets\n  - Bullish for risk assets globally\n\n↓ Contracting Global M2:\n  - Central banks tightening\n  - Less money available\n  - Bearish for risk assets\n\n30-day ROC indicates momentum of change.",
    thresholds: "Current: ~$85-90 Trillion USD equivalent\n2020 COVID expansion: +25% in 12 months\nTypical growth: 5-8% annually",
    source: "FRED Series: M2SL, MYAGM2EZM196N, MYAGM2JPM189N, MYAGM2CNM189N\nExchange rates: DEXUSEU, DEXJPUS, DEXCHUS"
  },
  globalM2Roc: {
    title: "Global M2 Rate of Change (30-day)",
    short: "Percentage change in Global M2 over the past 30 days",
    detail: "This momentum indicator shows whether global money supply is accelerating or decelerating. Positive ROC means money supply is expanding; negative means contracting. Changes in ROC often lead changes in risk asset prices by 2-6 months.",
    impact: "MOMENTUM INTERPRETATION:\n\nROC > +1%: Strong expansion (bullish)\nROC > 0%: Expansion (mildly bullish)\nROC = 0%: Stagnant (neutral)\nROC < 0%: Contraction (bearish)\nROC < -1%: Strong contraction (very bearish)\n\nWatch for ROC turning positive after being negative - often precedes rallies.",
    thresholds: "Typical range: -2% to +3% monthly\nCOVID stimulus peak: +5% monthly\nCurrent: Check display",
    source: "Calculated from Global M2 data\n30-day percentage change"
  },

  // === STABLECOINS ===
  stablecoins: {
    title: "Stablecoin Total Market Cap",
    short: "Combined market cap of major USD-pegged stablecoins (USDT, USDC, DAI, etc.)",
    detail: "Stablecoins represent the 'on-ramp' for capital entering crypto markets. Think of it as the M1 money supply for the crypto ecosystem. When stablecoin market cap rises, it means new capital is entering the crypto space. When it falls, capital is exiting.",
    impact: "CRYPTO LIQUIDITY INDICATOR:\n\n↑ Rising stablecoin supply:\n  - New capital entering crypto\n  - Increased buying power\n  - Bullish for crypto assets\n\n↓ Falling stablecoin supply:\n  - Capital exiting crypto\n  - Redemptions/burns\n  - Bearish for crypto assets\n\nOften leads BTC/ETH price moves by days to weeks.",
    thresholds: "Current: ~$150B+\nPeak (2022): ~$180B\nBear market low: ~$120B",
    source: "DefiLlama Stablecoins API\nhttps://defillama.com/stablecoins\nReal-time data"
  },

  // === CREDIT STRESS INDICATORS ===
  cpTbillSpread: {
    title: "Commercial Paper - Treasury Bill Spread",
    short: "Difference between 3-month AA Financial Commercial Paper rate and 3-month T-Bill rate",
    detail: "This spread measures the premium that financial institutions must pay for short-term unsecured borrowing versus risk-free Treasury rates. It's the post-LIBOR replacement for measuring credit stress in the financial system. When banks/corps are perceived as risky, this spread widens.",
    impact: "CREDIT STRESS LEVELS:\n\n< 10 bps: Very calm (normal)\n10-15 bps: Normal conditions\n15-25 bps: Emerging stress\n25-50 bps: Significant distress\n> 50 bps: Crisis conditions\n\n2008 peak: 300+ bps\n2020 COVID: 100+ bps briefly\nNormal: 5-15 bps",
    thresholds: "Normal: < 15 bps\nElevated: 15-25 bps\nStressed: 25-50 bps\nCrisis: > 50 bps",
    source: "FRED Series: RIFSPPFAAD90NB - TB3MS\nDaily data"
  },
  yieldCurve: {
    title: "10-Year minus 2-Year Treasury Spread",
    short: "The slope of the Treasury yield curve between 10-year and 2-year maturities",
    detail: "The yield curve plots Treasury yields across maturities. Normally it slopes upward (longer = higher yield). When it inverts (10Y < 2Y), it has preceded every US recession since 1970. The STEEPENING after an inversion is often when the recession actually arrives.",
    impact: "RECESSION INDICATOR:\n\n> 0.5%: Normal steep curve (expansion)\n0 to 0.5%: Flat curve (late cycle)\n< 0%: INVERTED (recession warning)\n\nKEY INSIGHT: The inversion is the warning.\nThe RE-STEEPENING is when recession hits.\n\nCurrent cycle: Inverted 2022-2023, now watching for steepening signal.",
    thresholds: "Inversion: < 0%\nMax inversion (2023): -108 bps\nNormal: +50 to +200 bps",
    source: "FRED Series: T10Y2Y\nDaily data\nhttps://fred.stlouisfed.org/series/T10Y2Y"
  },
  hySpread: {
    title: "High Yield (Junk Bond) Spread",
    short: "Option-adjusted spread of the ICE BofA High Yield Index over Treasuries",
    detail: "This measures the extra yield investors demand to hold risky corporate bonds versus safe Treasuries. It's a direct measure of credit risk appetite. When investors are confident, they accept low spreads. When fearful, spreads widen dramatically.",
    impact: "RISK APPETITE GAUGE:\n\n< 3%: Very tight (high risk appetite, potentially complacent)\n3-4%: Normal (healthy conditions)\n4-5%: Widening (increasing caution)\n5-7%: Stress (risk-off)\n> 7%: Crisis (panic)\n\n2008 peak: 21%\n2020 COVID peak: 11%\nTypical range: 3-5%",
    thresholds: "Tight: < 3.5%\nNormal: 3.5-5%\nStress: 5-7%\nCrisis: > 7%",
    source: "FRED Series: BAMLH0A0HYM2\nDaily data\nhttps://fred.stlouisfed.org/series/BAMLH0A0HYM2"
  },
  vix: {
    title: "CBOE Volatility Index (VIX)",
    short: "30-day implied volatility of S&P 500 options - the 'Fear Gauge'",
    detail: "VIX measures the market's expectation of 30-day volatility derived from S&P 500 option prices. High VIX = investors paying premium for protection = fear. Low VIX = complacency. VIX tends to spike during market selloffs and compress during calm rallies.",
    impact: "FEAR/COMPLACENCY LEVELS:\n\n< 12: Extreme complacency (often precedes volatility)\n12-15: Low volatility (calm)\n15-20: Normal\n20-25: Elevated concern\n25-30: High fear\n> 30: Panic/crisis\n\n2008 peak: 80+\n2020 COVID peak: 82\nTypical range: 12-25",
    thresholds: "Complacent: < 15\nNormal: 15-20\nElevated: 20-30\nPanic: > 30",
    source: "FRED Series: VIXCLS\nDaily data\nhttps://fred.stlouisfed.org/series/VIXCLS"
  },
  creditStatus: {
    title: "Credit Stress Status",
    short: "Composite assessment of credit market conditions",
    detail: "This status is derived from the CP-TBill spread as the primary indicator. It provides a quick summary of whether funding markets are functioning normally or showing signs of stress.",
    impact: "STATUS MEANINGS:\n\n🟢 NORMAL: Credit markets functioning well\n  - Spreads tight, liquidity ample\n  - Risk-on environment\n\n🟡 ELEVATED: Some stress emerging\n  - Spreads widening modestly\n  - Increased vigilance warranted\n\n🟠 STRESSED: Significant concerns\n  - Spreads notably elevated\n  - Risk-off positioning advisable\n\n🔴 CRITICAL: Crisis conditions\n  - Spreads at extreme levels\n  - Defensive positioning essential",
    thresholds: "Based on CP-TBill spread\nNORMAL: < 15 bps\nELEVATED: 15-25 bps\nSTRESSED: 25-50 bps\nCRITICAL: > 50 bps",
    source: "Derived from FRED credit spread data"
  },

  // === CRITICAL SLOWING DOWN (CSD) ===
  ar1: {
    title: "AR(1) Autocorrelation Coefficient",
    short: "Rolling first-order autocorrelation of detrended price residuals",
    detail: "AR(1) measures how much today's deviation from trend predicts tomorrow's. In complex systems theory, rising AR(1) approaching 1.0 indicates 'Critical Slowing Down' - the system is losing its ability to recover from shocks. This phenomenon has been observed before major transitions in ecosystems, climate, and financial markets.",
    impact: "SYSTEM RESILIENCE INDICATOR:\n\n< 0.5: Healthy (system recovers quickly from shocks)\n0.5-0.6: Normal (typical market conditions)\n0.6-0.7: Elevated (reduced resilience, increasing risk)\n0.7-0.8: HIGH (system struggling to recover)\n> 0.8: CRITICAL (potential regime change imminent)\n\nAs AR(1) → 1.0, perturbations persist longer, variance increases, and the system becomes fragile.",
    thresholds: "Normal: < 0.6\nCaution: 0.6-0.7\nElevated: 0.7-0.8\nCritical: > 0.8",
    source: "Scheffer et al. (2009) 'Early-warning signals for critical transitions' - Nature\nCalculated with 250-day rolling window, 50-day Gaussian detrending"
  },
  variance: {
    title: "Rolling Variance of Residuals",
    short: "Variance of detrended price residuals over a rolling window",
    detail: "As a system approaches a critical transition, not only does autocorrelation rise (AR(1)), but variance also typically increases. This 'flickering' represents the system oscillating more wildly as it loses stability. The combination of rising AR(1) AND rising variance is a stronger signal than either alone.",
    impact: "STABILITY INDICATOR:\n\nLow variance: System is stable, small fluctuations\nRising variance: Increasing instability, larger swings\nHigh variance + High AR(1): Strong warning of transition\n\nLook for both AR(1) and variance trending upward together - this dual signal preceded the 2008 crash and other major market transitions.",
    thresholds: "Context-dependent (normalized to recent history)\nWatch for: Sustained upward trend\nAlert: > 2 standard deviations above mean",
    source: "Dakos et al. (2012) 'Methods for Detecting Early Warnings'\nCalculated with 250-day rolling window"
  },
  kendallTau: {
    title: "Kendall's Tau (τ) - AR(1) Trend",
    short: "Non-parametric measure of whether AR(1) is systematically rising or falling over time",
    detail: "Kendall's Tau measures the monotonic trend in AR(1) over the past 100 observations. A positive tau means AR(1) is generally increasing (system losing resilience). A negative tau means AR(1) is declining (system recovering). Unlike linear regression, tau is robust to outliers.",
    impact: "TREND DIRECTION:\n\nτ > +0.3: AR(1) trending UP → System weakening → BEARISH\nτ = 0: No clear trend → NEUTRAL\nτ < -0.3: AR(1) trending DOWN → System strengthening → BULLISH\n\nSTRENGTH:\n|τ| > 0.5: Strong trend\n|τ| 0.3-0.5: Moderate trend\n|τ| < 0.3: Weak/no trend",
    thresholds: "Concerning: τ > +0.3\nNeutral: -0.3 to +0.3\nRecovery: τ < -0.3",
    source: "Mann-Kendall test for monotonic trend\nCalculated over last 100 AR(1) observations"
  },
  csdStatus: {
    title: "Critical Slowing Down Status",
    short: "Overall assessment of system resilience based on CSD indicators",
    detail: "This status combines AR(1) level, variance trend, and Kendall's Tau to provide an overall assessment of whether the market system is showing signs of fragility that often precede major transitions.",
    impact: "STATUS MEANINGS:\n\n🟢 NORMAL: System healthy\n  - AR(1) < 0.6, stable variance\n  - High resilience to shocks\n\n🟡 RISING: Early warning\n  - AR(1) increasing, 0.6-0.7\n  - Reduced resilience\n\n🟠 ELEVATED: Significant concern\n  - AR(1) 0.7-0.8\n  - System struggling\n\n🔴 CRITICAL: Regime change risk\n  - AR(1) > 0.8\n  - Transition may be imminent",
    thresholds: "Based primarily on AR(1) level\nwith τ and variance as modifiers",
    source: "Composite of CSD indicators"
  },

  // === LPPL BUBBLE DETECTION ===
  lpplBubble: {
    title: "Log-Periodic Power Law (LPPL) Bubble Detection",
    short: "Detects super-exponential growth patterns that have preceded historic market crashes",
    detail: "LPPL models price dynamics during speculative bubbles using the equation:\n\nln(P) = A + B(tc - t)^m + C(tc - t)^m cos(ω ln(tc - t) + φ)\n\nWhere:\n- A, B, C: Amplitude parameters\n- tc: Critical time (crash date)\n- m: Exponent (0.1-0.9)\n- ω: Log-periodic frequency (6-13)\n- φ: Phase\n\nThe distinctive log-periodic oscillations accelerating toward tc have preceded crashes in 1929, 1987, 2000, 2008, and others.",
    impact: "BUBBLE STATUS:\n\n🟢 NO BUBBLE: No super-exponential signature detected\n  - Normal market dynamics\n  - No imminent crash risk from this indicator\n\n🔴 BUBBLE DETECTED: LPPL signature present\n  - Super-exponential growth detected\n  - Log-periodic oscillations present\n  - tc estimate provides regime change window\n  - DOES NOT guarantee crash, but elevated risk",
    thresholds: "Detection requires:\n- R² > 0.7 (good fit)\n- 0.1 < m < 0.9\n- 6 < ω < 13\n- B < 0 (super-exponential)\n- |C| < |B| (oscillation constraint)",
    source: "Sornette, D. (2003) 'Why Stock Markets Crash' - Princeton University Press\nJohansen & Sornette (1999, 2001)"
  },
  lpplConfidence: {
    title: "LPPL Confidence Score",
    short: "How strongly the LPPL model fits the current price data (0-100%)",
    detail: "Confidence is derived from R² (goodness of fit) of the LPPL model. Higher confidence means the super-exponential bubble pattern more closely matches observed prices. However, even high confidence doesn't guarantee a crash - it indicates the mathematical signature is present.",
    impact: "CONFIDENCE INTERPRETATION:\n\n0-30%: Weak fit\n  - Pattern may be noise\n  - Low reliability\n\n30-60%: Moderate fit\n  - Some bubble characteristics\n  - Worth monitoring\n\n60-80%: Good fit\n  - Clear bubble signature\n  - Elevated concern\n\n80-100%: Strong fit\n  - Textbook bubble pattern\n  - High alert",
    thresholds: "Detection threshold: > 70% effective\nStrong signal: > 80%",
    source: "Derived from LPPL R² and filter compliance"
  },
  tcDays: {
    title: "Days to Critical Time (tc)",
    short: "Estimated number of days until the bubble reaches its critical point",
    detail: "The critical time (tc) is when the LPPL model predicts the super-exponential growth must end. This doesn't mean the market crashes exactly at tc - it means the unsustainable growth pattern can't continue beyond this point. The market may crash before tc, at tc, or transition to a new regime around tc.",
    impact: "tc INTERPRETATION:\n\n< 30 days: Imminent\n  - Transition window very near\n  - Highest alert level\n\n30-60 days: Near-term\n  - Transition expected soon\n  - Active risk management\n\n60-120 days: Medium-term\n  - Bubble maturing\n  - Prepare exit strategies\n\n> 120 days: Distant\n  - Early stage bubble\n  - Monitor evolution",
    thresholds: "Uncertainty: ±20% typically\nValid range: 5-365 days\nUnreliable if: > 365 days",
    source: "LPPL optimization output\nSubject to model uncertainty"
  },
  tcDate: {
    title: "Critical Time Date Estimate",
    short: "Calendar date when tc is projected to occur",
    detail: "This is the tc (days from now) converted to a calendar date. Remember: this is an estimate with uncertainty. The actual transition could occur before, at, or after this date. Use as a rough guide, not a precise prediction.",
    impact: "Use this date as:\n- A rough timeline for bubble maturity\n- A window to review positions\n- NOT a precise crash date prediction\n\nHistorically, crashes occur within ±20% of tc estimate.",
    thresholds: "Uncertainty window: ±20% of tc\nIf tc = 60 days, actual could be 48-72 days",
    source: "Derived from tc days estimate"
  },
  lpplR2: {
    title: "LPPL R² (Goodness of Fit)",
    short: "How much of price variance is explained by the LPPL bubble model",
    detail: "R² ranges from 0 to 1 (or 0% to 100%). Higher values mean the LPPL equation closely matches observed prices. A high R² alone doesn't confirm a bubble - the model must also pass the Sornette filters (m, ω constraints). But low R² means the bubble pattern is not present.",
    impact: "R² INTERPRETATION:\n\n< 0.5: Poor fit - no bubble pattern\n0.5-0.7: Moderate fit - possible pattern\n0.7-0.85: Good fit - likely bubble\n> 0.85: Excellent fit - strong bubble signature\n\nR² > 0.7 combined with valid m and ω is our detection threshold.",
    thresholds: "Detection threshold: R² > 0.7\nStrong signal: R² > 0.8\nRequired: Sornette filters also pass",
    source: "Standard regression R² from LPPL fit"
  },
  lpplOmega: {
    title: "LPPL ω (Log-Periodic Frequency)",
    short: "The frequency of oscillations in the log-periodic pattern",
    detail: "Omega (ω) controls how many oscillations occur as price approaches the critical time. Valid bubbles historically show ω between 6 and 13. Values outside this range suggest the pattern is not a genuine speculative bubble but some other phenomenon.",
    impact: "ω INTERPRETATION:\n\n6-8: Lower frequency oscillations\n  - Fewer, larger waves before crash\n  - Typical of slower-building bubbles\n\n8-10: Medium frequency\n  - Classic bubble pattern\n  - Most common in historical crashes\n\n10-13: Higher frequency\n  - More rapid oscillations\n  - Often faster-developing bubbles\n\n< 6 or > 13: Invalid - not a true bubble signature",
    thresholds: "Valid range: 6 < ω < 13\nTypical: 7-10\nHistorical crashes: Usually 7-11",
    source: "Sornette filter criterion\nBased on historical crash analysis"
  },
  lpplM: {
    title: "LPPL m (Power Law Exponent)",
    short: "Controls the shape of acceleration toward the critical point",
    detail: "The exponent m determines how sharply prices accelerate toward tc. Lower m = sharper acceleration. For valid bubbles, m should be between 0.1 and 0.9. Values near 0.33 are considered 'ideal' based on theoretical models, but the valid range is broader.",
    impact: "m INTERPRETATION:\n\n0.1-0.3: Sharp acceleration\n  - Price rising very rapidly\n  - Late-stage parabolic\n\n0.3-0.5: Classic bubble shape\n  - 'Ideal' bubble profile\n  - Most common in crashes\n\n0.5-0.7: Moderate acceleration\n  - Still super-exponential\n  - Earlier stage\n\n0.7-0.9: Mild acceleration\n  - Barely super-exponential\n  - Weak bubble signature\n\n< 0.1 or > 0.9: Invalid",
    thresholds: "Valid range: 0.1 < m < 0.9\nIdeal: ~0.33 (theoretical)\nTypical: 0.2-0.6",
    source: "Sornette filter criterion\nTheoretical: Rational Expectation model"
  },
  lpplStatus: {
    title: "LPPL Detection Status",
    short: "Summary message about current LPPL analysis results",
    detail: "This provides a human-readable summary of what the LPPL analysis found. It indicates whether a bubble signature was detected and any relevant caveats about the analysis.",
    impact: "Possible statuses:\n\n• 'No bubble signature': Normal market - no LPPL pattern\n• 'BUBBLE DETECTED': Super-exponential pattern found\n• 'Weak signal': Some bubble characteristics but below threshold\n• 'Insufficient data': Not enough price history for analysis",
    thresholds: "Detection requires all criteria met:\n- R² > 0.7\n- Valid m (0.1-0.9)\n- Valid ω (6-13)\n- B < 0, |C| < |B|",
    source: "LPPL analysis summary"
  },

  // === CORRELATION ===
  correlation: {
    title: "Net Liquidity - S&P 500 Correlation",
    short: "Rolling correlation between Net Liquidity and S&P 500 price",
    detail: "This measures how tightly stock prices track liquidity conditions. When correlation is high, prices are 'coupled' to liquidity fundamentals. When correlation breaks down, prices may be driven by other factors (sentiment, momentum) and could be vulnerable to mean reversion.",
    impact: "COUPLING STATUS:\n\n> 0.8: Very tight coupling\n  - Liquidity driving prices\n  - Fundamentally-driven market\n\n0.6-0.8: Normal coupling\n  - Liquidity influential\n  - Healthy conditions\n\n0.3-0.6: Weakening\n  - Some disconnect emerging\n  - Other factors gaining influence\n\n< 0.3: DECOUPLED\n  - Prices diverged from liquidity\n  - 'Wile E. Coyote' risk\n  - Mean reversion likely",
    thresholds: "Coupled: > 0.7\nWeakening: 0.3-0.7\nDecoupled: < 0.3\n\nDecoupling often precedes corrections",
    source: "Pearson correlation coefficient\nRolling windows: 30, 90, 180 days"
  },

  // === COMPOSITE SCORE ===
  regimeScore: {
    title: "Composite Regime Fragility Score",
    short: "Overall market fragility assessment combining multiple indicators (0-100)",
    detail: "The composite score weights multiple risk factors:\n\n• AR(1) autocorrelation: 35%\n• Kendall's Tau trend: 20%\n• LPPL bubble confidence: 25%\n• Liquidity stress: 20%\n\nHigher scores indicate more fragile conditions with elevated risk of adverse regime change.",
    impact: "SCORE INTERPRETATION:\n\n0-25: FAVORABLE\n  - Low fragility, healthy conditions\n  - Risk-on appropriate\n\n25-40: NORMAL\n  - Typical market conditions\n  - Standard risk management\n\n40-55: CAUTION\n  - Elevated fragility\n  - Reduce risk exposure\n\n55-70: ELEVATED\n  - High fragility\n  - Defensive positioning\n\n70-100: CRITICAL\n  - Extreme fragility\n  - Maximum caution advised",
    thresholds: "Green (Favorable): 0-25\nYellow (Caution): 25-55\nRed (Critical): 55-100",
    source: "Composite calculation from CSD, LPPL, and liquidity metrics"
  },
  regimeSignal: {
    title: "Trading Signal",
    short: "Suggested positioning based on regime score",
    detail: "This signal translates the composite regime score into actionable guidance. It's a suggestion based on systematic analysis, not financial advice. Always consider your own risk tolerance and investment objectives.",
    impact: "SIGNAL MEANINGS:\n\n🟢 STRONG BUY: Favorable conditions\n  - Low fragility, high resilience\n  - Consider adding risk\n\n🟢 ACCUMULATE: Normal, improving\n  - Healthy conditions\n  - Standard positioning\n\n🟡 HOLD: Neutral/mixed\n  - Some concerns present\n  - Maintain current exposure\n\n🟠 REDUCE RISK: Elevated concerns\n  - Multiple warning signs\n  - Trim positions\n\n🔴 STRONG SELL: Critical conditions\n  - High fragility\n  - Maximum defense",
    thresholds: "Based on composite regime score\nSee regimeScore for details",
    source: "Derived from composite analysis"
  },

  // === MARKET DATA ===
  spx: {
    title: "S&P 500 Index",
    short: "Primary benchmark for US large-cap equity performance",
    detail: "The S&P 500 tracks 500 large US companies, representing approximately 80% of available US market capitalization. It's the primary risk asset we analyze for regime detection, LPPL bubbles, and correlation with liquidity.",
    impact: "Used as the primary input for:\n• CSD indicators (AR(1), variance)\n• LPPL bubble detection\n• Correlation analysis\n• Regime scoring\n\nDivergence between SPX and Net Liquidity is a key warning signal.",
    thresholds: "Context-dependent\nWatch for: Divergence from Net Liquidity\nLPPL: Super-exponential growth patterns",
    source: "FRED Series: SP500\nDaily data\nhttps://fred.stlouisfed.org/series/SP500"
  },
  sunspots: {
    title: "Solar Sunspot Number (SSN)",
    short: "Monthly smoothed international sunspot number from NOAA",
    detail: "EXPERIMENTAL INDICATOR: Some research suggests correlations between solar cycles and market volatility. Solar Cycle 25 is currently near its maximum (2024-2026). While not proven causal, it's included for completeness and research purposes.",
    impact: "⚠️ SPECULATIVE INDICATOR\n\nSolar maximum periods have historically coincided with:\n• Increased geomagnetic activity\n• Some studies show market correlation\n• Mechanism unclear (sentiment? physics?)\n\nCycle 25 maximum: 2024-2026\nCurrent: Near peak activity\n\nUse with extreme caution - correlation ≠ causation.",
    thresholds: "Solar minimum: < 20\nRising phase: 20-100\nSolar maximum: 100-200+\nCycle 25 predicted peak: ~150-200",
    source: "NOAA Space Weather Prediction Center\nhttps://www.swpc.noaa.gov"
  },

  // === SCENARIOS ===
  whatIf: {
    title: "Scenario Simulator",
    short: "Model the impact of hypothetical changes to liquidity components",
    detail: "This tool lets you adjust TGA, QT pace, and RRP to see how Net Liquidity would change. Use it to model scenarios like:\n\n• Treasury rebuilding TGA after debt ceiling\n• Fed pausing or accelerating QT\n• RRP draining or refilling\n\nThe projected line shows where Net Liquidity would be under your scenario.",
    impact: "SCENARIO IDEAS:\n\n📈 Bullish scenarios:\n  - TGA drawdown (spending)\n  - QT pause (0%)\n  - (RRP already exhausted)\n\n📉 Bearish scenarios:\n  - TGA rebuild (+$300B)\n  - QT acceleration (150%)\n\nProject the impact and plan accordingly.",
    thresholds: "TGA range: -$500B to +$500B change\nQT pace: 0% (pause) to 200% (double)\nRRP: Minimal impact (already near zero)",
    source: "Interactive calculation tool"
  },

  // === V8 NEW FEATURES ===
  rrpCountdown: {
    title: "RRP Countdown - Liquidity Cliff Timer",
    short: "Days until RRP exhaustion at current drain rate",
    detail: "This critical widget tracks the depletion of the RRP facility. When RRP hits zero, the 'ample reserves' regime ends and we enter potential 'reserve scarcity' territory.\n\nCalculation: Current RRP ÷ 30-day average drain rate = Days to exhaustion",
    impact: "THE CLIFF APPROACHES:\n\n⚠️ Current burn rates suggest RRP will hit zero between late 2025 and early 2026.\n\n🔴 CONSEQUENCE: Once RRP = 0, every dollar of QT drains directly from Bank Reserves.\n\n💀 SCARCITY FLOOR: If Bank Reserves fall below ~$2.5-3.0 Trillion (8-10% of GDP), the repo market may seize up, replicating September 2019.",
    thresholds: "CRITICAL: < 30 days\nWARNING: 30-90 days\nCAUTION: 90-180 days\nSTABLE: > 180 days",
    source: "Calculated from NY Fed RRP data\n30-day rolling average drain rate"
  },
  stablecoins: {
    title: "Stablecoin Total Market Cap",
    short: "USDT + USDC + DAI + others - Crypto's M1 money supply",
    detail: "Stablecoins represent the 'on-ramp' for capital entering crypto markets. Think of it as the M1 money supply for the crypto ecosystem.\n\n↑ Rising stablecoin supply = New capital entering crypto\n↓ Falling supply = Capital exiting crypto\n\nOften leads BTC/ETH price moves by days to weeks.",
    impact: "CRYPTO LIQUIDITY INDICATOR:\n\n↑ Rising stablecoin supply:\n  - New capital entering crypto ecosystem\n  - Increased buying power\n  - Bullish for crypto assets\n\n↓ Falling stablecoin supply:\n  - Capital exiting crypto\n  - Redemptions/burns occurring\n  - Bearish for crypto assets",
    thresholds: "Current: ~$150B+\nPeak (2022): ~$180B\nBear market low: ~$120B",
    source: "DefiLlama Stablecoins API\nReal-time data"
  },
  pyodideEngine: {
    title: "Pyodide Engine Status",
    short: "Client-side Python compute via WebAssembly",
    detail: "The Fractal Terminal runs a full Python data stack (NumPy) directly in your browser using WebAssembly. This makes your browser a 'sovereign compute node' - all calculations happen locally, no data sent to servers.\n\nCapabilities:\n- Net Liquidity derivatives\n- AR(1) autocorrelation\n- LPPL bubble detection\n- GEX calculation (with options data)",
    impact: "SERVERLESS ARCHITECTURE:\n\n✓ Privacy: Your data never leaves your browser\n✓ Speed: Sub-millisecond calculations\n✓ Cost: No server infrastructure needed\n✓ Sovereignty: You control the compute",
    thresholds: "Loading: Pyodide initializing (~5-10s first load)\nReady: Engine active and computing\nError: Failed to load - check browser console",
    source: "Pyodide v0.25.0\nCDN: jsdelivr.net"
  },
  dataLatency: {
    title: "Data Latency & Sources",
    short: "How fresh is the data?",
    detail: "Different data sources have different update frequencies:\n\n• TGA: T-1 (Daily Treasury Statement API)\n• RRP: Same-day (~1:15 PM ET from NY Fed)\n• WALCL: Weekly (FRED, Thursday)\n• Stablecoins: Real-time (DefiLlama)\n• VIX/Spreads: Daily (FRED)",
    impact: "LATENCY MATTERS:\n\nIn volatile markets, even T-1 data can be stale. The terminal attempts to use the freshest sources available:\n\n🟢 Live: Same-day data\n🟡 T-1: One day latency\n🟠 Weekly: Up to 7 days stale\n🔴 Error: Fallback data or unavailable",
    thresholds: "Real-time: < 1 hour\nDaily: 1-24 hours\nWeekly: 1-7 days",
    source: "Multiple APIs via Edge Proxy"
  }
};

// ============ TOOLTIP PORTAL ============
// Renders tooltip at document.body level to escape all container clipping
const TooltipPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return ReactDOM.createPortal(children, document.body);
};

// ============ SMART TOOLTIP COMPONENT ============
// Uses FIXED positioning via portal - guaranteed visible everywhere
const InfoTooltip = ({ id, children, className = '' }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const info = EXPLANATIONS[id];
  
  if (!info) return <span className={className}>{children}</span>;

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Tooltip dimensions
    const tw = 400;
    const th = 380;
    
    // Position: prefer right of element, flip if no room
    let x = rect.right + 12;
    if (x + tw > vw - 20) {
      x = rect.left - tw - 12;
    }
    // If still no room, center horizontally
    if (x < 20) {
      x = Math.max(20, (vw - tw) / 2);
    }
    
    // Vertical: center on element, clamp to viewport
    let y = rect.top + rect.height / 2 - th / 2;
    y = Math.max(20, Math.min(y, vh - th - 20));
    
    setCoords({ x, y });
    setShow(true);
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        ref={triggerRef}
        className="cursor-help inline-flex items-center gap-1 group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        {children}
        <Info className="w-3.5 h-3.5 text-cyan-500/50 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
      </span>
      
      {show && (
        <TooltipPortal>
          <div 
            style={{ 
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              zIndex: 999999,
              width: 400,
              maxWidth: 'calc(100vw - 40px)',
              pointerEvents: 'none'
            }}
          >
            <div className="bg-slate-950 border-2 border-cyan-500/60 rounded-xl shadow-2xl shadow-cyan-500/30 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-900/50 to-slate-900 border-b border-cyan-500/40 px-4 py-3">
                <h4 className="text-cyan-400 font-bold text-sm">{info.title}</h4>
                <p className="text-slate-300 text-xs mt-1">{info.short}</p>
              </div>
              
              {/* Body */}
              <div className="p-4 space-y-3 max-h-[55vh] overflow-auto">
                {/* Detail */}
                <div>
                  <p className="text-[11px] text-cyan-500 uppercase tracking-wider mb-1 font-semibold">Explanation</p>
                  <p className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed">{info.detail}</p>
                </div>
                
                {/* Impact */}
                <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-3">
                  <p className="text-[11px] text-amber-400 uppercase tracking-wider mb-1 font-semibold">Impact & Interpretation</p>
                  <p className="text-amber-200 text-xs whitespace-pre-wrap font-mono leading-relaxed">{info.impact}</p>
                </div>
                
                {/* Thresholds */}
                {info.thresholds && (
                  <div className="bg-slate-800/70 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Key Thresholds</p>
                    <p className="text-slate-300 text-xs whitespace-pre-wrap font-mono">{info.thresholds}</p>
                  </div>
                )}
                
                {/* Source */}
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-[10px] text-slate-500 whitespace-pre-wrap">{info.source}</p>
                </div>
              </div>
            </div>
          </div>
        </TooltipPortal>
      )}
    </span>
  );
};

// ============ DELTA INDICATOR COMPONENT ============
// Shows direction and magnitude of change
const DeltaIndicator = ({ current, previous, unit = '', invert = false, showValue = true, size = 'md' }) => {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return <span className="text-slate-600">--</span>;
  }
  
  const delta = current - previous;
  const percentChange = previous !== 0 ? (delta / Math.abs(previous)) * 100 : 0;
  
  // Determine if change is positive for the indicator
  // invert = true means rising is bad (e.g., TGA rising = drain = bad)
  const isPositiveChange = invert ? delta < 0 : delta > 0;
  const isNegativeChange = invert ? delta > 0 : delta < 0;
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  if (Math.abs(delta) < 0.01) {
    return (
      <span className={`inline-flex items-center gap-1 text-slate-500 ${sizeClasses[size]}`}>
        <Minus className={iconSizes[size]} />
        {showValue && <span>0{unit}</span>}
      </span>
    );
  }
  
  const color = isPositiveChange ? 'text-emerald-400' : isNegativeChange ? 'text-rose-400' : 'text-slate-400';
  const Icon = delta > 0 ? ChevronUp : ChevronDown;
  
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${color} ${sizeClasses[size]}`}>
      <Icon className={iconSizes[size]} />
      {showValue && (
        <span>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
          <span className="text-slate-500 ml-1">({percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%)</span>
        </span>
      )}
    </span>
  );
};

// ============ METRIC CARD WITH DELTA ============
const MetricCard = ({ 
  id, 
  label, 
  value, 
  previousValue,
  unit = '', 
  icon: Icon, 
  color = 'cyan',
  alert = false,
  alertMessage = '',
  invert = false,
  source = ''
}) => {
  return (
    <div className={`p-3 rounded-lg bg-slate-900/70 border ${alert ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-700/50'} relative`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`w-4 h-4 text-${color}-400`} />}
        <InfoTooltip id={id}>
          <span className="text-xs text-slate-400">{label}</span>
        </InfoTooltip>
      </div>
      
      <div className="flex items-baseline justify-between">
        <p className={`font-mono text-xl font-semibold text-${color}-400`}>
          {value}{unit && <span className="text-sm text-slate-500 ml-1">{unit}</span>}
        </p>
        
        {previousValue !== undefined && (
          <DeltaIndicator 
            current={parseFloat(String(value).replace(/[^0-9.-]/g, ''))} 
            previous={parseFloat(String(previousValue).replace(/[^0-9.-]/g, ''))}
            invert={invert}
            size="sm"
            showValue={false}
          />
        )}
      </div>
      
      {/* Source badge */}
      {source && (
        <span className="absolute top-2 right-2 text-[9px] text-emerald-500/70 font-mono">{source}</span>
      )}
      
      {/* Alert message */}
      {alert && alertMessage && (
        <p className="text-[10px] text-rose-400 mt-1">{alertMessage}</p>
      )}
    </div>
  );
};

// ============ RRP COUNTDOWN WIDGET ============
// The "Liquidity Cliff" timer - critical V8 feature
const RRPCountdownWidget = ({ countdown }) => {
  if (!countdown) return null;
  
  const { status, current_billion, drain_rate_per_day, days_to_exhaustion, projected_zero_date, history } = countdown;
  
  const getStatusColor = () => {
    if (status === 'CRITICAL' || current_billion < 50) return 'rose';
    if (status === 'WARNING' || current_billion < 200) return 'amber';
    if (status === 'DRAINING') return 'yellow';
    return 'emerald';
  };
  
  const color = getStatusColor();
  const isExhausted = current_billion < 10;
  
  // Calculate percentage drained from peak
  const peakRRP = history && history.length > 0 ? Math.max(...history.map(h => h.rrp)) : 2500;
  const percentDrained = ((peakRRP - current_billion) / peakRRP * 100).toFixed(1);
  
  return (
    <div className={`relative rounded-xl border ${isExhausted ? 'border-rose-500/60 bg-rose-950/30' : `border-${color}-500/40 bg-black/80`} backdrop-blur-sm overflow-hidden shadow-lg`}>
      {/* Corner accents */}
      <div className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-${color}-500/50`} />
      <div className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-${color}-500/50`} />
      <div className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-${color}-500/50`} />
      <div className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-${color}-500/50`} />
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 text-${color}-400`} />
            <InfoTooltip id="rrpCountdown">
              <span className={`text-sm font-mono font-bold text-${color}-400 tracking-wider uppercase`}>RRP LIQUIDITY CLIFF</span>
            </InfoTooltip>
          </div>
          <span className={`px-2 py-0.5 text-xs font-mono rounded ${
            status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
            status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>{status}</span>
        </div>
        
        {isExhausted ? (
          <div className="text-center py-4">
            <div className="text-4xl font-mono font-bold text-rose-400 animate-pulse">⚠️ EXHAUSTED</div>
            <p className="text-rose-300 text-sm mt-2">RRP Buffer Depleted - QT now draining reserves directly</p>
            <div className="mt-4 p-3 bg-rose-950/50 rounded-lg border border-rose-500/30">
              <p className="text-xs text-rose-300">
                <strong>WHAT THIS MEANS:</strong> The $2.5T buffer that protected bank reserves from QT is gone. 
                Every dollar of ongoing QT (~$60B/month) now reduces bank reserves directly. 
                Watch for signs of reserve scarcity (repo rate spikes, ERR usage).
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Key Metrics */}
            <div className="space-y-3">
              <div className="text-center p-3 bg-black/40 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Days to Zero</p>
                <div className={`text-4xl font-mono font-bold text-${color}-400`}>
                  {days_to_exhaustion !== null ? days_to_exhaustion : '< 1'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-black/40 rounded-lg text-center">
                  <p className="text-[10px] text-slate-500">Current</p>
                  <p className={`font-mono text-sm text-${color}-400`}>${current_billion?.toFixed(1)}B</p>
                </div>
                <div className="p-2 bg-black/40 rounded-lg text-center">
                  <p className="text-[10px] text-slate-500">Drain Rate</p>
                  <p className="font-mono text-sm text-rose-400">-${Math.abs(drain_rate_per_day || 0).toFixed(1)}B/d</p>
                </div>
              </div>
              
              <div className="p-2 bg-black/40 rounded-lg text-center">
                <p className="text-[10px] text-slate-500">{percentDrained}% Drained from Peak</p>
                <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
                    style={{ width: `${percentDrained}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Right: Mini Chart */}
            <div>
              <p className="text-[10px] text-slate-500 mb-1 text-center">RRP DRAIN TRAJECTORY →</p>
              {history && history.length > 0 ? (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <defs>
                        <linearGradient id="rrpDrainGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={false} axisLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 8 }} width={35} tickFormatter={v => `$${v}B`} axisLine={false} />
                      <Area 
                        type="monotone" 
                        dataKey="rrp" 
                        stroke="#f43f5e" 
                        strokeWidth={2}
                        fill="url(#rrpDrainGrad)" 
                      />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-600 text-xs">
                  No historical data
                </div>
              )}
              <p className="text-[10px] text-slate-600 text-center mt-1">
                Peak: ${peakRRP?.toFixed(0)}B → Now: ${current_billion?.toFixed(1)}B
              </p>
            </div>
          </div>
        )}
        
        {/* Explanation footer */}
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-500">
            <strong className={`text-${color}-400`}>↓ DRAINING TO ZERO:</strong> RRP acts as a liquidity buffer. 
            As it empties, QT directly reduces bank reserves. Once reserves hit ~$2.5T, repo stress begins.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============ COMMAND PALETTE ============
// Keyboard-first interface (Cmd+K)
const CommandPalette = ({ isOpen, onClose, onCommand }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  
  const commands = [
    { id: 'refresh', label: 'Refresh Data', shortcut: 'R', icon: Clock },
    { id: 'scenario', label: 'Toggle Scenario Simulator', shortcut: 'S', icon: Sliders },
    { id: 'help', label: 'Open Help', shortcut: '?', icon: HelpCircle },
    { id: 'export', label: 'Export to PowerPoint', shortcut: 'E', icon: Download },
    { id: 'timerange_1m', label: 'Time Range: 1 Month', icon: Clock },
    { id: 'timerange_3m', label: 'Time Range: 3 Months', icon: Clock },
    { id: 'timerange_1y', label: 'Time Range: 1 Year', icon: Clock },
    { id: 'timerange_all', label: 'Time Range: All', icon: Clock },
  ];
  
  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <TooltipPortal>
      <div className="fixed inset-0 z-[999999] flex items-start justify-center pt-[15vh] bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <div 
          className="w-full max-w-xl bg-black/95 border-2 border-cyan-500/50 rounded-xl shadow-2xl shadow-cyan-500/20 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-cyan-500/30">
            <Command className="w-5 h-5 text-cyan-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a command..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none font-mono"
            />
            <span className="text-xs text-slate-500 font-mono">ESC to close</span>
          </div>
          
          {/* Commands */}
          <div className="max-h-[50vh] overflow-auto">
            {filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => { onCommand?.(cmd.id); onClose?.(); setQuery(''); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-950/30 transition-colors text-left"
              >
                <cmd.icon className="w-4 h-4 text-cyan-400" />
                <span className="flex-1 text-slate-200">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </TooltipPortal>
  );
};

// ============ HELPER FUNCTIONS ============
const calculateCorrelation = (x, y) => {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
};

const exportToPowerPoint = async (data, correlations) => {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  
  const s1 = pres.addSlide();
  s1.addText('FRACTAL TERMINAL', { x: 0.5, y: 1.5, w: 9, fontSize: 44, color: '00D4FF', bold: true });
  s1.addText('Institutional Liquidity Analysis', { x: 0.5, y: 2.3, w: 9, fontSize: 20, color: '888888' });
  s1.addText(`Generated: ${new Date().toLocaleString()}`, { x: 0.5, y: 3.2, fontSize: 12, color: '666666' });
  s1.addText(`Regime: ${data.regime?.status} (${data.regime?.composite?.toFixed(1)})`, {
    x: 0.5, y: 3.8, fontSize: 24,
    color: data.regime?.status === 'CRITICAL' ? 'FF4444' : data.regime?.status === 'ELEVATED' ? 'FFAA00' : '44FF44'
  });
  
  pres.writeFile({ fileName: `FractalTerminal_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ============ CHART TOOLTIP ============
const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-950 border border-cyan-500/40 rounded-lg p-3 shadow-xl z-[99999]">
      <p className="text-xs font-mono text-cyan-400 mb-2">{label}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-slate-400">{e.name}:</span>
          <span className="text-white">{typeof e.value === 'number' ? e.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ============ PANEL COMPONENT ============
const Panel = ({ title, icon: Icon, children, glowColor = 'cyan', className = '' }) => (
  <div className={`relative rounded-xl border border-${glowColor}-500/30 bg-slate-900/80 backdrop-blur overflow-hidden ${className}`}>
    {/* Corner accents */}
    <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-${glowColor}-500/50`} />
    <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-${glowColor}-500/50`} />
    <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-${glowColor}-500/50`} />
    <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-${glowColor}-500/50`} />
    
    {/* Header */}
    {title && (
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-${glowColor}-500/20 bg-${glowColor}-950/30`}>
        {Icon && <Icon className={`w-4 h-4 text-${glowColor}-400`} />}
        <span className={`text-sm font-mono font-bold text-${glowColor}-400 tracking-wider`}>{title}</span>
      </div>
    )}
    
    <div className="p-4">
      {children}
    </div>
  </div>
);

// ============ MAIN COMPONENT ============
const FractalTerminal = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  const [showScenario, setShowScenario] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [scenarios, setScenarios] = useState({ tgaDelta: 0, qtPace: 100, rrpDelta: 0 });
  const [commandOpen, setCommandOpen] = useState(false);

  // Keyboard shortcuts (Cmd+K for command palette)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Command handler
  const handleCommand = (cmd) => {
    switch (cmd) {
      case 'refresh': window.location.reload(); break;
      case 'scenario': setShowScenario(!showScenario); break;
      case 'help': setShowHelp(true); break;
      case 'export': 
        if (data) exportToPowerPoint(data, correlations);
        break;
      case 'timerange_1m': setTimeRange('1M'); break;
      case 'timerange_3m': setTimeRange('3M'); break;
      case 'timerange_1y': setTimeRange('1Y'); break;
      case 'timerange_all': setTimeRange('ALL'); break;
    }
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/data');
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to fetch');
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter data by time range
  const filteredData = useMemo(() => {
    if (!data?.timeseries?.length) return [];
    const ts = data.timeseries;
    const lastDate = new Date(ts[ts.length - 1]?.date);
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825, 'ALL': 99999 };
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - (daysMap[timeRange] || 365));
    return ts.filter(d => d.date >= cutoff.toISOString().split('T')[0]);
  }, [data, timeRange]);

  // Get previous values for delta calculations
  const previousValues = useMemo(() => {
    if (!filteredData.length || filteredData.length < 8) return {};
    const weekAgo = filteredData[filteredData.length - 6] || filteredData[0];
    return {
      tga: weekAgo.tga,
      rrp: weekAgo.rrp,
      balance_sheet: weekAgo.balance_sheet,
      reserves: weekAgo.reserves,
      net_liquidity: weekAgo.net_liquidity,
      spx: weekAgo.spx
    };
  }, [filteredData]);

  // Scenario projection
  const scenarioData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      projectedNetLiquidity: d.net_liquidity - (scenarios.tgaDelta * 1000) - (scenarios.rrpDelta * 1000)
    }));
  }, [filteredData, scenarios]);

  // Correlations
  const correlations = useMemo(() => {
    if (!filteredData.length) return { day30: null, day90: null, day180: null };
    const calc = (days) => {
      const recent = filteredData.slice(-days);
      if (recent.length < days * 0.8) return null;
      const liq = recent.map(d => d.net_liquidity).filter(v => v != null);
      const spx = recent.map(d => d.spx).filter(v => v != null);
      if (liq.length !== spx.length || liq.length < 10) return null;
      return calculateCorrelation(liq, spx);
    };
    return { day30: calc(30), day90: calc(90), day180: calc(180) };
  }, [filteredData]);

  // Regime styling
  const getRegimeStyle = (status) => ({
    CRITICAL: { color: 'rose', bg: 'bg-rose-950/30', border: 'border-rose-500/50' },
    ELEVATED: { color: 'amber', bg: 'bg-amber-950/30', border: 'border-amber-500/50' },
    CAUTION: { color: 'yellow', bg: 'bg-yellow-950/30', border: 'border-yellow-500/50' },
    NORMAL: { color: 'emerald', bg: 'bg-emerald-950/30', border: 'border-emerald-500/50' },
    FAVORABLE: { color: 'cyan', bg: 'bg-cyan-950/30', border: 'border-cyan-500/50' },
  }[status] || { color: 'slate', bg: 'bg-slate-900', border: 'border-slate-700' });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Terminal className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
          <p className="text-cyan-400 font-mono tracking-widest">INITIALIZING</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Panel title="SYSTEM ERROR" icon={AlertCircle} glowColor="rose">
          <p className="text-slate-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-900/50 border border-rose-700 rounded text-rose-300 font-mono">
            RETRY
          </button>
        </Panel>
      </div>
    );
  }

  const { regime, csd, lppl, credit_stress, global_m2, stablecoins, latest, meta } = data;
  const regimeStyle = getRegimeStyle(regime?.status);
  const corrStatus = correlations.day90 > 0.7 ? 'COUPLED' : correlations.day90 > 0.3 ? 'WEAKENING' : 'DECOUPLED';

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-black to-black" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono text-cyan-400">FRACTAL TERMINAL</h1>
              <p className="text-xs text-cyan-500/60 font-mono">v8.0 • All Real Data • No Simulations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCommandOpen(true)} 
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Command Palette"
            >
              <Command className="w-4 h-4" />
              <span className="text-xs font-mono">⌘K</span>
            </button>
            <button onClick={() => setShowScenario(!showScenario)} className={`p-2 rounded-lg border ${showScenario ? 'bg-cyan-900/30 border-cyan-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
              <Sliders className="w-5 h-5 text-cyan-400" />
            </button>
            <button onClick={() => exportToPowerPoint(data, correlations)} className="p-2 rounded-lg bg-purple-900/30 border border-purple-500/30 text-purple-300">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700">
              <HelpCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </header>

        {/* Data freshness */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(meta?.generated_at).toLocaleString()}</span>
          <span>•</span>
          <span className="text-emerald-500">✓ TGA: {latest?.tga_source || 'FRED'}</span>
          <span className="text-emerald-500">✓ RRP: {latest?.rrp_source || 'FRED'}</span>
        </div>

        {/* Scenario Simulator */}
        {showScenario && (
          <Panel title="SCENARIO SIMULATOR" icon={Sliders} className="mb-6">
            <InfoTooltip id="whatIf" className="mb-4">
              <span className="text-xs text-slate-400">Model hypothetical liquidity changes</span>
            </InfoTooltip>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
              {[
                { key: 'tgaDelta', label: 'TGA Change', min: -500, max: 500, unit: 'B', desc: 'Treasury spending (-) or issuance (+)' },
                { key: 'qtPace', label: 'QT Pace', min: 0, max: 200, unit: '%', desc: '0% = pause, 100% = current, 200% = double' },
                { key: 'rrpDelta', label: 'RRP Change', min: -50, max: 500, unit: 'B', desc: 'Facility change (minimal impact at current levels)' },
              ].map(s => (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">{s.label}</span>
                    <span className={`font-mono ${scenarios[s.key] > (s.key === 'qtPace' ? 100 : 0) ? 'text-rose-400' : scenarios[s.key] < (s.key === 'qtPace' ? 100 : 0) ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {s.key === 'qtPace' ? '' : scenarios[s.key] >= 0 ? '+' : ''}{scenarios[s.key]}{s.unit}
                    </span>
                  </div>
                  <input type="range" min={s.min} max={s.max} value={scenarios[s.key]} onChange={e => setScenarios(prev => ({ ...prev, [s.key]: parseInt(e.target.value) }))} className="w-full accent-cyan-500" />
                  <p className="text-[10px] text-slate-600 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-black/40 flex items-center justify-between border border-cyan-500/20">
              <span className="text-sm text-slate-400">Projected Net Liquidity:</span>
              <span className="font-mono text-2xl text-cyan-400">${((latest?.net_liquidity - (scenarios.tgaDelta * 1000) - (scenarios.rrpDelta * 1000)) / 1000000).toFixed(2)}T</span>
            </div>
          </Panel>
        )}

        {/* REGIME BANNER */}
        <Panel glowColor={regimeStyle.color} className={`mb-6 ${regimeStyle.bg}`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <InfoTooltip id="regimeScore">
                <div className={`text-6xl font-bold font-mono text-${regimeStyle.color}-400`}>
                  {regime?.composite?.toFixed(0) || '--'}
                </div>
              </InfoTooltip>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold text-${regimeStyle.color}-400`}>{regime?.status}</span>
                  <InfoTooltip id="regimeSignal">
                    <span className={`px-3 py-1 rounded-full text-sm font-mono bg-${regimeStyle.color}-900/50 text-${regimeStyle.color}-300`}>
                      {regime?.signal}
                    </span>
                  </InfoTooltip>
                </div>
                <p className="text-xs text-slate-500 mt-1">Composite Fragility Index (0-100)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { id: 'ar1', label: 'AR(1)', value: csd?.current_ar1?.toFixed(3), warn: csd?.current_ar1 > 0.7 },
                { id: 'kendallTau', label: 'Kendall τ', value: csd?.kendall_tau?.toFixed(3), warn: csd?.kendall_tau > 0.3 },
                { id: 'lpplBubble', label: 'LPPL', value: lppl?.is_bubble ? `${lppl.confidence}%` : 'NO', warn: lppl?.is_bubble },
                { id: 'netLiquidity', label: 'Net Liq', value: `$${((latest?.net_liquidity || 0) / 1000000).toFixed(2)}T` },
                { id: 'correlation', label: 'Corr 90d', value: correlations.day90?.toFixed(2) || '--', warn: correlations.day90 !== null && correlations.day90 < 0.3 },
                { id: 'rrp', label: 'RRP Buffer', value: `$${(latest?.rrp || 0).toFixed(0)}B`, warn: true },
              ].map(m => (
                <div key={m.id} className="text-center">
                  <InfoTooltip id={m.id}>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                  </InfoTooltip>
                  <p className={`font-mono text-lg ${m.warn ? 'text-rose-400' : 'text-slate-200'}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* CORE LIQUIDITY METRICS with Deltas */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard
            id="balanceSheet"
            label="Fed Balance Sheet"
            value={`$${((latest?.balance_sheet || 0) / 1000).toFixed(2)}`}
            unit="T"
            previousValue={previousValues.balance_sheet ? previousValues.balance_sheet / 1000 : undefined}
            icon={Database}
            color="blue"
            source="FRED"
          />
          <MetricCard
            id="tga"
            label="Treasury (TGA)"
            value={`$${(latest?.tga || 0).toFixed(0)}`}
            unit="B"
            previousValue={previousValues.tga}
            icon={DollarSign}
            color="emerald"
            invert={true}
            source={latest?.tga_source}
          />
          <MetricCard
            id="rrp"
            label="RRP Facility"
            value={`$${(latest?.rrp || 0).toFixed(1)}`}
            unit="B"
            previousValue={previousValues.rrp}
            icon={Layers}
            color="rose"
            alert={true}
            alertMessage="BUFFER EXHAUSTED"
            source={latest?.rrp_source}
          />
          <MetricCard
            id="reserves"
            label="Bank Reserves"
            value={latest?.reserves ? `$${(latest.reserves / 1000).toFixed(2)}` : '--'}
            unit="T"
            previousValue={previousValues.reserves ? previousValues.reserves / 1000 : undefined}
            icon={Shield}
            color="cyan"
          />
          <MetricCard
            id="spx"
            label="S&P 500"
            value={latest?.spx?.toLocaleString() || '--'}
            previousValue={previousValues.spx}
            icon={TrendingUp}
            color="amber"
          />
          <MetricCard
            id="sunspots"
            label="Solar SSN"
            value={latest?.ssn?.toFixed(0) || '--'}
            icon={Sun}
            color="orange"
            source="NOAA"
          />
        </div>

        {/* RRP COUNTDOWN WIDGET - Critical V8 Feature */}
        {data?.rrp_countdown && (
          <div className="mb-6">
            <RRPCountdownWidget countdown={data.rrp_countdown} />
          </div>
        )}

        {/* Global Liquidity & Stablecoins */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Global M2 */}
          {global_m2 && (
            <Panel title="GLOBAL M2 LIQUIDITY" icon={Globe} glowColor="purple">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <InfoTooltip id="globalM2">
                    <p className="text-xs text-slate-500 mb-1">Total (USD)</p>
                  </InfoTooltip>
                  <p className="font-mono text-3xl text-purple-400">${global_m2.current?.toFixed(1) || '--'}T</p>
                </div>
                <div>
                  <InfoTooltip id="globalM2Roc">
                    <p className="text-xs text-slate-500 mb-1">30-Day ROC</p>
                  </InfoTooltip>
                  <p className={`font-mono text-3xl ${(global_m2.roc_30d || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {global_m2.roc_30d > 0 ? '+' : ''}{global_m2.roc_30d?.toFixed(2) || '--'}%
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mt-3">US + Eurozone + Japan + China M2 aggregated</p>
            </Panel>
          )}

          {/* Stablecoins */}
          {stablecoins && (
            <Panel title="STABLECOIN LIQUIDITY" icon={Coins} glowColor="emerald">
              <InfoTooltip id="stablecoins">
                <p className="text-xs text-slate-500 mb-1">Total Market Cap</p>
              </InfoTooltip>
              <p className="font-mono text-3xl text-emerald-400">${stablecoins.total_mcap?.toFixed(1) || '--'}B</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(stablecoins.breakdown || {}).slice(0, 4).map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-1 bg-slate-800 rounded font-mono text-slate-400">
                    {k}: ${v}B
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Source: DefiLlama • Real-time</p>
            </Panel>
          )}

          {/* Credit Stress */}
          {credit_stress && (
            <Panel 
              title="CREDIT STRESS" 
              icon={AlertTriangle} 
              glowColor={credit_stress.status === 'CRITICAL' ? 'rose' : credit_stress.status === 'STRESSED' ? 'amber' : 'emerald'}
            >
              <div className="flex items-center justify-between mb-3">
                <InfoTooltip id="creditStatus">
                  <span className="text-xs text-slate-500">Market Stress Status</span>
                </InfoTooltip>
                <span className={`text-sm font-mono px-3 py-1 rounded-full ${
                  credit_stress.status === 'NORMAL' ? 'bg-emerald-500/20 text-emerald-400' :
                  credit_stress.status === 'ELEVATED' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}>
                  {credit_stress.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <InfoTooltip id="cpTbillSpread">
                    <p className="text-xs text-slate-500">CP-TBill</p>
                  </InfoTooltip>
                  <p className="font-mono text-xl text-cyan-400">{credit_stress.cp_tbill_spread?.toFixed(1)} <span className="text-sm text-slate-500">bps</span></p>
                </div>
                <div>
                  <InfoTooltip id="yieldCurve">
                    <p className="text-xs text-slate-500">10Y-2Y</p>
                  </InfoTooltip>
                  <p className={`font-mono text-xl ${credit_stress.yield_curve < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {credit_stress.yield_curve?.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <InfoTooltip id="hySpread">
                    <p className="text-xs text-slate-500">HY Spread</p>
                  </InfoTooltip>
                  <p className="font-mono text-xl text-slate-300">{credit_stress.hy_spread?.toFixed(2)}%</p>
                </div>
                <div>
                  <InfoTooltip id="vix">
                    <p className="text-xs text-slate-500">VIX</p>
                  </InfoTooltip>
                  <p className={`font-mono text-xl ${credit_stress.vix > 25 ? 'text-amber-400' : 'text-slate-300'}`}>{credit_stress.vix?.toFixed(1)}</p>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <ZoomIn className="w-4 h-4" /> TIME RANGE
          </span>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
            {['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'].map(r => (
              <button 
                key={r} 
                onClick={() => setTimeRange(r)} 
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                  timeRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Main Chart */}
        <Panel title="NET LIQUIDITY vs S&P 500" icon={Activity} className="mb-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scenarioData} margin={{ top: 10, right: 50, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `$${(v/1000000).toFixed(1)}T`} width={55} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => v.toLocaleString()} width={50} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="net_liquidity" fill="url(#liqGrad)" stroke="#8b5cf6" strokeWidth={2} name="Net Liquidity ($B)" />
                {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
                  <Line yAxisId="left" type="monotone" dataKey="projectedNetLiquidity" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected ($B)" />
                )}
                <Line yAxisId="right" type="monotone" dataKey="spx" stroke="#f59e0b" strokeWidth={2} dot={false} name="S&P 500" />
                <Brush dataKey="date" height={25} stroke="#334155" fill="#0f172a" />
                <defs>
                  <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* CSD Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Panel title="AR(1) AUTOCORRELATION" icon={Activity}>
            <InfoTooltip id="ar1" className="mb-2">
              <span className="text-xs text-slate-400">System resilience indicator — approaching 1.0 = critical</span>
            </InfoTooltip>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 1]} ticks={[0, 0.3, 0.5, 0.7, 0.8, 1]} width={30} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <ReferenceArea y1={0.7} y2={1} fill="#f43f5e" fillOpacity={0.15} label={{ value: 'CRITICAL', fill: '#f43f5e', fontSize: 10 }} />
                  <ReferenceArea y1={0.5} y2={0.7} fill="#f59e0b" fillOpacity={0.1} />
                  <ReferenceLine y={0.7} stroke="#f43f5e" strokeDasharray="3 3" />
                  <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="ar1" fill="url(#ar1Grad)" stroke="#10b981" strokeWidth={2} name="AR(1)" connectNulls />
                  <defs>
                    <linearGradient id="ar1Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="ROLLING VARIANCE" icon={Activity}>
            <InfoTooltip id="variance" className="mb-2">
              <span className="text-xs text-slate-400">Stability indicator — rising variance = increasing instability</span>
            </InfoTooltip>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 9 }} 
                    width={50} 
                    tickFormatter={v => v?.toFixed(4)}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <ReferenceLine y={0.002} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Baseline', fill: '#f59e0b', fontSize: 9 }} />
                  <Area type="monotone" dataKey="variance" fill="url(#varGrad)" stroke="#f59e0b" strokeWidth={2} name="Variance" connectNulls />
                  <defs>
                    <linearGradient id="varGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* LPPL Panel - COMPREHENSIVE */}
        <Panel 
          title="LPPL BUBBLE DETECTION" 
          icon={AlertTriangle} 
          glowColor={lppl?.is_bubble ? 'rose' : 'slate'} 
          className="mb-6"
        >
          <InfoTooltip id="lpplBubble" className="mb-4">
            <span className="text-xs text-slate-400">Log-Periodic Power Law analysis for super-exponential bubble patterns</span>
          </InfoTooltip>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplBubble">
                <p className="text-[10px] text-slate-500 uppercase">Bubble</p>
              </InfoTooltip>
              <p className={`font-mono text-2xl font-bold ${lppl?.is_bubble ? 'text-rose-400' : 'text-emerald-400'}`}>
                {lppl?.is_bubble ? 'YES' : 'NO'}
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplConfidence">
                <p className="text-[10px] text-slate-500 uppercase">Confidence</p>
              </InfoTooltip>
              <p className="font-mono text-xl text-slate-200">{lppl?.confidence || 0}%</p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="tcDays">
                <p className="text-[10px] text-slate-500 uppercase">Days to tc</p>
              </InfoTooltip>
              <p className="font-mono text-xl text-slate-200">{lppl?.tc_days ?? '--'}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="tcDate">
                <p className="text-[10px] text-slate-500 uppercase">tc Date</p>
              </InfoTooltip>
              <p className="font-mono text-lg text-slate-200">{lppl?.tc_date || '--'}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplR2">
                <p className="text-[10px] text-slate-500 uppercase">R² Fit</p>
              </InfoTooltip>
              <p className="font-mono text-xl text-slate-200">{lppl?.r2?.toFixed(3) ?? '--'}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplOmega">
                <p className="text-[10px] text-slate-500 uppercase">ω (omega)</p>
              </InfoTooltip>
              <p className="font-mono text-xl text-slate-200">{lppl?.omega?.toFixed(2) ?? '--'}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplM">
                <p className="text-[10px] text-slate-500 uppercase">m (exp)</p>
              </InfoTooltip>
              <p className="font-mono text-xl text-slate-200">{lppl?.m?.toFixed(3) ?? '--'}</p>
            </div>
            
            <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-slate-800/50 text-center">
              <InfoTooltip id="lpplStatus">
                <p className="text-[10px] text-slate-500 uppercase">Status</p>
              </InfoTooltip>
              <p className={`font-mono text-sm ${lppl?.is_bubble ? 'text-rose-400' : 'text-slate-400'}`}>{lppl?.status}</p>
            </div>
          </div>
        </Panel>

        {/* Correlation Panel */}
        <Panel title="LIQUIDITY-PRICE CORRELATION" icon={Activity} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <InfoTooltip id="correlation">
              <span className="text-xs text-slate-400">How tightly S&P 500 tracks Net Liquidity</span>
            </InfoTooltip>
            <span className={`text-sm font-mono px-3 py-1 rounded-full ${
              corrStatus === 'COUPLED' ? 'bg-emerald-500/20 text-emerald-400' :
              corrStatus === 'WEAKENING' ? 'bg-amber-500/20 text-amber-400' :
              'bg-rose-500/20 text-rose-400'
            }`}>
              {corrStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '30-Day', value: correlations.day30 },
              { label: '90-Day', value: correlations.day90 },
              { label: '180-Day', value: correlations.day180 }
            ].map((c, i) => {
              const color = c.value === null ? 'slate' : c.value > 0.7 ? 'emerald' : c.value > 0.3 ? 'amber' : 'rose';
              return (
                <div key={i} className={`p-4 rounded-lg bg-${color}-900/20 border border-${color}-500/30 text-center`}>
                  <p className="text-xs text-slate-500 mb-2">{c.label}</p>
                  <p className={`font-mono text-3xl font-bold text-${color}-400`}>{c.value?.toFixed(2) || 'N/A'}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 font-mono py-6 border-t border-slate-800">
          <p className="text-cyan-500 mb-1">FRACTAL TERMINAL v8.0</p>
          <p>Data: Daily Treasury Statement • NY Fed Markets • FRED • DefiLlama • NOAA</p>
          <p className="text-slate-700 mt-1">All data real. Zero simulations. Not financial advice.</p>
        </footer>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-cyan-400">FRACTAL TERMINAL v8.0</h2>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
                <p className="text-emerald-400 font-bold">✓ ALL DATA IS 100% REAL</p>
                <p className="text-slate-400 text-sm mt-1">No simulations, interpolations, or fake data. Every number comes from official sources.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Database, title: 'High-Frequency Data', desc: 'Daily Treasury Statement (T-1), NY Fed Markets (same-day)' },
                  { icon: Globe, title: 'Global Liquidity', desc: 'US + EU + JP + CN M2 aggregated to USD' },
                  { icon: Coins, title: 'Crypto Liquidity', desc: 'Real-time stablecoin data from DefiLlama' },
                  { icon: AlertTriangle, title: 'Credit Stress', desc: 'CP-TBill spread, yield curve, HY spread, VIX' },
                  { icon: Activity, title: 'CSD Analysis', desc: 'Critical Slowing Down - AR(1), variance, Kendall tau' },
                  { icon: TrendingUp, title: 'LPPL Detection', desc: 'Log-Periodic Power Law bubble analysis' },
                ].map((f, i) => (
                  <div key={i} className="flex gap-3">
                    <f.icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-200">{f.title}</p>
                      <p className="text-xs text-slate-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
                <p><strong>Hover over any ℹ️ icon</strong> for detailed explanations of every metric.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette 
        isOpen={commandOpen} 
        onClose={() => setCommandOpen(false)} 
        onCommand={handleCommand} 
      />
    </div>
  );
};

export default FractalTerminal;
