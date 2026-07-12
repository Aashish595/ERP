import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    const allowed = /^(image\/|video\/|application\/pdf)/.test(file.mimetype);
    if (!allowed) return callback(new ApiError(415, "Unsupported file type"));
    callback(null, true);
  },
});

export async function storeUpload(file: Express.Multer.File, folder: string): Promise<string> {
  if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${config.CLOUDINARY_API_SECRET}`).digest("hex");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    form.append("folder", folder);
    form.append("timestamp", String(timestamp));
    form.append("api_key", config.CLOUDINARY_API_KEY);
    form.append("signature", signature);
    const resourceType = file.mimetype.startsWith("video/") ? "video" : file.mimetype === "application/pdf" ? "raw" : "image";
    const response = await fetch(`https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: form });
    if (!response.ok) throw new ApiError(502, "File storage upload failed");
    const result = await response.json() as { secure_url: string };
    return result.secure_url;
  }

  const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const directory = path.resolve("uploads", folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, safeName), file.buffer);
  return `${config.PUBLIC_API_URL.replace(/\/$/, "")}/uploads/${folder}/${safeName}`;
}
