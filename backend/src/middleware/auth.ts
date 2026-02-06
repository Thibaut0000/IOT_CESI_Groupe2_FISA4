import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { JwtUser, Role } from "../types.js";

export type AuthedRequest = Request & { user?: JwtUser };

export const authenticate = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtUser;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireRole = (role: Role) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
  return next();
};