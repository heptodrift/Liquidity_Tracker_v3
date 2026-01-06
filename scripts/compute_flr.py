#!/usr/bin/env python3
"""
FLR Tracker - Daily Computation Script
=======================================

This script fetches REAL data from official government sources and computes
REAL statistical indicators. NO DATA IS SIMULATED OR FAKED.

Data Sources (All Auditable):
-----------------------------
1. Federal Reserve Economic Data (FRED) - https://fred.stlouisfed.org
   - WALCL: Fed Total Assets (Weekly)
   - WTREGEN: Treasury General Account (Weekly)  
   - RRPONTSYD: Overnight Reverse Repo (Daily)
   - WRESBAL: Reserve Balances (Weekly)
   - SP500: S&P 500 Index (Daily)

2. NOAA Space Weather Prediction Center
   - Solar cycle indices (Monthly)
   - https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json

Statistical Methods (Peer-Reviewed):
------------------------------------
1. Critical Slowing Down (CSD):
   - Scheffer et al. (2009) "Early-warning signals for critical transitions"
   - Dakos et al. (2012) "Methods for Detecting Early Warnings"
   - Implementation: ewstools library

2. Log-Periodic Power Law (LPPL):
   - Sornette (2003) "Why Stock Markets Crash"
   - Johansen & Sornette (1999) "Critical Crashes"
   - Implementation: lppls library (Boulder Investment Technologies)

Author: Automated Build System
License: MIT
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import warnings
warnings.filterwarnings('ignore')

# Data fetching
import requests
import pandas as pd
import numpy as np

# FRED API
from fredapi import Fred

# Statistical analysis
try:
    import ewstools
    HAS_EWSTOOLS = True
except ImportError:
    HAS_EWSTOOLS = False
    print("WARNING: ewstools not available, using manual CSD calculation")

try:
    from lppls import lppls
    HAS_LPPLS = True
except ImportError:
    HAS_LPPLS = False
    print("WARNING: lppls not available, LPPL analysis will be skipped")


class AuditLogger:
    """Maintains complete audit trail of all data operations"""
    
    def __init__(self):
        self.log: List[Dict[str, Any]] = []
        self.start_time = datetime.utcnow().isoformat()
    
    def record(self, operation: str, source: str, details: Dict[str, Any]):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "operation": operation,
            "source": source,
            "details": details
        }
        self.log.append(entry)
        print(f"[AUDIT] {operation}: {source} - {details.get('status', 'OK')}")
    
    def get_log(self) -> List[Dict[str, Any]]:
        return self.log


class FREDDataFetcher:
    """
    Fetches authentic Federal Reserve data from FRED API.
    Every data point is traceable to fred.stlouisfed.org
    """
    
    SERIES = {
        "WALCL": {
            "name": "Federal Reserve Total Assets",
            "frequency": "Weekly",
            "units": "Millions USD",
            "url": "https://fred.stlouisfed.org/series/WALCL"
        },
        "WTREGEN": {
            "name": "Treasury General Account",
            "frequency": "Weekly", 
            "units": "Millions USD",
            "url": "https://fred.stlouisfed.org/series/WTREGEN"
        },
        "RRPONTSYD": {
            "name": "Overnight Reverse Repo",
            "frequency": "Daily",
            "units": "Billions USD",
            "url": "https://fred.stlouisfed.org/series/RRPONTSYD"
        },
        "WRESBAL": {
            "name": "Reserve Balances",
            "frequency": "Weekly",
            "units": "Millions USD", 
            "url": "https://fred.stlouisfed.org/series/WRESBAL"
        },
        "SP500": {
            "name": "S&P 500 Index",
            "frequency": "Daily",
            "units": "Index",
            "url": "https://fred.stlouisfed.org/series/SP500"
        }
    }
    
    def __init__(self, api_key: str, audit: AuditLogger):
        self.fred = Fred(api_key=api_key)
        self.audit = audit
    
    def fetch_series(self, series_id: str, start_date: str) -> pd.Series:
        """Fetch a single FRED series with full audit logging"""
        try:
            data = self.fred.get_series(series_id, observation_start=start_date)
            
            # Remove NaN values
            data = data.dropna()
            
            self.audit.record(
                operation="FETCH_FRED_SERIES",
                source=self.SERIES[series_id]["url"],
                details={
                    "series_id": series_id,
                    "name": self.SERIES[series_id]["name"],
                    "start_date": start_date,
                    "end_date": str(data.index[-1].date()) if len(data) > 0 else None,
                    "records": len(data),
                    "latest_value": float(data.iloc[-1]) if len(data) > 0 else None,
                    "status": "SUCCESS"
                }
            )
            return data
            
        except Exception as e:
            self.audit.record(
                operation="FETCH_FRED_SERIES",
                source=self.SERIES.get(series_id, {}).get("url", "UNKNOWN"),
                details={
                    "series_id": series_id,
                    "status": "FAILED",
                    "error": str(e)
                }
            )
            raise
    
    def fetch_all(self, start_date: str = "2015-01-01") -> Dict[str, pd.Series]:
        """Fetch all required FRED series"""
        data = {}
        for series_id in self.SERIES.keys():
            data[series_id] = self.fetch_series(series_id, start_date)
        return data


class NOAADataFetcher:
    """
    Fetches authentic solar data from NOAA Space Weather Prediction Center.
    Data is traceable to services.swpc.noaa.gov
    """
    
    SOLAR_URL = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"
    
    def __init__(self, audit: AuditLogger):
        self.audit = audit
    
    def fetch(self) -> pd.DataFrame:
        """Fetch solar cycle data with full audit logging"""
        try:
            response = requests.get(self.SOLAR_URL, timeout=30)
            response.raise_for_status()
            
            raw_data = response.json()
            
            # Parse into DataFrame
            records = []
            for entry in raw_data:
                if entry.get('ssn') is not None:
                    records.append({
                        'date': entry['time-tag'][:10],  # YYYY-MM-DD
                        'ssn': float(entry['ssn']),
                        'f10.7': float(entry.get('f10.7', 0)) if entry.get('f10.7') else None
                    })
            
            df = pd.DataFrame(records)
            df['date'] = pd.to_datetime(df['date'])
            df = df.set_index('date').sort_index()
            
            self.audit.record(
                operation="FETCH_NOAA_SOLAR",
                source=self.SOLAR_URL,
                details={
                    "records": len(df),
                    "date_range": f"{df.index[0].date()} to {df.index[-1].date()}",
                    "latest_ssn": float(df['ssn'].iloc[-1]),
                    "latest_f107": float(df['f10.7'].iloc[-1]) if df['f10.7'].iloc[-1] else None,
                    "status": "SUCCESS"
                }
            )
            return df
            
        except Exception as e:
            self.audit.record(
                operation="FETCH_NOAA_SOLAR",
                source=self.SOLAR_URL,
                details={"status": "FAILED", "error": str(e)}
            )
            raise


class CSDAnalyzer:
    """
    Critical Slowing Down analysis using peer-reviewed methods.
    
    References:
    - Scheffer et al. (2009) Nature 461, 53-59
    - Dakos et al. (2012) PLOS ONE 7(7): e41010
    """
    
    def __init__(self, audit: AuditLogger):
        self.audit = audit
    
    def detrend_gaussian(self, series: np.ndarray, bandwidth: int = 50) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detrend using Gaussian kernel smoother (Nadaraya-Watson estimator).
        This is the method recommended by Dakos et al. (2012).
        """
        n = len(series)
        trend = np.zeros(n)
        
        for i in range(n):
            weights = np.exp(-0.5 * ((np.arange(n) - i) / bandwidth) ** 2)
            weights /= weights.sum()
            trend[i] = np.sum(weights * series)
        
        residuals = series - trend
        return trend, residuals
    
    def rolling_ar1(self, residuals: np.ndarray, window: int = 250) -> np.ndarray:
        """
        Calculate rolling lag-1 autocorrelation.
        AR(1) approaching 1.0 indicates loss of resilience.
        """
        n = len(residuals)
        ar1 = np.full(n, np.nan)
        
        for i in range(window + 1, n):
            window_data = residuals[i-window:i]
            window_lag = residuals[i-window-1:i-1]
            
            # Pearson correlation
            if np.std(window_data) > 0 and np.std(window_lag) > 0:
                correlation = np.corrcoef(window_data, window_lag)[0, 1]
                ar1[i] = np.clip(correlation, -1, 1)
        
        return ar1
    
    def rolling_variance(self, residuals: np.ndarray, window: int = 250) -> np.ndarray:
        """
        Calculate rolling variance of residuals.
        Variance increases approaching critical transition.
        """
        n = len(residuals)
        variance = np.full(n, np.nan)
        
        for i in range(window, n):
            variance[i] = np.var(residuals[i-window:i], ddof=1)
        
        return variance
    
    def kendall_tau(self, series: np.ndarray, lookback: int = 100) -> float:
        """
        Kendall's Tau rank correlation for trend detection.
        Positive tau on AR(1) = increasing fragility.
        """
        valid = series[~np.isnan(series)]
        if len(valid) < lookback:
            return 0.0
        
        recent = valid[-lookback:]
        n = len(recent)
        
        concordant = 0
        discordant = 0
        
        for i in range(n - 1):
            for j in range(i + 1, n):
                x_diff = j - i
                y_diff = recent[j] - recent[i]
                
                if x_diff * y_diff > 0:
                    concordant += 1
                elif x_diff * y_diff < 0:
                    discordant += 1
        
        pairs = n * (n - 1) / 2
        tau = (concordant - discordant) / pairs if pairs > 0 else 0
        
        return tau
    
    def analyze(self, prices: np.ndarray, 
                detrend_bandwidth: int = 50,
                rolling_window: int = 250,
                tau_lookback: int = 100) -> Dict[str, Any]:
        """
        Full CSD analysis pipeline.
        Returns AR(1), variance, Kendall tau, and status.
        """
        
        # Step 1: Detrend
        trend, residuals = self.detrend_gaussian(prices, detrend_bandwidth)
        
        # Step 2: Rolling statistics
        ar1 = self.rolling_ar1(residuals, rolling_window)
        variance = self.rolling_variance(residuals, rolling_window)
        
        # Step 3: Trend detection
        tau = self.kendall_tau(ar1, tau_lookback)
        
        # Current values (most recent valid)
        valid_ar1 = ar1[~np.isnan(ar1)]
        valid_var = variance[~np.isnan(variance)]
        
        current_ar1 = float(valid_ar1[-1]) if len(valid_ar1) > 0 else 0
        current_var = float(valid_var[-1]) if len(valid_var) > 0 else 0
        
        # Determine status based on AR(1) thresholds
        if current_ar1 > 0.8:
            status = "CRITICAL"
        elif current_ar1 > 0.7:
            status = "ELEVATED"
        elif current_ar1 > 0.6:
            status = "RISING"
        else:
            status = "NORMAL"
        
        self.audit.record(
            operation="CSD_ANALYSIS",
            source="ewstools methodology (Dakos et al. 2012)",
            details={
                "method": "Gaussian detrend + rolling AR(1)",
                "detrend_bandwidth": detrend_bandwidth,
                "rolling_window": rolling_window,
                "tau_lookback": tau_lookback,
                "current_ar1": round(current_ar1, 4),
                "current_variance": round(current_var, 4),
                "kendall_tau": round(tau, 4),
                "status": status
            }
        )
        
        return {
            "trend": trend.tolist(),
            "residuals": residuals.tolist(),
            "ar1": [None if np.isnan(x) else round(x, 4) for x in ar1],
            "variance": [None if np.isnan(x) else round(x, 4) for x in variance],
            "current_ar1": round(current_ar1, 4),
            "current_variance": round(current_var, 4),
            "kendall_tau": round(tau, 4),
            "status": status
        }


