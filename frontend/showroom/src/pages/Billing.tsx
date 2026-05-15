import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { compressImageForUpload } from "@/lib/image-compression";
import { FilePlus, Trash2, Plus, Minus, Receipt, DollarSign, Clock, AlertCircle, Search, Printer, X, Upload, Image as ImageIcon } from "lucide-react";

const BASE = "/api";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

interface LineItem {
  productId?: number;
  productName: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  availableStock?: number;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string | number;
  categoryName?: string | null;
  stock: number;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
  isActive: boolean;
}

interface AuthMeResponse {
  user: {
    id: number;
    name: string;
    email: string;
    invoiceLogoUrl?: string | null;
  };
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  staffId: number | null;
  staffName: string | null;
  logoUrl: string | null;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  itemCount: number;
}

interface InvoiceDetail extends Invoice {
  items: Array<{
    id: number;
    productName: string;
    sku: string | null;
    description: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

interface BillingStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
}

interface CreateInvoiceResponse {
  customerAutoCreated?: boolean;
  customerName?: string;
}

interface UploadLogoResponse {
  url: string;
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data as T;
}

const statusColors: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
};

const emptyItem = (): LineItem => ({ productName: "", sku: "", description: "", quantity: 1, unitPrice: 0 });
const invoiceLogoKey = (userId: number) => `invoiceLogoUrl:${userId}`;
const savedInvoiceLogo = (userId: number) => {
  const value = localStorage.getItem(invoiceLogoKey(userId)) || "";
  return value.startsWith("https://res.cloudinary.com/") ? value : "";
};

const clampQuantity = (value: number, max?: number) => {
  const normalized = Math.max(1, value);
  return max !== undefined ? Math.min(normalized, max) : normalized;
};

