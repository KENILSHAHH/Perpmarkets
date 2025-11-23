import Candles from "./components/Candles";
import BuyForm from "./components/BuyForm";
import OrderBook from "./components/OrderBook";
import { OrderBook as OldOrderBook } from "./components/OldOrderBook";

export default function App() {
  return (
    <div>
      <div className="flex h-screen bg-black text-white overflow-hidden">
        {/* LEFT SIDE → 70% */}
        <div className="w-[70%] flex flex-col border-r border-gray-700">
          {/* Top: ORDER BOOKS side by side */}
          <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-auto">
            <div className="overflow-auto">
              <h3 className="text-sm text-gray-400 mb-2">Perpetual Orders Book</h3>
              <OrderBook />
            </div>
            <div className="overflow-auto">
              <h3 className="text-sm text-gray-400 mb-2">Polymarket Bids Order Book</h3>
              <OldOrderBook />
            </div>
          </div>

          {/* Bottom: Two candle charts side-by-side */}
          {/* <div className="flex-1 grid grid-cols-2 gap-2 p-4 overflow-hidden">
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <Candles />
          </div>
        </div> */}
        </div>

        {/* RIGHT SIDE → 30% */}
        <div className="w-[30%] p-4 overflow-auto border-l border-gray-700">
          <BuyForm />
        </div>
      </div>
      <Candles />
    </div>
  );
}