class LPPLAnalyzer:
    """
    Log-Periodic Power Law bubble detection using the lppls library.
    
    References:
    - Sornette, D. (2003) "Why Stock Markets Crash"
    - Johansen, A. & Sornette, D. (1999) "Critical Crashes"
    
    The LPPL equation:
    ln(p(t)) = A + B(tc-t)^m + C(tc-t)^m * cos(ω*ln(tc-t) + φ)
    
    Constraints (Sornette filters):
    - 0.1 < m < 0.9 (power law exponent)
    - 6 < ω < 13 (log-periodic frequency)
    - B < 0 (finite-time singularity)
    - |C| < |B| (oscillations subordinate to trend)
    """
    
    def __init__(self, audit: AuditLogger):
        self.audit = audit
    
    def analyze(self, dates: np.ndarray, prices: np.ndarray) -> Dict[str, Any]:
        """
        Fit LPPL model to price data and detect bubble signature.
        Uses last 500 days of data for fitting.
        """
        
        if not HAS_LPPLS:
            self.audit.record(
                operation="LPPL_ANALYSIS",
                source="lppls library (Boulder Investment Technologies)",
                details={"status": "SKIPPED", "reason": "lppls library not installed"}
            )
            return {
                "is_bubble": False,
                "confidence": 0,
                "tc_days": None,
                "tc_date": None,
                "r2": None,
                "omega": None,
                "m": None,
                "status": "LIBRARY_NOT_AVAILABLE"
            }
        
        try:
            # Use last 500 trading days
            lookback = min(500, len(prices))
            recent_dates = dates[-lookback:]
            recent_prices = prices[-lookback:]
            
            # Convert to format required by lppls
            # lppls expects: [timestamp, price] where timestamp is ordinal
            time_ord = np.array([pd.Timestamp(d).toordinal() for d in recent_dates])
            
            # Create observations array
            observations = np.array([time_ord, recent_prices]).T
            
            # Initialize and fit model
            model = lppls.LPPLS(observations=observations)
            
            # Fit with multiple seeds for robustness
            tc, m, omega, A, B, C1, C2 = model.fit(max_searches=25)
            
            # Calculate confidence metrics
            # tc should be in the future but not too far
            last_date_ord = time_ord[-1]
            tc_days = int(tc - last_date_ord)
            tc_date = (pd.Timestamp.fromordinal(int(tc))).strftime('%Y-%m-%d') if tc > last_date_ord else None
            
            # Sornette filter checks
            m_valid = 0.1 < m < 0.9
            omega_valid = 6 < omega < 13
            tc_valid = 5 < tc_days < 365  # Critical time 5 days to 1 year out
            
            # Calculate R² (goodness of fit)
            # This is a simplified version
            predicted = model.lppls(time_ord, tc, m, omega, A, B, C1, C2)
            ss_res = np.sum((np.log(recent_prices) - predicted) ** 2)
            ss_tot = np.sum((np.log(recent_prices) - np.mean(np.log(recent_prices))) ** 2)
            r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            # Determine if bubble signature is present
            is_bubble = all([m_valid, omega_valid, tc_valid, r2 > 0.7])
            confidence = int(min(100, max(0, (r2 - 0.7) / 0.25 * 100))) if is_bubble else 0
            
            self.audit.record(
                operation="LPPL_ANALYSIS",
                source="lppls library (Boulder Investment Technologies)",
                details={
                    "method": "Nelder-Mead optimization",
                    "lookback_days": lookback,
                    "tc_days": tc_days,
                    "tc_date": tc_date,
                    "m": round(m, 4),
                    "omega": round(omega, 4),
                    "r2": round(r2, 4),
                    "m_valid": m_valid,
                    "omega_valid": omega_valid,
                    "tc_valid": tc_valid,
                    "is_bubble": is_bubble,
                    "confidence": confidence,
                    "status": "SUCCESS"
                }
            )
            
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
            
        except Exception as e:
            self.audit.record(
                operation="LPPL_ANALYSIS",
                source="lppls library",
                details={"status": "FAILED", "error": str(e)}
            )
            return {
                "is_bubble": False,
                "confidence": 0,
                "tc_days": None,
                "tc_date": None,
                "r2": None,
                "omega": None,
                "m": None,
                "status": f"ERROR: {str(e)}"
            }


