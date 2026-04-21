import type React from 'react';
import { type VirtuosoHandle, type VirtuosoProps } from 'react-virtuoso';
import { type DragDropManager } from 'dnd-core';

import { type Optional } from '../utility-types';

import { type DropOptions } from './utils/dnd-manager';

export type GetTreeItemChildrenFn = (data: GetTreeItemChildren) => void;

export interface GetTreeItemChildren {
  done: (children: TreeItem[]) => void;
  lowerSiblingCounts: number[];
  node: TreeItem;
  path: number[];
  treeIndex: number;
}

export interface TreeNode {
  node: TreeItem;
}

export interface TreePath {
  path: number[];
}

export interface TreeIndex {
  treeIndex: number;
}

export interface FullTree {
  treeData: TreeItem[];
}

export type GetNewNodeFunction = (data: TreeIndex & TreeNode) => TreeItem | undefined;

export type GetNodeKeyFunction = (data: TreeIndex & TreeNode) => number;

export interface TreeItem {
  [x: string]: unknown;
  children?: TreeItem[] | GetTreeItemChildrenFn;
  expanded?: boolean;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

export interface FlatDataItem extends TreeNode, TreePath {
  lowerSiblingCounts: number[];
  parentNode?: TreeItem;
}

export interface NodeData extends TreeNode, TreePath, TreeIndex {}

export interface SearchData extends NodeData {
  searchQuery: string;
}

export type SearchParams = {
  node: TreeItem;
  path: number[];
  searchQuery: string;
  treeIndex: number;
};

export type SearchFinishCallbackParams = Optional<NodeData, 'treeIndex'>[];

export type GenerateNodePropsParams = {
  isSearchFocus: boolean;
  isSearchMatch: boolean;
  lowerSiblingCounts: number[];
  node: TreeItem;
  path: number[];
  treeIndex: number;
};

type OnMoveNodeParams = {
  nextParentNode?: TreeItem;
  nextPath?: number[];
  nextTreeIndex?: number;
  node: TreeItem;
  path?: number[];
  prevPath: number[];
  prevTreeIndex: number;
  treeData: TreeItem[];
  treeIndex?: number;
};

export type CanDropParams = {
  nextParent: TreeItem;
  nextPath: number[];
  nextTreeIndex: number;
  node: TreeItem;
  prevParent?: TreeItem;
  prevPath: number[];
  prevTreeIndex: number;
};

type ShouldCopyOnOutsideDropParams = {
  node: TreeItem;
  prevPath: number[];
  prevTreeIndex: number;
};

type OnVisibilityToggleParams = {
  expanded: boolean;
  node: TreeItem;
  path: number[];
  treeData: TreeItem[];
};

type OnDragStateChangedParams = {
  draggedNode?: TreeItem;
  isDragging: boolean;
};

export type NodeRendererDefaultProps = NodeRendererProps & InjectedNodeRendererProps;

export type ReactSortableTreeProps = {
  /**
   * Determine whether a node can be dragged. Set to false to disable dragging on all nodes.
   */
  canDrag?: boolean | ((params: GenerateNodePropsParams) => boolean);

  /**
   * Determine whether a node can be dropped based on its path and parents.
   */
  canDrop?: (params: CanDropParams) => boolean;

  /**
   * Determine whether a node can have children.
   */
  canNodeHaveChildren?: (node: TreeItem) => boolean;

  /**
   * Class name for the container wrapping the tree
   */
  className?: string;

  'data-testid'?: string;
  debugMode?: boolean;
  dndType?: string;
  dragDropManager?: DragDropManager;

  /**
   * Generate an object with additional props to be passed to the node renderer.
   * Use this for adding buttons via the `buttons` key,
   * or additional `style` / `className` settings.
   */
  generateNodeProps?: (params: GenerateNodePropsParams) => Partial<NodeRendererProps>;

  /**
   * Determine the unique key used to identify each node and
   * generate the `path` array passed in callbacks.
   * By default, returns the index in the tree (omitting hidden nodes).
   */
  getNodeKey?: (data: TreeNode & TreeIndex) => number;

  /**
   * Style applied to the inner, scrollable container (for padding, etc.)
   */
  innerStyle?: React.CSSProperties;

  loadCollapsedLazyChildren?: boolean;

  /**
   * Maximum depth nodes can be inserted at. Defaults to infinite.
   */
  maxDepth?: number;

  /**
   * Override the default component for rendering nodes (but keep the scaffolding generator)
   * This is an advanced option for complete customization of the appearance.
   * It is best to copy the component in `node-renderer-default.js` to use as a base,
   * and customize as needed.
   */
  nodeContentRenderer?: React.ComponentType<NodeRendererDefaultProps>;

  /**
   * Called whenever tree data changed.
   * Just like with React input elements, you have to update your
   * own component's data to see the changes reflected.
   */
  onChange: (treeData: TreeItem[]) => void;

  /**
   * Called to track between dropped and dragging.
   */
  onDragStateChanged?: (params: OnDragStateChangedParams) => void;

  /**
   * Called after node move operation.
   */
  onMoveNode?: (params: OnMoveNodeParams) => void;

  /**
   * Called after children nodes collapsed or expanded.
   */
  onVisibilityToggle?: (params: OnVisibilityToggleParams) => void;

  /**
   * Specify that nodes that do not match search will be collapsed.
   */
  onlyExpandSearchedNodes?: boolean;

  overscan?: number | { main: number; reverse: number };

  /**
   * Override the default component for rendering an empty tree.
   * This is an advanced option for complete customization of the appearance.
   * It is best to copy the component in `placeholder-renderer-default.js` to use as a base,
   * and customize as needed.
   */
  placeholderRenderer?: React.ComponentType<PlaceholderRendererProps>;

  /**
   * rtl support.
   * @default "ltr"
   */
  rowDirection?: 'ltr' | 'rtl';

  /**
   * Sets the height of a given tree row item in pixels.
   * Can either be a number or a function to calculate dynamically.
   */
  rowHeight?: number | ((treeIndex: number, node: TreeItem, path: number[]) => number);

  /**
   * The width of the blocks containing the lines representing the structure of the tree.
   */
  scaffoldBlockPxWidth?: number;

  /**
   * Get the nodes that match the search criteria. Used for counting total matches, etc.
   */
  searchFinishCallback?: (params: SearchFinishCallbackParams) => void;

  /**
   * Outline the <`searchFocusOffset`>th node and scroll to it.
   */
  searchFocusOffset?: number;

  /**
   * The method used to search nodes.
   * Defaults to a function that uses the `searchQuery` string to search for nodes with
   * matching `title` or `subtitle` values.
   * NOTE: Changing `searchMethod` will not update the search, but changing the `searchQuery` will.
   */
  searchMethod?: (params: SearchParams) => boolean;

  /**
   * Used by the `searchMethod` to highlight and scroll to matched nodes.
   * Should be a string for the default `searchMethod`,
   * but can be anything when using a custom search.
   */
  searchQuery?: string;

  /**
   * When true, or a callback returning true, dropping nodes to react-dnd
   * drop targets outside of this tree will not remove them from this tree.
   */
  shouldCopyOnOutsideDrop?: ((params: ShouldCopyOnOutsideDropParams) => boolean) | boolean;

  /**
   * Size in px of the region near the edges that initiates scrolling on dragover.
   */
  slideRegionSize?: number;

  /**
   * Style applied to the container wrapping the tree (style defaults to {height: '100%'})
   */
  style?: React.CSSProperties;

  theme?: Pick<
    ReactSortableTreeProps,
    | 'style'
    | 'innerStyle'
    | 'rowHeight'
    | 'scaffoldBlockPxWidth'
    | 'slideRegionSize'
    | 'treeNodeRenderer'
    | 'nodeContentRenderer'
    | 'placeholderRenderer'
  >;

  /**
   * Tree data in the following format:
   * [{title: 'main', subtitle: 'sub'}, { title: 'value2', expanded: true, children: [{ title: 'value3') }] }]
   * `title` is the primary label for the node
   * `subtitle` is a secondary label for the node
   * `expanded` shows children of the node if true, or hides them if false. Defaults to false.
   * `children` is an array of child nodes belonging to the node.
   */
  treeData: TreeItem[];

  treeNodeRenderer?: React.ComponentType<TreeRendererProps & InjectedTreeProps>;

  /**
   * Properties passed directly to the underlying Virtuoso component
   * @see https://virtuoso.dev/virtuoso-api-reference/#virtuoso-properties
   */
  virtuosoProps?: VirtuosoProps<unknown, unknown>;

  /**
   * Ref for Virtuoso component.
   * Use virtuosoRef when you wont to use virtuoso handler
   * (ex. scrollTo scrollToIndex).
   */
  virtuosoRef?: React.RefObject<VirtuosoHandle>;
};

export type InjectedNodeRendererProps = {
  didDrop?: boolean;
  isDragging?: boolean;
};

export interface NodeRendererProps {
  /** @default [] */
  buttons?: JSX.Element[];
  /** @default false */
  canDrag?: boolean;
  /** @default false */
  canDrop?: boolean;
  className?: string;
  draggedNode?: TreeItem;
  endDrag?: (dropResult: unknown) => void;
  icons?: JSX.Element[];
  isOver?: boolean;
  /** @default false */
  isSearchFocus?: boolean;
  /** @default false */
  isSearchMatch?: boolean;
  listIndex?: number;
  lowerSiblingCounts?: number[];
  node: TreeItem;
  parentNode?: TreeItem;
  path: number[];
  /** @default "ltr" */
  rowDirection?: 'ltr' | 'rtl' | string;
  scaffoldBlockPxWidth: number;
  startDrag?: ({ path }: { path: number[] }) => void;
  style?: React.CSSProperties;
  subtitle?: React.ReactNode;
  swapDepth?: number;
  swapFrom?: number;
  swapLength?: number;
  title?: React.ReactNode;
  toggleChildrenVisibility?: (data: NodeData) => void;
  treeId: string;
  treeIndex: number;
}

export type InjectedTreeProps = {
  /** @default false */
  canDrop?: boolean;
  draggedNode?: TreeItem;
  isOver?: boolean;
};

export interface TreeRendererProps {
  children: React.ReactNode;
  // used in dndManager
  getPrevRow: () => FlatDataItem;
  listIndex: number;
  lowerSiblingCounts: number[];
  node: TreeItem;
  path: number[];
  /** @default "ltr" */
  rowDirection?: 'ltr' | 'rtl' | string;
  rowHeight: number | ((treeIndex: number, node: TreeItem, path: number[]) => number);
  scaffoldBlockPxWidth: number;

  style?: React.CSSProperties;
  swapDepth?: number;
  swapFrom?: number;

  swapLength?: number;
  treeId: string;
  treeIndex: number;
}

export type TreePlaceholderProps = {
  children: React.ReactNode;
  drop: (dropResult: DropOptions) => void;
  treeId: string;
};

export interface PlaceholderRendererProps {
  /** @default false */
  canDrop?: boolean;
  /** @default false */
  isOver?: boolean;
}
