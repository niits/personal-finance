import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        iphoneSE: {
          name: "iPhone SE",
          styles: { width: "375px", height: "667px" },
        },
        iphone14Pro: {
          name: "iPhone 14 Pro",
          styles: { width: "393px", height: "852px" },
        },
        ipad: {
          name: "iPad",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1280px", height: "900px" },
        },
      },
      defaultViewport: "iphone14Pro",
    },
  },
};

export default preview;
