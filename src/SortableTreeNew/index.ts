// Main component
export { default as SortableTree } from './SortableTree';
export { default } from './SortableTree';

// Node renderer
export { default as NodeRendererDefault } from './NodeRendererDefault';

// Types
export type {
  FlattenedItem,
  GenerateNodePropsParams,
  NodeRendererProps,
  OnMoveNodeParams,
  OnVisibilityToggleParams,
  SortableTreeProps,
  TreeItem,
} from './types';

// Utilities — re-exported for consumers who need them
export {
  arrayMove,
  buildTree,
  findItemById,
  flattenTree,
  getNodeAtPath,
  getVisibleNodeCount,
  removeItemFromTree,
  setVisibilityAtPath,
  toggleExpandedForAll,
} from './utils';
