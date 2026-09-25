const assert = require("assert");
const {
  hiddenManagedTocMarkerOffsets,
  insertManagedToc,
  toggleHeadingExclusion,
  updateManagedTocs,
} = require("../src/managed-toc");

const settings = {
  minimumDepth: 1,
  maximumDepth: 6,
  listStyle: "bullet",
  autoUpdate: true,
};

const document = [
  "# First",
  "",
  "## First child",
  "",
  "# Second",
  "",
  "## Hidden child <!-- toc-ignore -->",
  "## Visible child",
  "",
].join("\n");

const belowFirstHeading = document.indexOf("\n") + 1;
const full = insertManagedToc(document, belowFirstHeading, "full", settings);
assert.match(full, /\[First\]\(#first\)/);
assert.match(full, /\[Second\]\(#second\)/);
assert.match(full, /\[Visible child\]\(#visible-child\)/);
assert.doesNotMatch(full, /\[Hidden child\]/);
assert.doesNotMatch(full, /\[\[#/, "GitLab TOCs never use ambiguous wiki-link syntax");

const legacySettings = { ...settings, useMarkdown: false, githubCompat: false };
const migrated = insertManagedToc(document, belowFirstHeading, "full", legacySettings);
assert.match(migrated, /\[First\]\(#first\)/);
assert.doesNotMatch(migrated, /\[\[#/);

const tocStart = full.indexOf("<!-- toc-gitlab:start");
const tocEnd = full.indexOf("<!-- toc-gitlab:end -->");
assert.deepStrictEqual(hiddenManagedTocMarkerOffsets(full, []), [{
  startMarker: tocStart,
  endMarker: tocEnd,
}]);
assert.deepStrictEqual(
  hiddenManagedTocMarkerOffsets(full, [{ from: tocStart + 1, to: tocStart + 1 }]),
  [],
  "comments are revealed when the cursor is inside the managed TOC"
);
assert.deepStrictEqual(
  hiddenManagedTocMarkerOffsets(full, [{ from: full.length, to: full.length }]),
  [{ startMarker: tocStart, endMarker: tocEnd }],
  "comments stay hidden when the cursor is outside the managed TOC"
);

const next = insertManagedToc(document, belowFirstHeading, "next", settings);
assert.match(next, /\[First child\]\(#first-child\)/);
assert.doesNotMatch(next, /\[Second\]\(#second\)/);

const nextAtTop = insertManagedToc(document, 0, "next", settings);
assert.match(nextAtTop, /\[First\]\(#first\)/);
assert.match(nextAtTop, /\[Second\]\(#second\)/);
assert.doesNotMatch(nextAtTop, /\[First child\]\(#first-child\)/);

const renamed = updateManagedTocs(full.replace("## Visible child", "## Renamed child"), settings);
assert.match(renamed, /\[Renamed child\]\(#renamed-child\)/);
assert.doesNotMatch(renamed, /\[Visible child\]/);

assert.strictEqual(toggleHeadingExclusion("## Include me"), "## Include me <!-- toc-ignore -->");
assert.strictEqual(toggleHeadingExclusion("## Include me <!-- toc-ignore -->"), "## Include me");
assert.strictEqual(toggleHeadingExclusion("not a heading"), null);

const crlf = insertManagedToc("# One\r\n\r\n## Two\r\n", 7, "full", settings);
assert.ok(!/(?<!\r)\n/.test(crlf), "managed TOCs preserve CRLF line endings");

console.log("Validated managed TOCs, marker visibility, updates, and exclusions.");
