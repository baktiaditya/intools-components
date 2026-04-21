# Migration Plan: SortableTree from react-dnd to @dnd-kit/core

**Role:** Senior Frontend Engineer / React Expert.

**Context:** Complete refactor of the `SortableTree` component from `react-dnd` to `@dnd-kit/core`. The goal is to build a modern, hooks-based functional component while maintaining 100% API compatibility and UX parity.

---

## Summary

- **Current State**: Class-based component using `react-dnd` v2.8.0
- **Target State**: Functional component using `@dnd-kit/core` with hooks
- **API Changes**: ZERO breaking changes (props, exports, callbacks remain identical)
- **Test Strategy**: Write new test suite from scratch using @dnd-kit mocks
- **Timeline**: No deadline; focus on correctness and no mistakes

### Key Objectives

1. **Rebuild from Zero**: Rewrite as functional component with React Hooks (no patching)
2. **UX Parity**: Dragging feel, indentation logic, visual feedback must match original
3. **DragOverlay**: Implement high-fidelity drag preview with indentation indicator
4. **100% API Compatibility**: All props, exports, and callbacks unchanged

---

## Phase 1: Setup & Dependencies

### 1.1 Add @dnd-kit packages to package.json

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.x.x",
    "@dnd-kit/sortable": "^7.x.x",
    "@dnd-kit/utilities": "^3.x.x"
  },
  "devDependencies": {}
}
```

### 1.2 Verify TypeScript configuration

- Check `tsconfig.json` for `@dnd-kit` type definitions
- No additional config needed if `node_modules/@dnd-kit` types auto-resolve

### 1.3 Create new implementation file

- Create `src/SortableTree/SortableTree.new.tsx` (temporary during development)
- Preserve `src/SortableTree/react-sortable-tree.tsx` as reference until cutover
- This allows safe iteration before replacing original

### 1.4 Verify dependencies

- Run `yarn install` and ensure no conflicts
- Check that `react-dnd` and `react-dnd-html5-backend` are still functional (may be used elsewhere)

---

## Phase 2: Functional Component Structure

### 2.1 Convert state from class to hooks

| Class Property                  | Hook Equivalent           | Notes                                               |
| ------------------------------- | ------------------------- | --------------------------------------------------- |
| `state.dragging`                | `useState(false)`         | Boolean flag for drag active                        |
| `state.draggedNode`             | `useState(null)`          | Currently dragged node object                       |
| `state.draggedDepth`            | `useState(0)`             | Depth level during drag                             |
| `state.draggedMinimumTreeIndex` | `useState(0)`             | Minimum tree index reached                          |
| `state.draggingTreeData`        | `useState([])`            | Copy of tree during drag (separate from `treeData`) |
| `state.instanceProps`           | `useRef({treeData, ...})` | Cache of props (treeData, search state, callbacks)  |
| `state.searchMatches`           | `useState([])`            | Array of matched nodes from search                  |
| `state.searchFocusTreeIndex`    | `useState(null)`          | Currently focused search result                     |
| `this.expandedNodeKeys`         | `useState(Set)`           | Track expanded/collapsed nodes (new approach)       |

### 2.2 Convert lifecycle to useEffect

**componentDidMount + monitor subscription:**

```typescript
useEffect(() => {
  // Subscribe to @dnd-kit drag state changes
  // Detect drag cancellation via active.id === null
}, []);
```

**componentDidUpdate (props changes):**

```typescript
useEffect(() => {
  // Handle treeData changes
  // Handle searchQuery changes → trigger search
  // Handle searchFocusOffset changes → refocus search result
  // Use react-fast-compare for deep equality
}, [treeData, searchQuery, searchFocusOffset]);
```

**shouldComponentUpdate:**

- Use `React.memo()` wrapper on component
- Use `useMemo()` for expensive computations (tree renders, search results)

### 2.3 Convert static methods to standalone functions

**search():**

```typescript
function performSearch(
  treeData: TreeItem[],
  searchQuery: string,
  searchMethod: (node, query) => boolean,
  onComplete: (matches) => void,
) {
  // Find matching nodes, optionally expand paths
  // Call onComplete with searchMatches array
}
```

**loadLazyChildren():**

```typescript
async function loadTreeLazyChildren(treeData: TreeItem[]) {
  // Call lazy child functions
  // Replace with actual data
  // Return updated tree
}
```

**getDerivedStateFromProps logic:**

```typescript
useEffect(() => {
  // Detects treeData changes → reset drag state, reload lazy
  // Detects searchQuery changes → trigger performSearch
  // Detects searchFocusOffset → update searchFocusTreeIndex
}, [treeData, searchQuery, searchFocusOffset, searchMethod]);
```

---

## Phase 3: @dnd-kit Integration

### 3.1 Implement DndContext wrapper

```typescript
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

