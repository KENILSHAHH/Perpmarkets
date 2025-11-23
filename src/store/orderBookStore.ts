// src/store/orderBookStore.ts
import { create } from "zustand";

export type OrderType = "BUY" | "SELL";

export interface OrderEntry {
  type: OrderType;
  price: number;  // in cents
  shares: number;
  total: number; // shares * price
}

interface OrderBookState {
  asks: OrderEntry[];
  bids: OrderEntry[];
  addOrder: (order: OrderEntry) => void;
  // Real-time prices from websocket (in cents)
  upPrice: number | null;
  downPrice: number | null;
  // Asset IDs for UP and DOWN
  upAssetId: string | null;
  downAssetId: string | null;
  setPrices: (upPrice: number | null, downPrice: number | null) => void;
  setAssetIds: (upAssetId: string | null, downAssetId: string | null) => void;
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  asks: [],
  bids: [],
  upPrice: null,
  downPrice: null,
  upAssetId: null,
  downAssetId: null,
  addOrder: (order) =>
    set((state) => {
      if (order.type === "BUY") {
        // BUY → goes into ASKS (user buying from sellers)
        return {
          asks: [{ ...order }, ...state.asks], // newest first
          bids: state.bids,
        };
      }
      if (order.type === "SELL") {
        // SELL → goes into bids
        return {
          asks: state.asks,
          bids: [{ ...order }, ...state.bids],
        };
      }
      return state;
    }),
  setPrices: (upPrice, downPrice) => set({ upPrice, downPrice }),
  setAssetIds: (upAssetId, downAssetId) => set({ upAssetId, downAssetId }),
}));
