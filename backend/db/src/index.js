import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI must be set. Provide a MongoDB connection string.");
}
const databaseName = process.env.MONGODB_DB ||
    (() => {
        try {
            const pathname = new URL(uri).pathname.replace(/^\//, "");
            return pathname || "showroom_pro";
        }
        catch {
            return "showroom_pro";
        }
    })();
export const client = new MongoClient(uri);
export const mongoDb = client.db(databaseName);
export const countersCollection = mongoDb.collection("counters");
export const collections = {
    users: mongoDb.collection("users"),
    categories: mongoDb.collection("categories"),
    products: mongoDb.collection("products"),
    customers: mongoDb.collection("customers"),
    staff: mongoDb.collection("staff"),
    orders: mongoDb.collection("orders"),
    orderItems: mongoDb.collection("order_items"),
    invoices: mongoDb.collection("invoices"),
    invoiceItems: mongoDb.collection("invoice_items"),
};
export const db = collections;
export async function nextSequence(name) {
    const counter = await countersCollection.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    if (!counter) {
        throw new Error(`Failed to allocate id for ${name}`);
    }
    return counter.seq;
}
export async function insertWithId(collection, counterName, value) {
    const now = new Date();
    const document = {
        ...value,
        id: value.id ?? await nextSequence(counterName),
        createdAt: value.createdAt ?? now,
        updatedAt: value.updatedAt ?? now,
    };
    await collection.insertOne(document);
    return stripMongoId(document);
}
export function stripMongoId(document) {
    if (!document || typeof document !== "object")
        return document;
    const { _id: _ignored, ...rest } = document;
    return rest;
}
export function stripMongoIds(documents) {
    return documents.map(stripMongoId);
}
export async function ensureMongoIndexes() {
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
//# sourceMappingURL=index.js.map