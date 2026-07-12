import { SqlRepository } from "../core/base.repository.js";
import { FeeCategoryModel, type FeeCategoryRecord } from "../models/fee.model.js";

export class FeeRepository extends SqlRepository<FeeCategoryRecord> {
  constructor() { super(FeeCategoryModel); }
}

export const feeRepository = new FeeRepository();
