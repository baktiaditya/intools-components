import { css } from '@emotion/react';

export const reactSortableTreeStyle = css`
  /* Extra class applied to VirtualScroll through className prop */
  .rst__virtualScrollOverride {
    overflow: auto !important;
  }
  .rst__virtualScrollOverride * {
    box-sizing: border-box;
  }
  .rst__virtualScrollSpacer {
    height: 12px;
  }

  .ReactVirtualized__Grid__innerScrollContainer {
    overflow: visible !important;
  }

  .rst__rtl .ReactVirtualized__Grid__innerScrollContainer {
    direction: rtl;
  }

  .ReactVirtualized__Grid {
    outline: none;
  }
`;
