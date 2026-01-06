import dynamic from 'next/dynamic';
import Head from 'next/head';

const FLRTrackerV3 = dynamic(() => import('../src/FLRTrackerV3'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>FLR Tracker | Real-Time Market Regime Analysis</title>
        <meta name="description" content="Authentic Federal Reserve liquidity tracking with peer-reviewed statistical methods. No simulated data." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <FLRTrackerV3 />
    </>
  );
}
