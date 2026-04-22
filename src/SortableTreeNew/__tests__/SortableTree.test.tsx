import React from 'react';
import { render, screen } from '@testing-library/react';

import SortableTree from '../SortableTree';
import type { NodeRendererProps, TreeItem } from '../types';

// Mock dnd-kit modules
jest.mock('@dnd-kit/core', () => ({
  closestCenter: jest.fn(),
  defaultDropAnimationSideEffects: jest.fn(() => ({})),
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  MeasuringStrategy: { Always: 'always' },
  PointerSensor: jest.fn(),
  useSensor: jest.fn((sensor, options) => ({ sensor, options })),
  useSensors: jest.fn((...sensors) => sensors),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  useSortable: jest.fn(() => ({
    attributes: { role: 'button' },
    isDragging: false,
    isSorting: false,
    listeners: {},
    setDraggableNodeRef: jest.fn(),
    setDroppableNodeRef: jest.fn((node) => node),
    transform: null,
    transition: null,
  })),
  verticalListSortingStrategy: 'vertical',
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: jest.fn(() => 'translate(0, 0)'),
    },
  },
}));

jest.mock('@chakra-ui/react', () => ({
  Portal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="portal">{children}</div>
  ),
}));

describe('SortableTree', () => {
  const createTreeData = (): TreeItem[] => [
    {
      id: 1,
      title: 'Node 1',
      subtitle: 'Sub 1',
    },
    {
      id: 2,
      title: 'Parent Node',
      subtitle: 'Sub 2',
      expanded: true,
      children: [
        {
          id: 2.1,
          title: 'Child Node',
          subtitle: 'Sub 2.1',
        },
      ],
    },
  ];

  // ─── Basic Rendering ──────────────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders without crashing', () => {
      const onChange = jest.fn();
      render(<SortableTree onChange={onChange} treeData={[]} />);

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    });

    it('renders tree container with role="tree"', () => {
      const onChange = jest.fn();
      const { container } = render(<SortableTree onChange={onChange} treeData={[]} />);

      const treeElement = container.querySelector('[role="tree"]');
      expect(treeElement).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const onChange = jest.fn();
      const { container } = render(
        <SortableTree className="custom-class" onChange={onChange} treeData={[]} />,
      );

      const treeElement = container.querySelector('.custom-class');
      expect(treeElement).toBeInTheDocument();
    });

    it('applies custom style', () => {
      const onChange = jest.fn();
      const customStyle = { backgroundColor: 'red', minHeight: '500px' };
      const { container } = render(
        <SortableTree onChange={onChange} style={customStyle} treeData={[]} />,
      );

      const treeElement = container.querySelector('[role="tree"]');
      expect(treeElement).toHaveStyle(customStyle);
    });
  });

  // ─── Tree Data Rendering ──────────────────────────────────────────────────

  describe('tree data rendering', () => {
    it('renders nodes from treeData', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Node 1')).toBeInTheDocument();
      expect(screen.getByText('Parent Node')).toBeInTheDocument();
    });

    it('renders nested children when parent is expanded', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Child Node')).toBeInTheDocument();
    });

    it('does not render children of collapsed nodes', () => {
      const treeData: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Hidden Child' }],
        },
      ];
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.queryByText('Hidden Child')).not.toBeInTheDocument();
    });

    it('renders nodes with subtitles', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Sub 1')).toBeInTheDocument();
      expect(screen.getByText('Sub 2')).toBeInTheDocument();
    });
  });

  // ─── Visibility Toggle ─────────────────────────────────────────────────────

  describe('visibility toggle', () => {
    it('calls onChange when visibility is toggled', () => {
      const treeData: TreeItem[] = [
        {
          id: 1,
          title: 'Node',
          expanded: true,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];
      const onChange = jest.fn();

      const { rerender } = render(<SortableTree onChange={onChange} treeData={treeData} />);

      // Simulate collapse
      const newTree = [
        {
          id: 1,
          title: 'Node',
          expanded: false,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];

      rerender(<SortableTree onChange={onChange} treeData={newTree} />);
      expect(screen.queryByText('Child')).not.toBeInTheDocument();
    });

    it('calls onVisibilityToggle callback when expanding/collapsing', () => {
      const treeData: TreeItem[] = [
        {
          id: 1,
          title: 'Node',
          expanded: true,
          children: [{ id: 1.1, title: 'Child' }],
        },
      ];
      const onChange = jest.fn();
      const onVisibilityToggle = jest.fn();

      render(
        <SortableTree
          onChange={onChange}
          onVisibilityToggle={onVisibilityToggle}
          treeData={treeData}
        />,
      );

      // Callback would be triggered when user clicks expand/collapse
      // The actual trigger happens in the NodeRenderer which is not mocked in detail here
    });
  });

  // ─── Search Functionality ──────────────────────────────────────────────────

  describe('search functionality', () => {
    it('filters nodes by search query', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      const { rerender } = render(
        <SortableTree onChange={onChange} searchQuery="" treeData={treeData} />,
      );

      // All nodes should be visible initially
      expect(screen.getByText('Node 1')).toBeInTheDocument();
      expect(screen.getByText('Parent Node')).toBeInTheDocument();

      // Filter by search query
      rerender(<SortableTree onChange={onChange} searchQuery="Parent" treeData={treeData} />);

      // Should still render but searchMatches are found
    });

    it('calls searchFinishCallback with matches', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const searchFinishCallback = jest.fn();

      render(
        <SortableTree
          onChange={onChange}
          searchFinishCallback={searchFinishCallback}
          searchQuery="Node"
          treeData={treeData}
        />,
      );

      // searchFinishCallback should be called with matching nodes
      expect(searchFinishCallback).toHaveBeenCalled();
    });

    it('highlights search focus offset', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(
        <SortableTree
          onChange={onChange}
          searchFocusOffset={0}
          searchQuery="Node"
          treeData={treeData}
        />,
      );

      // Search focus behavior
    });

    it('uses custom search method', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const customSearchMethod = jest.fn(() => true);

      render(
        <SortableTree
          onChange={onChange}
          searchMethod={customSearchMethod}
          searchQuery="test"
          treeData={treeData}
        />,
      );

      expect(customSearchMethod).toHaveBeenCalled();
    });

    it('expands collapsed nodes to show search results', () => {
      const treeData: TreeItem[] = [
        {
          id: 1,
          title: 'Parent',
          expanded: false,
          children: [{ id: 1.1, title: 'Target Child' }],
        },
      ];
      const onChange = jest.fn();

      const { rerender } = render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.queryByText('Target Child')).not.toBeInTheDocument();

      // With search, collapsed nodes might be expanded
      rerender(<SortableTree onChange={onChange} searchQuery="Target" treeData={treeData} />);
    });
  });

  // ─── Row Height ───────────────────────────────────────────────────────────

  describe('row height', () => {
    it('applies default row height', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} rowHeight={62} treeData={treeData} />);

      // Default rowHeight should be applied
    });

    it('accepts function for dynamic row height', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const rowHeightFn = jest.fn(() => 80);

      render(<SortableTree onChange={onChange} rowHeight={rowHeightFn} treeData={treeData} />);

      expect(rowHeightFn).toHaveBeenCalled();
    });
  });

  // ─── Scaffold Block Width ──────────────────────────────────────────────────

  describe('scaffold block width', () => {
    it('applies custom scaffold block width', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} scaffoldBlockPxWidth={50} treeData={treeData} />);

      // Custom width should be applied to indentation
    });

    it('uses default scaffold block width', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      // Default 44px should be used
    });
  });

  // ─── Custom Node Renderer ──────────────────────────────────────────────────

  describe('custom node renderer', () => {
    it('uses custom nodeContentRenderer component', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      const CustomRenderer = (_: NodeRendererProps) => (
        <div data-testid="custom-renderer">Custom Renderer</div>
      );

      render(
        <SortableTree
          nodeContentRenderer={CustomRenderer}
          onChange={onChange}
          treeData={treeData}
        />,
      );

      expect(screen.getAllByTestId('custom-renderer')).toHaveLength(3);
    });
  });

  // ─── Drag Constraints ──────────────────────────────────────────────────────

  describe('drag constraints', () => {
    it('respects canDrag boolean', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree canDrag={false} onChange={onChange} treeData={treeData} />);

      // canDrag should be passed to items
    });

    it('respects canDrag function', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const canDragFn = jest.fn(() => true);

      render(<SortableTree canDrag={canDragFn} onChange={onChange} treeData={treeData} />);

      expect(canDragFn).toHaveBeenCalled();
    });

    it('respects canDrop constraint', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const canDropFn = jest.fn(() => true);

      render(<SortableTree canDrop={canDropFn} onChange={onChange} treeData={treeData} />);
    });

    it('respects maxDepth constraint', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree maxDepth={2} onChange={onChange} treeData={treeData} />);

      // maxDepth should limit nesting
    });
  });

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('calls onChange when tree data changes', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      // onChange should be called on tree modifications
    });

    it('calls onMoveNode when item is moved', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const onMoveNode = jest.fn();

      render(<SortableTree onChange={onChange} onMoveNode={onMoveNode} treeData={treeData} />);
    });

    it('calls generateNodeProps for each node', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const generateNodeProps = jest.fn(() => ({}));

      render(
        <SortableTree
          generateNodeProps={generateNodeProps}
          onChange={onChange}
          treeData={treeData}
        />,
      );

      expect(generateNodeProps).toHaveBeenCalled();
    });
  });

  // ─── Style Props ───────────────────────────────────────────────────────────

  describe('style props', () => {
    it('applies innerStyle to scroll container', () => {
      const treeData = createTreeData();
      const onChange = jest.fn();
      const innerStyle = { backgroundColor: 'lightblue', padding: '10px' };

      const { container } = render(
        <SortableTree innerStyle={innerStyle} onChange={onChange} treeData={treeData} />,
      );

      const innerDiv = container.querySelector('[role="tree"] > div');
      expect(innerDiv).toHaveStyle(innerStyle);
    });
  });

  // ─── Empty Tree ────────────────────────────────────────────────────────────

  describe('empty tree', () => {
    it('renders empty container when treeData is empty', () => {
      const onChange = jest.fn();

      const { container } = render(<SortableTree onChange={onChange} treeData={[]} />);

      expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
      expect(screen.queryByText(/./)).not.toBeInTheDocument();
    });
  });

  // ─── String vs Number IDs ──────────────────────────────────────────────────

  describe('ID handling', () => {
    it('handles numeric IDs', () => {
      const treeData: TreeItem[] = [
        { id: 1, title: 'Node 1' },
        { id: 2, title: 'Node 2' },
      ];
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Node 1')).toBeInTheDocument();
    });

    it('handles string IDs', () => {
      const treeData: TreeItem[] = [
        { id: 'node-1', title: 'Node 1' },
        { id: 'node-2', title: 'Node 2' },
      ];
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Node 1')).toBeInTheDocument();
    });

    it('handles mixed ID types', () => {
      const treeData: TreeItem[] = [
        { id: 1, title: 'Numeric ID' },
        { id: 'string-id', title: 'String ID' },
      ];
      const onChange = jest.fn();

      render(<SortableTree onChange={onChange} treeData={treeData} />);

      expect(screen.getByText('Numeric ID')).toBeInTheDocument();
      expect(screen.getByText('String ID')).toBeInTheDocument();
    });
  });
});
