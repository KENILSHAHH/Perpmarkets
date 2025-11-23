"use client"

import React, { useEffect, useState, useRef } from "react";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 350;
const MARGIN = { top: 20, right: 50, bottom: 40, left: 20 };
const MAX_CANDLES = 10; // Show recent 10 candles

type Side = "BUY" | "SELL";

// New message structure for last_trade_price events
interface LastTradePriceMessage {
  market: string;
  asset_id: string;
  price: string;
  size: string;
  fee_rate_bps: string;
  side: Side;
  timestamp: string;
  event_type: "last_trade_price";
  transaction_hash: string;
}

export interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // Number of price updates in this candle
}


// Hook to build candles from last_trade_price WebSocket messages for a specific asset (BUY only)
// Creates candles by aggregating prices within 1-second windows
// Fills in missing seconds with constant candles (no volume) if no price updates
function useCandlesFromWebSocket(
  assetId: string,
  messages: LastTradePriceMessage[]
): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]);
  const seenHashesRef = useRef<Set<string>>(new Set());
  const lastProcessedIndexRef = useRef<number>(0);
  const lastKnownPriceRef = useRef<number | null>(null);
  const constantCandleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!assetId) return;

    const seenHashes = seenHashesRef.current;
    const newPrices: Array<{ price: number; time: Date }> = [];

    // Process only new messages
    const messagesToProcess = messages.slice(lastProcessedIndexRef.current);
    
    messagesToProcess.forEach((msg) => {
      // Only process last_trade_price events for this asset with BUY side
      if (msg.event_type !== "last_trade_price") return;
      if (msg.asset_id !== assetId) return;
      if (msg.side !== "BUY") return;

      // Skip if already processed (use transaction_hash as unique identifier)
      if (seenHashes.has(msg.transaction_hash)) return;
      seenHashes.add(msg.transaction_hash);

      const price = parseFloat(msg.price);
      if (Number.isNaN(price)) {
        console.warn("[candle] Invalid price:", msg.price);
        return;
      }

      // Update last known price
      lastKnownPriceRef.current = price;

      const time = msg.timestamp
        ? new Date(Number(msg.timestamp))
        : new Date();

      newPrices.push({ price, time });
    });

    // Update last processed index
    lastProcessedIndexRef.current = messages.length;

    // Group prices by 1-second intervals and create candles
    if (newPrices.length > 0) {
      // Use requestAnimationFrame to batch state updates and avoid linter warning
      requestAnimationFrame(() => {
        setCandles((prev) => {
          const updated = [...prev];
          
          // Group new prices by second
          const pricesBySecond = new Map<number, number[]>();
          
          newPrices.forEach(({ price, time }) => {
            const secondKey = Math.floor(time.getTime() / 1000) * 1000;
            if (!pricesBySecond.has(secondKey)) {
              pricesBySecond.set(secondKey, []);
            }
            pricesBySecond.get(secondKey)!.push(price);
          });

          // Create or update candles for each second
          pricesBySecond.forEach((prices, secondKey) => {
            if (prices.length === 0) return;

            const open = prices[0];
            const close = prices[prices.length - 1];
            const high = Math.max(...prices);
            const low = Math.min(...prices);
            const candleTime = new Date(secondKey);
            const secondTimestamp = Math.floor(secondKey / 1000);

            // Check if candle for this second already exists
            const existingIndex = updated.findIndex(
              (c) => Math.floor(c.time.getTime() / 1000) === secondTimestamp
            );

            if (existingIndex >= 0) {
              // Update existing candle with new price data
              const existing = updated[existingIndex];
              updated[existingIndex] = {
                time: candleTime,
                open: existing.open, // Keep original open
                high: Math.max(existing.high, high),
                low: Math.min(existing.low, low),
                close: close, // Update close to latest price
                volume: existing.volume + prices.length, // Increment volume
              };
            } else {
              // Create new candle
              updated.push({
                time: candleTime,
                open,
                high,
                low,
                close,
                volume: prices.length, // Track volume (number of price updates)
              });
            }
          });

          // Sort by time (oldest first) and keep only the most recent MAX_CANDLES
          updated.sort((a, b) => a.time.getTime() - b.time.getTime());
          
          // Keep only the most recent MAX_CANDLES
          if (updated.length > MAX_CANDLES) {
            return updated.slice(updated.length - MAX_CANDLES);
          }
          
          return updated;
        });
      });
    }
  }, [assetId, messages]);

  // Interval to create constant candles for missing seconds
  useEffect(() => {
    if (!assetId) return;

    // Clear any existing interval
    if (constantCandleIntervalRef.current) {
      clearInterval(constantCandleIntervalRef.current);
    }

    // Check every second for missing candles
    constantCandleIntervalRef.current = setInterval(() => {
      const lastKnownPrice = lastKnownPriceRef.current;
      if (lastKnownPrice === null) return; // No price data yet

      setCandles((prev) => {
        const now = new Date();
        const currentSecond = Math.floor(now.getTime() / 1000) * 1000;
        const currentSecondTimestamp = Math.floor(currentSecond / 1000);

        // Check if we already have a candle for the current second
        const hasCurrentCandle = prev.some(
          (c) => Math.floor(c.time.getTime() / 1000) === currentSecondTimestamp
        );

        if (!hasCurrentCandle) {
          // Create a constant candle with no volume
          const constantCandle: Candle = {
            time: new Date(currentSecond),
            open: lastKnownPrice,
            high: lastKnownPrice,
            low: lastKnownPrice,
            close: lastKnownPrice,
            volume: 0, // No volume for constant candles
          };

          const updated = [...prev, constantCandle];
          updated.sort((a, b) => a.time.getTime() - b.time.getTime());

          // Keep only the most recent MAX_CANDLES
          if (updated.length > MAX_CANDLES) {
            return updated.slice(updated.length - MAX_CANDLES);
          }

          return updated;
        }

        return prev;
      });
    }, 1000); // Check every second

    // Cleanup interval on unmount
    return () => {
      if (constantCandleIntervalRef.current) {
        clearInterval(constantCandleIntervalRef.current);
        constantCandleIntervalRef.current = null;
      }
    };
  }, [assetId]);

  return candles;
}

