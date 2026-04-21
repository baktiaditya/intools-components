'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { css } from '@emotion/react';

import type { FlattenedItem, NodeRendererProps, TreeItem } from './types';

interface SortableTreeItemProps {
  canDrag: boolean;
  depth: number;
  extraNodeProps?: Record<string, unknown>;
  indentationWidth: number;
  isClone?: boolean;
  isDragOverlay?: boolean;
  isGhost?: boolean;
  isSearchFocus?: boolean;
  isSearchMatch?: boolean;
  item: FlattenedItem;
  nodeContentRenderer: React.ComponentType<NodeRendererProps>;
  overDepth?: number;
  path: Array<string | number>;
  rowHeight: number;
  style?: React.CSSProperties;
  toggleChildrenVisibility?: (params: {
    node: TreeItem;
    path: Array<string | number>;
    treeIndex: number;
  }) => void;
  treeIndex: number;
}

export function SortableTreeItem({
  canDrag,
  depth,
  extraNodeProps,
  indentationWidth,
  isClone,
  isDragOverlay,
  isGhost,
  isSearchFocus,
  isSearchMatch,
  item,
  nodeContentRenderer: NodeRenderer,
  overDepth,
  path,
  rowHeight,
  style: styleProp,
  toggleChildrenVisibility,
  treeIndex,
}: SortableTreeItemProps) {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id: item.id,
    animateLayoutChanges: () => false,
  });

  const effectiveDepth = isDragOverlay ? depth : overDepth ?? depth;

  const wrapperStyle: React.CSSProperties = {
    paddingLeft: effectiveDepth * indentationWidth,
    height: rowHeight,
    ...styleProp,
  };

  const itemStyle: React.CSSProperties =
    isDragOverlay || isClone
      ? {}
      : {
          transform: CSS.Translate.toString(transform),
          transition,
        };

  // connectDragSource wraps the drag handle with listeners/attributes
  const connectDragSource = React.useCallback(
    (node: React.ReactNode) => {
      if (!canDrag) return node;
      return (
        <span ref={setDraggableNodeRef} className="touch-none" {...attributes} {...listeners}>
          {node}
        </span>
      );
    },
    [canDrag, setDraggableNodeRef, attributes, listeners],
  );

  return (
    <div
      ref={isDragOverlay ? undefined : setDroppableNodeRef}
      css={[
        css`
          position: relative;
          box-sizing: border-box;
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
          padding-right: 1rem;
        `,
        isGhost &&
          css`
            opacity: 0.5;
          `,
        isDragging &&
          !isDragOverlay &&
          css`
            z-index: 10;
          `,
        isSorting &&
          css`
            pointer-events: none;
          `,
      ]}
      style={{ ...wrapperStyle, ...itemStyle }}
    >
      <NodeRenderer
        canDrag={canDrag}
        connectDragSource={connectDragSource}
        isDragging={isDragging && !isDragOverlay}
        isSearchFocus={isSearchFocus}
        isSearchMatch={isSearchMatch}
        node={item}
        path={path}
        toggleChildrenVisibility={toggleChildrenVisibility}
        treeIndex={treeIndex}
        {...extraNodeProps}
      />
    </div>
  );
}
