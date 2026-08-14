/**
 * Generate the fragment GitLab assigns to a Markdown heading.
 *
 * GitLab 17+ lowercases Unicode, removes everything except letters, numbers,
 * spaces, hyphens and underscores, then turns each space into a hyphen.
 */
function gitLabHeadingLink(heading, duplicateIndex) {
  const suffix = duplicateIndex ? `-${duplicateIndex}` : "";
  const slug = Array.from(heading.toLowerCase())
    .filter((character) => /[\p{L}\p{N} _-]/u.test(character))
    .join("")
    .replace(/ /g, "-");

  return `[${heading}](#${encodeURI(slug + suffix)})`;
}

function gitLabHeadingSlug(heading) {
  const link = gitLabHeadingLink(heading);
  return link.slice(link.indexOf("#") + 1, -1);
}

function findGitLabHeading(headings, fragment) {
  let decodedFragment;
  try {
    decodedFragment = decodeURIComponent(fragment.replace(/^#/, ""));
  } catch (_error) {
    return undefined;
  }

  const counts = new Map();
  return headings.find((heading) => {
    const text = heading.heading || heading.text;
    const baseSlug = gitLabHeadingSlug(text);
    const duplicateIndex = counts.get(baseSlug) || 0;
    counts.set(baseSlug, duplicateIndex + 1);
    const link = gitLabHeadingLink(text, duplicateIndex);
    const encodedSlug = link.slice(link.indexOf("#") + 1, -1);
    return decodeURIComponent(encodedSlug) === decodedFragment;
  });
}

module.exports = { findGitLabHeading, gitLabHeadingLink, gitLabHeadingSlug };