// Specific asset IDs for the candles
const ASSET_ID_A = "77461907431787347808605793490557139531384332786986644856910660355814284011857";
const ASSET_ID_B = "9771588224761754364169286985460035276690297115120964189775639971442536893741";

// Main hook to connect to WebSocket and build candles
export function usePolymarketCandles() {
  const [assetIds] = useState<string[]>([ASSET_ID_A, ASSET_ID_B]);
  const [isLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<LastTradePriceMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(0);

  // Connect to WebSocket with the specific asset IDs
  useEffect(() => {
    if (assetIds.length === 0) {
      return;
    }

    // Add global error handler to catch extension errors and prevent them from breaking the app
    const handleError = (event: ErrorEvent) => {
      // Ignore Chrome extension errors - they shouldn't break our app
      if (event.message && event.message.includes("chrome-extension://")) {
        console.warn("[candle] Ignoring Chrome extension error:", event.message);
        event.preventDefault(); // Prevent the error from breaking the app
        return false;
      }
    };

    window.addEventListener("error", handleError);

    const BASE_WSS = "wss://ws-subscriptions-clob.polymarket.com/ws";
    const url = `${BASE_WSS}/market`;

    const connect = () => {
      try {
        // Close existing connection if any
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close();
        }

        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log("[candle] WebSocket connected, subscribing to asset ids:", assetIds);
          setIsConnected(true);
          
          try {
            ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));
          } catch (err) {
            console.error("[candle] Error sending subscription:", err);
          }

          // Start ping loop
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
          pingIntervalRef.current = setInterval(() => {
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send("PING");
              }
            } catch (err) {
              console.error("[candle] Error sending ping:", err);
            }
          }, 10000);

          // Start health check to ensure connection is active
          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
          }
          // Initialize last message time on connection
          lastMessageTimeRef.current = Date.now();
          healthCheckIntervalRef.current = setInterval(() => {
            // Skip health check if last message time is not initialized
            if (lastMessageTimeRef.current === 0) {
              return;
            }

            const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
            const connectionStaleThreshold = 30000; // 30 seconds

            // Check if connection is open
            if (ws.readyState !== WebSocket.OPEN) {
              console.warn("[candle] WebSocket not open, reconnecting...");
              setIsConnected(false);
              if (wsRef.current) {
                wsRef.current.close();
              }
              connect();
              return;
            }

            // Check if connection is stale (no messages for too long)
            if (timeSinceLastMessage > connectionStaleThreshold) {
              console.warn("[candle] Connection appears stale, reconnecting...");
              setIsConnected(false);
              if (wsRef.current) {
                wsRef.current.close();
              }
              connect();
            }
          }, 5000); // Check every 5 seconds

          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const s = event.data.toString();
            if (s === "PONG" || s === "PING") {
              // Update last message time even for ping/pong to track connection health
              lastMessageTimeRef.current = Date.now();
              return;
            }

            const msg: LastTradePriceMessage = JSON.parse(s);

            // Update last message time
            lastMessageTimeRef.current = Date.now();

            // Only process last_trade_price events with BUY side
            if (msg.event_type === "last_trade_price" && msg.side === "BUY") {
              setMessages((prev) => {
                try {
                  const updated = [...prev, msg];
                  // Keep only recent messages to avoid memory issues
                  if (updated.length > 100) {
                    return updated.slice(updated.length - 100);
                  }
                  return updated;
                } catch (err) {
                  console.error("[candle] Error updating messages:", err);
                  return prev; // Return previous state on error
                }
              });
            }
          } catch (err) {
            console.error("[candle] Error parsing message:", err);
            // Don't break the connection on parse errors
          }
        };

        ws.onerror = (error) => {
          console.error("[candle] WebSocket error:", error);
          // Don't set isConnected to false immediately - let onclose handle reconnection
          // This prevents the error from breaking the connection flow
        };

        ws.onclose = (event) => {
          console.warn("[candle] WebSocket closed, code:", event.code, "reason:", event.reason);
          setIsConnected(false);
          
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
            healthCheckIntervalRef.current = null;
          }

          // Always try to reconnect (unless it was a normal closure)
          // Code 1000 = normal closure, 1001 = going away
          if (event.code !== 1000 && event.code !== 1001) {
            // Reconnect after 3 seconds
            const reconnectDelay = 3000;
            console.log(`[candle] Reconnecting in ${reconnectDelay}ms...`);
            setTimeout(() => {
              // Only reconnect if we don't have an active connection
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                connect();
              }
            }, reconnectDelay);
          } else {
            // Even for normal closures, try to reconnect after a delay to ensure constant connection
            const reconnectDelay = 5000;
            console.log(`[candle] Normal closure, reconnecting in ${reconnectDelay}ms to maintain connection...`);
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                connect();
              }
            }, reconnectDelay);
          }
        };
      } catch (error) {
        console.error("[candle] Failed to connect:", error);
        setIsConnected(false);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      window.removeEventListener("error", handleError);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [assetIds, isLoading]);

  // Get asset IDs (one for each asset in the market)
  const assetA = assetIds[0] || "";
  const assetB = assetIds[1] || assetIds[0] || "";

  // Build candles for both assets (BUY only)
  const candlesA = useCandlesFromWebSocket(assetA, messages);
  const candlesB = useCandlesFromWebSocket(assetB, messages);

  // Get latest real-time buy prices from last_trade_price WebSocket messages
  const [latestPriceA, setLatestPriceA] = useState<number | null>(null);
  const [latestPriceB, setLatestPriceB] = useState<number | null>(null);
  const lastProcessedPriceIndexRef = useRef<number>(0);

  useEffect(() => {
    if (messages.length === 0 || !assetA || !assetB) return;

    // Process only new messages to track latest BUY prices
    const newMessages = messages.slice(lastProcessedPriceIndexRef.current);
    let latestBuyPriceA: number | null = null;
    let latestBuyPriceB: number | null = null;

    // Go through all new messages and find the most recent BUY price for each asset
    newMessages.forEach((msg) => {
      // Only process last_trade_price events with BUY side
      if (msg.event_type !== "last_trade_price" || msg.side !== "BUY") return;

      const price = parseFloat(msg.price);
      if (Number.isNaN(price)) {
        console.warn(`[candle] Invalid price: ${msg.price}`);
        return;
      }

      // Update latest price for asset A
      if (msg.asset_id === assetA) {
        // Only update if price is reasonable (not a huge jump)
        if (latestBuyPriceA === null || Math.abs(price - latestBuyPriceA) < 0.5) {
          latestBuyPriceA = price;
        } else {
          console.warn(`[candle] Skipping large price jump for Asset A: ${latestBuyPriceA} -> ${price}`);
        }
      }

      // Update latest price for asset B
      if (msg.asset_id === assetB) {
        // Only update if price is reasonable (not a huge jump)
        if (latestBuyPriceB === null || Math.abs(price - latestBuyPriceB) < 0.5) {
          latestBuyPriceB = price;
        } else {
          console.warn(`[candle] Skipping large price jump for Asset B: ${latestBuyPriceB} -> ${price}`);
        }
      }
    });

    // Update last processed index
    lastProcessedPriceIndexRef.current = messages.length;

    // Use requestAnimationFrame to batch state updates
    requestAnimationFrame(() => {
      if (latestBuyPriceA !== null) {
        setLatestPriceA(latestBuyPriceA);
      }
      if (latestBuyPriceB !== null) {
        setLatestPriceB(latestBuyPriceB);
      }
    });
  }, [messages, assetA, assetB]);

  return {
    candlesA,
    candlesB,
    assetA,
    assetB,
    latestPriceA,
    latestPriceB,
    isConnected,
    isLoading,
  };
}

