import "dotenv/config";
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "pocketmals";
if (!uri) {
  console.error("Missing MONGODB_URI. Add it to backend/.env first.");
  process.exit(1);
}

const records = JSON.parse(await readFile(new URL("./pocketmals.seed.json", import.meta.url), "utf8"));
const client = new MongoClient(uri);

try {
  await client.connect();
  const collection = client.db(dbName).collection("pocketmals");
  await collection.createIndex({ name: 1 }, { unique: true });
  const operations = records.map((record) => ({
    replaceOne: {
      filter: { id: record.id },
      replacement: record,
      upsert: true
    }
  }));
  const result = await collection.bulkWrite(operations, { ordered: true });
  console.log(`Seed complete. ${records.length} Pocketmals loaded; ${result.upsertedCount} inserted and ${result.modifiedCount} updated.`);
} finally {
  await client.close();
}
