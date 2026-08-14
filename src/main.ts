import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  SettingDefinitionItem,
  TFile,
  Workspace,
} from "obsidian";
import { findGitLabHeading } from "./gitlab-anchor";
import {
  insertManagedToc,
  TocMode,
  toggleHeadingExclusion,
  updateManagedTocs,
} from "./create-toc";
import { TableOfContentsPluginSettings } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class TableOfContentsSettingsTab extends PluginSettingTab {
  private readonly plugin: TableOfContentsPlugin;

  constructor(app: App, plugin: TableOfContentsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public getSettingDefinitions(): SettingDefinitionItem[] {
    return [{
      type: "group",
      heading: "Table of Contents for GitLab",
      items: [
        {
          name: "List style",
          desc: "The type of list used by generated tables of contents.",
          control: {
            type: "dropdown",
            key: "listStyle",
            options: { bullet: "Bullet", number: "Number" },
            defaultValue: "bullet",
          },
        },
        {
          name: "Title",
          desc: "Optional text inserted before each generated list.",
          control: { type: "text", key: "title", defaultValue: "", placeholder: "**Table of Contents**" },
        },
        {
          name: "Minimum heading depth",
          desc: "The shallowest heading level included in a full TOC.",
          control: { type: "slider", key: "minimumDepth", defaultValue: 2, min: 1, max: 6, step: 1 },
        },
        {
          name: "Maximum heading depth",
          desc: "The deepest heading level included in a full TOC.",
          control: { type: "slider", key: "maximumDepth", defaultValue: 6, min: 1, max: 6, step: 1 },
        },
        {
          name: "Use Markdown links",
          desc: "Generate Markdown links instead of WikiLinks.",
          control: { type: "toggle", key: "useMarkdown", defaultValue: false },
        },
        {
          name: "GitLab-compatible Markdown section links",
          desc: "Generate links using current GitLab heading-anchor rules.",
          control: {
            type: "toggle",
            key: "githubCompat",
            defaultValue: false,
            disabled: () => !this.plugin.settings.useMarkdown,
          },
        },
        {
          name: "Automatically update managed TOCs",
          desc: "Refresh generated TOCs shortly after headings are edited or reordered.",
          control: { type: "toggle", key: "autoUpdate", defaultValue: true },
        },
      ],
    }];
  }

  public async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case "listStyle":
        if (value === "bullet" || value === "number") this.plugin.settings.listStyle = value;
        break;
      case "title":
        if (typeof value === "string") this.plugin.settings.title = value;
        break;
      case "minimumDepth":
      case "maximumDepth":
        if (typeof value === "number") this.plugin.settings[key] = value;
        break;
      case "useMarkdown":
        if (typeof value === "boolean") {
          this.plugin.settings.useMarkdown = value;
          if (!value) this.plugin.settings.githubCompat = false;
        }
        break;
      case "githubCompat":
      case "autoUpdate":
        if (typeof value === "boolean") this.plugin.settings[key] = value;
        break;
    }
    await this.plugin.saveSettings();
    this.refreshDomState();
  }
}

export default class TableOfContentsPlugin extends Plugin {
  public settings: TableOfContentsPluginSettings = {
    minimumDepth: 2,
    maximumDepth: 6,
    listStyle: "bullet",
    useMarkdown: false,
    autoUpdate: true,
  };

  private updateTimers = new Map<Editor, number>();
  private updatingEditors = new Set<Editor>();

