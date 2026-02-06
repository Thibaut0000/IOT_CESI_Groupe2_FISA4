import bcrypt from "bcryptjs";
import { dbClient } from "../db/index.js";

const args = process.argv.slice(2);

const getArg = (name: string) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
};

const email = getArg("email");
const password = getArg("password");

if (!email || !password) {
  console.error("Usage: npm run create-admin -- --email <email> --password <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

const stmt = dbClient.prepare(
  "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin') ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'admin'"
);
stmt.run(email, hash);

console.log(`Admin ${email} created/updated successfully.`);
