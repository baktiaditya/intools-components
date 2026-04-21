import React from 'react';
import clsx from 'clsx';

import { type PlaceholderRendererProps } from './types';

const PlaceholderRendererDefault = (props: PlaceholderRendererProps) => {
  const { canDrop = false, isOver = false } = props;

  return (
    <div
      className={clsx('rst__placeholder', {
        ['rst__placeholderLandingPad']: canDrop,
        ['rst__placeholderCancelPad']: canDrop && !isOver,
      })}
    />
  );
};

export default PlaceholderRendererDefault;
