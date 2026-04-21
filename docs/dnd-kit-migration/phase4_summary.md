# Phase 4 Complete: Drag Preview Implementation

## What was done

Implemented the custom `DragOverlay` for `@dnd-kit/core` to provide a high-fidelity drag preview of the dragged node.

## Implementation Details

1. **`DragOverlay` Integration**:

   - Added `<DragOverlay dropAnimation={null}>` component from `@dnd-kit/core` directly inside `SortableTree.new.tsx`'s `<DndContext>`.
   - The overlay only renders when `draggedNode` is defined.

2. **High-Fidelity Preview**:

   - The overlay renders the exact same `merged.nodeContentRenderer` as the original node.
   - It is wrapped in `.rst__tree` and `.rst__node` elements to ensure the Emotion styles apply correctly.

3. **Indentation and Target Depth**:

   - Applied dynamic indentation to `.rst__nodeContent` based on `draggedDepth` multiplied by `scaffoldBlockPxWidth`.
   - Handled `rowDirection="rtl"` by dynamically applying padding/offset to the `right` instead of `left`.

4. **Opacity and Visuals**:
   - Passed `isDragging={true}` to `nodeContentRenderer` to ensure any "drag active" styles (such as opacity and scale) are correctly applied to the preview.
   - Updated `node-renderer-default.tsx` to omit `isDragging` from being passed to DOM elements to resolve React hydration/DOM warnings.

## Validation

- ✅ `yarn lint` passes with zero errors.
- ✅ `yarn type-check` passes with zero errors.
- ✅ Drag overlay renders accurately and respects RTL dynamically.
- ✅ Correct `draggedDepth` logic drives the indentation of the floating node wrapper.

## Next: Phase 5

Phase 5 will verify the Tree Data & Utilities (no changes expected for `tree-data-utils.ts`, but it's good to ensure `dnd-manager.ts` dependencies can be cleaned up).
