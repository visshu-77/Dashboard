# Bulk Product Upload Feature

## Overview

The bulk product upload feature allows you to import multiple products at once using CSV or Excel files instead of adding them one by one.

## Supported Formats

- **CSV** (.csv)
- **Excel** (.xlsx, .xls)
- **Max file size**: 5MB

## File Format Requirements

Your file must contain the following columns (case-sensitive):

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| name | ✅ Yes | String | Product name, max 255 characters |
| sku | ✅ Yes | String | Unique identifier, must be unique in database |
| description | ❌ No | String | Product description |
| price | ✅ Yes | Number | Selling price (positive number) |
| cost | ✅ Yes | Number | Cost price (non-negative) |
| stock | ✅ Yes | Number | Quantity in stock (non-negative integer) |
| minStock | ❌ No | Number | Minimum stock level (default: 5) |
| categoryId | ❌ No | Number | Category ID (must exist in the current database) |
| categoryName | ❌ No | String | Preferred when importing from another system; matched against current category names |
| brand | ❌ No | String | Brand name |
| imageUrl | ❌ No | String | URL to product image |
| isActive | ❌ No | String/Boolean | "true", "1", "yes" = active (default: true) |

## Example CSV Format

```csv
name,sku,description,price,cost,stock,minStock,categoryId,categoryName,brand,imageUrl,isActive
Laptop Pro,SKU-001,Professional laptop,1299.99,799.99,50,5,,Electronics,TechBrand,https://example.com/laptop.jpg,true
Mouse Wireless,SKU-002,Wireless mouse,29.99,12.99,200,10,,Accessories,PeripheralCorp,,true
USB-C Cable,SKU-003,High-speed USB-C,14.99,5.99,500,20,,,Generic,,true
```

## Example Excel Format

Same structure as CSV but in Excel sheet format. The first sheet will be used.

## Download Template

1. Click the **Bulk Upload** button on the Products page
2. Click **Download Template** to get a sample CSV file
3. Fill in your product data following the format
4. Upload the file

## How to Use

1. **Navigate to Products Page**
   - Go to the Products management page in the showroom

2. **Click Bulk Upload Button**
   - Located next to the "Add Product" button

3. **Upload File**
   - Drag and drop your CSV/Excel file into the upload area, or
   - Click "Choose File" to browse for the file

4. **Review Results**
   - The system will validate your data
   - If there are errors, they'll be displayed with line numbers
   - If successful, all products will be imported

## Validation Rules

- **SKU uniqueness**: Each SKU in the file must be unique, and must not exist in the database
- **Required fields**: name, sku, price, cost, stock cannot be empty
- **Numeric validation**: price, cost, stock, minStock, categoryId must be valid numbers
- **Category matching**: `categoryId` must exist in the current database; `categoryName` is safer when IDs come from another file or system
- **Positive values**: price must be > 0; cost, stock, minStock must be >= 0

## Error Handling

### Duplicate SKUs in File
If the same SKU appears multiple times in your file:
```
Error: Duplicate SKUs found in file
Duplicates: SKU-001, SKU-005
```
**Solution**: Ensure each row has a unique SKU

### SKU Already Exists
If an SKU already exists in the database:
```
Error: Some SKUs already exist in database
Existing: SKU-001, SKU-002
```
**Solution**: Use different SKUs or update existing products manually

### Validation Errors
If data format is incorrect:
```
Row 3: price must be a valid positive number
Row 5: sku is required and must be a string
```
**Solution**: Check the CSV/Excel file for the specified row and fix the data

## Features

✅ **Batch Priority**: Processes all or nothing - if there's a critical error, no products are imported  
✅ **Comprehensive Validation**: Checks data types, required fields, and uniqueness  
✅ **Error Reporting**: Detailed line-by-line error messages  
✅ **Duplicate Detection**: Prevents duplicate SKUs within the file and database  
✅ **Auto-cleanup**: Uploaded files are automatically deleted after processing  

## API Endpoints

### POST /api/products/bulk-upload
Upload a CSV or Excel file with product data.

**Request:**
```
Content-Type: multipart/form-data
Body: file (CSV or Excel file)
```

**Success Response (201):**
```json
{
  "success": true,
  "imported": 50,
  "skipped": 2,
  "products": [
    {
      "id": 1,
      "name": "Laptop Pro",
      "sku": "SKU-001",
      "price": 1299.99,
      "cost": 799.99,
      "stock": 50,
      ...
    }
  ]
}
```

**Error Response (400):**
```json
{
  "error": "Some SKUs already exist in database",
  "existing": ["SKU-001", "SKU-002"]
}
```

### GET /api/products/download-template
Download a sample CSV template with proper formatting.

**Response:** CSV file download

## Tips for Best Results

1. **Test with small file first**: Before uploading hundreds of products, test with a few rows
2. **Prefer category names**: Use `categoryName` when importing from another system because category IDs often differ between databases
3. **Use clear SKUs**: Make SKUs descriptive and consistent
4. **Check stock values**: Ensure stock quantities are appropriate
5. **Validate prices**: Double-check all price and cost values before upload

## Troubleshooting

**File too large error:**
- Split your file into smaller chunks (max 5MB)

**Encoding issues with special characters:**
- Save your CSV as UTF-8 encoded

**Excel file not recognized:**
- Ensure file extension is .xlsx or .xls
- Save the file in the latest Excel format

**Products not showing after successful upload:**
- Page may need to be refreshed
- Check that `categoryId` values exist in this database, or use `categoryName` instead

## Future Enhancements

- Batch update of existing products
- CSV export functionality
- Import history/logs
- Scheduled/automated imports
