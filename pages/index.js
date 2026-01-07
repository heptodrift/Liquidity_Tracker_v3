import dynamic from 'next/dynamic';
import Head from 'next/head';

const FLRTracker = dynamic(() => import('../src/FLRTrackerV4'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>FLR Tracker | Institutional Liquidity Analysis</title>
      </Head>
      <FLRTracker />
    </>
  );
}
