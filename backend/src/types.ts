export type Role = "admin" | "user";

export type JwtUser = {
  id: number;
  email: string;
  role: Role;
};