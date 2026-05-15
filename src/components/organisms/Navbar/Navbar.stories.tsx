import type { Meta, StoryObj } from "@storybook/nextjs";

const meta: Meta = {
  title: "Organisms/Navbar",
  tags: ["autodocs"],
};
export default meta;

export const LoggedIn: Story = {
  render: () => (
    <nav style={{ position: "relative", height: 44, background: "#000", display: "flex", alignItems: "center", padding: "0 22px", justifyContent: "space-between" }}>
      <span style={{ color: "#fff", fontFamily: "SF Pro Display, system-ui, sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Finance</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>niits</span>
        <button style={{ background: "transparent", border: "none", color: "#2997ff", fontSize: 12, cursor: "pointer" }}>Đăng xuất</button>
      </div>
    </nav>
  ),
};

export const LoggedOut: Story = {
  render: () => (
    <nav style={{ position: "relative", height: 44, background: "#000", display: "flex", alignItems: "center", padding: "0 22px", justifyContent: "space-between" }}>
      <span style={{ color: "#fff", fontFamily: "SF Pro Display, system-ui, sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Finance</span>
      <button style={{ background: "transparent", border: "none", color: "#2997ff", fontSize: 12, cursor: "pointer" }}>Đăng nhập</button>
    </nav>
  ),
};

type Story = StoryObj<typeof meta>;
