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
export declare function parseCSVFile(input: Buffer | string): ProductRow[];
/**
 * Parse Excel buffer and return array of product rows
 */
export declare function parseExcelFile(input: Buffer | string): ProductRow[];
/**
 * Validate product row before insertion
 */
export declare function validateProductRow(row: ProductRow, rowIndex: number): {
    valid: boolean;
    errors: string[];
};
/**
 * Clean up uploaded file
 */
export declare function deleteUploadedFile(filePath: string): void;
//# sourceMappingURL=file-parser.d.ts.map