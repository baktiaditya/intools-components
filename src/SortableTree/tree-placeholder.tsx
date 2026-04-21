import React, { Children, cloneElement } from 'react';

import { useDroppable } from '@dnd-kit/core';

import { type InjectedTreeProps, type TreePlaceholderProps } from './types';

const TreePlaceholder = (props: TreePlaceholderProps & InjectedTreeProps) => {
  const { canDrop, children } = props;

  const { setNodeRef, isOver } = useDroppable({
    id: 'tree-root',
  });

  return (
    <div ref={setNodeRef}>
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement, {
          canDrop,
          isOver,
        }),
      )}
    </div>
  );
};

export default TreePlaceholder;
