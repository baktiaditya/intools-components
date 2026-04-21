# Agent Guide: intools-components

This is a reusable React component library built with **Chakra UI**, **Emotion**, and **TypeScript**. It's designed for use across Intools frontend applications.

## Quick Reference

### Component Development
- **Location**: `src/<ComponentName>/` (e.g., `src/Badge/`, `src/Modal/`)
- **Structure**: 
  ```
  ComponentName/
  ├── index.ts              # Named exports only
  ├── ComponentName.tsx     # Main component
  ├── ComponentName.stories.tsx  # Storybook story
  ├── types.ts              # TypeScript definitions
  ├── styles/               # Emotion CSS
  ├── utils/                # Helper functions
  └── __tests__/            # Jest test files
  ```
- **Naming**: PascalCase components, kebab-case files
- **Exports**: Always use named exports; barrel exports via `index.ts`

### Build & Development
| Command | Purpose |
|---------|---------|
| `yarn build` | Build for production (SWC + TypeScript) |
| `yarn dev` | Rebuild on watch (same as build:core) |
| `yarn storybook` | Launch Storybook at http://localhost:6006 |
| `yarn test` | Run Jest with coverage |
| `yarn lint` | Check code style |
| `yarn type-check` | TypeScript validation |

### Styling
- **Framework**: Emotion with Chakra UI
- **Pattern**: CSS-in-JS using `css` tagged templates (not styled-components)
- **Files**: Store in `styles/` subfolder (e.g., `Badge/styles/Badge.ts`)
- **Integration**: 
  - **Chakra**: Layout primitives (Box, Flex, Stack), spacing, colors, responsive props
  - **Emotion**: Complex selectors, animations, pseudo-classes (`:hover`, `:focus`, etc.)
  - **Auto-labeling**: SWC Emotion plugin labels classes as `[component-name]` in dev mode
- **Example pattern**:
  ```typescript
  // BadgeStyle.ts
  import { css } from '@emotion/react';
  export const badgeStyle = css`
    display: inline-block;
    padding: 4px 8px;
    &:hover { opacity: 0.8; }
  `;
  ```

### Testing
- **Framework**: Jest + React Testing Library
- **Pattern**: `render()` + `screen.getByTestId()` queries for semantic testing
- **Snapshot**: Emotion serializer included; snapshots show actual styled output
- **Mocks**: 
  - CSS imports mocked as `identity-obj-proxy`
  - `lodash-es` mocked to `lodash` (see `jest.setup.js`)
  - Virtual components (react-virtuoso) mocked in tests
  - Drag-drop mocks: Skip react-dnd DnD provider in component tests
- **Coverage**: Tracked with badges in `coverage/`; coverage exclusions include index.ts, .stories.tsx, .d.ts

## Key Files
- [tsconfig.json](tsconfig.json) — TypeScript configuration (strict mode, ESNext target)
- [jest.config.js](jest.config.js) — Jest setup with Emotion snapshot support
- [jest.setup.js](jest.setup.js) — Global test setup (mock lodash-es)
- [package.json](package.json) — Dependencies and scripts

## Common Pitfalls
1. **Module Aliases**: If adding module aliases, ensure jest.config.js `moduleNameMapper` is updated
2. **data-testid**: Stripped in production by SWC plugin—use only for testing
3. **Lodash**: Always import from `lodash-es`; tests mock to `lodash`
4. **Drag & Drop**: SortableTree uses react-dnd; avoid nested DnD contexts
5. **Strict TypeScript**: Codebase uses strict mode; types are required
6. **Storybook args**: Use `updateArgs()` with delay (100ms) to avoid AbortError on unmount
7. **react-virtuoso in tests**: Virtual scrolling component requires mocking; real app handles list rendering

## Reference Implementation: SortableTree
The [src/SortableTree/](src/SortableTree/) component exemplifies library patterns:
- **State**: Drag operations, search, tree data mutations via immutable utilities
- **Performance**: Virtuoso (virtual scrolling), memoization, react-fast-compare for deep equality
- **Drag-Drop**: react-dnd wrappers (`wrapSource`, `wrapTarget`, `wrapPlaceholder`) for modular DnD
- **Exports**: Two variants: `SortableTree` (with DnD context) and `SortableTreeWithoutDndContext` (for apps with existing DnD)
- **Styling**: 4 Emotion CSS files (node, tree, placeholder, rows) for separation of concerns
- **Tests**: Semantic queries, mocked virtuoso, drag-drop simulation via react-dnd test utilities
- **Stories**: Default + interactive callback stories showing mutation patterns

Key files to reference: [react-sortable-tree.tsx](src/SortableTree/react-sortable-tree.tsx) (core logic), [types.ts](src/SortableTree/types.ts) (80+ type defs), [styles/](src/SortableTree/styles/) (Emotion patterns)

## Storybook Patterns
- **Meta format**: `const meta = { title: 'Category/ComponentName', component: Comp, tags: ['autodocs'] }`
- **Auto-docs**: react-docgen-typescript generates prop tables from component types
- **Decorators**: Console.log spying included; use `updateArgs()` with `setTimeout(..., 100)` for safe async state
- **Story structure**: Define with `StoryObj<typeof ComponentName>` for type safety
- **Performance monitoring**: Open DevTools to verify no layout thrashing during interactions

## Utility Types
[src/utility-types.ts](src/utility-types.ts) provides:
- `DeepPartial<T>` — All properties recursively optional
- `Optional<T, K>` — Specific keys optional
- `AugmentedRequired<T, K>` — Specific keys required (inverse of Partial)
- `DeepNonNullable<T>` — All properties recursively non-null

Use these in component props and state types for flexibility and type safety.

## Performance Optimization
1. **Virtual Scrolling**: SortableTree uses `react-virtuoso` for large lists; ensure render count < 100 visible items per list
2. **Memoization**: Wrap expensive renders with `React.memo()` or `useMemo` for drag handlers
3. **Deep Comparison**: Use `react-fast-compare` instead of `===` for complex object equality checks
4. **Immutable Updates**: Tree utilities preserve structure; never mutate node arrays directly

## Getting Started
1. **Read**: [README.md](README.md) for project overview
2. **Reference**: Review [src/SortableTree/](src/SortableTree/) as the exemplary implementation
3. **Storybook**: Run `yarn storybook` to see components and auto-generated docs
4. **Test**: Run `yarn test` to verify setup and understand testing patterns
5. **Lint**: Run `yarn lint` to check code style
6. **Types**: Reference [src/utility-types.ts](src/utility-types.ts) for reusable type patterns

## When to Ask
- Architecture decisions or component boundaries
- Whether to add new peer dependencies
- Complex styling or accessibility concerns
- Performance optimizations for large component lists
