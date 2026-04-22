import type { FlattenedItem, TreeItem } from './types';

// ─── Flatten ──────────────────────────────────────────────────────────────────

export function flattenTree(
  items: TreeItem[],
  parentId: string | number | null = null,
  depth = 0,
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    const flat: FlattenedItem = {
      ...item,
      parentId,
      depth,
      index,
      collapsed: item.expanded === false,
    };
    acc.push(flat);

    if (item.children?.length && item.expanded !== false) {
      acc.push(...flattenTree(item.children, item.id, depth + 1));
    }

    return acc;
  }, []);
}

// ─── Build tree from flat list ────────────────────────────────────────────────

export function buildTree(flattenedItems: FlattenedItem[]): TreeItem[] {
  const root: TreeItem = { id: '__root__', children: [] };
  const nodes = new Map<string | number, TreeItem>();
  nodes.set(root.id, root);

  // Pass 1: register all nodes so children that appear before their parent in
  // the flat list (e.g. after arrayMove reorders an expanded subtree) are still
  // found when we wire up parent-child links in pass 2.
  for (const item of flattenedItems) {
    const {
      collapsed: _collapsed,
      depth: _depth,
      index: _index,
      parentId: _parentId,
      ...rest
    } = item;
    nodes.set(item.id, { ...rest, children: [] });
  }

  // Pass 2: attach each node to its parent in flat-list order (preserves the
  // reordered sequence within each parent's children array).
  for (const item of flattenedItems) {
    const node = nodes.get(item.id)!;
    const parent = item.parentId !== null ? nodes.get(item.parentId) : root;
    if (parent) {
      parent.children ??= [];
      parent.children.push(node);
    }
  }

  for (const [, node] of nodes) {
    if (node !== root && node.children?.length === 0) {
      node.children = undefined;
    }
  }

  return root.children ?? [];
}

// ─── Get projection (target depth during drag) ────────────────────────────────

export function getProjection(
  items: FlattenedItem[],
  activeId: string | number,
  overId: string | number,
  dragOffset: number,
  indentationWidth: number,
  maxDepth?: number,
): {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: string | number | null;
} {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const projectedDepth = activeItem.depth + Math.round(dragOffset / indentationWidth);

  const computedMaxDepth = getMaxDepth({ previousItem });
  const computedMinDepth = getMinDepth({ nextItem });

  let depth = clamp(projectedDepth, computedMinDepth, computedMaxDepth);

  if (maxDepth !== undefined) {
    depth = Math.min(depth, maxDepth);
  }

  return {
    depth,
    maxDepth: computedMaxDepth,
    minDepth: computedMinDepth,
    parentId: getParentId(),
  };

  function getParentId() {
    if (depth === 0 || !previousItem) return null;

    if (depth === previousItem.depth) return previousItem.parentId;

    if (depth > previousItem.depth) return previousItem.id;

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth - 1);

    return newParent?.id ?? null;
  }
}

function getMaxDepth({ previousItem }: { previousItem?: FlattenedItem }) {
  if (previousItem) return previousItem.depth + 1;
  return 0;
}

function getMinDepth({ nextItem }: { nextItem?: FlattenedItem }) {
  if (nextItem) return nextItem.depth;
  return 0;
}

// ─── Remove item from tree by id ─────────────────────────────────────────────

export function removeItemFromTree(items: TreeItem[], id: string | number): TreeItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: item.children ? removeItemFromTree(item.children, id) : undefined,
    }));
}

// ─── Find item by id ──────────────────────────────────────────────────────────

export function findItemById(items: TreeItem[], id: string | number): TreeItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// ─── Find path to item ────────────────────────────────────────────────────────

export function getNodeAtPath({
  path,
  treeData,
}: {
  path: Array<string | number>;
  treeData: TreeItem[];
}): TreeItem | null {
  let current: TreeItem[] = treeData;
  let node: TreeItem | null = null;

  for (const key of path) {
    const found = current.find((item) => item.id === key);
    if (!found) return null;
    node = found;
    current = found.children ?? [];
  }

  return node;
}

// ─── Toggle expansion ─────────────────────────────────────────────────────────

export function toggleExpandedForAll({
  expanded = true,
  treeData,
}: {
  expanded?: boolean;
  treeData: TreeItem[];
}): TreeItem[] {
  return treeData.map((node) => ({
    ...node,
    expanded,
    children: node.children
      ? toggleExpandedForAll({ treeData: node.children, expanded })
      : undefined,
  }));
}

// ─── Set visibility for node at path ─────────────────────────────────────────

export function setVisibilityAtPath({
  expanded,
  path,
  treeData,
}: {
  expanded: boolean;
  path: Array<string | number>;
  treeData: TreeItem[];
}): TreeItem[] {
  if (path.length === 0) return treeData;

  const [head, ...rest] = path;

  return treeData.map((node) => {
    if (node.id !== head) return node;

    if (rest.length === 0) {
      return { ...node, expanded };
    }

    return {
      ...node,
      children: setVisibilityAtPath({
        treeData: node.children ?? [],
        path: rest,
        expanded,
      }),
    };
  });
}

// ─── Apply the new ordering from flat dragged list ────────────────────────────

export function setTreeFromFlatItems(
  flatItems: FlattenedItem[],
  originalTree: TreeItem[],
): TreeItem[] {
  // Preserve `expanded` state and original extra props from original tree
  const origMap = new Map<string | number, TreeItem>();

  function collectOriginals(items: TreeItem[]) {
    for (const item of items) {
      origMap.set(item.id, item);
      if (item.children) collectOriginals(item.children);
    }
  }

  collectOriginals(originalTree);

  const merged = flatItems.map((flat) => {
    const orig = origMap.get(flat.id);
    return { ...flat, ...(orig ?? {}), children: [] as TreeItem[] };
  });

  const newTree = buildTree(merged);

  // Collapsed nodes' children are absent from flatItems (they're hidden).
  // Restore them from the original tree and append any newly-dropped children.
  function restoreCollapsedChildren(items: TreeItem[]) {
    for (const item of items) {
      const orig = origMap.get(item.id);
      if (orig?.children?.length && item.expanded === false) {
        const origChildIds = new Set(orig.children.map((c) => c.id));
        const newlyAdded = (item.children ?? []).filter((c) => !origChildIds.has(c.id));
        item.children = [...orig.children, ...newlyAdded];
      }
      if (item.children?.length) restoreCollapsedChildren(item.children);
    }
  }

  restoreCollapsedChildren(newTree);

  return newTree;
}

// ─── Count visible nodes (respects collapsed) ────────────────────────────────

export function getVisibleNodeCount({ treeData }: { treeData: TreeItem[] }): number {
  let count = 0;

  function walk(items: TreeItem[]) {
    for (const item of items) {
      count++;
      if (item.expanded !== false && item.children?.length) {
        walk(item.children);
      }
    }
  }

  walk(treeData);
  return count;
}

// ─── Array helpers ────────────────────────────────────────────────────────────

export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array];
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

export function removeChildrenOf(items: FlattenedItem[], ids: Array<string | number>) {
  const excludeParentIds = [...ids];
  return items.filter((item) => {
    if (item.parentId !== null && excludeParentIds.includes(item.parentId)) {
      if (item.children?.length) {
        excludeParentIds.push(item.id);
      }
      return false;
    }
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
