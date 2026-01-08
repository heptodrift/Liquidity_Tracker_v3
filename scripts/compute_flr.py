#!/usr/bin/env python3
"""
FRACTAL TERMINAL V8 - DATA COMPUTATION ENGINE
=============================================

This script fetches live data from multiple sources:
- US Treasury Daily Statement API (T-1 TGA)
- NY Fed Markets API (Same-day RRP)
- FRED API (WALCL, Reserves, Credit spreads)
- DefiLlama (Stablecoins)
- NOAA (Sunspots)

Outputs: public/flr-data.json

Run via GitHub Actions daily or manually.
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import numpy as np

# ============ CONFIGURATION ============
FRED_API_KEY = os.environ.get('FRED_API_KEY', '')
OUTPUT_PATH = 'public/flr-data.json'

# Data source URLs
URLS = {
    'treasury_dts': 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/dts_table_1',
    'nyfed_rrp': 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json',
    'defillama_stables': 'https://stablecoins.llama.fi/stablecoins?includePrices=true',
    'noaa_ssn': 'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json',
}

FRED_SERIES = {
    'WALCL': 'Fed Balance Sheet',
    'WTREGEN': 'TGA (Weekly)',
    'RRPONTSYD': 'RRP (Daily)',
    'WRESBAL': 'Bank Reserves',
    'SP500': 'S&P 500',
    'VIXCLS': 'VIX',
    'T10Y2Y': 'Yield Curve 10Y-2Y',
    'BAMLH0A0HYM2': 'HY Spread',
    'M2SL': 'US M2',
    'RIFSPPFAAD90NB': 'Commercial Paper Rate',
    'TB3MS': '3-Month T-Bill Rate',
}

# ============ DATA FETCHERS ============

def fetch_fred_series(series_id: str, limit: int = 1000) -> List[Dict]:
    """Fetch data from FRED API"""
    if not FRED_API_KEY:
        print(f"Warning: FRED_API_KEY not set, skipping {series_id}")
        return []
    
    url = f"https://api.stlouisfed.org/fred/series/observations"
    params = {
        'series_id': series_id,
        'api_key': FRED_API_KEY,
        'file_type': 'json',
        'sort_order': 'desc',
        'limit': limit,
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        observations = data.get('observations', [])
        
        # Filter valid observations
        valid = []
        for obs in observations:
            if obs.get('value') and obs['value'] != '.':
                valid.append({
                    'date': obs['date'],
                    'value': float(obs['value'])
                })
        
        print(f"✓ FRED {series_id}: {len(valid)} observations")
        return valid
    except Exception as e:
        print(f"✗ FRED {series_id} error: {e}")
        return []


def fetch_treasury_dts() -> Optional[Dict]:
    """Fetch Daily Treasury Statement for TGA balance"""
    try:
        params = {
            'sort': '-record_date',
            'page[size]': 30,
        }
        response = requests.get(URLS['treasury_dts'], params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        records = data.get('data', [])
        tga_records = []
        
        for r in records:
            # Look for TGA closing balance
            account_type = r.get('account_type', '')
            if 'Treasury General Account' in account_type or 'TGA' in account_type:
                try:
                    value = float(r.get('close_today_bal', 0)) / 1000  # Convert to billions
                    tga_records.append({
                        'date': r.get('record_date'),
                        'value': value
                    })
                except:
                    pass
        
        if tga_records:
            print(f"✓ Treasury DTS: {len(tga_records)} TGA records")
            return tga_records[0]  # Most recent
        
        print("✗ Treasury DTS: No TGA records found")
        return None
    except Exception as e:
        print(f"✗ Treasury DTS error: {e}")
        return None


def fetch_nyfed_rrp() -> Optional[Dict]:
    """Fetch NY Fed RRP operations"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        
        params = {
            'startDate': week_ago,
            'endDate': today,
        }
        response = requests.get(URLS['nyfed_rrp'], params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        operations = data.get('repo', {}).get('operations', [])
        
        if operations:
            latest = operations[0]
            value = float(latest.get('totalAmtAccepted', 0))  # Already in billions
            date = latest.get('operationDate', today)
            print(f"✓ NY Fed RRP: ${value:.2f}B on {date}")
            return {'date': date, 'value': value}
        
        print("✗ NY Fed RRP: No operations found")
        return None
    except Exception as e:
        print(f"✗ NY Fed RRP error: {e}")
        return None


def fetch_stablecoins() -> Optional[Dict]:
    """Fetch stablecoin market cap from DefiLlama"""
    try:
        response = requests.get(URLS['defillama_stables'], timeout=30)
        response.raise_for_status()
        data = response.json()
        
        assets = data.get('peggedAssets', [])
        total_mcap = sum(a.get('circulating', {}).get('peggedUSD', 0) for a in assets) / 1e9
        
        breakdown = {}
        for asset in sorted(assets, key=lambda x: x.get('circulating', {}).get('peggedUSD', 0), reverse=True)[:10]:
            symbol = asset.get('symbol', 'UNK')
            mcap = asset.get('circulating', {}).get('peggedUSD', 0) / 1e9
            breakdown[symbol] = round(mcap, 1)
        
        print(f"✓ DefiLlama: ${total_mcap:.1f}B total stablecoins")
        return {
            'total_mcap': round(total_mcap, 2),
            'breakdown': breakdown,
            'count': len(assets)
        }
    except Exception as e:
        print(f"✗ DefiLlama error: {e}")
        return None


def fetch_sunspots() -> Optional[float]:
    """Fetch solar sunspot number from NOAA"""
    try:
        response = requests.get(URLS['noaa_ssn'], timeout=30)
        response.raise_for_status()
        data = response.json()
        
        now = datetime.now()
        current_month = f"{now.year}-{now.month:02d}"
        
        for record in data:
            if record.get('time-tag', '').startswith(current_month):
                ssn = record.get('smoothed_ssn') or record.get('predicted_ssn')
                if ssn:
                    print(f"✓ NOAA SSN: {ssn}")
                    return float(ssn)
        
        # Fallback to latest
        if data:
            ssn = data[-1].get('smoothed_ssn') or data[-1].get('predicted_ssn', 0)
            print(f"✓ NOAA SSN (latest): {ssn}")
            return float(ssn)
        
        return None
    except Exception as e:
        print(f"✗ NOAA error: {e}")
        return None


# ============ CALCULATIONS ============

def calculate_net_liquidity(walcl: float, tga: float, rrp: float) -> float:
    """Net Liquidity = Fed Balance Sheet - TGA - RRP"""
    return walcl - tga - rrp


def calculate_ar1(prices: List[float], window: int = 250) -> Optional[float]:
    """Calculate AR(1) autocorrelation coefficient"""
    if len(prices) < window + 50:
        return None
    
    prices = np.array(prices)
    
    # Detrend with moving average
    kernel = np.ones(50) / 50
    trend = np.convolve(prices, kernel, mode='same')
    residuals = prices - trend
    
    # Calculate AR(1) on last window
    window_resid = residuals[-window:]
    x = window_resid[1:]
    x_lag = window_resid[:-1]
    
    if np.std(x) > 0 and np.std(x_lag) > 0:
        corr = np.corrcoef(x, x_lag)[0, 1]
        return float(corr)
    
    return None


def calculate_variance(prices: List[float], window: int = 250) -> Optional[float]:
    """Calculate rolling variance"""
    if len(prices) < window:
        return None
    
    prices = np.array(prices)
    
    # Detrend
    kernel = np.ones(50) / 50
    trend = np.convolve(prices, kernel, mode='same')
    residuals = prices - trend
    
    return float(np.var(residuals[-window:]))


def calculate_kendall_tau(values: List[float]) -> Optional[float]:
    """Calculate Kendall's Tau for trend"""
    if len(values) < 10:
        return None
    
    n = len(values)
    concordant = 0
    discordant = 0
    
    for i in range(n):
        for j in range(i + 1, n):
            if values[j] > values[i]:
                concordant += 1
            elif values[j] < values[i]:
                discordant += 1
    
    total = n * (n - 1) / 2
    if total == 0:
        return 0
    
    return (concordant - discordant) / total


def detect_lppl_bubble(prices: List[float]) -> Dict:
    """Simplified LPPL bubble detection"""
    if len(prices) < 100:
        return {
            'is_bubble': False,
            'confidence': 0,
            'status': 'Insufficient data',
            'tc_days': None,
            'tc_date': None,
            'r2': None,
            'omega': None,
            'm': None,
        }
    
    prices = np.array(prices[-252:])  # Last year
    log_prices = np.log(prices)
    n = len(log_prices)
    t = np.arange(n)
    
    best_r2 = 0
    best_params = None
    
    # Grid search
    for tc_offset in range(20, 120, 10):
        tc = n + tc_offset
        dt = np.maximum(tc - t, 1e-6)
        
        for m in np.arange(0.2, 0.8, 0.15):
            for omega in np.arange(6.5, 12.5, 1.0):
                try:
                    f = np.power(dt, m)
                    g = f * np.cos(omega * np.log(dt))
                    
                    X = np.column_stack([np.ones(n), f, g])
                    coeffs, _, _, _ = np.linalg.lstsq(X, log_prices, rcond=None)
                    
                    A, B, C = coeffs
                    
                    if B >= 0 or abs(C) >= abs(B):
                        continue
                    
                    y_pred = X @ coeffs
                    ss_res = np.sum((log_prices - y_pred) ** 2)
                    ss_tot = np.sum((log_prices - np.mean(log_prices)) ** 2)
                    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
                    
                    if r2 > best_r2:
                        best_r2 = r2
                        best_params = {
                            'tc_days': tc_offset,
                            'm': float(m),
                            'omega': float(omega),
                            'r2': float(r2),
                        }
                except:
                    continue
    
    is_bubble = best_params is not None and best_params['r2'] > 0.7
    confidence = int(best_params['r2'] * 100) if best_params else 0
    
    tc_date = None
    if best_params:
        tc_date = (datetime.now() + timedelta(days=best_params['tc_days'])).strftime('%Y-%m-%d')
    
    return {
        'is_bubble': is_bubble,
        'confidence': confidence,
        'status': 'BUBBLE DETECTED' if is_bubble else 'No bubble signature',
        'tc_days': best_params['tc_days'] if best_params else None,
        'tc_date': tc_date,
        'r2': best_params['r2'] if best_params else None,
        'omega': best_params['omega'] if best_params else None,
        'm': best_params['m'] if best_params else None,
    }


def calculate_rrp_countdown(rrp_history: List[Dict]) -> Dict:
    """Calculate days until RRP exhaustion"""
    if len(rrp_history) < 10:
        return {
            'status': 'INSUFFICIENT_DATA',
            'current_billion': None,
            'drain_rate_per_day': None,
            'days_to_exhaustion': None,
            'projected_zero_date': None,
        }
    
    # Sort by date descending
    sorted_hist = sorted(rrp_history, key=lambda x: x['date'], reverse=True)
    values = [h['value'] for h in sorted_hist[:30]]
    
    current = values[0]
    
    if len(values) >= 2:
        # Calculate average daily drain rate
        drain_rates = []
        for i in range(min(len(values) - 1, 20)):
            daily_drain = values[i + 1] - values[i]  # Positive if draining
            drain_rates.append(daily_drain)
        
        avg_drain_rate = np.mean(drain_rates) if drain_rates else 0
    else:
        avg_drain_rate = 0
    
    # Calculate days to exhaustion
    if avg_drain_rate > 0 and current > 0:
        days_to_zero = int(current / avg_drain_rate)
        projected_date = (datetime.now() + timedelta(days=days_to_zero)).strftime('%Y-%m-%d')
    else:
        days_to_zero = None
        projected_date = None
    
    # Status
    if current < 10:
        status = 'CRITICAL'
    elif current < 100:
        status = 'WARNING'
    elif avg_drain_rate > 0:
        status = 'DRAINING'
    else:
        status = 'STABLE'
    
    return {
        'status': status,
        'current_billion': round(current, 2),
        'drain_rate_per_day': round(avg_drain_rate, 2),
        'days_to_exhaustion': days_to_zero,
        'projected_zero_date': projected_date,
    }


def assess_credit_stress(vix: float, t10y2y: float, hy_spread: float, cp_rate: float = None, tbill_rate: float = None) -> Dict:
    """Assess credit market stress"""
    score = 0
    
    # VIX contribution
    if vix and vix > 30:
        score += 30
    elif vix and vix > 25:
        score += 20
    elif vix and vix > 20:
        score += 10
    
    # Yield curve (inverted = stress)
    if t10y2y is not None:
        if t10y2y < -0.5:
            score += 25
        elif t10y2y < 0:
            score += 15
        elif t10y2y < 0.25:
            score += 5
    
    # HY spread
    if hy_spread:
        if hy_spread > 6:
            score += 30
        elif hy_spread > 5:
            score += 20
        elif hy_spread > 4:
            score += 10
    
    # CP-TBill spread
    cp_tbill_spread = None
    if cp_rate is not None and tbill_rate is not None:
        cp_tbill_spread = (cp_rate - tbill_rate) * 100  # Convert to bps
        if cp_tbill_spread > 50:
            score += 15
        elif cp_tbill_spread > 25:
            score += 10
    
    # Status
    if score >= 50:
        status = 'CRITICAL'
    elif score >= 30:
        status = 'STRESSED'
    elif score >= 15:
        status = 'ELEVATED'
    else:
        status = 'NORMAL'
    
    return {
        'status': status,
        'score': score,
        'vix': vix,
        'yield_curve': t10y2y,
        'hy_spread': hy_spread,
        'cp_tbill_spread': round(cp_tbill_spread, 1) if cp_tbill_spread else None,
    }


def assess_regime(net_liq: float, rrp: float, reserves: float, credit_score: int, ar1: float = None, lppl_bubble: bool = False) -> Dict:
    """Assess overall regime fragility"""
    composite = 30  # Base
    
    # RRP exhaustion (critical factor)
    if rrp is not None:
        if rrp < 10:
            composite += 25
        elif rrp < 100:
            composite += 20
        elif rrp < 500:
            composite += 10
    
    # Reserve scarcity
    if reserves:
        reserves_t = reserves / 1000  # Convert to trillions (assuming input in billions)
        if reserves_t < 2.5:
            composite += 20
        elif reserves_t < 3.0:
            composite += 10
    
    # Credit stress
    composite += credit_score * 0.25
    
    # AR(1) CSD
    if ar1 is not None:
        if ar1 > 0.8:
            composite += 15
        elif ar1 > 0.7:
            composite += 10
        elif ar1 > 0.6:
            composite += 5
    
    # LPPL bubble
    if lppl_bubble:
        composite += 10
    
    # Clamp
    composite = max(0, min(100, composite))
    
    # Status and signal
    if composite >= 70:
        status, signal = 'CRITICAL', 'STRONG SELL'
    elif composite >= 55:
        status, signal = 'ELEVATED', 'REDUCE RISK'
    elif composite >= 40:
        status, signal = 'CAUTION', 'HOLD'
    elif composite >= 25:
        status, signal = 'NORMAL', 'ACCUMULATE'
    else:
        status, signal = 'FAVORABLE', 'STRONG BUY'
    
    return {
        'composite': round(composite, 1),
        'status': status,
        'signal': signal,
    }


# ============ MAIN ============

def main():
    print("=" * 60)
    print("FRACTAL TERMINAL V8 - DATA COMPUTATION")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"FRED API Key: {'✓ Set' if FRED_API_KEY else '✗ Missing'}")
    print()
    
    # Fetch all data
    print("Fetching data sources...")
    print("-" * 40)
    
    # FRED data
    walcl_data = fetch_fred_series('WALCL', 1000)
    tga_fred_data = fetch_fred_series('WTREGEN', 1000)
    rrp_fred_data = fetch_fred_series('RRPONTSYD', 500)
    reserves_data = fetch_fred_series('WRESBAL', 500)
    spx_data = fetch_fred_series('SP500', 1000)
    vix_data = fetch_fred_series('VIXCLS', 100)
    t10y2y_data = fetch_fred_series('T10Y2Y', 100)
    hy_data = fetch_fred_series('BAMLH0A0HYM2', 100)
    cp_data = fetch_fred_series('RIFSPPFAAD90NB', 50)
    tbill_data = fetch_fred_series('TB3MS', 50)
    
    # Live data sources
    treasury_tga = fetch_treasury_dts()
    nyfed_rrp = fetch_nyfed_rrp()
    stablecoins = fetch_stablecoins()
    ssn = fetch_sunspots()
    
    print("-" * 40)
    print()
    
    # Process latest values
    latest_walcl = walcl_data[0]['value'] * 1000 if walcl_data else None  # Convert to millions
    latest_reserves = reserves_data[0]['value'] * 1000 if reserves_data else None
    latest_spx = spx_data[0]['value'] if spx_data else None
    latest_vix = vix_data[0]['value'] if vix_data else None
    latest_t10y2y = t10y2y_data[0]['value'] if t10y2y_data else None
    latest_hy = hy_data[0]['value'] if hy_data else None
    latest_cp = cp_data[0]['value'] if cp_data else None
    latest_tbill = tbill_data[0]['value'] if tbill_data else None
    
    # TGA: prefer Treasury API, fallback to FRED
    if treasury_tga:
        latest_tga = treasury_tga['value']
        tga_source = 'Treasury API (T-1)'
    elif tga_fred_data:
        latest_tga = tga_fred_data[0]['value'] * 1000  # Convert to billions
        tga_source = 'FRED WTREGEN (Weekly)'
    else:
        latest_tga = None
        tga_source = 'Unavailable'
    
    # RRP: prefer NY Fed, fallback to FRED
    if nyfed_rrp:
        latest_rrp = nyfed_rrp['value']
        rrp_source = 'NY Fed (Same-day)'
    elif rrp_fred_data:
        latest_rrp = rrp_fred_data[0]['value']
        rrp_source = 'FRED RRPONTSYD'
    else:
        latest_rrp = None
        rrp_source = 'Unavailable'
    
    # Calculate Net Liquidity
    if latest_walcl and latest_tga and latest_rrp is not None:
        latest_net_liq = calculate_net_liquidity(latest_walcl, latest_tga * 1000, latest_rrp)  # TGA in millions
    else:
        latest_net_liq = None
    
    print("Processing calculations...")
    
    # Build timeseries
    timeseries = []
    
    # Create date-indexed maps
    walcl_map = {d['date']: d['value'] * 1000 for d in walcl_data}
    tga_map = {d['date']: d['value'] * 1000 for d in tga_fred_data}
    rrp_map = {d['date']: d['value'] for d in rrp_fred_data}
    spx_map = {d['date']: d['value'] for d in spx_data}
    
    all_dates = sorted(set(walcl_map.keys()) | set(tga_map.keys()) | set(rrp_map.keys()))
    
    # Forward fill
    last_walcl, last_tga, last_rrp, last_spx = None, None, None, None
    
    for date in all_dates:
        w = walcl_map.get(date, last_walcl)
        t = tga_map.get(date, last_tga)
        r = rrp_map.get(date, last_rrp)
        s = spx_map.get(date, last_spx)
        
        if w: last_walcl = w
        if t: last_tga = t
        if r is not None: last_rrp = r
        if s: last_spx = s
        
        if w and t and r is not None:
            net_liq = w - t - r
            timeseries.append({
                'date': date,
                'balance_sheet': w,
                'tga': t / 1000,  # Back to billions for display
                'rrp': r,
                'net_liquidity': net_liq,
                'spx': s,
            })
    
    # Calculate CSD indicators
    spx_prices = [d['spx'] for d in timeseries if d.get('spx')]
    ar1_value = calculate_ar1(spx_prices) if len(spx_prices) > 300 else None
    variance_value = calculate_variance(spx_prices) if len(spx_prices) > 300 else None
    
    # Add AR1 and variance to timeseries (last 500 points)
    if len(spx_prices) > 300:
        for i, d in enumerate(timeseries[-500:]):
            if i >= 250:
                # Calculate rolling AR1
                window_prices = spx_prices[max(0, i-250):i]
                d['ar1'] = calculate_ar1(window_prices) if len(window_prices) > 100 else None
                d['variance'] = calculate_variance(window_prices) if len(window_prices) > 100 else None
    
    # Kendall tau on recent AR1 values
    recent_ar1 = [d.get('ar1') for d in timeseries[-100:] if d.get('ar1') is not None]
    kendall_tau = calculate_kendall_tau(recent_ar1) if len(recent_ar1) > 10 else None
    
    # CSD status
    if ar1_value is not None:
        if ar1_value > 0.8:
            csd_status = 'CRITICAL'
        elif ar1_value > 0.7:
            csd_status = 'ELEVATED'
        elif ar1_value > 0.6:
            csd_status = 'RISING'
        else:
            csd_status = 'NORMAL'
    else:
        csd_status = 'UNKNOWN'
    
    # LPPL detection
    lppl = detect_lppl_bubble(spx_prices)
    
    # RRP countdown
    rrp_history = [{'date': d['date'], 'value': d['rrp']} for d in timeseries if d.get('rrp') is not None]
    rrp_countdown = calculate_rrp_countdown(rrp_history)
    
    # Credit stress
    credit_stress = assess_credit_stress(latest_vix, latest_t10y2y, latest_hy, latest_cp, latest_tbill)
    
    # Regime assessment
    regime = assess_regime(
        latest_net_liq,
        latest_rrp,
        latest_reserves,
        credit_stress['score'],
        ar1_value,
        lppl['is_bubble']
    )
    
    # Build output
    output = {
        'meta': {
            'generated_at': datetime.now().isoformat(),
            'version': '8.0.0',
            'data_integrity': 'COMPLETE' if (latest_walcl and latest_tga and latest_rrp is not None) else 'PARTIAL',
            'sources': {
                'walcl': 'FRED WALCL',
                'tga': tga_source,
                'rrp': rrp_source,
                'reserves': 'FRED WRESBAL',
                'spx': 'FRED SP500',
                'stablecoins': 'DefiLlama',
                'sunspots': 'NOAA SWPC',
            }
        },
        'latest': {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'balance_sheet': latest_walcl,
            'tga': latest_tga,
            'tga_source': tga_source,
            'rrp': latest_rrp,
            'rrp_source': rrp_source,
            'reserves': latest_reserves,
            'net_liquidity': latest_net_liq,
            'spx': latest_spx,
            'ssn': ssn,
            'vix': latest_vix,
            'yield_curve': latest_t10y2y,
            'hy_spread': latest_hy,
        },
        'regime': regime,
        'csd': {
            'current_ar1': round(ar1_value, 4) if ar1_value else None,
            'current_variance': round(variance_value, 4) if variance_value else None,
            'kendall_tau': round(kendall_tau, 4) if kendall_tau else None,
            'status': csd_status,
        },
        'lppl': lppl,
        'credit_stress': credit_stress,
        'rrp_countdown': rrp_countdown,
        'global_m2': {
            'current': None,  # Would need additional FRED series
            'roc_30d': None,
        },
        'stablecoins': stablecoins,
        'timeseries': timeseries[-500:],  # Last 500 data points
        'record_count': len(timeseries),
    }
    
    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH) if os.path.dirname(OUTPUT_PATH) else '.', exist_ok=True)
    
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)
    
    print()
    print("=" * 60)
    print("OUTPUT SUMMARY")
    print("=" * 60)
    print(f"Output file: {OUTPUT_PATH}")
    print(f"Data points: {len(timeseries)}")
    print(f"Date range: {timeseries[0]['date'] if timeseries else 'N/A'} to {timeseries[-1]['date'] if timeseries else 'N/A'}")
    print()
    print("Latest Values:")
    print(f"  Fed BS:      ${latest_walcl/1e6:.2f}T" if latest_walcl else "  Fed BS:      N/A")
    print(f"  TGA:         ${latest_tga:.0f}B ({tga_source})" if latest_tga else "  TGA:         N/A")
    print(f"  RRP:         ${latest_rrp:.1f}B ({rrp_source})" if latest_rrp is not None else "  RRP:         N/A")
    print(f"  Net Liq:     ${latest_net_liq/1e6:.2f}T" if latest_net_liq else "  Net Liq:     N/A")
    print(f"  Reserves:    ${latest_reserves/1e6:.2f}T" if latest_reserves else "  Reserves:    N/A")
    print()
    print(f"Regime:        {regime['status']} ({regime['composite']:.0f}/100) → {regime['signal']}")
    print(f"CSD:           {csd_status} (AR1={ar1_value:.3f})" if ar1_value else f"CSD:           {csd_status}")
    print(f"LPPL:          {'BUBBLE DETECTED' if lppl['is_bubble'] else 'No bubble'} ({lppl['confidence']}%)")
    print(f"RRP Countdown: {rrp_countdown['status']} ({rrp_countdown['days_to_exhaustion']} days)" if rrp_countdown['days_to_exhaustion'] else f"RRP Countdown: {rrp_countdown['status']}")
    print(f"Credit:        {credit_stress['status']} (VIX={latest_vix:.1f})" if latest_vix else f"Credit:        {credit_stress['status']}")
    print()
    print("✓ Complete")


if __name__ == '__main__':
    main()
