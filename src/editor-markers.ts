import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { hiddenManagedTocMarkerOffsets } from "./create-toc";

const hiddenMarkerLine = Decoration.replace({ block: true });

function hiddenLineRange(view: EditorView, offset: number): Range<Decoration> {
  const line = view.state.doc.lineAt(offset);
  const to = line.number < view.state.doc.lines
    ? view.state.doc.line(line.number + 1).from
    : line.to;
  return hiddenMarkerLine.range(line.from, to);
}

function buildDecorations(view: EditorView, showComments: () => boolean): DecorationSet {
  if (showComments()) {
    return Decoration.none;
  }

  const selections = view.hasFocus
    ? view.state.selection.ranges.map(({ from, to }) => ({ from, to }))
    : [];
  const markerOffsets = hiddenManagedTocMarkerOffsets(view.state.doc.toString(), selections);
  const markerLines: Range<Decoration>[] = [];
  for (const { startMarker, endMarker } of markerOffsets) {
    markerLines.push(
      hiddenLineRange(view, startMarker),
      hiddenLineRange(view, endMarker)
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
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.view, showComments);
      }
    }
  }, {
    decorations: (value) => value.decorations,
  });

  return [markerPlugin];
}
