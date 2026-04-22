import React from 'react';
import { DndContext, DndProvider, type DndProviderProps } from 'react-dnd';
import {
  HTML5Backend,
  type HTML5BackendContext,
  type HTML5BackendOptions,
} from 'react-dnd-html5-backend';
import isEqual from 'react-fast-compare';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Box } from '@chakra-ui/react';
import clsx from 'clsx';
import { type Unsubscribe } from 'dnd-core';
import { isFunction, isObject, memoize, omit } from 'lodash-es';

import NodeRendererDefault from './node-renderer-default';
import PlaceholderRendererDefault from './placeholder-renderer-default';
import {
  createHorizontalStrength,
  createScrollingComponent,
  createVerticalStrength,
  type ScrollingComponentProps,
} from './scroll-zone';
import TreeNode from './tree-node';
import TreePlaceholder from './tree-placeholder';
import {
  type NodeData,
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
import {
  type DragHoverOptions,
  type DropOptions,
  wrapPlaceholder,
  type WrapProps,
  wrapSource,
  wrapTarget,
} from './utils/dnd-manager';
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
  scrollZoneVirtualList: React.ComponentType<ScrollingComponentProps>;
  vStrength: ReturnType<typeof createVerticalStrength>;
  hStrength: ReturnType<typeof createHorizontalStrength>;
  clearMonitorSubscription?: Unsubscribe;

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

      // props that need to be used in gDSFP or static functions will be stored here
      instanceProps: {
        treeData: [],
        ignoreOneTreeUpdate: false,
        searchQuery: undefined,
        searchFocusOffset: undefined,
      },
    };

    this.listRef = props.virtuosoRef || React.createRef<VirtuosoHandle>();
    this.listProps = props.virtuosoProps || {};

    const { dndType, nodeContentRenderer, slideRegionSize, treeNodeRenderer } = mergeTheme(props);

    // Wrapping classes for use with react-dnd
    this.treeId = `rst__${treeIdCounter}`;
    treeIdCounter += 1;
    this.dndType = dndType || this.treeId;
    this.nodeContentRenderer = wrapSource({
      el: nodeContentRenderer,
      startDrag: this.startDrag,
      endDrag: this.endDrag,
      dndType: this.dndType,
    });
    this.treePlaceholderRenderer = wrapPlaceholder({
      el: TreePlaceholder,
      treeId: this.treeId,
      drop: this.drop,
      dndType: this.dndType,
    });
    this.treeNodeRenderer = wrapTarget({
      el: treeNodeRenderer,
      canNodeHaveChildren: this.canNodeHaveChildren,
      treeId: this.treeId,
      maxDepth: this.props.maxDepth,
      treeRefCanDrop: this.props.canDrop,
      drop: this.drop,
      dragHover: this.dragHover,
      dndType: this.dndType,
    });

    // Prepare scroll-on-drag options for this list
    this.scrollZoneVirtualList = createScrollingComponent(
      React.forwardRef<HTMLElement | Window | null, ScrollingComponentProps>((props, ref) => {
        const otherProps = omit(props, ['dragDropManager', 'rowHeight']);
        return (
          <Virtuoso
            ref={this.listRef}
            scrollerRef={(scrollContainer) => {
              if (isFunction(ref)) {
                ref(scrollContainer);
              } else if (isObject(ref)) {
                ref.current = scrollContainer;
              }
            }}
            {...otherProps}
          />
        );
      }),
    );
    this.vStrength = createVerticalStrength(slideRegionSize);
    this.hStrength = createHorizontalStrength(slideRegionSize);
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

    // Skip search if no conditions are specified
    if (!searchQuery) {
      if (searchFinishCallback) {
        searchFinishCallback([]);
      }
      newState.searchMatches = [];
      return newState;
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

    // Update the tree with data leaving all paths leading to matching nodes open
    if (expand) {
      newState.instanceProps = { ...instanceProps };
      newState.instanceProps.ignoreOneTreeUpdate = true; // Prevents infinite loop
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

  static getDerivedStateFromProps(nextProps: PropsWithDefault, prevState: State) {
    const { instanceProps } = prevState;
    const newState: Partial<State> = {};
    const newInstanceProps = { ...instanceProps };

    const isTreeDataEqual = isEqual(instanceProps.treeData, nextProps.treeData);

    // make sure we have the most recent version of treeData
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

    // Hook into react-dnd state changes to detect when the drag ends
    // TODO: This is very brittle, so it needs to be replaced if react-dnd
    // offers a more official way to detect when a drag ends
    this.clearMonitorSubscription = this.props.dragDropManager
      ?.getMonitor()
      .subscribeToStateChange(this.handleDndMonitorChange);
  }

  // listen to dragging
  componentDidUpdate(_: Readonly<PropsWithDefault>, prevState: Readonly<State>) {
    // if it is not the same then call the onDragStateChanged
    if (this.state.dragging !== prevState.dragging && this.props.onDragStateChanged) {
      this.props.onDragStateChanged({
        isDragging: this.state.dragging,
        draggedNode: this.state.draggedNode,
      });
    }
  }

  componentWillUnmount() {
    this.clearMonitorSubscription?.();
  }

  handleDndMonitorChange = () => {
    const monitor = this.props.dragDropManager?.getMonitor();
    // If the drag ends and the tree is still in a mid-drag state,
    // it means that the drag was canceled or the dragSource dropped
    // elsewhere, and we should reset the state of this tree
    if (monitor && !monitor.isDragging() && this.state.draggingTreeData) {
      requestAnimationFrame(() => {
        this.endDrag();
      });
    }
  };

  // Get flat data
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

  startDrag = ({ path }: WrapProps) => {
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
    // Ignore this hover if it is at the same position as the last hover
    if (
      this.state.draggedDepth === draggedDepth &&
      this.state.draggedMinimumTreeIndex === draggedMinimumTreeIndex
    ) {
      return;
    }

    this.setState(({ draggingTreeData, instanceProps }) => {
      // Fall back to the tree data if something is being dragged in from
      //  an external element
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
        // reset the scroll focus so it doesn't jump back
        // to a search result while dragging
        searchFocusTreeIndex: undefined,
        dragging: true,
      };
    });
  };

  endDrag = (dropResult?: WrapProps | null) => {
    const { instanceProps } = this.state;

    // Drop was cancelled
    if (!dropResult) {
      this.setState({
        draggingTreeData: undefined,
        draggedNode: undefined,
        draggedMinimumTreeIndex: undefined,
        draggedDepth: undefined,
        dragging: false,
      });
    } else if (dropResult.treeId !== this.treeId) {
      // The node was dropped in an external drop target or tree
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

      // If copying is enabled, a drop outside leaves behind a copy in the
      //  source tree
      if (shouldCopy) {
        treeData = changeNodeAtPath({
          treeData: instanceProps.treeData, // use treeData unaltered by the drag operation
          path,
          newNode: ({ node: copyNode }) => ({ ...copyNode }), // create a shallow copy of the node
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
      dragDropManager,
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

      const ScrollZoneVirtualList = this.scrollZoneVirtualList;
      const memoizedRenderRow = memoize(this.renderRow);
      // Render list with react-virtuoso
      list = (
        <ScrollZoneVirtualList
          className="rst__virtualScrollOverride"
          data={rows}
          dragDropManager={dragDropManager}
          horizontalStrength={this.hStrength}
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
          verticalStrength={this.vStrength}
          {...this.listProps}
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

export const SortableTreeWithoutDndContext = React.forwardRef<
  ReactSortableTreeRef,
  ReactSortableTreeProps
>((props, ref) => {
  return (
    <DndContext.Consumer>
      {({ dragDropManager }) => (
        <ReactSortableTree {...props} ref={ref} dragDropManager={dragDropManager} />
      )}
    </DndContext.Consumer>
  );
});

const SafeDndProvider = (
  props: DndProviderProps<HTML5BackendContext, HTML5BackendOptions> & {
    children: React.ReactNode;
  },
) => {
  return <DndProvider {...props} />;
};

export const SortableTree = React.forwardRef<ReactSortableTreeRef, ReactSortableTreeProps>(
  (props, ref) => {
    const { debugMode, ...rest } = props;
    return (
      <SafeDndProvider backend={HTML5Backend} debugMode={debugMode}>
        <SortableTreeWithoutDndContext ref={ref} {...rest} />
      </SafeDndProvider>
    );
  },
);
