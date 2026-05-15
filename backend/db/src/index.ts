import { MongoClient, type Collection } from "mongodb";
import type {
  Category,
  Customer,
  Invoice,
  InvoiceItem,
  Order,
  OrderItem,
  Product,
  Staff,
  User,
} from "./schema";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI must be set. Provide a MongoDB connection string.");
}

const databaseName =
  process.env.MONGODB_DB ||
  (() => {
    try {
      const pathname = new URL(uri).pathname.replace(/^\//, "");
      return pathname || "showroom_pro";
    } catch {
      return "showroom_pro";
    }
  })();

export const client = new MongoClient(uri);
export const mongoDb = client.db(databaseName);

type Counter = {
  _id: string;
  seq: number;
};

export const countersCollection = mongoDb.collection<Counter>("counters");

export const collections = {
  users: mongoDb.collection<User>("users"),
  categories: mongoDb.collection<Category>("categories"),
  products: mongoDb.collection<Product>("products"),
  customers: mongoDb.collection<Customer>("customers"),
  staff: mongoDb.collection<Staff>("staff"),
  orders: mongoDb.collection<Order>("orders"),
  orderItems: mongoDb.collection<OrderItem>("order_items"),
  invoices: mongoDb.collection<Invoice>("invoices"),
  invoiceItems: mongoDb.collection<InvoiceItem>("invoice_items"),
};

export const db = collections;

export type CollectionName = keyof typeof collections;

export async function nextSequence(name: CollectionName): Promise<number> {
  const counter = await countersCollection.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  if (!counter) {
    throw new Error(`Failed to allocate id for ${name}`);
  }

  return counter.seq;
}

export async function insertWithId<T extends { id: number; createdAt?: Date; updatedAt?: Date }>(
  collection: Collection<T>,
  counterName: CollectionName,
  value: Omit<T, "id"> & Partial<Pick<T, "id" | "createdAt" | "updatedAt">>,
): Promise<T> {
  const now = new Date();
  const document = {
    ...value,
    id: value.id ?? await nextSequence(counterName),
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now,
  } as T;

  await collection.insertOne(document as T);
  return stripMongoId(document);
}

export function stripMongoId<T>(document: T): T {
  if (!document || typeof document !== "object") return document;
  const { _id: _ignored, ...rest } = document as T & { _id?: unknown };
  return rest as T;
}

export function stripMongoIds<T>(documents: T[]): T[] {
  return documents.map(stripMongoId);
}

export async function ensureMongoIndexes(): Promise<void> {
  await Promise.all([
    collections.users.createIndex({ id: 1 }, { unique: true }),
    collections.users.createIndex({ email: 1 }, { unique: true }),
    collections.users.createIndex({ sessionToken: 1 }, { sparse: true }),
    collections.categories.createIndex({ id: 1 }, { unique: true }),
    collections.categories.createIndex({ userId: 1, name: 1 }),
    collections.products.createIndex({ id: 1 }, { unique: true }),
    collections.products.createIndex({ userId: 1, sku: 1 }, { unique: true }),
    collections.customers.createIndex({ id: 1 }, { unique: true }),
    collections.customers.createIndex({ userId: 1, name: 1 }),
    collections.staff.createIndex({ id: 1 }, { unique: true }),
    collections.staff.createIndex({ userId: 1, email: 1 }, { unique: true }),
    collections.orders.createIndex({ id: 1 }, { unique: true }),
    collections.orders.createIndex({ userId: 1, createdAt: -1 }),
    collections.orderItems.createIndex({ id: 1 }, { unique: true }),
    collections.orderItems.createIndex({ orderId: 1 }),
    collections.invoices.createIndex({ id: 1 }, { unique: true }),
    collections.invoices.createIndex({ userId: 1, invoiceNumber: 1 }, { unique: true }),
    collections.invoiceItems.createIndex({ id: 1 }, { unique: true }),
    collections.invoiceItems.createIndex({ invoiceId: 1 }),
  ]);
}

void ensureMongoIndexes();

export * from "./schema";
