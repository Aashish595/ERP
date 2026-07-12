import { CrudService } from "../core/base.service.js";
import type { BookRecord } from "../models/library.model.js";
import { libraryRepository } from "../repositories/library.repository.js";

export class LibraryService extends CrudService<BookRecord> {}
export const libraryService = new LibraryService(libraryRepository);
