import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { hiddenManagedTocMarkerOffsets } from "./create-toc";

const HIDDEN_MARKER_CLASS = "toc-gitlab-hidden-marker";
const hiddenMarkerLine = Decoration.line({ class: HIDDEN_MARKER_CLASS });

function buildDecorations(view: EditorView, showComments: () => boolean): DecorationSet {
  if (showComments() || !view.state.field(editorLivePreviewField, false)) {
    return Decoration.none;
  }

  const selections = view.hasFocus
    ? view.state.selection.ranges.map(({ from, to }) => ({ from, to }))
    : [];
  const markerOffsets = hiddenManagedTocMarkerOffsets(view.state.doc.toString(), selections);
  const markerLines: Range<Decoration>[] = [];
  for (const { startMarker, endMarker } of markerOffsets) {
    markerLines.push(
      hiddenMarkerLine.range(view.state.doc.lineAt(startMarker).from),
      hiddenMarkerLine.range(view.state.doc.lineAt(endMarker).from)
    );
  }
  return Decoration.set(markerLines, true);
}

export function createManagedTocMarkerExtensions(showComments: () => boolean): Extension[] {
  const markerPlugin = ViewPlugin.fromClass(class {
    public decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view, showComments);
    }

    public update(update: ViewUpdate): void {
      const livePreviewChanged =
        update.startState.field(editorLivePreviewField, false) !==
        update.state.field(editorLivePreviewField, false);
      if (update.docChanged || update.selectionSet || update.focusChanged || livePreviewChanged) {
        this.decorations = buildDecorations(update.view, showComments);
      }
    }
  }, {
    decorations: (value) => value.decorations,
  });

  return [
    EditorView.baseTheme({
      [`.cm-line.${HIDDEN_MARKER_CLASS}`]: { display: "none" },
    }),
    markerPlugin,
  ];
}
