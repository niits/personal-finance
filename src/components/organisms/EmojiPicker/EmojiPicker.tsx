"use client";

import { useState, useRef, useEffect, useMemo } from "react";

const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  { label: "Tài chính", emoji: ["💰", "💳", "🏦", "💵", "💸", "📈", "📉", "💼", "🤑", "📊", "🏧", "💹", "🪙", "💱", "🧾", "📑", "🏪", "🏬"] },
  { label: "Ăn uống", emoji: ["🍔", "🍕", "🍜", "🍱", "🍣", "🥗", "🍩", "☕", "🧃", "🍷", "🍺", "🥤", "🧁", "🍦", "🥡", "🫕", "🍚", "🥩", "🥐", "🫖", "🧆", "🥘", "🍲", "🧋", "🍿", "🥗"] },
  { label: "Di chuyển", emoji: ["🚗", "🏍️", "🚌", "✈️", "🚂", "🚲", "🛵", "🚕", "⛽", "🚇", "🛺", "🚀", "🛻", "🚁", "🛥️", "🚑", "🚜", "🛴"] },
  { label: "Mua sắm", emoji: ["🛍️", "👗", "👟", "👠", "💄", "🧴", "📱", "💻", "🎮", "📷", "🧸", "🪭", "🔑", "🧲", "🪜", "🔦", "🪒", "🧹", "🧺", "🪣"] },
  { label: "Nhà cửa", emoji: ["🏠", "🏡", "💡", "🛒", "🪴", "🧹", "🛁", "🪑", "🛏️", "🔌", "🚿", "🧺", "🪟", "🚪", "🧯", "🪣", "🏗️", "🛋️"] },
  { label: "Sức khỏe", emoji: ["💊", "🏥", "🧘", "🏋️", "🏃", "🩺", "💉", "🦷", "🧬", "❤️‍🩹", "🩹", "🫀", "🩻", "🧠", "🫁", "🧖", "⚕️", "🩼"] },
  { label: "Giải trí", emoji: ["🎬", "🎵", "🎭", "📚", "🎯", "🏆", "🎲", "🎨", "🎤", "🎸", "🎃", "🎡", "🎹", "🎻", "🎺", "🏊", "🤸", "🎳"] },
  { label: "Giáo dục", emoji: ["📚", "📝", "✏️", "🎓", "📐", "📏", "🖊️", "📋", "🔬", "🔭", "🖥️", "📖", "🏫", "🧮", "📌", "🗂️", "📎", "🖨️"] },
  { label: "Du lịch", emoji: ["✈️", "🧳", "🏖️", "🏕️", "🗺️", "🏔️", "🌊", "🗼", "🎒", "🌍", "🏛️", "🎠", "⛺", "🚢", "🏝️", "🌅", "🎑", "🗾"] },
  { label: "Thú cưng", emoji: ["🐶", "🐱", "🐹", "🐰", "🦜", "🐠", "🦮", "🐾", "🦴", "🧶", "🪺", "🐕", "🐈", "🐇", "🦖", "🐢", "🐍", "🦎"] },
  { label: "Cuộc sống", emoji: ["🎁", "🎂", "❤️", "👶", "🌱", "☀️", "⭐", "🌙", "🌸", "🍀", "🕯️", "🪷", "🌺", "🌻", "🌈", "🫂", "🙏", "💪"] },
];

