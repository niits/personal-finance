const SEED_CATEGORIES: {
  name: string;
  type: "income" | "expense";
  sortOrder: number;
  children: { name: string; sortOrder: number }[];
}[] = [
  {
    name: "Ăn uống",
    type: "expense",
    sortOrder: 0,
    children: [
      { name: "Ăn ngoài", sortOrder: 0 },
      { name: "Đi chợ / siêu thị", sortOrder: 1 },
      { name: "Đồ uống", sortOrder: 2 },
    ],
  },
  {
    name: "Đi lại",
    type: "expense",
    sortOrder: 1,
    children: [
      { name: "Xăng", sortOrder: 0 },
      { name: "Gửi xe", sortOrder: 1 },
      { name: "Taxi / Grab", sortOrder: 2 },
    ],
  },
  {
    name: "Mua sắm",
    type: "expense",
    sortOrder: 2,
    children: [
      { name: "Quần áo", sortOrder: 0 },
      { name: "Điện tử", sortOrder: 1 },
      { name: "Gia dụng", sortOrder: 2 },
    ],
  },
  {
    name: "Sức khoẻ",
    type: "expense",
    sortOrder: 3,
    children: [
      { name: "Thuốc", sortOrder: 0 },
      { name: "Khám bệnh", sortOrder: 1 },
    ],
  },
  {
    name: "Giải trí",
    type: "expense",
    sortOrder: 4,
    children: [
      { name: "Phim / sự kiện", sortOrder: 0 },
      { name: "Game", sortOrder: 1 },
      { name: "Du lịch", sortOrder: 2 },
    ],
  },
  {
    name: "Hoá đơn & dịch vụ",
    type: "expense",
    sortOrder: 5,
    children: [
      { name: "Điện nước", sortOrder: 0 },
      { name: "Internet / điện thoại", sortOrder: 1 },
      { name: "Thuê nhà", sortOrder: 2 },
    ],
  },
  {
    name: "Thu nhập",
    type: "income",
    sortOrder: 6,
    children: [
      { name: "Lương", sortOrder: 0 },
      { name: "Thưởng", sortOrder: 1 },
      { name: "Thu nhập khác", sortOrder: 2 },
    ],
  },
];

export async function seedNewUser(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO budget_config (user_id, default_monthly_amount, updated_at) VALUES (?, 10000000, unixepoch())",
    )
    .bind(userId)
    .run();

  for (const parent of SEED_CATEGORIES) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO category (user_id, name, parent_id, level, sort_order, type) VALUES (?, ?, NULL, 1, ?, ?)",
      )
      .bind(userId, parent.name, parent.sortOrder, parent.type)
      .run();

    const parentRow = await db
      .prepare(
        "SELECT id FROM category WHERE user_id = ? AND name = ? AND parent_id IS NULL",
      )
      .bind(userId, parent.name)
      .first<{ id: number }>();

    if (!parentRow) continue;

    for (const child of parent.children) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO category (user_id, name, parent_id, level, sort_order, type) VALUES (?, ?, ?, 2, ?, ?)",
        )
        .bind(userId, child.name, parentRow.id, child.sortOrder, parent.type)
        .run();
    }
  }
}
