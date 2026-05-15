"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  { label: "Tài chính", emoji: ["💰", "💳", "🏦", "💵", "💸", "📈", "📉", "💼", "🤑", "📊", "🏧", "💹"] },
  { label: "Ăn uống", emoji: ["🍔", "🍕", "🍜", "🍱", "🍣", "🥗", "🍩", "☕", "🧃", "🍷", "🍺", "🥤", "🧁", "🍦", "🥡", "🫕"] },
  { label: "Di chuyển", emoji: ["🚗", "🏍️", "🚌", "✈️", "🚂", "🚲", "🛵", "🚕", "⛽", "🚇", "🛺", "🚀"] },
  { label: "Mua sắm", emoji: ["🛍️", "👗", "👟", "👠", "💄", "🧴", "📱", "💻", "🎮", "📷", "🧸", "🪭"] },
  { label: "Nhà cửa", emoji: ["🏠", "🏡", "💡", "🛒", "🪴", "🧹", "🛁", "🪑", "🛏️", "🔌", "🚿", "🧺"] },
  { label: "Sức khoẻ", emoji: ["💊", "🏥", "🧘", "🏋️", "🏃", "🩺", "💉", "🦷", "🧬", "❤️‍🩹", "🩹", "🫀"] },
  { label: "Giải trí", emoji: ["🎬", "🎵", "🎭", "📚", "🎯", "🏆", "🎲", "🎨", "🎤", "🎸", "🎃", "🎡"] },
  { label: "Cuộc sống", emoji: ["🎁", "🎂", "❤️", "👶", "🐶", "🐱", "🌱", "☀️", "⭐", "🌙", "🌸", "🍀"] },
];

type EmojiPickerProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Chọn emoji"
        style={{
          width: 44, height: 44, borderRadius: 11,
          border: `1.5px solid ${open ? "var(--primary)" : "var(--hairline)"}`,
          background: "var(--canvas-parchment)",
          fontSize: value ? 22 : 18,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "border-color 0.15s",
          color: "var(--ink-muted-48)",
        }}
      >
        {value ?? "🙂"}
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          width: 280, maxHeight: 320, overflowY: "auto",
          background: "var(--canvas)", border: "1px solid var(--hairline)",
          borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          zIndex: 500, padding: "8px 0",
        }}>
          {value && (
            <div style={{ padding: "0 10px 6px" }}>
              <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                style={{ background: "none", border: "none", color: "var(--primary)", fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer", padding: "2px 4px" }}>
                Xoá emoji
              </button>
            </div>
          )}
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} style={{ padding: "0 10px 8px" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 600, color: "var(--ink-muted-48)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2 }}>
                {group.label}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {group.emoji.map((e) => (
                  <button key={e} type="button" onClick={() => { onChange(e); setOpen(false); }}
                    style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: value === e ? "rgba(0,102,204,0.1)" : "transparent", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s" }}
                    onMouseEnter={(el) => { (el.target as HTMLButtonElement).style.background = "var(--canvas-parchment)"; }}
                    onMouseLeave={(el) => { (el.target as HTMLButtonElement).style.background = value === e ? "rgba(0,102,204,0.1)" : "transparent"; }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
