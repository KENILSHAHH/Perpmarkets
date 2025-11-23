"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronUp, HelpCircle, Rows3 } from "lucide-react"

interface OrderBookRow {
  price: string
  shares: string
  total: string
  priceKey?: string // For React key stability
}

interface PriceChange {
  asset_id: string
  price: string
  size: string
  side: "BUY" | "SELL"
  hash: string
  best_bid: string
  best_ask: string
}

interface MarketMessage {
  market?: string
  price_changes?: PriceChange[]
  timestamp?: string
  event_type?: string
  type?: string
  bids?: [string, string][] // [price, size] format from test.js
  asks?: [string, string][] // [price, size] format from test.js
  asset_id?: string
}

const EVENT_SLUG = "bitcoin-up-or-down-november-23-6am-et"

// Fetch event data from Polymarket Gamma API via Vite proxy (to avoid CORS)
async function fetchPolymarketEvent(slug: string) {
  const url = `/api/polymarket/events/slug/${slug}`

  try {
    console.log(`[api] Fetching event data for slug: ${slug}`)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log("[api] Event data received")
    return data
  } catch (error) {
    console.error("[api] Error fetching event data:", error)
    throw error
  }
}

// Extract CLOB token IDs from the event response
function extractClobIds(eventData: {
  markets?: Array<{ id?: string; clobTokenIds?: string }>
}): string[] {
  const clobIds: string[] = []

  if (!eventData || !eventData.markets || !Array.isArray(eventData.markets)) {
    console.warn("[api] No markets found in event data")
    return clobIds
  }

  for (const market of eventData.markets) {
    if (market.clobTokenIds) {
      try {
        // clobTokenIds is a JSON string, so we need to parse it
        const tokenIds = JSON.parse(market.clobTokenIds)
        if (Array.isArray(tokenIds)) {
          clobIds.push(...tokenIds)
        }
      } catch (err) {
        console.warn(
          `[api] Failed to parse clobTokenIds for market ${market.id}:`,
          err,
        )
      }
    }
  }

  // Remove duplicates (in case any market shares token IDs)
  const uniqueClobIds = [...new Set(clobIds)]
  console.log(
    `[api] Extracted ${uniqueClobIds.length} unique CLOB token IDs:`,
    uniqueClobIds,
  )
  return uniqueClobIds
}

