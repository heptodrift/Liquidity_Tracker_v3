import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine, ReferenceArea, Brush, Bar, Legend, BarChart } from 'recharts';
import { Activity, Sun, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, TrendingUp, ZoomIn, FileText, Clock, Info, Sliders, Download, Calendar, Terminal, Zap, AlertTriangle, TrendingDown, Command, Search, BarChart3, PieChart, Gauge, Radio, Skull, Timer } from 'lucide-react';

/**
 * FRACTAL TERMINAL V5.0
 * =====================
 * Institutional-Grade Liquidity Analysis
 * 
 * Features:
 * - Cyberpunk/Sci-Fi aesthetic with glow effects
 * - Command Palette (Cmd+K)
 * - GEX (Gamma Exposure) visualization
 * - DIX (Dark Pool Index) proxy
 * - Credit Stress indicators (CP-TBill spread)
 * - RRP Countdown to depletion
 * - Complete tooltip coverage for ALL metrics
 * - Rate of Change oscillators
 * - Liquidity Divergence detection
 */

// ============ COMPLETE TOOLTIP EXPLANATIONS ============
const EXPLANATIONS = {
  // === LIQUIDITY COMPONENTS ===
  balanceSheet: {
    title: "Fed Balance Sheet (WALCL)",
    short: "Total assets held by the Federal Reserve",
    detail: "When the Fed buys bonds (QE), this rises and injects liquidity into the financial system. When QT occurs, assets mature without reinvestment and the balance sheet shrinks. Peak was $8.9T in 2022; now ~$6.64T.",
    impact: "↑ Rising = Liquidity injection = Bullish\n↓ Falling = Liquidity drain = Bearish",
    source: "FRED: WALCL (Weekly, Wednesday)"
  },
  tga: {
    title: "Treasury General Account (TGA)",
    short: "The US government's checking account at the Fed",
    detail: "When Treasury collects taxes or sells bonds, cash flows INTO the TGA and OUT of the banking system (drains liquidity). When Treasury spends, cash flows OUT of the TGA and INTO the economy (adds liquidity). Current: ~$781B.",
    impact: "↑ Rising TGA = Liquidity drain = Bearish\n↓ Falling TGA = Liquidity injection = Bullish",
    source: "FRED: WTREGEN / Daily Treasury Statement"
  },
  rrp: {
    title: "Reverse Repo Facility (RRP)",
    short: "Cash parked overnight at the Fed by money market funds",
    detail: "The RRP acts as a 'liquidity sponge.' From 2023-2025, the $2.5T RRP buffer absorbed QT impact. As of Jan 2026, RRP is effectively ZERO (~$2.5B). The buffer is gone. Every future dollar of QT or Treasury issuance now directly drains bank reserves.",
    impact: "⚠️ CRITICAL: RRP exhausted. System now operating without safety buffer. September 2019-style repo crisis risk elevated.",
    source: "NY Fed: RRPONTSYD (Daily, 1:15 PM ET)"
  },
  reserves: {
    title: "Bank Reserves (WRESBAL)",
    short: "Deposits commercial banks hold at the Federal Reserve",
    detail: "These are the actual reserves banks use for lending and settling payments. When reserves fall below ~$3T (10-12% of GDP), funding markets can seize up. The Sept 2019 repo spike occurred when reserves hit scarcity.",
    impact: "Above $3T = Ample reserves = Stable\nBelow $3T = Scarcity risk = Funding stress\nBelow $2.5T = CRITICAL = Crisis imminent",
    source: "FRED: WRESBAL (Weekly)"
  },
  netLiquidity: {
    title: "Net Liquidity",
    short: "Fed Balance Sheet − TGA − RRP",
    detail: "This is THE key metric. It represents money actually circulating in the financial system, not locked in government accounts or parked at the Fed. Net Liquidity has correlated ~0.9 with S&P 500 since 2008. Current: ~$5.86T.",
    impact: "Net Liquidity drives asset prices.\n↑ Rising = Risk-on, buy dips\n↓ Falling = Risk-off, sell rips\nDivergence from price = Regime warning",
    source: "Derived: WALCL - WTREGEN - RRPONTSYD"
  },
  liquidityRoc: {
    title: "Liquidity Rate of Change (ROC)",
    short: "20-day momentum of Net Liquidity",
    detail: "Institutional traders don't trade levels—they trade derivatives. The ROC shows whether liquidity is accelerating or decelerating. A positive ROC means liquidity is being injected faster; negative means it's draining.",
    impact: "ROC > 0 = Accelerating injection = Bullish impulse\nROC < 0 = Decelerating/draining = Bearish\nPrice ↑ + ROC ↓ = DIVERGENCE = High-probability short",
    source: "Derived: 20-day rate of change"
  },

  // === MARKET DATA ===
  spx: {
    title: "S&P 500 Index",
    short: "Benchmark US equity index (500 largest companies)",
    detail: "The primary risk asset for regime detection. When S&P makes new highs but Net Liquidity is flat or falling, this creates a 'Wile E. Coyote' divergence—prices running on sentiment, not fundamentals.",
    impact: "Used for: LPPL bubble detection, CSD analysis, correlation studies, divergence signals",
    source: "FRED: SP500 (Daily)"
  },
  
  // === CRITICAL SLOWING DOWN ===
  ar1: {
    title: "AR(1) — Lag-1 Autocorrelation",
    short: "System resilience indicator",
    detail: "In complex systems approaching tipping points, recovery from perturbations slows down. AR(1) measures how much today's residual resembles yesterday's. As AR(1) → 1.0, the system loses ability to recover from shocks.",
    impact: "< 0.5 = Normal, shocks dissipate quickly\n0.5-0.7 = Caution, recovery slowing\n> 0.7 = CRITICAL, system fragile\n→ 1.0 = Tipping point imminent",
    source: "Scheffer et al. (2009) Nature 461, 53-59"
  },
  variance: {
    title: "Rolling Variance",
    short: "Volatility of price residuals around trend",
    detail: "Another Critical Slowing Down (CSD) indicator. Before phase transitions, systems show increased 'flickering'—larger swings as stability breaks down. Rising variance combined with rising AR(1) is a strong crash warning.",
    impact: "Low & stable = Normal regime\nRising = Increased instability\nSpike + high AR(1) = Phase transition imminent",
    source: "Dakos et al. (2012) PLOS ONE"
  },
  kendallTau: {
    title: "Kendall's Tau (τ)",
    short: "Trend direction of AR(1) over time",
    detail: "Measures whether AR(1) is systematically rising or falling over recent observations. A positive tau means the system is progressively losing resilience. A negative tau suggests recovery.",
    impact: "τ > 0.3 = AR(1) trending up = Concern\nτ ≈ 0 = No clear trend\nτ < -0.3 = AR(1) trending down = Recovery",
    source: "Mann-Kendall trend test"
  },

  // === LPPL BUBBLE DETECTION ===
  lpplBubble: {
    title: "LPPL Bubble Detection",
    short: "Log-Periodic Power Law signature",
    detail: "LPPL detects 'super-exponential' growth with characteristic log-periodic oscillations. This pattern has preceded major crashes: 1929, 1987, 2000, 2008. The model fits: ln(p) = A + B(tc-t)^m + C(tc-t)^m·cos(ω·ln(tc-t))",
    impact: "Bubble Detected = Price matches historical crash signature\nConfidence = Model fit quality (R²)\ntc = Critical time when bubble may resolve",
    source: "Sornette (2003) 'Why Stock Markets Crash'"
  },
  tcDays: {
    title: "Critical Time (tc)",
    short: "Estimated days until regime change",
    detail: "If LPPL detects a bubble, tc estimates when the unsustainable growth pattern reaches its mathematical singularity. This is NOT a crash prediction—it's when the current regime must change (crash OR plateau).",
    impact: "tc < 30 days = Near-term instability window\ntc 30-90 days = Medium-term concern\ntc > 90 days = Longer runway\n⚠️ Wide uncertainty bands",
    source: "Johansen & Sornette (1999)"
  },

  // === CORRELATION ===
  correlation: {
    title: "Liquidity-Price Correlation",
    short: "Is liquidity still driving prices?",
    detail: "Rolling Pearson correlation between Net Liquidity and S&P 500. When this breaks down (goes to zero or negative), prices are disconnected from fundamental liquidity support—the 'Wile E. Coyote' phase.",
    impact: "> 0.7 = COUPLED (liquidity driving price)\n0.3-0.7 = WEAKENING (caution)\n< 0.3 = DECOUPLED (blow-off top risk)",
    source: "Rolling Pearson correlation"
  },

  // === GEX (GAMMA EXPOSURE) ===
  gex: {
    title: "Gamma Exposure (GEX)",
    short: "Net dealer hedging pressure from options",
    detail: "Market makers sell options and hedge by trading the underlying. GEX quantifies this: Positive GEX = dealers suppress volatility (buy dips, sell rips). Negative GEX = dealers amplify volatility (momentum trades).",
    impact: "Positive GEX = Low volatility, mean-reversion\nNegative GEX = High volatility, trend amplification\nGamma Flip Point = Key level where regime changes",
    source: "SqueezeMetrics methodology"
  },
  gammaFlip: {
    title: "Gamma Flip Point",
    short: "Strike where dealer gamma turns negative",
    detail: "The price level where aggregate dealer gamma crosses from positive to negative. Above the flip = dealers dampen moves. Below the flip = dealers accelerate moves. This creates invisible support/resistance.",
    impact: "Spot > Flip = Buy dips (volatility suppressed)\nSpot < Flip = Sell rips (crash risk elevated)",
    source: "GEX profile zero-crossing"
  },

  // === DIX (DARK POOL INDEX) ===
  dix: {
    title: "Dark Pool Index (DIX)",
    short: "Institutional accumulation signal",
    detail: "Measures short volume in dark pools. Counter-intuitively, HIGH short volume = BULLISH because market makers short to fill large institutional BUY orders. It reveals 'smart money' positioning invisible in lit markets.",
    impact: "DIX > 45% = High accumulation = Bullish\nDIX 40-45% = Neutral\nDIX < 40% = Low accumulation = Bearish\nPrice ↓ + DIX ↑ = Institutions buying the dip",
    source: "FINRA TRF Short Volume Data"
  },

  // === CREDIT STRESS ===
  cpSpread: {
    title: "CP-TBill Spread",
    short: "Commercial Paper minus Treasury Bill rate",
    detail: "Post-LIBOR stress indicator. Measures the premium banks/corporations pay for short-term funding vs. risk-free government rate. Replaces the defunct FRA-OIS spread as the 'fear gauge' for credit markets.",
    impact: "< 15 bps = Normal functioning\n15-25 bps = Emerging stress\n> 25 bps = Systemic distress\n> 50 bps = Crisis imminent (2008, 2020 levels)",
    source: "FRED: RIFSPPFAAD90NB - TB3MS"
  },
  termPremium: {
    title: "ACM Term Premium",
    short: "Extra yield demanded for duration risk",
    detail: "Adrian-Crump-Moench 10-Year Term Premium. Rising term premium in high-debt environment creates fiscal dominance feedback loop. Spike + CP spread widening = Risk-off regime confirmed.",
    impact: "Rising = Bond vigilantes demanding compensation\nSpiking = Fiscal sustainability concerns\nWith high debt = Sovereign stress signal",
    source: "FRED: THREEFYTP10"
  },

  // === RRP COUNTDOWN ===
  rrpCountdown: {
    title: "RRP Depletion Countdown",
    short: "Days until liquidity buffer exhausted",
    detail: "Extrapolates current RRP drain rate to estimate when facility hits zero. Once RRP = 0, all QT and Treasury issuance directly drains bank reserves. This triggers the transition from 'Ample Reserves' to 'Scarce Reserves' regime.",
    impact: "⚠️ As of Jan 2026: RRP effectively ZERO\nBuffer exhausted. System operating without safety net.\nNext stress test: Any large Treasury settlement.",
    source: "30-day moving average drain rate"
  },

  // === SCENARIO SIMULATOR ===
  whatIf: {
    title: "What-If Scenario Simulator",
    short: "Model future liquidity changes",
    detail: "Drag sliders to simulate: TGA drawdown/refill, QT acceleration/pause, RRP movements. The dashed line shows projected Net Liquidity under your scenario. Use for risk planning and policy simulation.",
    impact: "TGA +$200B = ~$200B liquidity drain\nQT 0% = Fed pauses balance sheet runoff\nRRP +$500B = Unlikely but would drain $500B",
    source: "Interactive projection"
  },

  // === SOLAR CYCLE ===
  sunspots: {
    title: "Solar Cycle (SSN)",
    short: "Sunspot number / F10.7 flux",
    detail: "Experimental/controversial indicator. Hypothesis: Solar maxima correlate with increased human risk-taking and market volatility (heliobiology). Solar Cycle 25 peaked in 2025-2026. High flux = behavioral variance.",
    impact: "Solar Maximum = Potentially higher volatility\nSolar Minimum = Potentially calmer markets\n⚠️ Speculative indicator—use with caution",
    source: "NOAA SWPC"
  },

  // === REGIME SCORE ===
  regimeScore: {
    title: "Composite Regime Score",
    short: "Overall market fragility (0-100)",
    detail: "Weighted combination of multiple signals:\n• AR(1) critical slowing (35%)\n• Kendall Tau trend (20%)\n• LPPL bubble signal (25%)\n• Net Liquidity level (20%)",
    impact: "0-25 = FAVORABLE (low fragility)\n25-40 = NORMAL\n40-55 = CAUTION\n55-70 = ELEVATED\n70-100 = CRITICAL",
    source: "Composite calculation"
  },

  // === TREASURY AUCTIONS ===
  treasuryAuctions: {
    title: "Treasury Auction Calendar",
    short: "Upcoming bond issuance (liquidity drains)",
    detail: "With RRP at zero, every Treasury auction directly drains bank reserves. Settlement of large coupon auctions (2Y, 5Y, 10Y, 30Y) can cause intraday/intraweek funding stress. The 'Bond Cliff' is now visible.",
    impact: "Large settlement = Temporary liquidity drain\nMultiple settlements = Cumulative stress\nWatch for repo rate spikes on settlement days",
    source: "TreasuryDirect Upcoming Auctions"
  }
};

