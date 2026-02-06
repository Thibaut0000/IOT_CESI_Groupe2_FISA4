import bcrypt from "bcryptjs";
import { writeUser, queryUser } from "../services/influx.js";

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

await writeUser(email, hash, "admin");

console.log(`Admin ${email} created/updated successfully in InfluxDB.`);
