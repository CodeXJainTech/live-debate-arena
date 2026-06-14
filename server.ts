import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socket/index";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  const pubClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const subClient = pubClient.duplicate();

  // Handle Redis connection errors
  pubClient.on("error", (err) => console.error("[Redis Pub] Connection error:", err));
  subClient.on("error", (err) => console.error("[Redis Sub] Connection error:", err));

  try {
    await Promise.all([
      new Promise((res, rej) => pubClient.once("ready", res).once("error", rej)),
      new Promise((res, rej) => subClient.once("ready", res).once("error", rej)),
    ]);
  } catch (err) {
    console.error("[Redis] Failed to connect. Make sure Redis is running at:", process.env.REDIS_URL || "redis://localhost:6379");
    process.exit(1);
  }

  io.adapter(createAdapter(pubClient, subClient));

  registerSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});