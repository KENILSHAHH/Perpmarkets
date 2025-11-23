import { useState, useEffect, useRef } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { mainnet } from "viem/chains";
import Notification from "./Notification";
import { useOrderBookStore } from "../store/orderBookStore";
import { BalanceDisplay } from "./BalanceDisplay/BalanceDisplay";
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  parseAnyRPCResponse,
  RPCMethod,
  type AuthChallengeResponse,
  type AuthRequestParams,
  createECDSAMessageSigner,
  createGetLedgerBalancesMessage,
  type GetLedgerBalancesResponse,
  type BalanceUpdateResponse,
} from '@erc7824/nitrolite';
import { webSocketService, type WsStatus } from '../lib/websocket';
import {
  generateSessionKey,
  getStoredSessionKey,
  storeSessionKey,
  removeSessionKey,
  storeJWT,
  removeJWT,
  type SessionKey,
} from '../lib/utils';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const BASE_WSS = "wss://ws-subscriptions-clob.polymarket.com/ws";
const EVENT_SLUG = "bitcoin-up-or-down-november-23-6am-et";

// Fetch event data from Polymarket Gamma API
async function fetchPolymarketEvent(slug: string) {
  const url = `/api/polymarket/events/slug/${slug}`;

  try {
    console.log(`[api] Fetching event data for slug: ${slug}`);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[api] Event data received");
    return data;
  } catch (error) {
    console.error("[api] Error fetching event data:", error);
    throw error;
  }
}

// Extract CLOB token IDs from the event response
function extractClobIds(eventData: {
  markets?: Array<{ id?: string; clobTokenIds?: string }>;
}): string[] {
  const clobIds: string[] = [];

  if (!eventData || !eventData.markets || !Array.isArray(eventData.markets)) {
    console.warn("[api] No markets found in event data");
    return clobIds;
  }

  for (const market of eventData.markets) {
    if (market.clobTokenIds) {
      try {
        const tokenIds = JSON.parse(market.clobTokenIds);
        if (Array.isArray(tokenIds)) {
          clobIds.push(...tokenIds);
        }
      } catch (err) {
        console.warn(
          `[api] Failed to parse clobTokenIds for market ${market.id}:`,
          err
        );
      }
    }
  }

  const uniqueClobIds = [...new Set(clobIds)];
  console.log(
    `[api] Extracted ${uniqueClobIds.length} unique CLOB token IDs:`,
    uniqueClobIds
  );
  return uniqueClobIds;
}

