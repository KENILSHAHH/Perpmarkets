"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronUp, HelpCircle, Rows3 } from "lucide-react"

interface OrderBookRow {
  price: string
  shares: string
  total: string
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
  market: string
  price_changes: PriceChange[]
  timestamp: string
  event_type: string
}

const EVENT_SLUG = "bitcoin-up-or-down-november-23-1am-et"

// Fetch event data from Polymarket Gamma API via Next.js API route (to avoid CORS)
async function fetchPolymarketEvent(slug: string) {
  const url = `/api/polymarket/events?slug=${encodeURIComponent(slug)}`

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

  // Update displayed orders for Trade Up only
  const updateDisplayedOrders = useCallback(() => {
    // Use the first asset ID as Trade Up (lower price)
    if (assetIds.length === 0) return
    
    const currentAssetId = assetIds[0] // First asset is typically Trade Up
    
    // Get the order book for Trade Up asset only
    if (!orderBookRef.current[currentAssetId]) {
      orderBookRef.current[currentAssetId] = { bids: new Map(), asks: new Map() }
    }
    const assetBook = orderBookRef.current[currentAssetId]

    // Convert bids map to sorted array (highest price first)
    const sortedBids = Array.from(assetBook.bids.entries())
      .map(([price, data]) => ({
        price: formatPrice(parseFloat(price)),
        shares: formatNumber(data.size),
        total: `$${formatNumber(data.total)}`,
        priceNum: parseFloat(price),
      }))
      .sort((a, b) => b.priceNum - a.priceNum)
      .slice(0, 5) // Limit to top 5
      .map(({ price, shares, total }) => ({ price, shares, total }))

    // Convert asks map to sorted array (lowest price first)
    const sortedAsks = Array.from(assetBook.asks.entries())
      .map(([price, data]) => ({
        price: formatPrice(parseFloat(price)),
        shares: formatNumber(data.size),
        total: `$${formatNumber(data.total)}`,
        priceNum: parseFloat(price),
      }))
      .sort((a, b) => a.priceNum - b.priceNum)
      .slice(0, 5) // Limit to top 5
      .map(({ price, shares, total }) => ({ price, shares, total }))

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
  }, [assetIds])

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

    // Update displayed orders if Trade Up changed
    if (shouldUpdate) {
      // Use requestAnimationFrame to batch updates and reduce flickering
      requestAnimationFrame(() => {
        updateDisplayedOrders()
      })
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

            if (msg.price_changes && Array.isArray(msg.price_changes)) {
              updateOrderBook(msg.price_changes)
            }
          } catch (err) {
            console.error("[market] Error parsing message:", err)
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
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [updateOrderBook, assetIds, isLoading])


  // Calculate max shares for depth visualization
  const maxShares = Math.max(
    ...bids.map((b) => Number.parseFloat(b.shares.replace(/,/g, ""))),
    ...asks.map((a) => Number.parseFloat(a.shares.replace(/,/g, ""))),
    1, // Prevent division by zero
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold text-gray-900">Order Book</h2>
          <HelpCircle className="w-3 h-3 text-gray-400" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600">$26.5k</span>
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} title={isConnected ? "Connected" : "Disconnected"} />
          <button className="h-6 w-6 flex items-center justify-center hover:bg-gray-100 rounded">
            <ChevronUp className="w-3 h-3 text-gray-600" />
          </button>
        </div>
      </div>


      {/* Column Headers */}
      <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
        <div className="flex items-center gap-0.5">
          <span>Trade Up</span>
          <Rows3 className="w-2 h-2" />
        </div>
        <div className="text-center">Price</div>
        <div className="text-center">Shares</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks Section */}
      <div className="relative">
        {asks.length > 0 ? (
          asks.map((ask, index) => {
          const shareValue = Number.parseFloat(ask.shares.replace(/,/g, ""))
          const widthPercent = (shareValue / maxShares) * 100

          return (
            <div key={index} className="relative">
              {/* Background depth bar */}
              <div className="absolute inset-y-0 left-0 bg-red-100" style={{ width: `${widthPercent}%` }} />
              {/* Content */}
                <div className="relative grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5">
                <div>
                    {index === 0 && (
                      <span className="inline-block px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-medium rounded">
                        Asks
                      </span>
                    )}
                  </div>
                  <div className="text-center text-red-600 font-medium text-xs">{ask.price}</div>
                  <div className="text-center text-gray-900 text-xs">{ask.shares}</div>
                  <div className="text-right text-gray-900 text-xs">{ask.total}</div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-400 text-xs">
            {isConnected ? "Waiting for data..." : "Connecting..."}
            </div>
        )}
      </div>

      {/* Spread Info */}
      <div className="grid grid-cols-2 px-3 py-1.5 bg-gray-50 text-xs text-gray-600">
        <div>Last: {lastPrice || "—"}</div>
        <div className="text-center">Spread: {spread || "—"}</div>
      </div>

      {/* Bids Section */}
      <div className="relative">
        {bids.length > 0 ? (
          bids.map((bid, index) => {
          const shareValue = Number.parseFloat(bid.shares.replace(/,/g, ""))
          const widthPercent = (shareValue / maxShares) * 100

          return (
            <div key={index} className="relative">
              {/* Background depth bar */}
              <div className="absolute inset-y-0 left-0 bg-green-100" style={{ width: `${widthPercent}%` }} />
              {/* Content */}
                <div className="relative grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 border-t border-gray-100">
                <div>
                  {index === 0 && (
                      <span className="inline-block px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-medium rounded">
                      Bids
                    </span>
                  )}
                  </div>
                  <div className="text-center text-green-600 font-medium text-xs">{bid.price}</div>
                  <div className="text-center text-gray-900 text-xs">{bid.shares}</div>
                  <div className="text-right text-gray-900 text-xs">{bid.total}</div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-3 py-4 text-center text-gray-400 text-xs">
            {isConnected ? "Waiting for data..." : "Connecting..."}
            </div>
        )}
      </div>
    </div>
  )
}
