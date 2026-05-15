"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { CategoriesTemplate } from "@/components/templates/CategoriesTemplate";
import type { Category, Suggestion, RecategorizeSuggestion } from "@/components/templates/CategoriesTemplate";

const CATS_KEY = "/api/categories";

function hasMissingEmoji(categories: Category[]): boolean {
  for (const c of categories) {
    if (!c.emoji) return true;
    if (c.children?.some((ch) => !ch.emoji)) return true;
  }
  return false;
}

export default function CategoriesPage() {
  const { data, isLoading } = useSWR<{ categories: Category[] }>(CATS_KEY, fetcher);
  const cats = data?.categories ?? [];

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestState, setSuggestState] = useState<"loading" | "done" | "error" | "idle">("idle");
  const [recatSuggestions, setRecatSuggestions] = useState<RecategorizeSuggestion[] | null>(null);
  const [recatState, setRecatState] = useState<"loading" | "done" | "error" | "idle">("idle");
  const [runId, setRunId] = useState<number | null>(null);
  const autoFilledRef = useRef(false);

  async function handleAddCategory(
    name: string,
    emoji: string | null,
    parentId: number | null,
    type: "income" | "expense",
  ): Promise<{ error?: string }> {
    // Seed action — the template passes "_seed_" as a signal
    if (name === "_seed_") {
      await fetch("/api/categories/seed", { method: "POST" });
      mutate(CATS_KEY);
      return {};
    }
    const r = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId, type, emoji }),
    });
    const d = await r.json() as { category?: Category; error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    mutate(CATS_KEY);
    return {};
  }

  async function handleEditCategory(
    id: number,
    name: string,
    emoji: string | null,
  ): Promise<{ error?: string }> {
    const r = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji }),
    });
    const d = await r.json() as { error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    mutate(CATS_KEY);
    return {};
  }

  async function handleDeleteCategory(id: number): Promise<{ error?: string }> {
    const r = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!r.ok) return { error: "Lỗi" };
    mutate(CATS_KEY);
    return {};
  }

  async function handleAcceptSuggestion(suggestion: Suggestion): Promise<{ error?: string }> {
    const r = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suggestion.name, parent_id: suggestion.parent_category_id, type: suggestion.type }),
    });
    if (!r.ok) return { error: "Lỗi" };
    mutate(CATS_KEY);
    return {};
  }

  async function handleAcceptRecat(s: RecategorizeSuggestion): Promise<{ error?: string }> {
    const r = await fetch(`/api/transactions/${s.transaction_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: s.suggested_category_id }),
    });
    if (!r.ok) return { error: "Lỗi" };
    return {};
  }

  async function handleLoadSuggestions() {
    setSuggestState("loading");
    setSuggestions(null);
    setRecatState("idle");
    setRecatSuggestions(null);

    const r = await fetch("/api/categories/suggest", { method: "POST" }).catch(() => null);
    if (!r) { setSuggestState("error"); return; }
    const d = await r.json() as { suggestions: Suggestion[]; run_id: number; error?: string };
    if (!r.ok) { setSuggestState("error"); return; }
    setSuggestions(d.suggestions ?? []);
    setRunId(d.run_id ?? null);
    setSuggestState("done");
  }

  useEffect(() => {
    if (!isLoading && cats.length > 0 && !autoFilledRef.current && hasMissingEmoji(cats)) {
      autoFilledRef.current = true;
      fetch("/api/categories/fill-emoji", { method: "POST" })
        .then((r) => r.ok ? mutate(CATS_KEY) : null)
        .catch(() => null);
    }
  }, [cats, isLoading]);

  async function handleLoadRecatSuggestions() {
    setRecatState("loading");
    setRecatSuggestions(null);

    // Mark run as available
    if (runId) {
      await fetch(`/api/ai-suggestion-runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "available" }),
      });
    }

    const r = await fetch("/api/transactions/recategorize", { method: "POST" }).catch(() => null);
    if (!r?.ok) { setRecatState("error"); return; }
    const d = await r.json() as { suggestions: RecategorizeSuggestion[] };
    setRecatSuggestions(d.suggestions ?? []);
    setRecatState("done");
  }

  return (
    <CategoriesTemplate
      categories={cats}
      loading={isLoading}
      suggestions={suggestions}
      suggestState={suggestState}
      recatSuggestions={recatSuggestions}
      recatState={recatState}
      onAddCategory={handleAddCategory}
      onEditCategory={handleEditCategory}
      onDeleteCategory={handleDeleteCategory}
      onAcceptSuggestion={handleAcceptSuggestion}
      onAcceptRecat={handleAcceptRecat}
      onLoadSuggestions={handleLoadSuggestions}
      onLoadRecatSuggestions={handleLoadRecatSuggestions}
    />
  );
}
