import { useState } from "react";
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
import { FilePlus, Trash2, Plus, Minus, Receipt, DollarSign, Clock, AlertCircle } from "lucide-react";

const BASE = "/api";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

interface LineItem {
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
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

interface BillingStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
}

const statusColors: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
};

const emptyItem = (): LineItem => ({ productName: "", description: "", quantity: 1, unitPrice: 0 });

export default function Billing() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statsQuery = useQuery<BillingStats>({
    queryKey: ["billing-stats"],
    queryFn: () => fetch(`${BASE}/billing/stats`).then((r) => r.json()),
  });

  const invoicesQuery = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["billing-invoices", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return fetch(`${BASE}/billing/invoices?${params}`).then((r) => r.json());
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${BASE}/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Invoice created" });
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
    },
    onError: (e: Error) => toast({ title: e.message || "Failed to create invoice", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${BASE}/billing/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/billing/invoices/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Invoice deleted" });
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
    },
  });

  const resetForm = () => {
    setCustomerName(""); setCustomerEmail(""); setCustomerAddress("");
    setTaxRate("0"); setDueDate(""); setNotes("");
    setLineItems([emptyItem()]);
  };

  const updateItem = (i: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const addItem = () => setLineItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const tax = subtotal * (parseFloat(taxRate) || 0) / 100;
  const total = subtotal + tax;

  const handleCreate = () => {
    if (!customerName.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" }); return;
    }
    if (lineItems.some((i) => !i.productName.trim() || i.unitPrice <= 0)) {
      toast({ title: "All items need a name and price", variant: "destructive" }); return;
    }
    createMutation.mutate({
      customerName,
      customerEmail: customerEmail || undefined,
      customerAddress: customerAddress || undefined,
      taxRate,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      items: lineItems,
    });
  };

  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Create and manage customer invoices.</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <FilePlus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
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
              {statsQuery.isLoading ? <Skeleton className="h-7 w-24" /> : `$${stats?.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
        <div className="relative">
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
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
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoicesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : !invoicesQuery.data?.items.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No invoices yet. Click "New Invoice" to create one.
                </TableCell>
              </TableRow>
            ) : (
              invoicesQuery.data.items.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewInvoice(inv)}>
                  <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.customerName}</div>
                    {inv.customerEmail && <div className="text-xs text-muted-foreground">{inv.customerEmail}</div>}
                  </TableCell>
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {inv.status === "draft" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: inv.id, status: "sent" })}>
                          Send
                        </Button>
                      )}
                      {inv.status === "sent" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: inv.id, status: "paid" })}>
                          Mark Paid
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

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Customer Information</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Customer Name *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. John Smith" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="john@email.com" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Street, City, State" />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Line Items</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <span className="col-span-4">Item Name</span>
                  <span className="col-span-3">Description</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Unit Price</span>
                  <span className="col-span-1" />
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        placeholder="Product name"
                        value={item.productName}
                        onChange={(e) => updateItem(i, "productName", e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                        onClick={() => updateItem(i, "quantity", Math.max(1, item.quantity - 1))}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center px-1"
                      />
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                        onClick={() => updateItem(i, "quantity", item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={item.unitPrice || ""}
                        onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-9 w-9"
                        onClick={() => removeItem(i)} disabled={lineItems.length === 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals + Settings */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number" min={0} max={100} step={0.5}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0"
                    className="max-w-[120px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="max-w-[180px]" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you message..." rows={3} />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2 self-start">
                <h4 className="font-semibold text-sm">Invoice Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({taxRate || 0}%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
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
              {createMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{viewInvoice.customerName}</p>
                  {viewInvoice.customerEmail && <p className="text-sm text-muted-foreground">{viewInvoice.customerEmail}</p>}
                </div>
                <Badge variant={statusColors[viewInvoice.status]}>{viewInvoice.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Created:</span> {new Date(viewInvoice.createdAt).toLocaleDateString()}</div>
                <div><span className="text-muted-foreground">Due:</span> {viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString() : "—"}</div>
              </div>
              <div className="border rounded-md p-3 space-y-1 bg-muted/30">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${viewInvoice.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({viewInvoice.taxRate}%)</span><span>${viewInvoice.taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-2 mt-1"><span>Total</span><span>${viewInvoice.total.toFixed(2)}</span></div>
              </div>
              {viewInvoice.notes && <p className="text-sm text-muted-foreground border-t pt-3">{viewInvoice.notes}</p>}
              <div className="flex gap-2 justify-end">
                {viewInvoice.status === "draft" && (
                  <Button size="sm" onClick={() => { statusMutation.mutate({ id: viewInvoice.id, status: "sent" }); setViewInvoice(null); }}>
                    Mark as Sent
                  </Button>
                )}
                {viewInvoice.status === "sent" && (
                  <Button size="sm" onClick={() => { statusMutation.mutate({ id: viewInvoice.id, status: "paid" }); setViewInvoice(null); }}>
                    Mark as Paid
                  </Button>
                )}
                {viewInvoice.status === "sent" && (
                  <Button size="sm" variant="outline" onClick={() => { statusMutation.mutate({ id: viewInvoice.id, status: "overdue" }); setViewInvoice(null); }}>
                    Mark Overdue
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
