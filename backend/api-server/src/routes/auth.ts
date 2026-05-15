import { Router, type IRouter } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db, insertWithId, stripMongoId } from "db";

const router: IRouter = Router();

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const storedKeyBuffer = Buffer.from(key, "hex");
  return timingSafeEqual(derivedKey, storedKeyBuffer);
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const { name, email, password } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "Name, email and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await db.users.findOne({ email: normalizedEmail }, { projection: { id: 1 } });

  if (existingUser) {
    res.status(409).json({ error: "Email is already registered." });
    return;
  }

  const passwordHash = hashPassword(password);
  const user = await insertWithId(db.users, "users", {
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    isActive: true,
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
});

router.post("/auth/signin", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (!email?.trim() || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  const user = stripMongoId(await db.users.findOne(
    { email: normalizedEmail },
    { projection: { id: 1, name: 1, email: 1, passwordHash: 1, isActive: 1 } },
  ));

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const sessionToken = randomBytes(32).toString("hex");
  await db.users.updateOne({ id: user.id }, { $set: { sessionToken, updatedAt: new Date() } });

  res.json({
    token: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.header("authorization");
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const user = stripMongoId(await db.users.findOne(
    { sessionToken: token },
    { projection: { id: 1, name: 1, email: 1, invoiceLogoUrl: 1, isActive: 1 } },
  ));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  res.json({ user });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.header("authorization");
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    await db.users.updateOne({ sessionToken: token }, { $set: { sessionToken: null, updatedAt: new Date() } });
  }

  res.json({ success: true });
});

export default router;
