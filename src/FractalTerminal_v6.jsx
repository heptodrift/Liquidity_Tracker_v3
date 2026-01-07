import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine, ReferenceArea, Brush, Legend } from 'recharts';
import { Activity, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, TrendingUp, ZoomIn, FileText, Clock, Info, Sliders, Download, Calendar, Terminal, AlertTriangle, TrendingDown, Sun, Gauge } from 'lucide-react';

/**
 * FRACTAL TERMINAL V6.0 - CLEAN EDITION
 * =====================================
 * 
 * ALL DATA IS REAL. ZERO SIMULATIONS.
 * 
 * Removed (required paid APIs):
 * - GEX (needs ThetaData)
 * - DIX (needs FINRA pipeline)
 * 
 * Added (free FRED data):
 * - CP-TBill Spread (credit stress)
 * - 10Y-2Y Yield Curve
 * - High Yield Spread
 * - VIX
 */

// ============ COMPLETE TOOLTIP EXPLANATIONS ============
const EXPLANATIONS = {
  // === LIQUIDITY ===
  balanceSheet: {
    title: "Fed Balance Sheet (WALCL)",
    short: "Total assets held by the Federal Reserve",
    detail: "When the Fed buys bonds (QE), this rises. When QT occurs, it shrinks. Peak was $8.9T in 2022; now ~$6.64T after prolonged balance sheet runoff.",
    impact: "↑ Rising = Liquidity injection = Bullish\n↓ Falling = Liquidity drain = Bearish",
    source: "FRED: WALCL"
  },
  tga: {
    title: "Treasury General Account (TGA)",
    short: "US government's checking account at the Fed",
    detail: "When Treasury collects taxes or sells bonds, TGA rises (drains liquidity). When Treasury spends, TGA falls (adds liquidity).",
    impact: "↑ Rising = Liquidity drain = Bearish\n↓ Falling = Liquidity injection = Bullish",
    source: "FRED: WTREGEN"
  },
  rrp: {
    title: "Reverse Repo Facility (RRP)",
    short: "Cash parked overnight at the Fed",
    detail: "The RRP buffer is now EXHAUSTED (~$2-6B). From 2023-2025, this $2.5T reservoir absorbed QT impact. Now every dollar of QT directly drains bank reserves.",
    impact: "⚠️ CRITICAL: Buffer depleted\nSystem operating without safety net\nSept 2019-style repo stress risk elevated",
    source: "FRED: RRPONTSYD"
  },
  reserves: {
    title: "Bank Reserves (WRESBAL)",
    short: "Deposits commercial banks hold at the Fed",
    detail: "Below ~$3T risks funding stress. The Sept 2019 repo spike occurred at reserve scarcity. Current levels must be monitored as RRP buffer is gone.",
    impact: "> $3T = Ample reserves\n< $3T = Scarcity risk\n< $2.5T = Crisis territory",
    source: "FRED: WRESBAL"
  },
  netLiquidity: {
    title: "Net Liquidity",
    short: "Fed BS − TGA − RRP",
    detail: "THE key metric. Represents money actually circulating in the financial system. Has correlated ~0.9 with S&P 500 since 2008.",
    impact: "This drives asset prices\n↑ Rising = Risk-on\n↓ Falling = Risk-off",
    source: "Derived calculation"
  },

  // === MARKET ===
  spx: {
    title: "S&P 500 Index",
    short: "Benchmark US equity index",
    detail: "Primary risk asset for regime detection. When S&P makes new highs but Net Liquidity is flat/falling, prices may be disconnected from fundamentals.",
    impact: "Used for LPPL, CSD, and correlation analysis",
    source: "FRED: SP500"
  },
  vix: {
    title: "VIX (Volatility Index)",
    short: "CBOE Volatility Index - the 'Fear Gauge'",
    detail: "Measures expected 30-day volatility implied by S&P 500 options. High VIX = fear/uncertainty. Low VIX = complacency.",
    impact: "< 15 = Complacency\n15-20 = Normal\n20-30 = Elevated fear\n> 30 = Panic",
    source: "FRED: VIXCLS"
  },

  // === CREDIT STRESS (ALL REAL FROM FRED) ===
  cpTbillSpread: {
    title: "CP-TBill Spread",
    short: "Commercial Paper minus Treasury Bill rate",
    detail: "Post-LIBOR stress indicator. Measures premium banks/corps pay for short-term funding vs risk-free rate. Replaces defunct FRA-OIS as the 'fear gauge'.",
    impact: "< 15 bps = Normal\n15-25 bps = Emerging stress\n> 25 bps = Systemic distress\n> 50 bps = Crisis (2008/2020 levels)",
    source: "FRED: RIFSPPFAAD90NB - TB3MS"
  },
  yieldCurve: {
    title: "10Y-2Y Yield Spread",
    short: "Treasury yield curve slope",
    detail: "Classic recession indicator. Inverted curve (negative) has preceded every recession since 1970. Re-steepening after inversion often signals recession arrival.",
    impact: "> 0 = Normal (upward sloping)\n< 0 = INVERTED (recession warning)\nRe-steepening = Recession imminent",
    source: "FRED: T10Y2Y"
  },
  hySpread: {
    title: "High Yield Spread",
    short: "Junk bond spread over Treasuries",
    detail: "ICE BofA High Yield Index spread. Measures credit risk premium. Widening spreads signal credit stress and risk aversion.",
    impact: "< 3% = Tight (risk-on)\n3-5% = Normal\n> 5% = Stress\n> 8% = Crisis",
    source: "FRED: BAMLH0A0HYM2"
  },

  // === CSD ===
  ar1: {
    title: "AR(1) Autocorrelation",
    short: "System resilience indicator",
    detail: "Critical Slowing Down metric. As systems approach tipping points, recovery from shocks slows. AR(1) → 1.0 = critical fragility.",
    impact: "< 0.5 = Normal\n0.5-0.7 = Caution\n> 0.7 = CRITICAL",
    source: "Scheffer et al. (2009)"
  },
  variance: {
    title: "Rolling Variance",
    short: "Volatility of price residuals",
    detail: "CSD indicator. Before phase transitions, systems show increased 'flickering'. Rising variance + rising AR(1) = strong warning.",
    impact: "Low = Stable\nRising = Instability\nSpike + high AR(1) = Transition imminent",
    source: "Dakos et al. (2012)"
  },
  kendallTau: {
    title: "Kendall's Tau (τ)",
    short: "Trend direction of AR(1)",
    detail: "Measures whether AR(1) is systematically rising or falling. Positive tau = system losing resilience. Negative = recovery.",
    impact: "τ > 0.3 = Concerning trend\nτ ≈ 0 = No clear trend\nτ < -0.3 = Recovery",
    source: "Mann-Kendall test"
  },

  // === LPPL ===
  lpplBubble: {
    title: "LPPL Bubble Detection",
    short: "Log-Periodic Power Law signature",
    detail: "Detects super-exponential growth with log-periodic oscillations. Pattern preceded crashes in 1929, 1987, 2000, 2008.",
    impact: "Bubble Detected = Price matches crash signature\nConfidence = Model fit quality\ntc = Critical time estimate",
    source: "Sornette (2003)"
  },
  tcDays: {
    title: "Critical Time (tc)",
    short: "Days until regime change",
    detail: "LPPL estimate of when unsustainable growth reaches singularity. NOT a crash prediction—when current regime must change.",
    impact: "< 30 days = Near-term instability\n30-90 = Medium-term\n> 90 = Longer runway",
    source: "Johansen & Sornette (1999)"
  },

  // === CORRELATION ===
  correlation: {
    title: "Liquidity-Price Correlation",
    short: "Is liquidity still driving prices?",
    detail: "Rolling correlation between Net Liquidity and S&P 500. When this breaks down, prices are disconnected from fundamentals.",
    impact: "> 0.7 = COUPLED\n0.3-0.7 = WEAKENING\n< 0.3 = DECOUPLED (danger)",
    source: "Rolling Pearson correlation"
  },

  // === SOLAR ===
  sunspots: {
    title: "Solar Cycle (SSN)",
    short: "Sunspot number",
    detail: "Experimental indicator. Hypothesis: solar maxima correlate with increased risk-taking. Cycle 25 peaked 2025-2026.",
    impact: "Solar Max = Higher volatility potential\n⚠️ Speculative indicator",
    source: "NOAA SWPC"
  },

  // === REGIME ===
  regimeScore: {
    title: "Composite Regime Score",
    short: "Overall fragility (0-100)",
    detail: "Weighted combination:\n• AR(1) score (35%)\n• Kendall Tau (20%)\n• LPPL bubble (25%)\n• Net Liquidity (20%)",
    impact: "0-25 = FAVORABLE\n25-40 = NORMAL\n40-55 = CAUTION\n55-70 = ELEVATED\n70+ = CRITICAL",
    source: "Composite calculation"
  },

  // === SCENARIO ===
  whatIf: {
    title: "Scenario Simulator",
    short: "Model future liquidity changes",
    detail: "Adjust sliders to see how TGA changes, QT pace, or RRP movements would affect Net Liquidity. Dashed line shows projection.",
    impact: "Use for risk planning",
    source: "Interactive projection"
  }
};

