"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmojiPicker } from "@/components/organisms/EmojiPicker";

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  level: number;
  type: "income" | "expense";
  parent_id: number | null;
  system_kind: string | null;
  children: Category[];
};

type MutationResult = { error?: string };
type CategoryType = Category["type"];

export type CategoriesTemplateProps = {
  categories: Category[];
  usageCounts: Record<number, number>;
  loading: boolean;
  loadError?: string;
  seedState: "idle" | "loading" | "error";
  seedError?: string;
  onRetry: () => void;
  onSeed: () => Promise<MutationResult>;
  onAddCategory: (
    name: string,
    emoji: string | null,
    parentId: number | null,
    type: CategoryType,
  ) => Promise<MutationResult>;
  onEditCategory: (id: number, name: string, emoji: string | null) => Promise<MutationResult>;
  onDeleteCategory: (id: number) => Promise<MutationResult>;
};

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function systemLabel(systemKind: string): string {
  return systemKind.startsWith("savings_") ? "Hệ thống · Tiết kiệm" : "Hệ thống · Nợ";
}

function TypeSelector({
  value,
  onChange,
  counts,
}: {
  value: CategoryType;
  onChange: (type: CategoryType) => void;
  counts: Record<CategoryType, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-xxs rounded-md bg-canvas-parchment p-xxs" aria-label="Loại danh mục">
      {(["expense", "income"] as const).map((type) => {
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(type)}
            className={`min-h-11 rounded-sm border px-sm font-body text-[15px] font-semibold transition-colors ${
              selected
                ? "border-hairline bg-canvas text-ink"
                : "border-transparent bg-transparent text-ink-muted-48"
            }`}
          >
            {type === "expense" ? "Chi tiêu" : "Thu nhập"} · {counts[type]}
          </button>
        );
      })}
    </div>
  );
}