  public onload(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadSettings();
    this.patchGitLabLinkNavigation();

    this.addCommand({
      id: "create-toc",
      name: "Create managed table of contents",
      editorCallback: (editor) => this.insertToc(editor, "full"),
    });
    this.addCommand({
      id: "create-toc-next-level",
      name: "Create managed table of contents for next heading level",
      editorCallback: (editor) => this.insertToc(editor, "next"),
    });
    this.addCommand({
      id: "toggle-heading-exclusion",
      name: "Toggle current heading exclusion from generated tocs",
      editorCallback: (editor) => this.toggleExclusion(editor),
    });
    this.addCommand({
      id: "update-managed-tocs",
      name: "Update managed tables of contents now",
      editorCallback: (editor) => this.updateEditorTocs(editor),
    });

    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      menu.addItem((item) => item
        .setTitle("Create managed table of contents")
        .setIcon("list-tree")
        .onClick(() => this.insertToc(editor, "full")));
      menu.addItem((item) => item
        .setTitle("Create managed toc for next heading level")
        .setIcon("list")
        .onClick(() => this.insertToc(editor, "next")));

      const line = editor.getLine(editor.getCursor().line);
      if (/^(#{1,6})[ \t]+/.test(line)) {
        const excluded = /<!--\s*toc-ignore\s*-->/.test(line);
        menu.addSeparator();
        menu.addItem((item) => item
          .setTitle(excluded ? "Include heading in generated TOCs" : "Exclude heading from generated TOCs")
          .setIcon(excluded ? "list-plus" : "list-x")
          .onClick(() => this.toggleExclusion(editor)));
      }
    }));

    this.registerEvent(this.app.workspace.on("editor-change", (editor) => {
      if (!this.settings.autoUpdate || this.updatingEditors.has(editor)) return;
      const previousTimer = this.updateTimers.get(editor);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      const timer = window.setTimeout(() => {
        this.updateTimers.delete(editor);
        this.updateEditorTocs(editor);
      }, 500);
      this.updateTimers.set(editor, timer);
    }));

    this.addSettingTab(new TableOfContentsSettingsTab(this.app, this));
  }

  private async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    if (!isRecord(loaded)) return;
    if (loaded.listStyle === "bullet" || loaded.listStyle === "number") this.settings.listStyle = loaded.listStyle;
    if (typeof loaded.minimumDepth === "number") this.settings.minimumDepth = loaded.minimumDepth;
    if (typeof loaded.maximumDepth === "number") this.settings.maximumDepth = loaded.maximumDepth;
    if (typeof loaded.title === "string") this.settings.title = loaded.title;
    if (typeof loaded.useMarkdown === "boolean") this.settings.useMarkdown = loaded.useMarkdown;
    if (typeof loaded.githubCompat === "boolean") this.settings.githubCompat = loaded.githubCompat;
    if (typeof loaded.autoUpdate === "boolean") this.settings.autoUpdate = loaded.autoUpdate;
  }

  public onunload(): void {
    for (const timer of this.updateTimers.values()) window.clearTimeout(timer);
    this.updateTimers.clear();
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) this.updateEditorTocs(view.editor);
  }

  private patchGitLabLinkNavigation(): void {
    const workspace = this.app.workspace;
    const original = workspace.openLinkText.bind(workspace);
    let virtualBlockSequence = 0;

    const patched: Workspace["openLinkText"] = async (
      linktext,
      sourcePath,
      newLeaf,
      openViewState
    ) => {
      const hashIndex = linktext.lastIndexOf("#");
      if (hashIndex < 0 || linktext.slice(hashIndex + 1).startsWith("^")) {
        return original(linktext, sourcePath, newLeaf, openViewState);
      }

      const linkPath = linktext.slice(0, hashIndex);
      const fragment = linktext.slice(hashIndex + 1);
      const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
      const targetFile = linkPath
        ? this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
        : sourceFile instanceof TFile ? sourceFile : null;
      if (!targetFile) {
        return original(linktext, sourcePath, newLeaf, openViewState);
      }

      const cache = this.app.metadataCache.getFileCache(targetFile);
      const heading = findGitLabHeading(cache?.headings || [], fragment);
      if (!cache || !heading) {
        return original(linktext, sourcePath, newLeaf, openViewState);
      }

      const blockId = `toc-gitlab-${Date.now()}-${virtualBlockSequence++}`;
      const blocks = cache.blocks || (cache.blocks = {});
      blocks[blockId] = { id: blockId, position: heading.position };
      const nativeTarget = `${linkPath}#^${blockId}`;

      try {
        await original(nativeTarget, sourcePath, newLeaf, openViewState);
      } finally {
        window.setTimeout(() => {
          if (blocks[blockId]?.position === heading.position) delete blocks[blockId];
        }, 1000);
      }
    };

    workspace.openLinkText = patched;
    this.register(() => {
      if (workspace.openLinkText === patched) workspace.openLinkText = original;
    });
  }

  private insertToc(editor: Editor, mode: TocMode): void {
    const markdown = editor.getValue();
    const offset = editor.posToOffset(editor.getCursor());
    const updated = insertManagedToc(markdown, offset, mode, this.settings);
    this.applyDocumentChange(editor, updated);
  }

  private toggleExclusion(editor: Editor): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const replacement = toggleHeadingExclusion(line);
    if (replacement === null) {
      new Notice("Select a heading before running this command.");
      return;
    }
    editor.replaceRange(replacement, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
    editor.setCursor({ line: cursor.line, ch: Math.min(cursor.ch, replacement.length) });
    this.updateEditorTocs(editor);
  }

  private updateEditorTocs(editor: Editor): void {
    if (this.updatingEditors.has(editor)) return;
    const markdown = editor.getValue();
    const updated = updateManagedTocs(markdown, this.settings);
    if (updated !== markdown) this.applyDocumentChange(editor, updated);
  }

  private applyDocumentChange(editor: Editor, updated: string): void {
    const original = editor.getValue();
    if (original === updated) return;

    let start = 0;
    while (start < original.length && start < updated.length && original[start] === updated[start]) start += 1;
    let oldEnd = original.length;
    let newEnd = updated.length;
    while (oldEnd > start && newEnd > start && original[oldEnd - 1] === updated[newEnd - 1]) {
      oldEnd -= 1;
      newEnd -= 1;
    }

    const cursorOffset = editor.posToOffset(editor.getCursor());
    const replacement = updated.slice(start, newEnd);
    const nextCursorOffset = cursorOffset <= start
      ? cursorOffset
      : cursorOffset >= oldEnd
        ? cursorOffset + replacement.length - (oldEnd - start)
        : start + replacement.length;

    this.updatingEditors.add(editor);
    editor.replaceRange(replacement, editor.offsetToPos(start), editor.offsetToPos(oldEnd));
    editor.setCursor(editor.offsetToPos(Math.max(0, Math.min(nextCursorOffset, updated.length))));
    window.setTimeout(() => this.updatingEditors.delete(editor), 0);
  }
}
