export interface HeadingText {
  heading?: string;
  text?: string;
}

export function gitLabHeadingLink(heading: string, duplicateIndex?: number): string;
export function gitLabHeadingSlug(heading: string): string;
export function findGitLabHeading<T extends HeadingText>(headings: T[], fragment: string): T | undefined;
