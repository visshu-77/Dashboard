import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateProduct, useListProducts, useUpdateProduct, useDeleteProduct } from "api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal";
import { Upload, Edit, Trash2, Image as ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { compressImageForUpload } from "@/lib/image-compression";

type ProductFormData = {
  name: string;
  sku: string;
  description: string;
  price: string;
  cost: string;
  stock: string;
  minStock: string;
  categoryId: string;
  brand: string;
  imageUrl: string;
  isActive: boolean;
};

type Category = {
  id: number;
  name: string;
};

type UploadImageResponse = {
  url: string;
};

const emptyForm: ProductFormData = {
  name: "",
  sku: "",
  description: "",
  price: "",
  cost: "",
  stock: "0",
  minStock: "5",
  categoryId: "none",
  brand: "",
  imageUrl: "",
  isActive: true,
};

const PRODUCTS_PER_PAGE = 10;

async function fetchCategories(): Promise<Category[]> {
  const token = getAuthToken();
  const response = await fetch("/api/categories", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error("Failed to load categories");
  }

  const payload: unknown = await response.json();
  if (Array.isArray(payload)) {
    return payload as Category[];
  }

  return [];
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListProducts({ search, page, limit: PRODUCTS_PER_PAGE });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const categoriesQuery = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: fetchCategories,
  });
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];

  const resetForm = () => setForm(emptyForm);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PRODUCTS_PER_PAGE));

  const handleProductImageUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const token = getAuthToken();
    setIsUploadingImage(true);

    try {
      const uploadFile = await compressImageForUpload(file);
      const formData = new FormData();
      formData.set("image", uploadFile);
      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const payload = await response.json().catch(() => null) as UploadImageResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Failed to upload product image");
      }
      if (!payload || !("url" in payload)) {
        throw new Error("Failed to upload product image");
      }
      setForm((current) => ({ ...current, imageUrl: payload.url }));
      toast({ title: "Product image uploaded" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to upload product image", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    if (data && page > totalPages) {
      setPage(totalPages);
    }
  }, [data, page, totalPages]);

  const buildPageNumbers = () => {
    const pages: Array<number | "ellipsis"> = [];

    if (totalPages <= 7) {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        pages.push(pageNumber);
      }
      return pages;
    }

    pages.push(1);

    if (page > 3) {
      pages.push("ellipsis");
    }

    for (let pageNumber = Math.max(2, page - 1); pageNumber <= Math.min(totalPages - 1, page + 1); pageNumber += 1) {
      pages.push(pageNumber);
    }

    if (page < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);
    return pages;
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast({ title: "Name and SKU are required", variant: "destructive" });
      return;
    }

    const price = Number(form.price);
    const cost = Number(form.cost);
    const stock = Number(form.stock);
    const minStock = Number(form.minStock);

    if (Number.isNaN(price) || price <= 0 || Number.isNaN(cost) || cost < 0) {
      toast({ title: "Enter valid price and cost", variant: "destructive" });
      return;
    }

    if (Number.isNaN(stock) || stock < 0 || Number.isNaN(minStock) || minStock < 0) {
      toast({ title: "Enter valid stock values", variant: "destructive" });
      return;
    }

    createProduct.mutate(
      {
        data: {
          name: form.name.trim(),
          sku: form.sku.trim(),
          description: form.description.trim() || undefined,
          price,
          cost,
          stock,
          minStock,
          categoryId: form.categoryId !== "none" ? Number(form.categoryId) : null,
          brand: form.brand.trim() || undefined,
          imageUrl: form.imageUrl.trim() || undefined,
          isActive: form.isActive,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Product added" });
          setFormOpen(false);
          resetForm();
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
        },
        onError: () => {
          toast({ title: "Failed to add product", variant: "destructive" });
        },
      }
    );
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description || "",
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      categoryId: product.categoryId?.toString() || "none",
      brand: product.brand || "",
      imageUrl: product.imageUrl || "",
      isActive: product.isActive,
    });
    setFormOpen(true);
  };

  const handleUpdate = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast({ title: "Name and SKU are required", variant: "destructive" });
      return;
    }

    const price = Number(form.price);
    const cost = Number(form.cost);
    const stock = Number(form.stock);
    const minStock = Number(form.minStock);

    if (Number.isNaN(price) || price <= 0 || Number.isNaN(cost) || cost < 0) {
      toast({ title: "Enter valid price and cost", variant: "destructive" });
      return;
    }

    if (Number.isNaN(stock) || stock < 0 || Number.isNaN(minStock) || minStock < 0) {
      toast({ title: "Enter valid stock values", variant: "destructive" });
      return;
    }

    updateProduct.mutate(
      {
        id: editingProduct.id,
        data: {
          name: form.name.trim(),
          sku: form.sku.trim(),
          description: form.description.trim() || undefined,
          price,
          cost,
          stock,
          minStock,
          categoryId: form.categoryId !== "none" ? Number(form.categoryId) : null,
          brand: form.brand.trim() || undefined,
          imageUrl: form.imageUrl.trim() || undefined,
          isActive: form.isActive,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Product updated" });
          setFormOpen(false);
          setEditingProduct(null);
          resetForm();
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
        },
        onError: () => {
          toast({ title: "Failed to update product", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (product: any) => {
    setProductToDelete({ ...product });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    console.log("confirmDelete called");
    console.log("productToDelete:", productToDelete);
    console.log("productToDelete?.id:", productToDelete?.id);

    if (!productToDelete) {
      console.error("No product to delete - productToDelete is null/undefined");
      toast({ title: "Error: No product selected for deletion", variant: "destructive" });
      return;
    }

    if (!productToDelete.id) {
      console.error("Product has no ID:", productToDelete);
      toast({ title: "Error: Product ID is missing", variant: "destructive" });
      return;
    }

    const productId = Number(productToDelete.id);
    if (isNaN(productId)) {
      console.error("Invalid product ID:", productToDelete.id);
      toast({ title: "Error: Invalid product ID", variant: "destructive" });
      return;
    }

    console.log("Deleting product:", productId, productToDelete.name);

    deleteProduct.mutate(
      { id: productId },
      {
        onSuccess: () => {
          toast({ title: "Product deleted" });
          setDeleteConfirmOpen(false);
          setProductToDelete(null);
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
        },
        onError: (error) => {
          console.error("Delete failed:", error);
          toast({ title: "Failed to delete product", variant: "destructive" });
        },
      }
    );
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleUploadComplete = () => {
    toast({ title: "Products imported successfully!" });
    setUploadOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());

      const token = getAuthToken();
      const response = await fetch(`/api/products/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error("Failed to export products");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Product export started" });
    } catch (error) {
      console.error(error);
      toast({ title: "Unable to export products", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="block md:flex md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your showroom inventory.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={handleExport} disabled={isExporting || isLoading || !data?.items?.length}>
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => { resetForm(); setFormOpen(true); }}>Add Product</Button>
          </div>
      </div>

      <div className="flex items-center space-x-2">
        <Input 
          placeholder="Search products..." 
          value={search} 
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }} 
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : !data?.items.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No products found.
                </TableCell>
              </TableRow>
            ) : data.items.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                <TableCell>{product.categoryName || 'Uncategorized'}</TableCell>
                <TableCell>${product.price}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {product.stock}
                    {product.stock <= product.minStock && (
                      <Badge variant="destructive" className="ml-2">Low Stock</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log("Edit button clicked for product:", product);
                        handleEdit(product);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log("Delete button clicked for product:", product);
                        handleDelete(product);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PRODUCTS_PER_PAGE + 1} to {Math.min(page * PRODUCTS_PER_PAGE, data.total)} of {data.total} products
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>

            {buildPageNumbers().map((pageNumber, index) =>
              pageNumber === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={pageNumber}
                  variant={pageNumber === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) {
          setEditingProduct(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Price *</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Cost *</Label>
              <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Stock *</Label>
              <Input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Min Stock</Label>
              <Input type="number" min="0" step="1" value={form.minStock} onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Product Image</Label>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="Product preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleProductImageUpload(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage}>
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingImage ? "Uploading..." : "Upload Image"}
                    </Button>
                    {form.imageUrl && (
                      <Button type="button" variant="ghost" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}>
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste an image URL"
                  />
                  <p className="text-xs text-muted-foreground">Images over 600 KB are compressed before upload.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Active Product</p>
                <p className="text-xs text-muted-foreground">Inactive products stay hidden from normal inventory usage.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFormOpen(false);
              setEditingProduct(null);
              resetForm();
            }}>Cancel</Button>
            <Button onClick={editingProduct ? handleUpdate : handleCreate} disabled={createProduct.isPending || updateProduct.isPending}>
              {createProduct.isPending || updateProduct.isPending ? (editingProduct ? "Updating..." : "Adding...") : (editingProduct ? "Update Product" : "Add Product")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkUploadModal 
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmOpen(false);
              setProductToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {deleteProduct.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
