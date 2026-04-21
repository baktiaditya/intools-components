import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { omit } from 'lodash-es';

import { SortableTree } from './react-sortable-tree';
import { type TreeItem } from './types';

const meta: Meta<typeof SortableTree> = {
  title: 'Data Display/SortableTree',
  component: SortableTree,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SortableTree>;

export default meta;

type Story = StoryObj<typeof SortableTree>;

export const Default: Story = {
  render: (args) => {
    const rest = omit(args, ['onChange', 'treeData'] satisfies Array<keyof typeof args>);

    const [treeData, setTreeData] = React.useState<TreeItem[]>([
      { title: 'Item A', children: [{ title: 'Item A.1' }] },
      { title: 'Item B', children: [{ title: 'Item B.1' }] },
    ]);

    return (
      <Box h="100vh" w="100vw">
        <SortableTree onChange={setTreeData} treeData={treeData} {...rest} />
      </Box>
    );
  },
};

export const Callbacks: Story = {
  render: (args) => {
    const rest = omit(args, ['onChange', 'treeData'] satisfies Array<keyof typeof args>);

    const [state, setState] = React.useState<{
      lastMoveNextPath?: number[];
      lastMoveNode: TreeItem | null;
      lastMovePrevPath: number[] | null;
      treeData: TreeItem[];
    }>({
      lastMoveNode: null,
      lastMovePrevPath: null,
      treeData: [
        { title: 'Chicken', children: [{ title: 'Egg' }] },
        { title: 'Fish', children: [{ title: 'Fingerline' }] },
      ],
    });

    React.useEffect(() => {
      if (!state.lastMoveNode || !state.lastMovePrevPath || !state.lastMoveNextPath) return;

      // eslint-disable-next-line no-console
      console.log(
        `Node "${state.lastMoveNode.title}" moved from path [${state.lastMovePrevPath?.join(
          ',',
        )}] to path [${state.lastMoveNextPath?.join(',')}]`,
      );
    }, [state.lastMoveNextPath, state.lastMoveNode, state.lastMovePrevPath]);

    const recordCall = React.useCallback((name: string, args: unknown) => {
      // eslint-disable-next-line no-console
      console.log(`${name} called with arguments:`, args);
    }, []);

    return (
      <Box h="calc(100vh - 32px)" p="16px" w="calc(100vw - 32px)">
        <Text>Open your "Action" tab to see callback parameter info.</Text>

        <SortableTree
          {...rest}
          onChange={(treeData) => setState((prev) => ({ ...prev, treeData }))}
          onDragStateChanged={(args) => recordCall('onDragStateChanged', args)}
          onMoveNode={(args) => {
            recordCall('onMoveNode', args);
            const { nextPath, node, prevPath } = args;

            setState((prev) => ({
              ...prev,
              lastMovePrevPath: prevPath,
              lastMoveNextPath: nextPath,
              lastMoveNode: node,
            }));
          }}
          onVisibilityToggle={(args) => recordCall('onVisibilityToggle', args)}
          treeData={state.treeData}
        />
      </Box>
    );
  },
};
