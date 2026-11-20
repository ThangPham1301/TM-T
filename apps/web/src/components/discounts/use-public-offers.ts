"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Offer } from "@/lib/discounts";
import { api } from "@/lib/store";

type Feed = { offers: Offer[]; asOf: string; nextChangeAt?: string };
const REFRESH_MS = 15_000;

const PublicOffers = createContext<{ offers: Offer[]; clockOffset: number }>({
  offers: [],
  clockOffset: 0,
});

export function PublicOffersProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState({
    offers: [] as Offer[],
    clockOffset: 0,
  });
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let request = 0;

    async function refresh() {
      clearTimeout(timer);
      const sequence = ++request;
      let delay = REFRESH_MS;
      try {
        const feed: Feed = await api("discounts");
        if (!live || sequence !== request) return;
        const serverTime = Date.parse(feed.asOf);
        setSnapshot({
          offers: feed.offers,
          clockOffset: Number.isFinite(serverTime)
            ? serverTime - Date.now()
            : 0,
        });
        if (feed.nextChangeAt) {
          delay = Math.min(
            delay,
            Math.max(
              100,
              Date.parse(feed.nextChangeAt) - Date.parse(feed.asOf),
            ),
          );
        }
      } catch {
        if (live && sequence === request)
          setSnapshot({ offers: [], clockOffset: 0 });
      } finally {
        if (live && sequence === request) timer = setTimeout(refresh, delay);
      }
    }

    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return createElement(PublicOffers.Provider, { value: snapshot }, children);
}

export function usePublicOffers() {
  return usePublicOfferFeed().offers;
}

export function usePublicOfferFeed() {
  return useContext(PublicOffers);
}
