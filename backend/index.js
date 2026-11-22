import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "pocketmals";
const allowedOrigins = (process.env.CLIENT_ORIGIN || "https://chiiweb.github.io,http://localhost:8080,http://127.0.0.1:8080")
  .split(",").map((value) => value.trim()).filter(Boolean);

function escapeRegex(value) {
  return Array.from(value, (character) =>
    ".^$*+?()[]{}|\\".includes(character) ? "\\" + character : character
  ).join("");
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Allow command-line health checks and local server-to-server requests with no Origin.
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("This website origin is not allowed by the API CORS settings."));
  },
  methods: ["GET"],
}));
app.use(express.json({ limit: "64kb" }));

let client;
let db;

app.get("/", (_req, res) => {
  res.json({ name: "Pocketmals API", status: "online", health: "/api/health" });
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, database: DB_NAME, message: "MongoDB connection is working." });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({ ok: false, message: "The database is not available." });
  }
});

app.get("/api/pocketmals", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 40);
    const filter = search ? { name: { $regex: escapeRegex(search), $options: "i" } } : {};
    const items = await db.collection("pocketmals")
      .find(filter, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .limit(100)
      .toArray();
    res.json({ count: items.length, items });
  } catch (error) { next(error); }
});

app.get("/api/pocketmals/:name", async (req, res, next) => {
  try {
    const name = String(req.params.name || "").trim().slice(0, 40);
    const item = await db.collection("pocketmals")
      .findOne({ name: { $regex: "^" + escapeRegex(name) + "$", $options: "i" } }, { projection: { _id: 0 } });
    if (!item) return res.status(404).json({ error: "Pocketmal not found." });
    res.json(item);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error("API error:", error.message);
  res.status(500).json({ error: "The API could not complete that request." });
});

async function start() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI. Add your MongoDB Atlas connection string to the backend environment variables.");
    process.exit(1);
  }
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(DB_NAME);
  await db.command({ ping: 1 });
  await db.collection("pocketmals").createIndex({ name: 1 }, { unique: true });
  app.listen(PORT, () => console.log(`Pocketmals API listening on port ${PORT}; database: ${DB_NAME}`));
}

start().catch(async (error) => {
  console.error("Could not start Pocketmals API:", error.message);
  if (client) await client.close().catch(() => {});
  process.exit(1);
});

process.on("SIGTERM", async () => {
  if (client) await client.close().catch(() => {});
  process.exit(0);
});
