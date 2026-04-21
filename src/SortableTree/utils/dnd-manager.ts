import {
  DragSource as dragSource,
  type DragSourceConnector,
  type DragSourceMonitor,
  DropTarget as dropTarget,
  type DropTargetConnector,
  type DropTargetMonitor,
} from 'react-dnd';

import { getDepth } from './tree-data-utils';
import { type OmitStrict } from '../../utility-types';
import {
  type FlatDataItem,
  type InjectedTreeProps,
  type NodeRendererDefaultProps,
  type ReactSortableTreeProps,
  type TreeIndex,
  type TreeItem,
  type TreeNode,
  type TreePath,
  type TreePlaceholderProps,
  type TreeRendererProps,
} from '../types';

let rafId = 0;

export interface WrapProps extends TreeNode, TreePath, TreeIndex {
  parentNode?: TreeItem;
  treeId: string;
}

export interface DropOptions extends OmitStrict<WrapProps, 'parentNode'> {
  depth: number;
  minimumTreeIndex: number;
}

interface DropTargetProps extends TreeNode, TreePath {
  children: React.ReactElement;
  getPrevRow: () => FlatDataItem;
  listIndex: number;
  lowerSiblingCounts: number[];
  rowDirection: ReactSortableTreeProps['rowDirection'];
  rowHeight: number;
  scaffoldBlockPxWidth: number;
  swapDepth: number;
  swapFrom: number;
  swapLength: number;
  treeId: string;
  treeIndex: number;
}

const nodeDragSourcePropInjection = (connect: DragSourceConnector, monitor: DragSourceMonitor) => {
  return {
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging(),
    didDrop: monitor.didDrop(),
  };
};

export const wrapSource = (options: {
  dndType: string;
  el: React.ComponentType<NodeRendererDefaultProps>;
  endDrag: (props: WrapProps | null) => void;
  startDrag: (props: WrapProps) => void;
}) => {
  const { dndType, el, endDrag, startDrag } = options;

  const nodeDragSource = {
    beginDrag: (props: WrapProps) => {
      startDrag(props);

      return {
        node: props.node,
        parentNode: props.parentNode,
        path: props.path,
        treeIndex: props.treeIndex,
        treeId: props.treeId,
      };
    },

    endDrag: (_: WrapProps, monitor: DragSourceMonitor<WrapProps>) => {
      endDrag(monitor.getDropResult());
    },

    isDragging: (props: WrapProps, monitor: DragSourceMonitor<WrapProps>) => {
      const dropTargetNode = monitor.getItem().node;
      const draggedNode = props.node;

      return draggedNode === dropTargetNode;
    },
  };

  return dragSource(dndType, nodeDragSource, nodeDragSourcePropInjection)(el);
};

const propInjection = (connect: DropTargetConnector, monitor: DropTargetMonitor<WrapProps>) => {
  const dragged = monitor.getItem();
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
    draggedNode: dragged ? dragged.node : undefined,
  };
};

export const wrapPlaceholder = (options: {
  dndType: string;
  drop: (result: DropOptions) => void;
  el: React.ComponentType<TreePlaceholderProps & InjectedTreeProps>;
  treeId: string;
}) => {
  const { dndType, drop, el, treeId } = options;

  const placeholderDropTarget = {
    drop: (_: WrapProps, monitor: DropTargetMonitor<WrapProps>) => {
      const { node, path, treeIndex } = monitor.getItem();
      const result: DropOptions = {
        node,
        path,
        treeIndex,
        treeId,
        minimumTreeIndex: 0,
        depth: 0,
      };

      drop(result);

      return result;
    },
  };

  return dropTarget(dndType, placeholderDropTarget, propInjection)(el);
};

export const getDropTargetDepth = (
  rowAbove: FlatDataItem | undefined,
  dropTargetPropsPathLength: number,
  canNodeHaveChildren: (node: TreeItem) => boolean,
): number => {
  let dropTargetDepth = 0;
  if (rowAbove) {
    const { node } = rowAbove;
    let { path } = rowAbove;
    const aboveNodeCannotHaveChildren = !canNodeHaveChildren(node);
    if (aboveNodeCannotHaveChildren) {
      path = path.slice(0, -1);
    }
    dropTargetDepth = Math.min(path.length, dropTargetPropsPathLength);
  }
  return dropTargetDepth;
};

