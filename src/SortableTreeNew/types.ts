import type React from 'react';

// ─── Core Data Types ──────────────────────────────────────────────────────────

export interface TreeItem {
  [key: string]: unknown;
  children?: TreeItem[];
  expanded?: boolean;
  id: string | number;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

/** Flattened version of TreeItem used internally during DnD */
export interface FlattenedItem extends TreeItem {
  collapsed: boolean;
  depth: number;
  index: number;
  parentId: string | number | null;
}

// ─── Node Renderer Props ──────────────────────────────────────────────────────

export interface NodeRendererProps {
  /** Extra props passed from `generateNodeProps` */
  [key: string]: unknown;
  buttons?: React.ReactNode[];
  canDrag?: boolean;
  className?: string;
  connectDragPreview?: (node: React.ReactNode) => React.ReactNode;
  connectDragSource: (node: React.ReactNode) => React.ReactNode;
  isDragging: boolean;
  isSearchFocus?: boolean;
  isSearchMatch?: boolean;
  node: TreeItem;
  path: Array<string | number>;
  style?: React.CSSProperties;
  toggleChildrenVisibility?: (params: {
    node: TreeItem;
    path: Array<string | number>;
    treeIndex: number;
  }) => void;
  treeIndex: number;
}

// ─── Main Component Props ─────────────────────────────────────────────────────

export interface GenerateNodePropsParams {
  isSearchFocus: boolean;
  isSearchMatch: boolean;
  node: TreeItem;
  parentNode: TreeItem | null;
  path: Array<string | number>;
  treeIndex: number;
}

export interface OnMoveNodeParams {
  nextParentNode: TreeItem | null;
  nextPath: Array<string | number>;
  nextTreeIndex: number;
  node: TreeItem;
  prevPath: Array<string | number>;
  prevTreeIndex: number;
  treeData: TreeItem[];
}

export interface OnVisibilityToggleParams {
  expanded: boolean;
  node: TreeItem;
  path: Array<string | number>;
  treeData: TreeItem[];
}

export interface SortableTreeProps {
  /** Whether items can be dragged globally (default: true) */
  canDrag?:
    | boolean
    | ((params: { node: TreeItem; path: Array<string | number>; treeIndex: number }) => boolean);
  /** Whether an item can be dropped into a given location */
  canDrop?: (params: {
    nextDepth: number;
    nextParent: TreeItem | null;
    node: TreeItem;
    prevParent: TreeItem | null;
    prevPath: Array<string | number>;
  }) => boolean;
  /** Class name applied to the outer container */
  className?: string;
  /** Generate extra props for each node row renderer */
  generateNodeProps?: (params: GenerateNodePropsParams) => Record<string, unknown>;
  /** Style applied to the inner scroll container */
  innerStyle?: React.CSSProperties;
  /** Maximum nesting depth allowed */
  maxDepth?: number;
  /** Custom node content renderer component */
  nodeContentRenderer?: React.ComponentType<NodeRendererProps>;
  /** Called whenever the tree is updated */
  onChange: (treeData: TreeItem[]) => void;
  /** Called after a node has been moved */
  onMoveNode?: (params: OnMoveNodeParams) => void;
  /** Called when a node's `expanded` state changes */
  onVisibilityToggle?: (params: OnVisibilityToggleParams) => void;
  /** Whether drop placeholder is shown (default: true) */
  placeholderRenderer?: React.ComponentType<{ canDrop: boolean; isOver: boolean }>;
  /** Row height in px or a function returning height (default: 62) */
  rowHeight?:
    | number
    | ((params: { node: TreeItem; path: Array<string | number>; treeIndex: number }) => number);
  /** Width of each indent/scaffold block in px (default: 44) */
  scaffoldBlockPxWidth?: number;
  /** Called after search is finished; args: [{node, treeIndex, path}, ...] */
  searchFinishCallback?: (
    matches: Array<{ node: TreeItem; path: Array<string | number>; treeIndex: number }>,
  ) => void;
  /** Index of search result to focus on */
  searchFocusOffset?: number;
  /** Called on each node to determine search match */
  searchMethod?: (params: { node: TreeItem; searchQuery: string }) => boolean;
  /** Search query string */
  searchQuery?: string | null;
  /** Style applied to the outer container */
  style?: React.CSSProperties;
  /** The tree data array */
  treeData: TreeItem[];
}
