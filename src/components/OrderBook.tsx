import { useOrderBookStore } from "../store/orderBookStore";

const OrderBook = () => {
  const asks = useOrderBookStore((state) => state.asks);
  const bids = useOrderBookStore((state) => state.bids);

  return (
    <div className="bg-black text-white p-4 rounded-lg border border-gray-700 w-full h-full flex flex-col">
      <h2 className="text-lg font-bold mb-3">📖 Order Book</h2>

      {/* Header */}
      <div className="grid grid-cols-3 text-gray-400 text-sm border-b border-gray-600 pb-1">
        <span>Price</span>
        <span>Shares</span>
        <span>Total ($)</span>
      </div>

      {/* === ASKS SECTION === */}
      <div className="mt-2 flex flex-col overflow-y-auto flex-1 pr-2">
        <p className="text-red-400 text-sm font-semibold sticky top-0 bg-black pb-1">
          Asks
        </p>

        {asks.length === 0 && (
          <p className="text-gray-500 text-xs">No Ask Orders</p>
        )}

        {asks.map((o, i) => (
          <div
            key={i}
            className="grid grid-cols-3 py-1 text-red-300 text-sm hover:bg-[#111] rounded"
          >
            <span>{o.price}¢</span>
            <span>{o.shares.toLocaleString()}</span>
            <span>${o.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <hr className="border-gray-700 my-3" />

      {/* === BIDS SECTION === */}
      <div className="flex flex-col overflow-y-auto flex-1 pr-2">
        <p className="text-green-400 text-sm font-semibold sticky top-0 bg-black pb-1">
          Bids
        </p>

        {bids.length === 0 && (
          <p className="text-gray-500 text-xs">No Bid Orders</p>
        )}

        {bids.map((o, i) => (
          <div
            key={i}
            className="grid grid-cols-3 py-1 text-green-300 text-sm hover:bg-[#111] rounded"
          >
            <span>{o.price}¢</span>
            <span>{o.shares.toLocaleString()}</span>
            <span>${o.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook;
