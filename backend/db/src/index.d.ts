import { MongoClient, type Collection } from "mongodb";
import type { Category, Customer, Invoice, InvoiceItem, Order, OrderItem, Product, Staff, User } from "./schema";
export declare const client: MongoClient;
export declare const mongoDb: import("mongodb").Db;
type Counter = {
    _id: string;
    seq: number;
};
export declare const countersCollection: Collection<Counter>;
export declare const collections: {
    users: Collection<User>;
    categories: Collection<Category>;
    products: Collection<Product>;
    customers: Collection<Customer>;
    staff: Collection<Staff>;
    orders: Collection<Order>;
    orderItems: Collection<OrderItem>;
    invoices: Collection<Invoice>;
    invoiceItems: Collection<InvoiceItem>;
};
export declare const db: {
    users: Collection<User>;
    categories: Collection<Category>;
    products: Collection<Product>;
    customers: Collection<Customer>;
    staff: Collection<Staff>;
    orders: Collection<Order>;
    orderItems: Collection<OrderItem>;
    invoices: Collection<Invoice>;
    invoiceItems: Collection<InvoiceItem>;
};
export type CollectionName = keyof typeof collections;
export declare function nextSequence(name: CollectionName): Promise<number>;
export declare function insertWithId<T extends {
    id: number;
    createdAt?: Date;
    updatedAt?: Date;
}>(collection: Collection<T>, counterName: CollectionName, value: Omit<T, "id"> & Partial<Pick<T, "id" | "createdAt" | "updatedAt">>): Promise<T>;
export declare function stripMongoId<T>(document: T): T;
export declare function stripMongoIds<T>(documents: T[]): T[];
export declare function ensureMongoIndexes(): Promise<void>;
export * from "./schema";
//# sourceMappingURL=index.d.ts.map