// keyword → suggested emoji (Vietnamese terms, case-insensitive)
const KEYWORD_SUGGESTIONS: { pattern: RegExp; emoji: string[] }[] = [
  { pattern: /ăn|cơm|bữa|quán|nhà hàng|thức ăn/i, emoji: ["🍜", "🍱", "🍔", "🍕", "🥗", "🫕"] },
  { pattern: /cà phê|cafe|coffee|trà|đồ uống/i, emoji: ["☕", "🧋", "🫖", "🥤", "🧃"] },
  { pattern: /bia|rượu|nhậu|bar|cocktail/i, emoji: ["🍺", "🍷", "🥂", "🍻", "🍾"] },
  { pattern: /lương|thưởng|thu nhập|salary|income/i, emoji: ["💰", "💵", "💳", "📈", "🤑"] },
  { pattern: /tiết kiệm|savings|tích lũy/i, emoji: ["🏦", "💹", "🪙", "📊", "💼"] },
  { pattern: /đầu tư|investment|chứng khóan|crypto/i, emoji: ["📈", "💹", "📊", "🏦", "💱"] },
  { pattern: /xăng|nhiên liệu|gas|fuel/i, emoji: ["⛽", "🚗", "🏍️", "🛻"] },
  { pattern: /xe|ôtô|taxi|grab|gojek|xe ôm/i, emoji: ["🚗", "🚕", "🏍️", "🛵", "🚲"] },
  { pattern: /bay|máy bay|vé|chuyến/i, emoji: ["✈️", "🧳", "🌍", "🗺️"] },
  { pattern: /du lịch|travel|nghỉ|vacation|phượt/i, emoji: ["✈️", "🧳", "🏖️", "🏕️", "🗺️"] },
  { pattern: /quần áo|thời trang|áo|quần|giày/i, emoji: ["👗", "👟", "👠", "🛍️", "💄"] },
  { pattern: /điện thoại|phone|iphone|android|smartphone/i, emoji: ["📱", "💻", "🎮"] },
  { pattern: /siêu thị|chợ|grocery|tạp hóa/i, emoji: ["🛒", "🛍️", "🧺", "🏪"] },
  { pattern: /điện|electric|wifi|internet|mạng/i, emoji: ["💡", "🔌", "📡", "🖥️"] },
  { pattern: /nước|water|vệ sinh/i, emoji: ["💧", "🚿", "🛁", "🪣"] },
  { pattern: /thuê nhà|rent|chung cư|phòng/i, emoji: ["🏠", "🏡", "🪟", "🔑"] },
  { pattern: /thuốc|bác sĩ|bệnh viện|khám|y tế/i, emoji: ["💊", "🏥", "🩺", "💉", "🩹"] },
  { pattern: /gym|thể thao|tập|sport|chạy|bơi/i, emoji: ["🏋️", "🏃", "🧘", "🏊", "🤸"] },
  { pattern: /phim|cinema|netflix|xem/i, emoji: ["🎬", "🍿", "📺", "🎭"] },
  { pattern: /nhạc|music|concert|nghe/i, emoji: ["🎵", "🎤", "🎸", "🎹", "🎧"] },
  { pattern: /sách|đọc|book|thư viện/i, emoji: ["📚", "📖", "✏️", "📝"] },
  { pattern: /game|gaming|chơi game/i, emoji: ["🎮", "🕹️", "🏆", "🎲"] },
  { pattern: /học|giáo dục|trường|school|khóa|course/i, emoji: ["📚", "🎓", "✏️", "📝", "🏫"] },
  { pattern: /trẻ em|bé|con|baby|kid|sữa|tã/i, emoji: ["👶", "🧸", "🍼", "🎠"] },
  { pattern: /thú cưng|chó|mèo|pet|dog|cat/i, emoji: ["🐶", "🐱", "🐾", "🦴"] },
  { pattern: /sinh nhật|birthday|tiệc|party/i, emoji: ["🎂", "🎁", "🎉", "🥂"] },
  { pattern: /sức khỏe|beauty|spa|làm đẹp/i, emoji: ["🧖", "💄", "🧴", "💅"] },
  { pattern: /bảo hiểm|insurance|bảo vệ/i, emoji: ["🛡️", "📋", "🏦", "💼"] },
  { pattern: /công việc|work|văn phòng|office/i, emoji: ["💼", "🖥️", "📋", "☕", "📊"] },
];

