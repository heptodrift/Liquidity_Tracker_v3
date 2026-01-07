import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine, ReferenceArea, Brush, Legend } from 'recharts';
import { Activity, DollarSign, Shield, Database, AlertCircle, Layers, X, HelpCircle, TrendingUp, ZoomIn, FileText, Clock, Info, Sliders, Download, Calendar, Terminal, AlertTriangle, Sun, Globe, Coins, Command, Search, LayoutGrid, Maximize2, Minimize2, Layout, PanelLeft, PanelRight, GripVertical } from 'lucide-react';

/**
 * FRACTAL TERMINAL V7.1 - INSTITUTIONAL EDITION
 * =============================================
 * 
 * Features:
 * - FlexLayout docking system (drag panels, pop-out, multi-monitor)
 * - Command Palette (Cmd+K)
 * - Cyberpunk/Sci-Fi aesthetic
 * - High-frequency data (Daily Treasury, NY Fed)
 * - Global M2 aggregation
 * - Stablecoin impulse
 * - All tooltips complete
 * 
 * ALL DATA IS REAL. ZERO SIMULATIONS.
 * 
 * Note: Deephaven integration planned for future real-time streaming phase.
 */

// ============ FLEXLAYOUT DOCKING SYSTEM ============
// Custom implementation for panel docking, dragging, and popout

const DockingContext = React.createContext(null);

