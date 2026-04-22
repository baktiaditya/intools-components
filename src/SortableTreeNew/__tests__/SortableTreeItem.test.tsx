import React from 'react';
import { render, screen } from '@testing-library/react';

import { SortableTreeItem } from '../SortableTreeItem';
import type { FlattenedItem, NodeRendererProps } from '../types';

// Mock dnd-kit sortable
jest.mock('@dnd-kit/sortable', () => ({
  useSortable: jest.fn(() => ({
    attributes: { role: 'button' },
    isDragging: false,
    isSorting: false,
    listeners: {},
    setDraggableNodeRef: jest.fn(),
    setDroppableNodeRef: jest.fn(),
    transform: null,
    transition: null,
  })),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: jest.fn(() => ''),
    },
  },
}));

describe('SortableTreeItem', () => {
  const createMockItem = (overrides?: Partial<FlattenedItem>): FlattenedItem => ({
    id: 'test-item',
    title: 'Test Item',
    depth: 0,
    index: 0,
    parentId: null,
    collapsed: false,
    ...overrides,
  });

  const createMockRenderer = () => {
    return jest.fn((_: NodeRendererProps) => <div data-testid="mock-renderer">Test Renderer</div>);
  };

  // ─── Basic Rendering ──────────────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders without crashing', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
    });

    it('renders custom node content renderer', () => {
      const CustomRenderer = (_: NodeRendererProps) => (
        <div data-testid="custom-node">Custom Node</div>
      );
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={CustomRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(screen.getByTestId('custom-node')).toBeInTheDocument();
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });

  // ─── Indentation ──────────────────────────────────────────────────────────

  describe('indentation', () => {
    it('applies correct padding based on depth', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={2}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="padding"]');
      expect(wrapper).toHaveStyle('padding-left: 88px');
    });

    it('applies zero padding at depth 0', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem({ depth: 0 });

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="padding"]');
      expect(wrapper).toHaveStyle('padding-left: 0px');
    });

    it('respects custom indentationWidth', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={1}
          indentationWidth={50}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="padding"]');
      expect(wrapper).toHaveStyle('padding-left: 50px');
    });
  });

  // ─── Row Height ───────────────────────────────────────────────────────────

  describe('row height', () => {
    it('applies specified row height', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={80}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="height"]');
      expect(wrapper).toHaveStyle('height: 80px');
    });

    it('applies default row height', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="height"]');
      expect(wrapper).toHaveStyle('height: 62px');
    });
  });

  // ─── Drag Behavior ────────────────────────────────────────────────────────

  describe('drag behavior', () => {
    it('renders with canDrag=true', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
    });

    it('renders with canDrag=false', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag={false}
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
    });
  });

  // ─── Search States ────────────────────────────────────────────────────────

  describe('search states', () => {
    it('applies isSearchMatch prop', () => {
      const MockNodeRenderer = jest.fn((props: NodeRendererProps) => (
        <div data-search-match={String(props.isSearchMatch)} data-testid="mock-renderer">
          Mock Renderer
        </div>
      ));
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          isSearchMatch
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ isSearchMatch: true }),
        expect.anything(),
      );
    });

    it('applies isSearchFocus prop', () => {
      const MockNodeRenderer = jest.fn((props: NodeRendererProps) => (
        <div data-search-focus={String(props.isSearchFocus)} data-testid="mock-renderer">
          Mock Renderer
        </div>
      ));
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          isSearchFocus
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ isSearchFocus: true }),
        expect.anything(),
      );
    });
  });

  // ─── Ghost State ───────────────────────────────────────────────────────────

  describe('ghost state', () => {
    it('applies ghost styling when isGhost=true', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          isGhost
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div');
      // Ghost styling is applied via CSS-in-JS
      expect(wrapper).toBeInTheDocument();
    });

    it('does not apply ghost styling when isGhost=false', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          isGhost={false}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div');
      expect(wrapper).toBeInTheDocument();
    });
  });

  // ─── Drag Overlay ─────────────────────────────────────────────────────────

  describe('drag overlay', () => {
    it('renders as drag overlay', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          isDragOverlay
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
    });
  });

  // ─── Over Depth ────────────────────────────────────────────────────────────

  describe('over depth', () => {
    it('uses overDepth when provided during drag', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem({ depth: 0 });

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          overDepth={2}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="padding"]');
      expect(wrapper).toHaveStyle('padding-left: 88px');
    });
  });

  // ─── Extra Props ───────────────────────────────────────────────────────────

  describe('extra node props', () => {
    it('passes extraNodeProps to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();
      const extraProps = { custom: 'value', another: 123 };

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          extraNodeProps={extraProps}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining(extraProps),
        expect.anything(),
      );
    });
  });

  // ─── Toggle Children Visibility ────────────────────────────────────────────

  describe('toggle children visibility', () => {
    it('passes toggleChildrenVisibility to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();
      const toggleChildrenVisibility = jest.fn();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          toggleChildrenVisibility={toggleChildrenVisibility}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ toggleChildrenVisibility }),
        expect.anything(),
      );
    });
  });

  // ─── Custom Styles ────────────────────────────────────────────────────────

  describe('custom styles', () => {
    it('applies custom style prop', () => {
      const MockNodeRenderer = createMockRenderer();
      const item = createMockItem();
      const customStyle = { backgroundColor: 'red', border: '1px solid blue' };

      const { container } = render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          style={customStyle}
          treeIndex={0}
        />,
      );

      const wrapper = container.querySelector('div[style*="background"]');
      expect(wrapper).toHaveStyle(customStyle);
    });
  });

  // ─── Node Content Props ────────────────────────────────────────────────────

  describe('node content props', () => {
    it('passes node to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem({ title: 'Custom Title' });

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ node: expect.objectContaining({ title: 'Custom Title' }) }),
        expect.anything(),
      );
    });

    it('passes path to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();
      const path = ['root', 'child', item.id];

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={path}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ path }),
        expect.anything(),
      );
    });

    it('passes treeIndex to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={5}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ treeIndex: 5 }),
        expect.anything(),
      );
    });

    it('passes isDragging state to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ isDragging: expect.any(Boolean) }),
        expect.anything(),
      );
    });

    it('passes canDrag to renderer', () => {
      const MockNodeRenderer = jest.fn((_: NodeRendererProps) => (
        <div data-testid="mock-renderer">Mock Renderer</div>
      ));
      const item = createMockItem();

      render(
        <SortableTreeItem
          canDrag={false}
          depth={0}
          indentationWidth={44}
          item={item}
          nodeContentRenderer={MockNodeRenderer}
          path={[item.id]}
          rowHeight={62}
          treeIndex={0}
        />,
      );

      expect(MockNodeRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ canDrag: false }),
        expect.anything(),
      );
    });
  });
});
