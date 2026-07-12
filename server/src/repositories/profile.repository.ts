import { SqlRepository } from "../core/base.repository.js";
import { UserModel, type UserRecord } from "../models/user.model.js";

export class ProfileRepository extends SqlRepository<UserRecord> {
  constructor() { super(UserModel); }
}

export const profileRepository = new ProfileRepository();
