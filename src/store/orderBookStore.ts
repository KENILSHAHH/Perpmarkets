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
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  asks: [],
  bids: [],
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
}));
