# Instructions for Refactoring `SortableTree`

**Role:** Senior Frontend Engineer / React Expert.
**Context:** I need to perform a complete "from-scratch" refactor of the `SortableTree` component located in `src/SortableTree`. The goal is to migrate from `react-dnd` to `@dnd-kit/core`.

## Strict Objectives

1. **Rebuild from Zero:** Do not patch the existing class component. Rewrite it as a Functional Component using React Hooks as per the plan.
2. **UX Parity (State-Preservation):** The dragging feel, indentation logic (depth changes), and visual feedback must match the original `react-dnd` implementation.
3. **Restore Drag Preview:** You MUST implement `<DragOverlay />` to provide a high-fidelity clone of the element being dragged.
