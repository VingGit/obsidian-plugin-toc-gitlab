import { TableOfContentsPluginSettings } from "./types";

export interface CursorPosition {
  line: number;
  ch: number;
}

export type TocMode = "full" | "next";

export {
  insertManagedToc,
  parseHeadings,
  toggleHeadingExclusion,
  updateManagedTocs,
} from "./managed-toc";

export type { TableOfContentsPluginSettings };
