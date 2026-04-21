# Phase 2 Complete: Functional Component Structure

## What was done

Created [SortableTree.new.tsx](file:///c:/Users/Admin/Documents/Coding/intools-components/src/SortableTree/SortableTree.new.tsx) — a full functional component rewrite of the class-based `ReactSortableTree`.

## Conversion Summary

| Class Pattern | Hook Equivalent | Lines |
|---|---|---|
| `this.state.dragging` | `useState(false)` | 215 |
| `this.state.draggedNode` | `useState(null)` | 216 |
| `this.state.draggedDepth` | `useState(undefined)` | 217 |
| `this.state.draggedMinimumTreeIndex` | `useState(undefined)` | 218-220 |
| `this.state.draggingTreeData` | `useState(undefined)` | 221 |
| `this.state.searchMatches` | `useState([])` | 222 |
| `this.state.searchFocusTreeIndex` | `useState(undefined)` | 223 |
| `this.state.instanceProps` | `useRef({...})` | 226-231 |
| `getDerivedStateFromProps()` | Render-time derivation + `useEffect` | 511-567 |
| `componentDidMount()` | `useEffect(() => {...}, [])` | 570-582 |
| `componentDidUpdate()` (drag callback) | `useEffect` with prev-ref tracking | 585-598 |
| `this.startDrag()` | `useCallback` | 352-371 |
| `this.dragHover()` | `useCallback` with functional state updates | 374-426 |
| `this.endDrag()` | `useCallback` | 429-491 |
| `this.drop()` / `this.moveNode()` | `useCallback` | 291-349 |
| `this.toggleChildrenVisibility()` | `useCallback` | 270-288 |
| `static search()` | Standalone `performSearch()` function | 103-162 |
| `static loadLazyChildren()` | Standalone `loadLazyChildren()` function | 164-205 |
| `this.renderRow()` | `useCallback` | 601-680 |
| `React.memo` + `shouldComponentUpdate` | Preserved via memoized renderers | — |

## DnD Stub Strategy

The original component used `wrapSource()`, `wrapTarget()`, and `wrapPlaceholder()` HOCs from `dnd-manager.ts` to inject react-dnd props (`connectDropTarget`, `connectDragSource`, etc.) into renderers.

For Phase 2, **no-op stubs** are provided for these injected props:
- `dndStubsForTreeNode` → `{ connectDropTarget: noop, isOver: false }`
- `dndStubsForNodeContent` → `{ connectDragSource: noop, connectDragPreview: noop, isDragging: false, didDrop: false }`

> [!IMPORTANT]
> Phase 3 will replace these stubs with real `@dnd-kit` hook integrations (`useDraggable`, `useDroppable`, `DndContext`).

## Validation

- ✅ `tsc --noEmit` passes with **zero errors**
- ✅ All existing files unchanged
- ✅ Original `react-sortable-tree.tsx` preserved as reference
- ✅ All state, lifecycle, and callback logic faithfully converted

## Files Created

| File | Purpose |
|---|---|
| [SortableTree.new.tsx](file:///c:/Users/Admin/Documents/Coding/intools-components/src/SortableTree/SortableTree.new.tsx) | Functional component (846 lines) |

## Next: Phase 3

Phase 3 will integrate `@dnd-kit/core` by:
1. Wrapping the tree in `<DndContext>` with sensors
2. Replacing stub props with `useDraggable` / `useDroppable` hooks
3. Implementing `onDragStart`, `onDragOver`, `onDragEnd`, `onDragCancel` handlers
4. Removing the scroll-zone dependency on `react-dnd`'s `DndContext.Consumer`