export const calculateTargetDepth = (options: {
  direction?: 1 | -1;
  dragOffset: number;
  dragSourceInitialDepth: number;
  draggedNode: TreeItem;
  dropTargetDepth: number;
  maxDepth?: number;
  scaffoldBlockPxWidth: number;
}): number => {
  const {
    direction = 1,
    draggedNode,
    dragOffset,
    dragSourceInitialDepth,
    dropTargetDepth,
    maxDepth,
    scaffoldBlockPxWidth,
  } = options;

  const blocksOffset = Math.round((direction * dragOffset) / scaffoldBlockPxWidth);
  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1),
  );

  if (maxDepth !== undefined) {
    const draggedChildDepth = getDepth(draggedNode);
    targetDepth = Math.max(0, Math.min(targetDepth, maxDepth - draggedChildDepth - 1));
  }

  return targetDepth;
};

const getTargetDepth = (options: {
  canNodeHaveChildren: Required<ReactSortableTreeProps>['canNodeHaveChildren'];
  component?: null | { node: Element };
  dropTargetProps: DropTargetProps;
  maxDepth: ReactSortableTreeProps['maxDepth'];
  monitor: DropTargetMonitor<WrapProps>;
  treeId: string;
}) => {
  const { canNodeHaveChildren, component, dropTargetProps, maxDepth, monitor, treeId } = options;

  const dropTargetDepth = getDropTargetDepth(
    dropTargetProps.getPrevRow(),
    dropTargetProps.path.length,
    canNodeHaveChildren,
  );

  let blocksOffset = 0;
  let dragSourceInitialDepth = (monitor.getItem().path || []).length;

  // When adding node from external source
  if (monitor.getItem().treeId === treeId) {
    // handle row direction support
    const direction = dropTargetProps.rowDirection === 'rtl' ? -1 : 1;

    const differenceFromInitialOffset = monitor.getDifferenceFromInitialOffset();
    if (differenceFromInitialOffset !== null) {
      blocksOffset = Math.round(
        (direction * differenceFromInitialOffset.x) / dropTargetProps.scaffoldBlockPxWidth,
      );
    }
  } else {
    // Ignore the tree depth of the source, if it had any to begin with
    dragSourceInitialDepth = 0;

    if (component) {
      const relativePosition = component.node.getBoundingClientRect();
      const sourceClientOffset = monitor.getSourceClientOffset();
      if (sourceClientOffset !== null) {
        blocksOffset = Math.round(
          (sourceClientOffset.x - relativePosition.left) / dropTargetProps.scaffoldBlockPxWidth,
        );
      }
    } else {
      blocksOffset = dropTargetProps.path.length;
    }
  }

  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1),
  );

  // If a maxDepth is defined, constrain the target depth
  if (maxDepth !== undefined) {
    const draggedNode = monitor.getItem().node;
    const draggedChildDepth = getDepth(draggedNode);

    targetDepth = Math.max(0, Math.min(targetDepth, maxDepth - draggedChildDepth - 1));
  }

  return targetDepth;
};

export const canDropLogic = (options: {
  draggedNode: TreeItem;
  nextParent: TreeItem | undefined;
  nextPath: number[];
  nextTreeIndex: number;
  prevParent: TreeItem | undefined;
  prevPath: number[];
  prevTreeIndex: number;
  rowAbove: FlatDataItem | undefined;
  targetDepth: number;
  treeRefCanDrop?: ReactSortableTreeProps['canDrop'];
}): boolean => {
  const {
    draggedNode,
    nextParent,
    nextPath,
    nextTreeIndex,
    prevParent,
    prevPath,
    prevTreeIndex,
    rowAbove,
    targetDepth,
    treeRefCanDrop,
  } = options;

  const abovePath = rowAbove ? rowAbove.path : [];
  const aboveNode = rowAbove ? rowAbove.node : {};

  // Cannot drop if we're adding to the children of the row above and
  // the row above is a function
  if (targetDepth >= abovePath.length && typeof aboveNode.children === 'function') {
    return false;
  }

  if (typeof treeRefCanDrop === 'function') {
    return treeRefCanDrop({
      node: draggedNode,
      prevPath,
      prevParent,
      prevTreeIndex,
      nextPath,
      nextParent: nextParent as TreeItem,
      nextTreeIndex,
    });
  }

  return true;
};

