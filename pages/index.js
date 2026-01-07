import dynamic from 'next/dynamic';
import Head from 'next/head';

const FractalTerminal = dynamic(() => import('../src/FractalTerminal'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Fractal Terminal | Institutional Liquidity Analysis</title>
        <meta name="description" content="Real-time liquidity regime tracking with high-frequency data feeds, Global M2, stablecoin impulse, and credit stress indicators." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <FractalTerminal />
    </>
  );
}
