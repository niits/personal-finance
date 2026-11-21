import type { Meta, StoryObj } from "@storybook/nextjs";
import { OAuthConsentTemplate } from "./OAuthConsentTemplate";

const meta: Meta<typeof OAuthConsentTemplate> = {
  component: OAuthConsentTemplate,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
  args: {
    request: { clientName: "Claude", redirectHost: "claude.ai", accountEmail: "minh.nguyen@example.com" },
    pending: null,
    error: null,
    onAllow: () => {},
    onDeny: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof OAuthConsentTemplate>;

export const Ready: Story = {};

export const Allowing: Story = { args: { pending: "allow" } };

export const Denying: Story = { args: { pending: "deny" } };

export const RecoverableError: Story = {
  args: { error: "Không thể xử lý yêu cầu cấp quyền. Vui lòng thử lại." },
};

export const InvalidOrExpired: Story = { args: { request: null } };

export const LongContent: Story = {
  args: {
    request: {
      clientName: "Ứng dụng trợ lý tài chính cá nhân với tên rất dài để kiểm tra xuống dòng trên màn hình hẹp",
      redirectHost: "very-long-subdomain-for-a-callback.integrations.example-assistant-platform.com",
      accountEmail: "a.really.long.email.address.for.testing@subdomain.example.com",
    },
  },
};

export const Narrow: Story = {
  args: LongContent.args,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
