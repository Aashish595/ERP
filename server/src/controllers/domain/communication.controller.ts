import { CrudController } from "../../core/base.controller.js";
import type { AnnouncementRecord } from "../../models/communication.model.js";
import { communicationService } from "../../services/communication.service.js";

export class CommunicationController extends CrudController<AnnouncementRecord> {}
export const communicationController = new CommunicationController(communicationService);
