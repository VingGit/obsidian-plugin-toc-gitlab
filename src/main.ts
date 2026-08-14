import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  ToggleComponent,
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

class TableOfContentsSettingsTab extends PluginSettingTab {
  private readonly plugin: TableOfContentsPlugin;

  constructor(app: App, plugin: TableOfContentsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Table of Contents for GitLab" });

    new Setting(containerEl)
      .setName("List style")
      .setDesc("The type of list used by generated tables of contents.")
      .addDropdown((dropdown) => dropdown
        .addOption("bullet", "Bullet")
        .addOption("number", "Number")
        .setValue(this.plugin.settings.listStyle)
        .onChange(async (value) => {
          this.plugin.settings.listStyle = value as "bullet" | "number";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Title")
      .setDesc("Optional text inserted before each generated list.")
      .addText((text) => text
        .setPlaceholder("**Table of Contents**")
        .setValue(this.plugin.settings.title || "")
        .onChange(async (value) => {
          this.plugin.settings.title = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Minimum heading depth")
      .setDesc("The shallowest heading level included in a full TOC.")
      .addSlider((slider) => slider
        .setValue(this.plugin.settings.minimumDepth)
        .setDynamicTooltip()
        .setLimits(1, 6, 1)
        .onChange(async (value) => {
          this.plugin.settings.minimumDepth = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Maximum heading depth")
      .setDesc("The deepest heading level included in a full TOC.")
      .addSlider((slider) => slider
        .setValue(this.plugin.settings.maximumDepth)
        .setDynamicTooltip()
        .setLimits(1, 6, 1)
        .onChange(async (value) => {
          this.plugin.settings.maximumDepth = value;
          await this.plugin.saveSettings();
        }));

    const gitLabSettings: Setting[] = [];
    new Setting(containerEl)
      .setName("Use Markdown links")
      .setDesc("Generate Markdown links instead of WikiLinks.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.useMarkdown)
        .onChange(async (value) => {
          this.plugin.settings.useMarkdown = value;
          if (!value) {
            this.plugin.settings.githubCompat = false;
            (gitLabSettings[0].components[0] as ToggleComponent).setValue(false);
          }
          gitLabSettings[0].setDisabled(!value);
          await this.plugin.saveSettings();
        }));

    gitLabSettings.push(new Setting(containerEl)
      .setName("GitLab-compatible Markdown section links")
      .setDesc("Generate links using current GitLab heading-anchor rules.")
      .setDisabled(!this.plugin.settings.useMarkdown)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.githubCompat ?? false)
        .setDisabled(!this.plugin.settings.useMarkdown)
        .onChange(async (value) => {
          this.plugin.settings.githubCompat = value;
          await this.plugin.saveSettings();
        })));

    new Setting(containerEl)
      .setName("Automatically update managed TOCs")
      .setDesc("Refresh generated TOCs shortly after headings are edited or reordered.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoUpdate)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdate = value;
          await this.plugin.saveSettings();
        }));
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

  public async onload(): Promise<void> {
    this.settings = { ...this.settings, ...(await this.loadData()) };
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
      name: "Toggle current heading exclusion from generated TOCs",
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
        .setTitle("Create managed TOC for next heading level")
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
    const original = workspace.openLinkText;
    let virtualBlockSequence = 0;

    const patched: Workspace["openLinkText"] = async (
      linktext,
      sourcePath,
      newLeaf,
      openViewState
    ) => {
      const hashIndex = linktext.lastIndexOf("#");
      if (hashIndex < 0 || linktext.slice(hashIndex + 1).startsWith("^")) {
        return original.call(workspace, linktext, sourcePath, newLeaf, openViewState);
      }

      const linkPath = linktext.slice(0, hashIndex);
      const fragment = linktext.slice(hashIndex + 1);
      const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
      const targetFile = linkPath
        ? this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
        : sourceFile instanceof TFile ? sourceFile : null;
      if (!targetFile) {
        return original.call(workspace, linktext, sourcePath, newLeaf, openViewState);
      }

      const cache = this.app.metadataCache.getFileCache(targetFile);
      const heading = findGitLabHeading(cache?.headings || [], fragment);
      if (!cache || !heading) {
        return original.call(workspace, linktext, sourcePath, newLeaf, openViewState);
      }

      const blockId = `toc-gitlab-${Date.now()}-${virtualBlockSequence++}`;
      const blocks = cache.blocks || (cache.blocks = {});
      blocks[blockId] = { id: blockId, position: heading.position };
      const nativeTarget = `${linkPath}#^${blockId}`;

      try {
        await original.call(workspace, nativeTarget, sourcePath, newLeaf, openViewState);
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
      new Notice("Place the cursor on a Markdown heading first.");
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