const BuyForm = () => {
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const addOrder = useOrderBookStore((state) => state.addOrder);
  const upPrice = useOrderBookStore((state) => state.upPrice);
  const downPrice = useOrderBookStore((state) => state.downPrice);
  const setPrices = useOrderBookStore((state) => state.setPrices);
  const setAssetIds = useOrderBookStore((state) => state.setAssetIds);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [shares, setShares] = useState<number>(100);
  
  // Wallet connection state
  const [account, setAccount] = useState<Address | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  
  // Nitrolite authentication and balance state
  const [wsStatus, setWsStatus] = useState<WsStatus>('Disconnected');
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthAttempted, setIsAuthAttempted] = useState(false);
  const [sessionExpireTimestamp, setSessionExpireTimestamp] = useState<string>('');
  const [balances, setBalances] = useState<Record<string, string> | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // Nitrolite constants
  const AUTH_SCOPE = 'nexus.app';
  const APP_NAME = 'Nexus';
  const SESSION_DURATION = 3600; // 1 hour
  const getAuthDomain = () => ({ name: 'Nexus' });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationDetails, setNotificationDetails] = useState("");

  const multiplyShares = (factor: number) => {
    setShares((prev) => prev * factor);
  };

  const total = ((limitPrice / 100) * shares).toFixed(2);
  const toWin = shares.toString();

  // Wallet connection function
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask not found! Please install MetaMask from https://metamask.io/');
      return;
    }

    try {
      // Check current network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x1') { // Not mainnet
        alert('Please switch to Ethereum Mainnet in MetaMask for this workshop');
        // Note: In production, you might want to automatically switch networks
      }

      const tempClient = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });
      const [address] = await tempClient.requestAddresses();

      if (!address) {
        alert('No wallet address found. Please ensure MetaMask is unlocked.');
        return;
      }

      // Create wallet client with account for EIP-712 signing
      const walletClient = createWalletClient({
        account: address,
        chain: mainnet,
        transport: custom(window.ethereum),
      });

      setWalletClient(walletClient);
      setAccount(address);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Failed to connect wallet. Please try again.');
      return;
    }
  };

  const formatAddress = (address: Address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  // WebSocket connection for real-time prices
  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = (assetIds: string[]) => {
      if (assetIds.length === 0) {
        console.warn("[ws] No asset IDs available for websocket connection");
        return;
      }

      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      const url = `${BASE_WSS}/market`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!isMounted) return;
        console.log("[ws] Connected, subscribing to asset ids:", assetIds);
        ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));

        // Start ping loop
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("PING");
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;

        try {
          const s = event.data.toString();
          // Ignore ping/pong messages
          if (s === "PONG" || s === "PING") {
            return;
          }

          const msg = JSON.parse(s);

          // Only process last_trade_price events
          if (msg.event_type === "last_trade_price" && msg.asset_id && msg.price) {
            const assetId = msg.asset_id;
            const price = parseFloat(msg.price);
            // Convert to cents (multiply by 100)
            const priceInCents = Math.round(price * 100);

            console.log(
              `[ws] last_trade_price: asset_id=${assetId}, price=${priceInCents}¢`
            );

            // Get current state from store
            const currentState = useOrderBookStore.getState();
            const currentUpAssetId = currentState.upAssetId;
            const currentDownAssetId = currentState.downAssetId;
            const currentUpPrice = currentState.upPrice;
            const currentDownPrice = currentState.downPrice;

            // Update price based on asset_id (preserve existing price for the other asset)
            if (assetId === currentUpAssetId) {
              setPrices(priceInCents, currentDownPrice);
            } else if (assetId === currentDownAssetId) {
              setPrices(currentUpPrice, priceInCents);
            }
          }
        } catch (err) {
          console.error("[ws] Error parsing message:", err);
        }
      };

      ws.onerror = (error) => {
        if (!isMounted) return;
        console.error("[ws] WebSocket error:", error);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.warn("[ws] WebSocket closed");

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Reconnect with exponential backoff
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        const attempt = 1;
        const backoff = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30000);
        console.warn(`[ws] Reconnecting in ${backoff}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted && assetIds.length > 0) {
            connectWebSocket(assetIds);
          }
        }, backoff);
      };

      wsRef.current = ws;
    };

    // Fetch asset IDs and connect
    const initializeWebSocket = async () => {
      try {
        const eventData = await fetchPolymarketEvent(EVENT_SLUG);
        const clobIds = extractClobIds(eventData);

        if (clobIds.length >= 2) {
          // First asset ID is UP, second is DOWN
          const upId = clobIds[0];
          const downId = clobIds[1];
          setAssetIds(upId, downId);
          console.log("[ws] Asset IDs set - UP:", upId, "DOWN:", downId);
          connectWebSocket(clobIds);
        } else {
          console.warn("[ws] Need at least 2 asset IDs, got:", clobIds.length);
        }
      } catch (error) {
        console.error("[ws] Failed to initialize websocket:", error);
      }
    };

    initializeWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [setPrices, setAssetIds]);

  // Nitrolite: Initialize session key and connect WebSocket
  useEffect(() => {
    const existingSessionKey = getStoredSessionKey();
    if (existingSessionKey) {
      setSessionKey(existingSessionKey);
    } else {
      const newSessionKey = generateSessionKey();
      storeSessionKey(newSessionKey);
      setSessionKey(newSessionKey);
    }

    webSocketService.addStatusListener(setWsStatus);
    webSocketService.connect();

    return () => {
      webSocketService.removeStatusListener(setWsStatus);
    };
  }, []);

  // Nitrolite: Auto-trigger authentication when conditions are met
  useEffect(() => {
    if (account && sessionKey && wsStatus === 'Connected' && !isAuthenticated && !isAuthAttempted) {
      setIsAuthAttempted(true);
      const expireTimestamp = String(Math.floor(Date.now() / 1000) + SESSION_DURATION);
      setSessionExpireTimestamp(expireTimestamp);

      const authParams: AuthRequestParams = {
        address: account,
        session_key: sessionKey.address,
        app_name: APP_NAME,
        expire: expireTimestamp,
        scope: AUTH_SCOPE,
        application: account,
        allowances: [],
      };

      createAuthRequestMessage(authParams).then((payload) => {
        webSocketService.send(payload);
      });
    }
  }, [account, sessionKey, wsStatus, isAuthenticated, isAuthAttempted]);

  // Nitrolite: Fetch balances when authenticated
  useEffect(() => {
    if (isAuthenticated && sessionKey && account) {
      console.log('Authenticated! Fetching ledger balances...');
      setIsLoadingBalances(true);

      const sessionSigner = createECDSAMessageSigner(sessionKey.privateKey);
      createGetLedgerBalancesMessage(sessionSigner, account)
        .then((getBalancesPayload) => {
          console.log('Sending balance request...');
          webSocketService.send(getBalancesPayload);
        })
        .catch((error) => {
          console.error('Failed to create balance request:', error);
          setIsLoadingBalances(false);
        });
    }
  }, [isAuthenticated, sessionKey, account]);

  // Nitrolite: Handle WebSocket messages for authentication and balances
  useEffect(() => {
    const handleMessage = async (data: any) => {
      const response = parseAnyRPCResponse(JSON.stringify(data));

      // Handle auth challenge
      if (
        response.method === RPCMethod.AuthChallenge &&
        walletClient &&
        sessionKey &&
        account &&
        sessionExpireTimestamp
      ) {
        const challengeResponse = response as AuthChallengeResponse;
        const authParams = {
          scope: AUTH_SCOPE,
          application: walletClient.account?.address as `0x${string}`,
          participant: sessionKey.address as `0x${string}`,
          expire: sessionExpireTimestamp,
          allowances: [],
        };

        const eip712Signer = createEIP712AuthMessageSigner(walletClient, authParams, getAuthDomain());
        try {
          const authVerifyPayload = await createAuthVerifyMessage(eip712Signer, challengeResponse);
          webSocketService.send(authVerifyPayload);
        } catch (error) {
          alert('Signature rejected. Please try again.');
          setIsAuthAttempted(false);
        }
      }

      // Handle auth success
      if (response.method === RPCMethod.AuthVerify && response.params?.success) {
        setIsAuthenticated(true);
        if (response.params.jwtToken) storeJWT(response.params.jwtToken);
      }

      // Handle balance responses
      if (response.method === RPCMethod.GetLedgerBalances) {
        const balanceResponse = response as GetLedgerBalancesResponse;
        const balances = balanceResponse.params.ledgerBalances;
        console.log('Received balance response:', balances);

        if (balances && balances.length > 0) {
          const balancesMap = Object.fromEntries(
            balances.map((balance) => [balance.asset, balance.amount]),
          );
          console.log('Setting balances:', balancesMap);
          setBalances(balancesMap);
        } else {
          console.log('No balance data received - wallet appears empty');
          setBalances({});
        }
        setIsLoadingBalances(false);
      }

      // Handle live balance updates
      if (response.method === RPCMethod.BalanceUpdate) {
        const balanceUpdate = response as BalanceUpdateResponse;
        const balanceUpdates = balanceUpdate.params.balanceUpdates;
        console.log('Live balance update received:', balanceUpdates);

        setBalances((prevBalances) => {
          const updatedBalances = { ...(prevBalances || {}) };
          balanceUpdates.forEach((balance) => {
            updatedBalances[balance.asset] = balance.amount;
          });
          console.log('Updating balances in real-time:', updatedBalances);
          return updatedBalances;
        });
      }

      // Handle errors
      if (response.method === RPCMethod.Error) {
        console.error('RPC Error:', response.params);
        // Other errors (like auth failures)
        removeJWT();
        removeSessionKey();
        alert(`Error: ${response.params.error}`);
        setIsAuthAttempted(false);
      }
    };

    webSocketService.addMessageListener(handleMessage);
    return () => webSocketService.removeMessageListener(handleMessage);
  }, [walletClient, sessionKey, sessionExpireTimestamp, account]);

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
        {/* WALLET CONNECTION */}
        <div className="mb-4 pb-4 border-b border-gray-600">
          {account ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Wallet:</span>
                <div className="text-sm font-medium text-green-400">
                  {formatAddress(account)}
                </div>
              </div>
              {isAuthenticated && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Balance:</span>
                  <BalanceDisplay
                    balance={
                      isLoadingBalances ? 'Loading...' : (balances?.['usdc'] ?? null)
                    }
                    symbol="USDC"
                  />
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="w-full bg-blue-600 py-2 px-4 rounded-lg font-semibold hover:bg-blue-500 transition text-sm"
            >
              Connect Wallet
            </button>
          )}
        </div>

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
            Up {upPrice !== null ? `${upPrice}¢` : `${limitPrice}¢`}
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
            Down {downPrice !== null ? `${downPrice}¢` : `${limitPrice}¢`}
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
