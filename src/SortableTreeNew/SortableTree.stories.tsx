import React from 'react';
import { Box } from '@chakra-ui/react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { omit } from 'lodash-es';

import SortableTree from './SortableTree';
import { type TreeItem } from './types';

const meta: Meta<typeof SortableTree> = {
  title: 'Data Display/SortableTreeNew',
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
      {
        id: '1',
        title: 'Chicken',
        expanded: true,
        children: [{ id: '1-1', title: 'Egg' }],
      },
      {
        id: '2',
        title: 'Fish',
        expanded: true,
        children: [
          {
            id: '2-1',
            title: 'Mackerel',
            expanded: true,
            children: [
              { id: '2-1-1', title: 'Atlantic Mackerel' },
              { id: '2-1-2', title: 'Pacific Mackerel' },
            ],
          },
        ],
      },
      {
        id: '3',
        title: 'Fruit',
        subtitle: 'Not a meat',
      },
    ]);

    return (
      <Box h="100vh" w="100vw">
        <SortableTree onChange={setTreeData} treeData={treeData} {...rest} />
      </Box>
    );
  },
};
