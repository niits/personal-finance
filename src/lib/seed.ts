import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";
import { sql } from "kysely";

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

export async function seedNewUser(db: Kysely<Database>, userId: string): Promise<void> {
  await db
    .insertInto("budget_config")
    .values({
      user_id: userId,
      default_monthly_amount: 10_000_000,
      updated_at: sql<number>`unixepoch()`,
    })
    .onConflict((oc) => oc.column("user_id").doNothing())
    .execute();

  for (const parent of SEED_CATEGORIES) {
    await db
      .insertInto("category")
      .values({
        user_id: userId,
        name: parent.name,
        parent_id: null,
        level: 1,
        sort_order: parent.sortOrder,
        type: parent.type,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();

    const parentRow = await db
      .selectFrom("category")
      .select("id")
      .where("user_id", "=", userId)
      .where("name", "=", parent.name)
      .where("parent_id", "is", null)
      .executeTakeFirst();

    if (!parentRow) continue;

    for (const child of parent.children) {
      await db
        .insertInto("category")
        .values({
          user_id: userId,
          name: child.name,
          parent_id: parentRow.id,
          level: 2,
          sort_order: child.sortOrder,
          type: parent.type,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }
}
