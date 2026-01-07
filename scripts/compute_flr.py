#!/usr/bin/env python3
"""
FRACTAL TERMINAL V6.0 - CLEAN EDITION
======================================

ALL DATA IS REAL. ZERO SIMULATIONS.

Data Sources (All Free):
- FRED: WALCL, WTREGEN, RRPONTSYD, WRESBAL, SP500
- FRED: RIFSPPFAAD90NB, TB3MS (Credit Stress)
- FRED: T10Y2Y (Yield Curve)
- FRED: BAMLH0A0HYM2 (High Yield Spread)
- FRED: VIXCLS (Volatility Index)
- NOAA: Solar Cycle Data

Removed (Required Paid APIs):
- GEX (needs ThetaData ~$40/mo)
- DIX (needs FINRA pipeline infrastructure)
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import traceback

# ============ CONFIGURATION ============
CONFIG = {
    "start_date": "2015-01-01",
    "fred_series": {
        # Core Liquidity
        "WALCL": "Fed Balance Sheet (Total Assets)",
        "WTREGEN": "Treasury General Account",
        "RRPONTSYD": "Reverse Repo Facility",
        "WRESBAL": "Bank Reserves",
        "SP500": "S&P 500 Index",
        # Credit Stress (NEW - ALL FREE)
        "RIFSPPFAAD90NB": "3-Month AA Financial Commercial Paper Rate",
        "TB3MS": "3-Month Treasury Bill Rate",
        "T10Y2Y": "10Y-2Y Treasury Spread (Yield Curve)",
        "BAMLH0A0HYM2": "ICE BofA High Yield Spread",
        "VIXCLS": "CBOE Volatility Index (VIX)",
    }
}

# ============ LOGGING ============
class Logger:
    def __init__(self):
        self.entries = []
        
    def log(self, level: str, msg: str, data: dict = None):
        entry = {
            "time": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": msg,
            "data": data
        }
        self.entries.append(entry)
        icon = {"INFO": "ℹ️", "SUCCESS": "✅", "WARNING": "⚠️", "ERROR": "❌", "CRITICAL": "🚨"}.get(level, "•")
        print(f"{icon} [{level}] {msg}")
        if data:
            for k, v in data.items():
                print(f"    {k}: {v}")
    
    def info(self, msg, data=None): self.log("INFO", msg, data)
    def success(self, msg, data=None): self.log("SUCCESS", msg, data)
    def warning(self, msg, data=None): self.log("WARNING", msg, data)
    def error(self, msg, data=None): self.log("ERROR", msg, data)
    def critical(self, msg, data=None): self.log("CRITICAL", msg, data)

logger = Logger()

# ============ DATA FETCHING ============
def fetch_fred_series(fred, series_id: str, start_date: str) -> Tuple[Any, dict]:
    """Fetch a FRED series with full metadata"""
    import pandas as pd
    
    logger.info(f"Fetching FRED: {series_id}")
    
    try:
        data = fred.get_series(series_id, observation_start=start_date)
        data = data.dropna()
        
        if len(data) == 0:
            raise ValueError(f"No data returned for {series_id}")
        
        latest_date = str(data.index[-1].date())
        latest_value = float(data.iloc[-1])
        
        meta = {
            "series_id": series_id,
            "description": CONFIG["fred_series"].get(series_id, series_id),
            "records": len(data),
            "first_date": str(data.index[0].date()),
            "last_date": latest_date,
            "latest_value": latest_value,
            "source_url": f"https://fred.stlouisfed.org/series/{series_id}"
        }
        
        logger.success(f"Fetched {series_id}", {
            "records": len(data),
            "latest": f"{latest_value:,.2f}",
            "date": latest_date
        })
        
        return data, meta
        
    except Exception as e:
        logger.error(f"Failed to fetch {series_id}", {"error": str(e)})
        raise

def fetch_noaa_solar() -> Tuple[Any, dict]:
    """Fetch solar data from NOAA"""
    import pandas as pd
    import requests
    
    url = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"
    logger.info("Fetching NOAA solar data")
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        raw = response.json()
        
        records = []
        for entry in raw:
            if entry.get('ssn') is not None:
                date_str = entry.get('time-tag', '')[:10]
                if date_str:
                    records.append({
                        'date': date_str,
                        'ssn': float(entry['ssn']),
                        'f10.7': float(entry.get('f10.7', 0)) if entry.get('f10.7') else None
                    })
        
        df = pd.DataFrame(records)
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').sort_index()
        
        latest = df.iloc[-1]
        meta = {
            "records": len(df),
            "last_date": str(df.index[-1].date()),
            "latest_ssn": float(latest['ssn']),
            "source_url": url
        }
        
        logger.success("Fetched NOAA solar data", {"latest_ssn": f"{latest['ssn']:.0f}"})
        return df, meta
        
    except Exception as e:
        logger.error("Failed to fetch NOAA data", {"error": str(e)})
        raise

# ============ CSD ANALYSIS ============
def compute_csd(prices: List[float], bandwidth: int = 50, window: int = 250) -> dict:
    """Compute Critical Slowing Down indicators"""
    import numpy as np
    
    logger.info("Computing CSD indicators")
    
    prices = np.array(prices)
    n = len(prices)
    
    # Gaussian detrending
    trend = np.zeros(n)
    for i in range(n):
        weights = np.exp(-0.5 * ((np.arange(n) - i) / bandwidth) ** 2)
        weights /= weights.sum()
        trend[i] = np.sum(weights * prices)
    
    residuals = prices - trend
    
    # Rolling AR(1)
    ar1 = np.full(n, np.nan)
    for i in range(window + 1, n):
        w_curr = residuals[i-window:i]
        w_lag = residuals[i-window-1:i-1]
        if np.std(w_curr) > 0 and np.std(w_lag) > 0:
            ar1[i] = np.clip(np.corrcoef(w_curr, w_lag)[0, 1], -1, 1)
    
    # Rolling variance
    variance = np.full(n, np.nan)
    for i in range(window, n):
        variance[i] = np.var(residuals[i-window:i], ddof=1)
    
    # Kendall's tau
    valid_ar1 = ar1[~np.isnan(ar1)]
    tau = 0
    if len(valid_ar1) >= 100:
        recent = valid_ar1[-100:]
        concordant = discordant = 0
        for i in range(len(recent) - 1):
            for j in range(i + 1, len(recent)):
                diff = (j - i) * (recent[j] - recent[i])
                if diff > 0: concordant += 1
                elif diff < 0: discordant += 1
        pairs = len(recent) * (len(recent) - 1) / 2
        tau = (concordant - discordant) / pairs if pairs > 0 else 0
    
    current_ar1 = float(valid_ar1[-1]) if len(valid_ar1) > 0 else 0
    valid_var = variance[~np.isnan(variance)]
    current_var = float(valid_var[-1]) if len(valid_var) > 0 else 0
    
    if current_ar1 > 0.8: status = "CRITICAL"
    elif current_ar1 > 0.7: status = "ELEVATED"
    elif current_ar1 > 0.6: status = "RISING"
    else: status = "NORMAL"
    
    logger.success("CSD complete", {"ar1": f"{current_ar1:.4f}", "status": status})
    
    return {
        "trend": trend.tolist(),
        "ar1": [None if np.isnan(x) else round(x, 4) for x in ar1],
        "variance": [None if np.isnan(x) else round(x, 4) for x in variance],
        "current_ar1": round(current_ar1, 4),
        "current_variance": round(current_var, 4),
        "kendall_tau": round(tau, 4),
        "status": status
    }

# ============ LPPL ANALYSIS ============
def compute_lppl(prices: List[float]) -> dict:
    """Log-Periodic Power Law bubble detection (manual implementation)"""
    import numpy as np
    
    logger.info("Computing LPPL bubble detection")
    
    try:
        prices = np.array(prices)
        n = len(prices)
        
        if n < 100:
            return _lppl_result(False, 0, None, None, None, None, None, "Insufficient data")
        
        lookback = min(500, n)
        recent_prices = prices[-lookback:]
        log_prices = np.log(recent_prices)
        t = np.arange(lookback)
        
        best_fit = None
        best_r2 = -np.inf
        
        # Grid search
        tc_range = range(lookback + 10, lookback + 250, 20)
        m_range = [0.2, 0.33, 0.5, 0.67, 0.8]
        omega_range = [6, 7, 8, 9, 10, 11, 12]
        phi_range = [0, np.pi/2, np.pi, 3*np.pi/2]
        
        for tc in tc_range:
            for m in m_range:
                for omega in omega_range:
                    for phi in phi_range:
                        dt = tc - t
                        if np.any(dt <= 0):
                            continue
                        
                        dtm = np.power(dt, m)
                        f_t = dtm
                        g_t = dtm * np.cos(omega * np.log(dt) + phi)
                        
                        X = np.column_stack([np.ones(lookback), f_t, g_t])
                        
                        try:
                            XtX = X.T @ X
                            Xty = X.T @ log_prices
                            coeffs = np.linalg.solve(XtX, Xty)
                            A, B, C = coeffs
                        except np.linalg.LinAlgError:
                            continue
                        
                        if B >= 0 or abs(C) > abs(B):
                            continue
                        
                        predicted = A + B * f_t + C * g_t
                        ss_res = np.sum((log_prices - predicted) ** 2)
                        ss_tot = np.sum((log_prices - np.mean(log_prices)) ** 2)
                        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
                        
                        if r2 > best_r2 and r2 > 0.7:
                            best_r2 = r2
                            best_fit = {"tc": tc, "m": m, "omega": omega, "r2": r2}
        
        if best_fit is None or best_fit["r2"] < 0.7:
            return _lppl_result(False, 0, None, None, None, None, None, "No bubble signature (R² < 0.7)")
        
        tc_days = best_fit["tc"] - lookback + 1
        m_valid = 0.1 < best_fit["m"] < 0.9
        omega_valid = 6 < best_fit["omega"] < 13
        tc_valid = 5 < tc_days < 365
        
        is_bubble = all([m_valid, omega_valid, tc_valid])
        confidence = int(min(100, max(0, (best_fit["r2"] - 0.7) / 0.25 * 100))) if is_bubble else 0
        tc_date = (datetime.now() + timedelta(days=tc_days)).strftime('%Y-%m-%d') if tc_valid else None
        
        status = "BUBBLE DETECTED" if is_bubble else "No bubble signature"
        logger.success("LPPL complete", {"is_bubble": is_bubble, "r2": f"{best_fit['r2']:.3f}"})
        
        return _lppl_result(
            is_bubble, confidence,
            tc_days if tc_valid else None,
            tc_date,
            round(best_fit["r2"], 4),
            round(best_fit["omega"], 2),
            round(best_fit["m"], 3),
            status
        )
        
    except Exception as e:
        logger.error(f"LPPL error: {e}")
        return _lppl_result(False, 0, None, None, None, None, None, f"Error: {str(e)}")

def _lppl_result(is_bubble, confidence, tc_days, tc_date, r2, omega, m, status):
    return {
        "is_bubble": is_bubble,
        "confidence": confidence,
        "tc_days": tc_days,
        "tc_date": tc_date,
        "r2": r2,
        "omega": omega,
        "m": m,
        "status": status
    }

# ============ MAIN ============
def main():
    import pandas as pd
    import numpy as np
    
    print("=" * 70)
    print("FRACTAL TERMINAL V6.0 - ALL REAL DATA")
    print(f"Execution: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)
    
    # Check API key
    fred_api_key = os.environ.get('FRED_API_KEY')
    if not fred_api_key:
        logger.critical("FRED_API_KEY not set!")
        sys.exit(1)
    
    # Initialize FRED
    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_api_key)
        logger.success("FRED API initialized")
    except Exception as e:
        logger.critical(f"FRED init failed: {e}")
        sys.exit(1)
    
    # ========== FETCH ALL DATA ==========
    print("\n" + "=" * 70)
    print("PHASE 1: FETCHING ALL FRED SERIES")
    print("=" * 70)
    
    data_sources = {}
    
    # Core liquidity series
    try:
        walcl, walcl_meta = fetch_fred_series(fred, "WALCL", CONFIG["start_date"])
        data_sources["WALCL"] = walcl_meta
    except: 
        logger.critical("WALCL fetch failed")
        sys.exit(1)
    
    try:
        rrp, rrp_meta = fetch_fred_series(fred, "RRPONTSYD", CONFIG["start_date"])
        data_sources["RRPONTSYD"] = rrp_meta
    except:
        logger.critical("RRP fetch failed")
        sys.exit(1)
    
    try:
        tga, tga_meta = fetch_fred_series(fred, "WTREGEN", CONFIG["start_date"])
        data_sources["WTREGEN"] = tga_meta
    except:
        logger.critical("TGA fetch failed")
        sys.exit(1)
    
    try:
        reserves, reserves_meta = fetch_fred_series(fred, "WRESBAL", CONFIG["start_date"])
        data_sources["WRESBAL"] = reserves_meta
    except:
        logger.critical("Reserves fetch failed")
        sys.exit(1)
    
    try:
        sp500, sp500_meta = fetch_fred_series(fred, "SP500", CONFIG["start_date"])
        data_sources["SP500"] = sp500_meta
    except:
        logger.critical("SP500 fetch failed")
        sys.exit(1)
    
    # Credit stress series (NEW)
    try:
        cp_rate, cp_meta = fetch_fred_series(fred, "RIFSPPFAAD90NB", CONFIG["start_date"])
        data_sources["RIFSPPFAAD90NB"] = cp_meta
    except Exception as e:
        logger.warning(f"CP Rate fetch failed: {e}")
        cp_rate = None
    
    try:
        tbill_rate, tbill_meta = fetch_fred_series(fred, "TB3MS", CONFIG["start_date"])
        data_sources["TB3MS"] = tbill_meta
    except Exception as e:
        logger.warning(f"TBill fetch failed: {e}")
        tbill_rate = None
    
    try:
        yield_curve, yc_meta = fetch_fred_series(fred, "T10Y2Y", CONFIG["start_date"])
        data_sources["T10Y2Y"] = yc_meta
    except Exception as e:
        logger.warning(f"Yield curve fetch failed: {e}")
        yield_curve = None
    
    try:
        hy_spread, hy_meta = fetch_fred_series(fred, "BAMLH0A0HYM2", CONFIG["start_date"])
        data_sources["BAMLH0A0HYM2"] = hy_meta
    except Exception as e:
        logger.warning(f"HY spread fetch failed: {e}")
        hy_spread = None
    
    try:
        vix, vix_meta = fetch_fred_series(fred, "VIXCLS", CONFIG["start_date"])
        data_sources["VIXCLS"] = vix_meta
    except Exception as e:
        logger.warning(f"VIX fetch failed: {e}")
        vix = None
    
    # Solar data
    try:
        solar, solar_meta = fetch_noaa_solar()
        data_sources["SOLAR"] = solar_meta
    except Exception as e:
        logger.warning(f"Solar fetch failed: {e}")
        solar = None
    
    # ========== BUILD TIME SERIES ==========
    print("\n" + "=" * 70)
    print("PHASE 2: BUILDING UNIFIED TIME SERIES")
    print("=" * 70)
    
    df = pd.DataFrame(index=sp500.index)
    df['spx'] = sp500
    df['balance_sheet'] = walcl / 1000  # Millions → Billions
    df['tga'] = tga / 1000
    df['rrp'] = rrp
    df['reserves'] = reserves / 1000
    
    # Forward fill weekly data
    for col in ['balance_sheet', 'tga', 'reserves', 'rrp']:
        df[col] = df[col].ffill()
    
    # Net liquidity
    df['net_liquidity'] = df['balance_sheet'] - df['tga'] - df['rrp']
    
    # Credit stress indicators (NEW - ALL REAL)
    if cp_rate is not None and tbill_rate is not None:
        df['cp_rate'] = cp_rate
        df['tbill_rate'] = tbill_rate
        df['cp_rate'] = df['cp_rate'].ffill()
        df['tbill_rate'] = df['tbill_rate'].ffill()
        # CP-TBill spread in basis points
        df['cp_tbill_spread'] = (df['cp_rate'] - df['tbill_rate']) * 100
    else:
        df['cp_tbill_spread'] = None
    
    if yield_curve is not None:
        df['yield_curve'] = yield_curve
        df['yield_curve'] = df['yield_curve'].ffill()
    else:
        df['yield_curve'] = None
    
    if hy_spread is not None:
        df['hy_spread'] = hy_spread
        df['hy_spread'] = df['hy_spread'].ffill()
    else:
        df['hy_spread'] = None
    
    if vix is not None:
        df['vix'] = vix
        df['vix'] = df['vix'].ffill()
    else:
        df['vix'] = None
    
    # Solar data
    if solar is not None:
        df['year_month'] = df.index.to_period('M')
        solar['year_month'] = solar.index.to_period('M')
        solar_monthly = solar.groupby('year_month').last()
        df = df.join(solar_monthly[['ssn', 'f10.7']], on='year_month')
        df['ssn'] = df['ssn'].ffill()
        df['f10.7'] = df['f10.7'].ffill()
        df = df.drop(columns=['year_month'])
    else:
        df['ssn'] = None
        df['f10.7'] = None
    
    df = df.dropna(subset=['spx', 'net_liquidity'])
    
    logger.success("Time series built", {"records": len(df)})
    
    # Latest values
    latest = df.iloc[-1]
    print("\n" + "=" * 70)
    print("🎯 LATEST VALUES (ALL REAL - VERIFY AT FRED)")
    print("=" * 70)
    print(f"Date:           {latest.name.date()}")
    print(f"S&P 500:        {latest['spx']:,.2f}")
    print(f"Fed BS:         ${latest['balance_sheet']:,.1f}B")
    print(f"TGA:            ${latest['tga']:,.1f}B")
    print(f"RRP:            ${latest['rrp']:,.1f}B")
    print(f"Net Liquidity:  ${latest['net_liquidity']:,.1f}B")
    if pd.notna(latest.get('cp_tbill_spread')):
        print(f"CP-TBill Spread: {latest['cp_tbill_spread']:.1f} bps")
    if pd.notna(latest.get('yield_curve')):
        print(f"10Y-2Y Spread:  {latest['yield_curve']:.2f}%")
    if pd.notna(latest.get('hy_spread')):
        print(f"HY Spread:      {latest['hy_spread']:.2f}%")
    if pd.notna(latest.get('vix')):
        print(f"VIX:            {latest['vix']:.2f}")
    print("=" * 70)
    
    # ========== COMPUTE ANALYTICS ==========
    print("\n" + "=" * 70)
    print("PHASE 3: COMPUTING ANALYTICS")
    print("=" * 70)
    
    prices = df['spx'].values
    csd = compute_csd(prices.tolist())
    lppl = compute_lppl(prices.tolist())
    
    # Regime score
    ar1_score = min(100, max(0, (csd['current_ar1'] - 0.3) / 0.5 * 100))
    tau_score = min(100, max(0, (csd['kendall_tau'] + 0.5) / 1.0 * 100))
    lppl_score = lppl.get('confidence', 0) if lppl.get('is_bubble') else 0
    liq_score = min(100, max(0, (6500 - latest['net_liquidity']) / 20))
    
    composite = ar1_score * 0.35 + tau_score * 0.20 + lppl_score * 0.25 + liq_score * 0.20
    
    if composite > 70: status, signal = "CRITICAL", "STRONG SELL"
    elif composite > 55: status, signal = "ELEVATED", "REDUCE RISK"
    elif composite > 40: status, signal = "CAUTION", "HOLD"
    elif composite > 25: status, signal = "NORMAL", "ACCUMULATE"
    else: status, signal = "FAVORABLE", "STRONG BUY"
    
    regime = {
        "composite": round(composite, 1),
        "status": status,
        "signal": signal,
        "components": {
            "ar1_score": round(ar1_score, 1),
            "tau_score": round(tau_score, 1),
            "lppl_score": round(lppl_score, 1),
            "liquidity_score": round(liq_score, 1)
        }
    }
    
    # Credit stress assessment (REAL DATA)
    credit_stress = None
    if pd.notna(latest.get('cp_tbill_spread')):
        spread = latest['cp_tbill_spread']
        if spread > 50:
            stress_status = "CRITICAL"
        elif spread > 25:
            stress_status = "STRESSED"
        elif spread > 15:
            stress_status = "ELEVATED"
        else:
            stress_status = "NORMAL"
        
        credit_stress = {
            "cp_tbill_spread": round(spread, 1),
            "yield_curve": round(latest['yield_curve'], 2) if pd.notna(latest.get('yield_curve')) else None,
            "hy_spread": round(latest['hy_spread'], 2) if pd.notna(latest.get('hy_spread')) else None,
            "vix": round(latest['vix'], 2) if pd.notna(latest.get('vix')) else None,
            "status": stress_status
        }
    
    logger.success("Analytics complete", {"regime": status, "score": f"{composite:.1f}"})
    
    # ========== BUILD OUTPUT ==========
    print("\n" + "=" * 70)
    print("PHASE 4: BUILDING OUTPUT")
    print("=" * 70)
    
    timeseries = []
    for idx, row in df.iterrows():
        i = df.index.get_loc(idx)
        entry = {
            "date": str(idx.date()),
            "spx": round(float(row['spx']), 2),
            "balance_sheet": round(float(row['balance_sheet']), 1),
            "tga": round(float(row['tga']), 1),
            "rrp": round(float(row['rrp']), 1),
            "reserves": round(float(row['reserves']), 1) if pd.notna(row['reserves']) else None,
            "net_liquidity": round(float(row['net_liquidity']), 1),
            "trend": round(csd['trend'][i], 2) if i < len(csd['trend']) else None,
            "ar1": csd['ar1'][i] if i < len(csd['ar1']) else None,
            "variance": csd['variance'][i] if i < len(csd['variance']) else None,
        }
        
        # Add credit stress data (REAL)
        if pd.notna(row.get('cp_tbill_spread')):
            entry["cp_tbill_spread"] = round(float(row['cp_tbill_spread']), 1)
        if pd.notna(row.get('yield_curve')):
            entry["yield_curve"] = round(float(row['yield_curve']), 2)
        if pd.notna(row.get('hy_spread')):
            entry["hy_spread"] = round(float(row['hy_spread']), 2)
        if pd.notna(row.get('vix')):
            entry["vix"] = round(float(row['vix']), 2)
        if pd.notna(row.get('ssn')):
            entry["ssn"] = round(float(row['ssn']), 0)
        
        timeseries.append(entry)
    
    output = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "6.0.0",
            "data_integrity": "ALL_REAL_NO_SIMULATIONS",
            "methodology": {
                "csd": "Scheffer et al. (2009) / Dakos et al. (2012)",
                "lppl": "Sornette (2003) - Grid search implementation"
            },
            "data_sources": data_sources
        },
        "regime": regime,
        "csd": {
            "current_ar1": csd['current_ar1'],
            "current_variance": csd['current_variance'],
            "kendall_tau": csd['kendall_tau'],
            "status": csd['status']
        },
        "lppl": lppl,
        "credit_stress": credit_stress,
        "latest": {
            "date": str(latest.name.date()),
            "spx": round(float(latest['spx']), 2),
            "balance_sheet": round(float(latest['balance_sheet']), 1),
            "tga": round(float(latest['tga']), 1),
            "rrp": round(float(latest['rrp']), 1),
            "reserves": round(float(latest['reserves']), 1) if pd.notna(latest['reserves']) else None,
            "net_liquidity": round(float(latest['net_liquidity']), 1),
            "cp_tbill_spread": round(float(latest['cp_tbill_spread']), 1) if pd.notna(latest.get('cp_tbill_spread')) else None,
            "yield_curve": round(float(latest['yield_curve']), 2) if pd.notna(latest.get('yield_curve')) else None,
            "hy_spread": round(float(latest['hy_spread']), 2) if pd.notna(latest.get('hy_spread')) else None,
            "vix": round(float(latest['vix']), 2) if pd.notna(latest.get('vix')) else None,
            "ssn": round(float(latest['ssn']), 0) if pd.notna(latest.get('ssn')) else None,
        },
        "timeseries": timeseries,
        "date_range": {
            "start": str(df.index[0].date()),
            "end": str(df.index[-1].date())
        },
        "record_count": len(timeseries),
        "execution_log": logger.entries
    }
    
    # Write
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'flr-data.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print("\n" + "=" * 70)
    print("✅ COMPLETE - ALL DATA REAL")
    print("=" * 70)
    print(f"Records: {len(timeseries)}")
    print(f"Regime: {status} ({composite:.1f})")
    print(f"Credit Stress: {credit_stress['status'] if credit_stress else 'N/A'}")
    print("=" * 70)


if __name__ == "__main__":
    main()