function SortableTree(props: ReactSortableTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),  // Match react-dnd mouse behavior
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}  // or custom grid-based for tree
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragOverlay dropAnimation={null}>
        {activeDragId ? <DragPreview /> : null}
      </DragOverlay>
      {/* Tree rows and nodes rendered here */}
    </DndContext>
  );
}
```

### 3.2 Implement useDroppable targets

**For tree rows (treeNodeRenderer):**

```typescript
function TreeNode({ node, path, treeIndex }: Props) {
  const dropId = `drop-${path.join('-')}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div ref={setNodeRef} className={isOver ? 'dragging-over' : ''}>
      {/* Node content */}
    </div>
  );
}
```

**For placeholder (empty tree):**

```typescript
function PlaceholderRenderer() {
  const { setNodeRef, isOver } = useDroppable({ id: 'tree-root' });

  return (
    <div ref={setNodeRef} className={isOver ? 'drop-active' : ''}>
      {/* Placeholder content */}
    </div>
  );
}
```

### 3.3 Implement useDraggable source

**For node content (nodeContentRenderer):**

```typescript
function NodeContentRenderer({ node, path }: Props) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `drag-${path.join('-')}`,
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      {/* Node content (title, icons, etc.) */}
    </div>
  );
}
```

### 3.4 Implement drag event handlers

**onDragStart:**

- Remove node from `treeData` via `removeNode()`
- Set `draggingTreeData = treeData` (copy)
- Set `draggedNode`, `draggedDepth`, `dragging = true`
- Prepare drag preview data

**onDragOver:**

- Get drop target position from `active` and `over` objects
- Insert `draggedNode` at preview position via `insertNode()`
- Update `draggingTreeData` with insertion
- Auto-expand parent node if needed
- Clear search focus during drag
- Update visual feedback (isDragging state)

**onDragEnd:**

- If drop was successful (over !== null):
  - Insert node at final position via `insertNode()`
  - Call `onChange(newTree)` with updated tree
  - Call `onMoveNode()` callback with movement details
- Clear drag state: `dragging = false`, `draggedNode = null`, `draggingTreeData = []`
- Fire `onDragStateChanged(false)` callback

**onDragCancel:**

- Reset all drag state without inserting node
- Clear `draggingTreeData`, `draggedNode`, `dragging = false`
- Restore original tree visual
- Fire `onDragStateChanged(false)` callback

---

## Phase 4: Drag Preview Implementation

### 4.1 Create DragOverlay component

```typescript
function DragOverlay({ draggedNode, draggedDepth }: Props) {
  if (!draggedNode) return null;

  return (
    <div className="drag-overlay">
      {/* High-fidelity clone of dragged node */}
      <div style={{ paddingLeft: `${draggedDepth * 44}px` }}>
        {/* Node content with same styles as original */}
      </div>
      {/* Indentation indicator showing target depth */}
      <DepthIndicator depth={draggedDepth} />
    </div>
  );
}
```

### 4.2 Implement drag offset transform

- Position overlay absolutely over drag source
- Use `@dnd-kit` transform utilities (CSS.Transform) for smooth animations
- Handle RTL transforms via `rowDirection` prop
- Apply opacity/scale during drag (via `isDragging` state)

---

## Phase 5: Tree Data & Utilities (No Changes)

### 5.1 Reuse existing utilities

All functions in `src/SortableTree/utils/tree-data-utils.ts` are pure functions with no `react-dnd` dependency:

- `insertNode(treeData, newNode, depth, treeIndex)` → Insert at position
- `removeNode(treeData, path)` → Remove and return { node, treeData }
- `changeNodeAtPath(treeData, path, newNode)` → Update node
- `toggleExpandedForAll(treeData, expanded)` → Expand/collapse all
- `walk(treeData, callback)` → Depth-first traversal
- `find(treeData, predicate)` → Search and expand paths

### 5.2 Reuse memoized versions

`src/SortableTree/utils/memoized-tree-data-utils.ts` provides memoized versions of above functions. These prevent unnecessary recalculations during drag.

### 5.3 Adapt dnd-manager.ts

- Original `dnd-manager.ts` handles react-dnd specific event logic
- Simplify or remove if logic moves into drag handlers
- Preserve any custom indentation/depth calculation if critical

---

## Phase 6: Node Renderers & Styling

### 6.1 Update node renderers

**tree-node.tsx** (drop target):

- Wrap root element with `setNodeRef` from `useDroppable`
- Add class/style when `isOver = true`

**node-renderer-default.tsx** (drag source):

- Wrap content element with `setNodeRef` and `{...attributes} {...listeners}` from `useDraggable`
- Render children (node content)

**placeholder-renderer-default.tsx** (fallback drop target):

- Wrap root with `setNodeRef` from `useDroppable`
- Show when tree is empty or during empty-tree drop

### 6.2 Preserve Emotion styles

All styles in `src/SortableTree/styles/` remain unchanged:

- `react-sortable-tree.style.ts` — Container and virtual scroll
- `tree-node.style.ts` — Row styling
- `node-renderer-default.style.ts` — Node content
- `placeholder-renderer-default.style.ts` — Empty state

Apply via Chakra UI `Box` component or Emotion `css` prop.

### 6.3 Drag feedback visuals

- Apply opacity/scale when `isDragging = true`
- Show drop indicators (indentation level guide) during hover
- Highlight drop targets with background color or border
- Support RTL via `rowDirection` prop (transform X axis)

---

## Phase 7: Props & API Preservation

### 7.1 Maintain all public props

**Data:**

- `treeData: TreeItem[]`
- `onChange: (treeData) => void`

**Rendering:**

- `nodeContentRenderer: React.ComponentType<NodeRendererProps>`
- `treeNodeRenderer: React.ComponentType<TreeNodeProps>`
- `placeholderRenderer?: React.ComponentType`
- `generateNodeProps?: (props) => object`

**Drag Control:**

- `canDrag?: (node, path) => boolean`
- `canDrop?: (node, path) => boolean`
- `canNodeHaveChildren?: (node) => boolean`
- `maxDepth?: number`
- `shouldCopyOnOutsideDrop?: boolean`

**Search:**

- `searchQuery?: string`
- `searchMethod?: (node, query) => boolean`
- `searchFinishCallback?: (matches) => void`
- `onlyExpandSearchedNodes?: boolean`
- `searchFocusOffset?: number`

**Layout:**

- `rowHeight?: number | ((rowIndex, node, path) => number)`
- `scaffoldBlockPxWidth?: number` (default 44)
- `slideRegionSize?: number` (default 100)
- `rowDirection?: 'ltr' | 'rtl'`
- `style?: CSSProperties`
- `innerStyle?: CSSProperties`
- `className?: string`

**Callbacks:**

- `onMoveNode?: (details) => void`
- `onVisibilityToggle?: (expanded, nodeData) => void`
- `onDragStateChanged?: (isDragging) => void`

### 7.2 Update ref handling

**Original class methods (via ref):**

```typescript
// Old: treeRef.current.search(query)
treeRef.current?.search(query)

// New: Use useImperativeHandle
useImperativeHandle(ref, () => ({
  search: (query) => performSearch(treeData, query, ...),
  loadLazyChildren: () => loadTreeLazyChildren(treeData),
}));
```

---

## Phase 8: Search & Lazy Loading

### 8.1 Implement performSearch function

```typescript
function performSearch(
  treeData: TreeItem[],
  searchQuery: string,
  searchMethod?: (node, query) => boolean,
  searchFocusOffset?: number,
  searchFinishCallback?: (matches) => void,
  onlyExpandSearchedNodes?: boolean,
) {
  // 1. Find all matching nodes
  // 2. Optionally expand paths to matches
  // 3. Update state: searchMatches, searchFocusTreeIndex
  // 4. Call searchFinishCallback(matches)
  // 5. If onlyExpandSearchedNodes, collapse non-matching branches
}
```

### 8.2 Integrate with component lifecycle

```typescript
useEffect(() => {
  if (searchQuery) {
    performSearch(
      treeData,
      searchQuery,
      searchMethod,
      searchFocusOffset,
      (matches) => {
        setSearchMatches(matches);
        setSearchFocusTreeIndex(searchFocusOffset || 0);
      },
      onlyExpandSearchedNodes,
    );
  } else {
    setSearchMatches([]);
    setSearchFocusTreeIndex(null);
  }
}, [searchQuery, searchFocusOffset, searchMethod, onlyExpandSearchedNodes, treeData]);
```

### 8.3 Maintain lazy loading

```typescript
useEffect(() => {
  // Load lazy children when treeData or lazy props change
  if (treeData.some((node) => typeof node.children === 'function')) {
    loadTreeLazyChildren(treeData).then((newTreeData) => {
      // Update state with loaded children
    });
  }
}, [treeData /* other lazy-related props */]);
```

---

## Phase 9: Testing (New Suite)

### 9.1 Setup test file structure

Create `src/SortableTree/__tests__/SortableTree.new.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortableTree } from '../SortableTree.new';

describe('SortableTree (@dnd-kit)', () => {
  // Tests here
});
```

### 9.2 Mock @dnd-kit and Virtuoso

```typescript
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }) => <div>{children}</div>,
  DragOverlay: ({ children }) => <div>{children}</div>,
  useDraggable: () => ({ setNodeRef: jest.fn(), listeners: {}, attributes: {} }),
  useDroppable: () => ({ setNodeRef: jest.fn(), isOver: false }),
  useSensors: () => [],
  useSensor: () => null,
  closestCenter: jest.fn(),
}));

jest.mock('react-virtuoso', () => ({
  VirtualizedList: ({ items, itemContent }) =>
    items.map((item, idx) => itemContent(idx, item)),
}));
```

### 9.3 Test coverage

| Area          | Tests                                                          |
| ------------- | -------------------------------------------------------------- |
| **Render**    | Basic render, empty tree, with children, custom renderers      |
| **Drag/Drop** | Start drag, hover over target, drop, indentation changes       |
| **Node Ops**  | Insert, remove, expand/collapse, move to depth                 |
| **Search**    | Query matching, focus navigation, expand matched nodes         |
| **Lazy Load** | Load children on expand, update tree data                      |
| **Custom**    | Custom renderers (nodeContent, treeNode), custom search        |
| **Callbacks** | onChange fired, onMoveNode details correct, onDragStateChanged |
| **Props**     | Props changes update tree, search triggers on query change     |
| **Virtual**   | Virtuoso renders only visible rows, large trees                |
| **RTL**       | rowDirection='rtl' applies correct transforms                  |

### 9.4 Example test patterns

**Basic render:**

```typescript
it('renders tree with nodes', () => {
  const treeData = [
    { id: '1', children: [{ id: '1-1' }] },
  ];

  render(<SortableTree treeData={treeData} onChange={jest.fn()} />);

  expect(screen.getByTestId('node-1')).toBeInTheDocument();
  expect(screen.getByTestId('node-1-1')).toBeInTheDocument();
});
```

**Drag and drop:**

```typescript
it('moves node to new position on drop', async () => {
  const onChange = jest.fn();
  const treeData = [
    { id: '1', children: [{ id: '1-1' }] },
    { id: '2' },
  ];

  render(<SortableTree treeData={treeData} onChange={onChange} />);

  // Simulate drag start on node 1-1
  // Simulate drag over node 2
  // Simulate drop

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
    // Verify node moved to correct position
  });
});
```

---

## Phase 10: Storybook & Validation

### 10.1 Create new stories file

Create `src/SortableTree/SortableTree.new.stories.tsx`:

```typescript
import { StoryObj } from '@storybook/react';
import { SortableTree } from './SortableTree.new';

const meta = {
  title: 'Components/SortableTree',
  component: SortableTree,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SortableTree>;

export const Default: Story = {
  args: {
    treeData: [
      { id: '1', title: 'Node 1', children: [{ id: '1-1', title: 'Node 1-1' }] },
      { id: '2', title: 'Node 2' },
    ],
  },
};

export const Interactive: Story = {
  // Interactive story with callbacks
};

export const WithSearch: Story = {
  // Search functionality demo
};

export const CustomRenderers: Story = {
  // Custom node rendering
};

export const RTL: Story = {
  args: {
    rowDirection: 'rtl',
  },
};

export const LazyLoading: Story = {
  // Lazy children demo
};
```

### 10.2 Test in Storybook

- Run `yarn storybook` and open http://localhost:6006
- For each story, verify:
  1. Drag preview appears when dragging node
  2. Indentation feedback shows target depth
  3. Drop targets highlight on hover
  4. Search filtering works and highlights matches
  5. Callbacks fire with correct payloads
  6. No console errors or warnings
  7. Drag interactions are smooth (60 FPS if possible)

### 10.3 DevTools validation

- Open browser DevTools → Performance tab
- Record drag interaction
- Verify no layout thrashing (green timeline)
- Check FPS: should be ≥ 50 FPS during drag

---

## Phase 11: Cutover & Cleanup

### 11.1 Backup original implementation

```bash
mv src/SortableTree/react-sortable-tree.tsx src/SortableTree/react-sortable-tree.OLD.tsx
```

### 11.2 Move new implementation into place

```bash
mv src/SortableTree/SortableTree.new.tsx src/SortableTree/react-sortable-tree.tsx
```

### 11.3 Update test file

```bash
mv src/SortableTree/__tests__/SortableTree.new.test.tsx src/SortableTree/__tests__/react-sortable-tree.test.tsx
```

### 11.4 Update stories file

```bash
mv src/SortableTree/SortableTree.new.stories.tsx src/SortableTree/SortableTree.stories.tsx
```

### 11.5 Remove backup (after validation)

```bash
rm src/SortableTree/react-sortable-tree.OLD.tsx
```

### 11.6 Update package.json dependencies

If `react-dnd` is unused elsewhere:

```bash
yarn remove react-dnd react-dnd-html5-backend
```

---

## Phase 12: Final Validation

### 12.1 Test suite

```bash
yarn test
```

- All tests in `react-sortable-tree.test.tsx` pass ✓
- No coverage degradation
- No warnings

### 12.2 Storybook

```bash
yarn storybook
```

- All stories load without errors ✓
- Interactive drag/drop works ✓
- DevTools shows no layout thrashing ✓
- Smooth frame rate during drag ✓

### 12.3 Build

```bash
yarn build
```

- No TypeScript errors ✓
- No SWC compilation errors ✓
- Bundle size within acceptable range ✓

### 12.4 Lint & type check

```bash
yarn lint
yarn type-check
```

- No linting violations ✓
- Strict TypeScript mode passes ✓

### 12.5 Verify exports

Check `src/SortableTree/index.ts`:

```typescript
export { SortableTree, SortableTreeWithoutDndContext, type ReactSortableTreeRef };
export * from './types';
export { isDescendant } from './utils/tree-data-utils';
```

- All exports unchanged ✓
- No breaking changes to public API ✓

### 12.6 Integration test

Create dummy test file:

```typescript
import { SortableTree, type ReactSortableTreeRef } from '@intools/components';

const ref = useRef<ReactSortableTreeRef>(null);

// Test all props accepted
<SortableTree
  treeData={treeData}
  onChange={handleChange}
  onMoveNode={handleMove}
  canDrag={(node) => true}
  // ... all other props
  ref={ref}
/>

// Test ref methods
ref.current?.search('query');
ref.current?.loadLazyChildren();
```

- All props TypeScript types correct ✓
- All callbacks have correct signatures ✓
- Ref methods work as expected ✓

---

## Key Files Affected

### Rewrite (complete refactor)

- [src/SortableTree/react-sortable-tree.tsx](../../src/SortableTree/react-sortable-tree.tsx) — Main component

### Minor updates (hook integration)

- [src/SortableTree/tree-node.tsx](../../src/SortableTree/tree-node.tsx) — Add `useDroppable`
- [src/SortableTree/node-renderer-default.tsx](../../src/SortableTree/node-renderer-default.tsx) — Add `useDraggable`
- [src/SortableTree/placeholder-renderer-default.tsx](../../src/SortableTree/placeholder-renderer-default.tsx) — Add `useDroppable`

### Reuse as-is (no changes)

- [src/SortableTree/utils/tree-data-utils.ts](../../src/SortableTree/utils/tree-data-utils.ts)
- [src/SortableTree/utils/memoized-tree-data-utils.ts](../../src/SortableTree/utils/memoized-tree-data-utils.ts)
- [src/SortableTree/utils/generic-utils.ts](../../src/SortableTree/utils/generic-utils.ts)
- [src/SortableTree/types.ts](../../src/SortableTree/types.ts)
- [src/SortableTree/index.ts](../../src/SortableTree/index.ts)
- [src/SortableTree/styles/](../../src/SortableTree/styles/) (all Emotion CSS)

### Rewrite (new test suite)

- [src/SortableTree/**tests**/react-sortable-tree.test.tsx](../../src/SortableTree/__tests__/react-sortable-tree.test.tsx)

### Update

- [src/SortableTree/SortableTree.stories.tsx](../../src/SortableTree/SortableTree.stories.tsx)

### Config changes

- [package.json](../../package.json) — Add @dnd-kit, remove react-dnd

---

## Architecture Decisions

### 1. Functional Component

**Decision:** Rewrite as functional component with React Hooks
**Rationale:** Aligns with modern React patterns, improves testability, simplifies logic flow with hooks vs class lifecycle methods
**Trade-off:** Small learning curve for team familiar with class components (mitigated by clear hook structure)

### 2. Separate Development File

**Decision:** Use `SortableTree.new.tsx` during dev; cutover after validation
**Rationale:** Allows safe iteration without breaking existing functionality; enables side-by-side comparison before cutover
**Trade-off:** Slightly more file management during cutover phase (clean and simple)

### 3. Zero API Breaking Changes

**Decision:** Preserve all props, exports, and callback signatures identically
**Rationale:** Enables drop-in replacement without requiring updates to consuming code
**Trade-off:** Must maintain compatibility with class component behavior (worth the effort for seamless migration)

### 4. Write New Test Suite

**Decision:** Rewrite tests from scratch rather than adapt existing tests
**Rationale:** Provides cleaner test structure for hooks-based component; leverages @dnd-kit testing patterns; easier to maintain going forward
**Trade-off:** Initial effort to write tests; ensures comprehensive coverage and correctness

### 5. Reuse Tree Utilities

**Decision:** Keep `tree-data-utils.ts`, `memoized-tree-data-utils.ts` unchanged
**Rationale:** Pure functions with zero react-dnd dependency; proven correctness; reuse saves time and reduces risk
**Trade-off:** None (pure functions are universal)

### 6. High-Fidelity DragOverlay

**Decision:** Implement custom `DragOverlay` with indentation indicator
**Rationale:** Provides visual feedback matching original react-dnd behavior; improves UX clarity
**Trade-off:** Additional component to build and test (manageable scope)

### 7. Mocked Dependencies in Tests

**Decision:** Mock @dnd-kit and react-virtuoso in tests
**Rationale:** Simpler test setup; faster test execution; focuses on component logic rather than library internals
**Trade-off:** Integration tests with real @dnd-kit would catch library-specific issues (mitigated by Storybook validation)

---

## Performance Considerations

### 1. Virtual Scrolling

- `react-virtuoso` renders only visible rows
- Test with trees of 1000+ nodes
- Monitor render count: should stay < 100 visible items per list

### 2. Memoization

- Wrap expensive renders with `React.memo()`
- Use `useMemo()` for drag handlers and tree calculations
- @dnd-kit provides `useDraggable` memoization built-in

### 3. Deep Equality

- Use `react-fast-compare` for object comparison (already imported)
- Prevents unnecessary re-renders on props changes

### 4. Immutable Updates

- Tree utilities return new arrays (never mutate)
- Ensures React detects changes correctly
- Avoids subtle state synchronization bugs

### 5. Drag Performance

- Minimize render calls during drag (drag events can fire 60+ times/sec)
- Move expensive calculations outside drag loop (pre-compute depths, paths)
- Use CSS transforms (GPU-accelerated) for drag preview positioning

---

## Further Considerations

### @dnd-kit Sensors Configuration

The `useSensors()` hook determines when drag activates:

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { distance: 8 }), // Mouse: 8px drag before activate
  useSensor(TouchSensor, { distance: 8 }), // Touch: 8px drag before activate
  useSensor(KeyboardSensor), // Keyboard navigation
);
```

**Comparison to react-dnd:**

- react-dnd has default distance of ~0 (immediate drag)
- If drag feels too loose, increase distance; if too strict, decrease

**If needed, adjust:**

- Increase `distance` for stricter activation (less accidental drags)
- Decrease `distance` for immediate drag feel (closer to react-dnd)

### Collision Detection Strategy

@dnd-kit offers multiple strategies:

| Strategy           | Use Case                                       |
| ------------------ | ---------------------------------------------- |
| `closestCenter`    | Drag source closest to drop target center wins |
| `pointerWithin`    | Any drop target containing cursor wins         |
| `rectIntersection` | Any drop target rectangle overlapping wins     |

**For SortableTree:** Use `closestCenter` for tree rows (match react-dnd grid-based behavior)

**If behavior differs:**

- Implement custom collision function for fine-grained control
- Test drop behavior with deep nesting (indent levels)

### Drag Preview Quality

The `DragOverlay` component determines visual feedback quality:

1. **High-Fidelity:** Render complete node clone (title, icons, all styling)
   - Pros: Matches original node exactly
   - Cons: Slightly slower if tree nodes are complex
2. **Lightweight:** Render simplified version (title only)
   - Pros: Faster drag performance
   - Cons: Less visual feedback about what's being dragged

**Recommendation:** Start with high-fidelity; optimize if performance issue detected

---

## Testing Strategy Summary

### Unit Tests (Jest + React Testing Library)

- Mock @dnd-kit and Virtuoso
- Test component logic, state updates, callbacks
- Semantic queries over implementation details
- Fast execution (mocked = no real DOM interactions)

### Integration Tests (Storybook)

- Use real @dnd-kit and Virtuoso
- Test actual drag/drop interactions
- Visual validation of preview and feedback
- DevTools performance monitoring

### Manual Testing

- Storybook scenarios with developer inspection
- Large tree performance (1000+ nodes)
- Cross-browser drag behavior (if needed)

---

## Validation Checklist

✓ All @dnd-kit packages installed
✓ Functional component builds without errors
✓ All state hooks initialized correctly
✓ Drag start/over/end/cancel handlers implemented
✓ DragOverlay renders with indentation indicator
✓ Tree utilities reused (insertNode, removeNode, etc.)
✓ Node renderers updated with hooks
✓ All Emotion styles applied correctly
✓ Props interface unchanged (zero API breaking changes)
✓ Callbacks fire with correct payloads
✓ Search functionality integrated
✓ Lazy loading working
✓ Tests pass (new suite)
✓ Storybook stories load
✓ No console errors in DevTools
✓ Drag frame rate ≥ 50 FPS
✓ TypeScript strict mode passes
✓ Linting passes
✓ Build succeeds
✓ Exports unchanged in index.ts
✓ Integration test with dummy app passes
✓ Backup removed after cutover
✓ Documentation updated (if needed)

---

## Timeline & Milestones

| Phase     | Milestones                               | Time Est. |
| --------- | ---------------------------------------- | --------- |
| **1**     | Dependencies added, file structure ready | 30 min    |
| **2**     | Functional component with state/effects  | 2 hours   |
| **3**     | @dnd-kit integration (handlers working)  | 3 hours   |
| **4**     | DragOverlay implemented                  | 1 hour    |
| **5**     | Tree utilities integrated                | 30 min    |
| **6**     | Renderers updated with hooks             | 1 hour    |
| **7**     | Props/API preserved, ref methods work    | 1 hour    |
| **8**     | Search & lazy loading integrated         | 1 hour    |
| **9**     | New test suite written & passing         | 3 hours   |
| **10**    | Storybook stories & validation           | 2 hours   |
| **11**    | Cutover & cleanup                        | 30 min    |
| **12**    | Final validation (test, build, etc.)     | 1 hour    |
| **Total** |                                          | ~16 hours |

**Note:** Actual time may vary based on complexity discoveries and debugging. No rush; focus on correctness.
