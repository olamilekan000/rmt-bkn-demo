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

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

app.use(express.json());

async function ready() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
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