function getSuggestions(name: string): string[] {
  if (!name.trim()) return [];
  const matched = new Set<string>();
  for (const { pattern, emoji } of KEYWORD_SUGGESTIONS) {
    if (pattern.test(name)) {
      emoji.forEach((e) => matched.add(e));
    }
  }
  return [...matched].slice(0, 12);
}

type EmojiPickerProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
  suggestForName?: string;
  placement?: "above" | "viewport";
};

export function EmojiPicker({ value, onChange, suggestForName, placement = "above" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => getSuggestions(suggestForName ?? ""),
    [suggestForName],
  );

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    const viewport = window.visualViewport;
    function positionPopover() {
      if (placement !== "viewport" || !ref.current || !popoverRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const above = rect.top - top - 8;
      const below = top + height - rect.bottom - 8;
      const maxHeight = Math.min(360, Math.max(above, below));
      const popoverWidth = Math.min(300, width - 40);
      Object.assign(popoverRef.current.style, {
        position: "fixed",
        bottom: "auto",
        top: `${above >= below ? rect.top - maxHeight - 8 : rect.bottom + 8}px`,
        left: `${Math.max(left + 20, Math.min(rect.left, left + width - popoverWidth - 20))}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${maxHeight}px`,
      });
    }
    positionPopover();
    viewport?.addEventListener("resize", positionPopover);
    viewport?.addEventListener("scroll", positionPopover);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      viewport?.removeEventListener("resize", positionPopover);
      viewport?.removeEventListener("scroll", positionPopover);
    };
  }, [open, placement]);

  function pickEmoji(e: string) {
    onChange(e);
    setOpen(false);
  }

  const emojiBtn = (e: string) => (
    <button
      key={e}
      type="button"
      onClick={() => pickEmoji(e)}
      className="flex size-11 items-center justify-center rounded-sm border-none text-[20px] transition-colors"
      style={{ background: value === e ? "rgba(0,102,204,0.1)" : "transparent" }}
      onMouseEnter={(el) => { (el.currentTarget as HTMLButtonElement).style.background = "var(--canvas-parchment)"; }}
      onMouseLeave={(el) => { (el.currentTarget as HTMLButtonElement).style.background = value === e ? "rgba(0,102,204,0.1)" : "transparent"; }}
    >
      {e}
    </button>
  );

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Chọn emoji"
        aria-label="Chọn emoji"
        aria-expanded={open}
        className="size-11 rounded-md bg-canvas-parchment cursor-pointer flex items-center justify-center shrink-0 transition-[border-color] text-ink-muted-48"
        style={{
          border: `1.5px solid ${open ? "var(--primary)" : "var(--hairline)"}`,
          fontSize: value ? 22 : 18,
        }}
      >
        {value ?? "🙂"}
      </button>

      {open && (
        <div ref={popoverRef} className="absolute bottom-[calc(100%+8px)] left-0 w-[300px] max-h-[360px] overflow-y-auto bg-canvas border border-hairline rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.14)] z-[500] py-2">
          {value && (
            <div style={{ padding: "0 10px 6px" }}>
              <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                className="min-h-11 rounded-sm border-0 bg-transparent px-xs font-body text-[15px] text-primary hover:bg-canvas-parchment">
                Xóa emoji
              </button>
            </div>
          )}

          {suggestions.length > 0 && (
            <div style={{ padding: "0 10px 8px", borderBottom: "1px solid var(--hairline)", marginBottom: 4 }}>
              <p className="font-body text-[10px] font-semibold text-primary tracking-[0.5px] uppercase mb-1 pl-0.5">
                Gợi ý
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {suggestions.map(emojiBtn)}
              </div>
            </div>
          )}

          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} style={{ padding: "0 10px 8px" }}>
              <p className="font-body text-[10px] font-semibold text-ink-muted-48 tracking-[0.5px] uppercase mb-1 pl-0.5">
                {group.label}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {group.emoji.map(emojiBtn)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
