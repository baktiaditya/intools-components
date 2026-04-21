import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';

import { type PlaceholderRendererProps } from './types';

const PlaceholderRendererDefault = (props: PlaceholderRendererProps) => {
  const { canDrop = false, isOver = false } = props;

  const { isOver: isDroppableOver, setNodeRef } = useDroppable({
    id: 'tree-root',
  });

  const activeIsOver = isOver || isDroppableOver;

  return (
    <div
      ref={setNodeRef}
      className={clsx('rst__placeholder', {
        ['rst__placeholderLandingPad']: canDrop,
        ['rst__placeholderCancelPad']: canDrop && !activeIsOver,
      })}
    />
  );
};

export default PlaceholderRendererDefault;
