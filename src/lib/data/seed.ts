// Client-side idempotent seed run on first sign-in.
import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { budgetConfigDoc, categoriesCol } from "@/lib/firestore-refs";
import type { CategoryDoc } from "@/lib/schema";

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

export async function seedNewUser(db: Firestore, uid: string): Promise<void> {
  const cfgRef = budgetConfigDoc(db, uid);
  const cfgSnap = await getDoc(cfgRef);
  if (!cfgSnap.exists()) {
    await setDoc(cfgRef, {
      defaultMonthlyAmount: 10_000_000,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    });
  }

  const cats = categoriesCol(db, uid);
  const existing = await getDocs(query(cats, limit(1)));
  if (!existing.empty) return;

  for (const parent of SEED_CATEGORIES) {
    const parentRef = doc(cats);
    const parentData: CategoryDoc = {
      name: parent.name,
      parentId: null,
      level: 1,
      sortOrder: parent.sortOrder,
      type: parent.type,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };
    await setDoc(parentRef, parentData);

    for (const child of parent.children) {
      const childData: CategoryDoc = {
        name: child.name,
        parentId: parentRef.id,
        level: 2,
        sortOrder: child.sortOrder,
        type: parent.type,
        createdAt: serverTimestamp() as unknown as Timestamp,
      };
      await addDoc(cats, childData);
    }
  }
}
