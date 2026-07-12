import { CrudController } from "../../core/base.controller.js";
import type { BookRecord } from "../../models/library.model.js";
import { libraryService } from "../../services/library.service.js";

export class LibraryController extends CrudController<BookRecord> {}
export const libraryController = new LibraryController(libraryService);
