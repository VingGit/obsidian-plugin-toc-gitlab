// @ts-check

/** @typedef {{ heading?: string, text?: string }} HeadingText */

/**
 * Generate the fragment GitLab assigns to a Markdown heading.
 *
 * GitLab 17+ lowercases Unicode, removes everything except letters, numbers,
 * spaces, hyphens and underscores, then turns each space into a hyphen.
 * @param {string} heading
 * @param {number} [duplicateIndex]
 * @returns {string}
 */
function gitLabHeadingLink(heading, duplicateIndex) {
  const suffix = duplicateIndex ? `-${duplicateIndex}` : "";
  const slug = Array.from(heading.toLowerCase())
    .filter((character) => /[\p{L}\p{N} _-]/u.test(character))
    .join("")
    .replace(/ /g, "-");

  return `[${heading}](#${encodeURI(slug + suffix)})`;
}

/** @param {string} heading @returns {string} */
function gitLabHeadingSlug(heading) {
  const link = gitLabHeadingLink(heading);
  return link.slice(link.indexOf("#") + 1, -1);
}

/**
 * @template {HeadingText} T
 * @param {T[]} headings
 * @param {string} fragment
 * @returns {T | undefined}
 */
function findGitLabHeading(headings, fragment) {
  /** @type {string} */
  let decodedFragment;
  try {
    decodedFragment = decodeURIComponent(fragment.replace(/^#/, ""));
  } catch {
    return undefined;
  }

  /** @type {Map<string, number>} */
  const counts = new Map();
  return headings.find((heading) => {
    const text = heading.heading || heading.text;
    if (!text) return false;
    const baseSlug = gitLabHeadingSlug(text);
    const duplicateIndex = counts.get(baseSlug) || 0;
    counts.set(baseSlug, duplicateIndex + 1);
    const link = gitLabHeadingLink(text, duplicateIndex);
    const encodedSlug = link.slice(link.indexOf("#") + 1, -1);
    return decodeURIComponent(encodedSlug) === decodedFragment;
  });
}

module.exports = { findGitLabHeading, gitLabHeadingLink, gitLabHeadingSlug };
