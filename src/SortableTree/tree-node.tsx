import React, { Children, cloneElement } from 'react';
import isEqual from 'react-fast-compare';
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { isFunction, omit } from 'lodash-es';

import { type InjectedTreeProps, type TreeRendererProps } from './types';

type Props = TreeRendererProps & InjectedTreeProps;

const omittedProps: Array<keyof Pick<Props, 'getPrevRow' | 'treeId'>> = ['getPrevRow', 'treeId'];

const TreeNodeComponent = (props: Props) => {
  const {
    canDrop = false,
    children,
    draggedNode,
    listIndex,
    lowerSiblingCounts,
    node: _node,
    path: _path,
    rowDirection = 'ltr',
    rowHeight,
    scaffoldBlockPxWidth,
    swapDepth,
    swapFrom,
    swapLength,
    treeIndex,
    ...otherProps
  } = omit(props, omittedProps);

  const dropId = `drop-${_path.join('-')}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { node: _node, path: _path, treeIndex },
  });

  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;

  // Construct the scaffold representing the structure of the tree
  const scaffoldBlockCount = lowerSiblingCounts.length;
  const scaffold: React.JSX.Element[] = [];
  for (const [i, lowerSiblingCount] of lowerSiblingCounts.entries()) {
    let lineClass = '';
    if (lowerSiblingCount > 0) {
      // At this level in the tree, the nodes had sibling nodes further down

      if (listIndex === 0) {
        // Top-left corner of the tree
        // +-----+
        // |     |
        // |  +--+
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineHalfHorizontalRight rst__lineHalfVerticalBottom';
      } else if (i === scaffoldBlockCount - 1) {
        // Last scaffold block in the row, right before the row content
        // +--+--+
        // |  |  |
        // |  +--+
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineHalfHorizontalRight rst__lineFullVertical';
      } else {
        // Simply connecting the line extending down to the next sibling on this level
        // +--+--+
        // |  |  |
        // |  |  |
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineFullVertical';
      }
    } else if (listIndex === 0) {
      // Top-left corner of the tree, but has no siblings
      // +-----+
      // |     |
      // |  +--+
      // |     |
      // +-----+
      lineClass = 'rst__lineHalfHorizontalRight';
    } else if (i === scaffoldBlockCount - 1) {
      // The last or only node in this level of the tree
      // +--+--+
      // |  |  |
      // |  +--+
      // |     |
      // +-----+
      lineClass = 'rst__lineHalfVerticalTop rst__lineHalfHorizontalRight';
    }

    scaffold.push(
      <div
        key={`pre_${1 + i}`}
        className={clsx('rst__lineBlock', lineClass, rowDirectionClass)}
        style={{ width: scaffoldBlockPxWidth }}
      />,
    );

    if (treeIndex !== listIndex && i === swapDepth) {
      // This row has been shifted, and is at the depth of
      // the line pointing to the new destination
      let highlightLineClass = '';

      if (listIndex === swapFrom! + swapLength! - 1) {
        // This block is on the bottom (target) line
        // This block points at the target block (where the row will go when released)
        highlightLineClass = 'rst__highlightBottomLeftCorner';
      } else if (treeIndex === swapFrom) {
        // This block is on the top (source) line
        highlightLineClass = 'rst__highlightTopLeftCorner';
      } else {
        // This block is between the bottom and top
        highlightLineClass = 'rst__highlightLineVertical';
      }

      const style =
        rowDirection === 'rtl'
          ? {
              width: scaffoldBlockPxWidth,
              right: scaffoldBlockPxWidth * i,
            }
          : {
              width: scaffoldBlockPxWidth,
              left: scaffoldBlockPxWidth * i,
            };

      scaffold.push(
        <div
          key={i}
          className={clsx('rst__absoluteLineBlock', highlightLineClass, rowDirectionClass)}
          style={style}
        />,
      );
    }
  }

  const style =
    rowDirection === 'rtl'
      ? { right: scaffoldBlockPxWidth * scaffoldBlockCount }
      : { left: scaffoldBlockPxWidth * scaffoldBlockCount };

  let calculatedRowHeight = rowHeight;
  if (isFunction(rowHeight)) {
    calculatedRowHeight = rowHeight(treeIndex, _node, _path);
  }

  return (
    <div
      {...otherProps}
      ref={setNodeRef}
      className={clsx('rst__node', rowDirectionClass, {
        rst__nodeIsOver: isOver,
      })}
      style={{ height: `${calculatedRowHeight}px` }}
    >
      {scaffold}

      <div className="rst__nodeContent" style={style}>
        {Children.map(children, (child) => {
          return cloneElement(child as React.ReactElement, {
            isOver,
            canDrop,
            draggedNode,
          });
        })}
      </div>
    </div>
  );
};

const propsAreEqual = (prevProps: Props, nextProps: Props) => {
  const prev = omit(prevProps, omittedProps);
  const next = omit(nextProps, omittedProps);
  return isEqual(prev, next);
};

export default React.memo(TreeNodeComponent, propsAreEqual);
