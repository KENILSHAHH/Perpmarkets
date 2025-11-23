import { useOrderBookStore } from "../store/orderBookStore";
import { ChevronUp, HelpCircle, Rows3 } from "lucide-react";

const OrderBook = () => {
  const asks = useOrderBookStore((state) => state.asks);
  const bids = useOrderBookStore((state) => state.bids);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format price as cents
  const formatPrice = (price: number): string => {
    return `${price.toFixed(0)}¢`;
  };

  // Calculate max shares for depth visualization
  const maxShares = Math.max(
    ...bids.map((b) => b.shares),
    ...asks.map((a) => a.shares),
    1 // Prevent division by zero
  );

  // Calculate last price and spread
  const lastPrice = asks.length > 0 && bids.length > 0 
    ? formatPrice((asks[0].price + bids[0].price) / 2)
    : "—";
  const spread = asks.length > 0 && bids.length > 0
    ? formatPrice(asks[0].price - bids[0].price)
    : "—";

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold text-gray-100">Perpetual Orders Book</h2>
          <HelpCircle className="w-3 h-3 text-gray-500" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" title="Connected" />
          <button className="h-6 w-6 flex items-center justify-center hover:bg-gray-800 rounded transition-colors">
            <ChevronUp className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-800 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
        <div className="flex items-center gap-0.5">
          <span>Trade Up</span>
          <Rows3 className="w-2 h-2" />
        </div>
        <div className="text-center">Price</div>
        <div className="text-center">Shares</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks Section */}
      <div className="relative max-h-64 overflow-y-auto">
        {asks.length > 0 ? (
          asks.map((ask, index) => {
            const widthPercent = (ask.shares / maxShares) * 100;

            return (
              <div key={`ask-${ask.price}-${index}`} className="relative transition-all duration-200 ease-in-out">
                {/* Background depth bar */}
                <div className="absolute inset-y-0 left-0 bg-red-900/30 transition-all duration-200" style={{ width: `${widthPercent}%` }} />
                {/* Content */}
                <div className="relative grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 hover:bg-gray-800/50 transition-colors">
                  <div>
                    {index === 0 && (
                      <span className="inline-block px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-medium rounded">
                        Asks
                      </span>
                    )}
                  </div>
                  <div className="text-center text-red-400 font-medium text-xs transition-colors duration-200">
                    {formatPrice(ask.price)}
                  </div>
                  <div className="text-center text-gray-200 text-xs transition-colors duration-200">
                    {formatNumber(ask.shares)}
                  </div>
                  <div className="text-right text-gray-200 text-xs transition-colors duration-200">
                    ${formatNumber(ask.total)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-500 text-xs">
            No Ask Orders
          </div>
        )}
      </div>

      {/* Spread Info */}
      <div className="grid grid-cols-2 px-3 py-1.5 bg-gray-800 text-xs text-gray-300">
        <div className="transition-colors duration-200">Last: {lastPrice}</div>
        <div className="text-center transition-colors duration-200">Spread: {spread}</div>
      </div>

      {/* Bids Section */}
      <div className="relative max-h-64 overflow-y-auto">
        {bids.length > 0 ? (
          bids.map((bid, index) => {
            const widthPercent = (bid.shares / maxShares) * 100;

            return (
              <div key={`bid-${bid.price}-${index}`} className="relative transition-all duration-200 ease-in-out">
                {/* Background depth bar */}
                <div className="absolute inset-y-0 left-0 bg-green-900/30 transition-all duration-200" style={{ width: `${widthPercent}%` }} />
                {/* Content */}
                <div className="relative grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 border-t border-gray-700 hover:bg-gray-800/50 transition-colors">
                  <div>
                    {index === 0 && (
                      <span className="inline-block px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-medium rounded">
                        Bids
                      </span>
                    )}
                  </div>
                  <div className="text-center text-green-400 font-medium text-xs transition-colors duration-200">
                    {formatPrice(bid.price)}
                  </div>
                  <div className="text-center text-gray-200 text-xs transition-colors duration-200">
                    {formatNumber(bid.shares)}
                  </div>
                  <div className="text-right text-gray-200 text-xs transition-colors duration-200">
                    ${formatNumber(bid.total)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-500 text-xs">
            No Bid Orders
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderBook;