// ─── Print Invoice Component ────────────────────────────────────────────────
function PrintInvoice({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <div className="print-invoice p-10 font-sans text-sm text-gray-800 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {invoice.logoUrl ? (
            <img src={invoice.logoUrl} alt="Invoice logo" className="max-h-16 max-w-44 object-contain" />
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">VoltEdge.</h1>
              <p className="text-gray-500 text-xs mt-1">Electronics Showroom</p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</p>
          <p className="text-gray-500 text-xs mt-1">Date: {new Date(invoice.createdAt).toLocaleDateString()}</p>
          {invoice.dueDate && <p className="text-gray-500 text-xs">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold uppercase
            ${invoice.status === "paid" ? "bg-green-100 text-green-700" :
              invoice.status === "overdue" ? "bg-red-100 text-red-700" :
              invoice.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Bill To / Staff */}
      <div className="flex justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Bill To</p>
          <p className="font-semibold text-gray-900">{invoice.customerName}</p>
          {invoice.customerEmail && <p className="text-gray-600">{invoice.customerEmail}</p>}
          {invoice.customerPhone && <p className="text-gray-600">{invoice.customerPhone}</p>}
          {invoice.customerAddress && <p className="text-gray-600">{invoice.customerAddress}</p>}
        </div>
        {invoice.staffName && (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Issued By</p>
            <p className="font-semibold text-gray-900">{invoice.staffName}</p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 px-3">
                <p className="font-medium">{item.productName}</p>
                {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
              </td>
              <td className="py-2 px-3 text-gray-500">{item.sku || "—"}</td>
              <td className="py-2 px-3 text-center">{item.quantity}</td>
              <td className="py-2 px-3 text-right">${item.unitPrice.toFixed(2)}</td>
              <td className="py-2 px-3 text-right font-medium">${item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
            <span>${invoice.taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-1">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Notes</p>
          <p className="text-gray-600 text-sm">{invoice.notes}</p>
        </div>
      )}
      <p className="text-center text-gray-400 text-xs mt-10">Thank you for your business — VoltEdge Electronics Showroom</p>
    </div>
  );
}

// ─── Product Search Picker ───────────────────────────────────────────────────
function ProductPicker({ onAdd }: { onAdd: (item: LineItem) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ items: Product[] }>({
    queryKey: ["products-picker", query],
    queryFn: () => fetchJson<{ items: Product[] }>(`${BASE}/products?search=${encodeURIComponent(query)}&limit=10`),
    enabled: open,
  });
  const products = Array.isArray(data?.items) ? data.items : [];

  const pick = (p: Product) => {
    onAdd({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      description: "",
      quantity: 1,
      unitPrice: parseFloat(String(p.price)),
      availableStock: p.stock,
    });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Search className="h-3.5 w-3.5 mr-1.5" />
        Search Products
      </Button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-popover border rounded-md shadow-lg">
          <div className="p-2 border-b flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm bg-transparent outline-none"
              placeholder="Type to search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!products.length ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {query ? "No products found" : "Type to search…"}
              </p>
            ) : (
              products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku} · {p.categoryName ?? "Uncategorized"}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">${parseFloat(String(p.price)).toFixed(2)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Billing Page ───────────────────────────────────────────────────────
export default function Billing() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<InvoiceDetail | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statsQuery = useQuery<BillingStats>({
    queryKey: ["billing-stats"],
    queryFn: () => fetchJson<BillingStats>(`${BASE}/billing/stats`),
  });

  const invoicesQuery = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["billing-invoices", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return fetchJson<{ items: Invoice[]; total: number }>(`${BASE}/billing/invoices?${params}`);
    },
  });

  const staffQuery = useQuery<StaffMember[]>({
    queryKey: ["staff-list"],
    queryFn: () => fetchJson<StaffMember[]>(`${BASE}/staff`),
  });

  const meQuery = useQuery<AuthMeResponse>({
    queryKey: ["auth-me"],
    queryFn: () => fetchJson<AuthMeResponse>(`${BASE}/auth/me`),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetchJson<CreateInvoiceResponse>(`${BASE}/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      const msg = data.customerAutoCreated
        ? `Invoice created and customer "${data.customerName}" added automatically.`
        : "Invoice created successfully.";
      toast({ title: "Invoice created", description: msg });
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/revenue-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/category-breakdown"] });
    },
    onError: (e: Error) => toast({ title: e.message || "Failed to create invoice", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetchJson(`${BASE}/billing/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/revenue-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/category-breakdown"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${BASE}/billing/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Invoice deleted" });
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/revenue-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/top-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/category-breakdown"] });
    },
  });

  const resetForm = () => {
    setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setCustomerAddress("");
    setSelectedStaffId(""); setTaxRate("0"); setDueDate(""); setNotes("");
    setLineItems([emptyItem()]);
  };

  useEffect(() => {
    const user = meQuery.data?.user;
    if (!user) return;

    localStorage.removeItem("invoiceLogoUrl");
    const logoUrl = user.invoiceLogoUrl?.startsWith("https://res.cloudinary.com/")
      ? user.invoiceLogoUrl
      : savedInvoiceLogo(user.id);
    setInvoiceLogoUrl(logoUrl);
  }, [meQuery.data?.user]);

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const userId = meQuery.data?.user.id;
    if (!userId) {
      toast({ title: "Please wait for your user profile to load", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const uploadFile = await compressImageForUpload(file);
      const formData = new FormData();
      formData.set("logo", uploadFile);
      const data = await fetchJson<UploadLogoResponse>(`${BASE}/uploads/invoice-logo`, {
        method: "POST",
        body: formData,
      });
      setInvoiceLogoUrl(data.url);
      localStorage.setItem(invoiceLogoKey(userId), data.url);
      queryClient.setQueryData<AuthMeResponse>(["auth-me"], (current) =>
        current ? { ...current, user: { ...current.user, invoiceLogoUrl: data.url } } : current
      );
      toast({ title: "Invoice logo uploaded" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not upload logo", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    const userId = meQuery.data?.user.id;
    setInvoiceLogoUrl("");
    if (userId) localStorage.removeItem(invoiceLogoKey(userId));
    queryClient.setQueryData<AuthMeResponse>(["auth-me"], (current) =>
      current ? { ...current, user: { ...current.user, invoiceLogoUrl: null } } : current
    );
    try {
      await fetchJson(`${BASE}/uploads/invoice-logo`, { method: "DELETE" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not remove logo", variant: "destructive" });
    }
  };

  const updateItem = (i: number, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (field === "quantity") {
        return { ...item, quantity: clampQuantity(Number(value), item.availableStock) };
      }
      return { ...item, [field]: value };
    }));

  const addItem = () => setLineItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) =>
    setLineItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [emptyItem()];
    });

  const addFromProduct = useCallback((item: LineItem) => {
    setLineItems((prev) => {
      // Check if this product is already in the line items
      const existingIndex = prev.findIndex((existing) =>
        existing.productId === item.productId && existing.productId !== undefined
      );

      if (existingIndex !== -1) {
        // Product already exists, increase quantity
        return prev.map((existing, idx) =>
          idx === existingIndex
            ? { ...existing, quantity: existing.quantity + item.quantity }
            : existing
        );
      }

      // Product not found, check for blank item to replace
      const blank = prev.findIndex((i) => !i.productName.trim());
      if (blank !== -1) {
        return prev.map((existing, idx) => idx === blank ? item : existing);
      }

      // No blank item, add new item
      return [...prev, item];
    });
  }, []);

  const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const tax = subtotal * (parseFloat(taxRate) || 0) / 100;
  const total = subtotal + tax;

  const handleCreate = () => {
    if (!customerName.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" }); return;
    }
    if (lineItems.some((i) => !i.productName.trim() || i.unitPrice <= 0)) {
      toast({ title: "All items need a name and price > 0", variant: "destructive" }); return;
    }
    const overLimitItem = lineItems.find((item) =>
      item.availableStock !== undefined && item.quantity > item.availableStock
    );
    if (overLimitItem) {
      toast({
        title: `Only ${overLimitItem.availableStock} in stock for ${overLimitItem.productName}`,
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      customerName,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      customerAddress: customerAddress || undefined,
      staffId: selectedStaffId ? parseInt(selectedStaffId) : undefined,
      logoUrl: invoiceLogoUrl || undefined,
      taxRate,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      items: lineItems,
    });
  };

  // Print — fetch full invoice then open print dialog
  const handlePrint = async (id: number) => {
    const inv = await fetchJson<InvoiceDetail>(`${BASE}/billing/invoices/${id}`);
    setPrintInvoice(inv);
    setTimeout(() => window.print(), 300);
  };

  const stats = statsQuery.data;
  const activeStaff = (Array.isArray(staffQuery.data) ? staffQuery.data : []).filter((s) => s.isActive);
  const invoices = Array.isArray(invoicesQuery.data?.items) ? invoicesQuery.data.items : [];

  return (
    <>
      {/* Print-only invoice rendered off-screen, shown only during print */}
      {printInvoice && (
        <div className="hidden print:block">
          <PrintInvoice invoice={printInvoice} />
        </div>
      )}

      <div className="space-y-6 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
            <p className="text-muted-foreground">Create and manage customer invoices.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={logoInputRef}
              id="invoice-logo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleLogoUpload(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <div className="flex h-10 w-14 items-center justify-center rounded-md border bg-muted/40">
              {invoiceLogoUrl ? (
                <img src={invoiceLogoUrl} alt="Invoice logo preview" className="max-h-8 max-w-12 object-contain" />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploadingLogo ? "Uploading..." : "Upload Logo"}
            </Button>
            {invoiceLogoUrl && (
              <Button type="button" variant="ghost" onClick={removeLogo}>
                Remove
              </Button>
            )}
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
              <FilePlus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? <Skeleton className="h-7 w-24" /> : `$${(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <p className="text-xs text-muted-foreground">From paid invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsQuery.isLoading ? <Skeleton className="h-7 w-10" /> : stats?.paidInvoices}
              </div>
              <p className="text-xs text-muted-foreground">of {stats?.totalInvoices ?? 0} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Payment</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? <Skeleton className="h-7 w-10" /> : stats?.pendingInvoices}
              </div>
              <p className="text-xs text-muted-foreground">Sent invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {statsQuery.isLoading ? <Skeleton className="h-7 w-10" /> : stats?.overdueInvoices}
              </div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoice Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : !invoices.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No invoices yet. Click "New Invoice" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.customerName}</div>
                      {inv.customerEmail && <div className="text-xs text-muted-foreground">{inv.customerEmail}</div>}
                      {inv.customerPhone && <div className="text-xs text-muted-foreground">{inv.customerPhone}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.staffName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.itemCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[inv.status]}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handlePrint(inv.id)} title="Print / Download PDF">
                          <Printer className="h-4 w-4" />
                        </Button>
                        {inv.status === "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: inv.id, status: "sent" })}>
                            Send
                          </Button>
                        )}
                        {inv.status === "sent" && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: inv.id, status: "paid" })}>
                            Paid
                          </Button>
                        )}
                        {inv.status === "sent" && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: inv.id, status: "overdue" })}>
                            Overdue
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(inv.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Create Invoice Dialog ── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Customer + Staff */}
              <div>
                <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">Customer & Staff</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Customer Name *</Label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. John Smith" />
                    <p className="text-xs text-muted-foreground">New customers are added automatically.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="john@email.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1 234 567 8900" />
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Street, City, State" />
                  </div>
                  <div className="space-y-1">
                    <Label>Issued By (Staff)</Label>
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeStaff.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} <span className="text-muted-foreground text-xs ml-1">({s.role})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Line Items</h3>
                  <div className="flex gap-2">
                    <ProductPicker onAdd={addFromProduct} />
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Custom Item
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Column headers — desktop only */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                    <span className="col-span-4">Item</span>
                    <span className="col-span-3">Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-2 text-right">Price</span>
                    <span className="col-span-1" />
                  </div>

                  {lineItems.map((item, i) => (
                    <div key={i} className="bg-muted/20 rounded-md p-2 space-y-2">
                      {/* Row 1: Name + Description */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                        <div className="sm:col-span-4">
                          <Input
                            placeholder="Product name"
                            value={item.productName}
                            onChange={(e) => updateItem(i, "productName", e.target.value)}
                            className="h-8 text-sm"
                          />
                          {item.sku && (
                            <p className="text-xs text-muted-foreground mt-0.5 pl-1">
                              {item.sku}
                              {item.availableStock !== undefined ? ` · ${item.availableStock} in stock` : ""}
                            </p>
                          )}
                        </div>
                        <div className="sm:col-span-3">
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateItem(i, "description", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      {/* Row 2: Qty + Price + Delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                            onClick={() => updateItem(i, "quantity", Math.max(1, item.quantity - 1))}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number" min={1}
                            value={item.quantity}
                            max={item.availableStock}
                            onChange={(e) => updateItem(i, "quantity", clampQuantity(parseInt(e.target.value) || 1, item.availableStock))}
                            className="h-8 text-center px-1 text-sm w-14"
                          />
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                            onClick={() => updateItem(i, "quantity", item.quantity + 1)}
                            disabled={item.availableStock !== undefined && item.quantity >= item.availableStock}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          type="number" min={0} step={0.01} placeholder="0.00"
                          value={item.unitPrice || ""}
                          onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-8 text-right text-sm flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          onClick={() => removeItem(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings + Summary */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="space-y-1 w-32">
                      <Label>Tax Rate (%)</Label>
                      <Input type="number" min={0} max={100} step={0.5}
                        value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label>Due Date</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Payment terms, thank-you note…" rows={3} />
                  </div>
                </div>

                {/* Live Summary */}
                <div className="bg-muted/40 rounded-lg p-4 space-y-2 self-start">
                  <h4 className="font-semibold text-sm">Invoice Summary</h4>
                  <div className="space-y-1 text-sm">
                    {lineItems.filter((i) => i.productName).map((item, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span className="truncate max-w-[140px]">{item.productName} ×{item.quantity}</span>
                        <span>${(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1 mt-1 flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({taxRate || 0}%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Hidden iframe for print reference (unused but keeps ref valid) */}
      <iframe ref={printFrameRef} className="hidden" title="print-frame" />
    </>
  );
}