export interface CandleChartProps {
  candles: Candle[];
  latestPrice?: number | null; // Real-time buy price from WebSocket
}

export const CandleChart: React.FC<CandleChartProps> = ({ candles, latestPrice }) => {
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

  // Dynamic Y-axis range - centered around current price, strict 0.01 range
  let minPrice = 0;
  let maxPrice = 1;

  if (visibleCandles.length > 0) {
    // Get the current/latest price (most recent candle's close price)
    const latestCandle = visibleCandles[visibleCandles.length - 1];
    const currentPrice = latestCandle.close;

    // Set range to exactly 0.01 centered around the current price
    const targetRange = 0.01;
    minPrice = currentPrice - targetRange / 2;
    maxPrice = currentPrice + targetRange / 2;

    // Don't expand - keep strict 0.01 range centered on current price
    // This ensures the range moves with the price and stays tight
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
        position: "relative", // For absolute positioning of button
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
          const yOpen = priceToY(c.open);
          const yClose = priceToY(c.close);

          // Color based on close vs open (green if close >= open, red otherwise)
          const isUp = c.close >= c.open;
          const color = isUp ? "#00ff7f" : "#ff4d4d";
          
          // Calculate body height - ensure minimum visible height even when price is constant
          const priceDiff = Math.abs(c.close - c.open);
          
          // Minimum height: proportional to plot height, scaled with volume for constant price candles
          // More volume = slightly taller candle when price is constant
          const baseMinHeight = Math.max(2, plotHeight * 0.01); // 1% of plot height
          const volumeMultiplier = 1 + (Math.log10((c.volume || 1) + 1) * 0.2); // Scale with volume
          const minHeight = baseMinHeight * volumeMultiplier;
          
          // Calculate actual height - use price difference if significant, otherwise use minimum
          const priceBasedHeight = Math.abs(yClose - yOpen);
          const actualHeight = priceDiff > 0.0001 ? priceBasedHeight : minHeight;
          
          // Body represents open to close (traditional candlestick body)
          // When price is constant, show a centered line based on volume
          const bodyTop = priceDiff > 0.0001 
            ? Math.min(yOpen, yClose) 
            : yOpen - actualHeight / 2; // Center the line when price is constant
          const bodyHeight = Math.max(actualHeight, minHeight);

          return (
            <g key={`candle-${c.time.getTime()}-${index}`}>
              {/* Solid candle body - open to close, minimum height for visibility */}
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                stroke={color}
                strokeWidth={0.5}
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
      
      {/* Real-time buy price button in bottom right */}
      {latestPrice !== null && latestPrice !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: "15px",
            right: "15px",
            backgroundColor: "#00ff7f",
            color: "#000",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0, 255, 127, 0.3)",
            zIndex: 10,
            minWidth: "100px",
            textAlign: "center",
          }}
        >
          BUY: {latestPrice.toFixed(4)}
        </div>
      )}
    </div>
  );
};
