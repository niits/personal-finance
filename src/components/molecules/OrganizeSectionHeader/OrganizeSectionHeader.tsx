type OrganizeSectionHeaderProps = {
  title: string;
  count?: number;
  autoIncluded?: boolean;
};

export function OrganizeSectionHeader({ title, count, autoIncluded }: OrganizeSectionHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "14px 16px 6px",
    }}>
      <span style={{
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--ink)",
        letterSpacing: -0.08,
        flex: 1,
      }}>
        {title}
      </span>

      {count !== undefined && (
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--primary)",
          background: "rgba(0,102,204,0.08)",
          borderRadius: 99,
          padding: "1px 8px",
        }}>
          {count}
        </span>
      )}

      {autoIncluded && (
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-muted-48)",
          fontStyle: "italic",
        }}>
          tự động
        </span>
      )}
    </div>
  );
}
