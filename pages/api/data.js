/**
 * API Route: /api/data
 * 
 * This endpoint serves the pre-computed FLR data.
 * The data is computed by GitHub Actions (daily) and committed to the repo.
 * This approach avoids Vercel timeout issues with heavy computations.
 * 
 * Data is 100% authentic:
 * - Federal Reserve data from FRED
 * - Solar data from NOAA SWPC
 * - Statistics computed using peer-reviewed methods (ewstools, lppls)
 * 
 * Full audit trail is included in the response.
 */

import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // 5 min cache
  
  try {
    // Read pre-computed data from public directory
    const dataPath = path.join(process.cwd(), 'public', 'flr-data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Add server timestamp
    data.served_at = new Date().toISOString();
    
    // Check if data is placeholder
    if (data.meta?.status === 'AWAITING_FIRST_RUN') {
      return res.status(503).json({
        error: 'Data not yet computed',
        message: 'Please trigger the GitHub Action "Daily FLR Computation" to generate real data.',
        instructions: [
          '1. Go to your GitHub repository',
          '2. Click "Actions" tab',
          '3. Select "Daily FLR Computation"',
          '4. Click "Run workflow"',
          '5. Wait for completion, then refresh this page'
        ]
      });
    }
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error loading FLR data:', error);
    return res.status(500).json({
      error: 'Failed to load data',
      message: error.message
    });
  }
}
