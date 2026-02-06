import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { dbClient, DbUser } from "../db/index.js";
import { logger } from "../logger.js";
import { writeAudit } from "../services/audit.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().min(3),  // Accept any string (including admin@local)
  password: z.string().min(6)
});

router.post("/login", async (req, res) => {
  logger.info({ msg: "login attempt", body: req.body, contentType: req.get("Content-Type") });
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ msg: "validation failed", errors: parsed.error.errors });
    return res.status(400).json({ error: "Validation error", details: parsed.error.errors });
  }

  const { email, password } = parsed.data;
  const stmt = dbClient.prepare("SELECT id, email, password_hash, role FROM users WHERE email = ?");
  const user = stmt.get(email) as DbUser | undefined;

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const signOptions: SignOptions = { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] };
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, signOptions);

  writeAudit("login", user.email, { role: user.role });
  logger.info({ msg: "user logged in", email: user.email });

  return res.json({ token, role: user.role, email: user.email });
});

export default router;
