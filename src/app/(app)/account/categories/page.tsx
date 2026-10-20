"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { CategoriesTemplate } from "@/components/templates/CategoriesTemplate";
import type { Category } from "@/components/templates/CategoriesTemplate";
import { fetcher } from "@/lib/fetcher";
import type { CategoryTreeChange, CategoryTreePlan } from "@/lib/category-tree-organize";

type TreePreview = CategoryTreePlan & { snapshot: string; changes: CategoryTreeChange[] };

const CATEGORIES_KEY = "/api/categories";

type CategoriesResponse = {
  categories: Category[];
  usage_counts: Record<number, number>;
};

type ErrorResponse = {
  error?: string;
  details?: { transaction_count?: number };
};

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as ErrorResponse | null;
  return body?.error ?? fallback;
}

export default function CategoriesPage() {
  const { data, error, isLoading, mutate } = useSWR<CategoriesResponse>(CATEGORIES_KEY, fetcher);
  const [seedState, setSeedState] = useState<"idle" | "loading" | "error">("idle");
  const [seedError, setSeedError] = useState("");
  const [organizeState, setOrganizeState] = useState<"idle" | "loading" | "review" | "applying">("idle");
  const [treePreview, setTreePreview] = useState<TreePreview | null>(null);
  const [organizeError, setOrganizeError] = useState("");
  const [organizeResult, setOrganizeResult] = useState("");
  const [organizeBlocked, setOrganizeBlocked] = useState(false);
  const organizePending = useRef(false);

  async function handleOrganize() {
    if (organizePending.current) return;
    organizePending.current = true;
    setOrganizeState("loading");
    setOrganizeError("");
    setOrganizeResult("");
    setOrganizeBlocked(false);
    try {
      const response = await fetch("/api/categories/organize", { method: "POST" });
      if (!response.ok) {
        setOrganizeError(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : await readError(response, "Không thể đề xuất cây danh mục. Vui lòng thử lại."));
        setOrganizeState("idle");
        return;
      }
      setTreePreview(await response.json() as TreePreview);
      setOrganizeState("review");
    } catch {
      setOrganizeError("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
      setOrganizeState("idle");
    } finally {
      organizePending.current = false;
    }
  }

  async function handleOrganizeApply() {
    if (!treePreview || organizePending.current || organizeBlocked) return;
    organizePending.current = true;
    setOrganizeState("applying");
    setOrganizeError("");
    try {
      const response = await fetch("/api/categories/organize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: treePreview.snapshot, nodes: treePreview.nodes }),
      });
      if (!response.ok) {
        setOrganizeBlocked(response.status === 409);
        setOrganizeError(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : await readError(response, "Không thể áp dụng cây danh mục. Vui lòng thử lại."));
        setOrganizeState("review");
        return;
      }
      const result = await response.json() as { updated_categories: number };
      setTreePreview(null);
      setOrganizeState("idle");
      setOrganizeResult(`Đã sắp xếp lại ${result.updated_categories} danh mục.`);
      await mutate().catch(() => undefined);
    } catch {
      setOrganizeError("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
      setOrganizeState("review");
    } finally {
      organizePending.current = false;
    }
  }

  function handleOrganizeCancel() {
    if (organizePending.current) return;
    setTreePreview(null);
    setOrganizeState("idle");
    setOrganizeError("");
    setOrganizeBlocked(false);
  }

  async function handleSeed(): Promise<{ error?: string }> {
    setSeedState("loading");
    setSeedError("");
    const response = await fetch("/api/categories/seed", { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      const message = response
        ? await readError(response, "Không thể tạo danh mục mẫu. Vui lòng thử lại.")
        : "Không thể kết nối. Vui lòng thử lại.";
      setSeedError(message);
      setSeedState("error");
      return { error: message };
    }
    await mutate();
    setSeedState("idle");
    return {};
  }

  async function handleAddCategory(
    name: string,
    emoji: string | null,
    parentId: number | null,
    type: "income" | "expense",
  ): Promise<{ error?: string }> {
    const response = await fetch(CATEGORIES_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, parent_id: parentId, type }),
    }).catch(() => null);
    if (!response?.ok) {
      return { error: response ? await readError(response, "Không thể tạo danh mục.") : "Không thể kết nối. Vui lòng thử lại." };
    }
    await mutate();
    return {};
  }

  async function handleEditCategory(id: number, name: string, emoji: string | null): Promise<{ error?: string }> {
    const response = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji }),
    }).catch(() => null);
    if (!response?.ok) {
      return { error: response ? await readError(response, "Không thể cập nhật danh mục.") : "Không thể kết nối. Vui lòng thử lại." };
    }
    await mutate();
    return {};
  }

  async function handleDeleteCategory(id: number): Promise<{ error?: string }> {
    const response = await fetch(`/api/categories/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      return { error: response ? await readError(response, "Không thể xóa danh mục.") : "Không thể kết nối. Vui lòng thử lại." };
    }
    await mutate();
    return {};
  }

  return (
    <CategoriesTemplate
      categories={data?.categories ?? []}
      usageCounts={data?.usage_counts ?? {}}
      loading={isLoading}
      loadError={error instanceof Error ? error.message : error ? "Không thể kết nối. Vui lòng thử lại." : undefined}
      seedState={seedState}
      seedError={seedError}
      organizeState={organizeState}
      organizeChanges={treePreview?.changes ?? []}
      organizeError={organizeError}
      organizeResult={organizeResult}
      organizeBlocked={organizeBlocked}
      onOrganize={handleOrganize}
      onOrganizeApply={handleOrganizeApply}
      onOrganizeCancel={handleOrganizeCancel}
      onRetry={() => mutate()}
      onSeed={handleSeed}
      onAddCategory={handleAddCategory}
      onEditCategory={handleEditCategory}
      onDeleteCategory={handleDeleteCategory}
    />
  );
}
