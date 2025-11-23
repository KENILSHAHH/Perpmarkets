/** @format */

// polymarket-ws.js
// Node.js script to connect to Polymarket CLOB websockets (market + user channels).
// Requires: npm i ws

import WebSocket from 'ws';

const BASE_WSS = 'wss://ws-subscriptions-clob.polymarket.com/ws';

// == Keys from your screenshot (you can also set these as env vars) ==
// WARNING: don't paste these into client-side code. Keep on server-side.
const API_KEY = '019aad74-85a6-7187-b05b-7ad453cd972d';
const API_SECRET = 'h1ot9KuamN0Q8oY31E1O9j4dmV18ry33ijRSs5EMKaw=';
const API_PASSPHRASE =
  '2f8a60f7328f51db15f835e6885a1416d79138ac06d86b47380b6ad20fda6a2d';

// Alternative (safer): read from environment if present
const apiKey = process.env.PM_API_KEY || API_KEY;
const apiSecret = process.env.PM_API_SECRET || API_SECRET;
const apiPassphrase = process.env.PM_API_PASSPHRASE || API_PASSPHRASE;

// Example asset IDs (will be populated from API response)
let MARKET_ASSET_IDS = [];
// If filtering user channel by condition ids7pm, add them here:
const USER_MARKETS = []; // empty list in your python example

