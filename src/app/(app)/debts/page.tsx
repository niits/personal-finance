export default function DebtsPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas-parchment)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        textAlign: "center",
        fontFamily: "var(--font-body)",
        color: "var(--ink-muted-48)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>Theo dõi nợ</div>
        <div style={{ fontSize: 14, marginTop: 6 }}>Tính năng đang được phát triển</div>
      </div>
    </div>
  );
}
