import type { Express } from "express";
import { storeUpload } from "../uploads.js";

export class UploadService {
  store(file: Express.Multer.File, folder: string): Promise<string> { return storeUpload(file, folder); }
}

export const uploadService = new UploadService();
