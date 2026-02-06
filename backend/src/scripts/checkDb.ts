import Database from "better-sqlite3";

const db = new Database("./data/sqlite.db");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables.map((t: any) => t.name).join(", "));

try {
  const count = db.prepare("SELECT COUNT(*) as c FROM noise_history").get() as { c: number };
  console.log("noise_history count:", count.c);

  if (count.c > 0) {
    const samples = db.prepare("SELECT * FROM noise_history ORDER BY ts DESC LIMIT 5").all();
    console.log("Last 5 records:", samples);
  }
} catch (e) {
  console.log("Table noise_history does not exist yet");
}

db.close();
