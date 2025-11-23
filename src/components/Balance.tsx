"use client";

import { useState, useEffect } from "react";
import { webSocketService, type WsStatus } from "@/lib/websocket";

interface BalanceData {
  balance?: string | number;
  available?: string | number;
  usdc?: string | number;
  [key: string]: any;
}

// Similar to nitrolite BalanceDisplay component pattern
export default function Balance() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>("Disconnected");

  useEffect(() => {
    // Similar to nitrolite: connect to WebSocket and listen for balance updates
    const BASE_WSS = "wss://ws-subscriptions-clob.polymarket.com/ws";
    const url = `${BASE_WSS}/user`;

    // Add status listener
    webSocketService.addStatusListener(setWsStatus);
    
    // Connect to WebSocket
    webSocketService.connect(url);

    // Handle incoming messages (similar to nitrolite message handler)
    const handleMessage = (data: any) => {
      try {
        // Skip ping/pong messages
        if (data === "PONG" || data === "PING") {
          return;
        }

        console.log("[balance] Received message:", data);

        // Handle balance updates from Polymarket user channel
        // Similar to nitrolite: extract balance from response
        if (data.balance !== undefined) {
          setBalance({ balance: data.balance, ...data });
          setIsLoading(false);
        } else if (data.available !== undefined) {
          setBalance({ balance: data.available, ...data });
          setIsLoading(false);
        } else if (data.usdc_balance !== undefined) {
          setBalance({ balance: data.usdc_balance, usdc: data.usdc_balance, ...data });
          setIsLoading(false);
        } else if (data.balances && Array.isArray(data.balances)) {
          // Handle array of balances (similar to nitrolite ledgerBalances)
          const usdcBalance = data.balances.find((b: any) => 
            b.asset?.toLowerCase() === "usdc" || b.symbol?.toLowerCase() === "usdc"
          );
          if (usdcBalance) {
            setBalance({ balance: usdcBalance.amount, usdc: usdcBalance.amount, ...data });
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error("[balance] Error handling message:", err);
      }
    };

    webSocketService.addMessageListener(handleMessage);

    // When connected, send authentication and subscription
    const handleStatusChange = (status: WsStatus) => {
      if (status === "Connected") {
        // Fetch auth from API route (secure)
        fetch("/api/polymarket/balance/auth")
          .then((res) => res.json())
          .then((authData) => {
            if (authData.auth) {
              // Subscribe to user channel (empty markets array to get all user data)
              webSocketService.send(
                JSON.stringify({ markets: [], type: "user", auth: authData.auth })
              );
            }
          })
          .catch((err) => {
            console.error("[balance] Failed to get auth:", err);
            setIsLoading(false);
          });
      }
    };

    webSocketService.addStatusListener(handleStatusChange);

    // Cleanup
    return () => {
      webSocketService.removeStatusListener(setWsStatus);
      webSocketService.removeStatusListener(handleStatusChange);
      webSocketService.removeMessageListener(handleMessage);
    };
  }, []);

  // Format balance for display (similar to nitrolite BalanceDisplay)
  const formattedBalance = balance?.balance 
    ? (typeof balance.balance === "number" 
        ? balance.balance.toFixed(2) 
        : parseFloat(balance.balance as string).toFixed(2))
    : "0.00";

  if (isLoading) {
    return (
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <span className="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-black dark:text-white">
          {formattedBalance}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">USDC</span>
        {wsStatus !== "Connected" && (
          <span className="text-xs text-red-400">(Disconnected)</span>
        )}
      </div>
    </div>
  );
}

