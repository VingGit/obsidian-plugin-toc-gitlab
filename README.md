# Table of Contents for GitLab

Create managed tables of contents whose Markdown links follow GitLab 17+ heading-anchor rules, including Unicode lowercasing, punctuation removal, and duplicate-heading suffixes.

This is a GitLab-focused fork of [obsidian-plugin-toc](https://github.com/hipstersmoothie/obsidian-plugin-toc) by Andrew Lisowski.

## Features

- Create a full-document TOC at any cursor position.
- Create a TOC for the next heading level at any cursor position.
- Automatically update any number of managed TOCs after headings are added, renamed, removed, or reordered.
- Exclude individual headings with an invisible HTML comment.
- Toggle heading exclusion from the command palette or the editor right-click menu.
- Generate GitLab-compatible anchors for Unicode, punctuation, and duplicate headings.

## Usage

Open the command palette and run one of these commands:

- **Create managed table of contents** scans the entire note, regardless of where the cursor is located.
- **Create managed table of contents for next heading level** uses the closest heading above the TOC as its parent and lists that section's shallowest eligible child level. At the top of a note, it lists the shallowest eligible heading level in the document.
- **Toggle current heading exclusion from generated TOCs** adds or removes the exclusion marker on the current heading.
- **Update managed tables of contents now** immediately refreshes all generated TOCs in the note.

The editor right-click menu also offers both TOC creation actions. While the cursor is on a Markdown heading, it additionally offers **Exclude heading from generated TOCs** or **Include heading in generated TOCs**.

### Managed TOCs

The plugin surrounds generated content with HTML comments:

```markdown
<!-- toc-gitlab:start mode=full -->
- [Example](#example)
<!-- toc-gitlab:end -->
```

These comments do not render in Obsidian, GitLab, or ordinary Markdown viewers. Do not remove them if you want the TOC to update automatically. TOCs created by older versions are plain text and must be recreated once to become managed.

Multiple managed TOCs in one note are supported. Automatic updates are enabled by default and can be disabled in the plugin settings.

### Excluding a heading

Add `<!-- toc-ignore -->` at the end of an ATX-style Markdown heading:

```markdown
## Internal notes <!-- toc-ignore -->
```

The heading still renders normally and still receives its normal GitLab anchor, but it is omitted from every generated TOC. The marker can be added or removed through the command palette or editor right-click menu.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| List style | Bullet | Generate bullet or numbered lists. |
| Title | Empty | Optional content placed before each generated list. |
| Minimum heading depth | 2 | Shallowest eligible heading level. |
| Maximum heading depth | 6 | Deepest eligible heading level. |
| Use Markdown links | Off | Generate Markdown links instead of WikiLinks. |
| GitLab-compatible Markdown section links | Off | Apply GitLab heading-anchor rules. |
| Automatically update managed TOCs | On | Refresh TOCs after heading edits. |

For portable GitLab documents, enable **Use Markdown links** and **GitLab-compatible Markdown section links**. GitLab-style links may require a compatibility plugin such as GFM Heading Links to navigate correctly inside Obsidian.

## Installation

Install from the Obsidian community plugin browser when available, or download the [latest release](https://github.com/VingGit/obsidian-plugin-toc-gitlab/releases/latest) and place `main.js` and `manifest.json` in:

```text
<vault>/.obsidian/plugins/toc-gitlab/
```

Then reload Obsidian and enable **Table of Contents for GitLab** under Community plugins.

## Development

```sh
npm ci
npm test
npm run build
npm run lint
```
