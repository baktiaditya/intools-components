import React from 'react';

import { type SearchData, type TreeIndex, type TreeItem, type TreeNode } from '../types';

export const defaultGetNodeKey = (data: TreeNode & TreeIndex) => {
  return data.treeIndex;
};

// Cheap hack to get the text of a react object
const getReactElementText = (parent: React.ReactElement): string => {
  if (typeof parent === 'string') {
    return parent;
  }

  if (
    parent === undefined ||
    typeof parent !== 'object' ||
    !parent.props ||
    !parent.props.children ||
    (typeof parent.props.children !== 'string' && typeof parent.props.children !== 'object')
  ) {
    return '';
  }

  if (typeof parent.props.children === 'string') {
    return parent.props.children;
  }

  return parent.props.children
    .map((child: React.ReactElement) => getReactElementText(child))
    .join('');
};

// Search for a query string inside a node property
const stringSearch = (
  key: keyof TreeItem,
  searchQuery: string,
  node: TreeItem,
  path: number[],
  treeIndex: number,
) => {
  const currNode = node[key];
  if (typeof currNode === 'function') {
    // Search within text after calling its function to generate the text
    return String(currNode({ node, path, treeIndex })).includes(searchQuery);
  }
  if (React.isValidElement(currNode)) {
    // Search within text inside react elements
    return getReactElementText(currNode).includes(searchQuery);
  }

  // Search within string
  return currNode !== undefined && String(currNode).includes(searchQuery);
};

export const defaultSearchMethod = ({
  node,
  path,
  searchQuery,
  treeIndex,
}: SearchData): boolean => {
  return (
    stringSearch('title', searchQuery, node, path, treeIndex) ||
    stringSearch('subtitle', searchQuery, node, path, treeIndex)
  );
};
