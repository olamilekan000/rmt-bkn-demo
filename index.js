require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 8000;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

function poolSsl(url) {
  if (process.env.DATABASE_SSL === "false") return false;
  const value = url.toLowerCase();
  const wantsSsl =
    process.env.DATABASE_SSL === "true" ||
    value.includes("sslmode=require") ||
    value.includes("sslmode=verify");
  return wantsSsl ? { rejectUnauthorized: false } : false;
}

function connectionStringWithoutSslMode(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    return parsed.toString();
  } catch {
    return url;
  }
}

function makePool(ssl) {
  return new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    ssl,
  });
}

let pool = makePool(poolSsl(databaseUrl));

app.use(express.json());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSslError(err) {
  const message = String(err && err.message ? err.message : err).toLowerCase();
  return (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("does not support")
  );
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ready() {
  let lastError;
  let triedNoSsl = false;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await ensureTable();
      return;
    } catch (err) {
      lastError = err;
      if (!triedNoSsl && isSslError(err)) {
        triedNoSsl = true;
        await pool.end().catch(() => undefined);
        pool = makePool(false);
        console.error("retrying database without ssl");
        continue;
      }
      console.error(`database not ready (${attempt}/20): ${err.message}`);
      await sleep(1000);
    }
  }
  throw lastError;
}

app.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "rumpty-demo-api", db: "up" });
  } catch (err) {
    res.status(503).json({ ok: false, service: "rumpty-demo-api", db: "down" });
  }
});

app.get("/items", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, created_at FROM items ORDER BY id DESC",
    );
    res.json({ items: rows });
  } catch (err) {
    res.status(500).json({ error: "could not list items" });
  }
});

app.post("/items", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO items (name) VALUES ($1) RETURNING id, name, created_at",
      [name],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "could not create item" });
  }
});

ready()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`listening on ${port}`);
    });
  })
  .catch((err) => {
    console.error("database is not ready:", err.message);
    process.exit(1);
  });