const canDrop = (options: {
  canNodeHaveChildren: Required<ReactSortableTreeProps>['canNodeHaveChildren'];
  dropTargetProps: DropTargetProps;
  maxDepth: ReactSortableTreeProps['maxDepth'];
  monitor: DropTargetMonitor<WrapProps>;
  treeId: string;
  treeRefCanDrop: ReactSortableTreeProps['canDrop'];
}): boolean => {
  const { canNodeHaveChildren, dropTargetProps, maxDepth, monitor, treeId, treeRefCanDrop } =
    options;

  if (!monitor.isOver()) {
    return false;
  }

  const rowAbove = dropTargetProps.getPrevRow();
  const targetDepth = getTargetDepth({
    dropTargetProps,
    monitor,
    component: undefined,
    canNodeHaveChildren,
    treeId,
    maxDepth,
  });

  const { node, parentNode, path, treeIndex } = monitor.getItem();

  return canDropLogic({
    targetDepth,
    rowAbove,
    treeRefCanDrop,
    draggedNode: node,
    prevPath: path,
    prevParent: parentNode,
    prevTreeIndex: treeIndex,
    nextPath: dropTargetProps.children.props.path,
    nextParent: dropTargetProps.children.props.parentNode,
    nextTreeIndex: dropTargetProps.children.props.treeIndex,
  });
};

export interface DragHoverOptions extends TreeNode, TreePath {
  depth: number;
  minimumTreeIndex: number;
}

export const wrapTarget = (options: {
  canNodeHaveChildren: Required<ReactSortableTreeProps>['canNodeHaveChildren'];
  dndType: string;
  dragHover: (options: DragHoverOptions) => void;
  drop: (options: DropOptions) => void;
  el: React.ComponentType<TreeRendererProps & InjectedTreeProps>;
  maxDepth: ReactSortableTreeProps['maxDepth'];
  treeId: string;
  treeRefCanDrop: ReactSortableTreeProps['canDrop'];
}) => {
  const { canNodeHaveChildren, dndType, dragHover, drop, el, maxDepth, treeId, treeRefCanDrop } =
    options;

  const nodeDropTarget = {
    drop: (
      dropTargetProps: DropTargetProps,
      monitor: DropTargetMonitor<WrapProps>,
      component?: null | { node: Element },
    ) => {
      const result = {
        node: monitor.getItem().node,
        path: monitor.getItem().path,
        treeIndex: monitor.getItem().treeIndex,
        treeId,
        minimumTreeIndex: dropTargetProps.treeIndex,
        depth: getTargetDepth({
          dropTargetProps,
          monitor,
          component,
          canNodeHaveChildren,
          treeId,
          maxDepth,
        }),
      };

      drop(result);

      return result;
    },

    hover: (
      dropTargetProps: DropTargetProps,
      monitor: DropTargetMonitor<WrapProps>,
      component?: null | { node: Element },
    ) => {
      const targetDepth = getTargetDepth({
        dropTargetProps,
        monitor,
        component,
        canNodeHaveChildren,
        treeId,
        maxDepth,
      });
      const draggedNode = monitor.getItem().node;
      const needsRedraw =
        // Redraw if hovered above different nodes
        dropTargetProps.node !== draggedNode ||
        // Or hovered above the same node but at a different depth
        targetDepth !== dropTargetProps.path.length - 1;

      if (!needsRedraw) {
        return;
      }

      // throttle `dragHover` work to available animation frames
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const item = monitor.getItem();
        // skip if drag already ended before the animation frame
        if (!item || !monitor.isOver()) {
          return;
        }
        dragHover({
          node: draggedNode,
          path: item.path,
          minimumTreeIndex: dropTargetProps.listIndex,
          depth: targetDepth,
        });
      });
    },

    canDrop: (dropTargetProps: DropTargetProps, monitor: DropTargetMonitor<WrapProps>) => {
      return canDrop({
        dropTargetProps,
        monitor,
        canNodeHaveChildren,
        treeId,
        maxDepth,
        treeRefCanDrop,
      });
    },
  };

  return dropTarget(dndType, nodeDropTarget, propInjection)(el);
};
