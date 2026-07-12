import { CrudService } from "../core/base.service.js";
import type { UserRecord } from "../models/user.model.js";
import { profileRepository } from "../repositories/profile.repository.js";

export class ProfileService extends CrudService<UserRecord> {}
export const profileService = new ProfileService(profileRepository);