export function OrderBook() {
  const [bids, setBids] = useState<OrderBookRow[]>([])
  const [asks, setAsks] = useState<OrderBookRow[]>([])
  const [lastPrice, setLastPrice] = useState<string>("")
  const [spread, setSpread] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track orders by asset ID (will be initialized with fetched asset IDs)
  const orderBookRef = useRef<{
    [assetId: string]: {
      bids: Map<string, { size: number; total: number }>
      asks: Map<string, { size: number; total: number }>
      bestBid?: number
      bestAsk?: number
    }
  }>({})

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Format price as cents
  const formatPrice = (price: number): string => {
    return `${(price * 100).toFixed(0)}¢`
  }

  // Update displayed orders for Trade Up only (with debouncing to prevent flickering)
  const updateDisplayedOrders = useCallback(() => {
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Debounce updates to batch rapid changes and prevent flickering
    updateTimeoutRef.current = setTimeout(() => {
      // Use the first asset ID as Trade Up (lower price)
      if (assetIds.length === 0) return
      
      const currentAssetId = assetIds[0] // First asset is typically Trade Up
      
      // Get the order book for Trade Up asset only
      if (!orderBookRef.current[currentAssetId]) {
        orderBookRef.current[currentAssetId] = { bids: new Map(), asks: new Map() }
      }
      const assetBook = orderBookRef.current[currentAssetId]

      // Convert bids map to sorted array (highest price first) - show top 5 bids
      const sortedBids = Array.from(assetBook.bids.entries())
        .map(([price, data]) => ({
          price: formatPrice(parseFloat(price)),
          shares: formatNumber(data.size),
          total: `$${formatNumber(data.total)}`,
          priceNum: parseFloat(price),
          priceKey: price, // Use price as key for React reconciliation
        }))
        .sort((a, b) => b.priceNum - a.priceNum)
        .slice(0, 5) // Limit to top 5
        .map(({ price, shares, total, priceKey }) => ({ price, shares, total, priceKey }))

      // Convert asks map to sorted array (lowest price first) - show top 5 asks
      const sortedAsks = Array.from(assetBook.asks.entries())
        .map(([price, data]) => ({
          price: formatPrice(parseFloat(price)),
          shares: formatNumber(data.size),
          total: `$${formatNumber(data.total)}`,
          priceNum: parseFloat(price),
          priceKey: price, // Use price as key for React reconciliation
        }))
        .sort((a, b) => a.priceNum - b.priceNum)
        .slice(0, 5) // Limit to top 5
        .map(({ price, shares, total, priceKey }) => ({ price, shares, total, priceKey }))

      setBids(sortedBids)
      setAsks(sortedAsks)

      // Update last price and spread from the current asset's best bid/ask
      if (assetBook.bestBid !== undefined && assetBook.bestAsk !== undefined) {
        setLastPrice(formatPrice((assetBook.bestBid + assetBook.bestAsk) / 2))
        setSpread(formatPrice(assetBook.bestAsk - assetBook.bestBid))
      } else if (sortedBids.length > 0 && sortedAsks.length > 0) {
        // Fallback: use the top of book if best bid/ask not available
        const latestBid = parseFloat(sortedBids[0].price.replace('¢', '')) / 100
        const latestAsk = parseFloat(sortedAsks[0].price.replace('¢', '')) / 100
        setLastPrice(formatPrice((latestBid + latestAsk) / 2))
        setSpread(formatPrice(latestAsk - latestBid))
      }
    }, 50) // 50ms debounce for smooth updates
  }, [assetIds])

  // Update order book from direct bids/asks arrays (snapshot or book update)
  const updateOrderBookFromBidsAsks = useCallback((bids: [string, string][], asks: [string, string][], assetId?: string) => {
    if (assetIds.length === 0) return
    
    // Use the provided asset_id or default to first asset
    const targetAssetId = assetId || assetIds[0]
    
    // Initialize order book if needed
    if (!orderBookRef.current[targetAssetId]) {
      orderBookRef.current[targetAssetId] = { bids: new Map(), asks: new Map() }
    }
    const assetBook = orderBookRef.current[targetAssetId]
    
    // Clear existing orders and update with new snapshot
    assetBook.bids.clear()
    assetBook.asks.clear()
    
    // Process bids (higher price first)
    bids.forEach(([price, size]) => {
      const priceNum = parseFloat(price)
      const sizeNum = parseFloat(size)
      if (sizeNum > 0) {
        assetBook.bids.set(price, {
          size: sizeNum,
          total: sizeNum * priceNum,
        })
      }
    })
    
    // Process asks (lower price first)
    asks.forEach(([price, size]) => {
      const priceNum = parseFloat(price)
      const sizeNum = parseFloat(size)
      if (sizeNum > 0) {
        assetBook.asks.set(price, {
          size: sizeNum,
          total: sizeNum * priceNum,
        })
      }
    })
    
    // Update best bid/ask from top of book
    if (bids.length > 0) {
      assetBook.bestBid = parseFloat(bids[0][0])
    }
    if (asks.length > 0) {
      assetBook.bestAsk = parseFloat(asks[0][0])
    }
    
    // Update displayed orders (debounced internally)
    updateDisplayedOrders()
  }, [assetIds, updateDisplayedOrders])

  // Update order book from price changes
  const updateOrderBook = useCallback((priceChanges: PriceChange[]) => {
    if (assetIds.length === 0) return
    
    let shouldUpdate = false
    
    // Use the first asset ID as Trade Up (lower price)
    const tradeUpAssetId = assetIds[0]
    
    // Initialize Trade Up order book if needed
    if (!orderBookRef.current[tradeUpAssetId]) {
      orderBookRef.current[tradeUpAssetId] = { bids: new Map(), asks: new Map() }
    }
    const tradeUpBook = orderBookRef.current[tradeUpAssetId]
    
    // Process price changes - look for complementary prices (BUY + SELL ≈ 1.0)
    // In a binary market, if prices are complementary, they represent Trade Up bids and asks
    for (let i = 0; i < priceChanges.length; i++) {
      const change1 = priceChanges[i]
      const price1 = parseFloat(change1.price)
      const size1 = parseFloat(change1.size)
      
      // Look for a complementary price change in the same message
      for (let j = i + 1; j < priceChanges.length; j++) {
        const change2 = priceChanges[j]
        const price2 = parseFloat(change2.price)
        
        // Check if prices are complementary (they should add up to ~1.0)
        const sum = price1 + price2
        const isComplementary = Math.abs(sum - 1.0) < 0.1 // Allow 0.1 tolerance
        
        if (isComplementary) {
          // The lower price is Trade Up
          const tradeUpPrice = Math.min(price1, price2)
          
          // Determine which change corresponds to Trade Up
          const tradeUpChange = price1 < price2 ? change1 : change2
          const tradeDownChange = price1 < price2 ? change2 : change1
          
          const tradeUpPriceKey = tradeUpPrice.toFixed(4)
          
          // Process Trade Up orders
          if (tradeUpChange.side === "BUY") {
            if (size1 === 0) {
              if (tradeUpBook.bids.has(tradeUpPriceKey)) {
                tradeUpBook.bids.delete(tradeUpPriceKey)
                shouldUpdate = true
              }
            } else {
              const existing = tradeUpBook.bids.get(tradeUpPriceKey) || { size: 0, total: 0 }
              tradeUpBook.bids.set(tradeUpPriceKey, {
                size: existing.size + parseFloat(tradeUpChange.size),
                total: existing.total + parseFloat(tradeUpChange.size) * tradeUpPrice,
              })
              shouldUpdate = true
            }
          } else if (tradeUpChange.side === "SELL") {
            if (size1 === 0) {
              if (tradeUpBook.asks.has(tradeUpPriceKey)) {
                tradeUpBook.asks.delete(tradeUpPriceKey)
                shouldUpdate = true
              }
            } else {
              const existing = tradeUpBook.asks.get(tradeUpPriceKey) || { size: 0, total: 0 }
              tradeUpBook.asks.set(tradeUpPriceKey, {
                size: existing.size + parseFloat(tradeUpChange.size),
                total: existing.total + parseFloat(tradeUpChange.size) * tradeUpPrice,
              })
              shouldUpdate = true
            }
          }
          
          // Also process the complementary order (Trade Down's SELL becomes Trade Up's BUY, etc.)
          // If Trade Down has a BUY, that means someone is selling Trade Up (so it's an ask)
          // If Trade Down has a SELL, that means someone is buying Trade Up (so it's a bid)
          if (tradeDownChange.side === "BUY") {
            // Trade Down BUY = Trade Up SELL (ask)
            if (parseFloat(tradeDownChange.size) === 0) {
              if (tradeUpBook.asks.has(tradeUpPriceKey)) {
                tradeUpBook.asks.delete(tradeUpPriceKey)
                shouldUpdate = true
              }
            } else {
              const existing = tradeUpBook.asks.get(tradeUpPriceKey) || { size: 0, total: 0 }
              tradeUpBook.asks.set(tradeUpPriceKey, {
                size: existing.size + parseFloat(tradeDownChange.size),
                total: existing.total + parseFloat(tradeDownChange.size) * tradeUpPrice,
              })
              shouldUpdate = true
            }
          } else if (tradeDownChange.side === "SELL") {
            // Trade Down SELL = Trade Up BUY (bid)
            if (parseFloat(tradeDownChange.size) === 0) {
              if (tradeUpBook.bids.has(tradeUpPriceKey)) {
                tradeUpBook.bids.delete(tradeUpPriceKey)
                shouldUpdate = true
              }
            } else {
              const existing = tradeUpBook.bids.get(tradeUpPriceKey) || { size: 0, total: 0 }
              tradeUpBook.bids.set(tradeUpPriceKey, {
                size: existing.size + parseFloat(tradeDownChange.size),
                total: existing.total + parseFloat(tradeDownChange.size) * tradeUpPrice,
              })
              shouldUpdate = true
            }
          }
          
          // Store best bid and ask from Trade Up change
          if (tradeUpChange.best_bid && tradeUpChange.best_ask) {
            const newBestBid = parseFloat(tradeUpChange.best_bid)
            const newBestAsk = parseFloat(tradeUpChange.best_ask)
            if (tradeUpBook.bestBid !== newBestBid || tradeUpBook.bestAsk !== newBestAsk) {
              tradeUpBook.bestBid = newBestBid
              tradeUpBook.bestAsk = newBestAsk
              shouldUpdate = true
            }
          }
          
          // Break after finding complementary pair
          break
        }
      }
    }

    // Update displayed orders if Trade Up changed (debounced internally)
    if (shouldUpdate) {
      updateDisplayedOrders()
    }
  }, [updateDisplayedOrders, assetIds])

  // Fetch CLOB IDs from event slug
  useEffect(() => {
    const fetchAssetIds = async () => {
      try {
        setIsLoading(true)
        const eventData = await fetchPolymarketEvent(EVENT_SLUG)
        const clobIds = extractClobIds(eventData)
        
        if (clobIds.length > 0) {
          setAssetIds(clobIds)
          // Initialize order book for each asset
          clobIds.forEach((assetId) => {
            if (!orderBookRef.current[assetId]) {
              orderBookRef.current[assetId] = { bids: new Map(), asks: new Map() }
            }
          })
          console.log("[api] Successfully fetched and initialized asset IDs:", clobIds)
        } else {
          console.warn("[api] No CLOB IDs found")
        }
      } catch (error) {
        console.error("[api] Failed to fetch asset IDs:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssetIds()
  }, [])

  // Connect to WebSocket when asset IDs are available
  useEffect(() => {
    if (assetIds.length === 0 || isLoading) {
      return
    }

    const BASE_WSS = "wss://ws-subscriptions-clob.polymarket.com/ws"
    const url = `${BASE_WSS}/market`

    const connect = () => {
      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          console.log("[market] connected, subscribing to asset ids:", assetIds)
          setIsConnected(true)
          ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }))

          // Start ping loop
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send("PING")
            }
          }, 10000)

          wsRef.current = ws
        }

        ws.onmessage = (event) => {
          try {
            const s = event.data.toString()
            if (s === "PONG" || s === "PING") {
              return
            }

            const msg: MarketMessage = JSON.parse(s)
            
            // Log message type for debugging (matching test.js behavior)
            if (msg.type) {
              console.log("[market] msg type:", msg.type)
            }

            // Handle direct bids/asks arrays (snapshot or book update) - from test.js logic
            if (msg.bids?.length && msg.asks?.length) {
              console.log(
                `[market] top bid: ${msg.bids[0][0]} @ ${msg.bids[0][1]} | top ask: ${msg.asks[0][0]} @ ${msg.asks[0][1]}`
              )
              // Log all bids and asks like test.js terminal output
              console.log(`[market] All bids (${msg.bids.length}):`, msg.bids)
              console.log(`[market] All asks (${msg.asks.length}):`, msg.asks)
              updateOrderBookFromBidsAsks(msg.bids, msg.asks, msg.asset_id)
            }
            // Handle price_changes (existing logic)
            else if (msg.price_changes && Array.isArray(msg.price_changes)) {
              updateOrderBook(msg.price_changes)
            }
            // Log other message types for debugging
            else {
              console.log(
                "[market] raw message:",
                Object.keys(msg).length ? msg : s
              )
            }
          } catch (err) {
            console.error("[market] Error parsing message:", err)
            console.log("[market] received non-json message:", event.data.toString())
          }
        }

        ws.onerror = (error) => {
          console.error("[market] WebSocket error:", error)
          setIsConnected(false)
        }

        ws.onclose = () => {
          console.warn("[market] WebSocket closed, reconnecting...")
          setIsConnected(false)
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }

          // Reconnect after 3 seconds
          setTimeout(() => {
            connect()
          }, 3000)
        }
      } catch (error) {
        console.error("[market] Failed to connect:", error)
        setIsConnected(false)
      }
    }

    connect()

    // Cleanup on unmount
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [updateOrderBook, updateOrderBookFromBidsAsks, assetIds, isLoading])


  // Calculate max shares for depth visualization
  const maxShares = Math.max(
    ...bids.map((b) => Number.parseFloat(b.shares.replace(/,/g, ""))),
    ...asks.map((a) => Number.parseFloat(a.shares.replace(/,/g, ""))),
    1, // Prevent division by zero
  )

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold text-gray-100">Polymarket Bids Order Book</h2>
          <HelpCircle className="w-3 h-3 text-gray-500" />
        </div>
        <div className="flex items-center gap-1">

          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} title={isConnected ? "Connected" : "Disconnected"} />
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
          const shareValue = Number.parseFloat(ask.shares.replace(/,/g, ""))
          const widthPercent = (shareValue / maxShares) * 100

          return (
            <div key={ask.priceKey || ask.price} className="relative transition-all duration-200 ease-in-out">
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
                  <div className="text-center text-red-400 font-medium text-xs transition-colors duration-200">{ask.price}</div>
                  <div className="text-center text-gray-200 text-xs transition-colors duration-200">{ask.shares}</div>
                  <div className="text-right text-gray-200 text-xs transition-colors duration-200">{ask.total}</div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-500 text-xs">
            {isConnected ? "Waiting for data..." : "Connecting..."}
            </div>
        )}
      </div>

      {/* Spread Info */}
      <div className="grid grid-cols-2 px-3 py-1.5 bg-gray-800 text-xs text-gray-300">
        <div className="transition-colors duration-200">Last: {lastPrice || "—"}</div>
        <div className="text-center transition-colors duration-200">Spread: {spread || "—"}</div>
      </div>

      {/* Bids Section */}
      <div className="relative max-h-64 overflow-y-auto">
        {bids.length > 0 ? (
          bids.map((bid, index) => {
          const shareValue = Number.parseFloat(bid.shares.replace(/,/g, ""))
          const widthPercent = (shareValue / maxShares) * 100

          return (
            <div key={bid.priceKey || bid.price} className="relative transition-all duration-200 ease-in-out">
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
                  <div className="text-center text-green-400 font-medium text-xs transition-colors duration-200">{bid.price}</div>
                  <div className="text-center text-gray-200 text-xs transition-colors duration-200">{bid.shares}</div>
                  <div className="text-right text-gray-200 text-xs transition-colors duration-200">{bid.total}</div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-500 text-xs">
            {isConnected ? "Waiting for data..." : "Connecting..."}
            </div>
        )}
      </div>
    </div>
  )
}