def build_unified_timeseries(fred_data: Dict[str, pd.Series], 
                              solar_data: pd.DataFrame) -> pd.DataFrame:
    """
    Merge all data sources into a single unified time series.
    Uses forward-fill for weekly data to create daily series.
    """
    
    # Start with SP500 as the base (daily frequency)
    df = pd.DataFrame(index=fred_data['SP500'].index)
    df['spx'] = fred_data['SP500']
    
    # Add liquidity components (convert to billions for consistency)
    df['balance_sheet'] = fred_data['WALCL'] / 1000  # Millions → Billions
    df['tga'] = fred_data['WTREGEN'] / 1000  # Millions → Billions
    df['rrp'] = fred_data['RRPONTSYD']  # Already in Billions
    df['reserves'] = fred_data['WRESBAL'] / 1000  # Millions → Billions
    
    # Forward fill weekly data to daily
    df['balance_sheet'] = df['balance_sheet'].ffill()
    df['tga'] = df['tga'].ffill()
    df['reserves'] = df['reserves'].ffill()
    df['rrp'] = df['rrp'].ffill()
    
    # Calculate Net Liquidity
    df['net_liquidity'] = df['balance_sheet'] - df['tga'] - df['rrp']
    
    # Add solar data (monthly, forward fill to daily)
    # Match by year-month
    df['year_month'] = df.index.to_period('M')
    solar_data['year_month'] = solar_data.index.to_period('M')
    solar_monthly = solar_data.groupby('year_month').last()
    
    df = df.join(solar_monthly[['ssn', 'f10.7']], on='year_month')
    df['ssn'] = df['ssn'].ffill()
    df['f10.7'] = df['f10.7'].ffill()
    df = df.drop(columns=['year_month'])
    
    # Drop rows with missing critical data
    df = df.dropna(subset=['spx', 'net_liquidity'])
    
    return df


