import { useState } from "react";
import Notification from "./Notification";
import { useOrderBookStore } from "../store/orderBookStore";

const BuyForm = () => {
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const addOrder = useOrderBookStore((state) => state.addOrder);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [shares, setShares] = useState<number>(100);

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationDetails, setNotificationDetails] = useState("");

  const multiplyShares = (factor: number) => {
    setShares((prev) => prev * factor);
  };

  const total = ((limitPrice / 100) * shares).toFixed(2);
  const toWin = shares.toString();

  const placeOrder = () => {
    addOrder({
      type: mode,
      price: limitPrice,
      shares,
      total: (limitPrice / 100) * shares,
    });

    const actionText = `${mode === "BUY" ? "Buy" : "Sell"} ${direction}`;
    setNotificationMessage(`${actionText} placed`);
    setNotificationDetails(`${shares} shares @ ${limitPrice}¢`);

    setShowNotification(true);

    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      {showNotification && (
        <Notification
          message={notificationMessage}
          details={notificationDetails}
          onClose={() => setShowNotification(false)}
        />
      )}

      <div className="w-[350px] bg-[#111] text-white p-6 rounded-xl shadow-lg border border-[#333]">
        {/* TABS */}
        <div className="flex justify-between mb-4 border-b border-gray-600 pb-2">
          {["BUY", "SELL"].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-1 ${
                mode === tab
                  ? tab === "BUY"
                    ? "text-green-400 border-b-2 border-green-400"
                    : "text-red-400 border-b-2 border-red-400"
                  : "text-gray-400"
              }`}
              onClick={() => setMode(tab as "BUY" | "SELL")}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* UP / DOWN */}
        <div className="flex gap-3 mb-5">
          <button
            className={`flex-1 text-lg font-semibold py-3 rounded-lg transition ${
              direction === "UP"
                ? mode === "BUY"
                  ? "bg-green-600"
                  : "bg-red-600"
                : "bg-gray-700"
            }`}
            onClick={() => setDirection("UP")}
          >
            Up {limitPrice}¢
          </button>

          <button
            className={`flex-1 text-lg font-semibold py-3 rounded-lg transition ${
              direction === "DOWN"
                ? mode === "BUY"
                  ? "bg-green-600"
                  : "bg-red-600"
                : "bg-gray-700"
            }`}
            onClick={() => setDirection("DOWN")}
          >
            Down {limitPrice}¢
          </button>
        </div>

        {/* LIMIT PRICE */}
        <div className="mb-4">
          <label className="text-sm text-gray-400">Limit Price (¢)</label>
          <div className="flex items-center gap-3 mt-1">
            <button
              className="bg-gray-700 px-3 py-2 rounded"
              onClick={() => setLimitPrice((prev) => Math.max(prev - 1, 0))}
            >
              −
            </button>

            <input
              type="number"
              className="bg-[#222] w-full py-2 px-3 rounded border border-gray-600 text-center"
              value={limitPrice}
              onChange={(e) => setLimitPrice(Number(e.target.value))}
            />

            <button
              className="bg-gray-700 px-3 py-2 rounded"
              onClick={() => setLimitPrice((prev) => prev + 1)}
            >
              +
            </button>
          </div>
        </div>

        {/* SHARES */}
        <div>
          <label className="text-sm text-gray-400">Shares</label>
          <div className="flex gap-3 mt-1">
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(Number(e.target.value))}
              className="bg-[#222] flex-1 py-2 px-3 rounded border border-gray-600 text-center"
            />
          </div>

          {/* MULTIPLIERS */}
          <div className="flex gap-2 justify-center mt-3">
            {[2, 5, 10].map((x) => (
              <button
                key={x}
                className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
                onClick={() => multiplyShares(x)}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-700 my-5" />

        {/* TOTALS */}
        <div className="flex justify-between text-lg mb-2">
          <span>Total</span>
          <span className="text-blue-400">${total}</span>
        </div>

        <div className="flex justify-between text-lg mb-5">
          <span>To Win 💵</span>
          <span className="text-green-400">{toWin}</span>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          className="w-full bg-blue-600 py-3 font-semibold rounded-lg hover:bg-blue-500 transition"
          onClick={placeOrder}
        >
          {mode === "BUY"
            ? `Buy ${direction === "UP" ? "Up" : "Down"}`
            : `Sell ${direction === "UP" ? "Up" : "Down"}`}
        </button>
      </div>
    </div>
  );
};

export default BuyForm;
