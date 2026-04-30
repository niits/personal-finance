const SEED_CATEGORIES: {
  name: string;
  sortOrder: number;
  children: { name: string; sortOrder: number }[];
}[] = [
  {
    name: "Ăn uống",
    sortOrder: 0,
    children: [
      { name: "Ăn ngoài", sortOrder: 0 },
      { name: "Đi chợ / siêu thị", sortOrder: 1 },
      { name: "Đồ uống", sortOrder: 2 },
    ],
  },
  {
    name: "Đi lại",
    sortOrder: 1,
    children: [
      { name: "Xăng", sortOrder: 0 },
      { name: "Gửi xe", sortOrder: 1 },
      { name: "Taxi / Grab", sortOrder: 2 },
    ],
  },
  {
    name: "Mua sắm",
    sortOrder: 2,
    children: [
      { name: "Quần áo", sortOrder: 0 },
      { name: "Điện tử", sortOrder: 1 },
      { name: "Gia dụng", sortOrder: 2 },
    ],
  },
  {
    name: "Sức khoẻ",
    sortOrder: 3,
    children: [
      { name: "Thuốc", sortOrder: 0 },
      { name: "Khám bệnh", sortOrder: 1 },
    ],
  },
  {
    name: "Giải trí",
    sortOrder: 4,
    children: [
      { name: "Phim / sự kiện", sortOrder: 0 },
      { name: "Game", sortOrder: 1 },
      { name: "Du lịch", sortOrder: 2 },
    ],
  },
  {
    name: "Hoá đơn & dịch vụ",
    sortOrder: 5,
    children: [
      { name: "Điện nước", sortOrder: 0 },
      { name: "Internet / điện thoại", sortOrder: 1 },
      { name: "Thuê nhà", sortOrder: 2 },
    ],
  },
  {
    name: "Thu nhập",
    sortOrder: 6,
    children: [
      { name: "Lương", sortOrder: 0 },
      { name: "Thưởng", sortOrder: 1 },
      { name: "Thu nhập khác", sortOrder: 2 },
    ],
  },
];

export async function seedNewUser(db: D1Database, userId: string): Promise<void> {
  // Insert budget_config (INSERT OR IGNORE for idempotency)
  await db
    .prepare(
      "INSERT OR IGNORE INTO budget_config (user_id, default_monthly_amount, updated_at) VALUES (?, 10000000, unixepoch())",
    )
    .bind(userId)
    .run();

  // Insert seed categories
  for (const parent of SEED_CATEGORIES) {
    const parentResult = await db
      .prepare(
        "INSERT OR IGNORE INTO category (user_id, name, parent_id, level, sort_order) VALUES (?, ?, NULL, 1, ?)",
      )
      .bind(userId, parent.name, parent.sortOrder)
      .run();

    // Get parent id — look it up since INSERT OR IGNORE may skip on re-seed
    const parentRow = await db
      .prepare(
        "SELECT id FROM category WHERE user_id = ? AND name = ? AND parent_id IS NULL",
      )
      .bind(userId, parent.name)
      .first<{ id: number }>();

    if (!parentRow) continue;
    const parentId = parentRow.id;

    // Suppress unused variable warning
    void parentResult;

    for (const child of parent.children) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO category (user_id, name, parent_id, level, sort_order) VALUES (?, ?, ?, 2, ?)",
        )
        .bind(userId, child.name, parentId, child.sortOrder)
        .run();
    }
  }
}
