import { cloneDeep, isArray, isBoolean, isFunction, isNumber, isObject } from 'lodash-es';

import { type Row } from './generic-utils';
import { type Optional } from '../../utility-types';
import {
  type FullTree,
  type GetNewNodeFunction,
  type GetNodeKeyFunction,
  type NodeData,
  type SearchData,
  type TreeIndex,
  type TreeItem,
  type TreeNode,
  type TreePath,
} from '../types';

type CallbackOptions = {
  lowerSiblingCounts: number[];
  node: TreeItem;
  parentNode?: TreeItem;
  path: number[];
  treeIndex: number;
};

type DescendantsOptions = {
  callback: (params: CallbackOptions) => TreeItem | boolean | void;
  currentIndex: number;
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed: boolean;
  isPseudoRoot?: boolean;
  lowerSiblingCounts?: number[];
  node: TreeItem;
  parentNode?: TreeItem;
  path?: number[];
};

type WalkAndMapFunctionParameters = FullTree & {
  callback: (params: CallbackOptions) => TreeItem | boolean | void;
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed?: boolean | undefined;
};

/**
 * Performs a depth-first traversal over all of the node descendants,
 * incrementing currentIndex by 1 for each
 */
const getNodeDataAtTreeIndexOrNextIndex = ({
  currentIndex,
  getNodeKey,
  ignoreCollapsed = true,
  isPseudoRoot = false,
  lowerSiblingCounts = [],
  node,
  path = [],
  targetIndex,
}: {
  currentIndex: number;
  getNodeKey?: GetNodeKeyFunction;
  ignoreCollapsed?: boolean;
  isPseudoRoot?: boolean;
  lowerSiblingCounts?: number[];
  node: TreeItem;
  path?: number[];
  targetIndex: number;
}): {
  lowerSiblingCounts?: number[];
  nextIndex?: number;
  node?: TreeItem;
  path?: number[];
} => {
  // The pseudo-root is not considered in the path
  const selfPath =
    !isPseudoRoot && getNodeKey ? [...path, getNodeKey({ node, treeIndex: currentIndex })] : [];

  // Return target node when found
  if (currentIndex === targetIndex) {
    return {
      node,
      lowerSiblingCounts,
      path: selfPath,
    };
  }

  // Add one and continue for nodes with no children or hidden children
  if (!node?.children || (ignoreCollapsed && node?.expanded !== true)) {
    return { nextIndex: currentIndex + 1 };
  }

  // Iterate over each child and their descendants and return the
  // target node if childIndex reaches the targetIndex
  let childIndex = currentIndex + 1;
  if (!isFunction(node.children)) {
    const childCount = node.children.length;
    for (let i = 0; i < childCount; i += 1) {
      const result = getNodeDataAtTreeIndexOrNextIndex({
        ignoreCollapsed,
        getNodeKey,
        targetIndex,
        node: node.children[i],
        currentIndex: childIndex,
        lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
        path: selfPath,
      });

      if (result.node) {
        return result;
      }

      if (isNumber(result.nextIndex)) {
        childIndex = result.nextIndex;
      }
    }
  }

  // If the target node is not found, return the farthest traversed index
  return { nextIndex: childIndex };
};

export const getDescendantCount = ({
  ignoreCollapsed = true,
  node,
}: TreeNode & { ignoreCollapsed?: boolean | undefined }): number => {
  const result = getNodeDataAtTreeIndexOrNextIndex({
    ignoreCollapsed,
    node,
    currentIndex: 0,
    targetIndex: -1,
  });

  return result.nextIndex !== undefined ? result.nextIndex - 1 : 0;
};

