import { CrudService } from "../core/base.service.js";
import type { AnnouncementRecord } from "../models/communication.model.js";
import { communicationRepository } from "../repositories/communication.repository.js";

export class CommunicationService extends CrudService<AnnouncementRecord> {}
export const communicationService = new CommunicationService(communicationRepository);