// Fetch event data from Polymarket Gamma API
async function fetchPolymarketEvent(slug) {
  const url = `https://gamma-api.polymarket.com/events/slug/${slug}`;

  try {
    console.log(`[api] Fetching event data for slug: ${slug}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[api] Event data received');
    return data;
  } catch (error) {
    console.error('[api] Error fetching event data:', error.message);
    throw error;
  }
}

// Extract CLOB token IDs from the event response
function extractClobIds(eventData) {
  const clobIds = [];

  if (!eventData || !eventData.markets || !Array.isArray(eventData.markets)) {
    console.warn('[api] No markets found in event data');
    return clobIds;
  }

  for (const market of eventData.markets) {
    if (market.clobTokenIds) {
      try {
        // clobTokenIds is a JSON string, so we need to parse it
        const tokenIds = JSON.parse(market.clobTokenIds);
        if (Array.isArray(tokenIds)) {
          clobIds.push(...tokenIds);
        }
      } catch (err) {
        console.warn(
          `[api] Failed to parse clobTokenIds for market ${market.id}:`,
          err.message
        );
      }
    }
  }

  // Remove duplicates (in case any market shares token IDs)
  const uniqueClobIds = [...new Set(clobIds)];
  console.log(
    `[api] Extracted ${uniqueClobIds.length} unique CLOB token IDs:`,
    uniqueClobIds
  );
  console.log('[api] CLOB IDs:', uniqueClobIds);
  return uniqueClobIds;
}

// Generic reconnect/backoff helper
function connectWithBackoff(makeWs, maxBackoffMs = 30_000) {
  let attempt = 0;
  let ws;
  function start() {
    attempt++;
    ws = makeWs();
    // return the ws so caller can attach handlers if desired
    return ws;
  }

  let currentWs = start();

  // attach onclose to attempt reconnects with exponential backoff
  currentWs.on('close', (code, reason) => {
    const backoff = Math.min(
      1000 * 2 ** Math.max(0, attempt - 1),
      maxBackoffMs
    );
    console.warn(`ws closed (code=${code}) - reconnecting in ${backoff}ms`);
    setTimeout(() => {
      currentWs = start();
    }, backoff);
  });

  return {
    get current() {
      return currentWs;
    },
  };
}

// Build and run a market websocket (no auth required for market subscription)
function runMarketWs(assetIds) {
  const url = `${BASE_WSS}/market`;
  const makeWs = () => {
    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log('[market] connected, subscribing to asset ids:', assetIds);
      console.log('[market] CLOB IDs:', assetIds);
      // match your Python payload: {"assets_ids": data, "type": "market"}
      ws.send(JSON.stringify({ assets_ids: assetIds, type: 'market' }));

      // start ping loop
      ws._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('PING');
      }, 10_000);
    });

    ws.on('message', (raw) => {
      try {
        const s = raw.toString();
        // Polymarket sometimes returns raw JSON messages; sometimes text like "PONG" etc.
        if (s === 'PONG' || s === 'PING') {
          // ignore
          return;
        }
        const msg = JSON.parse(s);
        // quick print: show message types and top-level keys
        if (msg.type) {
          console.log('[market] msg type:', msg.type);
        } else {
          console.log(
            '[market] raw message:',
            Object.keys(msg).length ? msg : s
          );
        }
        // if snapshot or book, print top-of-book
        if (msg.bids?.length && msg.asks?.length) {
          console.log(
            `[market] top bid: ${msg.bids[0][0]} @ ${msg.bids[0][1]} | top ask: ${msg.asks[0][0]} @ ${msg.asks[0][1]}`
          );
        }
      } catch (err) {
        console.log('[market] received non-json message:', raw.toString());
      }
    });

    ws.on('error', (err) => {
      console.error('[market] ws error:', err?.message || err);
    });

    ws.on('close', () => {
      clearInterval(ws._pingInterval);
      console.warn('[market] closed');
    });

    return ws;
  };

  connectWithBackoff(makeWs);
}

// Build and run a user websocket (authenticated)
function runUserWs(userMarkets) {
  const url = `${BASE_WSS}/user`;
  const auth = { apiKey: apiKey, secret: apiSecret, passphrase: apiPassphrase };

  const makeWs = () => {
    // The server may expect auth in headers or in the initial payload; your Python
    // example sends auth in the subscription JSON. We'll mimic that.
    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log(
        '[user] connected, subscribing with auth to markets:',
        userMarkets
      );
      ws.send(JSON.stringify({ markets: userMarkets, type: 'user', auth }));

      // keepalive ping
      ws._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('PING');
      }, 10_000);
    });

    ws.on('message', (raw) => {
      try {
        const s = raw.toString();
        if (s === 'PONG' || s === 'PING') return;
        const msg = JSON.parse(s);
        console.log('[user] msg:', msg.type || Object.keys(msg));
      } catch (err) {
        console.log('[user] received non-json message:', raw.toString());
      }
    });

    ws.on('error', (err) => {
      console.error('[user] ws error:', err?.message || err);
    });

    ws.on('close', () => {
      clearInterval(ws._pingInterval);
      console.warn('[user] closed');
    });

    return ws;
  };

  connectWithBackoff(makeWs);
}

// Fetch event data from Polymarket API and extract CLOB IDs
const eventSlug = 'bitcoin-up-or-down-november-23-5am-et';

fetchPolymarketEvent(eventSlug)
  .then((data) => {
    console.log('[api] Successfully fetched event data');
    const extractedClobIds = extractClobIds(data);

    // Update MARKET_ASSET_IDS with extracted CLOB IDs
    if (extractedClobIds.length > 0) {
      MARKET_ASSET_IDS = extractedClobIds;
      console.log('[api] Updated MARKET_ASSET_IDS with extracted CLOB IDs');
      console.log('[api] CLOB IDs being used:', MARKET_ASSET_IDS);
      runMarketWs(MARKET_ASSET_IDS);
    } else {
      console.warn('[api] No CLOB IDs found, using default MARKET_ASSET_IDS');
      runMarketWs(MARKET_ASSET_IDS);
    }
  })
  .catch((error) => {
    console.error('[api] Failed to fetch event data:', error);
    console.log('[api] Falling back to default MARKET_ASSET_IDS');
    runMarketWs(MARKET_ASSET_IDS);
  });

// Run user connection (only if you want user-level events)
if (USER_MARKETS.length > 0) {
  runUserWs(USER_MARKETS);
} else {
  console.log(
    '[user] skip user channel (no markets configured). To enable, set USER_MARKETS array.'
  );
}

// print path to your uploaded screenshot (you provided this file)
console.log(
  'screenshot file path (uploaded):',
  'file:///mnt/data/Screenshot 2025-11-22 at 7.42.46 PM.png'
);
