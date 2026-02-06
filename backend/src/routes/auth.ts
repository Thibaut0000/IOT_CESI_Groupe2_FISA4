import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { queryUser, writeAuditPoint } from "../services/influx.js";
import { logger } from "../logger.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().min(3),
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

  try {
    const user = await queryUser(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const signOptions: SignOptions = { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] };
    const token = jwt.sign({ id: 0, email: user.email, role: user.role }, config.jwtSecret, signOptions);

    await writeAuditPoint("login", user.email, { role: user.role }).catch(() => {});
    logger.info({ msg: "user logged in", email: user.email });

    return res.json({ token, role: user.role, email: user.email });
  } catch (err) {
    logger.error({ msg: "login error", err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
