import React from 'react';
import isEqual from 'react-fast-compare';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Box } from '@chakra-ui/react';
import {
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { memoize, omit } from 'lodash-es';

import NodeRendererDefault from './node-renderer-default';
import PlaceholderRendererDefault from './placeholder-renderer-default';
import TreeNode from './tree-node';
import TreePlaceholder from './tree-placeholder';
import {
  type ConnectFunction,
  type DropOptions,
  type FlatDataItem,
  type InjectedNodeRendererProps,
  type InjectedTreeProps,
  type NodeData,
  type NodeRendererDefaultProps,
  type NodeRendererProps,
  type ReactSortableTreeProps,
  type SearchFinishCallbackParams,
  type TreeItem,
  type TreePlaceholderProps,
  type TreeRendererProps,
} from './types';
import { type AugmentedRequired, type OmitStrict } from '../utility-types';

import { nodeRendererDefaultStyle } from './styles/node-renderer-default.style';
import { placeholderRendererDefaultStyle } from './styles/placeholder-renderer-default.style';
import { reactSortableTreeStyle } from './styles/react-sortable-tree.style';
import { treeNodeStyle } from './styles/tree-node.style';
import { defaultGetNodeKey, defaultSearchMethod } from './utils/default-handlers';
import { type Row, slideRows } from './utils/generic-utils';
import {
  memoizedGetDescendantCount,
  memoizedGetFlatDataFromTree,
  memoizedInsertNode,
} from './utils/memoized-tree-data-utils';
import {
  changeNodeAtPath,
  find,
  getDepth,
  insertNode,
  removeNode,
  toggleExpandedForAll,
  walk,
} from './utils/tree-data-utils';

type PropsWithDefault = AugmentedRequired<
  ReactSortableTreeProps,
  | 'canDrag'
  | 'canNodeHaveChildren'
  | 'getNodeKey'
  | 'onMoveNode'
  | 'onVisibilityToggle'
  | 'shouldCopyOnOutsideDrop'
  | 'onDragStateChanged'
  | 'onlyExpandSearchedNodes'
  | 'rowDirection'
  | 'overscan'
>;

type State = {
  draggedDepth?: number;
  draggedMinimumTreeIndex?: number;
  draggedNode?: TreeItem;
  dragging: boolean;
  draggingTreeData?: TreeItem[];
  instanceProps: {
    ignoreOneTreeUpdate: boolean;
    searchFocusOffset?: number;
    searchQuery?: string;
    treeData: TreeItem[];
  };
  searchFocusTreeIndex?: number;
  searchMatches: SearchFinishCallbackParams;
};

interface WrapProps {
  node: TreeItem;
  parentNode?: TreeItem;
  path: number[];
  treeId: string;
  treeIndex: number;
}

interface DragHoverOptions {
  depth: number;
  minimumTreeIndex: number;
  node: TreeItem;
  path: number[];
}

interface DropTargetMeta {
  getPrevRow: () => FlatDataItem;
  listIndex: number;
  node: TreeItem;
  parentNode?: TreeItem;
  path: number[];
  rowDirection: 'ltr' | 'rtl' | string;
  scaffoldBlockPxWidth: number;
  treeId: string;
  treeIndex: number;
  type: 'node';
}

interface PlaceholderTargetMeta {
  treeId: string;
  type: 'placeholder';
}

let treeIdCounter = 1;

const mergeTheme = (props: PropsWithDefault) => {
  const merged = {
    nodeContentRenderer: NodeRendererDefault,
    placeholderRenderer: PlaceholderRendererDefault,
    scaffoldBlockPxWidth: 44,
    slideRegionSize: 100,
    rowHeight: 62,
    treeNodeRenderer: TreeNode,
    ...props.theme,
    ...props,
    style: { ...props.theme?.style, ...props.style },
    innerStyle: { ...props.theme?.innerStyle, ...props.innerStyle },
  };

  return merged;
};

// ---------------------------------------------------------------------------
// Wrappers: replace react-dnd's wrapSource / wrapTarget / wrapPlaceholder HOCs
// with dnd-kit-driven wrappers that shim the `connectDragSource`,
// `connectDragPreview`, and `connectDropTarget` props.
// ---------------------------------------------------------------------------

const buildSourceWrapper = (
  Component: React.ComponentType<NodeRendererDefaultProps>,
  dndType: string,
) => {
  const SourceWrapped = (props: NodeRendererProps) => {
    const { node, parentNode, path, treeId, treeIndex } = props;
    const dragId = `${dndType}__src__${treeId}__${treeIndex}`;
    const data: WrapProps & { dndType: string } = {
      dndType,
      node,
      parentNode,
      path,
      treeId,
      treeIndex,
    };

    const { active, attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
      useDraggable({ id: dragId, data });

    const didDrop = false;
    const reallyDragging =
      isDragging ||
      ((active?.data.current as WrapProps | undefined)?.node === node &&
        (active?.data.current as { dndType?: string } | undefined)?.dndType === dndType);

    const handleRef = React.useCallback(
      (el: HTMLElement | null) => {
        setNodeRef(el);
        setActivatorNodeRef(el);
      },
      [setNodeRef, setActivatorNodeRef],
    );

    const connectDragSource: ConnectFunction = React.useCallback(
      (element) =>
        React.cloneElement(element, {
          ref: handleRef,
          ...listeners,
          ...attributes,
        }),
      [handleRef, listeners, attributes],
    );

    // dnd-kit has no HTML5-style drag preview concept — the original was only
    // used to attach the preview element. Render the element untouched.
    const connectDragPreview: ConnectFunction = React.useCallback((element) => element, []);

    const injected: InjectedNodeRendererProps = {
      connectDragPreview,
      connectDragSource,
      didDrop,
      isDragging: reallyDragging,
    };

    return <Component {...props} {...injected} />;
  };

  SourceWrapped.displayName = 'DndKitSourceWrapped';

  return SourceWrapped;
};

const buildTargetWrapper = (
  Component: React.ComponentType<TreeRendererProps & InjectedTreeProps>,
  dndType: string,
) => {
  const TargetWrapped = (props: TreeRendererProps) => {
    const {
      getPrevRow,
      listIndex,
      node,
      path,
      rowDirection = 'ltr',
      scaffoldBlockPxWidth,
      treeId,
      treeIndex,
    } = props;
    const dropId = `${dndType}__dst__${treeId}__${treeIndex}`;
    const data: DropTargetMeta = {
      getPrevRow,
      listIndex,
      node,
      path,
      rowDirection,
      scaffoldBlockPxWidth,
      treeId,
      treeIndex,
      type: 'node',
    };

    const { active, isOver, setNodeRef } = useDroppable({ id: dropId, data });

    const draggedNode = (active?.data.current as WrapProps | undefined)?.node;
    const isFromThisDnd =
      (active?.data.current as { dndType?: string } | undefined)?.dndType === dndType;
    const canDrop = isOver && isFromThisDnd;

    const connectDropTarget: ConnectFunction = React.useCallback(
      (element) =>
        React.cloneElement(element, {
          ref: setNodeRef,
        }),
      [setNodeRef],
    );

    const injected: InjectedTreeProps = {
      canDrop,
      connectDropTarget,
      draggedNode: isFromThisDnd ? draggedNode : undefined,
      isOver: !!isOver,
    };

    return <Component {...props} {...injected} />;
  };

  TargetWrapped.displayName = 'DndKitTargetWrapped';

  return TargetWrapped;
};

const buildPlaceholderWrapper = (
  Component: React.ComponentType<TreePlaceholderProps & InjectedTreeProps>,
  dndType: string,
) => {
  const PlaceholderWrapped = (props: TreePlaceholderProps) => {
    const { treeId } = props;
    const dropId = `${dndType}__placeholder__${treeId}`;
    const data: PlaceholderTargetMeta = { treeId, type: 'placeholder' };

    const { active, isOver, setNodeRef } = useDroppable({ id: dropId, data });

    const draggedNode = (active?.data.current as WrapProps | undefined)?.node;
    const isFromThisDnd =
      (active?.data.current as { dndType?: string } | undefined)?.dndType === dndType;
    const canDrop = isOver && isFromThisDnd;

    const connectDropTarget: ConnectFunction = React.useCallback(
      (element) =>
        React.cloneElement(element, {
          ref: setNodeRef,
        }),
      [setNodeRef],
    );

    const injected: InjectedTreeProps = {
      canDrop,
      connectDropTarget,
      draggedNode: isFromThisDnd ? draggedNode : undefined,
      isOver: !!isOver,
    };

    return <Component {...props} {...injected} />;
  };

  PlaceholderWrapped.displayName = 'DndKitPlaceholderWrapped';

  return PlaceholderWrapped;
};

// ---------------------------------------------------------------------------

class ReactSortableTree extends React.Component<PropsWithDefault, State> {
  static defaultProps: OmitStrict<PropsWithDefault, 'treeData' | 'onChange'> = {
    canDrag: true,
    canNodeHaveChildren: () => true,
    getNodeKey: defaultGetNodeKey,
    onMoveNode: () => {},
    onVisibilityToggle: () => {},
    shouldCopyOnOutsideDrop: false,
    onDragStateChanged: () => {},
    onlyExpandSearchedNodes: false,
    rowDirection: 'ltr',
    overscan: 0,
  };

  listRef: React.RefObject<VirtuosoHandle>;
  listProps: Required<PropsWithDefault>['virtuosoProps'];
  treeId: string;
  dndType: string;
  nodeContentRenderer: React.ComponentType<NodeRendererProps>;
  treePlaceholderRenderer: React.ComponentType<TreePlaceholderProps>;
  treeNodeRenderer: React.ComponentType<TreeRendererProps>;

  constructor(props: PropsWithDefault) {
    super(props);

    this.state = {
      draggingTreeData: undefined,
      draggedNode: undefined,
      draggedMinimumTreeIndex: undefined,
      draggedDepth: undefined,
      searchMatches: [],
      searchFocusTreeIndex: undefined,
      dragging: false,

      instanceProps: {
        treeData: [],
        ignoreOneTreeUpdate: false,
        searchQuery: undefined,
        searchFocusOffset: undefined,
      },
    };

    this.listRef = props.virtuosoRef || React.createRef<VirtuosoHandle>();
    this.listProps = props.virtuosoProps || {};

    const { dndType, nodeContentRenderer, treeNodeRenderer } = mergeTheme(props);

    this.treeId = `rst__${treeIdCounter}`;
    treeIdCounter += 1;
    this.dndType = dndType || this.treeId;

    this.nodeContentRenderer = buildSourceWrapper(nodeContentRenderer, this.dndType);
    this.treePlaceholderRenderer = buildPlaceholderWrapper(TreePlaceholder, this.dndType);
    this.treeNodeRenderer = buildTargetWrapper(treeNodeRenderer, this.dndType);
  }

  static search(
    props: PropsWithDefault,
    state: State,
    seekIndex: boolean,
    expand: boolean,
    singleSearch: boolean,
  ) {
    const {
      getNodeKey,
      onChange,
      onlyExpandSearchedNodes,
      searchFinishCallback,
      searchFocusOffset,
      searchMethod,
      searchQuery,
    } = props;

    const { instanceProps } = state;
    const newState: Partial<State> = {};

    if (!searchQuery) {
      if (searchFinishCallback) {
        searchFinishCallback([]);
      }
      newState.searchMatches = [];
      return newState;
    }

    const { matches: searchMatches, treeData: expandedTreeData } = find({
      getNodeKey,
      treeData: onlyExpandSearchedNodes
        ? toggleExpandedForAll({
            treeData: instanceProps.treeData,
            expanded: false,
          })
        : instanceProps.treeData,
      searchQuery,
      searchMethod: searchMethod || defaultSearchMethod,
      searchFocusOffset,
      expandAllMatchPaths: expand && !singleSearch,
      expandFocusMatchPaths: !!expand,
    });

    if (expand) {
      newState.instanceProps = { ...instanceProps };
      newState.instanceProps.ignoreOneTreeUpdate = true;
      onChange(expandedTreeData);
    }

    if (searchFinishCallback) {
      searchFinishCallback(searchMatches);
    }

    let searchFocusTreeIndex;
    if (seekIndex && searchFocusOffset !== undefined && searchFocusOffset < searchMatches.length) {
      searchFocusTreeIndex = searchMatches[searchFocusOffset].treeIndex;
    }

    newState.searchMatches = searchMatches;
    newState.searchFocusTreeIndex = searchFocusTreeIndex;

    return newState;
  }

  static loadLazyChildren(props: PropsWithDefault, state: State) {
    const { instanceProps } = state;

    walk({
      treeData: instanceProps.treeData,
      getNodeKey: props.getNodeKey,
      callback: ({ lowerSiblingCounts, node, path, treeIndex }) => {
        if (
          node.children &&
          typeof node.children === 'function' &&
          (node.expanded || props.loadCollapsedLazyChildren)
        ) {
          node.children({
            node,
            path,
            lowerSiblingCounts,
            treeIndex,
            done: (childrenArray) => {
              const treeData = changeNodeAtPath({
                treeData: instanceProps.treeData,
                path,
                newNode: ({ node: oldNode }) =>
                  oldNode === node
                    ? {
                        ...oldNode,
                        children: childrenArray,
                      }
                    : oldNode,
                getNodeKey: props.getNodeKey,
              });
              props.onChange(treeData);
            },
          });
        }
      },
    });
  }

  static getDerivedStateFromProps(nextProps: PropsWithDefault, prevState: State) {
    const { instanceProps } = prevState;
    const newState: Partial<State> = {};
    const newInstanceProps = { ...instanceProps };

    const isTreeDataEqual = isEqual(instanceProps.treeData, nextProps.treeData);

    newInstanceProps.treeData = nextProps.treeData;

    if (!isTreeDataEqual) {
      if (instanceProps.ignoreOneTreeUpdate) {
        newInstanceProps.ignoreOneTreeUpdate = false;
      } else {
        newState.searchFocusTreeIndex = undefined;
        ReactSortableTree.loadLazyChildren(nextProps, prevState);
        Object.assign(
          newState,
          ReactSortableTree.search(nextProps, prevState, false, false, false),
        );
      }

      newState.draggingTreeData = undefined;
      newState.draggedNode = undefined;
      newState.draggedMinimumTreeIndex = undefined;
      newState.draggedDepth = undefined;
      newState.dragging = false;
    } else if (!isEqual(instanceProps.searchQuery, nextProps.searchQuery)) {
      Object.assign(newState, ReactSortableTree.search(nextProps, prevState, true, true, false));
    } else if (instanceProps.searchFocusOffset !== nextProps.searchFocusOffset) {
      Object.assign(newState, ReactSortableTree.search(nextProps, prevState, true, true, true));
    }

    newInstanceProps.searchQuery = nextProps.searchQuery;
    newInstanceProps.searchFocusOffset = nextProps.searchFocusOffset;
    newState.instanceProps = { ...newInstanceProps, ...newState.instanceProps };

    return newState;
  }

  componentDidMount() {
    ReactSortableTree.loadLazyChildren(this.props, this.state);
    const stateUpdate = ReactSortableTree.search(this.props, this.state, true, true, false);
    this.setState((prev) => ({
      ...prev,
      ...stateUpdate,
    }));
  }

  componentDidUpdate(_prevProps: Readonly<PropsWithDefault>, prevState: Readonly<State>) {
    if (this.state.dragging !== prevState.dragging && this.props.onDragStateChanged) {
      this.props.onDragStateChanged({
        isDragging: this.state.dragging,
        draggedNode: this.state.draggedNode,
      });
    }
  }

  getRows = (options: {
    /** @default true */
    ignoreCollapsed?: boolean;
    treeData: TreeItem[];
  }) => {
    const { ignoreCollapsed = true, treeData } = options;
    return memoizedGetFlatDataFromTree({
      ignoreCollapsed,
      getNodeKey: this.props.getNodeKey,
      treeData,
    });
  };

  startDrag = ({ path }: { path: number[] }) => {
    this.setState((prevState) => {
      const {
        node: draggedNode,
        treeData: draggingTreeData,
        treeIndex: draggedMinimumTreeIndex,
      } = removeNode({
        treeData: prevState.instanceProps.treeData,
        path,
        getNodeKey: this.props.getNodeKey,
      });

      return {
        draggingTreeData,
        draggedNode,
        draggedDepth: path.length - 1,
        draggedMinimumTreeIndex,
        dragging: true,
      };
    });
  };

  dragHover = ({
    depth: draggedDepth,
    minimumTreeIndex: draggedMinimumTreeIndex,
    node: draggedNode,
  }: DragHoverOptions) => {
    if (
      this.state.draggedDepth === draggedDepth &&
      this.state.draggedMinimumTreeIndex === draggedMinimumTreeIndex
    ) {
      return;
    }

    this.setState(({ draggingTreeData, instanceProps }) => {
      const newDraggingTreeData = draggingTreeData || instanceProps.treeData;

      const addedResult = memoizedInsertNode({
        treeData: newDraggingTreeData,
        newNode: draggedNode,
        depth: draggedDepth,
        minimumTreeIndex: draggedMinimumTreeIndex,
        expandParent: true,
        getNodeKey: this.props.getNodeKey,
      });

      const rows = this.getRows({ treeData: addedResult.treeData });
      const expandedParentPath = rows[addedResult.treeIndex].path;

      return {
        draggedNode,
        draggedDepth,
        draggedMinimumTreeIndex,
        draggingTreeData: changeNodeAtPath({
          treeData: newDraggingTreeData,
          path: expandedParentPath.slice(0, -1),
          newNode: ({ node }) => ({ ...node, expanded: true }),
          getNodeKey: this.props.getNodeKey,
        }),
        searchFocusTreeIndex: undefined,
        dragging: true,
      };
    });
  };

  endDrag = (dropResult?: WrapProps | null) => {
    const { instanceProps } = this.state;

    if (!dropResult) {
      this.setState({
        draggingTreeData: undefined,
        draggedNode: undefined,
        draggedMinimumTreeIndex: undefined,
        draggedDepth: undefined,
        dragging: false,
      });
    } else if (dropResult.treeId !== this.treeId) {
      const { node, path, treeIndex } = dropResult;
      let shouldCopy = this.props.shouldCopyOnOutsideDrop;
      if (typeof shouldCopy === 'function') {
        shouldCopy = shouldCopy({
          node,
          prevTreeIndex: treeIndex,
          prevPath: path,
        });
      }

      let treeData = this.state.draggingTreeData || instanceProps.treeData;

      if (shouldCopy) {
        treeData = changeNodeAtPath({
          treeData: instanceProps.treeData,
          path,
          newNode: ({ node: copyNode }) => ({ ...copyNode }),
          getNodeKey: this.props.getNodeKey,
        });
      }

      this.props.onChange(treeData);
      this.props.onMoveNode({
        treeData,
        node,
        treeIndex: undefined,
        path: undefined,
        nextPath: undefined,
        nextTreeIndex: undefined,
        prevPath: path,
        prevTreeIndex: treeIndex,
      });
    }
  };

  drop = (dropResult: DropOptions) => {
    this.moveNode(dropResult);
  };

  canNodeHaveChildren = (node: TreeItem) => {
    const { canNodeHaveChildren } = this.props;
    if (canNodeHaveChildren) {
      return canNodeHaveChildren(node);
    }
    return true;
  };

  toggleChildrenVisibility = ({ node: targetNode, path }: NodeData) => {
    const { instanceProps } = this.state;

    const treeData = changeNodeAtPath({
      treeData: instanceProps.treeData,
      path,
      newNode: ({ node }) => ({ ...node, expanded: !node.expanded }),
      getNodeKey: this.props.getNodeKey,
    });

    this.props.onChange(treeData);
    this.props.onVisibilityToggle({
      treeData,
      node: targetNode,
      expanded: !targetNode.expanded,
      path,
    });
  };

  moveNode = (dropResult: DropOptions) => {
    const { depth, minimumTreeIndex, node, path: prevPath, treeIndex: prevTreeIndex } = dropResult;
    const {
      parentNode: nextParentNode,
      path,
      treeData,
      treeIndex,
    } = insertNode({
      treeData: this.state.draggingTreeData,
      newNode: node,
      depth,
      minimumTreeIndex,
      expandParent: true,
      getNodeKey: this.props.getNodeKey,
    });

    this.props.onChange(treeData);
    this.props.onMoveNode({
      treeData,
      node,
      treeIndex,
      path,
      nextPath: path,
      nextTreeIndex: treeIndex,
      prevPath,
      prevTreeIndex,
      nextParentNode,
    });
  };

  // -------------------------------------------------------------------------
  // dnd-kit bridge: translate drag lifecycle events into the same
  // startDrag / dragHover / drop / endDrag calls the original used.
  // -------------------------------------------------------------------------

  getTargetDepth = (
    dragData: WrapProps & { dndType: string },
    overData: DropTargetMeta,
    deltaX: number,
  ) => {
    const { maxDepth } = this.props;

    let dropTargetDepth = 0;
    const rowAbove = overData.getPrevRow?.();
    if (rowAbove) {
      const { node } = rowAbove;
      let path = rowAbove.path;
      if (!this.canNodeHaveChildren(node)) {
        path = path.slice(0, -1);
      }
      dropTargetDepth = Math.min(path.length, overData.path.length);
    }

    let blocksOffset = 0;
    let dragSourceInitialDepth = (dragData.path || []).length;

    if (dragData.treeId === this.treeId) {
      const direction = overData.rowDirection === 'rtl' ? -1 : 1;
      blocksOffset = Math.round((direction * deltaX) / overData.scaffoldBlockPxWidth);
    } else {
      dragSourceInitialDepth = 0;
      blocksOffset = overData.path.length;
    }

    let targetDepth = Math.min(
      dropTargetDepth,
      Math.max(0, dragSourceInitialDepth + blocksOffset - 1),
    );

    if (maxDepth !== undefined) {
      const draggedChildDepth = getDepth(dragData.node);
      targetDepth = Math.max(0, Math.min(targetDepth, maxDepth - draggedChildDepth - 1));
    }

    return targetDepth;
  };

  checkCanDrop = (
    dragData: WrapProps & { dndType: string },
    overData: DropTargetMeta,
    targetDepth: number,
  ) => {
    const rowAbove = overData.getPrevRow?.();
    const abovePath = rowAbove ? rowAbove.path : [];
    const aboveNode = rowAbove ? rowAbove.node : ({} as TreeItem);

    if (targetDepth >= abovePath.length && typeof aboveNode.children === 'function') {
      return false;
    }

    const treeRefCanDrop = this.props.canDrop;
    if (typeof treeRefCanDrop === 'function') {
      return treeRefCanDrop({
        node: dragData.node,
        prevPath: dragData.path,
        prevParent: dragData.parentNode,
        prevTreeIndex: dragData.treeIndex,
        nextPath: overData.path,
        nextParent: overData.parentNode as TreeItem,
        nextTreeIndex: overData.treeIndex,
      });
    }

    return true;
  };

  handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as (WrapProps & { dndType: string }) | undefined;
    if (!data || data.dndType !== this.dndType) {
      return;
    }
    this.startDrag({ path: data.path });
  };

  handleDragMove = (event: DragMoveEvent) => {
    const dragData = event.active.data.current as (WrapProps & { dndType: string }) | undefined;
    if (!dragData || dragData.dndType !== this.dndType) return;

    const overData = event.over?.data.current as DropTargetMeta | PlaceholderTargetMeta | undefined;
    if (!overData) return;
    if (overData.type !== 'node') return;

    const draggedNode = dragData.node;
    const targetDepth = this.getTargetDepth(dragData, overData, event.delta.x);

    const needsRedraw = overData.node !== draggedNode || targetDepth !== overData.path.length - 1;

    if (!needsRedraw) return;

    this.dragHover({
      node: draggedNode,
      path: dragData.path,
      minimumTreeIndex: overData.listIndex,
      depth: targetDepth,
    });
  };

  handleDragEnd = (event: DragEndEvent) => {
    const dragData = event.active.data.current as (WrapProps & { dndType: string }) | undefined;
    if (!dragData || dragData.dndType !== this.dndType) return;

    const overData = event.over?.data.current as DropTargetMeta | PlaceholderTargetMeta | undefined;

    if (!overData) {
      this.endDrag(null);
      return;
    }

    if (overData.type === 'placeholder') {
      const result: DropOptions = {
        node: dragData.node,
        path: dragData.path,
        treeIndex: dragData.treeIndex,
        treeId: this.treeId,
        minimumTreeIndex: 0,
        depth: 0,
      };
      this.drop(result);
      return;
    }

    const targetDepth = this.getTargetDepth(dragData, overData, event.delta.x);
    if (!this.checkCanDrop(dragData, overData, targetDepth)) {
      this.endDrag(null);
      return;
    }

    const result: DropOptions = {
      node: dragData.node,
      path: dragData.path,
      treeIndex: dragData.treeIndex,
      treeId: this.treeId,
      minimumTreeIndex: overData.listIndex,
      depth: targetDepth,
    };
    this.drop(result);
  };

  handleDragCancel = (_event: DragCancelEvent) => {
    this.endDrag(null);
  };

  renderRow = (
    row: Row,
    options: {
      getPrevRow: () => Row;
      listIndex: number;
      matchKeys: Record<string, number>;
      style?: React.CSSProperties;
      swapDepth?: number;
      swapFrom: number;
      swapLength: number;
    },
  ) => {
    const { lowerSiblingCounts, node, parentNode, path, treeIndex } = row;
    const { getPrevRow, listIndex, matchKeys, style, swapDepth, swapFrom, swapLength } = options;
    const {
      canDrag,
      generateNodeProps,
      rowDirection,
      rowHeight,
      scaffoldBlockPxWidth,
      searchFocusOffset,
    } = mergeTheme(this.props);

    const TreeNodeRenderer = this.treeNodeRenderer;
    const NodeContentRenderer = this.nodeContentRenderer;
    const nodeKey = path.at(-1);
    const isSearchMatch = nodeKey !== undefined && String(nodeKey) in matchKeys;
    const isSearchFocus = isSearchMatch && matchKeys[String(nodeKey)] === searchFocusOffset;
    const callbackParams = {
      node,
      parentNode,
      path,
      lowerSiblingCounts,
      treeIndex,
      isSearchMatch,
      isSearchFocus,
    };
    const nodeProps = generateNodeProps ? generateNodeProps(callbackParams) : {};
    const rowCanDrag = typeof canDrag === 'function' ? canDrag(callbackParams) : canDrag;

    const sharedProps = {
      treeIndex,
      scaffoldBlockPxWidth,
      node,
      path,
      treeId: this.treeId,
      rowDirection,
    };

    return (
      <TreeNodeRenderer
        key={nodeKey}
        getPrevRow={getPrevRow}
        listIndex={listIndex}
        lowerSiblingCounts={lowerSiblingCounts}
        rowHeight={rowHeight}
        style={style}
        swapDepth={swapDepth}
        swapFrom={swapFrom}
        swapLength={swapLength}
        {...sharedProps}
      >
        <NodeContentRenderer
          canDrag={rowCanDrag}
          isSearchFocus={isSearchFocus}
          isSearchMatch={isSearchMatch}
          parentNode={parentNode}
          toggleChildrenVisibility={this.toggleChildrenVisibility}
          {...sharedProps}
          {...nodeProps}
        />
      </TreeNodeRenderer>
    );
  };

  render() {
    const {
      className,
      'data-testid': dataTestId,
      getNodeKey,
      innerStyle,
      placeholderRenderer,
      rowDirection,
      style,
    } = mergeTheme(this.props);
    const {
      draggedDepth,
      draggedMinimumTreeIndex,
      draggedNode,
      draggingTreeData,
      instanceProps,
      searchFocusTreeIndex,
      searchMatches,
    } = this.state;

    const treeData = draggingTreeData || instanceProps.treeData;
    const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;

    let rows: Row[] = [];
    let swapFrom: number;
    let swapLength: number;
    if (draggedNode && draggedMinimumTreeIndex !== undefined && draggedDepth !== undefined) {
      const addedResult = memoizedInsertNode({
        treeData,
        newNode: draggedNode,
        depth: draggedDepth,
        minimumTreeIndex: draggedMinimumTreeIndex,
        expandParent: true,
        getNodeKey: getNodeKey,
      });

      const swapTo = draggedMinimumTreeIndex;
      swapFrom = addedResult.treeIndex;
      swapLength = 1 + memoizedGetDescendantCount({ node: draggedNode });
      rows = slideRows(
        this.getRows({ treeData: addedResult.treeData }),
        swapFrom,
        swapTo,
        swapLength,
      );
    } else {
      rows = this.getRows({ treeData });
    }

    const matchKeys: Record<string, number> = {};
    for (const [i, { path }] of searchMatches.entries()) {
      const key = path.at(-1);
      if (key !== undefined) {
        matchKeys[String(key)] = i;
      }
    }

    if (searchFocusTreeIndex !== undefined) {
      this.listRef.current?.scrollToIndex({
        index: searchFocusTreeIndex,
        align: 'center',
      });
    }

    let containerStyle = style;
    let list: React.JSX.Element;
    if (rows.length === 0) {
      const Placeholder = this.treePlaceholderRenderer;
      const PlaceholderContent = placeholderRenderer;
      list = (
        <Placeholder drop={this.drop} treeId={this.treeId}>
          <PlaceholderContent />
        </Placeholder>
      );
    } else {
      containerStyle = { height: '100%', ...containerStyle };
      const memoizedRenderRow = memoize(this.renderRow);
      const virtuosoExtra = omit(this.listProps, ['data', 'itemContent', 'style', 'className']);

      list = (
        <Virtuoso
          ref={this.listRef}
          className="rst__virtualScrollOverride"
          data={rows}
          itemContent={(index: number) => {
            const isFirst = index === 0;
            const isLast = index === rows.length - 1;
            const spacer = <div className="rst__virtualScrollSpacer" />;
            const item = memoizedRenderRow(rows[index], {
              listIndex: index,
              getPrevRow: () => rows[index - 1] || undefined,
              matchKeys,
              swapFrom,
              swapDepth: draggedDepth,
              swapLength,
            });

            if (isFirst) {
              return (
                <>
                  {spacer}
                  {item}
                </>
              );
            } else if (isLast) {
              return (
                <>
                  {item}
                  {spacer}
                </>
              );
            }
            return item;
          }}
          style={innerStyle}
          {...virtuosoExtra}
        />
      );
    }

    return (
      <Box
        className={clsx('rst__tree', className, rowDirectionClass)}
        css={[
          nodeRendererDefaultStyle,
          placeholderRendererDefaultStyle,
          treeNodeStyle,
          reactSortableTreeStyle,
        ]}
        data-testid={dataTestId}
        style={containerStyle}
      >
        {list}
      </Box>
    );
  }
}

export type ReactSortableTreeRef = ReactSortableTree;

type DragPreviewState = {
  node: TreeItem;
  parentNode?: TreeItem;
  path: number[];
  treeIndex: number;
} | null;

/**
 * Renders a floating copy of the currently-dragged row so there is a visible
 * preview under the cursor.  react-dnd relied on the HTML5 drag API's native
 * drag image for this; dnd-kit requires an explicit `DragOverlay`.
 */
const DragPreviewOverlay = (props: {
  dragPreview: DragPreviewState;
  mergedProps: PropsWithDefault;
}) => {
  const { dragPreview, mergedProps } = props;
  if (!dragPreview) {
    return <DragOverlay dropAnimation={null} />;
  }

  const { generateNodeProps, nodeContentRenderer, rowDirection, scaffoldBlockPxWidth } =
    mergeTheme(mergedProps);
  const NodeContentRenderer = nodeContentRenderer || NodeRendererDefault;

  const callbackParams: GenerateNodePropsParamsStub = {
    isSearchFocus: false,
    isSearchMatch: false,
    lowerSiblingCounts: [],
    node: dragPreview.node,
    path: dragPreview.path,
    treeIndex: dragPreview.treeIndex,
  };
  const nodeProps = generateNodeProps ? generateNodeProps(callbackParams) : {};

  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;

  const identity: ConnectFunction = (element) => element;

  return (
    <DragOverlay dropAnimation={null}>
      <Box
        className={clsx('rst__tree', 'rst__dragPreview', rowDirectionClass)}
        css={[
          nodeRendererDefaultStyle,
          placeholderRendererDefaultStyle,
          treeNodeStyle,
          reactSortableTreeStyle,
        ]}
        style={{ pointerEvents: 'none' }}
      >
        <NodeContentRenderer
          // canDrag
          // canDrop={false}
          connectDragPreview={identity}
          connectDragSource={identity}
          didDrop={false}
          isDragging={false}
          // isOver={false}
          // isSearchFocus={false}
          // isSearchMatch={false}
          node={dragPreview.node}
          // parentNode={dragPreview.parentNode}
          path={dragPreview.path}
          // rowDirection={rowDirection}
          scaffoldBlockPxWidth={scaffoldBlockPxWidth}
          treeId=""
          treeIndex={dragPreview.treeIndex}
          {...nodeProps}
        />
      </Box>
    </DragOverlay>
  );
};

type GenerateNodePropsParamsStub = {
  isSearchFocus: boolean;
  isSearchMatch: boolean;
  lowerSiblingCounts: number[];
  node: TreeItem;
  path: number[];
  treeIndex: number;
};

const extractDragPreview = (event: DragStartEvent, dndType: string): DragPreviewState => {
  const data = event.active.data.current as (WrapProps & { dndType: string }) | undefined;
  if (!data || data.dndType !== dndType) return null;
  return {
    node: data.node,
    parentNode: data.parentNode,
    path: data.path,
    treeIndex: data.treeIndex,
  };
};

const ReactSortableTreeWithSensors = React.forwardRef<
  ReactSortableTreeRef,
  ReactSortableTreeProps & { dndContextOverride?: boolean }
>((props, ref) => {
  const { dndContextOverride, ...rest } = props;
  const treeRef = React.useRef<ReactSortableTreeRef | null>(null);
  const [dragPreview, setDragPreview] = React.useState<DragPreviewState>(null);

  React.useImperativeHandle<ReactSortableTreeRef | null, ReactSortableTreeRef | null>(
    ref,
    () => treeRef.current,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 1 },
    }),
  );

  const onDragStart = React.useCallback((event: DragStartEvent) => {
    treeRef.current?.handleDragStart(event);
    if (treeRef.current) {
      setDragPreview(extractDragPreview(event, treeRef.current.dndType));
    }
  }, []);
  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => treeRef.current?.handleDragMove(event),
    [],
  );
  const onDragEnd = React.useCallback((event: DragEndEvent) => {
    treeRef.current?.handleDragEnd(event);
    setDragPreview(null);
  }, []);
  const onDragCancel = React.useCallback((event: DragCancelEvent) => {
    treeRef.current?.handleDragCancel(event);
    setDragPreview(null);
  }, []);

  const tree = (
    <ReactSortableTree
      {...(rest as PropsWithDefault)}
      ref={(instance) => {
        treeRef.current = instance;
      }}
    />
  );

  if (dndContextOverride) {
    return tree;
  }

  return (
    <DndContext
      autoScroll
      onDragCancel={onDragCancel}
      onDragEnd={onDragEnd}
      onDragMove={onDragMove}
      onDragStart={onDragStart}
      sensors={sensors}
    >
      {tree}
      <DragPreviewOverlay dragPreview={dragPreview} mergedProps={rest as PropsWithDefault} />
    </DndContext>
  );
});

