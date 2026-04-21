'use client';

import React from 'react';
import { css } from '@emotion/react';

import type { NodeRendererProps, TreeNodeRenderer } from './types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      aria-hidden
      className={className}
      css={[
        css`
          flex-shrink: 0;
          transition-property: rotate;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 200ms;
          width: 1rem;
          height: 1rem;
        `,
        expanded &&
          css`
            rotate: 90deg;
          `,
      ]}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      css={css`
        flex-shrink: 0;
        width: 1rem;
        height: 1rem;
      `}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

// ─── NodeRendererDefault ──────────────────────────────────────────────────────

export interface NodeRendererDefaultProps extends NodeRendererProps {
  /** Extra buttons rendered to the right of the node label */
  buttons?: React.ReactNode[];
  /** Custom icons for expand/collapse */
  icons?: {
    collapsed?: React.ReactNode;
    expanded?: React.ReactNode;
  };
}

const NodeRendererDefault = React.forwardRef<HTMLDivElement, NodeRendererDefaultProps>(
  function NodeRendererDefault(props, ref) {
    const {
      buttons,
      canDrag = true,
      className,
      connectDragSource,
      isDragging,
      isSearchFocus,
      isSearchMatch,
      node,
      path,
      style,
      toggleChildrenVisibility,
      treeIndex,
    } = props;

    const hasChildren = Boolean(node.children?.length);
    const isExpanded = node.expanded !== false;

    const nodeTitle =
      typeof node.title === 'function'
        ? (node.title as TreeNodeRenderer)({ node, path, treeIndex })
        : node.title ?? '(No title)';

    const nodeSubtitle =
      typeof node.subtitle === 'function'
        ? (node.subtitle as TreeNodeRenderer)({ node, path, treeIndex })
        : node.subtitle;

    const handle = connectDragSource(
      <div
        aria-label="Drag handle"
        css={[
          css`
            display: flex;
            align-items: center;
            justify-content: center;
            padding-left: 0.25rem;
            padding-right: 0.25rem;
            color: #666;
          `,
          canDrag
            ? css`
                cursor: grab;
                &:active {
                  cursor: grabbing;
                }
              `
            : css`
                cursor: not-allowed;
                opacity: 0.3;
              `,
        ]}
      >
        <DragHandleIcon />
      </div>,
    );

    return (
      <div
        ref={ref}
        className={className}
        css={[
          css`
            display: flex;
            height: 100%;
            align-items: center;
            gap: 0.25rem;
          `,
          isDragging &&
            css`
              opacity: 0.5;
            `,
        ]}
        style={style}
      >
        {/* Expand/collapse button */}
        <div
          css={css`
            display: flex;
            width: 1.75rem;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
          `}
        >
          {hasChildren ? (
            <button
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              css={css`
                display: flex;
                width: 1.5rem;
                height: 1.5rem;
                align-items: center;
                justify-content: center;
                border-radius: 0.125rem;
                transition-property: color, background-color, border-color, text-decoration-color,
                  fill, stroke;
                transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                transition-duration: 150ms;

                &:focus-visible {
                  outline: 2px solid transparent;
                  outline-offset: 2px;
                  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width)
                    var(--tw-ring-offset-color);
                  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0
                    calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow),
                    var(--tw-shadow, 0 0 #0000);
                }
              `}
              onClick={() => toggleChildrenVisibility?.({ node, path, treeIndex })}
              type="button"
            >
              <ChevronIcon expanded={isExpanded} />
            </button>
          ) : null}
        </div>

        {/* Content row */}
        <div
          css={[
            css`
              display: flex;
              flex: 1 1 0%;
              align-items: center;
              gap: 0.5rem;
              overflow: hidden;
              border-radius: 0.375rem;
              border-width: 1px;
              padding-left: 0.75rem;
              padding-right: 0.75rem;
              padding-top: 0.5rem;
              padding-bottom: 0.5rem;
              --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
              --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
              box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000),
                var(--tw-shadow);
              transition-property: color, background-color, border-color, text-decoration-color,
                fill, stroke;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
            `,
            isSearchMatch &&
              css`
                --tw-border-opacity: 1;
                border-color: rgb(251 191 36 / var(--tw-border-opacity, 1));
                --tw-bg-opacity: 1;
                background-color: rgb(255 251 235 / var(--tw-bg-opacity, 1));
              `,
            isSearchFocus &&
              css`
                --tw-border-opacity: 1;
                border-color: rgb(59 130 246 / var(--tw-border-opacity, 1));
                --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width)
                  var(--tw-ring-offset-color);
                --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width))
                  var(--tw-ring-color);
                box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow),
                  var(--tw-shadow, 0 0 #0000);
                --tw-ring-opacity: 1;
                --tw-ring-color: rgb(147 197 253 / var(--tw-ring-opacity, 1));
              `,
          ]}
        >
          {/* Drag handle */}
          {handle}

          {/* Title + subtitle */}
          <div
            css={css`
              display: flex;
              min-width: 0px;
              flex: 1 1 0%;
              flex-direction: column;
            `}
          >
            <span
              css={css`
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 0.875rem;
                line-height: 1.25rem;
                font-weight: 500;
                line-height: 1.25;
              `}
            >
              {nodeTitle}
            </span>
            {nodeSubtitle ? (
              <span
                css={css`
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-size: 0.75rem;
                  line-height: 1rem;
                `}
              >
                {nodeSubtitle}
              </span>
            ) : null}
          </div>

          {/* Custom buttons */}
          {buttons?.length ? (
            <div
              css={css`
                margin-left: auto;
                display: flex;
                flex-shrink: 0;
                align-items: center;
                gap: 0.25rem;
              `}
            >
              {buttons.map((btn, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static button array
                <React.Fragment key={i}>{btn}</React.Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

NodeRendererDefault.displayName = 'NodeRendererDefault';

export default NodeRendererDefault;
