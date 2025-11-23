"use client"

// import WalletButton from "@/components/WalletButton";
import { OrderBook } from "@/components/PolyOrderBook";
import { CandleChart, usePolymarketCandles } from "@/components/Candle";
import Balance from "@/components/Balance";

export default function Home() {
  const {
    candlesA,
    candlesB,
    assetA,
    assetB,
    latestPriceA,
    latestPriceB,
    isConnected,
    isLoading,
  } = usePolymarketCandles();

  const latestA = candlesA[candlesA.length - 1]?.close ?? null;
  const latestB = candlesB[candlesB.length - 1]?.close ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black relative">
      {/* Balance display in top right */}
      <div className="fixed top-4 right-4 z-20">
        <Balance />
      </div>
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-8 mb-8">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50">
            Perp Markets
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400 text-center">
            Real-time order book for perpetual markets trading.
          </p>
          {/* <WalletButton /> */}
        </div>
      </main>
      
      {/* Main content area with candles on left and order book on right */}
      <div className="fixed top-4 left-4 right-4 flex gap-4 z-10">
        {/* Candles on the left */}
        <div className="flex-1 max-w-4xl space-y-4">
          {/* Asset A - BUY */}
          <div className="bg-black rounded-lg border border-gray-800 p-4">
            <h2 className="text-center text-white mb-2 text-sm">
              Asset A (BUY) – {assetA.slice(0, 10)}...
              {latestA != null && (
                <span className="ml-2 text-xs text-green-400">
                  Live: {latestA.toFixed(4)}
                </span>
              )}
              {!isConnected && !isLoading && (
                <span className="ml-2 text-xs text-red-400">(Disconnected)</span>
              )}
            </h2>
            <CandleChart candles={candlesA} latestPrice={latestPriceA} />
          </div>
          
          {/* Asset B - BUY */}
          <div className="bg-black rounded-lg border border-gray-800 p-4">
            <h2 className="text-center text-white mb-2 text-sm">
              Asset B (BUY) – {assetB.slice(0, 10)}...
              {latestB != null && (
                <span className="ml-2 text-xs text-green-400">
                  Live: {latestB.toFixed(4)}
                </span>
              )}
            </h2>
            <CandleChart candles={candlesB} latestPrice={latestPriceB} />
          </div>
        </div>
        
        {/* OrderBook on the right */}
        <div className="w-1/4 max-w-sm">
          <OrderBook />
        </div>
      </div>
    </div>
  );
}
