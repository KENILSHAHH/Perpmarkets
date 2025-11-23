import React, { useEffect, useState } from "react";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 350;
const MARGIN = { top: 20, right: 50, bottom: 40, left: 20 };

type Side = "BUY" | "SELL";

interface PriceChange {
  asset_id: string;
  price: string; // e.g. "0.62"
  size: string;
  side: Side;
  hash: string;
  best_bid: string;
  best_ask: string;
}

interface MarketMessage {
  market: string;
  price_changes: PriceChange[];
  timestamp: string;
  event_type: string;
}

interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const MOCK_MESSAGES: MarketMessage[] = [
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984018",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.62",
        size: "171.7",
        side: "SELL",
        hash: "bb3a37dbd745ce4eabe6bc19abd1b5aa2734355b",
        best_bid: "0.59",
        best_ask: "0.61",
      },
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.38",
        size: "171.7",
        side: "BUY",
        hash: "3bf82fdf23c402f65ea15db98028a345e7df1bde",
        best_bid: "0.39",
        best_ask: "0.41",
      },
    ],
  },
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984046",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.58",
        size: "256.93",
        side: "BUY",
        hash: "497d16502cdaade21d4605a6c2f23e2a79d77d0e",
        best_bid: "0.59",
        best_ask: "0.61",
      },
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.42",
        size: "256.93",
        side: "SELL",
        hash: "132e0b1b2cb96aef97d6c12dbcf9fdc23c5c3d60",
        best_bid: "0.39",
        best_ask: "0.41",
      },
    ],
  },
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984109",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.38",
        size: "221.7",
        side: "BUY",
        hash: "a4744405c2e3868d82942759841e8258b3bdc123",
        best_bid: "0.39",
        best_ask: "0.41",
      },
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.62",
        size: "221.7",
        side: "SELL",
        hash: "a078485ef8613a2981afa3b77bbfeb62276ab153",
        best_bid: "0.59",
        best_ask: "0.61",
      },
    ],
  },
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984115",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.39",
        size: "99",
        side: "BUY",
        hash: "6755ac93940f0f6157a5d0aaf4532dfabb427a94",
        best_bid: "0.39",
        best_ask: "0.41",
      },
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.61",
        size: "99",
        side: "SELL",
        hash: "ae01fef7729c7d1d8e343b8258df1e8d1d7bb34b",
        best_bid: "0.59",
        best_ask: "0.61",
      },
    ],
  },
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984186",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.57",
        size: "133",
        side: "BUY",
        hash: "d538ad99f8cb4dbf46609d693e761a5053cca04d",
        best_bid: "0.59",
        best_ask: "0.61",
      },
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.43",
        size: "133",
        side: "SELL",
        hash: "c2f055bef1e407c60c8d8c05ab16c6c8e8d50b50",
        best_bid: "0.39",
        best_ask: "0.41",
      },
    ],
  },
  {
    market:
      "0xc6b130592f77c4e4e6447c7000cf59422f55d673104ade2d93dbb55c20bd5c3a",
    timestamp: "1763867984739",
    event_type: "price_change",
    price_changes: [
      {
        asset_id:
          "21534842544111982439773280479187620610734941353303223550685659480563753497604",
        price: "0.32",
        size: "13",
        side: "BUY",
        hash: "fedb364b5cb52a09c2d292fcae6bedb504969079",
        best_bid: "0.39",
        best_ask: "0.41",
      },
      {
        asset_id:
          "17193451929097610487152745255071824166630163383729140946202675461865889892020",
        price: "0.68",
        size: "13",
        side: "SELL",
        hash: "f0a65aee2d2fe0dad54a5a0978995aacaa903d83",
        best_bid: "0.59",
        best_ask: "0.61",
      },
    ],
  },
];

// Your two asset IDs
const ASSET_A =
  "21534842544111982439773280479187620610734941353303223550685659480563753497604";
const ASSET_B =
  "17193451929097610487152745255071824166630163383729140946202675461865889892020";

const MAX_CANDLES = 60;

