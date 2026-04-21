'use client';

import React from 'react';
import { Portal } from '@chakra-ui/react';
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { css } from '@emotion/react';

import NodeRendererDefault from './NodeRendererDefault';
import { SortableTreeItem } from './SortableTreeItem';
import type { FlattenedItem, SortableTreeProps, TreeItem } from './types';
import {
  arrayMove,
  findItemById,
  flattenTree,
  getProjection,
  removeChildrenOf,
  setTreeFromFlatItems,
  setVisibilityAtPath,
} from './utils';

// ─── Drop animation ───────────────────────────────────────────────────────────

const dropAnimationConfig: DropAnimation = {
  keyframes: ({ transform }) => {
    return [
      { transform: cssTransformToString(transform.initial) },
      { transform: cssTransformToString(transform.final) },
    ];
  },
  easing: 'ease-out',
  duration: 180,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

function cssTransformToString(t: { scaleX: number; scaleY: number; x: number; y: number } | null) {
  if (!t) return '';
  return `translate3d(${t.x}px, ${t.y}px, 0) scaleX(${t.scaleX}) scaleY(${t.scaleY})`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPathForId(
  items: TreeItem[],
  targetId: string | number,
  currentPath: Array<string | number> = [],
): Array<string | number> | null {
  for (const item of items) {
    const newPath = [...currentPath, item.id];
    if (item.id === targetId) return newPath;
    if (item.children) {
      const found = getPathForId(item.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
}

function getParentNode(treeData: TreeItem[], path: Array<string | number>): TreeItem | null {
  if (path.length < 2) return null;
  const parentPath = path.slice(0, -1);
  let current: TreeItem[] = treeData;
  let parent: TreeItem | null = null;
  for (const id of parentPath) {
    const found = current.find((n) => n.id === id);
    if (!found) return null;
    parent = found;
    current = found.children ?? [];
  }
  return parent;
}

// ─── Default search method ────────────────────────────────────────────────────

function defaultSearchMethod({ node, searchQuery }: { node: TreeItem; searchQuery: string }) {
  return (
    String(node.title ?? '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
    String(node.subtitle ?? '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );
}

// ─── SortableTree ─────────────────────────────────────────────────────────────

export default function SortableTree({
  canDrag = true,
  canDrop,
  className,
  generateNodeProps,
  innerStyle,
  maxDepth,
  nodeContentRenderer: NodeContentRenderer = NodeRendererDefault,
  onChange,
  onMoveNode,
  onVisibilityToggle,
  rowHeight = 62,
  scaffoldBlockPxWidth = 44,
  searchFinishCallback,
  searchFocusOffset,
  searchMethod = defaultSearchMethod,
  searchQuery,
  style,
  treeData,
}: SortableTreeProps & {
  searchMethod?: (params: { node: TreeItem; searchQuery: string }) => boolean;
}) {
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  const [overId, setOverId] = React.useState<string | number | null>(null);
  const [offsetLeft, setOffsetLeft] = React.useState(0);

  // ─── Flatten visible tree ───────────────────────────────────────────────────
  const flattenedItems = React.useMemo<FlattenedItem[]>(() => {
    const flattened = flattenTree(treeData);
    // While dragging, remove children of active item so they don't show
    return activeId ? removeChildrenOf(flattened, [activeId]) : flattened;
  }, [treeData, activeId]);

  const sortedIds = React.useMemo(() => flattenedItems.map((item) => item.id), [flattenedItems]);

  // ─── Projection (where will item land?) ────────────────────────────────────
  const projected = React.useMemo(() => {
    if (!activeId || !overId) return null;
    return getProjection(
      flattenedItems,
      activeId,
      overId,
      offsetLeft,
      scaffoldBlockPxWidth,
      maxDepth,
    );
  }, [activeId, overId, offsetLeft, flattenedItems, scaffoldBlockPxWidth, maxDepth]);

  // ─── Search ─────────────────────────────────────────────────────────────────
  const searchMatches = React.useMemo<
    Array<{ node: TreeItem; path: Array<string | number>; treeIndex: number }>
  >(() => {
    if (!searchQuery) return [];
    const results: Array<{ node: TreeItem; path: Array<string | number>; treeIndex: number }> = [];
    let treeIndex = 0;

    function walk(items: TreeItem[], currentPath: Array<string | number>) {
      for (const item of items) {
        const path = [...currentPath, item.id];
        if (searchMethod({ node: item, searchQuery: searchQuery! })) {
          results.push({ node: item, path, treeIndex });
        }
        treeIndex++;
        if (item.children && item.expanded !== false) {
          walk(item.children, path);
        }
      }
    }

    walk(treeData, []);
    return results;
  }, [searchQuery, treeData, searchMethod]);

  React.useEffect(() => {
    searchFinishCallback?.(searchMatches);
  }, [searchMatches, searchFinishCallback]);

  const searchFocusedId = searchMatches[searchFocusOffset ?? 0]?.node.id ?? null;

  // ─── DnD sensors ────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // ─── Active item ────────────────────────────────────────────────────────────
  const activeItem = React.useMemo(
    () => (activeId ? flattenedItems.find(({ id }) => id === activeId) : null),
    [activeId, flattenedItems],
  );

  // ─── Row height helper ───────────────────────────────────────────────────────
  function getRowHeight(treeIndex: number, node: TreeItem, path: Array<string | number>) {
    if (typeof rowHeight === 'function') return rowHeight({ treeIndex, node, path });
    return rowHeight;
  }

  // ─── Toggle visibility ───────────────────────────────────────────────────────
  function handleToggleChildrenVisibility({
    node,
    path,
  }: {
    node: TreeItem;
    path: Array<string | number>;
    treeIndex: number;
  }) {
    const newExpanded = node.expanded === false ? true : false;
    const newTree = setVisibilityAtPath({
      treeData,
      path,
      expanded: newExpanded,
    });
    onChange(newTree);
    onVisibilityToggle?.({ treeData: newTree, node, expanded: newExpanded, path });
  }

  // ─── DnD handlers ────────────────────────────────────────────────────────────
  function handleDragStart({ active: { id } }: DragStartEvent) {
    setActiveId(id);
    setOverId(id);
    document.body.style.setProperty('cursor', 'grabbing');
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();

    if (!projected || !over) return;

    const { depth, parentId } = projected;

    const clonedItems = flattenTree(treeData);
    const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
    const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
    const activeTreeItem = clonedItems[activeIndex];

    clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

    const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
    const newTree = setTreeFromFlatItems(sortedItems, treeData);

    // Check canDrop
    const prevPath = getPathForId(treeData, active.id) ?? [];
    const nextPath = getPathForId(newTree, active.id) ?? [];
    const nextParentNode = parentId !== null ? findItemById(newTree, parentId) ?? null : null;

    if (canDrop) {
      const prevParent = getParentNode(treeData, prevPath);
      const allowed = canDrop({
        node: activeTreeItem,
        prevPath,
        prevParent,
        nextParent: nextParentNode,
        nextDepth: depth,
      });
      if (!allowed) return;
    }

    onChange(newTree);

    onMoveNode?.({
      treeData: newTree,
      node: activeTreeItem,
      nextParentNode,
      prevPath,
      prevTreeIndex: activeIndex,
      nextPath,
      nextTreeIndex: overIndex,
    });
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    document.body.style.setProperty('cursor', '');
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DndContext
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div
        aria-label="Sortable tree"
        className={className}
        css={[
          css`
            position: relative;
            width: 100%;
            overflow: auto;
          `,
        ]}
        role="tree"
        style={style}
      >
        <div style={innerStyle}>
          <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
            {flattenedItems.map((item, index) => {
              const path = getPathForId(treeData, item.id) ?? [item.id];
              const isSearchMatch =
                !!searchQuery && searchMatches.some((m) => m.node.id === item.id);
              const isSearchFocus = item.id === searchFocusedId;

              const resolvedCanDrag =
                typeof canDrag === 'function'
                  ? canDrag({ node: item, path, treeIndex: index })
                  : canDrag;

              const extraProps =
                generateNodeProps?.({
                  node: item,
                  path,
                  treeIndex: index,
                  isSearchMatch,
                  isSearchFocus,
                  parentNode: getParentNode(treeData, path),
                }) ?? {};

              const isGhost = activeId === item.id;
              const overDepth = isGhost && projected ? projected.depth : undefined;

              return (
                <SortableTreeItem
                  key={item.id}
                  canDrag={resolvedCanDrag}
                  depth={item.depth}
                  extraNodeProps={extraProps}
                  indentationWidth={scaffoldBlockPxWidth}
                  isGhost={isGhost}
                  isSearchFocus={isSearchFocus}
                  isSearchMatch={isSearchMatch}
                  item={item}
                  nodeContentRenderer={NodeContentRenderer}
                  overDepth={overDepth}
                  path={path}
                  rowHeight={getRowHeight(index, item, path)}
                  toggleChildrenVisibility={handleToggleChildrenVisibility}
                  treeIndex={index}
                />
              );
            })}
          </SortableContext>
        </div>
      </div>

      <Portal>
        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeItem ? (
            <SortableTreeItem
              canDrag={false}
              depth={activeItem.depth}
              indentationWidth={scaffoldBlockPxWidth}
              isDragOverlay
              item={activeItem}
              nodeContentRenderer={NodeContentRenderer}
              path={[activeItem.id]}
              rowHeight={
                typeof rowHeight === 'function'
                  ? rowHeight({
                      treeIndex: 0,
                      node: activeItem,
                      path: [activeItem.id],
                    })
                  : rowHeight
              }
              toggleChildrenVisibility={handleToggleChildrenVisibility}
              treeIndex={0}
            />
          ) : null}
        </DragOverlay>
      </Portal>
    </DndContext>
  );
}