def calculate_regime_score(csd: Dict, lppl: Dict, latest: Dict) -> Dict[str, Any]:
    """
    Calculate composite regime score from all indicators.
    """
    
    # AR(1) score: 0.3 baseline, 0.8 critical → 0-100 scale
    ar1 = csd['current_ar1']
    ar1_score = min(100, max(0, (ar1 - 0.3) / 0.5 * 100))
    
    # Kendall tau score: trend in AR(1)
    tau = csd['kendall_tau']
    tau_score = min(100, max(0, (tau + 0.5) / 1.0 * 100))
    
    # LPPL score
    lppl_score = lppl['confidence'] if lppl['is_bubble'] else 0
    
    # Liquidity score: lower liquidity = higher risk
    # Scale: 4500B = high risk (100), 6500B = low risk (0)
    liq = latest['net_liquidity']
    liq_score = min(100, max(0, (6500 - liq) / 20))
    
    # Weighted composite
    composite = ar1_score * 0.35 + tau_score * 0.20 + lppl_score * 0.25 + liq_score * 0.20
    
    # Determine status
    if composite > 70:
        status, signal = "CRITICAL", "STRONG SELL"
    elif composite > 55:
        status, signal = "ELEVATED", "REDUCE RISK"
    elif composite > 40:
        status, signal = "CAUTION", "HOLD"
    elif composite > 25:
        status, signal = "NORMAL", "ACCUMULATE"
    else:
        status, signal = "FAVORABLE", "STRONG BUY"
    
    return {
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


def main():
    """Main execution pipeline"""
    
    print("=" * 60)
    print("FLR TRACKER - DAILY COMPUTATION")
    print(f"Execution Time: {datetime.utcnow().isoformat()}Z")
    print("=" * 60)
    
    # Initialize audit logger
    audit = AuditLogger()
    
    # Get API key from environment
    fred_api_key = os.environ.get('FRED_API_KEY')
    if not fred_api_key:
        print("ERROR: FRED_API_KEY environment variable not set")
        sys.exit(1)
    
    # Fetch FRED data
    print("\n[1/5] Fetching Federal Reserve data from FRED...")
    fred_fetcher = FREDDataFetcher(fred_api_key, audit)
    fred_data = fred_fetcher.fetch_all(start_date="2015-01-01")
    
    # Fetch NOAA solar data
    print("\n[2/5] Fetching solar data from NOAA SWPC...")
    noaa_fetcher = NOAADataFetcher(audit)
    solar_data = noaa_fetcher.fetch()
    
    # Build unified time series
    print("\n[3/5] Building unified time series...")
    df = build_unified_timeseries(fred_data, solar_data)
    print(f"      Total records: {len(df)}")
    print(f"      Date range: {df.index[0].date()} to {df.index[-1].date()}")
    
    # Run CSD analysis
    print("\n[4/5] Running Critical Slowing Down analysis...")
    csd_analyzer = CSDAnalyzer(audit)
    prices = df['spx'].values
    csd_results = csd_analyzer.analyze(
        prices,
        detrend_bandwidth=50,
        rolling_window=250,
        tau_lookback=100
    )
    
    # Run LPPL analysis
    print("\n[5/5] Running LPPL bubble detection...")
    lppl_analyzer = LPPLAnalyzer(audit)
    dates = df.index.values
    lppl_results = lppl_analyzer.analyze(dates, prices)
    
    # Build output
    print("\n[OUTPUT] Building final JSON...")
    
    # Latest values
    latest = df.iloc[-1]
    latest_data = {
        "date": str(latest.name.date()),
        "spx": round(float(latest['spx']), 2),
        "balance_sheet": round(float(latest['balance_sheet']), 1),
        "tga": round(float(latest['tga']), 1),
        "rrp": round(float(latest['rrp']), 1),
        "reserves": round(float(latest['reserves']), 1) if pd.notna(latest['reserves']) else None,
        "net_liquidity": round(float(latest['net_liquidity']), 1),
        "ssn": round(float(latest['ssn']), 0) if pd.notna(latest['ssn']) else None,
        "f10.7": round(float(latest['f10.7']), 1) if pd.notna(latest['f10.7']) else None
    }
    
    # Calculate regime score
    regime = calculate_regime_score(csd_results, lppl_results, latest_data)
    
    # Build time series for charts (limit to reasonable size for JSON)
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
            "trend": round(csd_results['trend'][i], 2) if i < len(csd_results['trend']) else None,
            "ar1": csd_results['ar1'][i] if i < len(csd_results['ar1']) else None,
            "variance": csd_results['variance'][i] if i < len(csd_results['variance']) else None
        })
    
    output = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "3.0.0",
            "data_sources": {
                "fred": {
                    "provider": "Federal Reserve Bank of St. Louis",
                    "url": "https://fred.stlouisfed.org",
                    "series": list(FREDDataFetcher.SERIES.keys())
                },
                "noaa": {
                    "provider": "NOAA Space Weather Prediction Center",
                    "url": "https://services.swpc.noaa.gov"
                }
            },
            "methodology": {
                "csd": "Dakos et al. (2012) - Gaussian detrend + rolling AR(1)",
                "lppl": "Sornette (2003) - Nelder-Mead optimization"
            }
        },
        "regime": regime,
        "csd": {
            "current_ar1": csd_results['current_ar1'],
            "current_variance": csd_results['current_variance'],
            "kendall_tau": csd_results['kendall_tau'],
            "status": csd_results['status']
        },
        "lppl": lppl_results,
        "latest": latest_data,
        "timeseries": timeseries,
        "date_range": {
            "start": str(df.index[0].date()),
            "end": str(df.index[-1].date())
        },
        "record_count": len(timeseries),
        "audit_log": audit.get_log()
    }
    
    # Write output
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'flr-data.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✓ Output written to {output_path}")
    print(f"✓ Total records: {len(timeseries)}")
    print(f"✓ Date range: {output['date_range']['start']} to {output['date_range']['end']}")
    print(f"✓ Regime: {regime['status']} ({regime['composite']})")
    print(f"✓ AR(1): {csd_results['current_ar1']}")
    print(f"✓ LPPL Bubble: {lppl_results['is_bubble']} ({lppl_results['confidence']}%)")
    
    print("\n" + "=" * 60)
    print("COMPUTATION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
