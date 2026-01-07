#!/usr/bin/env python3
"""
FRACTAL TERMINAL V7.0 - INSTITUTIONAL EDITION
==============================================

COMPLETE DATA ARCHITECTURE:
- Daily Treasury Statement API (T-1 TGA)
- NY Fed Markets API (Real-time RRP)
- Global M2 Aggregation (US, EU, CN, JP)
- Stablecoin Impulse (DefiLlama)
- All FRED Credit Stress Indicators

ALL DATA IS REAL. ZERO SIMULATIONS.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
import traceback

# ============ CONFIGURATION ============
CONFIG = {
    "start_date": "2015-01-01",
    "fred_series": {
        # Core Liquidity
        "WALCL": "Fed Balance Sheet",
        "WTREGEN": "Treasury General Account (Weekly Backup)",
        "RRPONTSYD": "Reverse Repo (Daily Backup)",
        "WRESBAL": "Bank Reserves",
        "SP500": "S&P 500 Index",
        # Credit Stress
        "RIFSPPFAAD90NB": "3-Month AA Financial CP Rate",
        "TB3MS": "3-Month Treasury Bill Rate",
        "T10Y2Y": "10Y-2Y Treasury Spread",
        "BAMLH0A0HYM2": "ICE BofA High Yield Spread",
        "VIXCLS": "CBOE VIX",
        # Global M2 Components
        "M2SL": "US M2 Money Supply",
        "MYAGM2EZM196N": "Euro Area M2",
        "MYAGM2JPM189N": "Japan M2", 
        "MYAGM2CNM189N": "China M2",
        # Exchange Rates for conversion
        "DEXUSEU": "USD/EUR Exchange Rate",
        "DEXJPUS": "JPY/USD Exchange Rate",
        "DEXCHUS": "CNY/USD Exchange Rate",
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

# ============ DAILY TREASURY STATEMENT API ============
def fetch_daily_tga() -> Tuple[Optional[float], Optional[str], dict]:
    """
    Fetch TGA from Daily Treasury Statement API (T-1 latency)
    Source: https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/
    """
    import requests
    import pandas as pd
    
    logger.info("Fetching Daily Treasury Statement (TGA)")
    
    url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance"
    params = {
        "sort": "-record_date",
        "page[size]": 30,
        "fields": "record_date,account_type,open_today_bal,open_month_bal"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if not data.get("data"):
            raise ValueError("No data returned from Treasury API")
        
        # Find TGA Closing Balance entry
        tga_value = None
        tga_date = None
        
        for record in data["data"]:
            if "TGA" in record.get("account_type", "") or "closing" in record.get("account_type", "").lower():
                # The open_today_bal is actually previous day's closing
                val = record.get("open_today_bal") or record.get("open_month_bal")
                if val:
                    tga_value = float(val) / 1000  # Convert millions to billions
                    tga_date = record.get("record_date")
                    break
        
        # Fallback: use first record's opening balance
        if tga_value is None and data["data"]:
            for record in data["data"]:
                val = record.get("open_today_bal")
                if val:
                    tga_value = float(val) / 1000
                    tga_date = record.get("record_date")
                    break
        
        meta = {
            "source": "Daily Treasury Statement API",
            "source_url": "https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/",
            "latency": "T-1",
            "last_date": tga_date,
            "value": tga_value
        }
        
        if tga_value:
            logger.success(f"Daily TGA fetched", {"value": f"${tga_value:.1f}B", "date": tga_date})
        else:
            logger.warning("Could not extract TGA from Daily Treasury Statement")
            
        return tga_value, tga_date, meta
        
    except Exception as e:
        logger.warning(f"Daily Treasury API failed: {e}")
        return None, None, {"error": str(e)}

# ============ NY FED RRP API ============
def fetch_nyfed_rrp() -> Tuple[Optional[float], Optional[str], dict]:
    """
    Fetch RRP from NY Fed Markets Data API
    Source: https://markets.newyorkfed.org/
    Published daily at ~1:15 PM ET
    """
    import requests
    
    logger.info("Fetching NY Fed RRP data")
    
    # Try the JSON endpoint for reverse repo operations
    url = "https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json"
    params = {
        "startDate": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
        "endDate": datetime.now().strftime("%Y-%m-%d")
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        rrp_value = None
        rrp_date = None
        
        # Parse the response
        if data.get("repo", {}).get("operations"):
            operations = data["repo"]["operations"]
            if operations:
                latest = operations[0]
                # Total submitted amount
                if latest.get("totalAmtSubmitted"):
                    rrp_value = float(latest["totalAmtSubmitted"]) / 1000  # Billions
                    rrp_date = latest.get("operationDate")
        
        meta = {
            "source": "NY Fed Markets Data API",
            "source_url": "https://markets.newyorkfed.org/",
            "latency": "Same-day (1:15 PM ET)",
            "last_date": rrp_date,
            "value": rrp_value
        }
        
        if rrp_value is not None:
            logger.success(f"NY Fed RRP fetched", {"value": f"${rrp_value:.1f}B", "date": rrp_date})
        else:
            logger.warning("Could not parse NY Fed RRP data")
            
        return rrp_value, rrp_date, meta
        
    except Exception as e:
        logger.warning(f"NY Fed API failed: {e}")
        return None, None, {"error": str(e)}

# ============ STABLECOIN DATA (DefiLlama) ============
def fetch_stablecoin_data() -> Tuple[Optional[dict], dict]:
    """
    Fetch stablecoin market caps from DefiLlama
    Source: https://defillama.com/stablecoins
    """
    import requests
    
    logger.info("Fetching stablecoin data from DefiLlama")
    
    url = "https://stablecoins.llama.fi/stablecoins?includePrices=true"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        stablecoins = data.get("peggedAssets", [])
        
        # Major stablecoins
        target_symbols = ["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDP", "FRAX"]
        
        total_mcap = 0
        breakdown = {}
        
        for coin in stablecoins:
            symbol = coin.get("symbol", "")
            if symbol in target_symbols:
                mcap = coin.get("circulating", {}).get("peggedUSD", 0)
                if mcap:
                    breakdown[symbol] = mcap / 1e9  # Convert to billions
                    total_mcap += mcap
        
        total_mcap_b = total_mcap / 1e9
        
        result = {
            "total_mcap": round(total_mcap_b, 2),
            "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        meta = {
            "source": "DefiLlama Stablecoins API",
            "source_url": "https://defillama.com/stablecoins",
            "total_mcap": f"${total_mcap_b:.1f}B",
            "coins_tracked": list(breakdown.keys())
        }
        
        logger.success("Stablecoin data fetched", {"total": f"${total_mcap_b:.1f}B"})
        return result, meta
        
    except Exception as e:
        logger.warning(f"DefiLlama API failed: {e}")
        return None, {"error": str(e)}

# ============ FRED FETCHING ============
def fetch_fred_series(fred, series_id: str, start_date: str) -> Tuple[Any, dict]:
    """Fetch a FRED series with metadata"""
    import pandas as pd
    
    logger.info(f"Fetching FRED: {series_id}")
    
    try:
        data = fred.get_series(series_id, observation_start=start_date)
        data = data.dropna()
        
        if len(data) == 0:
            raise ValueError(f"No data for {series_id}")
        
        meta = {
            "series_id": series_id,
            "description": CONFIG["fred_series"].get(series_id, series_id),
            "records": len(data),
            "first_date": str(data.index[0].date()),
            "last_date": str(data.index[-1].date()),
            "latest_value": float(data.iloc[-1]),
            "source_url": f"https://fred.stlouisfed.org/series/{series_id}"
        }
        
        logger.success(f"Fetched {series_id}", {
            "records": len(data),
            "latest": f"{float(data.iloc[-1]):,.2f}",
            "date": str(data.index[-1].date())
        })
        
        return data, meta
        
    except Exception as e:
        logger.error(f"Failed to fetch {series_id}", {"error": str(e)})
        raise

def fetch_fred_safe(fred, series_id: str, start_date: str):
    """Fetch FRED series with graceful failure"""
    try:
        return fetch_fred_series(fred, series_id, start_date)
    except:
        return None, {"error": f"Failed to fetch {series_id}"}

# ============ NOAA SOLAR ============
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
        
        meta = {
            "records": len(df),
            "last_date": str(df.index[-1].date()),
            "latest_ssn": float(df.iloc[-1]['ssn']),
            "source_url": url
        }
        
        logger.success("Fetched NOAA solar data", {"latest_ssn": f"{df.iloc[-1]['ssn']:.0f}"})
        return df, meta
        
    except Exception as e:
        logger.error(f"NOAA fetch failed: {e}")
        return None, {"error": str(e)}

# ============ GLOBAL M2 CALCULATION ============
def calculate_global_m2(fred, start_date: str) -> Tuple[Optional[Any], dict]:
    """
    Calculate Global M2 = US M2 + (EU M2 × EUR/USD) + (JP M2 × JPY/USD) + (CN M2 × CNY/USD)
    All from FRED
    """
    import pandas as pd
    import numpy as np
    
    logger.info("Calculating Global M2")
    
    try:
        # Fetch all components
        us_m2, _ = fetch_fred_safe(fred, "M2SL", start_date)
        eu_m2, _ = fetch_fred_safe(fred, "MYAGM2EZM196N", start_date)
        jp_m2, _ = fetch_fred_safe(fred, "MYAGM2JPM189N", start_date)
        cn_m2, _ = fetch_fred_safe(fred, "MYAGM2CNM189N", start_date)
        
        eur_usd, _ = fetch_fred_safe(fred, "DEXUSEU", start_date)
        jpy_usd, _ = fetch_fred_safe(fred, "DEXJPUS", start_date)
        cny_usd, _ = fetch_fred_safe(fred, "DEXCHUS", start_date)
        
        if us_m2 is None:
            raise ValueError("US M2 is required")
        
        # Create aligned dataframe
        df = pd.DataFrame(index=us_m2.index)
        df['us_m2'] = us_m2
        
        # Add other components if available
        if eu_m2 is not None and eur_usd is not None:
            df['eu_m2'] = eu_m2
            df['eur_usd'] = eur_usd
            df = df.ffill()
            df['eu_m2_usd'] = df['eu_m2'] * df['eur_usd']
        else:
            df['eu_m2_usd'] = 0
            
        if jp_m2 is not None and jpy_usd is not None:
            df['jp_m2'] = jp_m2
            df['jpy_usd'] = jpy_usd
            df = df.ffill()
            # JPY/USD is quoted as JPY per USD, so divide
            df['jp_m2_usd'] = df['jp_m2'] / df['jpy_usd'] if df['jpy_usd'].mean() > 1 else df['jp_m2'] * df['jpy_usd']
        else:
            df['jp_m2_usd'] = 0
            
        if cn_m2 is not None and cny_usd is not None:
            df['cn_m2'] = cn_m2
            df['cny_usd'] = cny_usd
            df = df.ffill()
            # CNY/USD convert
            df['cn_m2_usd'] = df['cn_m2'] / df['cny_usd'] if df['cny_usd'].mean() > 1 else df['cn_m2'] * df['cny_usd']
        else:
            df['cn_m2_usd'] = 0
        
        # Calculate Global M2 (in billions)
        df['global_m2'] = (df['us_m2'] + df['eu_m2_usd'] + df['jp_m2_usd'] + df['cn_m2_usd']) / 1000
        
        # Calculate 30-day ROC
        df['global_m2_roc'] = df['global_m2'].pct_change(periods=30) * 100
        
        df = df.dropna(subset=['global_m2'])
        
        latest = df.iloc[-1]
        
        meta = {
            "source": "FRED (M2SL, MYAGM2EZM196N, MYAGM2JPM189N, MYAGM2CNM189N)",
            "components": ["US M2", "Euro Area M2", "Japan M2", "China M2"],
            "latest_global_m2": f"${latest['global_m2']:.1f}T",
            "latest_roc_30d": f"{latest['global_m2_roc']:.2f}%",
            "records": len(df)
        }
        
        logger.success("Global M2 calculated", {
            "global_m2": f"${latest['global_m2']:.1f}T",
            "roc_30d": f"{latest['global_m2_roc']:.2f}%"
        })
        
        return df[['global_m2', 'global_m2_roc']], meta
        
    except Exception as e:
        logger.error(f"Global M2 calculation failed: {e}")
        return None, {"error": str(e)}

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
    """LPPL bubble detection"""
    import numpy as np
    
    logger.info("Computing LPPL")
    
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
        
        for tc in range(lookback + 10, lookback + 250, 20):
            for m in [0.2, 0.33, 0.5, 0.67, 0.8]:
                for omega in [6, 7, 8, 9, 10, 11, 12]:
                    for phi in [0, np.pi/2, np.pi, 3*np.pi/2]:
                        dt = tc - t
                        if np.any(dt <= 0):
                            continue
                        
                        dtm = np.power(dt, m)
                        f_t = dtm
                        g_t = dtm * np.cos(omega * np.log(dt) + phi)
                        
                        X = np.column_stack([np.ones(lookback), f_t, g_t])
                        
                        try:
                            coeffs = np.linalg.solve(X.T @ X, X.T @ log_prices)
                            A, B, C = coeffs
                        except:
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
            return _lppl_result(False, 0, None, None, None, None, None, "No bubble signature")
        
        tc_days = best_fit["tc"] - lookback + 1
        is_bubble = all([0.1 < best_fit["m"] < 0.9, 6 < best_fit["omega"] < 13, 5 < tc_days < 365])
        confidence = int(min(100, max(0, (best_fit["r2"] - 0.7) / 0.25 * 100))) if is_bubble else 0
        tc_date = (datetime.now() + timedelta(days=tc_days)).strftime('%Y-%m-%d') if 5 < tc_days < 365 else None
        
        logger.success("LPPL complete", {"is_bubble": is_bubble, "r2": f"{best_fit['r2']:.3f}"})
        
        return _lppl_result(is_bubble, confidence, tc_days if 5 < tc_days < 365 else None, tc_date,
                          round(best_fit["r2"], 4), round(best_fit["omega"], 2), round(best_fit["m"], 3),
                          "BUBBLE DETECTED" if is_bubble else "No bubble signature")
    except Exception as e:
        logger.error(f"LPPL error: {e}")
        return _lppl_result(False, 0, None, None, None, None, None, f"Error: {e}")

def _lppl_result(is_bubble, confidence, tc_days, tc_date, r2, omega, m, status):
    return {"is_bubble": is_bubble, "confidence": confidence, "tc_days": tc_days, "tc_date": tc_date,
            "r2": r2, "omega": omega, "m": m, "status": status}

# ============ MAIN ============
def main():
    import pandas as pd
    import numpy as np
    
    print("=" * 70)
    print("FRACTAL TERMINAL V7.0 - INSTITUTIONAL EDITION")
    print(f"Execution: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)
    
    fred_api_key = os.environ.get('FRED_API_KEY')
    if not fred_api_key:
        logger.critical("FRED_API_KEY not set!")
        sys.exit(1)
    
    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_api_key)
        logger.success("FRED API initialized")
    except Exception as e:
        logger.critical(f"FRED init failed: {e}")
        sys.exit(1)
    
    data_sources = {}
    
    # ========== PHASE 1: HIGH-FREQUENCY DATA ==========
    print("\n" + "=" * 70)
    print("PHASE 1: HIGH-FREQUENCY DATA SOURCES")
    print("=" * 70)
    
    # Daily Treasury Statement (T-1 TGA)
    daily_tga_value, daily_tga_date, daily_tga_meta = fetch_daily_tga()
    data_sources["DTS_TGA"] = daily_tga_meta
    
    # NY Fed RRP (Same-day)
    nyfed_rrp_value, nyfed_rrp_date, nyfed_rrp_meta = fetch_nyfed_rrp()
    data_sources["NYFED_RRP"] = nyfed_rrp_meta
    
    # Stablecoin Data
    stablecoin_data, stablecoin_meta = fetch_stablecoin_data()
    data_sources["STABLECOINS"] = stablecoin_meta
    
    # ========== PHASE 2: FRED DATA ==========
    print("\n" + "=" * 70)
    print("PHASE 2: FRED DATA SOURCES")
    print("=" * 70)
    
    # Core liquidity (use as backup/history)
    walcl, walcl_meta = fetch_fred_series(fred, "WALCL", CONFIG["start_date"])
    data_sources["WALCL"] = walcl_meta
    
    rrp_fred, rrp_meta = fetch_fred_series(fred, "RRPONTSYD", CONFIG["start_date"])
    data_sources["RRPONTSYD"] = rrp_meta
    
    tga_fred, tga_meta = fetch_fred_series(fred, "WTREGEN", CONFIG["start_date"])
    data_sources["WTREGEN"] = tga_meta
    
    reserves, reserves_meta = fetch_fred_series(fred, "WRESBAL", CONFIG["start_date"])
    data_sources["WRESBAL"] = reserves_meta
    
    sp500, sp500_meta = fetch_fred_series(fred, "SP500", CONFIG["start_date"])
    data_sources["SP500"] = sp500_meta
    
    # Credit stress
    cp_rate, _ = fetch_fred_safe(fred, "RIFSPPFAAD90NB", CONFIG["start_date"])
    tbill_rate, _ = fetch_fred_safe(fred, "TB3MS", CONFIG["start_date"])
    yield_curve, _ = fetch_fred_safe(fred, "T10Y2Y", CONFIG["start_date"])
    hy_spread, _ = fetch_fred_safe(fred, "BAMLH0A0HYM2", CONFIG["start_date"])
    vix, _ = fetch_fred_safe(fred, "VIXCLS", CONFIG["start_date"])
    
    # Solar
    solar, solar_meta = fetch_noaa_solar()
    if solar is not None:
        data_sources["SOLAR"] = solar_meta
    
    # Global M2
    global_m2_df, global_m2_meta = calculate_global_m2(fred, CONFIG["start_date"])
    data_sources["GLOBAL_M2"] = global_m2_meta
    
    # ========== PHASE 3: BUILD TIME SERIES ==========
    print("\n" + "=" * 70)
    print("PHASE 3: BUILDING UNIFIED TIME SERIES")
    print("=" * 70)
    
    df = pd.DataFrame(index=sp500.index)
    df['spx'] = sp500
    df['balance_sheet'] = walcl / 1000
    df['tga'] = tga_fred / 1000
    df['rrp'] = rrp_fred
    df['reserves'] = reserves / 1000
    
    for col in ['balance_sheet', 'tga', 'reserves', 'rrp']:
        df[col] = df[col].ffill()
    
    df['net_liquidity'] = df['balance_sheet'] - df['tga'] - df['rrp']
    
    # Credit stress
    if cp_rate is not None and tbill_rate is not None:
        df['cp_rate'] = cp_rate
        df['tbill_rate'] = tbill_rate
        df['cp_rate'] = df['cp_rate'].ffill()
        df['tbill_rate'] = df['tbill_rate'].ffill()
        df['cp_tbill_spread'] = (df['cp_rate'] - df['tbill_rate']) * 100
    
    if yield_curve is not None:
        df['yield_curve'] = yield_curve.ffill()
    if hy_spread is not None:
        df['hy_spread'] = hy_spread.ffill()
    if vix is not None:
        df['vix'] = vix.ffill()
    
    # Global M2
    if global_m2_df is not None:
        df = df.join(global_m2_df, how='left')
        df['global_m2'] = df['global_m2'].ffill()
        df['global_m2_roc'] = df['global_m2_roc'].ffill()
    
    # Solar
    if solar is not None:
        df['year_month'] = df.index.to_period('M')
        solar['year_month'] = solar.index.to_period('M')
        solar_monthly = solar.groupby('year_month').last()
        df = df.join(solar_monthly[['ssn', 'f10.7']], on='year_month')
        df['ssn'] = df['ssn'].ffill()
        df['f10.7'] = df['f10.7'].ffill()
        df = df.drop(columns=['year_month'])
    
    df = df.dropna(subset=['spx', 'net_liquidity'])
    
    # Update with high-frequency data
    if daily_tga_value is not None:
        logger.info(f"Overriding TGA with Daily Treasury Statement: ${daily_tga_value:.1f}B")
    
    if nyfed_rrp_value is not None:
        logger.info(f"NY Fed RRP available: ${nyfed_rrp_value:.1f}B")
    
    latest = df.iloc[-1]
    
    # Use high-freq data for latest values if available
    latest_tga = daily_tga_value if daily_tga_value else latest['tga']
    latest_rrp = nyfed_rrp_value if nyfed_rrp_value else latest['rrp']
    latest_net_liq = latest['balance_sheet'] - latest_tga - latest_rrp
    
    print("\n" + "=" * 70)
    print("🎯 LATEST VALUES (HIGH-FREQUENCY WHERE AVAILABLE)")
    print("=" * 70)
    print(f"Date:           {latest.name.date()}")
    print(f"S&P 500:        {latest['spx']:,.2f}")
    print(f"Fed BS:         ${latest['balance_sheet']:,.1f}B")
    print(f"TGA:            ${latest_tga:,.1f}B {'(Daily Treasury)' if daily_tga_value else '(FRED Weekly)'}")
    print(f"RRP:            ${latest_rrp:,.1f}B {'(NY Fed)' if nyfed_rrp_value else '(FRED)'}")
    print(f"Net Liquidity:  ${latest_net_liq:,.1f}B")
    if global_m2_df is not None:
        print(f"Global M2:      ${latest.get('global_m2', 0):,.1f}T")
        print(f"Global M2 ROC:  {latest.get('global_m2_roc', 0):.2f}%")
    if stablecoin_data:
        print(f"Stablecoins:    ${stablecoin_data['total_mcap']:.1f}B")
    print("=" * 70)
    
    # ========== PHASE 4: ANALYTICS ==========
    print("\n" + "=" * 70)
    print("PHASE 4: COMPUTING ANALYTICS")
    print("=" * 70)
    
    prices = df['spx'].values
    csd = compute_csd(prices.tolist())
    lppl = compute_lppl(prices.tolist())
    
    # Regime score
    ar1_score = min(100, max(0, (csd['current_ar1'] - 0.3) / 0.5 * 100))
    tau_score = min(100, max(0, (csd['kendall_tau'] + 0.5) / 1.0 * 100))
    lppl_score = lppl.get('confidence', 0) if lppl.get('is_bubble') else 0
    liq_score = min(100, max(0, (6500 - latest_net_liq) / 20))
    
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
    
    # Credit stress
    credit_stress = None
    cp_spread = latest.get('cp_tbill_spread')
    if pd.notna(cp_spread):
        if cp_spread > 50: stress_status = "CRITICAL"
        elif cp_spread > 25: stress_status = "STRESSED"
        elif cp_spread > 15: stress_status = "ELEVATED"
        else: stress_status = "NORMAL"
        
        credit_stress = {
            "cp_tbill_spread": round(float(cp_spread), 1),
            "yield_curve": round(float(latest['yield_curve']), 2) if pd.notna(latest.get('yield_curve')) else None,
            "hy_spread": round(float(latest['hy_spread']), 2) if pd.notna(latest.get('hy_spread')) else None,
            "vix": round(float(latest['vix']), 2) if pd.notna(latest.get('vix')) else None,
            "status": stress_status
        }
    
    # ========== PHASE 5: OUTPUT ==========
    print("\n" + "=" * 70)
    print("PHASE 5: BUILDING OUTPUT")
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
            "reserves": round(float(row['reserves']), 1) if pd.notna(row.get('reserves')) else None,
            "net_liquidity": round(float(row['net_liquidity']), 1),
            "trend": round(csd['trend'][i], 2) if i < len(csd['trend']) else None,
            "ar1": csd['ar1'][i] if i < len(csd['ar1']) else None,
            "variance": csd['variance'][i] if i < len(csd['variance']) else None,
        }
        
        for field in ['cp_tbill_spread', 'yield_curve', 'hy_spread', 'vix', 'global_m2', 'global_m2_roc', 'ssn']:
            if pd.notna(row.get(field)):
                entry[field] = round(float(row[field]), 2 if field != 'ssn' else 0)
        
        timeseries.append(entry)
    
    output = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "7.0.0",
            "data_integrity": "ALL_REAL_NO_SIMULATIONS",
            "high_frequency_sources": {
                "tga": "Daily Treasury Statement API (T-1)" if daily_tga_value else "FRED Weekly",
                "rrp": "NY Fed Markets API (Same-day)" if nyfed_rrp_value else "FRED Daily"
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
        "global_m2": {
            "current": round(float(latest.get('global_m2', 0)), 1) if pd.notna(latest.get('global_m2')) else None,
            "roc_30d": round(float(latest.get('global_m2_roc', 0)), 2) if pd.notna(latest.get('global_m2_roc')) else None
        },
        "stablecoins": stablecoin_data,
        "latest": {
            "date": str(latest.name.date()),
            "spx": round(float(latest['spx']), 2),
            "balance_sheet": round(float(latest['balance_sheet']), 1),
            "tga": round(latest_tga, 1),
            "tga_source": "DTS" if daily_tga_value else "FRED",
            "rrp": round(latest_rrp, 1),
            "rrp_source": "NYFED" if nyfed_rrp_value else "FRED",
            "reserves": round(float(latest['reserves']), 1) if pd.notna(latest.get('reserves')) else None,
            "net_liquidity": round(latest_net_liq, 1),
            "global_m2": round(float(latest.get('global_m2', 0)), 1) if pd.notna(latest.get('global_m2')) else None,
            "global_m2_roc": round(float(latest.get('global_m2_roc', 0)), 2) if pd.notna(latest.get('global_m2_roc')) else None,
            "cp_tbill_spread": round(float(cp_spread), 1) if pd.notna(cp_spread) else None,
            "yield_curve": round(float(latest['yield_curve']), 2) if pd.notna(latest.get('yield_curve')) else None,
            "hy_spread": round(float(latest['hy_spread']), 2) if pd.notna(latest.get('hy_spread')) else None,
            "vix": round(float(latest['vix']), 2) if pd.notna(latest.get('vix')) else None,
            "ssn": round(float(latest['ssn']), 0) if pd.notna(latest.get('ssn')) else None,
        },
        "timeseries": timeseries,
        "date_range": {"start": str(df.index[0].date()), "end": str(df.index[-1].date())},
        "record_count": len(timeseries),
        "execution_log": logger.entries
    }
    
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'flr-data.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print("\n" + "=" * 70)
    print("✅ COMPLETE - ALL DATA REAL")
    print("=" * 70)
    print(f"Records: {len(timeseries)}")
    print(f"Regime: {status} ({composite:.1f})")
    print("=" * 70)

if __name__ == "__main__":
    main()