ReactSortableTreeWithSensors.displayName = 'SortableTreeNewInner';

/**
 * Equivalent of the react-dnd `SortableTreeWithoutDndContext` export.
 *
 * In dnd-kit terms, this renders the tree without instantiating its own
 * `DndContext`, so it can participate in an external `DndContext` provided
 * higher up in the tree.
 */
export const SortableTreeWithoutDndContext = React.forwardRef<
  ReactSortableTreeRef,
  ReactSortableTreeProps
>((props, ref) => {
  const treeRef = React.useRef<ReactSortableTreeRef | null>(null);

  React.useImperativeHandle<ReactSortableTreeRef | null, ReactSortableTreeRef | null>(
    ref,
    () => treeRef.current,
  );

  return (
    <>
      <DndMonitorBridge mergedProps={props as PropsWithDefault} treeRef={treeRef} />
      <ReactSortableTree
        {...(props as PropsWithDefault)}
        ref={(instance) => {
          treeRef.current = instance;
        }}
      />
    </>
  );
});

const DndMonitorBridge = ({
  mergedProps,
  treeRef,
}: {
  mergedProps: PropsWithDefault;
  treeRef: React.MutableRefObject<ReactSortableTreeRef | null>;
}) => {
  const [dragPreview, setDragPreview] = React.useState<DragPreviewState>(null);

  useDndMonitor({
    onDragCancel: (event) => {
      treeRef.current?.handleDragCancel(event);
      setDragPreview(null);
    },
    onDragEnd: (event) => {
      treeRef.current?.handleDragEnd(event);
      setDragPreview(null);
    },
    onDragMove: (event) => treeRef.current?.handleDragMove(event),
    onDragStart: (event) => {
      treeRef.current?.handleDragStart(event);
      if (treeRef.current) {
        setDragPreview(extractDragPreview(event, treeRef.current.dndType));
      }
    },
  });

  return <DragPreviewOverlay dragPreview={dragPreview} mergedProps={mergedProps} />;
};

export const SortableTree = React.forwardRef<ReactSortableTreeRef, ReactSortableTreeProps>(
  (props, ref) => {
    return <ReactSortableTreeWithSensors {...props} ref={ref} />;
  },
);

SortableTree.displayName = 'SortableTreeNew';
