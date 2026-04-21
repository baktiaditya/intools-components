import React, { Children, cloneElement } from 'react';
import isEqual from 'react-fast-compare';
import clsx from 'clsx';
import { isFunction, omit } from 'lodash-es';

import { type InjectedTreeProps, type TreeRendererProps } from './types';

type Props = TreeRendererProps & InjectedTreeProps;

const omittedProps: Array<keyof Pick<Props, 'getPrevRow' | 'treeId'>> = ['getPrevRow', 'treeId'];

const TreeNodeComponent = (props: Props) => {
  const {
    canDrop = false,
    children,
    connectDropTarget,
    draggedNode,
    isOver,
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

  const nodeRef = React.useRef<HTMLDivElement>(null);
  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined;

  // Construct the scaffold representing the structure of the tree
  const scaffoldBlockCount = lowerSiblingCounts.length;
  const scaffold: React.JSX.Element[] = [];
  for (const [i, lowerSiblingCount] of lowerSiblingCounts.entries()) {
    let lineClass = '';
    if (lowerSiblingCount > 0) {
      if (listIndex === 0) {
        lineClass = 'rst__lineHalfHorizontalRight rst__lineHalfVerticalBottom';
      } else if (i === scaffoldBlockCount - 1) {
        lineClass = 'rst__lineHalfHorizontalRight rst__lineFullVertical';
      } else {
        lineClass = 'rst__lineFullVertical';
      }
    } else if (listIndex === 0) {
      lineClass = 'rst__lineHalfHorizontalRight';
    } else if (i === scaffoldBlockCount - 1) {
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
      let highlightLineClass = '';

      if (listIndex === swapFrom! + swapLength! - 1) {
        highlightLineClass = 'rst__highlightBottomLeftCorner';
      } else if (treeIndex === swapFrom) {
        highlightLineClass = 'rst__highlightTopLeftCorner';
      } else {
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

  return connectDropTarget(
    <div
      {...otherProps}
      ref={nodeRef}
      className={clsx('rst__node', rowDirectionClass)}
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
    </div>,
  );
};

const propsAreEqual = (prevProps: Props, nextProps: Props) => {
  const prev = omit(prevProps, omittedProps);
  const next = omit(nextProps, omittedProps);
  return isEqual(prev, next);
};

export default React.memo(TreeNodeComponent, propsAreEqual);
