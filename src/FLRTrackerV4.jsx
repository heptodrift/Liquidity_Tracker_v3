import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine, ReferenceArea, Brush, Bar, Legend } from 'recharts';
import { Activity, Sun, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, RefreshCw, ExternalLink, TrendingUp, ZoomIn, FileText, Clock, Info, Sliders, Download, Calendar, GitBranch } from 'lucide-react';

/**
 * FLR Tracker V4.0 - INSTITUTIONAL EDITION
 * 
 * New Features:
 * 1. What-If Scenario Simulator (TGA/QT/RRP sliders)
 * 2. Rolling Correlation Display (Liquidity vs Price)
 * 3. Treasury Auction Calendar Overlay
 * 4. PowerPoint Export
 */

// ============ TOOLTIP EXPLANATIONS ============
const EXPLANATIONS = {
  balanceSheet: {
    title: "Fed Balance Sheet (WALCL)",
    short: "Total assets held by the Federal Reserve",
    detail: "When the Fed buys bonds (QE), this rises and injects liquidity. When QT occurs, it shrinks. As of Jan 2026: ~$6.64T",
    impact: "↑ Rising = Bullish | ↓ Falling = Bearish"
  },
  tga: {
    title: "Treasury General Account (TGA)",
    short: "The US government's checking account",
    detail: "When Treasury collects taxes or sells bonds, TGA rises (drains liquidity). When Treasury spends, TGA falls (adds liquidity). Jan 2026: ~$781B",
    impact: "↑ Rising = Bearish | ↓ Falling = Bullish"
  },
  rrp: {
    title: "Reverse Repo Facility (RRP)",
    short: "Cash parked at the Fed by money market funds",
    detail: "The RRP 'buffer' is now EMPTY (~$2.5B). This means no more 'stealth QE' from RRP drainage. Every new Treasury issuance now directly drains bank reserves.",
    impact: "⚠️ CRITICAL: Buffer exhausted. System now fragile."
  },
  netLiquidity: {
    title: "Net Liquidity",
    short: "BS - TGA - RRP = Actual reserves for markets",
    detail: "This is the key metric. It represents money actually circulating, not locked in government accounts. Jan 2026: ~$5.86T",
    impact: "Correlates strongly with S&P 500 since 2008"
  },
  ar1: {
    title: "AR(1) — Critical Slowing Down",
    short: "System resilience indicator",
    detail: "As markets approach tipping points, they lose ability to recover from shocks. AR(1) → 1.0 = critical fragility.",
    impact: "< 0.5 Normal | 0.5-0.7 Caution | > 0.7 Critical"
  },
  correlation: {
    title: "Liquidity-Price Correlation",
    short: "Is liquidity still driving prices?",
    detail: "When correlation breaks down (goes negative), prices are running on sentiment, not fundamentals. This is the 'Wile E. Coyote' signal.",
    impact: "> 0.7 Normal | 0.3-0.7 Weakening | < 0.3 DECOUPLED"
  },
  whatIf: {
    title: "What-If Scenario Simulator",
    short: "Model future liquidity changes",
    detail: "Adjust sliders to see how TGA changes, QT pace, or RRP movements would affect Net Liquidity. Dashed line shows projected scenario.",
    impact: "Use for risk planning and policy simulation"
  }
};

