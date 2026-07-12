import { CrudController } from "../../core/base.controller.js";
import type { FeeCategoryRecord } from "../../models/fee.model.js";
import { feeService } from "../../services/fee.service.js";

export class FeeController extends CrudController<FeeCategoryRecord> {}
export const feeController = new FeeController(feeService);
