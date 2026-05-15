import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
};

export default config;
