import { useEffect, useReducer } from "react";

import { initialState, reduce } from "./liveState";
import type { LiveEvent } from "./types";

const MAX_BACKOFF_MS = 10_000;

function liveUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws/live`;
}

/** Live readings from the API; reconnects with backoff if the connection drops. */
export function useLive() {
  const [state, dispatch] = useReducer(reduce, initialState);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let backoff = 1000;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(liveUrl());
      socket.onopen = () => {
        backoff = 1000;
        dispatch({ kind: "connection", connected: true });
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        try {
          dispatch({ kind: "event", event: JSON.parse(message.data) as LiveEvent });
        } catch (error) {
          console.error("Ignored a live message that is not valid JSON", error);
        }
      };
      socket.onclose = () => {
        dispatch({ kind: "connection", connected: false });
        if (!stopped) {
          retry = window.setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return state;
}
