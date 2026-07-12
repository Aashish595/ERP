import { CrudController } from "../../core/base.controller.js";
import type { UserRecord } from "../../models/user.model.js";
import { profileService } from "../../services/profile.service.js";

export class ProfileController extends CrudController<UserRecord> {}
export const profileController = new ProfileController(profileService);