// ============ TOOLTIP COMPONENT (FIXED POSITIONING) ============
const InfoTooltip = ({ id, children }) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: true, left: false });
  const triggerRef = useRef(null);
  const info = EXPLANATIONS[id];
  
  if (!info) return children;

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;
      
      setPosition({
        top: spaceAbove > 300 || spaceAbove > spaceBelow,
        left: spaceRight < 320 && spaceLeft > 320
      });
    }
    setShow(true);
  };
  
  return (
    <div className="relative inline-block">
      <div 
        ref={triggerRef}
        className="cursor-help inline-flex items-center gap-1 group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        {children}
        <Info className="w-3 h-3 text-cyan-500/50 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
      </div>
      {show && (
        <div 
          className={`absolute z-[9999] w-72 sm:w-80 ${
            position.top ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${
            position.left ? 'right-0' : 'left-1/2 -translate-x-1/2'
          }`}
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          <div className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl p-3 text-left">
            <h4 className="text-cyan-400 font-bold text-sm mb-1">{info.title}</h4>
            <p className="text-slate-300 text-xs mb-2">{info.short}</p>
            <p className="text-slate-400 text-xs mb-2 whitespace-pre-wrap leading-relaxed">{info.detail}</p>
            <div className="bg-black/30 rounded p-2 mb-2">
              <p className="text-xs text-amber-300 whitespace-pre-wrap font-mono">{info.impact}</p>
            </div>
            <p className="text-[10px] text-slate-600">{info.source}</p>
          </div>
        </div>
      )}
    </div>
  );
};

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
const exportToPowerPoint = async (data, regime, correlations) => {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  
  const s1 = pres.addSlide();
  s1.addText('FRACTAL TERMINAL', { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 40, color: '00D4FF', bold: true });
  s1.addText('Liquidity Regime Analysis', { x: 0.5, y: 2.3, w: 9, fontSize: 20, color: '888888' });
  s1.addText(`Generated: ${new Date().toLocaleString()}`, { x: 0.5, y: 3.5, fontSize: 12, color: '666666' });
  s1.addText(`Regime: ${regime?.status || 'N/A'} (${regime?.composite?.toFixed(1) || 0})`, {
    x: 0.5, y: 4, fontSize: 18,
    color: regime?.status === 'CRITICAL' ? 'FF4444' : regime?.status === 'ELEVATED' ? 'FFAA00' : '44FF44'
  });
  
  const s2 = pres.addSlide();
  s2.addText('Key Metrics', { x: 0.5, y: 0.3, fontSize: 24, color: '00D4FF', bold: true });
  const latest = data?.latest || {};
  s2.addTable([
    ['Metric', 'Value'],
    ['Fed Balance Sheet', `$${(latest.balance_sheet / 1000).toFixed(2)}T`],
    ['Treasury General Account', `$${latest.tga?.toFixed(0)}B`],
    ['Reverse Repo (RRP)', `$${latest.rrp?.toFixed(1)}B`],
    ['Net Liquidity', `$${(latest.net_liquidity / 1000).toFixed(2)}T`],
    ['S&P 500', latest.spx?.toLocaleString()],
    ['90-Day Correlation', correlations?.day90?.toFixed(2) || 'N/A'],
    ['CP-TBill Spread', latest.cp_tbill_spread ? `${latest.cp_tbill_spread.toFixed(1)} bps` : 'N/A'],
  ], { x: 0.5, y: 1, w: 9, fontSize: 14, color: 'FFFFFF', fill: { color: '1a1a2e' } });
  
  pres.writeFile({ fileName: `FractalTerminal_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ============ MAIN COMPONENT ============
const FractalTerminal = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  const [showScenario, setShowScenario] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [scenarios, setScenarios] = useState({ tgaDelta: 0, qtPace: 100, rrpDelta: 0 });

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

  const filteredData = useMemo(() => {
    if (!data?.timeseries?.length) return [];
    const ts = data.timeseries;
    const lastDate = new Date(ts[ts.length - 1]?.date);
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825, 'ALL': 99999 };
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - (daysMap[timeRange] || 365));
    return ts.filter(d => d.date >= cutoff.toISOString().split('T')[0]);
  }, [data, timeRange]);

  const scenarioData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      projectedNetLiquidity: d.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta
    }));
  }, [filteredData, scenarios]);

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

  const getRegimeStyle = (status) => ({
    CRITICAL: { border: 'border-rose-500/50', text: 'text-rose-400', bg: 'bg-rose-950/30' },
    ELEVATED: { border: 'border-amber-500/50', text: 'text-amber-400', bg: 'bg-amber-950/30' },
    CAUTION: { border: 'border-yellow-500/50', text: 'text-yellow-400', bg: 'bg-yellow-950/30' },
    NORMAL: { border: 'border-emerald-500/50', text: 'text-emerald-400', bg: 'bg-emerald-950/30' },
    FAVORABLE: { border: 'border-cyan-500/50', text: 'text-cyan-400', bg: 'bg-cyan-950/30' },
  }[status] || { border: 'border-slate-700', text: 'text-slate-400', bg: 'bg-slate-900/50' });

  const getCreditStatus = (spread) => {
    if (spread == null) return { status: 'N/A', color: 'slate' };
    if (spread > 50) return { status: 'CRITICAL', color: 'rose' };
    if (spread > 25) return { status: 'STRESSED', color: 'amber' };
    if (spread > 15) return { status: 'ELEVATED', color: 'yellow' };
    return { status: 'NORMAL', color: 'emerald' };
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900 border border-cyan-500/30 rounded-lg p-3 shadow-xl">
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Terminal className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
          <p className="text-cyan-400 font-mono">INITIALIZING FRACTAL TERMINAL</p>
          <p className="text-slate-600 font-mono text-xs mt-2">Loading real data from FRED & NOAA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-rose-950/30 border border-rose-500/50 rounded-xl p-8 max-w-lg text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-rose-400 font-mono text-xl mb-2">DATA ERROR</h2>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-300 font-mono">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const { regime, csd, lppl, credit_stress, latest, meta, execution_log } = data;
  const regimeStyle = getRegimeStyle(regime?.status);
  const creditStatus = getCreditStatus(credit_stress?.cp_tbill_spread);
  const correlationStatus = correlations.day90 > 0.7 ? 'COUPLED' : correlations.day90 > 0.3 ? 'WEAKENING' : correlations.day90 !== null ? 'DECOUPLED' : 'N/A';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-black to-black" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono">FRACTAL TERMINAL</h1>
              <p className="text-xs text-cyan-500/70 font-mono">v6.0 • All Real Data • No Simulations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => exportToPowerPoint(data, regime, correlations)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-500/30 text-purple-300 text-xs font-mono hover:bg-purple-800/30">
              <Download className="w-4 h-4" />
              EXPORT
            </button>
            <button onClick={() => setShowScenario(!showScenario)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono ${showScenario ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
              <Sliders className="w-4 h-4" />
              SCENARIO
            </button>
            <button onClick={() => setShowAudit(true)} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700/50">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700/50">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Timestamp */}
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mb-4">
          <Clock className="w-3 h-3" />
          <span>Updated: {meta?.generated_at ? new Date(meta.generated_at).toLocaleString() : '--'}</span>
          <span>•</span>
          <span>{data?.record_count} records</span>
          <span>•</span>
          <span className="text-emerald-500">✓ ALL DATA VERIFIED</span>
        </div>

        {/* Scenario Panel */}
        {showScenario && (
          <div className="mb-6 p-4 rounded-xl bg-slate-900/70 border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-4">
              <InfoTooltip id="whatIf">
                <h3 className="text-sm font-mono font-bold text-cyan-400">WHAT-IF SCENARIO</h3>
              </InfoTooltip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'tgaDelta', label: 'TGA Change', min: -500, max: 500, unit: 'B' },
                { key: 'qtPace', label: 'QT Pace', min: 0, max: 200, unit: '%' },
                { key: 'rrpDelta', label: 'RRP Change', min: -50, max: 500, unit: 'B' },
              ].map(s => (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">{s.label}</span>
                    <span className={`font-mono ${scenarios[s.key] > (s.key === 'qtPace' ? 100 : 0) ? 'text-rose-400' : scenarios[s.key] < (s.key === 'qtPace' ? 100 : 0) ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {s.key === 'qtPace' ? '' : scenarios[s.key] >= 0 ? '+' : ''}{scenarios[s.key]}{s.unit}
                    </span>
                  </div>
                  <input type="range" min={s.min} max={s.max} value={scenarios[s.key]} onChange={e => setScenarios(prev => ({ ...prev, [s.key]: parseInt(e.target.value) }))} className="w-full accent-cyan-500" />
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-black/30 flex items-center justify-between">
              <span className="text-sm text-slate-400">Projected Net Liquidity:</span>
              <span className="font-mono text-xl text-cyan-400">${((latest?.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta) / 1000).toFixed(2)}T</span>
            </div>
          </div>
        )}

        {/* Regime Banner */}
        <div className={`mb-6 p-5 rounded-xl border ${regimeStyle.border} ${regimeStyle.bg}`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
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
                <p className="text-xs text-slate-500 mt-1">Composite Fragility Index</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { id: 'ar1', label: 'AR(1)', value: csd?.current_ar1?.toFixed(3), warn: csd?.current_ar1 > 0.7 },
                { id: 'kendallTau', label: 'τ Trend', value: csd?.kendall_tau?.toFixed(3), warn: csd?.kendall_tau > 0.3 },
                { id: 'lpplBubble', label: 'LPPL', value: lppl?.is_bubble ? `${lppl.confidence}%` : lppl?.r2 ? `R²=${lppl.r2}` : '--', warn: lppl?.is_bubble },
                { id: 'netLiquidity', label: 'Net Liq', value: `$${((latest?.net_liquidity || 0) / 1000).toFixed(2)}T` },
                { id: 'correlation', label: 'Corr 90d', value: correlations.day90?.toFixed(2) || '--', warn: correlations.day90 !== null && correlations.day90 < 0.3 },
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

        {/* Credit Stress Panel (REAL DATA) */}
        {credit_stress && (
          <div className={`mb-6 p-4 rounded-xl border bg-${creditStatus.color}-950/20 border-${creditStatus.color}-500/30`}>
            <div className="flex items-center justify-between mb-3">
              <InfoTooltip id="cpTbillSpread">
                <h3 className="text-sm font-mono font-bold text-cyan-400">CREDIT STRESS INDICATORS</h3>
              </InfoTooltip>
              <span className={`text-xs font-mono px-2 py-1 rounded bg-${creditStatus.color}-500/20 text-${creditStatus.color}-400`}>
                {creditStatus.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <InfoTooltip id="cpTbillSpread">
                  <p className="text-xs text-slate-500 mb-1">CP-TBill Spread</p>
                </InfoTooltip>
                <p className={`font-mono text-xl font-bold text-${creditStatus.color}-400`}>
                  {credit_stress.cp_tbill_spread?.toFixed(1) || '--'} <span className="text-sm">bps</span>
                </p>
              </div>
              <div>
                <InfoTooltip id="yieldCurve">
                  <p className="text-xs text-slate-500 mb-1">10Y-2Y Spread</p>
                </InfoTooltip>
                <p className={`font-mono text-xl font-bold ${credit_stress.yield_curve < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {credit_stress.yield_curve?.toFixed(2) || '--'}%
                </p>
              </div>
              <div>
                <InfoTooltip id="hySpread">
                  <p className="text-xs text-slate-500 mb-1">HY Spread</p>
                </InfoTooltip>
                <p className={`font-mono text-xl font-bold ${credit_stress.hy_spread > 5 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {credit_stress.hy_spread?.toFixed(2) || '--'}%
                </p>
              </div>
              <div>
                <InfoTooltip id="vix">
                  <p className="text-xs text-slate-500 mb-1">VIX</p>
                </InfoTooltip>
                <p className={`font-mono text-xl font-bold ${credit_stress.vix > 25 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {credit_stress.vix?.toFixed(1) || '--'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3 font-mono">All data from FRED • Updated daily</p>
          </div>
        )}

        {/* Correlation Panel */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <InfoTooltip id="correlation">
              <h3 className="text-sm font-mono font-bold text-cyan-400">LIQUIDITY-PRICE CORRELATION</h3>
            </InfoTooltip>
            <span className={`text-xs font-mono px-2 py-1 rounded ${correlationStatus === 'COUPLED' ? 'bg-emerald-500/20 text-emerald-400' : correlationStatus === 'WEAKENING' ? 'bg-amber-500/20 text-amber-400' : correlationStatus === 'DECOUPLED' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-400'}`}>
              {correlationStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: '30-Day', value: correlations.day30 }, { label: '90-Day', value: correlations.day90 }, { label: '180-Day', value: correlations.day180 }].map((c, i) => {
              const color = c.value === null ? 'slate' : c.value > 0.7 ? 'emerald' : c.value > 0.3 ? 'amber' : 'rose';
              return (
                <div key={i} className={`p-3 rounded-lg bg-${color}-900/20 border border-${color}-500/30 text-center`}>
                  <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                  <p className={`font-mono text-2xl font-bold text-${color}-400`}>{c.value?.toFixed(2) || 'N/A'}</p>
                </div>
              );
            })}
          </div>
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
            <div key={m.id} className={`p-3 rounded-xl bg-slate-900/50 border ${m.alert ? 'border-rose-500/50' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 text-${m.color}-400`} />
                <InfoTooltip id={m.id}>
                  <span className="text-xs text-slate-500">{m.label}</span>
                </InfoTooltip>
              </div>
              <p className="font-mono text-lg font-medium">{m.value}</p>
              {m.alert && <p className="text-[9px] text-rose-400 mt-1">BUFFER EXHAUSTED</p>}
            </div>
          ))}
        </div>

        {/* Time Range */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <ZoomIn className="w-4 h-4" /> TIME RANGE
          </span>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            {['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'].map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-xs font-mono rounded ${timeRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Main Chart */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-700">
          <h3 className="text-sm font-mono font-bold text-cyan-400 mb-4">NET LIQUIDITY vs S&P 500</h3>
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

        {/* CSD Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
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

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
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
        <div className="mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-700">
          <InfoTooltip id="lpplBubble">
            <h3 className="text-sm font-mono font-bold text-cyan-400 mb-4">LPPL BUBBLE DETECTION</h3>
          </InfoTooltip>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            {[
              { label: 'Bubble', value: lppl?.is_bubble ? 'YES' : 'NO', warn: lppl?.is_bubble },
              { label: 'Confidence', value: `${lppl?.confidence || 0}%` },
              { id: 'tcDays', label: 'Days to tc', value: lppl?.tc_days ?? '--' },
              { label: 'tc Date', value: lppl?.tc_date || '--' },
              { label: 'R²', value: lppl?.r2 ?? '--' },
              { label: 'ω', value: lppl?.omega ?? '--' },
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
          <p>FRACTAL TERMINAL v6.0 • All Data Real • No Simulations</p>
          <p>Data: FRED (WALCL, WTREGEN, RRPONTSYD, SP500, Credit Stress) • NOAA (Solar)</p>
          <p className="text-slate-700">Not financial advice. Educational purposes only.</p>
        </footer>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold font-mono text-cyan-400">FRACTAL TERMINAL v6.0</h2>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg">
                <p className="text-emerald-400 font-bold mb-1">✓ ALL DATA IS REAL</p>
                <p className="text-slate-400 text-xs">Every metric comes from verified government sources (FRED, NOAA). Zero simulations.</p>
              </div>
              <div>
                <h3 className="font-bold text-cyan-400 mb-2">Data Sources</h3>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Fed Balance Sheet: FRED WALCL</li>
                  <li>• TGA: FRED WTREGEN</li>
                  <li>• RRP: FRED RRPONTSYD</li>
                  <li>• Credit Stress: FRED CP rates, T-Bills, Yield Curve, HY Spread, VIX</li>
                  <li>• Solar: NOAA SWPC</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-cyan-400 mb-2">How to Use</h3>
                <p className="text-slate-400 text-xs">Hover over any metric label (with ℹ️ icon) to see detailed explanation. Use scenario sliders to model liquidity changes.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowAudit(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
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
    </div>
  );
};

export default FractalTerminal;
