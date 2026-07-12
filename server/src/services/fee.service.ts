import { CrudService } from "../core/base.service.js";
import type { FeeCategoryRecord } from "../models/fee.model.js";
import { feeRepository } from "../repositories/fee.repository.js";

export class FeeService extends CrudService<FeeCategoryRecord> {}
export const feeService = new FeeService(feeRepository);
