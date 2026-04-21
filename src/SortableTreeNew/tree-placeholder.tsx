import React, { Children, cloneElement } from 'react';

import { type InjectedTreeProps, type TreePlaceholderProps } from './types';

const TreePlaceholder = (props: TreePlaceholderProps & InjectedTreeProps) => {
  const { canDrop, children, connectDropTarget, isOver } = props;

  return connectDropTarget(
    <div>
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement, {
          canDrop,
          isOver,
        }),
      )}
    </div>,
  );
};

export default TreePlaceholder;
