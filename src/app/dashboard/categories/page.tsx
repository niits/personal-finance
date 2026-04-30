"use client";

import { useEffect, useState } from "react";

type Category = {
  id: number;
  name: string;
  level: number;
  parent_id: number | null;
  children: Category[];
};

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const r = await fetch("/api/categories");
    const d = await r.json() as { categories?: Category[] };
    setCats(d.categories ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const r = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), parent_id: parentId }),
    });
    const d = await r.json() as { category?: Category; error?: string };
    if (!r.ok) { setError(d.error ?? "Lỗi"); setSaving(false); return; }
    setNewName("");
    setParentId(null);
    setShowForm(false);
    setSaving(false);
    load();
  }

  // Flatten for parent selector (only show level 1 and 2 as potential parents)
  const flatCats = cats.flatMap((c) => [
    c,
    ...c.children.map((cc) => ({ ...cc, children: [] })),
  ]).filter((c) => c.level < 3);

  function renderCategory(cat: Category, depth = 0) {
    return (
      <div key={cat.id}>
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 20px",
          paddingLeft: 20 + depth * 20,
          borderBottom: "1px solid var(--hairline)",
          background: "var(--canvas)",
        }}>
          <span style={{
            fontFamily: "var(--font-body)",
            fontSize: 17,
            color: "var(--ink)",
            letterSpacing: -0.374,
          }}>
            {depth > 0 && <span style={{ color: "var(--ink-muted-48)", marginRight: 8 }}>└</span>}
            {cat.name}
          </span>
          <span style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--ink-muted-48)",
            fontFamily: "var(--font-body)",
            background: "var(--canvas-parchment)",
            padding: "2px 8px",
            borderRadius: 999,
          }}>
            Cấp {cat.level}
          </span>
        </div>
        {cat.children?.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "var(--surface-black)",
        padding: "28px 22px 20px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 4 }}>
            Bước 1
          </p>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--on-dark)",
            letterSpacing: -0.28,
          }}>
            Danh mục
          </h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
          + Thêm
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "var(--canvas)",
          padding: "20px",
          borderBottom: "1px solid var(--hairline)",
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            marginBottom: 12,
          }}>
            Danh mục mới
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              placeholder="Tên danh mục"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: 11,
                border: "1px solid var(--hairline)",
                fontFamily: "var(--font-body)",
                fontSize: 17,
                color: "var(--ink)",
                background: "var(--canvas-parchment)",
                outline: "none",
                letterSpacing: -0.374,
              }}
            />

            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: 11,
                border: "1px solid var(--hairline)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                color: parentId ? "var(--ink)" : "var(--ink-muted-48)",
                background: "var(--canvas-parchment)",
                outline: "none",
                appearance: "none",
              }}
            >
              <option value="">Không có danh mục cha (cấp 1)</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.level - 1)}{c.level > 1 ? "└ " : ""}{c.name} (cấp {c.level + 1})
                </option>
              ))}
            </select>

            {error && (
              <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 11,
                  border: "1px solid var(--hairline)",
                  background: "var(--canvas-parchment)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: "var(--ink-muted-48)",
                  cursor: "pointer",
                }}
              >
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 2,
                  padding: "11px",
                  borderRadius: 11,
                  border: "none",
                  background: newName.trim() ? "var(--primary)" : "var(--hairline)",
                  color: newName.trim() ? "#fff" : "var(--ink-muted-48)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  fontWeight: 400,
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ marginTop: 1 }}>
        {loading ? (
          <div style={{ padding: "40px 22px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
            Đang tải…
          </div>
        ) : cats.length === 0 ? (
          <div style={{
            padding: "40px 22px",
            textAlign: "center",
          }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              Chưa có danh mục
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
              Tạo danh mục để phân loại chi tiêu
            </p>
          </div>
        ) : (
          cats.map((c) => renderCategory(c))
        )}
      </div>

      {/* Hint */}
      {cats.length > 0 && (
        <div style={{ padding: "16px 22px" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", lineHeight: 1.5 }}>
            Tối đa 3 cấp. Chỉ danh mục không có danh mục con mới có thể gán vào giao dịch.
          </p>
        </div>
      )}
    </div>
  );
}
