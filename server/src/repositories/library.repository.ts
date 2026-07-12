import { SqlRepository } from "../core/base.repository.js";
import { BookModel, type BookRecord } from "../models/library.model.js";

export class LibraryRepository extends SqlRepository<BookRecord> {
  constructor() { super(BookModel); }
}

export const libraryRepository = new LibraryRepository();
