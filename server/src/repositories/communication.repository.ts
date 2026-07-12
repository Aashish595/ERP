import { SqlRepository } from "../core/base.repository.js";
import { AnnouncementModel, type AnnouncementRecord } from "../models/communication.model.js";

export class CommunicationRepository extends SqlRepository<AnnouncementRecord> {
  constructor() { super(AnnouncementModel); }
}

export const communicationRepository = new CommunicationRepository();
