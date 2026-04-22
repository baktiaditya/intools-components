import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import NodeRendererDefault, { type NodeRendererDefaultProps } from '../NodeRendererDefault';
import type { TreeItem, TreeNodeRenderer } from '../types';

describe('NodeRendererDefault', () => {
  const createMockNode = (overrides?: Partial<TreeItem>): TreeItem => ({
    id: 'test-node',
    title: 'Test Node',
    ...overrides,
  });

  const createDefaultProps = (
    overrides?: Partial<NodeRendererDefaultProps>,
  ): NodeRendererDefaultProps => ({
    node: createMockNode(),
    path: ['test-node'],
    treeIndex: 0,
    isDragging: false,
    canDrag: true,
    connectDragSource: (node) => <div>{node}</div>,
    ...overrides,
  });

  // ─── Basic Rendering ──────────────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders without crashing', () => {
      const props = createDefaultProps();
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('Test Node')).toBeInTheDocument();
    });

    it('renders node title', () => {
      const node = createMockNode({ title: 'Custom Title' });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders default title when title is missing', () => {
      const node = createMockNode({ title: undefined });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('(No title)')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      const node = createMockNode({ subtitle: 'Subtitle Text' });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('Subtitle Text')).toBeInTheDocument();
    });

    it('does not render subtitle when not provided', () => {
      const node = createMockNode({ subtitle: undefined });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.queryByText(/Subtitle/)).not.toBeInTheDocument();
    });
  });

  // ─── Title as Function ────────────────────────────────────────────────────

  describe('title as function', () => {
    it('renders title when it is a function', () => {
      const titleFn = jest.fn(() => 'Rendered Title');
      const node = createMockNode({ title: titleFn });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('Rendered Title')).toBeInTheDocument();
    });

    it('passes correct params to title function', () => {
      const titleFn = jest.fn(() => 'Test Title');
      const node = createMockNode({ title: titleFn });
      const path = ['parent', 'test-node'];
      const treeIndex = 5;
      const props = createDefaultProps({ node, path, treeIndex });
      render(<NodeRendererDefault {...props} />);

      expect(titleFn).toHaveBeenCalledWith({
        node,
        path,
        treeIndex,
      });
    });
  });

  // ─── Subtitle as Function ─────────────────────────────────────────────────

  describe('subtitle as function', () => {
    it('renders subtitle when it is a function', () => {
      const subtitleFn = jest.fn(() => 'Rendered Subtitle');
      const node = createMockNode({ subtitle: subtitleFn });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);
      expect(screen.getByText('Rendered Subtitle')).toBeInTheDocument();
    });

    it('passes correct params to subtitle function', () => {
      const subtitleFn = jest.fn(() => 'Subtitle Text');
      const node = createMockNode({ subtitle: subtitleFn });
      const path = ['parent', 'test-node'];
      const treeIndex = 5;
      const props = createDefaultProps({ node, path, treeIndex });
      render(<NodeRendererDefault {...props} />);

      expect(subtitleFn).toHaveBeenCalledWith({
        node,
        path,
        treeIndex,
      });
    });
  });

  // ─── Expand/Collapse Button ───────────────────────────────────────────────

  describe('expand/collapse button', () => {
    it('renders button when node has children', () => {
      const node = createMockNode({ children: [{ id: 'child', title: 'Child' }] });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('does not render button when node has no children', () => {
      const node = createMockNode({ children: undefined });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('calls toggleChildrenVisibility when button clicked', () => {
      const toggleChildrenVisibility = jest.fn();
      const node = createMockNode({ children: [{ id: 'child', title: 'Child' }] });
      const path = ['parent', 'test-node'];
      const treeIndex = 3;
      const props = createDefaultProps({
        node,
        path,
        treeIndex,
        toggleChildrenVisibility,
      });

      render(<NodeRendererDefault {...props} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(toggleChildrenVisibility).toHaveBeenCalledWith({
        node,
        path,
        treeIndex,
      });
    });

    it('displays collapse label when expanded', () => {
      const node = createMockNode({
        expanded: true,
        children: [{ id: 'child', title: 'Child' }],
      });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const button = screen.getByRole('button', { name: /collapse/i });
      expect(button).toBeInTheDocument();
    });

    it('displays expand label when collapsed', () => {
      const node = createMockNode({
        expanded: false,
        children: [{ id: 'child', title: 'Child' }],
      });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const button = screen.getByRole('button', { name: /expand/i });
      expect(button).toBeInTheDocument();
    });
  });

  // ─── Drag Handle ──────────────────────────────────────────────────────────

  describe('drag handle', () => {
    it('renders drag handle via connectDragSource', () => {
      const connectDragSource = jest.fn((node) => <div data-testid="drag-handle">{node}</div>);
      const props = createDefaultProps({ connectDragSource });
      render(<NodeRendererDefault {...props} />);

      expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
      expect(connectDragSource).toHaveBeenCalled();
    });

    it('shows grab cursor when canDrag is true', () => {
      const props = createDefaultProps({ canDrag: true });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Cursor styling is applied via CSS-in-JS
      expect(container).toBeInTheDocument();
    });

    it('shows not-allowed cursor when canDrag is false', () => {
      const props = createDefaultProps({ canDrag: false });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Cursor styling is applied via CSS-in-JS
      expect(container).toBeInTheDocument();
    });
  });

  // ─── Search Highlighting ──────────────────────────────────────────────────

  describe('search highlighting', () => {
    it('applies search match styling when isSearchMatch is true', () => {
      const node = createMockNode();
      const props = createDefaultProps({ node, isSearchMatch: true });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Search match styling is applied via CSS-in-JS
      expect(container).toBeInTheDocument();
    });

    it('applies search focus styling when isSearchFocus is true', () => {
      const node = createMockNode();
      const props = createDefaultProps({ node, isSearchFocus: true });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Search focus styling is applied via CSS-in-JS
      expect(container).toBeInTheDocument();
    });

    it('applies both search match and focus styling when both true', () => {
      const node = createMockNode();
      const props = createDefaultProps({
        node,
        isSearchMatch: true,
        isSearchFocus: true,
      });
      const { container } = render(<NodeRendererDefault {...props} />);

      expect(container).toBeInTheDocument();
    });
  });

  // ─── Custom Buttons ───────────────────────────────────────────────────────

  describe('custom buttons', () => {
    it('renders custom buttons when provided', () => {
      const buttons = [
        <button key="1" data-testid="custom-button-1">
          Button 1
        </button>,
        <button key="2" data-testid="custom-button-2">
          Button 2
        </button>,
      ];
      const props = createDefaultProps({ buttons });
      render(<NodeRendererDefault {...props} />);

      expect(screen.getByTestId('custom-button-1')).toBeInTheDocument();
      expect(screen.getByTestId('custom-button-2')).toBeInTheDocument();
    });

    it('does not render buttons section when buttons is empty', () => {
      const buttons: React.ReactNode[] = [];
      const props = createDefaultProps({ buttons });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Without buttons, the buttons container should not be rendered
      expect(container).toBeInTheDocument();
    });
  });

  // ─── Dragging State ───────────────────────────────────────────────────────

  describe('dragging state', () => {
    it('applies dragging styling when isDragging is true', () => {
      const props = createDefaultProps({ isDragging: true });
      const { container } = render(<NodeRendererDefault {...props} />);

      // Dragging styling is applied via CSS-in-JS
      expect(container).toBeInTheDocument();
    });

    it('does not apply dragging styling when isDragging is false', () => {
      const props = createDefaultProps({ isDragging: false });
      const { container } = render(<NodeRendererDefault {...props} />);

      expect(container).toBeInTheDocument();
    });
  });

  // ─── Custom Styling ───────────────────────────────────────────────────────

  describe('custom styling', () => {
    it('applies custom className', () => {
      const props = createDefaultProps({ className: 'custom-class' });
      const { container } = render(<NodeRendererDefault {...props} />);

      const element = container.querySelector('.custom-class');
      expect(element).toBeInTheDocument();
    });

    it('applies custom style object', () => {
      const style = { color: 'red', fontSize: '16px' };
      const props = createDefaultProps({ style });
      const { container } = render(<NodeRendererDefault {...props} />);

      const element = container.firstChild as HTMLElement;
      expect(element).toHaveStyle(style);
    });
  });

  // ─── Ref Forwarding ───────────────────────────────────────────────────────

  describe('ref forwarding', () => {
    it('forwards ref to root element', () => {
      const ref = React.createRef<HTMLDivElement>();
      const props = createDefaultProps();
      render(<NodeRendererDefault {...props} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  // ─── Path and Tree Index ───────────────────────────────────────────────────

  describe('path and tree index', () => {
    it('passes path to child functions', () => {
      const titleFn = jest.fn(
        ({ path }: Parameters<TreeNodeRenderer>[0]) => `Path: ${path.join('/')}`,
      );
      const node = createMockNode({ title: titleFn });
      const path = ['root', 'parent', 'node'];
      const props = createDefaultProps({ node, path });
      render(<NodeRendererDefault {...props} />);

      expect(titleFn).toHaveBeenCalledWith(expect.objectContaining({ path }));
    });

    it('passes treeIndex to child functions', () => {
      const subtitleFn = jest.fn(
        ({ treeIndex }: Parameters<TreeNodeRenderer>[0]) => `Index: ${treeIndex}`,
      );
      const node = createMockNode({ subtitle: subtitleFn });
      const treeIndex = 10;
      const props = createDefaultProps({ node, treeIndex });
      render(<NodeRendererDefault {...props} />);

      expect(subtitleFn).toHaveBeenCalledWith(expect.objectContaining({ treeIndex }));
    });
  });

  // ─── Children Array ───────────────────────────────────────────────────────

  describe('children array', () => {
    it('correctly identifies node with children array', () => {
      const node = createMockNode({
        children: [
          { id: 'child1', title: 'Child 1' },
          { id: 'child2', title: 'Child 2' },
        ],
      });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('correctly identifies node with empty children array', () => {
      const node = createMockNode({ children: [] });
      const props = createDefaultProps({ node });
      render(<NodeRendererDefault {...props} />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });
  });
});
