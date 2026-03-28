import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dbHealthRouter from "./db-health";
import tableSchemaRouter from "./table-schema";
import graphRouter from "./graph";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dbHealthRouter);
router.use(tableSchemaRouter);
router.use(graphRouter);

export default router;
