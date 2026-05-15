import { Request, Response, NextFunction } from "express";
import { db, stripMongoId } from "db";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: {
        id: number;
        name: string;
        email: string;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    { projection: { id: 1, name: 1, email: 1, isActive: 1 } },
  ));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  req.userId = user.id;
  req.user = { id: user.id, name: user.name, email: user.email };
  next();
};