// ============ INFO TOOLTIP COMPONENT ============
const InfoTooltip = ({ id, children }) => {
  const [show, setShow] = useState(false);
  const info = EXPLANATIONS[id];
  if (!info) return children;
  
  return (
    <div className="relative inline-block">
      <div 
        className="cursor-help inline-flex items-center gap-1"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
        <Info className="w-3 h-3 text-slate-500 hover:text-cyan-400" />
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72">
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 text-left">
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
            <h4 className="text-cyan-400 font-semibold text-sm mb-1">{info.title}</h4>
            <p className="text-slate-300 text-xs mb-2">{info.short}</p>
            <p className="text-slate-400 text-xs mb-2">{info.detail}</p>
            <p className="text-xs text-amber-400">{info.impact}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ TREASURY AUCTION DATA (Sample - would be fetched from API) ============
const TREASURY_AUCTIONS = [
  { date: '2026-01-07', type: '4-Week Bill', amount: 75, isNet: true },
  { date: '2026-01-08', type: '8-Week Bill', amount: 70, isNet: true },
  { date: '2026-01-09', type: '3-Year Note', amount: 58, isNet: true },
  { date: '2026-01-13', type: '10-Year Note', amount: 39, isNet: true },
  { date: '2026-01-14', type: '30-Year Bond', amount: 22, isNet: true },
  { date: '2026-01-21', type: '20-Year Bond', amount: 16, isNet: true },
  { date: '2026-01-23', type: '2-Year Note', amount: 63, isNet: true },
  { date: '2026-01-27', type: '5-Year Note', amount: 70, isNet: true },
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
const exportToPowerPoint = async (data, regime, scenarios) => {
  // Dynamic import to avoid SSR issues
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  
  // Title Slide
  const slide1 = pres.addSlide();
  slide1.addText('Fractal Liquidity Regime Tracker', {
    x: 0.5, y: 1.5, w: 9, h: 1,
    fontSize: 36, color: '00D4FF', fontFace: 'Arial', bold: true
  });
  slide1.addText(`Report Generated: ${new Date().toLocaleDateString()}`, {
    x: 0.5, y: 2.5, w: 9, h: 0.5,
    fontSize: 14, color: '888888'
  });
  slide1.addText(`Regime Status: ${regime?.status || 'N/A'} (${regime?.composite?.toFixed(1) || 0})`, {
    x: 0.5, y: 3.2, w: 9, h: 0.5,
    fontSize: 18, color: regime?.status === 'CRITICAL' ? 'FF4444' : regime?.status === 'ELEVATED' ? 'FFAA00' : '44FF44'
  });
  
  // Key Metrics Slide
  const slide2 = pres.addSlide();
  slide2.addText('Key Liquidity Metrics', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24, color: '00D4FF', bold: true
  });
  
  const latest = data?.latest || {};
  const metrics = [
    ['Fed Balance Sheet (WALCL)', `$${(latest.balance_sheet / 1000).toFixed(2)}T`],
    ['Treasury General Account', `$${latest.tga?.toFixed(0)}B`],
    ['Reverse Repo (RRP)', `$${latest.rrp?.toFixed(1)}B`],
    ['Net Liquidity', `$${(latest.net_liquidity / 1000).toFixed(2)}T`],
    ['S&P 500', latest.spx?.toLocaleString()],
  ];
  
  slide2.addTable(metrics, {
    x: 0.5, y: 1.2, w: 9,
    fontSize: 14,
    color: 'FFFFFF',
    fill: { color: '1a1a2e' },
    border: { color: '334155' }
  });
  
  // Warning box for RRP
  slide2.addText('⚠️ RRP BUFFER EXHAUSTED - System operating without liquidity cushion', {
    x: 0.5, y: 4, w: 9, h: 0.5,
    fontSize: 12, color: 'FF6B6B', fill: { color: '2d1f1f' }
  });
  
  // Scenario Slide (if scenarios applied)
  if (scenarios && (scenarios.tgaDelta !== 0 || scenarios.qtPace !== 100 || scenarios.rrpDelta !== 0)) {
    const slide3 = pres.addSlide();
    slide3.addText('Scenario Analysis', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 24, color: '00D4FF', bold: true
    });
    
    const projectedLiq = latest.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta;
    const scenarioData = [
      ['Adjustment', 'Value'],
      ['TGA Change', `${scenarios.tgaDelta >= 0 ? '+' : ''}$${scenarios.tgaDelta}B`],
      ['QT Pace', `${scenarios.qtPace}%`],
      ['RRP Change', `${scenarios.rrpDelta >= 0 ? '+' : ''}$${scenarios.rrpDelta}B`],
      ['Projected Net Liquidity', `$${(projectedLiq / 1000).toFixed(2)}T`],
    ];
    
    slide3.addTable(scenarioData, {
      x: 0.5, y: 1.2, w: 6,
      fontSize: 14, color: 'FFFFFF',
      fill: { color: '1a1a2e' }
    });
  }
  
  // Save
  pres.writeFile({ fileName: `FLR_Report_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ============ MAIN COMPONENT ============
const FLRTrackerV4 = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  
  // Modal states
  const [showAudit, setShowAudit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [showAuctions, setShowAuctions] = useState(false);
  
  // Scenario sliders
  const [scenarios, setScenarios] = useState({
    tgaDelta: 0,      // -500 to +500 billion
    qtPace: 100,      // 0% to 200% of current pace
    rrpDelta: 0       // -100 to +500 billion
  });
  
  // Treasury overlay toggle
  const [showTreasuryOverlay, setShowTreasuryOverlay] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/data');
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to fetch data');
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
    const daysBack = daysMap[timeRange] || 365;
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return ts.filter(d => d.date >= cutoffStr);
  }, [data, timeRange]);

  // Apply scenarios to data
  const scenarioData = useMemo(() => {
    if (!filteredData.length) return [];
    return filteredData.map(d => ({
      ...d,
      projectedNetLiquidity: d.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta,
      scenarioActive: scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0
    }));
  }, [filteredData, scenarios]);

  // Calculate rolling correlations
  const correlations = useMemo(() => {
    if (!filteredData.length) return { day30: 0, day90: 0, day180: 0 };
    
    const calcRolling = (days) => {
      const recent = filteredData.slice(-days);
      if (recent.length < days * 0.8) return null;
      const liq = recent.map(d => d.net_liquidity).filter(v => v != null);
      const spx = recent.map(d => d.spx).filter(v => v != null);
      if (liq.length !== spx.length) return null;
      return calculateCorrelation(liq, spx);
    };
    
    return {
      day30: calcRolling(30),
      day90: calcRolling(90),
      day180: calcRolling(180)
    };
  }, [filteredData]);

  // Correlation status
  const correlationStatus = useMemo(() => {
    const c = correlations.day90;
    if (c === null) return { status: 'N/A', color: 'slate' };
    if (c > 0.7) return { status: 'COUPLED', color: 'emerald' };
    if (c > 0.3) return { status: 'WEAKENING', color: 'amber' };
    return { status: 'DECOUPLED', color: 'rose' };
  }, [correlations]);

  const getRegimeStyle = (status) => {
    const styles = {
      CRITICAL: { bg: 'from-rose-950/50 to-rose-900/30', border: 'border-rose-800', text: 'text-rose-400' },
      ELEVATED: { bg: 'from-amber-950/50 to-amber-900/30', border: 'border-amber-800', text: 'text-amber-400' },
      CAUTION: { bg: 'from-yellow-950/50 to-yellow-900/30', border: 'border-yellow-800', text: 'text-yellow-400' },
      NORMAL: { bg: 'from-emerald-950/50 to-emerald-900/30', border: 'border-emerald-800', text: 'text-emerald-400' },
      FAVORABLE: { bg: 'from-cyan-950/50 to-cyan-900/30', border: 'border-cyan-800', text: 'text-cyan-400' },
      LOADING: { bg: 'from-slate-950/50 to-slate-900/30', border: 'border-slate-800', text: 'text-slate-400' }
    };
    return styles[status] || styles.LOADING;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl backdrop-blur">
        <p className="text-xs font-mono text-slate-400 mb-2">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-medium">
              {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const formatXAxis = (dateStr) => {
    if (!dateStr) return '';
    if (timeRange === '1M' || timeRange === '3M') return dateStr.slice(5);
    if (timeRange === '6M' || timeRange === '1Y') return dateStr.slice(2, 7);
    return dateStr.slice(0, 7);
  };

  const getTickInterval = () => {
    const len = filteredData.length;
    if (len < 60) return Math.floor(len / 6);
    if (len < 200) return Math.floor(len / 8);
    return Math.floor(len / 10);
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
            <Activity className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-cyan-400 font-mono text-sm">LOADING DATA</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-rose-950/30 border border-rose-800 rounded-xl p-6 max-w-lg">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-rose-400 font-mono text-center text-lg mb-2">Data Error</h2>
          <p className="text-slate-400 text-sm text-center mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-2 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-300 font-mono text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { regime, csd, lppl, latest, meta, date_range, record_count, execution_log } = data;
  const regimeStyle = getRegimeStyle(regime?.status);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold">Fractal Liquidity Regime Tracker</h1>
              <p className="text-xs text-slate-500 font-mono">v4.0 • Institutional Edition</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Button */}
            <button 
              onClick={() => exportToPowerPoint(data, regime, scenarios)} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-800/40 border border-purple-700 text-purple-300 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5" />
              Export PPTX
            </button>
            
            {/* Scenario Toggle */}
            <button 
              onClick={() => setShowScenario(!showScenario)} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono ${showScenario ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              What-If
            </button>
            
            {/* Treasury Toggle */}
            <button 
              onClick={() => setShowTreasuryOverlay(!showTreasuryOverlay)} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono ${showTreasuryOverlay ? 'bg-amber-900/50 border-amber-600 text-amber-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Auctions
            </button>
            
            <button onClick={() => setShowAudit(true)} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700">
              <FileText className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-800">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono text-cyan-400">BETA</span>
            </div>
          </div>
        </header>

        {/* Data timestamp */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Clock className="w-3 h-3" />
          <span>Updated: {meta?.generated_at ? new Date(meta.generated_at).toLocaleString() : 'Unknown'}</span>
          <span>•</span>
          <span>{record_count} trading days</span>
        </div>

        {/* SCENARIO PANEL */}
        {showScenario && (
          <div className="mb-4 p-4 rounded-xl bg-slate-900/70 border border-cyan-800">
            <div className="flex items-center gap-2 mb-4">
              <InfoTooltip id="whatIf">
                <h3 className="text-sm font-mono text-cyan-400">What-If Scenario Simulator</h3>
              </InfoTooltip>
              <span className="text-xs text-slate-500">Drag sliders to model liquidity changes</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* TGA Slider */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">TGA Change</span>
                  <span className={`font-mono ${scenarios.tgaDelta > 0 ? 'text-rose-400' : scenarios.tgaDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {scenarios.tgaDelta >= 0 ? '+' : ''}{scenarios.tgaDelta}B
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-500" 
                  max="500" 
                  value={scenarios.tgaDelta}
                  onChange={(e) => setScenarios(s => ({ ...s, tgaDelta: parseInt(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>-$500B (Bullish)</span>
                  <span>+$500B (Bearish)</span>
                </div>
              </div>
              
              {/* QT Pace Slider */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">QT Pace</span>
                  <span className="font-mono text-slate-300">{scenarios.qtPace}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={scenarios.qtPace}
                  onChange={(e) => setScenarios(s => ({ ...s, qtPace: parseInt(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>0% (Pause)</span>
                  <span>200% (Accelerate)</span>
                </div>
              </div>
              
              {/* RRP Slider */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">RRP Change</span>
                  <span className={`font-mono ${scenarios.rrpDelta > 0 ? 'text-rose-400' : scenarios.rrpDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {scenarios.rrpDelta >= 0 ? '+' : ''}{scenarios.rrpDelta}B
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-50" 
                  max="500" 
                  value={scenarios.rrpDelta}
                  onChange={(e) => setScenarios(s => ({ ...s, rrpDelta: parseInt(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>-$50B</span>
                  <span>+$500B (Refill)</span>
                </div>
              </div>
            </div>
            
            {/* Scenario Result */}
            <div className="mt-4 p-3 rounded-lg bg-slate-800/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">Projected Net Liquidity:</span>
              <span className="font-mono text-lg text-cyan-400">
                ${((latest?.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta) / 1000).toFixed(2)}T
              </span>
              <span className={`text-xs font-mono ${(scenarios.tgaDelta + scenarios.rrpDelta) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ({(scenarios.tgaDelta + scenarios.rrpDelta) > 0 ? '' : '+'}${-(scenarios.tgaDelta + scenarios.rrpDelta)}B)
              </span>
            </div>
            
            <button 
              onClick={() => setScenarios({ tgaDelta: 0, qtPace: 100, rrpDelta: 0 })}
              className="mt-3 text-xs text-slate-500 hover:text-slate-300"
            >
              Reset to baseline
            </button>
          </div>
        )}

        {/* Regime Banner */}
        <div className={`mb-4 p-4 rounded-xl border bg-gradient-to-r ${regimeStyle.bg} ${regimeStyle.border}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold font-mono ${regimeStyle.text}`}>
                {regime?.composite?.toFixed(0) || '--'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-semibold ${regimeStyle.text}`}>{regime?.status || 'LOADING'}</span>
                  <span className="text-slate-500">•</span>
                  <span className={`font-mono text-sm ${regimeStyle.text}`}>{regime?.signal || '--'}</span>
                </div>
                <p className="text-xs text-slate-500">Composite regime score (0-100)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-4 w-full sm:w-auto">
              <div className="text-center">
                <InfoTooltip id="ar1">
                  <p className="text-xs text-slate-500 mb-1">AR(1)</p>
                </InfoTooltip>
                <p className={`font-mono text-sm ${(csd?.current_ar1 || 0) > 0.7 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {csd?.current_ar1?.toFixed(3) || '--'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">τ Trend</p>
                <p className={`font-mono text-sm ${(csd?.kendall_tau || 0) > 0.3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {csd?.kendall_tau?.toFixed(3) || '--'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">LPPL</p>
                <p className={`font-mono text-sm ${lppl?.is_bubble ? 'text-rose-400' : 'text-slate-400'}`}>
                  {lppl?.is_bubble ? `${lppl.confidence}%` : lppl?.r2 ? `R²=${lppl.r2}` : '--'}
                </p>
              </div>
              <div className="text-center">
                <InfoTooltip id="netLiquidity">
                  <p className="text-xs text-slate-500 mb-1">Net Liq</p>
                </InfoTooltip>
                <p className="font-mono text-sm text-slate-300">${((latest?.net_liquidity || 0) / 1000).toFixed(2)}T</p>
              </div>
              <div className="text-center">
                <InfoTooltip id="correlation">
                  <p className="text-xs text-slate-500 mb-1">Corr 90d</p>
                </InfoTooltip>
                <p className={`font-mono text-sm text-${correlationStatus.color}-400`}>
                  {correlations.day90?.toFixed(2) || '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CORRELATION HEATMAP */}
        <div className="mb-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <InfoTooltip id="correlation">
              <h3 className="text-sm font-mono text-cyan-400">Liquidity-Price Correlation</h3>
            </InfoTooltip>
            <span className={`text-xs font-mono px-2 py-1 rounded bg-${correlationStatus.color}-900/30 text-${correlationStatus.color}-400 border border-${correlationStatus.color}-800`}>
              {correlationStatus.status}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '30-Day', value: correlations.day30 },
              { label: '90-Day', value: correlations.day90 },
              { label: '180-Day', value: correlations.day180 }
            ].map((item, i) => {
              const c = item.value;
              const color = c === null ? 'slate' : c > 0.7 ? 'emerald' : c > 0.3 ? 'amber' : 'rose';
              return (
                <div key={i} className={`p-3 rounded-lg bg-${color}-900/20 border border-${color}-800/50 text-center`}>
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className={`font-mono text-xl text-${color}-400`}>
                    {c !== null ? c.toFixed(2) : 'N/A'}
                  </p>
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-slate-500 mt-3">
            {correlationStatus.status === 'DECOUPLED' 
              ? '⚠️ Warning: Prices disconnected from liquidity fundamentals. Possible blow-off top.'
              : correlationStatus.status === 'WEAKENING'
              ? '⚡ Caution: Correlation weakening. Monitor for regime change.'
              : '✓ Liquidity and prices moving together normally.'}
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {[
            { id: 'balanceSheet', label: 'Fed Balance Sheet', value: `$${((latest?.balance_sheet || 0) / 1000).toFixed(2)}T`, icon: Database, color: 'text-blue-400' },
            { id: 'tga', label: 'TGA', value: `$${(latest?.tga || 0).toFixed(0)}B`, icon: DollarSign, color: 'text-emerald-400' },
            { id: 'rrp', label: 'RRP', value: `$${(latest?.rrp || 0).toFixed(1)}B`, icon: Layers, color: 'text-rose-400', alert: true },
            { id: 'reserves', label: 'Reserves', value: latest?.reserves ? `$${(latest.reserves / 1000).toFixed(2)}T` : 'N/A', icon: Shield, color: 'text-cyan-400' },
            { id: 'spx', label: 'S&P 500', value: latest?.spx?.toLocaleString() || '--', icon: TrendingUp, color: 'text-amber-400' },
            { id: 'sunspots', label: 'Sunspots', value: latest?.ssn?.toString() || 'N/A', icon: Sun, color: 'text-orange-400' },
          ].map((m, i) => (
            <div key={i} className={`p-2 sm:p-3 rounded-xl bg-slate-900/50 border ${m.alert ? 'border-rose-800' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${m.color}`} />
                <InfoTooltip id={m.id}>
                  <span className="text-[10px] sm:text-xs text-slate-500 truncate">{m.label}</span>
                </InfoTooltip>
              </div>
              <p className="text-sm sm:text-lg font-mono font-medium">{m.value}</p>
              {m.alert && <p className="text-[9px] text-rose-400 mt-1">BUFFER EMPTY</p>}
            </div>
          ))}
        </div>

        {/* Time range */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">Time Range:</span>
          </div>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            {['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'].map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2 py-1 text-xs font-mono rounded ${timeRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CHART with Scenario Overlay */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-cyan-400">Net Liquidity vs S&P 500</h3>
            {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
              <span className="text-xs font-mono text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">SCENARIO ACTIVE</span>
            )}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scenarioData} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={v => (v/1000).toFixed(1)+'T'} width={40} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={v => (v/1000).toFixed(1)+'k'} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* Actual Net Liquidity */}
                <Area yAxisId="left" type="monotone" dataKey="net_liquidity" fill="url(#liqGrad)" stroke="#8b5cf6" strokeWidth={2} name="Net Liquidity ($B)" />
                
                {/* Scenario Projection */}
                {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
                  <Line yAxisId="left" type="monotone" dataKey="projectedNetLiquidity" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected ($B)" />
                )}
                
                {/* S&P 500 */}
                <Line yAxisId="right" type="monotone" dataKey="spx" stroke="#f59e0b" strokeWidth={2} dot={false} name="S&P 500" />
                
                <Brush dataKey="date" height={20} stroke="#334155" fill="#1e293b" />
                
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

        {/* Treasury Auctions Panel */}
        {showTreasuryOverlay && (
          <div className="mb-4 p-4 rounded-xl bg-slate-900/50 border border-amber-800">
            <h3 className="text-sm font-mono text-amber-400 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Treasury Auctions (Liquidity Drains)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Security</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-right py-2 px-3">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {TREASURY_AUCTIONS.map((auction, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-mono">{auction.date}</td>
                      <td className="py-2 px-3">{auction.type}</td>
                      <td className="py-2 px-3 text-right font-mono">${auction.amount}B</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-rose-400">-${auction.amount}B</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              ⚠️ With RRP at zero, every auction directly drains bank reserves. Watch for funding stress on settlement days.
            </p>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* AR(1) Chart */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <InfoTooltip id="ar1">
              <h3 className="text-sm font-mono text-cyan-400 mb-4">Critical Slowing Down • AR(1)</h3>
            </InfoTooltip>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 1]} ticks={[0, 0.3, 0.5, 0.7, 1]} width={25} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceArea y1={0.7} y2={1} fill="#f43f5e" fillOpacity={0.1} />
                  <ReferenceLine y={0.7} stroke="#f43f5e" strokeDasharray="3 3" />
                  <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
                  <Area type="monotone" dataKey="ar1" fill="url(#ar1Grad)" stroke="#10b981" strokeWidth={1.5} name="AR(1)" connectNulls />
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
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-mono text-cyan-400 mb-4">Rolling Variance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="variance" fill="url(#varGrad)" stroke="#f59e0b" strokeWidth={1.5} name="Variance" connectNulls />
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
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-mono text-cyan-400 mb-4">LPPL Bubble Detection (Sornette 2003)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Bubble Detected</p>
              <p className={`font-mono font-semibold ${lppl?.is_bubble ? 'text-rose-400' : 'text-emerald-400'}`}>
                {lppl?.is_bubble ? 'YES' : 'NO'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <p className="font-mono">{lppl?.confidence || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Days to tc</p>
              <p className="font-mono">{lppl?.tc_days ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">tc Date</p>
              <p className="font-mono">{lppl?.tc_date || '--'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">R²</p>
              <p className="font-mono">{lppl?.r2 ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">ω</p>
              <p className="font-mono">{lppl?.omega ?? '--'}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">{lppl?.status}</p>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 font-mono space-y-1">
          <p>FLR Tracker v4.0 • Institutional Edition • Not Financial Advice</p>
          <p>Data: FRED & NOAA • Methods: Dakos et al. (2012), Sornette (2003)</p>
        </footer>
      </div>

      {/* MODALS */}
      
      {/* Audit Log Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowAudit(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Execution Log</h2>
              <button onClick={() => setShowAudit(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {(execution_log || []).map((entry, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-lg text-xs font-mono">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span className={`${entry.level === 'ERROR' ? 'text-rose-400' : entry.level === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {entry.level}
                    </span>
                    <span>{entry.time}</span>
                  </div>
                  <div className="text-slate-300">{entry.message}</div>
                  {entry.data && <pre className="text-slate-500 mt-1">{JSON.stringify(entry.data, null, 2)}</pre>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">V4.0 Features</h2>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">🎚️ What-If Simulator</h3>
                <p>Drag sliders to model TGA changes, QT pace adjustments, or RRP movements. See projected liquidity impact in real-time.</p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">📊 Correlation Matrix</h3>
                <p>Track whether liquidity is still driving prices. When correlation breaks down (goes red), it signals a potential blow-off top.</p>
              </div>
              <div>
                <h3 className="font-semibold text-amber-400 mb-1">📅 Treasury Auctions</h3>
                <p>Toggle to see upcoming Treasury issuance dates. With RRP at zero, each auction directly drains bank reserves.</p>
              </div>
              <div>
                <h3 className="font-semibold text-purple-400 mb-1">📥 PowerPoint Export</h3>
                <p>One-click export for ALCO meetings. Generates editable .pptx with current metrics and scenario analysis.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FLRTrackerV4;
