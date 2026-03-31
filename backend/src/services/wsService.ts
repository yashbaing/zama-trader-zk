import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { fetchPrices } from "./priceService.js";

interface WsClient {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients: Map<string, WsClient> = new Map();
let priceInterval: NodeJS.Timeout | null = null;

/**
 * WebSocket Service
 *
 * SECURITY: Only broadcasts PUBLIC market data (prices, trade metadata).
 * NEVER broadcasts encrypted user data, balances, or order details.
 *
 * Channels:
 *   - prices: Live price updates every 10 seconds
 *   - trades: New trade events (public metadata only)
 *   - orders: Order status changes (public metadata only)
 */
export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const clientId = Math.random().toString(36).slice(2, 10);
    const client: WsClient = { ws, subscriptions: new Set(["prices"]) };
    clients.set(clientId, client);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        clientId,
        message: "Connected to ZKTrader WebSocket",
        availableChannels: ["prices", "trades", "orders"],
      })
    );

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "subscribe":
            if (msg.channel) {
              client.subscriptions.add(msg.channel);
              ws.send(
                JSON.stringify({
                  type: "subscribed",
                  channel: msg.channel,
                })
              );
            }
            break;

          case "unsubscribe":
            if (msg.channel) {
              client.subscriptions.delete(msg.channel);
              ws.send(
                JSON.stringify({
                  type: "unsubscribed",
                  channel: msg.channel,
                })
              );
            }
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
    });

    ws.on("error", () => {
      clients.delete(clientId);
    });
  });

  // Start price broadcasting
  startPriceBroadcast();

  console.log("WebSocket server initialized at /ws");
}

function startPriceBroadcast() {
  if (priceInterval) return;

  priceInterval = setInterval(async () => {
    try {
      const prices = await fetchPrices();
      broadcast("prices", {
        type: "price_update",
        data: prices,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Price broadcast error:", error);
    }
  }, 10_000); // Every 10 seconds
}

/**
 * Broadcast a message to all clients subscribed to a channel.
 * Used by the event indexer to push trade/order notifications.
 */
export function broadcast(channel: string, message: object) {
  const payload = JSON.stringify(message);

  for (const [, client] of clients) {
    if (
      client.subscriptions.has(channel) &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(payload);
    }
  }
}

/**
 * Broadcast a new trade event (public metadata only).
 * Called by the event indexer when a TradeExecuted event is detected.
 *
 * NOTE: Trade amounts/prices are NOT included — they're encrypted.
 */
export function broadcastTradeEvent(trade: {
  matchId: number;
  buyOrderId: number;
  sellOrderId: number;
  baseToken: string;
  quoteToken: string;
  timestamp: number;
}) {
  broadcast("trades", {
    type: "new_trade",
    data: trade,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast an order status change (public metadata only).
 */
export function broadcastOrderEvent(order: {
  orderId: number;
  trader: string;
  status: string;
}) {
  broadcast("orders", {
    type: "order_update",
    data: order,
    timestamp: Date.now(),
  });
}
