const { gitLabHeadingLink, gitLabHeadingSlug } = require("./gitlab-anchor");

const START_PATTERN = "<!-- toc-gitlab:start mode=(full|next) -->";
const END_MARKER = "<!-- toc-gitlab:end -->";
const IGNORE_MARKER = "<!-- toc-ignore -->";
const MANAGED_TOC_PATTERN = new RegExp(`${START_PATTERN}[\\s\\S]*?${END_MARKER}`, "g");

function managedRanges(markdown) {
  MANAGED_TOC_PATTERN.lastIndex = 0;
  return Array.from(markdown.matchAll(MANAGED_TOC_PATTERN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function parseHeadings(markdown) {
  const ranges = managedRanges(markdown);
  const headings = [];
  const lines = markdown.split(/\n/);
  let offset = 0;
  let fence = null;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber].replace(/\r$/, "");
    const inManagedToc = ranges.some((range) => offset >= range.start && offset < range.end);
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);

    if (!inManagedToc && fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? null : fence || marker;
    } else if (!inManagedToc && !fence) {
      const match = /^(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
      if (match) {
        const excluded = /\s*<!--\s*toc-ignore\s*-->\s*(?:#+\s*)?$/.test(match[2]);
        const text = match[2]
          .replace(/\s*<!--\s*toc-ignore\s*-->\s*/, "")
          .replace(/\s+#+\s*$/, "")
          .trim();
        headings.push({
          level: match[1].length,
          text,
          excluded,
          line: lineNumber,
          offset,
          duplicateIndex: 0,
        });
      }
    }
    offset += lines[lineNumber].length + 1;
  }

  const slugCounts = new Map();
  for (const heading of headings) {
    const slug = gitLabHeadingSlug(heading.text);
    heading.duplicateIndex = slugCounts.get(slug) || 0;
    slugCounts.set(slug, heading.duplicateIndex + 1);
  }
  return headings;
}

function headingsForToc(headings, mode, markerOffset, settings) {
  let candidates;
  if (mode === "full") {
    candidates = headings;
  } else {
    const previous = headings.filter((heading) => heading.offset < markerOffset).pop();
    let section;
    if (!previous) {
      section = headings;
    } else {
      const parentIndex = headings.indexOf(previous);
      section = [];
      for (const heading of headings.slice(parentIndex + 1)) {
        if (heading.level <= previous.level) break;
        section.push(heading);
      }
    }
    const availableLevels = section
      .filter((heading) =>
        heading.level >= settings.minimumDepth &&
        heading.level <= settings.maximumDepth
      )
      .map((heading) => heading.level);
    const nextLevel = availableLevels.length ? Math.min(...availableLevels) : -1;
    candidates = section.filter((heading) => heading.level === nextLevel);
  }
  return candidates.filter((heading) =>
    !heading.excluded &&
    heading.level >= settings.minimumDepth &&
    heading.level <= settings.maximumDepth
  );
}

function renderLinks(headings, settings) {
  if (!headings.length) return "";
  const firstLevel = Math.min(...headings.map((heading) => heading.level));
  return headings.map((heading) => {
    const bullet = settings.listStyle === "number" ? "1." : "-";
    const indent = "\t".repeat(Math.max(0, heading.level - firstLevel));
    if (settings.useMarkdown && settings.githubCompat) {
      return `${indent}${bullet} ${gitLabHeadingLink(heading.text, heading.duplicateIndex)}`;
    }
    if (settings.useMarkdown) {
      return `${indent}${bullet} [${heading.text}](#${encodeURI(heading.text)})`;
    }
    return `${indent}${bullet} [[#${heading.text}|${heading.text}]]`;
  }).join("\n");
}

function renderManagedToc(markdown, mode, markerOffset, settings) {
  const headings = headingsForToc(parseHeadings(markdown), mode, markerOffset, settings);
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const links = renderLinks(headings, settings).replace(/\n/g, eol);
  const body = [settings.title || "", links]
    .filter(Boolean)
    .join(eol);
  return `<!-- toc-gitlab:start mode=${mode} -->${eol}${body}${eol}${END_MARKER}`;
}

function updateManagedTocs(markdown, settings) {
  let match;
  const matches = [];
  MANAGED_TOC_PATTERN.lastIndex = 0;
  while ((match = MANAGED_TOC_PATTERN.exec(markdown)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, mode: match[1] });
  }
  let updated = markdown;
  for (const item of matches.reverse()) {
    const replacement = renderManagedToc(markdown, item.mode, item.start, settings);
    updated = updated.slice(0, item.start) + replacement + updated.slice(item.end);
  }
  return updated;
}

function insertManagedToc(markdown, offset, mode, settings) {
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const markers = `<!-- toc-gitlab:start mode=${mode} -->${eol}${END_MARKER}`;
  const before = markdown.slice(0, offset);
  const after = markdown.slice(offset);
  const prefix = before && !before.endsWith(eol + eol) ? (before.endsWith(eol) ? eol : eol + eol) : "";
  const suffix = after && !after.startsWith(eol + eol) ? (after.startsWith(eol) ? eol : eol + eol) : "";
  return updateManagedTocs(before + prefix + markers + suffix + after, settings);
}

function toggleHeadingExclusion(line) {
  if (!/^(#{1,6})[ \t]+/.test(line)) return null;
  if (/<!--\s*toc-ignore\s*-->/.test(line)) {
    return line.replace(/\s*<!--\s*toc-ignore\s*-->/, "");
  }
  const closingHashes = /(\s+#+\s*)$/.exec(line);
  if (closingHashes) {
    return `${line.slice(0, closingHashes.index)} ${IGNORE_MARKER}${closingHashes[1]}`;
  }
  return `${line} ${IGNORE_MARKER}`;
}

module.exports = {
  END_MARKER,
  IGNORE_MARKER,
  insertManagedToc,
  parseHeadings,
  toggleHeadingExclusion,
  updateManagedTocs,
};