export function CategoriesTemplate({
  categories,
  usageCounts,
  loading,
  loadError,
  seedState,
  seedError,
  onRetry,
  onSeed,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoriesTemplateProps) {
  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState<string | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionCategoryId, setActionCategoryId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const dialogCancelRef = useRef<HTMLButtonElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const allCategories = flattenCategories(categories);
  const counts = allCategories.reduce<Record<CategoryType, number>>(
    (result, category) => {
      result[category.type] += 1;
      return result;
    },
    { expense: 0, income: 0 },
  );
  const visibleCategories = categories.filter((category) => category.type === activeType);
  const parentOptions = allCategories.filter(
    (category) => category.type === activeType && category.level < 3 && !category.system_kind,
  );
  const selectedParent = parentOptions.find((category) => category.id === parentId);

  useEffect(() => {
    if (!editingCategory && !deleteCategory) return;
    if (editingCategory) editInputRef.current?.focus();
    else dialogCancelRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setEditingCategory(null);
      setDeleteCategory(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editingCategory, deleteCategory]);

  function changeType(type: CategoryType) {
    setActiveType(type);
    setParentId(null);
    setActionCategoryId(null);
  }

  async function createCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError("");
    const result = await onAddCategory(newName.trim(), newEmoji, parentId, activeType);
    setSaving(false);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    setNewName("");
    setNewEmoji(null);
    setParentId(null);
    setShowCreate(false);
  }

  function openEdit(category: Category) {
    setActionCategoryId(null);
    setEditName(category.name);
    setEditEmoji(category.emoji);
    setEditError("");
    setEditingCategory(category);
  }

  async function saveEdit() {
    if (!editingCategory || !editName.trim()) return;
    setSaving(true);
    setEditError("");
    const result = await onEditCategory(editingCategory.id, editName.trim(), editEmoji);
    setSaving(false);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditingCategory(null);
  }

  async function confirmDelete() {
    if (!deleteCategory) return;
    setSaving(true);
    setDeleteError("");
    const result = await onDeleteCategory(deleteCategory.id);
    setSaving(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteCategory(null);
  }

  function renderCategory(category: Category, depth = 0): React.ReactNode {
    const childCount = category.children.length;
    const usageCount = usageCounts[category.id] ?? 0;
    const protectedCategory = Boolean(category.system_kind);
    const metadata = [
      childCount > 0 ? `${childCount} danh mục con` : null,
      usageCount > 0 ? `${usageCount} giao dịch` : "Chưa sử dụng",
    ].filter(Boolean).join(" · ");
    const indent = depth === 0 ? "pl-0" : depth === 1 ? "pl-lg" : "pl-xxl";

    return (
      <li key={category.id}>
        <div className={`relative border-b border-divider-soft py-sm pr-0 ${indent}`}>
          <div className="flex min-w-0 items-center gap-sm">
            {depth > 0 ? <span aria-hidden="true" className="text-ink-muted-48">└</span> : null}
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-canvas-parchment text-[20px]">
              {category.emoji ?? "•"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-xs gap-y-xxs">
                <p className="min-w-0 break-words font-body text-[17px] font-semibold leading-[23px] text-ink">
                  {category.name}
                </p>
                {protectedCategory ? (
                  <span className="inline-flex items-center gap-xxs rounded-pill bg-canvas-parchment px-xs py-xxs font-body text-[11px] font-semibold text-ink-muted-80">
                    <span aria-hidden="true">⌑</span>
                    {systemLabel(category.system_kind!)}
                  </span>
                ) : null}
              </div>
              <p className="mt-xxs font-body text-[13px] leading-[18px] text-ink-muted-48">{metadata}</p>
            </div>
            {!protectedCategory ? (
              <button
                type="button"
                aria-label={`Thao tác cho ${category.name}`}
                aria-expanded={actionCategoryId === category.id}
                onClick={() => setActionCategoryId((current) => current === category.id ? null : category.id)}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent font-body text-[22px] leading-none text-ink-muted-48"
              >
                ···
              </button>
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center text-ink-muted-48" aria-label="Danh mục được bảo vệ" title="Danh mục được bảo vệ">
                <span aria-hidden="true">🔒</span>
              </span>
            )}
          </div>
          {actionCategoryId === category.id ? (
            <div className="mt-xs flex justify-end gap-xs" aria-label={`Thao tác cho ${category.name}`}>
              <button type="button" onClick={() => openEdit(category)} className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] font-semibold text-primary">
                Đổi tên
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionCategoryId(null);
                  setDeleteError("");
                  setDeleteCategory(category);
                }}
                className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] font-semibold text-danger"
              >
                Xóa
              </button>
            </div>
          ) : null}
        </div>
        {category.children.length > 0 ? (
          <ul>{category.children.map((child) => renderCategory(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <main className="mx-auto min-h-full w-full max-w-[720px] bg-canvas px-5 pb-section pt-lg">
      <nav aria-label="Điều hướng cài đặt">
        <Link href="/account" className="-ml-xs inline-flex min-h-11 items-center gap-xxs px-xs font-body text-[15px] text-primary no-underline">
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
          Cài đặt
        </Link>
      </nav>

      <header className="mt-xs flex items-end justify-between gap-md border-b border-hairline pb-lg">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-[33px] tracking-[-0.28px] text-ink">Danh mục</h1>
          <p className="mt-xs font-body text-[15px] leading-[21px] text-ink-muted-48">Sắp xếp cách bạn theo dõi tiền vào và tiền ra.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate((visible) => !visible);
            setCreateError("");
          }}
          aria-expanded={showCreate}
          className="min-h-11 shrink-0 rounded-pill border-0 bg-primary px-md font-body text-[15px] font-semibold text-on-primary"
        >
          {showCreate ? "Đóng" : "Thêm"}
        </button>
      </header>

      {showCreate ? (
        <section className="border-b border-hairline py-lg" aria-labelledby="create-category-title">
          <h2 id="create-category-title" className="font-body text-[17px] font-semibold text-ink">Danh mục mới</h2>
          <div className="mt-sm flex items-start gap-xs">
            <EmojiPicker value={newEmoji} onChange={setNewEmoji} suggestForName={newName} />
            <label className="min-w-0 flex-1 font-body text-[13px] text-ink-muted-80">
              Tên danh mục
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && createCategory()}
                maxLength={100}
                className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-sm font-body text-[17px] text-ink outline-none"
              />
            </label>
          </div>
          <label className="mt-sm block font-body text-[13px] text-ink-muted-80">
            Nằm trong
            <select
              value={parentId ?? ""}
              onChange={(event) => setParentId(event.target.value ? Number(event.target.value) : null)}
              className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-sm font-body text-[17px] text-ink outline-none"
            >
              <option value="">Danh mục gốc</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <p className="mt-xs font-body text-[13px] leading-[18px] text-ink-muted-48">
            {selectedParent ? `Kế thừa loại từ “${selectedParent.name}”.` : `Danh mục ${activeType === "expense" ? "chi tiêu" : "thu nhập"} cấp 1.`}
          </p>
          {createError ? <p role="alert" className="mt-xs font-body text-[14px] text-danger">{createError}</p> : null}
          <div className="mt-md flex gap-xs">
            <button type="button" onClick={() => setShowCreate(false)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas font-body text-[15px] font-semibold text-ink">Hủy</button>
            <button type="button" onClick={createCategory} disabled={saving || !newName.trim()} className="min-h-11 flex-[2] rounded-md border-0 bg-primary font-body text-[15px] font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Đang lưu…" : "Lưu danh mục"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !loadError ? (
        <div className="py-lg"><TypeSelector value={activeType} onChange={changeType} counts={counts} /></div>
      ) : null}

      {loading ? (
        <div aria-live="polite" aria-busy="true" className="space-y-xs py-lg">
          <p className="sr-only">Đang tải danh mục</p>
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-canvas-parchment" />)}
        </div>
      ) : loadError ? (
        <section className="py-xxl text-center" aria-labelledby="load-error-title">
          <h2 id="load-error-title" className="font-display text-[21px] font-semibold text-ink">Không thể tải danh mục</h2>
          <p role="alert" className="mx-auto mt-xs max-w-md font-body text-[15px] leading-[21px] text-ink-muted-80">{loadError}</p>
          <button type="button" onClick={onRetry} className="mt-lg min-h-11 rounded-pill border-0 bg-primary px-lg font-body text-[15px] font-semibold text-on-primary">Thử lại</button>
        </section>
      ) : categories.length === 0 ? (
        <section className="py-xxl text-center" aria-labelledby="empty-title">
          <h2 id="empty-title" className="font-display text-[21px] font-semibold text-ink">Bắt đầu với danh mục của bạn</h2>
          <p className="mx-auto mt-xs max-w-sm font-body text-[15px] leading-[21px] text-ink-muted-48">Tạo riêng từng danh mục hoặc dùng bộ mẫu để bắt đầu nhanh.</p>
          {seedError ? <p role="alert" className="mx-auto mt-sm max-w-sm font-body text-[14px] leading-[20px] text-danger">{seedError}</p> : null}
          <button type="button" onClick={onSeed} disabled={seedState === "loading"} className="mt-lg min-h-11 rounded-pill border-0 bg-primary px-lg font-body text-[15px] font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60">
            {seedState === "loading" ? "Đang tạo danh mục mẫu…" : seedState === "error" ? "Thử tạo lại" : "Tạo danh mục mẫu"}
          </button>
        </section>
      ) : visibleCategories.length === 0 ? (
        <section className="py-xxl text-center">
          <h2 className="font-display text-[21px] font-semibold text-ink">Chưa có danh mục {activeType === "expense" ? "chi tiêu" : "thu nhập"}</h2>
          <p className="mt-xs font-body text-[15px] text-ink-muted-48">Chọn “Thêm” để tạo danh mục đầu tiên.</p>
        </section>
      ) : (
        <section aria-labelledby="category-list-title">
          <div className="flex items-baseline justify-between gap-sm">
            <h2 id="category-list-title" className="font-body text-[17px] font-semibold text-ink">{activeType === "expense" ? "Chi tiêu" : "Thu nhập"}</h2>
            <p className="font-body text-[13px] text-ink-muted-48">Tối đa 3 cấp</p>
          </div>
          <ul className="mt-xs border-t border-divider-soft">{visibleCategories.map((category) => renderCategory(category))}</ul>
        </section>
      )}

      {editingCategory ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-surface-black/40 p-0 sm:items-center sm:p-lg" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingCategory(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-title" className="w-full max-w-md rounded-t-[24px] bg-canvas p-5 sm:rounded-[24px]">
            <h2 id="edit-title" className="font-display text-[21px] font-semibold text-ink">Đổi tên “{editingCategory.name}”</h2>
            <div className="mt-lg flex items-start gap-xs">
              <EmojiPicker value={editEmoji} onChange={setEditEmoji} suggestForName={editName} />
              <label className="min-w-0 flex-1 font-body text-[13px] text-ink-muted-80">
                Tên danh mục
                <input ref={editInputRef} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-sm font-body text-[17px] text-ink outline-none" />
              </label>
            </div>
            {editError ? <p role="alert" className="mt-xs font-body text-[14px] text-danger">{editError}</p> : null}
            <div className="mt-lg flex gap-xs">
              <button ref={dialogCancelRef} type="button" onClick={() => setEditingCategory(null)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas font-body text-[15px] font-semibold text-ink">Hủy</button>
              <button type="button" onClick={saveEdit} disabled={saving || !editName.trim()} className="min-h-11 flex-[2] rounded-md border-0 bg-primary font-body text-[15px] font-semibold text-on-primary disabled:opacity-60">{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteCategory ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-surface-black/40 p-0 sm:items-center sm:p-lg" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleteCategory(null)}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" className="w-full max-w-md rounded-t-[24px] bg-canvas p-5 sm:rounded-[24px]">
            <h2 id="delete-title" className="font-display text-[21px] font-semibold text-ink">Xóa “{deleteCategory.name}”?</h2>
            <p id="delete-description" className="mt-xs font-body text-[15px] leading-[21px] text-ink-muted-80">
              {deleteCategory.children.length > 0
                ? `Danh mục này có ${deleteCategory.children.length} danh mục con. Bạn cần xóa các danh mục con trước.`
                : (usageCounts[deleteCategory.id] ?? 0) > 0
                  ? `Danh mục này đang được dùng bởi ${usageCounts[deleteCategory.id]} giao dịch. Các giao dịch phải được chuyển sang danh mục khác trước.`
                  : "Thao tác này không thể hoàn tác."}
            </p>
            {deleteError ? <p role="alert" className="mt-sm font-body text-[14px] leading-[20px] text-danger">{deleteError}</p> : null}
            <div className="mt-lg flex gap-xs">
              {deleteCategory.children.length > 0 || (usageCounts[deleteCategory.id] ?? 0) > 0 ? (
                <button ref={dialogCancelRef} type="button" onClick={() => setDeleteCategory(null)} className="min-h-11 w-full rounded-md border border-hairline bg-canvas font-body text-[15px] font-semibold text-ink">Đã hiểu</button>
              ) : (
                <><button ref={dialogCancelRef} type="button" onClick={() => setDeleteCategory(null)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas font-body text-[15px] font-semibold text-ink">Giữ lại</button><button type="button" onClick={confirmDelete} disabled={saving} className="min-h-11 flex-[2] rounded-md border-0 bg-danger font-body text-[15px] font-semibold text-on-primary disabled:opacity-60">{saving ? "Đang xóa…" : `Xóa “${deleteCategory.name}”`}</button></>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
