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

module.exports = { gitLabHeadingLink, gitLabHeadingSlug };
