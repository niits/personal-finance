import type { OrganizePatch, OrganizeCategoryState } from "@/lib/organize-patch";

export type OrganizePreview = {
  category_snapshot?: OrganizeCategoryState[];
  category_merges?: OrganizePatch["category_merges"];
  category_moves?: OrganizePatch["category_moves"];
  new_categories: {
    temp_id: string;
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    parent_category_name: string | null;
    emoji: string;
    example_notes: string[];
  }[];
  emoji_assignments: {
    category_id: number;
    category_name: string;
    current_emoji: string | null;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    current_updated_at: number;
    suggested_category_id: number | string;
    suggested_category_name: string;
    reason: string;
  }[];
  emoji_reassignments: {
    transaction_id: number;
    note: string;
    current_emoji: string | null;
    current_updated_at: number;
    emoji: string;
    reason: string;
  }[];
};

export type OrganizeSelection = {
  category_snapshot?: OrganizePreview["category_snapshot"];
  category_merges?: OrganizePreview["category_merges"];
  category_moves?: OrganizePreview["category_moves"];
  new_categories: OrganizePreview["new_categories"];
  emoji_assignments: OrganizePreview["emoji_assignments"];
  recategorizations: OrganizePreview["recategorizations"];
  emoji_reassignments: OrganizePreview["emoji_reassignments"];
};
