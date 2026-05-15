import { useState } from "react";
import {
  useListStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  getListStaffQueryKey,
} from "api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2 } from "lucide-react";

const ROLES = ["manager", "sales", "technician", "support"] as const;
type Role = typeof ROLES[number];

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "manager": return "default";
    case "sales": return "secondary";
    case "technician": return "outline";
    default: return "outline";
  }
};

type StaffFormData = {
  name: string;
  email: string;
  role: Role;
  phone: string;
};

const emptyForm: StaffFormData = { name: "", email: "", role: "sales", phone: "" };

export default function Staff() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: number } & StaffFormData | null>(null);
  const [form, setForm] = useState<StaffFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: staff, isLoading } = useListStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (s: { id: number; name: string; email: string; role: string; phone?: string | null; isActive: boolean }) => {
    setEditing({ id: s.id, name: s.name, email: s.email, role: s.role as Role, phone: s.phone ?? "" });
    setForm({ name: s.name, email: s.email, role: s.role as Role, phone: s.phone ?? "" });
    setFormOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateStaff.mutate(
        { id: editing.id, data: form },
        {
          onSuccess: () => {
            toast({ title: "Staff member updated" });
            setFormOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Failed to update staff member", variant: "destructive" }),
        }
      );
    } else {
      createStaff.mutate(
        { data: form },
        {
          onSuccess: () => {
            toast({ title: "Staff member added" });
            setFormOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Failed to create staff member", variant: "destructive" }),
        }
      );
    }
  };

  const toggleActive = (id: number, current: boolean) => {
    updateStaff.mutate(
      { id, data: { isActive: !current } },
      {
        onSuccess: () => invalidate(),
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const confirmDelete = (id: number) => setDeleteId(id);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteStaff.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Staff member removed" });
          setDeleteId(null);
          invalidate();
        },
        onError: () => toast({ title: "Failed to delete staff member", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Manage your showroom team.</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-staff">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : !staff || staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((member) => (
                <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(member.role) as "default" | "secondary" | "outline" | "destructive"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={member.isActive}
                      onCheckedChange={() => toggleActive(member.id, member.isActive)}
                      data-testid={`switch-staff-active-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(member)}
                        data-testid={`button-edit-staff-${member.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(member.id)}
                        data-testid={`button-delete-staff-${member.id}`}
                      >
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

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="sname">Name *</Label>
              <Input
                id="sname"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="input-staff-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="semail">Email *</Label>
              <Input
                id="semail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                data-testid="input-staff-email"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger data-testid="select-staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sphone">Phone</Label>
              <Input
                id="sphone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                data-testid="input-staff-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createStaff.isPending || updateStaff.isPending}
              data-testid="button-submit-staff"
            >
              {editing ? "Save Changes" : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Staff Member</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to remove this staff member?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteStaff.isPending}
              data-testid="button-confirm-delete-staff"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
