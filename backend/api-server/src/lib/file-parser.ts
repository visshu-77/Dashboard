import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export interface ProductRow {
  name: string;
  sku: string;
  description?: string;
  price: number;
  cost: number;
  stock: number;
  minStock?: number;
  categoryId?: number;
  categoryName?: string;
  brand?: string;
  imageUrl?: string;
  isActive?: string | boolean;
}

/**
 * Parse CSV file or buffer and return array of product rows
 */
export function parseCSVFile(input: Buffer | string): ProductRow[] {
  try {
    const fileContent = typeof input === "string" ? fs.readFileSync(input, "utf-8") : input.toString("utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        // Auto-cast numeric columns
        if (
          typeof context.column === "string" &&
          ["price", "cost", "stock", "minStock", "categoryId"].includes(context.column)
        ) {
          return value === "" ? undefined : Number(value);
        }
        // Cast boolean
        if (context.column === "isActive") {
          return value === "true" || value === "1" || value === "yes" ? true : value === "false" || value === "0" || value === "no" ? false : value;
        }
        return value;
      },
    });

    return records as ProductRow[];
  } catch (error) {
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Parse Excel buffer and return array of product rows
 */
export function parseExcelFile(input: Buffer | string): ProductRow[] {
  try {
    const buffer = typeof input === "string" ? fs.readFileSync(input) : input;
    const workbook = XLSX.read(buffer);
    // Use first sheet by default
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("No sheets found in Excel file");
    }

    const worksheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(worksheet, {
      blankrows: false,
      defval: "",
    });

    // Cast values appropriately
    return records.map((record: any) => ({
      name: record.name?.toString().trim() || "",
      sku: record.sku?.toString().trim() || "",
      description: record.description?.toString().trim() || undefined,
      price: record.price ? Number(record.price) : 0,
      cost: record.cost ? Number(record.cost) : 0,
      stock: record.stock ? Number(record.stock) : 0,
      minStock: record.minStock ? Number(record.minStock) : undefined,
      categoryId: record.categoryId ? Number(record.categoryId) : undefined,
      categoryName: record.categoryName?.toString().trim() || undefined,
      brand: record.brand?.toString().trim() || undefined,
      imageUrl: record.imageUrl?.toString().trim() || undefined,
      isActive: record.isActive ? (record.isActive === "true" || record.isActive === "1" || record.isActive === "yes" ? true : false) : true,
    })) as ProductRow[];
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate product row before insertion
 */
export function validateProductRow(row: ProductRow, rowIndex: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
    errors.push(`Row ${rowIndex}: name is required and must be a string`);
  }

  if (!row.sku || typeof row.sku !== "string" || !row.sku.trim()) {
    errors.push(`Row ${rowIndex}: sku is required and must be a string`);
  }

  if (typeof row.price !== "number" || row.price < 0) {
    errors.push(`Row ${rowIndex}: price must be a valid positive number`);
  }

  if (typeof row.cost !== "number" || row.cost < 0) {
    errors.push(`Row ${rowIndex}: cost must be a valid positive number`);
  }

  if (typeof row.stock !== "number" || row.stock < 0) {
    errors.push(`Row ${rowIndex}: stock must be a valid non-negative number`);
  }

  if (row.minStock !== undefined && (typeof row.minStock !== "number" || row.minStock < 0)) {
    errors.push(`Row ${rowIndex}: minStock must be a valid non-negative number`);
  }

  if (row.categoryId !== undefined && (typeof row.categoryId !== "number" || row.categoryId < 0)) {
    errors.push(`Row ${rowIndex}: categoryId must be a valid positive number`);
  }

  if (row.categoryName !== undefined && !row.categoryName.trim()) {
    errors.push(`Row ${rowIndex}: categoryName must be a non-empty string when provided`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Clean up uploaded file
 */
export function deleteUploadedFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Log error but don't throw
    console.error(`Failed to delete file ${filePath}:`, error);
  }
}
