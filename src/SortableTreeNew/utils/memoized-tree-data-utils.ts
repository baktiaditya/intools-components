import { memoize } from 'lodash-es';

import { getDescendantCount, getFlatDataFromTree, insertNode } from './tree-data-utils';

export const memoizedInsertNode = memoize(insertNode);
export const memoizedGetFlatDataFromTree = memoize(getFlatDataFromTree);
export const memoizedGetDescendantCount = memoize(getDescendantCount);
