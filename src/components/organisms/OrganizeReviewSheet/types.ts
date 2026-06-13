export type OrganizePreview = {
  new_categories: {
    temp_id: string;
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    example_notes: string[];
  }[];
  emoji_assignments: {
    category_id: number;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number | string;
    suggested_category_name: string;
    reason: string;
  }[];
  emoji_reassignments: {
    transaction_id: number;
    note: string;
    current_emoji: string | null;
    emoji: string;
    reason: string;
  }[];
};

export type OrganizeSelection = {
  new_categories: OrganizePreview["new_categories"];
  emoji_assignments: OrganizePreview["emoji_assignments"];
  recategorizations: OrganizePreview["recategorizations"];
  emoji_reassignments: OrganizePreview["emoji_reassignments"];
};