// ============ ENHANCED TOOLTIP COMPONENT ============
const InfoTooltip = ({ id, children, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const info = EXPLANATIONS[id];
  if (!info) return children;
  
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };
  
  return (
    <div className="relative inline-block">
      <div 
        className="cursor-help inline-flex items-center gap-1 group"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        {children}
        <Info className="w-3 h-3 text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
      </div>
      {show && (
        <div className={`absolute z-[100] ${positionClasses[position]} w-80`}>
          <div className="bg-slate-900/95 border border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/10 p-4 text-left backdrop-blur-sm">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
            
            <h4 className="text-cyan-400 font-bold text-sm mb-1 font-mono">{info.title}</h4>
            <p className="text-slate-300 text-xs mb-2">{info.short}</p>
            <p className="text-slate-400 text-xs mb-3 leading-relaxed">{info.detail}</p>
            <div className="bg-black/30 rounded p-2 mb-2 border border-slate-700/50">
              <p className="text-xs text-amber-300/90 whitespace-pre-wrap font-mono leading-relaxed">{info.impact}</p>
            </div>
            <p className="text-[10px] text-slate-600 font-mono">{info.source}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ CYBERPUNK UI COMPONENTS ============
const GlowingBorder = ({ children, color = 'cyan', className = '' }) => (
  <div className={`relative ${className}`}>
    <div className={`absolute inset-0 bg-${color}-500/10 rounded-xl blur-xl`} />
    <div className={`relative bg-slate-900/80 border border-${color}-500/30 rounded-xl backdrop-blur-sm`}>
      {children}
    </div>
  </div>
);

const ScanLine = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent animate-scan" />
  </div>
);

const CriticalPulse = ({ active }) => (
  active && (
    <div className="absolute inset-0 rounded-xl animate-pulse-glow pointer-events-none">
      <div className="absolute inset-0 bg-rose-500/20 rounded-xl blur-xl" />
    </div>
  )
);

// ============ COMMAND PALETTE ============
const CommandPalette = ({ isOpen, onClose, onCommand }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  
  const commands = [
    { id: 'scenario', label: 'Toggle Scenario Simulator', shortcut: 'S', icon: Sliders },
    { id: 'auctions', label: 'Toggle Treasury Auctions', shortcut: 'A', icon: Calendar },
    { id: 'export', label: 'Export PowerPoint Report', shortcut: 'E', icon: Download },
    { id: '1m', label: 'Set Range: 1 Month', shortcut: '1', icon: Clock },
    { id: '1y', label: 'Set Range: 1 Year', shortcut: 'Y', icon: Clock },
    { id: 'all', label: 'Set Range: All Data', shortcut: '0', icon: Clock },
    { id: 'help', label: 'Show Help', shortcut: '?', icon: HelpCircle },
  ];
  
  const filtered = commands.filter(c => 
    c.label.toLowerCase().includes(query.toLowerCase())
  );
  
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-black/80 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
          <Command className="w-5 h-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none font-mono"
          />
          <kbd className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { onCommand(cmd.id); onClose(false); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-cyan-500/10 text-left transition-colors"
            >
              <cmd.icon className="w-4 h-4 text-cyan-400" />
              <span className="flex-1 text-slate-300">{cmd.label}</span>
              <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500 font-mono">{cmd.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============ RRP COUNTDOWN WIDGET ============
const RRPCountdown = ({ currentRRP }) => {
  // RRP is effectively zero as of Jan 2026
  const isExhausted = currentRRP < 50; // Less than $50B = effectively zero
  
  return (
    <div className={`p-4 rounded-xl border ${isExhausted ? 'bg-rose-950/30 border-rose-500/50' : 'bg-amber-950/30 border-amber-500/50'}`}>
      <div className="flex items-center gap-3">
        {isExhausted ? (
          <Skull className="w-8 h-8 text-rose-400 animate-pulse" />
        ) : (
          <Timer className="w-8 h-8 text-amber-400" />
        )}
        <div className="flex-1">
          <InfoTooltip id="rrpCountdown">
            <h4 className="text-sm font-mono font-bold text-rose-400">RRP BUFFER STATUS</h4>
          </InfoTooltip>
          <p className="text-xs text-slate-400">Liquidity safety net</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-mono font-bold ${isExhausted ? 'text-rose-400' : 'text-amber-400'}`}>
            {isExhausted ? 'EXHAUSTED' : `$${currentRRP?.toFixed(0)}B`}
          </p>
          {isExhausted && (
            <p className="text-xs text-rose-400/80 font-mono">SCARCE RESERVES REGIME</p>
          )}
        </div>
      </div>
      {isExhausted && (
        <div className="mt-3 p-2 bg-rose-900/20 rounded-lg border border-rose-800/50">
          <p className="text-xs text-rose-300">
            ⚠️ The RRP buffer that absorbed QT from 2023-2025 is depleted. Every dollar of new Treasury issuance now directly drains bank reserves. September 2019-style repo stress risk is elevated.
          </p>
        </div>
      )}
    </div>
  );
};

// ============ GEX DISPLAY (Simulated - would need ThetaData API) ============
const GEXDisplay = ({ spotPrice }) => {
  // Simulated GEX data - in production, fetch from ThetaData or similar
  const gexData = useMemo(() => {
    if (!spotPrice) return null;
    const spot = spotPrice;
    const flipPoint = Math.round(spot * 0.98 / 50) * 50; // Simulate flip ~2% below spot
    const netGex = 2.5; // Simulated positive GEX (billions)
    const regime = spot > flipPoint ? 'POSITIVE' : 'NEGATIVE';
    
    return { flipPoint, netGex, regime, spot };
  }, [spotPrice]);
  
  if (!gexData) return null;
  
  const isPositive = gexData.regime === 'POSITIVE';
  
  return (
    <div className={`p-4 rounded-xl border ${isPositive ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <InfoTooltip id="gex">
          <h4 className="text-sm font-mono font-bold text-cyan-400">GAMMA EXPOSURE (GEX)</h4>
        </InfoTooltip>
        <span className={`text-xs font-mono px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {gexData.regime} GAMMA
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Net GEX</p>
          <p className={`font-mono text-lg ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${gexData.netGex.toFixed(1)}B
          </p>
        </div>
        <div>
          <InfoTooltip id="gammaFlip">
            <p className="text-xs text-slate-500 mb-1">Flip Point</p>
          </InfoTooltip>
          <p className="font-mono text-lg text-amber-400">{gexData.flipPoint.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Spot vs Flip</p>
          <p className={`font-mono text-lg ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '↑ ABOVE' : '↓ BELOW'}
          </p>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mt-3">
        {isPositive 
          ? '✓ Dealers suppress volatility. Buy dips, sell rips. Mean-reversion regime.' 
          : '⚠️ Dealers amplify volatility. Momentum trades. Crash risk elevated.'}
      </p>
      <p className="text-[10px] text-slate-600 mt-1 font-mono">* Simulated data - connect ThetaData API for live GEX</p>
    </div>
  );
};

// ============ DIX DISPLAY (Simulated - would need FINRA TRF data) ============
const DIXDisplay = () => {
  // Simulated DIX - in production, calculate from FINRA TRF short volume
  const dixValue = 42.5; // Simulated
  const dixHistory = [40, 41, 43, 42, 44, 43, 42.5];
  
  const getColor = (v) => v > 45 ? 'emerald' : v > 40 ? 'amber' : 'rose';
  const color = getColor(dixValue);
  
  return (
    <div className="p-4 rounded-xl border bg-slate-900/50 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <InfoTooltip id="dix">
          <h4 className="text-sm font-mono font-bold text-cyan-400">DARK POOL INDEX (DIX)</h4>
        </InfoTooltip>
        <span className={`text-xs font-mono px-2 py-1 rounded bg-${color}-500/20 text-${color}-400`}>
          {dixValue > 45 ? 'ACCUMULATION' : dixValue > 40 ? 'NEUTRAL' : 'DISTRIBUTION'}
        </span>
      </div>
      
      <div className="flex items-end gap-2 h-16 mb-2">
        {dixHistory.map((v, i) => (
          <div 
            key={i}
            className={`flex-1 bg-${getColor(v)}-500/50 rounded-t`}
            style={{ height: `${(v - 35) * 5}%` }}
          />
        ))}
      </div>
      
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Institutional Short Volume %</p>
        <p className={`font-mono text-xl font-bold text-${color}-400`}>{dixValue}%</p>
      </div>
      
      <p className="text-xs text-slate-500 mt-2">
        {dixValue > 45 
          ? '✓ High short volume = Market makers filling large BUY orders. Bullish accumulation.' 
          : dixValue > 40
          ? '◐ Neutral positioning. No clear institutional signal.'
          : '⚠️ Low short volume = Institutions not buying. Caution.'}
      </p>
      <p className="text-[10px] text-slate-600 mt-1 font-mono">* Simulated - connect FINRA TRF API for live DIX</p>
    </div>
  );
};

// ============ CREDIT STRESS DISPLAY ============
const CreditStressDisplay = () => {
  // Simulated credit spreads - in production, fetch from FRED
  const cpTbillSpread = 18; // basis points
  const termPremium = 0.35; // percent
  
  const getStressLevel = (spread) => {
    if (spread > 50) return { level: 'CRITICAL', color: 'rose' };
    if (spread > 25) return { level: 'STRESSED', color: 'amber' };
    if (spread > 15) return { level: 'ELEVATED', color: 'yellow' };
    return { level: 'NORMAL', color: 'emerald' };
  };
  
  const stress = getStressLevel(cpTbillSpread);
  
  return (
    <div className={`p-4 rounded-xl border bg-${stress.color}-950/20 border-${stress.color}-500/30`}>
      <div className="flex items-center justify-between mb-3">
        <InfoTooltip id="cpSpread">
          <h4 className="text-sm font-mono font-bold text-cyan-400">CREDIT STRESS</h4>
        </InfoTooltip>
        <span className={`text-xs font-mono px-2 py-1 rounded bg-${stress.color}-500/20 text-${stress.color}-400`}>
          {stress.level}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <InfoTooltip id="cpSpread">
            <p className="text-xs text-slate-500 mb-1">CP-TBill Spread</p>
          </InfoTooltip>
          <p className={`font-mono text-xl font-bold text-${stress.color}-400`}>
            {cpTbillSpread} <span className="text-sm">bps</span>
          </p>
        </div>
        <div>
          <InfoTooltip id="termPremium">
            <p className="text-xs text-slate-500 mb-1">10Y Term Premium</p>
          </InfoTooltip>
          <p className="font-mono text-xl font-bold text-slate-300">
            {termPremium > 0 ? '+' : ''}{termPremium}%
          </p>
        </div>
      </div>
      
      <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500`}
          style={{ width: `${Math.min(100, cpTbillSpread * 2)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>0 bps</span>
        <span>25 bps</span>
        <span>50+ bps</span>
      </div>
      
      <p className="text-[10px] text-slate-600 mt-2 font-mono">* Simulated - connect FRED API for live spreads</p>
    </div>
  );
};

// ============ TREASURY AUCTION DATA ============
const TREASURY_AUCTIONS = [
  { date: '2026-01-07', type: '4-Week Bill', amount: 75 },
  { date: '2026-01-08', type: '8-Week Bill', amount: 70 },
  { date: '2026-01-09', type: '3-Year Note', amount: 58 },
  { date: '2026-01-13', type: '10-Year Note', amount: 39 },
  { date: '2026-01-14', type: '30-Year Bond', amount: 22 },
  { date: '2026-01-21', type: '20-Year Bond', amount: 16 },
  { date: '2026-01-23', type: '2-Year Note', amount: 63 },
  { date: '2026-01-27', type: '5-Year Note', amount: 70 },
];

// ============ CORRELATION CALCULATOR ============
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

// ============ POWERPOINT EXPORT ============
const exportToPowerPoint = async (data, regime, scenarios, correlations) => {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';
  pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  
  // Slide 1: Title
  const s1 = pres.addSlide();
  s1.addText('FRACTAL TERMINAL', { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 44, color: '00D4FF', bold: true });
  s1.addText('Institutional Liquidity Analysis Report', { x: 0.5, y: 2.3, w: 9, h: 0.5, fontSize: 20, color: '888888' });
  s1.addText(`Generated: ${new Date().toLocaleString()}`, { x: 0.5, y: 3.5, w: 9, h: 0.3, fontSize: 12, color: '666666' });
  s1.addText(`Regime: ${regime?.status || 'N/A'} (Score: ${regime?.composite?.toFixed(1) || 0})`, {
    x: 0.5, y: 4, w: 9, h: 0.4, fontSize: 18,
    color: regime?.status === 'CRITICAL' ? 'FF4444' : regime?.status === 'ELEVATED' ? 'FFAA00' : '44FF44'
  });
  
  // Slide 2: Key Metrics
  const s2 = pres.addSlide();
  s2.addText('Key Liquidity Metrics', { x: 0.5, y: 0.3, fontSize: 24, color: '00D4FF', bold: true });
  const latest = data?.latest || {};
  s2.addTable([
    [{ text: 'Metric', options: { bold: true, color: '00D4FF' } }, { text: 'Value', options: { bold: true, color: '00D4FF' } }],
    ['Fed Balance Sheet', `$${(latest.balance_sheet / 1000).toFixed(2)}T`],
    ['Treasury General Account', `$${latest.tga?.toFixed(0)}B`],
    ['Reverse Repo (RRP)', `$${latest.rrp?.toFixed(1)}B ⚠️ EXHAUSTED`],
    ['Net Liquidity', `$${(latest.net_liquidity / 1000).toFixed(2)}T`],
    ['S&P 500', latest.spx?.toLocaleString()],
    ['90-Day Correlation', correlations?.day90?.toFixed(2) || 'N/A'],
  ], { x: 0.5, y: 1, w: 9, colW: [4.5, 4.5], fontSize: 14, color: 'FFFFFF', fill: { color: '1a1a2e' }, border: { color: '334155' } });
  
  // Slide 3: Risk Signals
  const s3 = pres.addSlide();
  s3.addText('Risk Signals', { x: 0.5, y: 0.3, fontSize: 24, color: '00D4FF', bold: true });
  s3.addTable([
    [{ text: 'Signal', options: { bold: true } }, { text: 'Value', options: { bold: true } }, { text: 'Status', options: { bold: true } }],
    ['AR(1) Autocorrelation', data?.csd?.current_ar1?.toFixed(3) || '--', data?.csd?.current_ar1 > 0.7 ? '⚠️ CRITICAL' : '✓ Normal'],
    ['LPPL Bubble', data?.lppl?.is_bubble ? 'YES' : 'NO', data?.lppl?.is_bubble ? '⚠️ DETECTED' : '✓ None'],
    ['RRP Buffer', `$${latest.rrp?.toFixed(1)}B`, '⚠️ EXHAUSTED'],
    ['Liq-Price Correlation', correlations?.day90?.toFixed(2) || '--', correlations?.day90 < 0.3 ? '⚠️ DECOUPLED' : '✓ Coupled'],
  ], { x: 0.5, y: 1, w: 9, fontSize: 14, color: 'FFFFFF', fill: { color: '1a1a2e' } });
  
  pres.writeFile({ fileName: `FractalTerminal_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ============ MAIN COMPONENT ============
const FractalTerminal = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  
  // UI State
  const [showScenario, setShowScenario] = useState(false);
  const [showAuctions, setShowAuctions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  
  // Scenario sliders
  const [scenarios, setScenarios] = useState({ tgaDelta: 0, qtPace: 100, rrpDelta: 0 });

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

  // Filter by time range
  const filteredData = useMemo(() => {
    if (!data?.timeseries?.length) return [];
    const ts = data.timeseries;
    const lastDate = new Date(ts[ts.length - 1]?.date);
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825, 'ALL': 99999 };
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - (daysMap[timeRange] || 365));
    return ts.filter(d => d.date >= cutoff.toISOString().split('T')[0]);
  }, [data, timeRange]);

  // Apply scenarios
  const scenarioData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      projectedNetLiquidity: d.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta
    }));
  }, [filteredData, scenarios]);

  // Calculate correlations
  const correlations = useMemo(() => {
    if (!filteredData.length) return { day30: null, day90: null, day180: null };
    const calc = (days) => {
      const recent = filteredData.slice(-days);
      if (recent.length < days * 0.8) return null;
      const liq = recent.map(d => d.net_liquidity).filter(v => v != null);
      const spx = recent.map(d => d.spx).filter(v => v != null);
      if (liq.length !== spx.length) return null;
      return calculateCorrelation(liq, spx);
    };
    return { day30: calc(30), day90: calc(90), day180: calc(180) };
  }, [filteredData]);

  // Command handler
  const handleCommand = (cmd) => {
    switch (cmd) {
      case 'scenario': setShowScenario(s => !s); break;
      case 'auctions': setShowAuctions(s => !s); break;
      case 'export': exportToPowerPoint(data, data?.regime, scenarios, correlations); break;
      case '1m': setTimeRange('1M'); break;
      case '1y': setTimeRange('1Y'); break;
      case 'all': setTimeRange('ALL'); break;
      case 'help': setShowHelp(true); break;
    }
  };

  const getRegimeStyle = (status) => ({
    CRITICAL: { glow: 'shadow-rose-500/30', border: 'border-rose-500/50', text: 'text-rose-400', bg: 'from-rose-950/50' },
    ELEVATED: { glow: 'shadow-amber-500/30', border: 'border-amber-500/50', text: 'text-amber-400', bg: 'from-amber-950/50' },
    CAUTION: { glow: 'shadow-yellow-500/30', border: 'border-yellow-500/50', text: 'text-yellow-400', bg: 'from-yellow-950/50' },
    NORMAL: { glow: 'shadow-emerald-500/30', border: 'border-emerald-500/50', text: 'text-emerald-400', bg: 'from-emerald-950/50' },
    FAVORABLE: { glow: 'shadow-cyan-500/30', border: 'border-cyan-500/50', text: 'text-cyan-400', bg: 'from-cyan-950/50' },
  }[status] || { glow: '', border: 'border-slate-700', text: 'text-slate-400', bg: 'from-slate-950/50' });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-lg p-3 shadow-xl backdrop-blur">
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

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
            <div className="absolute inset-4 border border-cyan-400/50 rounded-full animate-pulse" />
            <Terminal className="absolute inset-0 m-auto w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-cyan-400 font-mono text-lg tracking-wider">INITIALIZING FRACTAL TERMINAL</p>
          <p className="text-slate-600 font-mono text-xs mt-2">Loading institutional data feeds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-rose-950/30 border border-rose-500/50 rounded-xl p-8 max-w-lg text-center">
          <AlertCircle className="w-16 h-16 text-rose-400 mx-auto mb-4" />
          <h2 className="text-rose-400 font-mono text-xl mb-2">SYSTEM ERROR</h2>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-300 font-mono">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const { regime, csd, lppl, latest, meta, execution_log } = data;
  const regimeStyle = getRegimeStyle(regime?.status);
  const correlationStatus = correlations.day90 > 0.7 ? 'COUPLED' : correlations.day90 > 0.3 ? 'WEAKENING' : 'DECOUPLED';

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-black to-black" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={showCommand} onClose={setShowCommand} onCommand={handleCommand} />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/30 rounded-xl blur-xl" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border border-cyan-400/50">
                <Terminal className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono tracking-wide">FRACTAL TERMINAL</h1>
              <p className="text-xs text-cyan-500/70 font-mono">v5.0 • Institutional Liquidity Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCommand(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 transition-colors">
              <Command className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">Cmd+K</span>
            </button>
            <button onClick={() => exportToPowerPoint(data, regime, scenarios, correlations)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-500/30 hover:border-purple-400/50 text-purple-300 transition-colors">
              <Download className="w-4 h-4" />
              <span className="text-xs font-mono hidden sm:inline">EXPORT</span>
            </button>
            <button onClick={() => setShowScenario(!showScenario)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showScenario ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
              <Sliders className="w-4 h-4" />
              <span className="text-xs font-mono hidden sm:inline">SCENARIO</span>
            </button>
            <button onClick={() => setShowAuctions(!showAuctions)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showAuctions ? 'bg-amber-900/30 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-mono hidden sm:inline">AUCTIONS</span>
            </button>
          </div>
        </header>

        {/* Timestamp */}
        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {meta?.generated_at ? new Date(meta.generated_at).toLocaleString() : '--'}</span>
          <span>•</span>
          <span>{data?.record_count} records</span>
          <span>•</span>
          <span>{data?.date_range?.start} → {data?.date_range?.end}</span>
        </div>

        {/* Scenario Panel */}
        {showScenario && (
          <div className="mb-6 p-5 rounded-xl bg-slate-900/70 border border-cyan-500/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <InfoTooltip id="whatIf">
                <h3 className="text-sm font-mono font-bold text-cyan-400">WHAT-IF SCENARIO SIMULATOR</h3>
              </InfoTooltip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'tgaDelta', label: 'TGA Change', min: -500, max: 500, unit: 'B', tip: 'Treasury spending (−) or issuance (+)' },
                { key: 'qtPace', label: 'QT Pace', min: 0, max: 200, unit: '%', tip: '0% = pause, 100% = current, 200% = accelerate' },
                { key: 'rrpDelta', label: 'RRP Change', min: -50, max: 500, unit: 'B', tip: 'Unlikely but models possible refill' },
              ].map(s => (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">{s.label}</span>
                    <span className={`font-mono ${scenarios[s.key] > (s.key === 'qtPace' ? 100 : 0) ? 'text-rose-400' : scenarios[s.key] < (s.key === 'qtPace' ? 100 : 0) ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {s.key === 'qtPace' ? '' : scenarios[s.key] >= 0 ? '+' : ''}{scenarios[s.key]}{s.unit}
                    </span>
                  </div>
                  <input type="range" min={s.min} max={s.max} value={scenarios[s.key]} onChange={e => setScenarios(prev => ({ ...prev, [s.key]: parseInt(e.target.value) }))} className="w-full accent-cyan-500" />
                  <p className="text-[10px] text-slate-600 mt-1">{s.tip}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-black/30 flex items-center justify-between border border-slate-800">
              <span className="text-sm text-slate-400">Projected Net Liquidity:</span>
              <span className="font-mono text-xl text-cyan-400">${((latest?.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta) / 1000).toFixed(2)}T</span>
            </div>
          </div>
        )}

        {/* Regime Banner */}
        <div className={`mb-6 p-5 rounded-xl border shadow-lg ${regimeStyle.border} ${regimeStyle.glow} bg-gradient-to-r ${regimeStyle.bg} to-slate-900/80 backdrop-blur relative overflow-hidden`}>
          <ScanLine />
          <CriticalPulse active={regime?.status === 'CRITICAL'} />
          
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <InfoTooltip id="regimeScore">
                <div className={`text-5xl font-bold font-mono ${regimeStyle.text}`}>
                  {regime?.composite?.toFixed(0) || '--'}
                </div>
              </InfoTooltip>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${regimeStyle.text}`}>{regime?.status || 'LOADING'}</span>
                  <span className="text-slate-500">•</span>
                  <span className={`font-mono ${regimeStyle.text}`}>{regime?.signal || '--'}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Composite Fragility Index (0-100)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { id: 'ar1', label: 'AR(1)', value: csd?.current_ar1?.toFixed(3), warn: csd?.current_ar1 > 0.7 },
                { id: 'kendallTau', label: 'τ Trend', value: csd?.kendall_tau?.toFixed(3), warn: csd?.kendall_tau > 0.3 },
                { id: 'lpplBubble', label: 'LPPL', value: lppl?.is_bubble ? `${lppl.confidence}%` : lppl?.r2 ? `R²=${lppl.r2}` : '--', warn: lppl?.is_bubble },
                { id: 'netLiquidity', label: 'Net Liq', value: `$${((latest?.net_liquidity || 0) / 1000).toFixed(2)}T` },
                { id: 'correlation', label: 'Corr 90d', value: correlations.day90?.toFixed(2) || '--', warn: correlations.day90 < 0.3 },
                { id: 'rrp', label: 'RRP', value: `$${(latest?.rrp || 0).toFixed(1)}B`, warn: true },
              ].map(m => (
                <div key={m.id} className="text-center">
                  <InfoTooltip id={m.id}>
                    <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                  </InfoTooltip>
                  <p className={`font-mono text-sm ${m.warn ? 'text-rose-400' : 'text-slate-300'}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RRP Countdown */}
        <div className="mb-6">
          <RRPCountdown currentRRP={latest?.rrp} />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* GEX */}
          <GEXDisplay spotPrice={latest?.spx} />
          
          {/* DIX */}
          <DIXDisplay />
          
          {/* Credit Stress */}
          <CreditStressDisplay />
        </div>

        {/* Correlation Panel */}
        <div className="mb-6 p-5 rounded-xl bg-slate-900/50 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <InfoTooltip id="correlation">
              <h3 className="text-sm font-mono font-bold text-cyan-400">LIQUIDITY-PRICE CORRELATION</h3>
            </InfoTooltip>
            <span className={`text-xs font-mono px-3 py-1 rounded ${correlationStatus === 'COUPLED' ? 'bg-emerald-500/20 text-emerald-400' : correlationStatus === 'WEAKENING' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {correlationStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: '30-Day', value: correlations.day30 }, { label: '90-Day', value: correlations.day90 }, { label: '180-Day', value: correlations.day180 }].map((c, i) => {
              const color = c.value === null ? 'slate' : c.value > 0.7 ? 'emerald' : c.value > 0.3 ? 'amber' : 'rose';
              return (
                <div key={i} className={`p-4 rounded-lg bg-${color}-900/20 border border-${color}-500/30 text-center`}>
                  <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                  <p className={`font-mono text-2xl font-bold text-${color}-400`}>{c.value?.toFixed(2) || 'N/A'}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {correlationStatus === 'DECOUPLED' ? '⚠️ ALERT: Prices disconnected from liquidity. Possible blow-off top. Extreme caution warranted.' : correlationStatus === 'WEAKENING' ? '⚡ Correlation weakening. Monitor for regime change.' : '✓ Liquidity and prices moving together normally.'}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { id: 'balanceSheet', label: 'Fed BS', value: `$${((latest?.balance_sheet || 0) / 1000).toFixed(2)}T`, icon: Database, color: 'blue' },
            { id: 'tga', label: 'TGA', value: `$${(latest?.tga || 0).toFixed(0)}B`, icon: DollarSign, color: 'emerald' },
            { id: 'rrp', label: 'RRP', value: `$${(latest?.rrp || 0).toFixed(1)}B`, icon: Layers, color: 'rose', alert: true },
            { id: 'reserves', label: 'Reserves', value: latest?.reserves ? `$${(latest.reserves / 1000).toFixed(2)}T` : '--', icon: Shield, color: 'cyan' },
            { id: 'spx', label: 'S&P 500', value: latest?.spx?.toLocaleString() || '--', icon: TrendingUp, color: 'amber' },
            { id: 'sunspots', label: 'Sunspots', value: latest?.ssn?.toString() || '--', icon: Sun, color: 'orange' },
          ].map(m => (
            <div key={m.id} className={`p-3 rounded-xl bg-slate-900/50 border ${m.alert ? 'border-rose-500/50' : 'border-slate-800'} hover:border-${m.color}-500/30 transition-colors`}>
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 text-${m.color}-400`} />
                <InfoTooltip id={m.id}>
                  <span className="text-xs text-slate-500">{m.label}</span>
                </InfoTooltip>
              </div>
              <p className="font-mono text-lg font-medium">{m.value}</p>
              {m.alert && <p className="text-[9px] text-rose-400 mt-1">EXHAUSTED</p>}
            </div>
          ))}
        </div>

        {/* Time Range */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">TIME RANGE</span>
          </div>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
            {['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'].map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-xs font-mono rounded ${timeRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Main Chart */}
        <div className="mb-6 p-5 rounded-xl bg-slate-900/50 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono font-bold text-cyan-400">NET LIQUIDITY vs S&P 500</h3>
            {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
              <span className="text-xs font-mono px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded border border-cyan-500/30">SCENARIO ACTIVE</span>
            )}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scenarioData} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => (v/1000).toFixed(1)+'T'} width={40} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => (v/1000).toFixed(1)+'k'} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="net_liquidity" fill="url(#liqGrad)" stroke="#8b5cf6" strokeWidth={2} name="Net Liquidity ($B)" />
                {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
                  <Line yAxisId="left" type="monotone" dataKey="projectedNetLiquidity" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected ($B)" />
                )}
                <Line yAxisId="right" type="monotone" dataKey="spx" stroke="#f59e0b" strokeWidth={2} dot={false} name="S&P 500" />
                <Brush dataKey="date" height={20} stroke="#334155" fill="#0f172a" />
                <defs>
                  <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Treasury Auctions */}
        {showAuctions && (
          <div className="mb-6 p-5 rounded-xl bg-amber-950/20 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-5 h-5 text-amber-400" />
              <InfoTooltip id="treasuryAuctions">
                <h3 className="text-sm font-mono font-bold text-amber-400">TREASURY AUCTION CALENDAR</h3>
              </InfoTooltip>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Security</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-right py-2 px-3">Liquidity Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {TREASURY_AUCTIONS.map((a, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-mono">{a.date}</td>
                      <td className="py-2 px-3">{a.type}</td>
                      <td className="py-2 px-3 text-right font-mono">${a.amount}B</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-400">-${a.amount}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-400/70 mt-3">⚠️ With RRP at zero, each auction directly drains bank reserves. Watch for repo rate spikes on settlement days.</p>
          </div>
        )}

        {/* CSD Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* AR(1) */}
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-700">
            <InfoTooltip id="ar1">
              <h3 className="text-sm font-mono font-bold text-cyan-400 mb-4">CRITICAL SLOWING DOWN • AR(1)</h3>
            </InfoTooltip>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 1]} ticks={[0, 0.3, 0.5, 0.7, 1]} width={25} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceArea y1={0.7} y2={1} fill="#f43f5e" fillOpacity={0.1} />
                  <ReferenceLine y={0.7} stroke="#f43f5e" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="ar1" fill="url(#ar1Grad)" stroke="#10b981" strokeWidth={2} name="AR(1)" connectNulls />
                  <defs>
                    <linearGradient id="ar1Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Variance */}
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-700">
            <InfoTooltip id="variance">
              <h3 className="text-sm font-mono font-bold text-cyan-400 mb-4">ROLLING VARIANCE</h3>
            </InfoTooltip>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="variance" fill="url(#varGrad)" stroke="#f59e0b" strokeWidth={2} name="Variance" connectNulls />
                  <defs>
                    <linearGradient id="varGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* LPPL Panel */}
        <div className="mb-6 p-5 rounded-xl bg-slate-900/50 border border-slate-700">
          <InfoTooltip id="lpplBubble">
            <h3 className="text-sm font-mono font-bold text-cyan-400 mb-4">LPPL BUBBLE DETECTION</h3>
          </InfoTooltip>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            {[
              { label: 'Bubble Detected', value: lppl?.is_bubble ? 'YES' : 'NO', warn: lppl?.is_bubble },
              { label: 'Confidence', value: `${lppl?.confidence || 0}%` },
              { id: 'tcDays', label: 'Days to tc', value: lppl?.tc_days ?? '--' },
              { label: 'tc Date', value: lppl?.tc_date || '--' },
              { label: 'R²', value: lppl?.r2 ?? '--' },
              { label: 'ω (freq)', value: lppl?.omega ?? '--' },
            ].map((m, i) => (
              <div key={i}>
                {m.id ? (
                  <InfoTooltip id={m.id}><p className="text-xs text-slate-500 mb-1">{m.label}</p></InfoTooltip>
                ) : (
                  <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                )}
                <p className={`font-mono font-semibold ${m.warn ? 'text-rose-400' : 'text-slate-300'}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">{lppl?.status}</p>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 font-mono space-y-1 py-6 border-t border-slate-800">
          <p>FRACTAL TERMINAL v5.0 • Institutional Liquidity Analysis</p>
          <p>Data: FRED, NOAA SWPC • Methods: Dakos et al. (2012), Sornette (2003), SqueezeMetrics</p>
          <p className="text-slate-700">Not financial advice. All data for educational purposes only.</p>
        </footer>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold font-mono text-cyan-400">FRACTAL TERMINAL v5.0</h2>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {[
                { icon: Terminal, title: 'Command Palette', desc: 'Press Cmd+K to open. Navigate with keyboard.' },
                { icon: Sliders, title: 'Scenario Simulator', desc: 'Model TGA, QT, and RRP changes in real-time.' },
                { icon: Zap, title: 'GEX Analysis', desc: 'Gamma exposure shows dealer hedging pressure.' },
                { icon: BarChart3, title: 'DIX Tracking', desc: 'Dark pool short volume reveals institutional accumulation.' },
                { icon: AlertTriangle, title: 'Credit Stress', desc: 'CP-TBill spread replaces deprecated FRA-OIS.' },
                { icon: Skull, title: 'RRP Countdown', desc: 'Buffer exhausted. Scarce reserves regime active.' },
                { icon: Calendar, title: 'Treasury Calendar', desc: 'Auction settlements drain reserves directly.' },
                { icon: Download, title: 'PPTX Export', desc: 'One-click institutional reports for ALCO meetings.' },
              ].map((f, i) => (
                <div key={i} className="flex gap-3">
                  <f.icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-200">{f.title}</h4>
                    <p className="text-slate-400 text-xs">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowAudit(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-mono">EXECUTION LOG</h2>
              <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {(execution_log || []).map((e, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-lg text-xs font-mono">
                  <div className="flex justify-between mb-1">
                    <span className={e.level === 'ERROR' ? 'text-rose-400' : e.level === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}>{e.level}</span>
                    <span className="text-slate-500">{e.time}</span>
                  </div>
                  <p className="text-slate-300">{e.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-scan { animation: scan 4s linear infinite; }
        
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default FractalTerminal;
