#!/usr/bin/env python3
"""
FLR Tracker V3.3 - FULLY SELF-CONTAINED
========================================

All statistical methods implemented manually - NO external dependencies that can fail.

LPPL is now implemented using grid search optimization (no lppls library needed).
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import traceback
import math

# ============ CONFIGURATION ============
CONFIG = {
    "start_date": "2015-01-01",
    "validation": {
        "WALCL": {"min": 6000, "max": 7500, "unit": "billions"},
        "RRP": {"min": 0, "max": 100, "unit": "billions"},
        "TGA": {"min": 500, "max": 1200, "unit": "billions"},
        "SP500": {"min": 4000, "max": 8000, "unit": "index"},
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
    
    logger.info(f"Fetching FRED series: {series_id}")
    
    try:
        data = fred.get_series(series_id, observation_start=start_date)
        data = data.dropna()
        
        if len(data) == 0:
            raise ValueError(f"No data returned for {series_id}")
        
        latest_date = str(data.index[-1].date())
        latest_value = float(data.iloc[-1])
        
        meta = {
            "series_id": series_id,
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
    logger.info(f"Fetching NOAA solar data")
    
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

# ============ VALIDATION ============
def validate_data(series_id: str, value: float) -> bool:
    """Validate that fetched data is within expected ranges"""
    if series_id not in CONFIG["validation"]:
        return True
    
    rule = CONFIG["validation"][series_id]
    
    if series_id == "WALCL":
        value_b = value / 1000
    elif series_id == "RRP":
        value_b = value
    elif series_id == "TGA":
        value_b = value / 1000
    else:
        value_b = value
    
    if value_b < rule["min"] or value_b > rule["max"]:
        logger.warning(f"Value outside expected range for {series_id}", {
            "value": f"{value_b:,.2f}",
            "expected": f"{rule['min']:,} - {rule['max']:,}"
        })
        return False
    
    logger.success(f"Validated {series_id}", {"value": f"{value_b:,.2f}"})
    return True

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

# ============ LPPL ANALYSIS (MANUAL IMPLEMENTATION) ============
def compute_lppl(prices: List[float]) -> dict:
    """
    Log-Periodic Power Law bubble detection.
    
    LPPL equation: ln(p(t)) = A + B(tc-t)^m + C(tc-t)^m * cos(ω*ln(tc-t) + φ)
    
    Uses grid search optimization - no external libraries needed.
    
    References:
    - Sornette (2003) "Why Stock Markets Crash"
    - Johansen & Sornette (1999) "Critical Crashes"
    """
    import numpy as np
    
    logger.info("Computing LPPL bubble detection (manual implementation)")
    
    try:
        prices = np.array(prices)
        n = len(prices)
        
        if n < 100:
            logger.warning("Insufficient data for LPPL")
            return _lppl_no_bubble("Insufficient data (need 100+ points)")
        
        # Use last 500 days for bubble detection
        lookback = min(500, n)
        recent_prices = prices[-lookback:]
        log_prices = np.log(recent_prices)
        t = np.arange(lookback)
        
        best_fit = None
        best_r2 = -np.inf
        
        # Grid search over LPPL parameters
        # tc: critical time (days from end of series)
        # m: power law exponent (0.1-0.9 per Sornette)
        # omega: log-periodic frequency (6-13 per Sornette)
        # phi: phase (0-2π)
        
        tc_range = range(lookback + 10, lookback + 250, 20)  # 10-250 days out
        m_range = [0.2, 0.33, 0.5, 0.67, 0.8]
        omega_range = [6, 7, 8, 9, 10, 11, 12]
        phi_range = [0, np.pi/2, np.pi, 3*np.pi/2]
        
        for tc in tc_range:
            for m in m_range:
                for omega in omega_range:
                    for phi in phi_range:
                        # Build design matrix for linear regression
                        # ln(p) = A + B*f(t) + C*g(t)
                        # where f(t) = (tc-t)^m, g(t) = (tc-t)^m * cos(ω*ln(tc-t) + φ)
                        
                        dt = tc - t
                        if np.any(dt <= 0):
                            continue
                        
                        dtm = np.power(dt, m)
                        f_t = dtm
                        g_t = dtm * np.cos(omega * np.log(dt) + phi)
                        
                        # Solve via OLS: [1, f_t, g_t] @ [A, B, C] = log_prices
                        X = np.column_stack([np.ones(lookback), f_t, g_t])
                        
                        try:
                            # Normal equations: (X'X)^-1 X'y
                            XtX = X.T @ X
                            Xty = X.T @ log_prices
                            coeffs = np.linalg.solve(XtX, Xty)
                            A, B, C = coeffs
                        except np.linalg.LinAlgError:
                            continue
                        
                        # Sornette constraints:
                        # B < 0 (finite-time singularity)
                        # |C| < |B| (oscillations subordinate to trend)
                        if B >= 0 or abs(C) > abs(B):
                            continue
                        
                        # Calculate R²
                        predicted = A + B * f_t + C * g_t
                        ss_res = np.sum((log_prices - predicted) ** 2)
                        ss_tot = np.sum((log_prices - np.mean(log_prices)) ** 2)
                        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
                        
                        if r2 > best_r2 and r2 > 0.7:
                            best_r2 = r2
                            best_fit = {
                                "tc": tc,
                                "A": A,
                                "B": B,
                                "C": C,
                                "m": m,
                                "omega": omega,
                                "phi": phi,
                                "r2": r2
                            }
        
        if best_fit is None or best_fit["r2"] < 0.7:
            logger.info("No bubble signature detected")
            return _lppl_no_bubble("No pattern matches LPPL criteria (R² < 0.7)")
        
        # Calculate days to critical time
        tc_days = best_fit["tc"] - lookback + 1
        
        # Determine if valid bubble
        m_valid = 0.1 < best_fit["m"] < 0.9
        omega_valid = 6 < best_fit["omega"] < 13
        tc_valid = 5 < tc_days < 365
        
        is_bubble = all([m_valid, omega_valid, tc_valid])
        confidence = int(min(100, max(0, (best_fit["r2"] - 0.7) / 0.25 * 100))) if is_bubble else 0
        
        # Calculate tc_date
        from datetime import datetime, timedelta
        tc_date = (datetime.now() + timedelta(days=tc_days)).strftime('%Y-%m-%d') if tc_valid else None
        
        result = {
            "is_bubble": is_bubble,
            "confidence": confidence,
            "tc_days": tc_days if tc_valid else None,
            "tc_date": tc_date,
            "r2": round(best_fit["r2"], 4),
            "omega": round(best_fit["omega"], 2),
            "m": round(best_fit["m"], 3),
            "status": "BUBBLE_DETECTED" if is_bubble else "NO_BUBBLE"
        }
        
        if is_bubble:
            logger.warning("BUBBLE SIGNATURE DETECTED", {
                "confidence": f"{confidence}%",
                "tc_days": tc_days,
                "r2": f"{best_fit['r2']:.3f}"
            })
        else:
            logger.success("No bubble detected", {"best_r2": f"{best_fit['r2']:.3f}"})
        
        return result
        
    except Exception as e:
        logger.error(f"LPPL computation error: {e}")
        traceback.print_exc()
        return _lppl_no_bubble(f"Computation error: {str(e)}")

def _lppl_no_bubble(reason: str) -> dict:
    """Return a no-bubble result with explanation"""
    return {
        "is_bubble": False,
        "confidence": 0,
        "tc_days": None,
        "tc_date": None,
        "r2": None,
        "omega": None,
        "m": None,
        "status": reason
    }

# ============ MAIN ============
def main():
    import pandas as pd
    import numpy as np
    
    print("=" * 70)
    print("FLR TRACKER V3.3 - FULLY SELF-CONTAINED")
    print(f"Execution Time: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)
    
    # Check API key
    fred_api_key = os.environ.get('FRED_API_KEY')
    if not fred_api_key:
        logger.critical("FRED_API_KEY not set!")
        sys.exit(1)
    
    logger.info("API key found")
    
    # Initialize FRED
    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_api_key)
        logger.success("FRED API initialized")
    except Exception as e:
        logger.critical(f"FRED API init failed: {e}")
        sys.exit(1)
    
    # Fetch all series
    print("\n" + "=" * 70)
    print("PHASE 1: DATA FETCHING")
    print("=" * 70)
    
    try:
        walcl, walcl_meta = fetch_fred_series(fred, "WALCL", CONFIG["start_date"])
        rrp, rrp_meta = fetch_fred_series(fred, "RRPONTSYD", CONFIG["start_date"])
        tga, tga_meta = fetch_fred_series(fred, "WTREGEN", CONFIG["start_date"])
        reserves, reserves_meta = fetch_fred_series(fred, "WRESBAL", CONFIG["start_date"])
        sp500, sp500_meta = fetch_fred_series(fred, "SP500", CONFIG["start_date"])
        solar, solar_meta = fetch_noaa_solar()
    except Exception as e:
        logger.critical(f"Data fetching failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # Validate
    print("\n" + "=" * 70)
    print("PHASE 2: VALIDATION")
    print("=" * 70)
    
    validate_data("WALCL", float(walcl.iloc[-1]))
    validate_data("RRP", float(rrp.iloc[-1]))
    validate_data("TGA", float(tga.iloc[-1]))
    validate_data("SP500", float(sp500.iloc[-1]))
    
    # Build time series
    print("\n" + "=" * 70)
    print("PHASE 3: TIME SERIES")
    print("=" * 70)
    
    df = pd.DataFrame(index=sp500.index)
    df['spx'] = sp500
    df['balance_sheet'] = walcl / 1000
    df['tga'] = tga / 1000
    df['rrp'] = rrp
    df['reserves'] = reserves / 1000
    
    for col in ['balance_sheet', 'tga', 'reserves', 'rrp']:
        df[col] = df[col].ffill()
    
    df['net_liquidity'] = df['balance_sheet'] - df['tga'] - df['rrp']
    
    # Solar
    df['year_month'] = df.index.to_period('M')
    solar['year_month'] = solar.index.to_period('M')
    solar_monthly = solar.groupby('year_month').last()
    df = df.join(solar_monthly[['ssn', 'f10.7']], on='year_month')
    df['ssn'] = df['ssn'].ffill()
    df['f10.7'] = df['f10.7'].ffill()
    df = df.drop(columns=['year_month'])
    df = df.dropna(subset=['spx', 'net_liquidity'])
    
    logger.success("Time series built", {"records": len(df)})
    
    # Latest values
    latest = df.iloc[-1]
    print("\n" + "=" * 70)
    print("🎯 LATEST VALUES")
    print("=" * 70)
    print(f"Date:           {latest.name.date()}")
    print(f"S&P 500:        {latest['spx']:,.2f}")
    print(f"Fed BS:         ${latest['balance_sheet']:,.1f}B (${latest['balance_sheet']/1000:.2f}T)")
    print(f"TGA:            ${latest['tga']:,.1f}B")
    print(f"RRP:            ${latest['rrp']:,.1f}B")
    print(f"Net Liquidity:  ${latest['net_liquidity']:,.1f}B")
    print("=" * 70)
    
    # CSD
    print("\n" + "=" * 70)
    print("PHASE 4: CSD ANALYSIS")
    print("=" * 70)
    
    prices = df['spx'].values
    csd = compute_csd(prices.tolist())
    
    # LPPL
    print("\n" + "=" * 70)
    print("PHASE 5: LPPL ANALYSIS")
    print("=" * 70)
    
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
    
    logger.success("Regime calculated", {"status": status, "score": f"{composite:.1f}"})
    
    # Build output
    timeseries = []
    for idx, row in df.iterrows():
        i = df.index.get_loc(idx)
        timeseries.append({
            "date": str(idx.date()),
            "spx": round(float(row['spx']), 2),
            "balance_sheet": round(float(row['balance_sheet']), 1),
            "tga": round(float(row['tga']), 1),
            "rrp": round(float(row['rrp']), 1),
            "net_liquidity": round(float(row['net_liquidity']), 1),
            "ssn": round(float(row['ssn']), 0) if pd.notna(row['ssn']) else None,
            "trend": round(csd['trend'][i], 2) if i < len(csd['trend']) else None,
            "ar1": csd['ar1'][i] if i < len(csd['ar1']) else None,
            "variance": csd['variance'][i] if i < len(csd['variance']) else None
        })
    
    output = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "3.3.0",
            "methodology": {
                "csd": "Scheffer et al. (2009) / Dakos et al. (2012)",
                "lppl": "Sornette (2003) - Manual grid search implementation"
            },
            "data_sources": {
                "WALCL": walcl_meta,
                "RRPONTSYD": rrp_meta,
                "WTREGEN": tga_meta,
                "WRESBAL": reserves_meta,
                "SP500": sp500_meta,
                "SOLAR": solar_meta
            }
        },
        "regime": regime,
        "csd": {
            "current_ar1": csd['current_ar1'],
            "current_variance": csd['current_variance'],
            "kendall_tau": csd['kendall_tau'],
            "status": csd['status']
        },
        "lppl": lppl,
        "latest": {
            "date": str(latest.name.date()),
            "spx": round(float(latest['spx']), 2),
            "balance_sheet": round(float(latest['balance_sheet']), 1),
            "tga": round(float(latest['tga']), 1),
            "rrp": round(float(latest['rrp']), 1),
            "reserves": round(float(latest['reserves']), 1) if pd.notna(latest['reserves']) else None,
            "net_liquidity": round(float(latest['net_liquidity']), 1),
            "ssn": round(float(latest['ssn']), 0) if pd.notna(latest['ssn']) else None,
            "f10.7": round(float(latest['f10.7']), 1) if pd.notna(latest['f10.7']) else None
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
    print("✅ COMPLETE")
    print("=" * 70)
    print(f"Records: {len(timeseries)}")
    print(f"Regime: {status} ({composite:.1f})")
    print(f"LPPL: {'BUBBLE' if lppl['is_bubble'] else 'No bubble'} (R²={lppl['r2']})")
    print("=" * 70)


if __name__ == "__main__":
    main()
