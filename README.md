# FLR Tracker v3.0 — 100% Real Data

A market regime analysis tool using **authentic Federal Reserve data** and **peer-reviewed statistical methods**.

> ⚠️ **NO DATA IS SIMULATED OR FAKED** — Every number is fetched from official government APIs and fully auditable.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GITHUB ACTIONS (Free)                       │
│                  Runs daily at 9 PM ET                       │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │            scripts/compute_flr.py                   │    │
│   │                                                     │    │
│   │  1. fredapi → WALCL, WTREGEN, RRPONTSYD, SP500     │    │
│   │  2. requests → NOAA solar data                      │    │
│   │  3. Manual CSD → AR(1), Variance, Kendall Tau      │    │
│   │  4. lppls → Nelder-Mead LPPL optimization          │    │
│   │  5. Output → public/flr-data.json                  │    │
│   └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│              Commits flr-data.json to repo                   │
└───────────────────────────│──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (Free)                            │
│                                                              │
│   /api/data → Serves pre-computed flr-data.json             │
│   React UI → Displays charts and metrics                     │
│                                                              │
│   NO COMPUTATION ON VERCEL = NO TIMEOUT ISSUES              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources (All Auditable)

| Data | Source | Series | Frequency | URL |
|------|--------|--------|-----------|-----|
| Fed Balance Sheet | FRED | WALCL | Weekly | [Link](https://fred.stlouisfed.org/series/WALCL) |
| Treasury Account | FRED | WTREGEN | Weekly | [Link](https://fred.stlouisfed.org/series/WTREGEN) |
| Reverse Repo | FRED | RRPONTSYD | Daily | [Link](https://fred.stlouisfed.org/series/RRPONTSYD) |
| Bank Reserves | FRED | WRESBAL | Weekly | [Link](https://fred.stlouisfed.org/series/WRESBAL) |
| S&P 500 | FRED | SP500 | Daily | [Link](https://fred.stlouisfed.org/series/SP500) |
| Solar Cycle | NOAA SWPC | SSN, F10.7 | Monthly | [Link](https://www.swpc.noaa.gov) |

---

## Statistical Methods (Peer-Reviewed)

### Critical Slowing Down (CSD)
- **Reference**: Scheffer et al. (2009) "Early-warning signals for critical transitions" — *Nature* 461, 53-59
- **Method**: Gaussian kernel detrending → Rolling AR(1) → Kendall's Tau trend detection
- **Interpretation**: AR(1) → 1.0 indicates loss of system resilience

### Log-Periodic Power Law (LPPL)
- **Reference**: Sornette (2003) "Why Stock Markets Crash" — *Princeton University Press*
- **Library**: `lppls` by Boulder Investment Technologies
- **Method**: Nelder-Mead optimization with Sornette filters (0.1 < m < 0.9, 6 < ω < 13)

---

## Setup Instructions (From Phone)

### Step 1: Get a FRED API Key (Free)

1. Go to: https://fred.stlouisfed.org/docs/api/api_key.html
2. Click **Request API Key**
3. Create account and verify email
4. Copy your API key — save it!

---

### Step 2: Create GitHub Repository

1. Go to: https://github.com
2. Click **+** → **New repository**
3. Name: `flr-tracker-v3`
4. Keep **Public**
5. Click **Create repository**

---

### Step 3: Upload Files

1. Download and unzip the project files
2. In your new repo, click **"uploading an existing file"**
3. Upload ALL files from the unzipped folder
4. Click **Commit changes**

---

### Step 4: Add FRED API Key to GitHub Secrets

**This is critical — the automation needs your API key!**

1. In your repo, go to **Settings** (tab at top)
2. In left sidebar: **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FRED_API_KEY`
5. Value: (paste your FRED API key)
6. Click **Add secret**

---

### Step 5: Run the GitHub Action (First Time)

1. Go to **Actions** tab in your repo
2. You'll see "Daily FLR Computation" workflow
3. Click on it
4. Click **Run workflow** → **Run workflow**
5. Wait 2-3 minutes for it to complete
6. Check that `public/flr-data.json` was updated

---

### Step 6: Deploy to Vercel

1. Go to: https://vercel.com
2. Sign in with GitHub
3. Click **Add New** → **Project**
4. Import your `flr-tracker-v3` repo
5. Framework: **Next.js** (should auto-detect)
6. Click **Deploy**
7. Wait ~90 seconds

---

### Step 7: Done! 🎉

Your tracker is now live with **100% real data**.

The GitHub Action will automatically run every day at 9 PM ET to refresh the data.

---

## Verification

Every computation run includes a full **audit log** showing:
- Timestamp of each API call
- Source URL
- Records fetched
- Latest values
- Computation parameters

Click the 📄 button in the app to view the audit log.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Data not yet computed" | Run the GitHub Action manually (Step 5) |
| Action fails | Check that `FRED_API_KEY` secret is set correctly |
| Data looks old | Check Actions tab — workflow should run daily |
| Charts empty | Verify `public/flr-data.json` has data (not placeholder) |

---

## File Structure

```
flr-tracker-v3/
├── .github/
│   └── workflows/
│       └── daily-update.yml    # Automated daily computation
├── pages/
│   ├── api/
│   │   └── data.js             # Serves pre-computed data
│   ├── _app.js
│   └── index.js
├── public/
│   └── flr-data.json           # Pre-computed data (updated daily)
├── scripts/
│   └── compute_flr.py          # Python computation script
├── src/
│   └── FLRTrackerV3.jsx        # React frontend
├── styles/
│   └── globals.css
├── package.json
├── requirements.txt            # Python dependencies
└── README.md
```

---

## License

MIT

---

## Disclaimer

This tool is for **educational and research purposes only**. It is **not financial advice**. Past performance and statistical indicators do not guarantee future results.
