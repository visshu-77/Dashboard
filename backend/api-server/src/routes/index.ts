import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import staffRouter from "./staff";
import dashboardRouter from "./dashboard";
import billingRouter from "./billing";
import authRouter from "./auth";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(staffRouter);
router.use(dashboardRouter);
router.use(billingRouter);
router.use(uploadsRouter);

export default router;
