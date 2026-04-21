import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import isEqual from 'react-fast-compare';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Box } from '@chakra-ui/react';
import {
  closestCenter,
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { isFunction, isObject, memoize, omit } from 'lodash-es';

import NodeRendererDefault from './node-renderer-default';
import PlaceholderRendererDefault from './placeholder-renderer-default';
import TreeNode from './tree-node';
import TreePlaceholder from './tree-placeholder';
import {
  type InjectedNodeRendererProps,
  type InjectedTreeProps,
  type NodeData,
  type NodeRendererProps,
  type PlaceholderRendererProps,
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
  insertNode,
  removeNode,
  toggleExpandedForAll,
  walk,
} from './utils/tree-data-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface InstanceProps {
  ignoreOneTreeUpdate: boolean;
  searchFocusOffset?: number;
  searchQuery?: string;
  treeData: TreeItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let treeIdCounter = 1;

const defaultProps: OmitStrict<PropsWithDefault, 'treeData' | 'onChange'> = {
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

// ─── Static-like helpers (outside component) ─────────────────────────────────

function performSearch(
  props: PropsWithDefault,
  instanceProps: InstanceProps,
  seekIndex: boolean,
  expand: boolean,
  singleSearch: boolean,
): {
  expandedTreeData?: TreeItem[];
  newInstanceProps?: Partial<InstanceProps>;
  searchFocusTreeIndex?: number;
  searchMatches: SearchFinishCallbackParams;
} {
  const {
    getNodeKey,
    onlyExpandSearchedNodes,
    searchFinishCallback,
    searchFocusOffset,
    searchMethod,
    searchQuery,
  } = props;

  // Skip search if no conditions are specified
  if (!searchQuery) {
    if (searchFinishCallback) {
      searchFinishCallback([]);
    }
    return { searchMatches: [] };
  }

  // if onlyExpandSearchedNodes collapse the tree and search
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

  if (searchFinishCallback) {
    searchFinishCallback(searchMatches);
  }

  let searchFocusTreeIndex: number | undefined;
  if (seekIndex && searchFocusOffset !== undefined && searchFocusOffset < searchMatches.length) {
    searchFocusTreeIndex = searchMatches[searchFocusOffset].treeIndex;
  }

  return {
    searchMatches,
    searchFocusTreeIndex,
    expandedTreeData: expand ? expandedTreeData : undefined,
  };
}

function loadLazyChildren(props: PropsWithDefault, instanceProps: InstanceProps) {
  walk({
    treeData: instanceProps.treeData,
    getNodeKey: props.getNodeKey,
    callback: ({ lowerSiblingCounts, node, path, treeIndex }) => {
      // If the node has children defined by a function, and is either expanded
      //  or set to load even before expansion, run the function.
      if (
        node.children &&
        typeof node.children === 'function' &&
        (node.expanded || props.loadCollapsedLazyChildren)
      ) {
        // Call the children fetching function
        node.children({
          node,
          path,
          lowerSiblingCounts,
          treeIndex,

          // Provide a helper to append the new data when it is received
          done: (childrenArray) => {
            const treeData = changeNodeAtPath({
              treeData: instanceProps.treeData,
              path,
              newNode: ({ node: oldNode }) =>
                // Only replace the old node if it's the one we set off to find children
                //  for in the first place
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

// ─── Component ───────────────────────────────────────────────────────────────

const ReactSortableTreeFC = React.forwardRef<ReactSortableTreeRef, ReactSortableTreeProps>(
  (rawProps, _ref) => {
    // Apply defaults
    const props = { ...defaultProps, ...rawProps } as PropsWithDefault;

    // ── State (mirrors class State) ────────────────────────────────────────
    const [dragging, setDragging] = useState(false);
    const [draggedNode, setDraggedNode] = useState<TreeItem | undefined>(undefined);
    const [draggedDepth, setDraggedDepth] = useState<number | undefined>(undefined);
    const [draggedMinimumTreeIndex, setDraggedMinimumTreeIndex] = useState<number | undefined>(
      undefined,
    );
    const [draggingTreeData, setDraggingTreeData] = useState<TreeItem[] | undefined>(undefined);
    const [searchMatches, setSearchMatches] = useState<SearchFinishCallbackParams>([]);
    const [searchFocusTreeIndex, setSearchFocusTreeIndex] = useState<number | undefined>(undefined);

    // ── Refs ───────────────────────────────────────────────────────────────
    const instancePropsRef = useRef<InstanceProps>({
      treeData: [],
      ignoreOneTreeUpdate: false,
      searchQuery: undefined,
      searchFocusOffset: undefined,
    });

    const listRef = props.virtuosoRef || useRef<VirtuosoHandle>(null);
    const listProps = props.virtuosoProps || {};
    const isInitialMount = useRef(true);
    const prevDragging = useRef(false);

    // ── Stable IDs ─────────────────────────────────────────────────────────
    const treeId = useRef(`rst__${treeIdCounter++}`).current;
    const dndType = useRef(props.dndType || treeId).current;

    // ── Theme-merged values ────────────────────────────────────────────────
    const merged = mergeTheme(props);

    // ── getRows helper ─────────────────────────────────────────────────────
    const getRows = useCallback(
      (options: { ignoreCollapsed?: boolean; treeData: TreeItem[] }) => {
        const { ignoreCollapsed = true, treeData } = options;
        return memoizedGetFlatDataFromTree({
          ignoreCollapsed,
          getNodeKey: props.getNodeKey,
          treeData,
        });
      },
      [props.getNodeKey],
    );

    // ── canNodeHaveChildren ────────────────────────────────────────────────
    const canNodeHaveChildrenFn = useCallback(
      (node: TreeItem) => {
        if (props.canNodeHaveChildren) {
          return props.canNodeHaveChildren(node);
        }
        return true;
      },
      [props.canNodeHaveChildren],
    );

    // ── toggleChildrenVisibility ────────────────────────────────────────────
    const toggleChildrenVisibility = useCallback(
      ({ node: targetNode, path }: NodeData) => {
        const treeData = changeNodeAtPath({
          treeData: instancePropsRef.current.treeData,
          path,
          newNode: ({ node }) => ({ ...node, expanded: !node.expanded }),
          getNodeKey: props.getNodeKey,
        });

        props.onChange(treeData);
        props.onVisibilityToggle({
          treeData,
          node: targetNode,
          expanded: !targetNode.expanded,
          path,
        });
      },
      [props.onChange, props.onVisibilityToggle, props.getNodeKey],
    );

    // ── Drop handler ───────────────────────────────────────────────────────
    const moveNode = useCallback(
      (dropResult: {
        depth: number;
        minimumTreeIndex: number;
        node: TreeItem;
        path: number[];
        treeId: string;
        treeIndex: number;
      }) => {
        const {
          depth,
          minimumTreeIndex,
          node,
          path: prevPath,
          treeIndex: prevTreeIndex,
        } = dropResult;
        const {
          parentNode: nextParentNode,
          path,
          treeData,
          treeIndex,
        } = insertNode({
          treeData: draggingTreeData,
          newNode: node,
          depth,
          minimumTreeIndex,
          expandParent: true,
          getNodeKey: props.getNodeKey,
        });

        props.onChange(treeData);
        props.onMoveNode({
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
      },
      [draggingTreeData, props.onChange, props.onMoveNode, props.getNodeKey],
    );

    const drop = useCallback(
      (dropResult: {
        depth: number;
        minimumTreeIndex: number;
        node: TreeItem;
        path: number[];
        treeId: string;
        treeIndex: number;
      }) => {
        moveNode(dropResult);
      },
      [moveNode],
    );

    // ── startDrag ──────────────────────────────────────────────────────────
    const startDrag = useCallback(
      ({ path }: { path: number[] }) => {
        const {
          node: removedNode,
          treeData: newDraggingTreeData,
          treeIndex: removedTreeIndex,
        } = removeNode({
          treeData: instancePropsRef.current.treeData,
          path,
          getNodeKey: props.getNodeKey,
        });

        setDraggingTreeData(newDraggingTreeData);
        setDraggedNode(removedNode);
        setDraggedDepth(path.length - 1);
        setDraggedMinimumTreeIndex(removedTreeIndex);
        setDragging(true);
      },
      [props.getNodeKey],
    );

    // ── dragHover ──────────────────────────────────────────────────────────
    const dragHover = useCallback(
      ({
        depth: newDraggedDepth,
        minimumTreeIndex: newDraggedMinimumTreeIndex,
        node: hoveredDraggedNode,
      }: {
        depth: number;
        minimumTreeIndex: number;
        node: TreeItem;
        path: number[];
      }) => {
        // Use functional updates or refs to avoid stale closure
        setDraggedDepth((prevDepth) => {
          setDraggedMinimumTreeIndex((prevMinTreeIdx) => {
            if (prevDepth === newDraggedDepth && prevMinTreeIdx === newDraggedMinimumTreeIndex) {
              return prevMinTreeIdx;
            }

            setDraggingTreeData((prevDraggingTreeData) => {
              const newDraggingTreeData = prevDraggingTreeData || instancePropsRef.current.treeData;

              const addedResult = memoizedInsertNode({
                treeData: newDraggingTreeData,
                newNode: hoveredDraggedNode,
                depth: newDraggedDepth,
                minimumTreeIndex: newDraggedMinimumTreeIndex,
                expandParent: true,
                getNodeKey: props.getNodeKey,
              });

              const rows = getRows({ treeData: addedResult.treeData });
              const expandedParentPath = rows[addedResult.treeIndex].path;

              return changeNodeAtPath({
                treeData: newDraggingTreeData,
                path: expandedParentPath.slice(0, -1),
                newNode: ({ node }) => ({ ...node, expanded: true }),
                getNodeKey: props.getNodeKey,
              });
            });

            setDraggedNode(hoveredDraggedNode);
            setSearchFocusTreeIndex(undefined);
            setDragging(true);

            return newDraggedMinimumTreeIndex;
          });
          return newDraggedDepth;
        });
      },
      [props.getNodeKey, getRows],
    );

    // ── endDrag ────────────────────────────────────────────────────────────
    const endDrag = useCallback(
      (
        dropResult?: {
          node: TreeItem;
          path: number[];
          treeId: string;
          treeIndex: number;
        } | null,
      ) => {
        if (!dropResult) {
          // Drop was cancelled
          setDraggingTreeData(undefined);
          setDraggedNode(undefined);
          setDraggedMinimumTreeIndex(undefined);
          setDraggedDepth(undefined);
          setDragging(false);
        } else if (dropResult.treeId !== treeId) {
          // The node was dropped in an external drop target or tree
          const { node, path, treeIndex } = dropResult;
          let shouldCopy = props.shouldCopyOnOutsideDrop;
          if (typeof shouldCopy === 'function') {
            shouldCopy = shouldCopy({
              node,
              prevTreeIndex: treeIndex,
              prevPath: path,
            });
          }

          let treeData = draggingTreeData || instancePropsRef.current.treeData;

          // If copying is enabled, a drop outside leaves behind a copy in the
          //  source tree
          if (shouldCopy) {
            treeData = changeNodeAtPath({
              treeData: instancePropsRef.current.treeData,
              path,
              newNode: ({ node: copyNode }) => ({ ...copyNode }),
              getNodeKey: props.getNodeKey,
            });
          }

          props.onChange(treeData);
          props.onMoveNode({
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
      },
      [
        treeId,
        draggingTreeData,
        props.shouldCopyOnOutsideDrop,
        props.onChange,
        props.onMoveNode,
        props.getNodeKey,
      ],
    );

    // ── @dnd-kit Handlers ──────────────────────────────────────────────────
    const handleDragStart = useCallback(
      (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current) {
          startDrag({ path: active.data.current.path });
        }
      },
      [startDrag],
    );

    const handleDragOver = useCallback(
      (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || !active.data.current || !over.data.current) return;

        const draggedNode = active.data.current.node;
        const overPath = over.data.current.path;
        const overTreeIndex = over.data.current.treeIndex;

        // Basic mapping for Phase 3 (depth calculation will be refined later)
        const newDepth = overPath.length > 0 ? overPath.length - 1 : 0;

        dragHover({
          depth: newDepth,
          minimumTreeIndex: overTreeIndex,
          node: draggedNode,
          path: active.data.current.path,
        });
      },
      [dragHover],
    );

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || !active.data.current || !over.data.current) {
          endDrag(null);
          return;
        }

        const draggedNodeObj = active.data.current.node;
        const overPath = over.data.current.path;
        const overTreeIndex = over.data.current.treeIndex;

        // Use the depth and index we calculated during hover
        const finalDepth =
          draggedDepth !== undefined ? draggedDepth : overPath.length > 0 ? overPath.length - 1 : 0;
        const finalTreeIndex =
          draggedMinimumTreeIndex !== undefined ? draggedMinimumTreeIndex : overTreeIndex;

        const dropResult = {
          depth: finalDepth,
          minimumTreeIndex: finalTreeIndex,
          node: draggedNodeObj,
          path: active.data.current.path,
          treeId,
          treeIndex: overTreeIndex,
        };

        drop(dropResult);
        endDrag(dropResult);
      },
      [draggedDepth, draggedMinimumTreeIndex, drop, endDrag, treeId],
    );

    const handleDragCancel = useCallback(
      (_event: DragCancelEvent) => {
        endDrag(null);
      },
      [endDrag],
    );

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(TouchSensor),
      useSensor(KeyboardSensor),
    );

    // ── getDerivedStateFromProps equivalent ─────────────────────────────────
    // Runs synchronously on every render to mirror gDSFP behavior
    const instanceProps = instancePropsRef.current;
    const isTreeDataEqual = isEqual(instanceProps.treeData, props.treeData);

    // Always keep instanceProps.treeData in sync
    instanceProps.treeData = props.treeData;

    // We use a ref to batch state changes from the "derived state" logic
    // and apply them via useEffect to avoid setState-during-render issues.
    const pendingDerivedState = useRef<{
      resetDrag?: boolean;
      searchFocusTreeIndex?: number;
      searchMatches?: SearchFinishCallbackParams;
    } | null>(null);

    if (!isTreeDataEqual) {
      if (instanceProps.ignoreOneTreeUpdate) {
        instanceProps.ignoreOneTreeUpdate = false;
      } else {
        loadLazyChildren(props, instanceProps);
        const searchResult = performSearch(props, instanceProps, false, false, false);
        pendingDerivedState.current = {
          searchMatches: searchResult.searchMatches,
          searchFocusTreeIndex: undefined,
          resetDrag: true,
        };
      }
    } else if (!isEqual(instanceProps.searchQuery, props.searchQuery)) {
      const searchResult = performSearch(props, instanceProps, true, true, false);
      pendingDerivedState.current = {
        searchMatches: searchResult.searchMatches,
        searchFocusTreeIndex: searchResult.searchFocusTreeIndex,
      };
      if (searchResult.expandedTreeData) {
        instanceProps.ignoreOneTreeUpdate = true;
        props.onChange(searchResult.expandedTreeData);
      }
    } else if (instanceProps.searchFocusOffset !== props.searchFocusOffset) {
      const searchResult = performSearch(props, instanceProps, true, true, true);
      pendingDerivedState.current = {
        searchMatches: searchResult.searchMatches,
        searchFocusTreeIndex: searchResult.searchFocusTreeIndex,
      };
      if (searchResult.expandedTreeData) {
        instanceProps.ignoreOneTreeUpdate = true;
        props.onChange(searchResult.expandedTreeData);
      }
    }

    instanceProps.searchQuery = props.searchQuery;
    instanceProps.searchFocusOffset = props.searchFocusOffset;

    // Apply pending derived state
    useEffect(() => {
      const pending = pendingDerivedState.current;
      if (pending) {
        pendingDerivedState.current = null;
        if (pending.searchMatches !== undefined) {
          setSearchMatches(pending.searchMatches);
        }
        if (pending.searchFocusTreeIndex !== undefined) {
          setSearchFocusTreeIndex(pending.searchFocusTreeIndex);
        } else if (pending.resetDrag) {
          setSearchFocusTreeIndex(undefined);
        }
        if (pending.resetDrag) {
          setDraggingTreeData(undefined);
          setDraggedNode(undefined);
          setDraggedMinimumTreeIndex(undefined);
          setDraggedDepth(undefined);
          setDragging(false);
        }
      }
    });

    // ── componentDidMount equivalent ─────────────────────────────────────
    useEffect(() => {
      loadLazyChildren(props, instancePropsRef.current);
      const searchResult = performSearch(props, instancePropsRef.current, true, true, false);
      setSearchMatches(searchResult.searchMatches);
      if (searchResult.searchFocusTreeIndex !== undefined) {
        setSearchFocusTreeIndex(searchResult.searchFocusTreeIndex);
      }
      if (searchResult.expandedTreeData) {
        instancePropsRef.current.ignoreOneTreeUpdate = true;
        props.onChange(searchResult.expandedTreeData);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── onDragStateChanged callback ──────────────────────────────────────
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        prevDragging.current = dragging;
        return;
      }
      if (dragging !== prevDragging.current && props.onDragStateChanged) {
        props.onDragStateChanged({
          isDragging: dragging,
          draggedNode,
        });
      }
      prevDragging.current = dragging;
    }, [dragging, draggedNode, props.onDragStateChanged]);

    // ── renderRow ──────────────────────────────────────────────────────────
    const renderRow = useCallback(
      (
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
        const { getPrevRow, listIndex, matchKeys, style, swapDepth, swapFrom, swapLength } =
          options;
        const {
          canDrag,
          generateNodeProps,
          rowDirection,
          rowHeight,
          scaffoldBlockPxWidth,
          searchFocusOffset,
        } = merged;

        // TODO: Phase 3 will replace these with @dnd-kit wrapped renderers
        const TreeNodeRenderer = merged.treeNodeRenderer;
        const NodeContentRenderer = merged.nodeContentRenderer;

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
          treeId,
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
              toggleChildrenVisibility={toggleChildrenVisibility}
              {...sharedProps}
              {...nodeProps}
            />
          </TreeNodeRenderer>
        );
      },
      [merged, treeId, toggleChildrenVisibility],
    );

    // ── Render ─────────────────────────────────────────────────────────────
    const {
      className,
      'data-testid': dataTestId,
      getNodeKey,
      innerStyle,
      placeholderRenderer,
      rowDirection,
      style,
    } = merged;

    const treeData = draggingTreeData || instanceProps.treeData;
    const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;

    let rows: Row[] = [];
    let swapFrom: number = 0;
    let swapLength: number = 0;
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
      rows = slideRows(getRows({ treeData: addedResult.treeData }), swapFrom, swapTo, swapLength);
    } else {
      rows = getRows({ treeData });
    }

    // Get indices for rows that match the search conditions
    const matchKeys: Record<string, number> = {};
    for (const [i, { path }] of searchMatches.entries()) {
      const key = path.at(-1);
      if (key !== undefined) {
        matchKeys[String(key)] = i;
      }
    }

    // Seek to the focused search result if there is one specified
    if (searchFocusTreeIndex !== undefined) {
      listRef.current?.scrollToIndex({
        index: searchFocusTreeIndex,
        align: 'center',
      });
    }

    let containerStyle = style;
    let list: React.JSX.Element;
    if (rows.length === 0) {
      // TODO: Phase 3 will wrap this with @dnd-kit droppable
      const Placeholder = TreePlaceholder;
      const PlaceholderContent =
        placeholderRenderer as React.ComponentType<PlaceholderRendererProps>;
      list = (
        <Placeholder drop={drop} treeId={treeId}>
          <PlaceholderContent />
        </Placeholder>
      );
    } else {
      containerStyle = { height: '100%', ...containerStyle };

      const memoizedRenderRow = memoize(renderRow);
      // Render list with react-virtuoso
      list = (
        <Virtuoso
          ref={listRef}
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
          {...listProps}
        />
      );
    }

    return (
      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
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
        <DragOverlay dropAnimation={null}>
          {draggedNode ? (
            <Box
              className={clsx('rst__tree', className, rowDirectionClass)}
              css={[
                nodeRendererDefaultStyle,
                placeholderRendererDefaultStyle,
                treeNodeStyle,
                reactSortableTreeStyle,
              ]}
            >
              <div
                className={clsx('rst__node', rowDirectionClass)}
                style={{
                  height:
                    typeof merged.rowHeight === 'function'
                      ? merged.rowHeight(draggedMinimumTreeIndex || 0, draggedNode, [])
                      : merged.rowHeight,
                }}
              >
                <div
                  className="rst__nodeContent"
                  style={{
                    [merged.rowDirection === 'rtl' ? 'right' : 'left']:
                      (draggedDepth || 0) * merged.scaffoldBlockPxWidth,
                  }}
                >
                  <merged.nodeContentRenderer
                    canDrag={false}
                    isDragging
                    isSearchFocus={false}
                    isSearchMatch={false}
                    node={draggedNode}
                    parentNode={null}
                    path={[]}
                    rowDirection={merged.rowDirection}
                    scaffoldBlockPxWidth={merged.scaffoldBlockPxWidth}
                    toggleChildrenVisibility={toggleChildrenVisibility}
                    treeId={treeId}
                    treeIndex={draggedMinimumTreeIndex || 0}
                    {...(merged.generateNodeProps
                      ? merged.generateNodeProps({
                          node: draggedNode,
                          path: [],
                          lowerSiblingCounts: [],
                          treeIndex: draggedMinimumTreeIndex || 0,
                          isSearchMatch: false,
                          isSearchFocus: false,
                        })
                      : {})}
                  />
                </div>
              </div>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  },
);

ReactSortableTreeFC.displayName = 'ReactSortableTree';

// ─── Public API ────────────────────────────────────────────────────────────────

export type ReactSortableTreeRef = {
  // Placeholder for imperative methods (search, loadLazyChildren)
  // Will be implemented in Phase 7 via useImperativeHandle
};

export const SortableTreeWithoutDndContext = ReactSortableTreeFC;

export const SortableTree = ReactSortableTreeFC;
