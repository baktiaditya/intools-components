import type { FlattenedItem, TreeItem } from '../types';
import {
  arrayMove,
  buildTree,
  findItemById,
  flattenTree,
  getNodeAtPath,
  getProjection,
  getVisibleNodeCount,
  removeChildrenOf,
  removeItemFromTree,
  setTreeFromFlatItems,
  setVisibilityAtPath,
  toggleExpandedForAll,
} from '../utils';

describe('SortableTreeNew Utils', () => {
  // ─── flattenTree ──────────────────────────────────────────────────────────

  describe('flattenTree', () => {
    it('flattens a single level tree', () => {
      const tree: TreeItem[] = [
        { id: 1, title: 'Node 1' },
        { id: 2, title: 'Node 2' },
      ];

      const result = flattenTree(tree);

      expect(result).toEqual([
        expect.objectContaining({ id: 1, depth: 0, parentId: null, index: 0 }),
        expect.objectContaining({ id: 2, depth: 0, parentId: null, index: 1 }),
      ]);
    });

    it('flattens a nested tree', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: true,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      const result = flattenTree(tree);

      expect(result).toEqual([
        expect.objectContaining({ id: 1, depth: 0, parentId: null }),
        expect.objectContaining({ id: 1.1, depth: 1, parentId: 1 }),
      ]);
    });

    it('respects expanded state and excludes collapsed children', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      const result = flattenTree(tree);

      expect(result).toEqual([expect.objectContaining({ id: 1 })]);
      expect(result).not.toContainEqual(expect.objectContaining({ id: 1.1 }));
    });

    it('marks collapsed items correctly', () => {
      const tree: TreeItem[] = [{ id: 1, title: 'Node', expanded: false }];

      const result = flattenTree(tree);

      expect(result[0].collapsed).toBe(true);
    });
  });

  // ─── buildTree ────────────────────────────────────────────────────────────

  describe('buildTree', () => {
    it('rebuilds a simple tree from flattened items', () => {
      const flattened: FlattenedItem[] = [
        {
          id: 1,
          title: 'Node 1',
          depth: 0,
          index: 0,
          parentId: null,
          collapsed: false,
        },
        {
          id: 2,
          title: 'Node 2',
          depth: 0,
          index: 1,
          parentId: null,
          collapsed: false,
        },
      ];

      const result = buildTree(flattened);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('rebuilds a nested tree', () => {
      const flattened: FlattenedItem[] = [
        {
          id: 1,
          title: 'Parent',
          depth: 0,
          index: 0,
          parentId: null,
          collapsed: false,
        },
        {
          id: 1.1,
          title: 'Child',
          depth: 1,
          index: 0,
          parentId: 1,
          collapsed: false,
        },
      ];

      const result = buildTree(flattened);

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].id).toBe(1.1);
    });

    it('handles out-of-order items', () => {
      const flattened: FlattenedItem[] = [
        {
          id: 1.1,
          title: 'Child',
          depth: 1,
          index: 0,
          parentId: 1,
          collapsed: false,
        },
        {
          id: 1,
          title: 'Parent',
          depth: 0,
          index: 0,
          parentId: null,
          collapsed: false,
        },
      ];

      const result = buildTree(flattened);

      expect(result[0].id).toBe(1);
      expect(result[0].children?.[0].id).toBe(1.1);
    });

    it('removes empty children arrays', () => {
      const flattened: FlattenedItem[] = [
        {
          id: 1,
          title: 'Node',
          depth: 0,
          index: 0,
          parentId: null,
          collapsed: false,
        },
      ];

      const result = buildTree(flattened);

      expect(result[0].children).toBeUndefined();
    });
  });

  // ─── removeItemFromTree ────────────────────────────────────────────────────

  describe('removeItemFromTree', () => {
    it('removes an item from a single level tree', () => {
      const tree: TreeItem[] = [
        { id: 1, title: 'Node 1' },
        { id: 2, title: 'Node 2' },
      ];

      const result = removeItemFromTree(tree, 1);

      expect(result).toEqual([{ id: 2, title: 'Node 2' }]);
    });

    it('removes an item from nested tree', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          children: [
            { id: 1.1, title: 'Child 1' },
            { id: 1.2, title: 'Child 2' },
          ],
        },
      ];

      const result = removeItemFromTree(tree, 1.1);

      expect(result[0].children).toEqual([{ id: 1.2, title: 'Child 2' }]);
    });
  });

  // ─── findItemById ──────────────────────────────────────────────────────────

  describe('findItemById', () => {
    it('finds item at root level', () => {
      const tree: TreeItem[] = [
        { id: 1, title: 'Node 1' },
        { id: 2, title: 'Node 2' },
      ];

      const result = findItemById(tree, 2);

      expect(result?.id).toBe(2);
    });

    it('finds item in nested tree', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      const result = findItemById(tree, 1.1);

      expect(result?.id).toBe(1.1);
    });

    it('returns undefined for non-existent item', () => {
      const tree: TreeItem[] = [{ id: 1, title: 'Node' }];

      const result = findItemById(tree, 999);

      expect(result).toBeUndefined();
    });
  });

  // ─── getNodeAtPath ────────────────────────────────────────────────────────

  describe('getNodeAtPath', () => {
    const tree: TreeItem[] = [
      {
        id: 'root',
        title: 'Root',
        children: [
          {
            id: 'child',
            title: 'Child',
            children: [{ id: 'grandchild', title: 'Grandchild' }],
          },
        ],
      },
    ];

    it('finds node at root level', () => {
      const result = getNodeAtPath({ treeData: tree, path: ['root'] });

      expect(result?.id).toBe('root');
    });

    it('finds nested node', () => {
      const result = getNodeAtPath({ treeData: tree, path: ['root', 'child'] });

      expect(result?.id).toBe('child');
    });

    it('finds deeply nested node', () => {
      const result = getNodeAtPath({ treeData: tree, path: ['root', 'child', 'grandchild'] });

      expect(result?.id).toBe('grandchild');
    });

    it('returns null for invalid path', () => {
      const result = getNodeAtPath({ treeData: tree, path: ['root', 999] });

      expect(result).toBeNull();
    });
  });

  // ─── toggleExpandedForAll ──────────────────────────────────────────────────

  describe('toggleExpandedForAll', () => {
    it('expands all nodes', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Child', expanded: false }],
        },
      ];

      const result = toggleExpandedForAll({ treeData: tree, expanded: true });

      expect(result[0].expanded).toBe(true);
      expect(result[0].children?.[0].expanded).toBe(true);
    });

    it('collapses all nodes', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: true,
          children: [{ id: 1.1, title: 'Child', expanded: true }],
        },
      ];

      const result = toggleExpandedForAll({ treeData: tree, expanded: false });

      expect(result[0].expanded).toBe(false);
      expect(result[0].children?.[0].expanded).toBe(false);
    });
  });

  // ─── setVisibilityAtPath ───────────────────────────────────────────────────

  describe('setVisibilityAtPath', () => {
    it('sets visibility at root level', () => {
      const tree: TreeItem[] = [{ id: 1, title: 'Node', expanded: false }];

      const result = setVisibilityAtPath({ treeData: tree, path: [1], expanded: true });

      expect(result[0].expanded).toBe(true);
    });

    it('sets visibility at nested level', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          children: [{ id: 1.1, title: 'Child', expanded: false }],
        },
      ];

      const result = setVisibilityAtPath({ treeData: tree, path: [1, 1.1], expanded: true });

      expect(result[0].children?.[0].expanded).toBe(true);
    });

    it('returns original tree for empty path', () => {
      const tree: TreeItem[] = [{ id: 1, title: 'Node' }];

      const result = setVisibilityAtPath({ treeData: tree, path: [], expanded: true });

      expect(result).toEqual(tree);
    });
  });

  // ─── setTreeFromFlatItems ──────────────────────────────────────────────────

  describe('setTreeFromFlatItems', () => {
    it('rebuilds tree from flat items preserving expanded state', () => {
      const originalTree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      const flatItems: FlattenedItem[] = [
        {
          id: 1,
          title: 'Parent',
          depth: 0,
          index: 0,
          parentId: null,
          collapsed: true,
        },
      ];

      const result = setTreeFromFlatItems(flatItems, originalTree);

      expect(result[0].expanded).toBe(false);
      expect(result[0].children).toEqual([{ id: 1.1, title: 'Child' }]);
    });
  });

  // ─── getVisibleNodeCount ───────────────────────────────────────────────────

  describe('getVisibleNodeCount', () => {
    it('counts all nodes when all expanded', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: true,
          children: [{ id: 1.1, title: 'Child' }],
        },
        { id: 2, title: 'Node 2' },
      ];

      const count = getVisibleNodeCount({ treeData: tree });

      expect(count).toBe(3);
    });

    it('excludes collapsed children', () => {
      const tree: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      const count = getVisibleNodeCount({ treeData: tree });

      expect(count).toBe(1);
    });
  });

  // ─── arrayMove ────────────────────────────────────────────────────────────

  describe('arrayMove', () => {
    it('moves item forward', () => {
      const array = [1, 2, 3, 4];

      const result = arrayMove(array, 0, 2);

      expect(result).toEqual([2, 3, 1, 4]);
    });

    it('moves item backward', () => {
      const array = [1, 2, 3, 4];

      const result = arrayMove(array, 3, 1);

      expect(result).toEqual([1, 4, 2, 3]);
    });

    it('handles negative indices', () => {
      const array = [1, 2, 3, 4];

      const result = arrayMove(array, 0, -1);

      expect(result).toEqual([2, 3, 4, 1]);
    });
  });

  // ─── removeChildrenOf ──────────────────────────────────────────────────────

  describe('removeChildrenOf', () => {
    it('removes direct children of specified parents', () => {
      const items: FlattenedItem[] = [
        { id: 'parent1', depth: 0, index: 0, parentId: null, collapsed: false },
        { id: 'child1', depth: 1, index: 0, parentId: 'parent1', collapsed: false },
        { id: 'parent2', depth: 0, index: 1, parentId: null, collapsed: false },
      ];

      const result = removeChildrenOf(items, ['parent1']);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(['parent1', 'parent2']);
    });

    it('recursively removes descendants when children array is non-empty', () => {
      const items: FlattenedItem[] = [
        { id: 'p1', depth: 0, index: 0, parentId: null, collapsed: false },
        {
          id: 'c1',
          depth: 1,
          index: 0,
          parentId: 'p1',
          collapsed: false,
          children: [{ id: 'gc1', title: 'GC1' }],
        },
        {
          id: 'gc1',
          depth: 2,
          index: 0,
          parentId: 'c1',
          collapsed: false,
        },
      ];

      const result = removeChildrenOf(items, ['p1']);

      expect(result).toHaveLength(1);
      expect(result.map((i) => i.id)).toEqual(['p1']);
    });
  });

  // ─── getProjection ────────────────────────────────────────────────────────

  describe('getProjection', () => {
    const items: FlattenedItem[] = [
      {
        id: 1,
        depth: 0,
        index: 0,
        parentId: null,
        collapsed: false,
      },
      {
        id: 2,
        depth: 0,
        index: 1,
        parentId: null,
        collapsed: false,
      },
      {
        id: 3,
        depth: 1,
        index: 0,
        parentId: 2,
        collapsed: false,
      },
    ];

    it('calculates projection for horizontal drag', () => {
      const projection = getProjection(items, 1, 2, 50, 44, undefined);

      expect(projection).toHaveProperty('depth');
      expect(projection).toHaveProperty('parentId');
    });

    it('respects maxDepth', () => {
      const projection = getProjection(items, 1, 3, 100, 44, 0);

      expect(projection.depth).toBeLessThanOrEqual(0);
    });
  });
});
