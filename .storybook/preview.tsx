import React from 'react';
import type { Args, Preview } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { spyOn } from 'storybook/test';

const preview: Preview = {
  beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      source: {
        type: 'code',
      },
    },
    refs: {},
    options: {
      storySort: {
        order: ['Components'],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const [, updateArgs] = useArgs();

      const handleUpdateArgs = async (args: Partial<Args>) => {
        // Add a 100ms delay to avoid "Uncaught (in promise) AbortError: The user aborted a request."
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        updateArgs(args);
      };

      return <Story {...context} updateArgs={handleUpdateArgs} />;
    },
  ],
};

export default preview;
