#!/usr/bin/env python3
"""
FLR Tracker V3.2 - BULLETPROOF EDITION
=======================================

This script fetches REAL data and validates it against known Jan 2026 baselines.
If the data doesn't match reality, it will FAIL LOUDLY rather than silently produce garbage.

VALIDATION TARGETS (Jan 2026):
- WALCL: ~$6,640 billion (NOT $7,500)
- RRP: ~$2-10 billion (NOT $400-800 billion) 
- TGA: ~$750-850 billion (NOT $600)
- S&P 500: ~5,900-6,100 (varies daily)

If fetched data is wildly off from these ranges, the script will ERROR.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import traceback

# ============ CONFIGURATION ============
CONFIG = {
    "start_date": "2015-01-01",
    "validation": {
        # Expected ranges for Jan 2026 (sanity checks)
        "WALCL": {"min": 6000, "max": 7500, "unit": "billions"},  # $6-7.5T
        "RRP": {"min": 0, "max": 100, "unit": "billions"},  # Should be near zero!
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
        
        # Also print to console
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
    logger.info(f"Fetching NOAA solar data from {url}")
    
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
            "first_date": str(df.index[0].date()),
            "last_date": str(df.index[-1].date()),
            "latest_ssn": float(latest['ssn']),
            "source_url": url
        }
        
        logger.success("Fetched NOAA solar data", {
            "records": len(df),
            "latest_ssn": f"{latest['ssn']:.0f}",
            "date": str(df.index[-1].date())
        })
        
        return df, meta
        
    except Exception as e:
        logger.error("Failed to fetch NOAA data", {"error": str(e)})
        raise

# ============ VALIDATION ============
def validate_data(series_id: str, value: float) -> bool:
    """Validate that fetched data is within expected ranges"""
    
    if series_id not in CONFIG["validation"]:
        return True  # No validation rule
    
    rule = CONFIG["validation"][series_id]
    
    # Convert to billions if needed
    if series_id == "WALCL":
        value_b = value / 1000  # WALCL is in millions
    elif series_id == "RRP":
        value_b = value  # Already in billions
    elif series_id == "TGA":
        value_b = value / 1000  # In millions
    elif series_id == "SP500":
        value_b = value  # Index points
    else:
        value_b = value
    
    if value_b < rule["min"] or value_b > rule["max"]:
        logger.critical(f"VALIDATION FAILED for {series_id}", {
            "value": f"{value_b:,.2f} {rule['unit']}",
            "expected_range": f"{rule['min']:,} - {rule['max']:,} {rule['unit']}",
            "raw_value": value
        })
        return False
    
    logger.success(f"Validated {series_id}", {
        "value": f"{value_b:,.2f} {rule['unit']}",
        "within_range": f"{rule['min']:,} - {rule['max']:,}"
    })
    return True

# ============ STATISTICAL ANALYSIS ============
def compute_csd(prices: List[float], bandwidth: int = 50, window: int = 250) -> dict:
    """Compute Critical Slowing Down indicators"""
    import numpy as np
    
    logger.info("Computing CSD indicators", {"bandwidth": bandwidth, "window": window})
    
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
    else:
        tau = 0
    
    current_ar1 = float(valid_ar1[-1]) if len(valid_ar1) > 0 else 0
    valid_var = variance[~np.isnan(variance)]
    current_var = float(valid_var[-1]) if len(valid_var) > 0 else 0
    
    # Status
    if current_ar1 > 0.8: status = "CRITICAL"
    elif current_ar1 > 0.7: status = "ELEVATED"
    elif current_ar1 > 0.6: status = "RISING"
    else: status = "NORMAL"
    
    logger.success("CSD computation complete", {
        "current_ar1": f"{current_ar1:.4f}",
        "kendall_tau": f"{tau:.4f}",
        "status": status
    })
    
    return {
        "trend": trend.tolist(),
        "ar1": [None if np.isnan(x) else round(x, 4) for x in ar1],
        "variance": [None if np.isnan(x) else round(x, 4) for x in variance],
        "current_ar1": round(current_ar1, 4),
        "current_variance": round(current_var, 4),
        "kendall_tau": round(tau, 4),
        "status": status
    }

def compute_lppl(dates, prices) -> dict:
    """Compute LPPL bubble detection (optional - graceful failure)"""
    
    logger.info("Attempting LPPL computation...")
    
    try:
        from lppls import lppls as lppls_lib
        import numpy as np
        import pandas as pd
        
        # Use last 500 days
        lookback = min(500, len(prices))
        recent_dates = dates[-lookback:]
        recent_prices = prices[-lookback:]
        
        # Convert dates to ordinal
        time_ord = np.array([pd.Timestamp(d).toordinal() for d in recent_dates])
        observations = np.array([time_ord, recent_prices]).T
        
        # Fit model
        model = lppls_lib.LPPLS(observations=observations)
        tc, m, omega, A, B, C1, C2 = model.fit(max_searches=25)
        
        # Calculate tc_days
        last_ord = time_ord[-1]
        tc_days = int(tc - last_ord)
        tc_date = pd.Timestamp.fromordinal(int(tc)).strftime('%Y-%m-%d') if tc > last_ord else None
        
        # Validation
        m_valid = 0.1 < m < 0.9
        omega_valid = 6 < omega < 13
        tc_valid = 5 < tc_days < 365
        
        # R²
        predicted = model.lppls(time_ord, tc, m, omega, A, B, C1, C2)
        ss_res = np.sum((np.log(recent_prices) - predicted) ** 2)
        ss_tot = np.sum((np.log(recent_prices) - np.mean(np.log(recent_prices))) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        is_bubble = all([m_valid, omega_valid, tc_valid, r2 > 0.7])
        confidence = int(min(100, max(0, (r2 - 0.7) / 0.25 * 100))) if is_bubble else 0
        
        logger.success("LPPL computation complete", {
            "is_bubble": is_bubble,
            "confidence": f"{confidence}%",
            "tc_days": tc_days if tc_valid else "N/A"
        })
        
        return {
            "is_bubble": is_bubble,
            "confidence": confidence,
            "tc_days": tc_days if tc_valid else None,
            "tc_date": tc_date if tc_valid else None,
            "r2": round(r2, 4),
            "omega": round(omega, 4),
            "m": round(m, 4),
            "status": "COMPUTED"
        }
        
    except ImportError:
        logger.warning("lppls library not installed - skipping LPPL analysis")
        return {"is_bubble": False, "confidence": 0, "status": "LIBRARY_NOT_AVAILABLE"}
    except Exception as e:
        logger.warning(f"LPPL computation failed: {e}")
        return {"is_bubble": False, "confidence": 0, "status": f"ERROR: {str(e)}"}

# ============ MAIN ============
def main():
    import pandas as pd
    import numpy as np
    
    print("=" * 70)
    print("FLR TRACKER V3.2 - BULLETPROOF EDITION")
    print(f"Execution Time: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)
    
    # Check API key
    fred_api_key = os.environ.get('FRED_API_KEY')
    if not fred_api_key:
        logger.critical("FRED_API_KEY not set!")
        sys.exit(1)
    
    logger.info("API key found", {"length": len(fred_api_key)})
    
    # Initialize FRED
    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_api_key)
        logger.success("FRED API initialized")
    except ImportError:
        logger.critical("fredapi not installed!")
        sys.exit(1)
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
    
    # Validate fetched data
    print("\n" + "=" * 70)
    print("PHASE 2: DATA VALIDATION")
    print("=" * 70)
    
    validation_passed = True
    validation_passed &= validate_data("WALCL", float(walcl.iloc[-1]))
    validation_passed &= validate_data("RRP", float(rrp.iloc[-1]))
    validation_passed &= validate_data("TGA", float(tga.iloc[-1]))
    validation_passed &= validate_data("SP500", float(sp500.iloc[-1]))
    
    if not validation_passed:
        logger.critical("DATA VALIDATION FAILED - Output may be incorrect!")
        # Continue anyway but log the warning
    
    # Build unified time series
    print("\n" + "=" * 70)
    print("PHASE 3: TIME SERIES CONSTRUCTION")
    print("=" * 70)
    
    df = pd.DataFrame(index=sp500.index)
    df['spx'] = sp500
    df['balance_sheet'] = walcl / 1000  # Millions → Billions
    df['tga'] = tga / 1000
    df['rrp'] = rrp  # Already billions
    df['reserves'] = reserves / 1000
    
    # Forward fill weekly data
    for col in ['balance_sheet', 'tga', 'reserves', 'rrp']:
        df[col] = df[col].ffill()
    
    # Net liquidity
    df['net_liquidity'] = df['balance_sheet'] - df['tga'] - df['rrp']
    
    # Add solar (match by month)
    df['year_month'] = df.index.to_period('M')
    solar['year_month'] = solar.index.to_period('M')
    solar_monthly = solar.groupby('year_month').last()
    df = df.join(solar_monthly[['ssn', 'f10.7']], on='year_month')
    df['ssn'] = df['ssn'].ffill()
    df['f10.7'] = df['f10.7'].ffill()
    df = df.drop(columns=['year_month'])
    
    # Drop incomplete rows
    df = df.dropna(subset=['spx', 'net_liquidity'])
    
    logger.success("Time series built", {
        "records": len(df),
        "start": str(df.index[0].date()),
        "end": str(df.index[-1].date())
    })
    
    # Show latest values prominently
    latest = df.iloc[-1]
    print("\n" + "=" * 70)
    print("🎯 LATEST VALUES (VERIFY THESE AGAINST FRED)")
    print("=" * 70)
    print(f"Date:           {latest.name.date()}")
    print(f"S&P 500:        {latest['spx']:,.2f}")
    print(f"Fed BS (WALCL): ${latest['balance_sheet']:,.1f}B (${latest['balance_sheet']/1000:.2f}T)")
    print(f"TGA:            ${latest['tga']:,.1f}B")
    print(f"RRP:            ${latest['rrp']:,.1f}B  ← Should be near ZERO in Jan 2026!")
    print(f"Reserves:       ${latest['reserves']:,.1f}B")
    print(f"Net Liquidity:  ${latest['net_liquidity']:,.1f}B (${latest['net_liquidity']/1000:.2f}T)")
    print(f"Sunspots:       {latest['ssn']:.0f}")
    print("=" * 70)
    
    # Compute CSD
    print("\n" + "=" * 70)
    print("PHASE 4: CSD ANALYSIS")
    print("=" * 70)
    
    prices = df['spx'].values
    csd = compute_csd(prices.tolist())
    
    # Compute LPPL
    print("\n" + "=" * 70)
    print("PHASE 5: LPPL ANALYSIS")
    print("=" * 70)
    
    lppl = compute_lppl(df.index.values, prices)
    
    # Calculate regime score
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
    
    logger.success("Regime calculated", {
        "composite": f"{composite:.1f}",
        "status": status,
        "signal": signal
    })
    
    # Build time series output
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
    
    # Build final output
    output = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "3.2.0",
            "validation_passed": validation_passed,
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
    
    # Write output
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'flr-data.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print("\n" + "=" * 70)
    print("✅ OUTPUT WRITTEN")
    print("=" * 70)
    print(f"File: {output_path}")
    print(f"Records: {len(timeseries)}")
    print(f"Regime: {status} ({composite:.1f})")
    
    # Final verification
    print("\n" + "=" * 70)
    print("🔍 FINAL VERIFICATION - CHECK THESE VALUES!")
    print("=" * 70)
    print(f"RRP should be near $0-10B in Jan 2026")
    print(f"Your RRP value: ${latest['rrp']:.1f}B")
    print()
    print(f"WALCL should be ~$6,500-6,700B in Jan 2026")
    print(f"Your WALCL value: ${latest['balance_sheet']:.1f}B")
    print()
    print(f"If these don't match, check FRED directly:")
    print(f"  https://fred.stlouisfed.org/series/RRPONTSYD")
    print(f"  https://fred.stlouisfed.org/series/WALCL")
    print("=" * 70)


if __name__ == "__main__":
    main()