// Turn a stream of market messages into candles for a given asset+side
function useCandlesFromMessages(
  assetId: string,
  side: Side,
  messages: MarketMessage[],
  intervalMs: number = 1000
): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [msgIndex, setMsgIndex] = useState<number>(0);

  useEffect(() => {
    if (!messages.length) return;

    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);

      const msg = messages[msgIndex];
      if (!msg) return;

      const relevant = msg.price_changes.filter(
        (pc) => pc.asset_id === assetId && pc.side === side
      );

      if (!relevant.length) return;

      setCandles((prev) => {
        let updated = [...prev];
        let lastClose = prev.length ? prev[prev.length - 1].close : undefined;

        relevant.forEach((pc) => {
          const price = parseFloat(pc.price);
          if (Number.isNaN(price)) return;

          const open = lastClose ?? price;
          const close = price;
          const high = Math.max(open, close);
          const low = Math.min(open, close);

          const time = new Date(Number(msg.timestamp) || Date.now());

          const candle: Candle = { time, open, high, low, close };
          updated.push(candle);
          lastClose = close;
        });

        if (updated.length > MAX_CANDLES) {
          updated = updated.slice(updated.length - MAX_CANDLES);
        }
        return updated;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [assetId, side, messages, msgIndex, intervalMs]);

  return candles;
}

const Candles: React.FC = () => {
  const candlesAssetA = useCandlesFromMessages(
    ASSET_A,
    "BUY",
    MOCK_MESSAGES,
    1000
  );
  const candlesAssetB = useCandlesFromMessages(
    ASSET_B,
    "BUY",
    MOCK_MESSAGES,
    1000
  );

  return (
    <div
      style={{
        backgroundColor: "black",
        minHeight: "100vh",
        color: "white",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        justifyContent: "center",
        gap: "20px",
        padding: "20px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Chart 1 - Full Dynamic Width */}
      <div style={{ flex: 1, width: "100%" }}>
        <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
          Asset A (BUY) – {ASSET_A.slice(0, 8)}...
        </h2>
        <CandleChart candles={candlesAssetA} />
      </div>

      {/* Chart 2 - Full Dynamic Width */}
      <div style={{ flex: 1, width: "100%" }}>
        <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
          Asset B (BUY) – {ASSET_B.slice(0, 8)}...
        </h2>
        <CandleChart candles={candlesAssetB} />
      </div>
    </div>
  );
};

interface CandleChartProps {
  candles: Candle[];
}

const CandleChart: React.FC<CandleChartProps> = ({ candles }) => {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const { top, right, bottom, left } = MARGIN;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const candleWidth = 8;
  const spacing = 12;

  const maxVisibleCandles = Math.floor(plotWidth / spacing);
  const visibleCandles: Candle[] =
    candles.length > maxVisibleCandles
      ? candles.slice(candles.length - maxVisibleCandles)
      : candles;

  // Dynamic Y-axis range
  let minPrice = 0;
  let maxPrice = 1;

  if (visibleCandles.length > 0) {
    const allPrices: number[] = [];
    visibleCandles.forEach((c) => {
      allPrices.push(c.low, c.high);
    });

    minPrice = Math.min(...allPrices);
    maxPrice = Math.max(...allPrices);

    if (minPrice === maxPrice) {
      minPrice -= 0.0005;
      maxPrice += 0.0005;
    }

    const range = maxPrice - minPrice;
    minPrice -= range * 0.1;
    maxPrice += range * 0.1;
  }

  const priceToY = (price: number): number => {
    const range = maxPrice - minPrice || 1;
    return top + ((maxPrice - price) / range) * plotHeight;
  };

  const rightAxisX = width - right;

  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: "8px",
        backgroundColor: "#000",
        padding: "10px",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: `${height}px`, display: "block" }}
      >
        {/* Plot background */}
        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="#050505"
        />

        {/* Y-axis grid + labels (right side, 5 ticks) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const t = i / 4;
          const value = minPrice + t * (maxPrice - minPrice);
          const y = priceToY(value);

          return (
            <g key={i}>
              <line
                x1={left}
                y1={y}
                x2={rightAxisX}
                y2={y}
                stroke="#222"
                strokeWidth={1}
              />
              <text
                x={rightAxisX + 10}
                y={y + 4}
                fontSize={10}
                fill="#aaa"
                textAnchor="start"
              >
                {value.toFixed(4)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={rightAxisX}
          y1={top}
          x2={rightAxisX}
          y2={top + plotHeight}
          stroke="#888"
          strokeWidth={1.5}
        />
        <line
          x1={left}
          y1={top + plotHeight}
          x2={rightAxisX}
          y2={top + plotHeight}
          stroke="#888"
          strokeWidth={1.5}
        />

        {/* Candles */}
        {visibleCandles.map((c, index) => {
          const x = left + spacing * index + spacing / 2;
          const yHigh = priceToY(c.high);
          const yLow = priceToY(c.low);
          const yOpen = priceToY(c.open);
          const yClose = priceToY(c.close);

          const color = c.close >= c.open ? "#00ff7f" : "#ff4d4d";
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);

          return (
            <g key={index}>
              <line
                x1={x}
                y1={yHigh}
                x2={x}
                y2={yLow}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
              />
            </g>
          );
        })}

        {/* Time labels (every 5th candle) */}
        {visibleCandles.map((c, index) => {
          if (index % 5 !== 0) return null;

          const x = left + spacing * index + spacing / 2;
          const timeStr = c.time.toLocaleTimeString([], {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <text
              key={`time-${index}`}
              x={x}
              y={top + plotHeight + 15}
              fontSize={9}
              fill="#aaa"
              textAnchor="middle"
            >
              {timeStr}
            </text>
          );
        })}

        {/* Axis labels */}
        <text
          x={left + plotWidth / 2}
          y={height - 5}
          fontSize={11}
          fill="#fff"
          textAnchor="middle"
        >
          Time
        </text>

        <text
          x={rightAxisX + 25}
          y={top + plotHeight / 2}
          fontSize={11}
          fill="#fff"
          textAnchor="middle"
          transform={`rotate(-90 ${rightAxisX + 25} ${top + plotHeight / 2})`}
        >
          Price
        </text>
      </svg>
    </div>
  );
};

export default Candles;
