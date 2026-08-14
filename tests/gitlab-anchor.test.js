const assert = require("assert");
const {
  findGitLabHeading,
  gitLabHeadingLink,
  gitLabHeadingSlug,
} = require("../src/gitlab-anchor");

const cases = new Map([
  ["1 Yleiset ohjeet", "[1 Yleiset ohjeet](#1-yleiset-ohjeet)"],
  ["3 Editorin käyttö", "[3 Editorin käyttö](#3-editorin-k%C3%A4ytt%C3%B6)"],
  ["TEHTÄVÄT", "[TEHTÄVÄT](#teht%C3%A4v%C3%A4t)"],
  ["Tehtävä 1.1 (50 %)", "[Tehtävä 1.1 (50 %)](#teht%C3%A4v%C3%A4-11-50-)"],
]);

for (const [heading, expected] of cases) {
  assert.strictEqual(gitLabHeadingLink(heading), expected);
}

assert.strictEqual(gitLabHeadingSlug("TEHTÄVÄT"), "teht%C3%A4v%C3%A4t");
assert.strictEqual(
  gitLabHeadingLink("TEHTÄVÄT", 1),
  "[TEHTÄVÄT](#teht%C3%A4v%C3%A4t-1)"
);

const headings = [
  { heading: "TEHTÄVÄT", position: { start: { line: 1 }, end: { line: 1 } } },
  { heading: "TEHTÄVÄT", position: { start: { line: 2 }, end: { line: 2 } } },
];
assert.strictEqual(findGitLabHeading(headings, "teht%C3%A4v%C3%A4t"), headings[0]);
assert.strictEqual(findGitLabHeading(headings, "tehtävät-1"), headings[1]);
assert.strictEqual(findGitLabHeading(headings, "missing"), undefined);

console.log(`Validated ${cases.size + 5} GitLab anchor and navigation cases.`);
