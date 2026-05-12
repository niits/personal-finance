import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { categoriesCol, transactionsCol } from "@/lib/firestore-refs";
import type { Category, CategoryDoc, Type } from "@/lib/schema";

export async function listCategories(db: Firestore, uid: string): Promise<Category[]> {
  const snap = await getDocs(categoriesCol(db, uid));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort(
    (a, b) =>
      a.level - b.level ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
  return rows;
}

export type CreateCategoryInput = {
  name: string;
  parentId: string | null;
  type?: Type; // required when parentId is null
};

export class CategoryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function createCategory(
  db: Firestore,
  uid: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const name = input.name.trim();
  if (name.length === 0) throw new CategoryError("VALIDATION", "Tên danh mục không được để trống");
  if (name.length > 100) throw new CategoryError("VALIDATION", "Tên danh mục tối đa 100 ký tự");

  let level = 1;
  let resolvedType: Type;

  if (input.parentId) {
    const parentSnap = await getDoc(doc(categoriesCol(db, uid), input.parentId));
    if (!parentSnap.exists()) throw new CategoryError("FORBIDDEN", "Danh mục cha không tồn tại");
    const parent = parentSnap.data();
    if (parent.level >= 3) {
      throw new CategoryError("CONFLICT", "Danh mục cấp 3 không thể có danh mục con");
    }
    level = parent.level + 1;
    resolvedType = parent.type;
  } else {
    if (input.type !== "income" && input.type !== "expense") {
      throw new CategoryError("VALIDATION", "type phải là 'income' hoặc 'expense'");
    }
    resolvedType = input.type;
  }

  const data: CategoryDoc = {
    name,
    parentId: input.parentId,
    level,
    sortOrder: 0,
    type: resolvedType,
    createdAt: serverTimestamp() as unknown as Timestamp,
  };
  const ref = await addDoc(categoriesCol(db, uid), data);
  const created = await getDoc(ref);
  return { id: ref.id, ...(created.data() as CategoryDoc) };
}

export async function updateCategory(
  db: Firestore,
  uid: string,
  id: string,
  input: { name?: string; sortOrder?: number },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0) throw new CategoryError("VALIDATION", "Tên danh mục không được để trống");
    if (name.length > 100) throw new CategoryError("VALIDATION", "Tên danh mục tối đa 100 ký tự");
    updates.name = name;
  }
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (Object.keys(updates).length === 0) {
    throw new CategoryError("VALIDATION", "Không có trường nào để cập nhật");
  }
  await updateDoc(doc(categoriesCol(db, uid), id), updates);
}

export async function deleteCategory(
  db: Firestore,
  uid: string,
  id: string,
): Promise<void> {
  // Reject if any child category exists.
  const childSnap = await getDocs(
    query(categoriesCol(db, uid), where("parentId", "==", id), limit(1)),
  );
  if (!childSnap.empty) {
    throw new CategoryError("CONFLICT", "Vui lòng xóa danh mục con trước");
  }

  // Reject if any transaction uses it.
  const txSnap = await getDocs(
    query(transactionsCol(db, uid), where("categoryId", "==", id), limit(1)),
  );
  if (!txSnap.empty) {
    throw new CategoryError("CATEGORY_IN_USE", "Danh mục đang được dùng bởi giao dịch");
  }

  await deleteDoc(doc(categoriesCol(db, uid), id));
}

export async function isLeafCategory(
  db: Firestore,
  uid: string,
  id: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(categoriesCol(db, uid), where("parentId", "==", id), limit(1)),
  );
  return snap.empty;
}
