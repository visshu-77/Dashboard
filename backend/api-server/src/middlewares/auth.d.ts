import { Request, Response, NextFunction } from "express";
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
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map