# Perp Markets - Perpetual Trading on Polymarket

A real-time trading interface that enables perpetual trading on top of Polymarket's prediction markets. This project creates a continuous trading experience by tracking Polymarket asset prices in real-time and providing an order book interface for perpetual positions.

## 🎯 Concept: Perpetual Trading on Prediction Markets

### The Problem with Traditional Prediction Markets

Traditional prediction markets like Polymarket have a fundamental limitation: **they expire**. When an event resolves, trading stops. This creates several issues:

- **Limited Trading Windows**: You can only trade while the market is active
- **Liquidity Fragmentation**: Each market has its own isolated liquidity pool
- **No Continuous Exposure**: Traders can't maintain positions beyond market expiration
- **Price Discovery Gaps**: No trading during off-hours or between events

### The Solution: Perpetual Markets

Perpetual trading on Polymarket enables:

1. **Continuous Trading**: Trade positions that track Polymarket prices without expiration
2. **Synthetic Positions**: Create perpetual contracts that mirror underlying Polymarket assets
3. **Real-time Price Discovery**: Continuous price updates from Polymarket's WebSocket feeds
4. **Leverage & Funding**: Potential for leveraged positions with funding rate mechanisms (similar to perpetual futures)

### How It Works

This application:

- **Connects to Polymarket's WebSocket API** to receive real-time price updates for prediction market assets
- **Tracks two complementary assets** (Asset A and Asset B) from the same Polymarket event
- **Displays real-time candlestick charts** showing price movements over time
- **Shows live order book data** with bids, asks, spreads, and last trade prices
- **Aggregates price data** into 1-second candles for visualization

The perpetual mechanism would work by:

1. **Price Indexing**: Continuously tracking the price of underlying Polymarket assets
2. **Position Tracking**: Maintaining synthetic positions that reference these prices
3. **Funding Mechanism**: Implementing a funding rate to keep perpetual prices aligned with spot prices
4. **Settlement**: Using the underlying Polymarket market as the settlement reference

## 🏗️ Architecture

### Technology Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **WebSocket** - Real-time connection to Polymarket's CLOB API
- **Canvas API** - Custom candlestick chart rendering
- **Privy** - Wallet connectivity (optional)

### Key Components

#### 1. **Candle Chart Component** (`src/components/Candle.tsx`)
- Connects to Polymarket WebSocket for `last_trade_price` events
- Aggregates price data into 1-second candles
- Renders candlestick charts using HTML5 Canvas
- Handles real-time price updates and missing data gaps

#### 2. **Order Book Component** (`src/components/PolyOrderBook.tsx`)
- Subscribes to Polymarket market WebSocket for order book updates
- Displays bids, asks, spreads, and last trade prices
- Fetches event data from Polymarket Gamma API
- Extracts CLOB token IDs for WebSocket subscriptions

#### 3. **API Route** (`src/app/api/polymarket/events/route.ts`)
- Proxies requests to Polymarket Gamma API (handles CORS)
- Fetches event data including market information and CLOB token IDs

### Data Flow

```
Polymarket WebSocket
    ↓
[Market Channel] → Order Book Updates (bids/asks)
[Market Channel] → Last Trade Price → Candlestick Charts
    ↓
React Components → Real-time UI Updates
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- (Optional) Privy App ID for wallet connectivity
- (Optional) Polymarket API keys for authenticated endpoints

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd perpmarkets
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```bash
# Optional: Privy for wallet connectivity
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here

# Optional: Polymarket API keys (for authenticated endpoints)
PM_API_KEY=your_polymarket_api_key
PM_API_SECRET=your_polymarket_api_secret
PM_API_PASSPHRASE=your_polymarket_api_passphrase
```

**Note**: The Polymarket API keys are optional. The market WebSocket channel works without authentication. API keys are only needed if you plan to use authenticated endpoints or the user WebSocket channel.

4. **Configure Asset IDs**

Edit `src/components/Candle.tsx` to set your target Polymarket asset IDs:

```typescript
const ASSET_ID_A = "your_asset_id_here";
const ASSET_ID_B = "your_asset_id_here";
```

And update `src/components/PolyOrderBook.tsx` to set your event slug:

```typescript
const EVENT_SLUG = "your-event-slug";
```

5. **Run the development server**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📊 Features

### Real-time Price Tracking
- Live price updates from Polymarket's WebSocket API
- 1-second candlestick aggregation
- Automatic reconnection on connection loss

### Order Book Visualization
- Real-time bid/ask spreads
- Last trade price tracking
- Market depth visualization

### Dual Asset Monitoring
- Track two complementary assets simultaneously
- Side-by-side candlestick charts
- Independent price tracking

### WebSocket Management
- Automatic reconnection with exponential backoff
- Ping/pong keepalive mechanism
- Connection health monitoring

## 🔧 Configuration

### WebSocket Endpoints

The application connects to Polymarket's public WebSocket endpoints:

- **Market Channel**: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - Subscribes to: `{ assets_ids: [...], type: "market" }`
  - Receives: `price_changes`, `last_trade_price` events

### API Endpoints

- **Polymarket Gamma API**: `https://gamma-api.polymarket.com/events/slug/{slug}`
  - Fetches event data including market information and CLOB token IDs

## 🎨 UI Components

### Candlestick Charts
- Custom canvas-based rendering
- Shows open, high, low, close (OHLC) data
- Real-time price updates
- Configurable time windows (currently 10 candles)

### Order Book
- Bid/ask price levels
- Spread calculation
- Last trade price display
- Connection status indicator

## 🔮 Future Enhancements

### Perpetual Trading Implementation
- [ ] Position management system
- [ ] Funding rate mechanism
- [ ] Leverage support
- [ ] Margin requirements
- [ ] Settlement logic

### Trading Features
- [ ] Order placement interface
- [ ] Position tracking
- [ ] PnL calculations
- [ ] Risk management tools

### Advanced Features
- [ ] Multiple market support
- [ ] Historical data analysis
- [ ] Trading strategies
- [ ] Portfolio management

## 📝 Technical Details

### WebSocket Message Types

#### Market Channel Messages

**Price Change Event:**
```json
{
  "market": "market_id",
  "price_changes": [
    {
      "asset_id": "token_id",
      "price": "0.65",
      "size": "100",
      "side": "BUY",
      "hash": "tx_hash",
      "best_bid": "0.64",
      "best_ask": "0.66"
    }
  ],
  "timestamp": "1234567890",
  "event_type": "price_change"
}
```

**Last Trade Price Event:**
```json
{
  "market": "market_id",
  "asset_id": "token_id",
  "price": "0.65",
  "size": "100",
  "fee_rate_bps": "50",
  "side": "BUY",
  "timestamp": "1234567890",
  "event_type": "last_trade_price",
  "transaction_hash": "tx_hash"
}
```

### Candle Aggregation

Candles are created by:
1. Grouping `last_trade_price` events into 1-second windows
2. Calculating OHLC from prices within each window
3. Filling missing seconds with constant candles (no volume) if no trades occurred

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[Add your license here]

## 🔗 Resources

- [Polymarket Documentation](https://docs.polymarket.com/)
- [Polymarket API Reference](https://gamma-api.polymarket.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Privy Documentation](https://docs.privy.io/)

## ⚠️ Disclaimer

This is an experimental project for educational purposes. Perpetual trading involves significant risk. Always do your own research and never invest more than you can afford to lose.
