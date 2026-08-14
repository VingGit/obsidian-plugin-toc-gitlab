import { TableOfContentsPluginSettings } from "./types";

export type TocMode = "full" | "next";

export interface ParsedHeading {
  depth: number;
  text: string;
  offset: number;
}

export const END_MARKER: string;
export const IGNORE_MARKER: string;
export function insertManagedToc(markdown: string, offset: number, mode: TocMode, settings: TableOfContentsPluginSettings): string;
export function parseHeadings(markdown: string): ParsedHeading[];
export function toggleHeadingExclusion(line: string): string | null;
export function updateManagedTocs(markdown: string, settings: TableOfContentsPluginSettings): string;
