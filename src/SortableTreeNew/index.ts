// Drop-in alternative to `./SortableTree` that uses
// `@dnd-kit/core` under the hood.
// The public API (props, renderers, exported utilities) matches
// `./SortableTree` so the two are interchangeable.

export {
  type ReactSortableTreeRef,
  SortableTree as SortableTreeNew,
  SortableTreeWithoutDndContext as SortableTreeNewWithoutDndContext,
} from './react-sortable-tree';
export * from './types';
export { isDescendant } from './utils/tree-data-utils';