const walkDescendants = (options: DescendantsOptions): number | boolean => {
  const {
    callback,
    currentIndex,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot = false,
    lowerSiblingCounts = [],
    node,
    parentNode = undefined,
    path = [],
  } = options;

  // The pseudo-root is not considered in the path
  const selfPath = isPseudoRoot ? [] : [...path, getNodeKey({ node, treeIndex: currentIndex })];

  if (!isPseudoRoot) {
    const callbackResult = callback({
      node,
      parentNode,
      path: selfPath,
      lowerSiblingCounts,
      treeIndex: currentIndex,
    });

    // Cut walk short if the callback returned false
    if (callbackResult === false) {
      return false;
    }
  }

  // Return self on nodes with no children or hidden children
  if (!node.children || (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
    return currentIndex;
  }

  // Get all descendants
  let childIndex: number | boolean = currentIndex;
  if (!isFunction(node.children)) {
    const childCount = node.children.length;
    for (let i = 0; i < childCount; i += 1) {
      if (isNumber(childIndex)) {
        childIndex = walkDescendants({
          callback,
          getNodeKey,
          ignoreCollapsed,
          node: node.children[i],
          parentNode: isPseudoRoot ? undefined : node,
          currentIndex: childIndex + 1,
          lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
          path: selfPath,
        });
      }

      // Cut walk short if the callback returned false
      if (childIndex === false) {
        return false;
      }
    }
  }

  return childIndex;
};

const mapDescendants = (options: DescendantsOptions) => {
  const {
    callback,
    currentIndex,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot = false,
    lowerSiblingCounts = [],
    node,
    parentNode = undefined,
    path = [],
  } = options;

  const nextNode = cloneDeep(node);

  // The pseudo-root is not considered in the path
  const selfPath = isPseudoRoot
    ? []
    : [...path, getNodeKey({ node: nextNode, treeIndex: currentIndex })];

  const selfInfo = {
    node: nextNode,
    parentNode,
    path: selfPath,
    lowerSiblingCounts,
    treeIndex: currentIndex,
  };

  // Return self on nodes with no children or hidden children
  if (!nextNode.children || (nextNode.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
    return {
      treeIndex: currentIndex,
      node: callback(selfInfo),
    };
  }

  // Get all descendants
  let childIndex = currentIndex;
  if (!isFunction(nextNode.children)) {
    const childCount = nextNode.children.length;
    const children = nextNode.children
      .map((child, i) => {
        const mapResult = mapDescendants({
          callback,
          getNodeKey,
          ignoreCollapsed,
          node: child,
          parentNode: isPseudoRoot ? undefined : nextNode,
          currentIndex: childIndex + 1,
          lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
          path: selfPath,
        });
        childIndex = mapResult.treeIndex;

        return mapResult.node;
      })
      .filter((item): item is TreeItem => !isBoolean(item));
    nextNode.children = children;
  }

  return {
    node: callback(selfInfo),
    treeIndex: childIndex,
  };
};

export const getVisibleNodeCount = ({ treeData = [] }: FullTree): number => {
  const traverse = (node: TreeItem): number => {
    if (!node.children || node.expanded !== true || typeof node.children === 'function') {
      return 1;
    }

    return 1 + node.children.reduce((total, currentNode) => total + traverse(currentNode), 0);
  };

  return treeData.reduce((total, currentNode) => total + traverse(currentNode), 0);
};

export const getVisibleNodeInfoAtIndex = ({
  getNodeKey,
  index: targetIndex,
  treeData,
}: FullTree & {
  getNodeKey: GetNodeKeyFunction;
  index: number;
}): ReturnType<typeof getNodeDataAtTreeIndexOrNextIndex> | undefined => {
  if (!treeData || treeData.length === 0) {
    return undefined;
  }

  // Call the tree traversal with a pseudo-root node
  const result = getNodeDataAtTreeIndexOrNextIndex({
    targetIndex,
    getNodeKey,
    node: {
      children: treeData,
      expanded: true,
    },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
    isPseudoRoot: true,
  });

  if (result.node) {
    return result;
  }

  return undefined;
};

export const walk = ({
  callback,
  getNodeKey,
  ignoreCollapsed = true,
  treeData,
}: WalkAndMapFunctionParameters): void => {
  if (!treeData || treeData.length === 0) {
    return;
  }

  walkDescendants({
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot: true,
    node: { children: treeData },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
  });
};

export const map = ({
  callback,
  getNodeKey,
  ignoreCollapsed = true,
  treeData,
}: WalkAndMapFunctionParameters) => {
  if (!treeData || treeData.length === 0) {
    return [];
  }

  const result = mapDescendants({
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot: true,
    node: { children: treeData },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
  });

  return isObject(result.node) && isArray(result.node.children) ? result.node.children : [];
};

export const toggleExpandedForAll = ({
  expanded = true,
  treeData,
}: FullTree & {
  expanded?: boolean | undefined;
}) => {
  return map({
    treeData,
    callback: ({ node }) => ({ ...node, expanded }),
    getNodeKey: ({ treeIndex }) => treeIndex,
    ignoreCollapsed: false,
  });
};

export const changeNodeAtPath = ({
  getNodeKey,
  ignoreCollapsed = true,
  newNode,
  path,
  treeData,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
    newNode?: GetNewNodeFunction;
  }) => {
  const RESULT_MISS = 'RESULT_MISS';

  const traverse = ({
    currentTreeIndex,
    isPseudoRoot = false,
    node,
    pathIndex,
  }: {
    currentTreeIndex: number;
    isPseudoRoot?: boolean;
    node: TreeItem;
    pathIndex: number;
  }): TreeItem | typeof RESULT_MISS | undefined => {
    if (!isPseudoRoot && getNodeKey({ node, treeIndex: currentTreeIndex }) !== path[pathIndex]) {
      return RESULT_MISS;
    }

    if (pathIndex >= path.length - 1) {
      // If this is the final location in the path, return its changed form
      return isFunction(newNode) ? newNode({ node, treeIndex: currentTreeIndex }) : newNode;
    }
    if (!node?.children) {
      // If this node is part of the path, but has no children, return the unchanged node
      throw new Error('Path referenced children of node with no children.');
    }

    let nextTreeIndex = currentTreeIndex + 1;
    if (!isFunction(node.children)) {
      for (let i = 0; i < node.children.length; i += 1) {
        const result = traverse({
          node: node.children[i],
          currentTreeIndex: nextTreeIndex,
          pathIndex: pathIndex + 1,
        });

        // If the result went down the correct path
        if (result !== RESULT_MISS) {
          if (result) {
            // If the result was truthy (in this case, an object),
            //  pass it to the next level of recursion up
            return {
              ...node,
              children: [...node.children.slice(0, i), result, ...node.children.slice(i + 1)],
            };
          }
          // If the result was falsy (returned from the newNode function), then
          //  delete the node from the array.
          return {
            ...node,
            children: [...node.children.slice(0, i), ...node.children.slice(i + 1)],
          };
        }

        nextTreeIndex += 1 + getDescendantCount({ node: node.children[i], ignoreCollapsed });
      }
    }

    return RESULT_MISS;
  };

  // Use a pseudo-root node in the beginning traversal
  const result = traverse({
    node: { children: treeData },
    currentTreeIndex: -1,
    pathIndex: -1,
    isPseudoRoot: true,
  });

  if (result === RESULT_MISS) {
    throw new Error('No node found at the given path.');
  }

  return result?.children && isArray(result.children) ? result.children : [];
};

export const removeNodeAtPath = ({
  getNodeKey,
  ignoreCollapsed = true,
  path,
  treeData,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
  }) => {
  return changeNodeAtPath({
    treeData,
    path,
    getNodeKey,
    ignoreCollapsed,
    newNode: undefined, // Delete the node
  });
};

export const removeNode = ({
  getNodeKey,
  ignoreCollapsed = true,
  path,
  treeData,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
  }) => {
  let removedNode;
  let removedTreeIndex;
  const nextTreeData = changeNodeAtPath({
    treeData,
    path,
    getNodeKey,
    ignoreCollapsed,
    newNode: ({ node, treeIndex }) => {
      // Store the target node and delete it from the tree
      removedNode = node;
      removedTreeIndex = treeIndex;

      return undefined;
    },
  });

  return {
    treeData: nextTreeData,
    node: removedNode,
    treeIndex: removedTreeIndex,
  };
};

export const getNodeAtPath = ({
  getNodeKey,
  ignoreCollapsed = true,
  path,
  treeData,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction;
    ignoreCollapsed?: boolean | undefined;
  }): (TreeNode & TreeIndex) | null => {
  let foundNodeInfo: (TreeNode & TreeIndex) | null = null;

  try {
    changeNodeAtPath({
      treeData,
      path,
      getNodeKey,
      ignoreCollapsed,
      newNode: ({ node, treeIndex }) => {
        foundNodeInfo = { node, treeIndex };
        return node;
      },
    });
  } catch {
    // Ignore the error -- the null return will be explanation enough
  }

  return foundNodeInfo;
};

export const addNodeUnderParent = ({
  addAsFirstChild = false,
  expandParent = false,
  getNodeKey,
  ignoreCollapsed = true,
  newNode,
  parentKey = undefined,
  treeData,
}: FullTree & {
  addAsFirstChild?: boolean;
  expandParent?: boolean;
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed?: boolean;
  newNode: TreeItem;
  parentKey?: number | string | null;
}): FullTree & TreeIndex => {
  if (parentKey === null || parentKey === undefined) {
    return addAsFirstChild
      ? {
          treeData: [newNode, ...(treeData || [])],
          treeIndex: 0,
        }
      : {
          treeData: [...(treeData || []), newNode],
          treeIndex: (treeData || []).length,
        };
  }

  let insertedTreeIndex = 0;
  let hasBeenAdded = false;
  const changedTreeData = map({
    treeData,
    getNodeKey,
    ignoreCollapsed,
    callback: ({ node, path, treeIndex }) => {
      const key = path ? path.at(-1) : undefined;
      // Return nodes that are not the parent as-is
      if (hasBeenAdded || key !== parentKey) {
        return node;
      }
      hasBeenAdded = true;

      const parentNode = {
        ...node,
      };

      if (expandParent) {
        parentNode.expanded = true;
      }

      // If no children exist yet, just add the single newNode
      if (!parentNode.children) {
        insertedTreeIndex = treeIndex + 1;
        return {
          ...parentNode,
          children: [newNode],
        };
      }

      if (typeof parentNode.children === 'function') {
        throw new TypeError('Cannot add to children defined by a function');
      }

      let nextTreeIndex = treeIndex + 1;
      for (let i = 0; i < parentNode.children.length; i += 1) {
        nextTreeIndex += 1 + getDescendantCount({ node: parentNode.children[i], ignoreCollapsed });
      }

      insertedTreeIndex = nextTreeIndex;

      const children = addAsFirstChild
        ? [newNode, ...parentNode.children]
        : [...parentNode.children, newNode];

      return {
        ...parentNode,
        children,
      };
    },
  });

  if (!hasBeenAdded) {
    throw new Error('No node found with the given key.');
  }

  return {
    treeData: changedTreeData || [],
    treeIndex: insertedTreeIndex,
  };
};

const addNodeAtDepthAndIndex = ({
  currentDepth,
  currentIndex,
  expandParent,
  getNodeKey,
  ignoreCollapsed,
  isLastChild,
  isPseudoRoot = false,
  minimumTreeIndex,
  newNode,
  node,
  path = [],
  targetDepth,
}: {
  currentDepth: number;
  currentIndex: number;
  expandParent: boolean;
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed: boolean;
  isLastChild: boolean;
  isPseudoRoot?: boolean;
  minimumTreeIndex: number;
  newNode: TreeItem;
  node: TreeItem;
  path?: number[];
  targetDepth: number;
}) => {
  const selfPath = (n: TreeItem) => {
    return isPseudoRoot ? [] : [...path, getNodeKey({ node: n, treeIndex: currentIndex })];
  };

  // If the current position is the only possible place to add, add it
  if (
    currentIndex >= minimumTreeIndex - 1 ||
    (isLastChild && !(node.children && node.children.length > 0))
  ) {
    if (typeof node.children === 'function') {
      throw new TypeError('Cannot add to children defined by a function');
    } else {
      const extraNodeProps = expandParent ? { expanded: true } : {};
      const nextNode = {
        ...node,

        ...extraNodeProps,
        children: node.children ? [newNode, ...node.children] : [newNode],
      };

      return {
        node: nextNode,
        nextIndex: currentIndex + 2,
        insertedTreeIndex: currentIndex + 1,
        parentPath: selfPath(nextNode),
        parentNode: isPseudoRoot ? undefined : nextNode,
      };
    }
  }

  // If this is the target depth for the insertion,
  // i.e., where the newNode can be added to the current node's children
  if (currentDepth >= targetDepth - 1) {
    // Skip over nodes with no children or hidden children
    if (
      !node.children ||
      typeof node.children === 'function' ||
      (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
    ) {
      return { node, nextIndex: currentIndex + 1 };
    }

    // Scan over the children to see if there's a place among them that fulfills
    // the minimumTreeIndex requirement
    let childIndex = currentIndex + 1;
    let insertedTreeIndex;
    let insertIndex;
    for (let i = 0; i < node.children.length; i += 1) {
      // If a valid location is found, mark it as the insertion location and
      // break out of the loop
      if (childIndex >= minimumTreeIndex) {
        insertedTreeIndex = childIndex;
        insertIndex = i;
        break;
      }

      // Increment the index by the child itself plus the number of descendants it has
      childIndex += 1 + getDescendantCount({ node: node.children[i], ignoreCollapsed });
    }

    // If no valid indices to add the node were found
    if (insertIndex === null || insertIndex === undefined) {
      // If the last position in this node's children is less than the minimum index
      // and there are more children on the level of this node, return without insertion
      if (childIndex < minimumTreeIndex && !isLastChild) {
        return { node, nextIndex: childIndex };
      }

      // Use the last position in the children array to insert the newNode
      insertedTreeIndex = childIndex;
      insertIndex = node.children.length;
    }

    // Insert the newNode at the insertIndex
    const nextNode = {
      ...node,
      children: [
        ...node.children.slice(0, insertIndex),
        newNode,
        ...node.children.slice(insertIndex),
      ],
    };

    // Return node with successful insert result
    return {
      node: nextNode,
      nextIndex: childIndex,
      insertedTreeIndex,
      parentPath: selfPath(nextNode),
      parentNode: isPseudoRoot ? undefined : nextNode,
    };
  }

  // Skip over nodes with no children or hidden children
  if (
    !node.children ||
    typeof node.children === 'function' ||
    (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
  ) {
    return { node, nextIndex: currentIndex + 1 };
  }

  // Get all descendants
  let insertedTreeIndex: number | undefined = undefined;
  let pathFragment: number[] | undefined = undefined;
  let parentNode: TreeItem | undefined = undefined;
  let childIndex = currentIndex + 1;
  let newChildren = node.children;
  if (typeof newChildren !== 'function') {
    newChildren = newChildren.map((child, i) => {
      if (insertedTreeIndex !== null && insertedTreeIndex !== undefined) {
        return child;
      }

      const mapResult = addNodeAtDepthAndIndex({
        targetDepth,
        minimumTreeIndex,
        newNode,
        ignoreCollapsed,
        expandParent,
        isLastChild: isLastChild && i === newChildren.length - 1,
        node: child,
        currentIndex: childIndex,
        currentDepth: currentDepth + 1,
        getNodeKey,
        path: [], // Cannot determine the parent path until the children have been processed
      });

      if ('insertedTreeIndex' in mapResult) {
        ({ insertedTreeIndex, parentNode, parentPath: pathFragment } = mapResult);
      }

      childIndex = mapResult.nextIndex;

      return mapResult.node;
    });
  }

  const nextNode = { ...node, children: newChildren };
  const result: {
    insertedTreeIndex?: number;
    nextIndex: typeof childIndex;
    node: typeof nextNode;
    parentNode?: TreeItem;
    parentPath?: number[];
  } = {
    node: nextNode,
    nextIndex: childIndex,
  };

  if (insertedTreeIndex !== null && insertedTreeIndex !== undefined && pathFragment !== undefined) {
    result.insertedTreeIndex = insertedTreeIndex;
    result.parentPath = [...selfPath(nextNode), ...pathFragment];
    result.parentNode = parentNode;
  }

  return result;
};

export const insertNode = ({
  depth: targetDepth,
  expandParent = false,
  getNodeKey,
  ignoreCollapsed = true,
  minimumTreeIndex,
  newNode,
  treeData,
}: {
  depth: number;
  expandParent?: boolean | undefined;
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed?: boolean | undefined;
  minimumTreeIndex: number;
  newNode: TreeItem;
  treeData?: TreeItem[];
}): FullTree & TreeIndex & TreePath & { parentNode?: TreeItem } => {
  if (!treeData && targetDepth === 0) {
    return {
      treeData: [newNode],
      treeIndex: 0,
      path: [getNodeKey({ node: newNode, treeIndex: 0 })],
      parentNode: undefined,
    };
  }

  const insertResult = addNodeAtDepthAndIndex({
    targetDepth,
    minimumTreeIndex,
    newNode,
    ignoreCollapsed,
    expandParent,
    getNodeKey,
    isPseudoRoot: true,
    isLastChild: true,
    node: { children: treeData },
    currentIndex: -1,
    currentDepth: -1,
  });

  if (!('insertedTreeIndex' in insertResult)) {
    throw new Error('No suitable position found to insert.');
  }

  const { insertedTreeIndex: treeIndex, parentNode, parentPath } = insertResult;
  const result: FullTree & TreeIndex & TreePath & { parentNode?: TreeItem } = {
    treeData: [],
    treeIndex: 0,
    path: [],
  };
  if (isArray(insertResult.node.children)) {
    result.treeData = insertResult.node.children;
  }
  if (treeIndex) {
    result.treeIndex = treeIndex;
    if (parentPath) {
      result.path = [...parentPath, getNodeKey({ node: newNode, treeIndex })];
    }
  }
  if (parentNode) {
    result.parentNode = parentNode;
  }

  return result;
};

export const getFlatDataFromTree = ({
  getNodeKey,
  ignoreCollapsed = true,
  treeData,
}: FullTree & {
  getNodeKey: GetNodeKeyFunction;
  ignoreCollapsed?: boolean | undefined;
}): Row[] => {
  if (!treeData || treeData.length === 0) {
    return [];
  }

  const flattened: CallbackOptions[] = [];
  walk({
    treeData,
    getNodeKey,
    ignoreCollapsed,
    callback: (nodeInfo) => {
      flattened.push(nodeInfo);
    },
  });

  return flattened;
};

export const isDescendant = (older: TreeItem, younger: TreeItem): boolean => {
  return (
    !!older.children &&
    typeof older.children !== 'function' &&
    older.children.some((child) => child === younger || isDescendant(child, younger))
  );
};

export const getDepth = (node: TreeItem, depth = 0): number => {
  if (!node.children) {
    return depth;
  }

  if (typeof node.children === 'function') {
    return depth + 1;
  }

  return node.children.reduce(
    (deepest, child) => Math.max(deepest, getDepth(child, depth + 1)),
    depth,
  );
};

export const find = ({
  expandAllMatchPaths = false,
  expandFocusMatchPaths = true,
  getNodeKey,
  searchFocusOffset,
  searchMethod,
  searchQuery,
  treeData,
}: FullTree & {
  expandAllMatchPaths?: boolean;
  expandFocusMatchPaths?: boolean;
  getNodeKey: GetNodeKeyFunction;
  searchFocusOffset?: number;
  searchMethod: (data: SearchData) => boolean;
  searchQuery: SearchData['searchQuery'];
}): { matches: Optional<NodeData, 'treeIndex'>[] } & FullTree => {
  let matchCount = 0;
  const trav = ({
    currentIndex,
    isPseudoRoot = false,
    node,
    path = [],
  }: {
    currentIndex: number;
    isPseudoRoot?: boolean;
    node: TreeItem;
    path?: number[];
  }) => {
    let matches: Optional<NodeData, 'treeIndex'>[] = [];
    let isSelfMatch = false;
    let hasFocusMatch = false;
    // The pseudo-root is not considered in the path
    const selfPath = isPseudoRoot ? [] : [...path, getNodeKey({ node, treeIndex: currentIndex })];
    // Examine the current node to see if it is a match
    if (
      !isPseudoRoot &&
      searchMethod({
        path: selfPath,
        treeIndex: currentIndex,
        node,
        searchQuery,
      })
    ) {
      if (matchCount === searchFocusOffset) {
        hasFocusMatch = true;
      }

      // Keep track of the number of matching nodes, so we know when the searchFocusOffset
      //  is reached
      matchCount += 1;

      // We cannot add this node to the matches right away, as it may be changed
      //  during the search of the descendants. The entire node is used in
      //  comparisons between nodes inside the `matches` and `treeData` results
      //  of this method (`find`)
      isSelfMatch = true;
    }

    let childIndex = currentIndex;
    const newNode = cloneDeep(node);

    // Nodes with with children that aren't lazy
    if (isArray(newNode.children) && newNode.children.length > 0) {
      // Get all descendants
      newNode.children = newNode.children.map((child) => {
        const mapResult = trav({
          node: child,
          currentIndex: childIndex + 1,
          path: selfPath,
        });

        // Ignore hidden nodes by only advancing the index counter to the returned treeIndex
        // if the child is expanded.
        //
        // The child could have been expanded from the start,
        // or expanded due to a matching node being found in its descendants
        if (mapResult.node.expanded) {
          childIndex = mapResult.treeIndex;
        } else {
          childIndex += 1;
        }

        if (mapResult.matches.length > 0 || mapResult.hasFocusMatch) {
          matches = [...matches, ...mapResult.matches];
          if (mapResult.hasFocusMatch) {
            hasFocusMatch = true;
          }

          // Expand the current node if it has descendants matching the search
          // and the settings are set to do so.
          if (
            (expandAllMatchPaths && mapResult.matches.length > 0) ||
            ((expandAllMatchPaths || expandFocusMatchPaths) && mapResult.hasFocusMatch)
          ) {
            newNode.expanded = true;
          }
        }

        return mapResult.node;
      });
    }

    // Cannot assign a treeIndex to hidden nodes
    if (!isPseudoRoot && !newNode.expanded) {
      matches = matches.map((match) => ({
        ...match,
        treeIndex: undefined,
      }));
    }

    // Add this node to the matches if it fits the search criteria.
    // This is performed at the last minute so newNode can be sent in its final form.
    if (isSelfMatch) {
      matches = [{ path: selfPath, treeIndex: currentIndex, node: newNode }, ...matches];
    }

    return {
      node: matches.length > 0 ? newNode : node,
      matches,
      hasFocusMatch,
      treeIndex: childIndex,
    };
  };

  const result = trav({
    node: { children: treeData },
    isPseudoRoot: true,
    currentIndex: -1,
  });

  return {
    matches: result.matches,
    treeData: isArray(result.node.children) ? result.node.children : [],
  };
};