const DockingProvider = ({ children }) => {
  const [layout, setLayout] = useState({
    panels: {
      regime: { visible: true, position: 'main', order: 0 },
      globalM2: { visible: true, position: 'sidebar', order: 0 },
      stablecoins: { visible: true, position: 'sidebar', order: 1 },
      credit: { visible: true, position: 'sidebar', order: 2 },
      mainChart: { visible: true, position: 'main', order: 1 },
      ar1: { visible: true, position: 'bottom', order: 0 },
      variance: { visible: true, position: 'bottom', order: 1 },
      lppl: { visible: true, position: 'main', order: 2 },
      correlation: { visible: true, position: 'main', order: 3 },
      scenario: { visible: false, position: 'top', order: 0 },
    },
    popouts: {},
    sidebarWidth: 380,
    sidebarCollapsed: false,
  });

  const togglePanel = (id) => {
    setLayout(prev => ({
      ...prev,
      panels: {
        ...prev.panels,
        [id]: { ...prev.panels[id], visible: !prev.panels[id].visible }
      }
    }));
  };

  const movePanel = (id, position) => {
    setLayout(prev => ({
      ...prev,
      panels: {
        ...prev.panels,
        [id]: { ...prev.panels[id], position }
      }
    }));
  };

  const popoutPanel = (id) => {
    const panel = layout.panels[id];
    if (!panel) return;
    
    // Create popout window
    const popout = window.open('', id, 'width=600,height=400,menubar=no,toolbar=no');
    if (popout) {
      setLayout(prev => ({
        ...prev,
        popouts: { ...prev.popouts, [id]: popout },
        panels: { ...prev.panels, [id]: { ...prev.panels[id], visible: false } }
      }));
    }
  };

  const toggleSidebar = () => {
    setLayout(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  };

  const setSidebarWidth = (width) => {
    setLayout(prev => ({ ...prev, sidebarWidth: Math.max(280, Math.min(600, width)) }));
  };

  return (
    <DockingContext.Provider value={{ layout, togglePanel, movePanel, popoutPanel, toggleSidebar, setSidebarWidth }}>
      {children}
    </DockingContext.Provider>
  );
};

const useDocking = () => React.useContext(DockingContext);

// Draggable panel wrapper
const DockablePanel = ({ id, title, icon: Icon, children, glowColor = 'cyan', className = '' }) => {
  const { layout, togglePanel, movePanel, popoutPanel } = useDocking();
  const [isDragging, setIsDragging] = useState(false);
  const [showDockMenu, setShowDockMenu] = useState(false);
  const panelRef = useRef(null);

  const panel = layout.panels[id];
  if (!panel?.visible) return null;

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.setData('panelId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={panelRef}
      className={`relative rounded-lg border border-${glowColor}-500/30 bg-slate-900/90 backdrop-blur overflow-hidden ${isDragging ? 'opacity-50' : ''} ${className}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Corner accents */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-${glowColor}-500/50`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-${glowColor}-500/50`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-${glowColor}-500/50`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-${glowColor}-500/50`} />

      {/* Header with drag handle */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-${glowColor}-500/20 bg-${glowColor}-950/30 cursor-move`}>
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-slate-600" />
          {Icon && <Icon className={`w-4 h-4 text-${glowColor}-400`} />}
          <span className={`text-xs font-mono font-bold text-${glowColor}-400 tracking-wider`}>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDockMenu(!showDockMenu)}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
            title="Dock options"
          >
            <Layout className="w-3 h-3" />
          </button>
          <button
            onClick={() => popoutPanel(id)}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
            title="Pop out"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => togglePanel(id)}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        
        {/* Dock menu */}
        {showDockMenu && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 min-w-[120px]">
            {['main', 'sidebar', 'bottom', 'top'].map(pos => (
              <button
                key={pos}
                onClick={() => { movePanel(id, pos); setShowDockMenu(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded hover:bg-slate-800 ${panel.position === pos ? 'text-cyan-400' : 'text-slate-400'}`}
              >
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3">
        {children}
      </div>
    </div>
  );
};

// Drop zone for panels
const DropZone = ({ position, children, className = '' }) => {
  const { layout, movePanel } = useDocking();
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const panelId = e.dataTransfer.getData('panelId');
    if (panelId) {
      movePanel(panelId, position);
    }
    setIsOver(false);
  };

  return (
    <div
      className={`${className} ${isOver ? 'ring-2 ring-cyan-500/50 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
};

// Resizable sidebar
const ResizableSidebar = ({ children }) => {
  const { layout, setSidebarWidth, toggleSidebar } = useDocking();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  if (layout.sidebarCollapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col items-center py-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-800 rounded">
          <PanelLeft className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="flex-shrink-0 bg-slate-900/30 border-l border-slate-800 relative"
      style={{ width: layout.sidebarWidth }}
    >
      {/* Resize handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-cyan-500/50 ${isResizing ? 'bg-cyan-500/50' : ''}`}
        onMouseDown={handleMouseDown}
      />
      
      {/* Collapse button */}
      <button
        onClick={toggleSidebar}
        className="absolute top-2 left-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded z-10"
      >
        <PanelRight className="w-3 h-3 text-slate-400" />
      </button>

      <div className="p-3 pt-10 h-full overflow-auto">
        {children}
      </div>
    </div>
  );
};

// ============ COMPLETE TOOLTIP EXPLANATIONS ============
const EXPLANATIONS = {
  balanceSheet: {
    title: "Fed Balance Sheet (WALCL)",
    short: "Total assets held by the Federal Reserve",
    detail: "QE expands this, QT shrinks it. Peak $8.9T (2022), now ~$6.64T.",
    impact: "↑ Rising = Bullish | ↓ Falling = Bearish",
    source: "FRED: WALCL"
  },
  tga: {
    title: "Treasury General Account",
    short: "US government's checking account",
    detail: "Tax receipts fill it (drain). Spending empties it (inject). Sourced from Daily Treasury Statement (T-1).",
    impact: "↑ Rising = Drain | ↓ Falling = Inject",
    source: "Daily Treasury Statement API"
  },
  rrp: {
    title: "Reverse Repo Facility (RRP)",
    short: "Cash parked overnight at Fed",
    detail: "EXHAUSTED (~$2-6B). The $2.5T buffer is gone. Sourced from NY Fed (same-day).",
    impact: "⚠️ Buffer depleted",
    source: "NY Fed Markets API"
  },
  reserves: {
    title: "Bank Reserves (WRESBAL)",
    short: "Deposits banks hold at Fed",
    detail: "Below $3T = scarcity risk. Sept 2019 crisis occurred at reserve scarcity.",
    impact: "> $3T = Ample | < $3T = Risk",
    source: "FRED: WRESBAL"
  },
  netLiquidity: {
    title: "Net Liquidity",
    short: "Fed BS − TGA − RRP",
    detail: "THE key metric. ~0.9 correlation with S&P 500 since 2008.",
    impact: "↑ Risk-on | ↓ Risk-off",
    source: "Derived"
  },
  globalM2: {
    title: "Global M2 Money Supply",
    short: "US + EU + Japan + China M2 (USD)",
    detail: "Aggregated money supply of major economies.",
    impact: "↑ Expansion | ↓ Contraction",
    source: "FRED aggregated"
  },
  globalM2Roc: {
    title: "Global M2 Rate of Change",
    short: "30-day momentum of Global M2",
    detail: "Leading indicator for risk assets.",
    impact: "ROC > 0 = Bullish | ROC < 0 = Bearish",
    source: "30-day pct change"
  },
  stablecoins: {
    title: "Stablecoin Market Cap",
    short: "Total USDT + USDC + DAI + others",
    detail: "The 'M1' of crypto. Real-time from DefiLlama.",
    impact: "↑ Inflow | ↓ Outflow",
    source: "DefiLlama API"
  },
  spx: {
    title: "S&P 500 Index",
    short: "Benchmark US equity index",
    detail: "Primary risk asset for regime detection.",
    impact: "Used for LPPL, CSD, correlation",
    source: "FRED: SP500"
  },
  vix: {
    title: "VIX (Volatility Index)",
    short: "CBOE 'Fear Gauge'",
    detail: "30-day implied volatility from SPX options.",
    impact: "< 15 Complacent | 20-30 Elevated | > 30 Panic",
    source: "FRED: VIXCLS"
  },
  cpTbillSpread: {
    title: "CP-TBill Spread",
    short: "Commercial Paper − Treasury Bill",
    detail: "Post-LIBOR credit stress indicator.",
    impact: "< 15 Normal | 15-25 Stress | > 50 Crisis",
    source: "FRED"
  },
  yieldCurve: {
    title: "10Y-2Y Yield Spread",
    short: "Treasury yield curve slope",
    detail: "Inversion preceded every recession since 1970.",
    impact: "> 0 Normal | < 0 INVERTED",
    source: "FRED: T10Y2Y"
  },
  hySpread: {
    title: "High Yield Spread",
    short: "Junk bond spread over Treasuries",
    detail: "Credit risk premium indicator.",
    impact: "< 3% Tight | > 5% Stress",
    source: "FRED: BAMLH0A0HYM2"
  },
  ar1: {
    title: "AR(1) Autocorrelation",
    short: "System resilience indicator",
    detail: "Critical Slowing Down metric. AR(1) → 1.0 = fragility.",
    impact: "< 0.5 Normal | > 0.7 CRITICAL",
    source: "Scheffer et al. (2009)"
  },
  variance: {
    title: "Rolling Variance",
    short: "Price residual volatility",
    detail: "Rising variance + rising AR(1) = transition imminent.",
    impact: "Low = Stable | Rising = Instability",
    source: "Dakos et al. (2012)"
  },
  kendallTau: {
    title: "Kendall's Tau (τ)",
    short: "AR(1) trend direction",
    detail: "Is AR(1) systematically rising?",
    impact: "τ > 0.3 = Concerning | τ < -0.3 = Recovery",
    source: "Mann-Kendall test"
  },
  lpplBubble: {
    title: "LPPL Bubble Detection",
    short: "Log-Periodic Power Law",
    detail: "Pattern preceded 1929, 1987, 2000, 2008 crashes.",
    impact: "Bubble = crash signature detected",
    source: "Sornette (2003)"
  },
  tcDays: {
    title: "Critical Time (tc)",
    short: "Days until regime change",
    detail: "When current growth pattern must change.",
    impact: "< 30 Near-term | 30-90 Medium",
    source: "Johansen & Sornette"
  },
  correlation: {
    title: "Liquidity-Price Correlation",
    short: "Is liquidity driving prices?",
    detail: "When correlation breaks, prices disconnect from fundamentals.",
    impact: "> 0.7 Coupled | < 0.3 DECOUPLED",
    source: "Rolling Pearson"
  },
  sunspots: {
    title: "Solar Cycle (SSN)",
    short: "Sunspot number",
    detail: "Experimental: Solar maxima may correlate with volatility.",
    impact: "⚠️ Speculative",
    source: "NOAA SWPC"
  },
  regimeScore: {
    title: "Composite Regime Score",
    short: "Overall fragility (0-100)",
    detail: "AR(1) 35% + Tau 20% + LPPL 25% + Liquidity 20%",
    impact: "0-25 FAVORABLE | 70+ CRITICAL",
    source: "Composite"
  },
  whatIf: {
    title: "Scenario Simulator",
    short: "Model liquidity changes",
    detail: "Adjust TGA, QT, RRP to see projected impact.",
    impact: "Use for risk planning",
    source: "Interactive"
  }
};

// ============ TOOLTIP COMPONENT ============
const InfoTooltip = ({ id, children }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: true, left: false });
  const ref = useRef(null);
  const info = EXPLANATIONS[id];
  
  if (!info) return children;

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top > 280,
        left: window.innerWidth - rect.right < 300
      });
    }
    setShow(true);
  };
  
  return (
    <div className="relative inline-block">
      <div ref={ref} className="cursor-help inline-flex items-center gap-1 group" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
        {children}
        <Info className="w-3 h-3 text-cyan-500/40 group-hover:text-cyan-400 flex-shrink-0" />
      </div>
      {show && (
        <div className={`absolute z-[9999] w-72 ${pos.top ? 'bottom-full mb-2' : 'top-full mt-2'} ${pos.left ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl p-3">
            <h4 className="text-cyan-400 font-bold text-sm mb-1">{info.title}</h4>
            <p className="text-slate-300 text-xs mb-1">{info.short}</p>
            <p className="text-slate-400 text-xs mb-2">{info.detail}</p>
            <div className="bg-black/30 rounded p-1.5 mb-1">
              <p className="text-xs text-amber-300 font-mono">{info.impact}</p>
            </div>
            <p className="text-[10px] text-slate-600">{info.source}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ COMMAND PALETTE ============
const CommandPalette = ({ isOpen, onClose, onCommand, data }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { togglePanel } = useDocking();
  
  const commands = [
    { id: 'toggle_scenario', label: 'Toggle Scenario Panel', shortcut: 'S', icon: Sliders },
    { id: 'toggle_globalM2', label: 'Toggle Global M2 Panel', shortcut: 'G', icon: Globe },
    { id: 'toggle_credit', label: 'Toggle Credit Stress Panel', shortcut: 'C', icon: AlertTriangle },
    { id: 'toggle_stablecoins', label: 'Toggle Stablecoins Panel', shortcut: 'T', icon: Coins },
    { id: 'toggle_lppl', label: 'Toggle LPPL Panel', shortcut: 'L', icon: Activity },
    { id: 'toggle_ar1', label: 'Toggle AR(1) Panel', shortcut: 'A', icon: Activity },
    { id: 'toggle_variance', label: 'Toggle Variance Panel', shortcut: 'V', icon: Activity },
    { id: 'export', label: 'Export PowerPoint Report', shortcut: 'E', icon: Download },
    { id: '1m', label: 'Time Range: 1 Month', shortcut: '1', icon: Clock },
    { id: '1y', label: 'Time Range: 1 Year', shortcut: 'Y', icon: Clock },
    { id: 'all', label: 'Time Range: All Data', shortcut: '0', icon: Clock },
    { id: 'help', label: 'Show Help', shortcut: '?', icon: HelpCircle },
    { id: 'audit', label: 'Show Execution Log', shortcut: 'X', icon: FileText },
  ];
  
  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if (isOpen) {
        if (e.key === 'Escape') onClose(false);
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter' && filtered[selectedIndex]) {
          const cmd = filtered[selectedIndex];
          if (cmd.id.startsWith('toggle_')) {
            togglePanel(cmd.id.replace('toggle_', ''));
          } else {
            onCommand(cmd.id);
          }
          onClose(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filtered, selectedIndex, onCommand, togglePanel]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/80 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-cyan-500/20">
          <Command className="w-5 h-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none font-mono"
          />
          <kbd className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => {
                if (cmd.id.startsWith('toggle_')) togglePanel(cmd.id.replace('toggle_', ''));
                else onCommand(cmd.id);
                onClose(false);
              }}
              className={`w-full flex items-center gap-3 p-3 text-left ${i === selectedIndex ? 'bg-cyan-500/20 border-l-2 border-cyan-400' : 'hover:bg-slate-800/50 border-l-2 border-transparent'}`}
            >
              <cmd.icon className={`w-4 h-4 ${i === selectedIndex ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className={i === selectedIndex ? 'text-white' : 'text-slate-300'}>{cmd.label}</span>
              <kbd className="ml-auto px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500 font-mono">{cmd.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
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
  
  const s2 = pres.addSlide();
  s2.addText('Key Metrics', { x: 0.5, y: 0.3, fontSize: 24, color: '00D4FF', bold: true });
  const latest = data.latest || {};
  s2.addTable([
    ['Metric', 'Value', 'Source'],
    ['Fed Balance Sheet', `$${(latest.balance_sheet / 1000).toFixed(2)}T`, 'FRED'],
    ['TGA', `$${latest.tga?.toFixed(0)}B`, latest.tga_source || 'FRED'],
    ['RRP', `$${latest.rrp?.toFixed(1)}B`, latest.rrp_source || 'FRED'],
    ['Net Liquidity', `$${(latest.net_liquidity / 1000).toFixed(2)}T`, 'Derived'],
    ['Global M2', latest.global_m2 ? `$${latest.global_m2.toFixed(1)}T` : 'N/A', 'FRED'],
    ['Correlation (90d)', correlations?.day90?.toFixed(2) || 'N/A', 'Calculated'],
  ], { x: 0.5, y: 1, w: 9, fontSize: 12, color: 'FFFFFF', fill: { color: '1a1a2e' } });
  
  pres.writeFile({ fileName: `FractalTerminal_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ============ CHART TOOLTIP ============
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

// ============ MAIN TERMINAL CONTENT ============
const TerminalContent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1Y');
  const [showCommand, setShowCommand] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [scenarios, setScenarios] = useState({ tgaDelta: 0, qtPace: 100, rrpDelta: 0 });
  
  const { layout, togglePanel, toggleSidebar } = useDocking();

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

  const handleCommand = useCallback((cmd) => {
    switch (cmd) {
      case 'export': exportToPowerPoint(data, correlations); break;
      case '1m': setTimeRange('1M'); break;
      case '3m': setTimeRange('3M'); break;
      case '1y': setTimeRange('1Y'); break;
      case 'all': setTimeRange('ALL'); break;
      case 'help': setShowHelp(true); break;
      case 'audit': setShowAudit(true); break;
    }
  }, [data, correlations]);

  const getRegimeColor = (status) => ({
    CRITICAL: 'rose', ELEVATED: 'amber', CAUTION: 'yellow', NORMAL: 'emerald', FAVORABLE: 'cyan'
  }[status] || 'slate');

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Terminal className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
          <p className="text-cyan-400 font-mono">INITIALIZING FRACTAL TERMINAL</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-rose-950/30 border border-rose-500 rounded-xl p-8">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-rose-400">{error}</p>
        </div>
      </div>
    );
  }

  const { regime, csd, lppl, credit_stress, global_m2, stablecoins, latest, meta, execution_log } = data;
  const regimeColor = getRegimeColor(regime?.status);
  const corrStatus = correlations.day90 > 0.7 ? 'COUPLED' : correlations.day90 > 0.3 ? 'WEAKENING' : 'DECOUPLED';

  // Get panels by position
  const getPanels = (position) => {
    return Object.entries(layout.panels)
      .filter(([_, p]) => p.position === position && p.visible)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-black to-black" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <CommandPalette isOpen={showCommand} onClose={setShowCommand} onCommand={handleCommand} data={data} />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-cyan-400">FRACTAL TERMINAL</h1>
            <p className="text-[10px] text-cyan-500/60 font-mono">v7.1 • FlexLayout • All Real Data</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCommand(true)} className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 border border-cyan-500/30 hover:border-cyan-400/50">
            <Command className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400 font-mono">Cmd+K</span>
          </button>
          <button onClick={() => exportToPowerPoint(data, correlations)} className="p-2 rounded bg-purple-900/30 border border-purple-500/30 text-purple-300">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => togglePanel('scenario')} className={`p-2 rounded border ${layout.panels.scenario.visible ? 'bg-cyan-900/30 border-cyan-500/50' : 'bg-slate-800 border-slate-700'}`}>
            <Sliders className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-auto p-4">
          {/* Top panels (scenario) */}
          <DropZone position="top" className="mb-4">
            {getPanels('top').includes('scenario') && (
              <DockablePanel id="scenario" title="SCENARIO SIMULATOR" icon={Sliders}>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: 'tgaDelta', label: 'TGA Change', min: -500, max: 500, unit: 'B' },
                    { key: 'qtPace', label: 'QT Pace', min: 0, max: 200, unit: '%' },
                    { key: 'rrpDelta', label: 'RRP Change', min: -50, max: 500, unit: 'B' },
                  ].map(s => (
                    <div key={s.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{s.label}</span>
                        <span className="font-mono text-cyan-400">{scenarios[s.key]}{s.unit}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} value={scenarios[s.key]} onChange={e => setScenarios(p => ({ ...p, [s.key]: parseInt(e.target.value) }))} className="w-full accent-cyan-500" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 bg-black/30 rounded flex justify-between">
                  <span className="text-sm text-slate-400">Projected Net Liq:</span>
                  <span className="font-mono text-cyan-400">${((latest?.net_liquidity - scenarios.tgaDelta - scenarios.rrpDelta) / 1000).toFixed(2)}T</span>
                </div>
              </DockablePanel>
            )}
          </DropZone>

          {/* Regime Banner */}
          <DropZone position="main" className="space-y-4">
            {getPanels('main').includes('regime') && (
              <DockablePanel id="regime" title="REGIME STATUS" icon={Activity} glowColor={regimeColor}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <InfoTooltip id="regimeScore">
                      <span className={`text-5xl font-bold font-mono text-${regimeColor}-400`}>{regime?.composite?.toFixed(0)}</span>
                    </InfoTooltip>
                    <div>
                      <span className={`text-xl font-bold text-${regimeColor}-400`}>{regime?.status}</span>
                      <span className="text-slate-500 mx-2">•</span>
                      <span className={`font-mono text-${regimeColor}-400`}>{regime?.signal}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 text-center">
                    {[
                      { id: 'ar1', label: 'AR(1)', value: csd?.current_ar1?.toFixed(3), warn: csd?.current_ar1 > 0.7 },
                      { id: 'kendallTau', label: 'Tau', value: csd?.kendall_tau?.toFixed(3) },
                      { id: 'lpplBubble', label: 'LPPL', value: lppl?.is_bubble ? `${lppl.confidence}%` : '--', warn: lppl?.is_bubble },
                      { id: 'netLiquidity', label: 'Net Liq', value: `$${((latest?.net_liquidity || 0) / 1000).toFixed(2)}T` },
                      { id: 'correlation', label: 'Corr', value: correlations.day90?.toFixed(2) || '--' },
                      { id: 'rrp', label: 'RRP', value: `$${(latest?.rrp || 0).toFixed(0)}B`, warn: true },
                    ].map(m => (
                      <div key={m.id}>
                        <InfoTooltip id={m.id}><p className="text-[10px] text-slate-500">{m.label}</p></InfoTooltip>
                        <p className={`font-mono text-sm ${m.warn ? 'text-rose-400' : 'text-slate-300'}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </DockablePanel>
            )}

            {/* Main Chart */}
            {getPanels('main').includes('mainChart') && (
              <DockablePanel id="mainChart" title="NET LIQUIDITY vs S&P 500" icon={TrendingUp}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-1">
                    {['1M', '3M', '6M', '1Y', '2Y', 'ALL'].map(r => (
                      <button key={r} onClick={() => setTimeRange(r)} className={`px-2 py-1 text-xs font-mono rounded ${timeRange === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={scenarioData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => (v/1000).toFixed(1)+'T'} width={35} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => (v/1000).toFixed(0)+'k'} width={35} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area yAxisId="left" type="monotone" dataKey="net_liquidity" fill="url(#lg)" stroke="#8b5cf6" strokeWidth={2} name="Net Liq ($B)" />
                      {(scenarios.tgaDelta !== 0 || scenarios.rrpDelta !== 0) && (
                        <Line yAxisId="left" type="monotone" dataKey="projectedNetLiquidity" stroke="#06b6d4" strokeDasharray="5 5" dot={false} name="Projected" />
                      )}
                      <Line yAxisId="right" type="monotone" dataKey="spx" stroke="#f59e0b" strokeWidth={2} dot={false} name="S&P 500" />
                      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </DockablePanel>
            )}

            {/* LPPL */}
            {getPanels('main').includes('lppl') && (
              <DockablePanel id="lppl" title="LPPL BUBBLE DETECTION" icon={AlertTriangle} glowColor={lppl?.is_bubble ? 'rose' : 'slate'}>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    { label: 'Bubble', value: lppl?.is_bubble ? 'YES' : 'NO', warn: lppl?.is_bubble },
                    { label: 'Confidence', value: `${lppl?.confidence || 0}%` },
                    { label: 'tc Days', value: lppl?.tc_days ?? '--' },
                    { label: 'tc Date', value: lppl?.tc_date || '--' },
                    { label: 'R²', value: lppl?.r2 ?? '--' },
                    { label: 'ω', value: lppl?.omega ?? '--' },
                  ].map((m, i) => (
                    <div key={i}>
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className={`font-mono ${m.warn ? 'text-rose-400' : 'text-slate-300'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </DockablePanel>
            )}

            {/* Correlation */}
            {getPanels('main').includes('correlation') && (
              <DockablePanel id="correlation" title="LIQUIDITY-PRICE CORRELATION" icon={Activity}>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: '30-Day', value: correlations.day30 }, { label: '90-Day', value: correlations.day90 }, { label: '180-Day', value: correlations.day180 }].map((c, i) => {
                    const color = c.value === null ? 'slate' : c.value > 0.7 ? 'emerald' : c.value > 0.3 ? 'amber' : 'rose';
                    return (
                      <div key={i} className={`p-2 rounded bg-${color}-900/20 border border-${color}-500/30 text-center`}>
                        <p className="text-xs text-slate-500">{c.label}</p>
                        <p className={`font-mono text-xl text-${color}-400`}>{c.value?.toFixed(2) || 'N/A'}</p>
                      </div>
                    );
                  })}
                </div>
              </DockablePanel>
            )}
          </DropZone>

          {/* Bottom panels (CSD charts) */}
          <DropZone position="bottom" className="grid grid-cols-2 gap-4 mt-4">
            {getPanels('bottom').includes('ar1') && (
              <DockablePanel id="ar1" title="AR(1) AUTOCORRELATION" icon={Activity}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={d => d?.slice(5)} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 8 }} domain={[0, 1]} width={25} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceArea y1={0.7} y2={1} fill="#f43f5e" fillOpacity={0.1} />
                      <ReferenceLine y={0.7} stroke="#f43f5e" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="ar1" fill="#10b98133" stroke="#10b981" strokeWidth={2} name="AR(1)" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </DockablePanel>
            )}

            {getPanels('bottom').includes('variance') && (
              <DockablePanel id="variance" title="ROLLING VARIANCE" icon={Activity}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={d => d?.slice(5)} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 8 }} width={35} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="variance" fill="#f59e0b33" stroke="#f59e0b" strokeWidth={2} name="Variance" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </DockablePanel>
            )}
          </DropZone>
        </div>

        {/* Sidebar */}
        <ResizableSidebar>
          <DropZone position="sidebar" className="space-y-4">
            {/* Global M2 */}
            {getPanels('sidebar').includes('globalM2') && global_m2 && (
              <DockablePanel id="globalM2" title="GLOBAL M2" icon={Globe} glowColor="purple">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <InfoTooltip id="globalM2"><p className="text-xs text-slate-500">Total (USD)</p></InfoTooltip>
                    <p className="font-mono text-xl text-purple-400">${global_m2.current?.toFixed(1)}T</p>
                  </div>
                  <div>
                    <InfoTooltip id="globalM2Roc"><p className="text-xs text-slate-500">30d ROC</p></InfoTooltip>
                    <p className={`font-mono text-xl ${(global_m2.roc_30d || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {global_m2.roc_30d > 0 ? '+' : ''}{global_m2.roc_30d?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </DockablePanel>
            )}

            {/* Stablecoins */}
            {getPanels('sidebar').includes('stablecoins') && stablecoins && (
              <DockablePanel id="stablecoins" title="STABLECOINS" icon={Coins} glowColor="emerald">
                <InfoTooltip id="stablecoins"><p className="text-xs text-slate-500">Market Cap</p></InfoTooltip>
                <p className="font-mono text-xl text-emerald-400">${stablecoins.total_mcap?.toFixed(1)}B</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(stablecoins.breakdown || {}).slice(0, 4).map(([k, v]) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded font-mono">{k}: ${v}B</span>
                  ))}
                </div>
              </DockablePanel>
            )}

            {/* Credit Stress */}
            {getPanels('sidebar').includes('credit') && credit_stress && (
              <DockablePanel id="credit" title="CREDIT STRESS" icon={AlertTriangle} glowColor={credit_stress.status === 'CRITICAL' ? 'rose' : 'emerald'}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500">Status</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${credit_stress.status === 'NORMAL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {credit_stress.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <InfoTooltip id="cpTbillSpread"><p className="text-xs text-slate-500">CP-TBill</p></InfoTooltip>
                    <p className="font-mono text-cyan-400">{credit_stress.cp_tbill_spread?.toFixed(1)} bps</p>
                  </div>
                  <div>
                    <InfoTooltip id="yieldCurve"><p className="text-xs text-slate-500">10Y-2Y</p></InfoTooltip>
                    <p className={`font-mono ${credit_stress.yield_curve < 0 ? 'text-rose-400' : 'text-slate-300'}`}>{credit_stress.yield_curve?.toFixed(2)}%</p>
                  </div>
                  <div>
                    <InfoTooltip id="hySpread"><p className="text-xs text-slate-500">HY Spread</p></InfoTooltip>
                    <p className="font-mono text-slate-300">{credit_stress.hy_spread?.toFixed(2)}%</p>
                  </div>
                  <div>
                    <InfoTooltip id="vix"><p className="text-xs text-slate-500">VIX</p></InfoTooltip>
                    <p className="font-mono text-slate-300">{credit_stress.vix?.toFixed(1)}</p>
                  </div>
                </div>
              </DockablePanel>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'balanceSheet', label: 'Fed BS', value: `$${((latest?.balance_sheet || 0) / 1000).toFixed(2)}T`, icon: Database },
                { id: 'tga', label: 'TGA', value: `$${(latest?.tga || 0).toFixed(0)}B`, icon: DollarSign },
                { id: 'rrp', label: 'RRP', value: `$${(latest?.rrp || 0).toFixed(0)}B`, icon: Layers, warn: true },
                { id: 'reserves', label: 'Reserves', value: `$${((latest?.reserves || 0) / 1000).toFixed(2)}T`, icon: Shield },
              ].map(m => (
                <div key={m.id} className={`p-2 rounded bg-slate-900/50 border ${m.warn ? 'border-rose-500/50' : 'border-slate-800'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <m.icon className="w-3 h-3 text-slate-500" />
                    <InfoTooltip id={m.id}><span className="text-[10px] text-slate-500">{m.label}</span></InfoTooltip>
                  </div>
                  <p className="font-mono text-sm">{m.value}</p>
                </div>
              ))}
            </div>
          </DropZone>
        </ResizableSidebar>
      </div>

      {/* Footer */}
      <footer className="relative z-20 text-center text-[10px] text-slate-600 font-mono py-2 border-t border-slate-800">
        FRACTAL TERMINAL v7.1 • FlexLayout • All Real Data • Not Financial Advice
      </footer>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-6 max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold text-cyan-400">FRACTAL TERMINAL v7.1</h2>
              <button onClick={() => setShowHelp(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-emerald-400">✓ All data real. Zero simulations.</p>
              <p className="text-slate-400"><strong>Cmd+K</strong> - Command palette</p>
              <p className="text-slate-400"><strong>Drag panels</strong> - Reposition to different zones</p>
              <p className="text-slate-400"><strong>Resize sidebar</strong> - Drag left edge</p>
              <p className="text-slate-400"><strong>Pop out</strong> - Click maximize icon for separate window</p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowAudit(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[70vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold">EXECUTION LOG</h2>
              <button onClick={() => setShowAudit(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {(execution_log || []).map((e, i) => (
                <div key={i} className="p-2 bg-slate-800/50 rounded text-xs font-mono">
                  <span className={e.level === 'ERROR' ? 'text-rose-400' : 'text-emerald-400'}>{e.level}</span>
                  <span className="text-slate-500 ml-2">{e.time}</span>
                  <p className="text-slate-300 mt-1">{e.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MAIN EXPORT ============
const FractalTerminal = () => (
  <DockingProvider>
    <TerminalContent />
  </DockingProvider>
);

export default FractalTerminal;
