import { Badge } from "@/components/atoms/Badge";

type NewCategoryRowProps = {
  tempId: string;
  name: string;
  type: "income" | "expense";
  exampleNotes: string[];
  checked: boolean;
  onChange: (tempId: string, checked: boolean) => void;
};

export function NewCategoryRow({ tempId, name, type, exampleNotes, checked, onChange }: NewCategoryRowProps) {
  return (
    <label style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "10px 16px",
      cursor: "pointer",
      minHeight: 44,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(tempId, e.target.checked)}
        style={{ marginTop: 2, accentColor: "var(--primary)", flexShrink: 0, width: 16, height: 16 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: exampleNotes.length > 0 ? 3 : 0 }}>
          <span style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--ink)",
            letterSpacing: -0.374,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {name}
          </span>
          <Badge
            label={type === "expense" ? "Chi" : "Thu"}
            variant={type === "expense" ? "danger" : "success"}
            size="sm"
          />
        </div>

        {exampleNotes.length > 0 && (
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--ink-muted-48)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            vd: {exampleNotes.join(", ")}
          </p>
        )}
      </div>
    </label>
  );
}
