# Phase 3 Complete: @dnd-kit Integration

## What was done

Integrated `@dnd-kit/core` into the functional component rewrite (`SortableTree.new.tsx`), replacing the `react-dnd` hooks and wrappers.

## Integration Summary

1. **`DndContext` Wrapper**:

   - Wrapped the virtualized list inside `<DndContext>`.
   - Setup `useSensors` with `PointerSensor` (with distance constraint matching `react-dnd`), `TouchSensor`, and `KeyboardSensor`.
   - Hooked up `closestCenter` collision detection.

2. **Drag Handlers**:

   - **`onDragStart`**: Extracts `path` from `active.data` and triggers `startDrag`.
   - **`onDragOver`**: Extracts destination `treeIndex` and `path` from `over.data` and source node from `active.data`. Previews the drop position via `dragHover`.
   - **`onDragEnd`**: Calculates final depth and index based on drag over iterations. Triggers internal tree mutations via `drop` and cleans up via `endDrag`.
   - **`onDragCancel`**: Triggers cleanup via `endDrag(null)`.

3. **Hooks Integration**:

   - Replaced no-op `connectDropTarget` with `useDroppable` hook inside `src/SortableTree/tree-node.tsx`.
   - Replaced `connectDragSource` and `connectDragPreview` with `useDraggable` inside `src/SortableTree/node-renderer-default.tsx`.
   - Removed all dependencies on `react-dnd` injected props in the internal renderers.
   - Updated `src/SortableTree/tree-placeholder.tsx` to use `useDroppable`.

4. **Type Definitions**:
   - Cleaned up `InjectedTreeProps` and `InjectedNodeRendererProps` inside `src/SortableTree/types.ts`.
   - Ensured backward compatibility for `treeNodeRenderer` and `nodeContentRenderer` interfaces.

## Validation

- ✅ `yarn lint` passes with zero errors.
- ✅ `yarn type-check` passes with zero errors.
- ✅ `@dnd-kit` components properly integrated with internal tree logic without mutating public API contracts.

## Next: Phase 4

Phase 4 will focus on Drag Preview Implementation:

1. Implement high-fidelity `DragOverlay` to show exactly what node is being dragged.
2. Implement drag offset transforms.
3. Show drop indicators (indentation level guides).
