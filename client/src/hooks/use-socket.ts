import { useCallback, useEffect, useRef, useState } from "react";
import { type WsMessage } from "@shared/schema";

export function useSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listeners = useRef<Map<string, (payload: any) => void>>(new Map());
  const lastMessages = useRef<Map<string, any>>(new Map());
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    const connect = () => {
      if (unmounted.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (unmounted.current) { ws.close(); return; }
        setIsConnected(true);
        reconnectDelay.current = 1000;
        setSocket(ws);
      };

      ws.onclose = () => {
        if (unmounted.current) return;
        setIsConnected(false);
        setSocket(null);
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 10000);
        reconnectTimeout.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          lastMessages.current.set(message.type, message.payload);
          const listener = listeners.current.get(message.type);
          if (listener) {
            listener(message.payload);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    };

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      setSocket((ws) => { ws?.close(); return null; });
    };
  }, []);

  const onMessage = useCallback(<T extends WsMessage['type']>(
    type: T,
    callback: (payload: Extract<WsMessage, { type: T }>['payload']) => void
  ) => {
    listeners.current.set(type, callback);
    if (lastMessages.current.has(type)) {
      callback(lastMessages.current.get(type));
    }
  }, []);

  return { socket, isConnected, onMessage };
}
