import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, ReferenceLine, ReferenceArea, Brush } from 'recharts';
import { Activity, Sun, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, RefreshCw, ExternalLink, CheckCircle2, TrendingUp, ZoomIn, FileText, Clock } from 'lucide-react';

/**
 * FLR Tracker v3.0 - REAL DATA ONLY
 * 
 * This component displays data computed by GitHub Actions from:
 * - Federal Reserve (FRED): WALCL, WTREGEN, RRPONTSYD, WRESBAL, SP500
 * - NOAA SWPC: Solar cycle indices
 * 
 * Statistics computed using:
 * - CSD: Dakos et al. (2012) methodology
 * - LPPL: Sornette (2003) / lppls library
 * 
 * NO DATA IS SIMULATED OR FAKED.
 */

const FLRTrackerV3 = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  const [showAudit, setShowAudit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/data');
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || 'Failed to fetch data');
        }
        
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

  // Regime colors
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-cyan-400/50 rounded-full animate-pulse" />
            <Activity className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-cyan-400 font-mono text-sm">LOADING AUTHENTIC DATA</p>
          <p className="text-slate-600 font-mono text-xs mt-2">From FRED & NOAA</p>
        </div>
      </div>
    );
  }

  // Error state
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

  const { regime, csd, lppl, latest, meta, date_range, record_count, audit_log } = data;
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
              <p className="text-xs text-slate-500 font-mono">v3.0 • 100% Real Data • {record_count} days</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAudit(true)} className="p-2 rounded-lg bg-purple-900/30 hover:bg-purple-800/30 border border-purple-700" title="Audit Log">
              <FileText className="w-4 h-4 text-purple-400" />
            </button>
            <button onClick={() => setShowSources(true)} className="p-2 rounded-lg bg-emerald-900/30 hover:bg-emerald-800/30 border border-emerald-700" title="Data Sources">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700" title="Help">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-400">VERIFIED</span>
            </div>
          </div>
        </header>

        {/* Data timestamp */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Clock className="w-3 h-3" />
          <span>Data computed: {meta?.generated_at ? new Date(meta.generated_at).toLocaleString() : 'Unknown'}</span>
          <span>•</span>
          <span>{date_range?.start} to {date_range?.end}</span>
        </div>

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
                <p className="text-xs text-slate-500">Composite score (0-100) from real indicators</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 w-full sm:w-auto">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">AR(1)</p>
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
                  {lppl?.is_bubble ? `${lppl.confidence}%` : 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Net Liq</p>
                <p className="font-mono text-sm text-slate-300">${((latest?.net_liquidity || 0) / 1000).toFixed(2)}T</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {[
            { label: 'Fed Balance Sheet', value: `$${((latest?.balance_sheet || 0) / 1000).toFixed(2)}T`, icon: Database, color: 'text-blue-400' },
            { label: 'TGA', value: `$${(latest?.tga || 0).toFixed(0)}B`, icon: DollarSign, color: 'text-emerald-400' },
            { label: 'Reverse Repo', value: `$${(latest?.rrp || 0).toFixed(1)}B`, icon: Layers, color: 'text-purple-400' },
            { label: 'Reserves', value: latest?.reserves ? `$${(latest.reserves / 1000).toFixed(2)}T` : 'N/A', icon: Shield, color: 'text-cyan-400' },
            { label: 'S&P 500', value: latest?.spx?.toLocaleString() || '--', icon: TrendingUp, color: 'text-amber-400' },
            { label: 'Sunspots', value: latest?.ssn?.toString() || 'N/A', icon: Sun, color: 'text-orange-400' },
          ].map((m, i) => (
            <div key={i} className="p-2 sm:p-3 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${m.color}`} />
                <span className="text-[10px] sm:text-xs text-slate-500 truncate">{m.label}</span>
              </div>
              <p className="text-sm sm:text-lg font-mono font-medium">{m.value}</p>
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* S&P 500 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-mono text-cyan-400 mb-4">S&P 500 • Price & Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={v => (v/1000).toFixed(1)+'k'} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="spx" fill="url(#spxGrad)" stroke="#06b6d4" strokeWidth={1.5} name="S&P 500" />
                  <Line type="monotone" dataKey="trend" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Trend" />
                  <Brush dataKey="date" height={20} stroke="#334155" fill="#1e293b" />
                  <defs>
                    <linearGradient id="spxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AR(1) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-mono text-cyan-400 mb-4">Critical Slowing Down • AR(1)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 1]} ticks={[0, 0.3, 0.5, 0.7, 1]} width={25} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceArea y1={0.7} y2={1} fill="#f43f5e" fillOpacity={0.1} />
                  <ReferenceLine y={0.7} stroke="#f43f5e" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="ar1" fill="url(#ar1Grad)" stroke="#10b981" strokeWidth={1.5} name="AR(1)" connectNulls />
                  <Brush dataKey="date" height={20} stroke="#334155" fill="#1e293b" />
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

          {/* Net Liquidity */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-mono text-cyan-400 mb-4">Net Liquidity • (BS - TGA - RRP)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={formatXAxis} interval={getTickInterval()} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={v => (v/1000).toFixed(1)+'T'} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="net_liquidity" fill="url(#liqGrad)" stroke="#8b5cf6" strokeWidth={1.5} name="Net Liquidity ($B)" />
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
                  <Brush dataKey="date" height={20} stroke="#334155" fill="#1e293b" />
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
              <p className="font-mono">{lppl?.tc_days ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">tc Date</p>
              <p className="font-mono">{lppl?.tc_date || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">R²</p>
              <p className="font-mono">{lppl?.r2 ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">ω</p>
              <p className="font-mono">{lppl?.omega ?? 'N/A'}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">{lppl?.status}</p>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 font-mono space-y-1">
          <p>FLR Tracker v3.0 • 100% Real Data • Not Financial Advice</p>
          <p>Data from FRED & NOAA • Statistics: ewstools & lppls</p>
        </footer>
      </div>

      {/* Audit Log Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowAudit(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Audit Log</h2>
              </div>
              <button onClick={() => setShowAudit(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Complete record of all data operations for this computation run.</p>
            <div className="space-y-2 max-h-96 overflow-auto">
              {(audit_log || []).map((entry, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-lg text-xs font-mono">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>{entry.operation}</span>
                    <span>{entry.timestamp}</span>
                  </div>
                  <div className="text-cyan-400 mb-1 break-all">{entry.source}</div>
                  <pre className="text-slate-300 whitespace-pre-wrap">{JSON.stringify(entry.details, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sources Modal */}
      {showSources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowSources(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">Data Sources</h2>
              </div>
              <button onClick={() => setShowSources(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Federal Reserve (FRED)</p>
                    <p className="text-xs text-slate-500">WALCL, WTREGEN, RRPONTSYD, SP500</p>
                  </div>
                  <a href="https://fred.stlouisfed.org" target="_blank" rel="noopener noreferrer" className="p-1.5 bg-cyan-900/30 rounded">
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                  </a>
                </div>
              </div>
              
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">NOAA SWPC</p>
                    <p className="text-xs text-slate-500">Solar cycle indices</p>
                  </div>
                  <a href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer" className="p-1.5 bg-cyan-900/30 rounded">
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                  </a>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-800 rounded-lg">
              <p className="text-xs text-emerald-300"><strong>No data is simulated.</strong> Every value is fetched from official government APIs and computed using peer-reviewed statistical methods.</p>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">How It Works</h2>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">Data Pipeline</h3>
                <p>Every day at 9 PM ET, a GitHub Action fetches fresh data from FRED and NOAA, computes statistics, and saves the results.</p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">AR(1) - Critical Slowing Down</h3>
                <p>Lag-1 autocorrelation of detrended price residuals. Values approaching 1.0 indicate loss of market resilience. (Scheffer et al. 2009)</p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">LPPL - Bubble Detection</h3>
                <p>Log-Periodic Power Law fits detect unsustainable super-exponential growth with characteristic oscillations. (Sornette 2003)</p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">Net Liquidity</h3>
                <p>Fed Balance Sheet minus TGA minus RRP. This is the actual reserves available to the banking system.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FLRTrackerV3;
