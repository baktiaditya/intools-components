import React from 'react';
import clsx from 'clsx';
import { isFunction, omit } from 'lodash-es';
import { useDraggable } from '@dnd-kit/core';

import { type NodeRendererDefaultProps } from './types';

import { isDescendant } from './utils/tree-data-utils';

const omittedProps: Array<
  keyof Pick<NodeRendererDefaultProps, 'treeId' | 'isOver' | 'parentNode'>
> = ['treeId', 'isOver', 'parentNode'];

const NodeRendererDefault = (props: NodeRendererDefaultProps) => {
  const {
    buttons = [],
    canDrag = false,
    canDrop = false,
    className,
    didDrop,
    draggedNode,
    isSearchFocus = false,
    isSearchMatch = false,
    node,
    path,
    rowDirection = 'ltr',
    scaffoldBlockPxWidth,
    style,
    subtitle,
    title,
    toggleChildrenVisibility,
    treeIndex,
    ...otherProps
  } = omit(props, omittedProps);

  const nodeTitle = title || node.title;
  const nodeSubtitle = subtitle || node.subtitle;
  const rowDirectionClass = clsx({ ['rst__rtl']: rowDirection === 'rtl' });

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-${path.join('-')}`,
    data: { node, path, treeIndex },
    disabled: !canDrag,
  });

  const handle = React.useMemo(() => {
    if (canDrag) {
      if (typeof node.children === 'function' && node.expanded) {
        return (
          <div className="rst__loadingHandle">
            <div className="rst__loadingCircle">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className={clsx('rst__loadingCirclePoint', rowDirectionClass)} />
              ))}
            </div>
          </div>
        );
      } else {
        return (
          <div className="rst__moveHandle" {...attributes} {...listeners} />
        );
      }
    }
    return null;
  }, [canDrag, node.children, node.expanded, rowDirectionClass, attributes, listeners]);

  const isDraggedDescendant = draggedNode && isDescendant(draggedNode, node);
  const isLandingPadActive = !didDrop && isDragging;

  let buttonStyle = { left: -0.5 * scaffoldBlockPxWidth, right: 0 };
  if (rowDirection === 'rtl') {
    buttonStyle = { right: -0.5 * scaffoldBlockPxWidth, left: 0 };
  }

  return (
    <div style={{ height: '100%' }} {...otherProps}>
      {toggleChildrenVisibility &&
        node.children &&
        (node.children.length > 0 || typeof node.children === 'function') && (
          <div>
            <button
              aria-label={node.expanded ? 'Collapse' : 'Expand'}
              className={clsx(rowDirectionClass, {
                ['rst__collapseButton']: node.expanded,
                ['rst__expandButton']: !node.expanded,
              })}
              onClick={() =>
                toggleChildrenVisibility({
                  node,
                  path,
                  treeIndex,
                })
              }
              style={buttonStyle}
              type="button"
            />

            {node.expanded && !isDragging && (
              <div
                className={clsx('rst__lineChildren', rowDirectionClass)}
                style={{ width: scaffoldBlockPxWidth }}
              />
            )}
          </div>
        )}

      <div className={clsx('rst__rowWrapper', rowDirectionClass)} ref={setNodeRef}>
        {/* Set the row preview to be used during drag and drop */}
        <div
          className={clsx(className, rowDirectionClass, 'rst__row', {
            ['rst__rowLandingPad']: isLandingPadActive,
            ['rst__rowCancelPad']: isLandingPadActive && !canDrop,
            ['rst__rowSearchMatch']: isSearchMatch,
            ['rst__rowSearchFocus']: isSearchFocus,
          })}
          style={{
            opacity: isDraggedDescendant ? 0.5 : 1,
            ...style,
          }}
        >
          {handle}

          <div
            className={clsx('rst__rowContents', rowDirectionClass, {
              ['rst__rowContentsDragDisabled']: !canDrag,
            })}
          >
            <div className={clsx('rst__rowLabel', rowDirectionClass)}>
              <span
                className={clsx('rst__rowTitle', {
                  ['rst__rowTitleWithSubtitle']: node.subtitle,
                })}
              >
                {isFunction(nodeTitle)
                  ? nodeTitle({
                      node,
                      path,
                      treeIndex,
                    })
                  : nodeTitle}
              </span>

              {nodeSubtitle && (
                <span className="rst__rowSubtitle">
                  {isFunction(nodeSubtitle)
                    ? nodeSubtitle({
                        node,
                        path,
                        treeIndex,
                      })
                    : nodeSubtitle}
                </span>
              )}
            </div>

            <div className="rst__rowToolbar">
              {buttons.map((btn, index) => (
                <div key={index} className="rst__toolbarButton">
                  {btn}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeRendererDefault;
