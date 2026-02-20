"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { CUSTOMER_TYPE_LABELS } from "@/lib/constants";

type Customer = NonNullable<ReturnType<typeof trpc.customer.list.useQuery>["data"]>[number];

export default function CustomersAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [orgnr, setOrgnr] = useState("");
  const [customerType, setCustomerType] = useState<"LOPANDE" | "FASTPRIS" | "BLANDAD">("LOPANDE");
  const [clientManagerId, setClientManagerId] = useState("");
  const [segmentId, setSegmentId] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    orgnr: string;
    customerType: "LOPANDE" | "FASTPRIS" | "BLANDAD";
    clientManagerId: string;
    segmentId: string;
    active: boolean;
  } | null>(null);

  const { data: customers, refetch } = trpc.customer.list.useQuery();
  const { data: employees } = trpc.employee.list.useQuery();
  const { data: segments } = trpc.article.groups.useQuery();

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      refetch();
      setDialogOpen(false);
      setName("");
      setOrgnr("");
      toast.success("Kund skapad");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => { refetch(); setEditDialogOpen(false); toast.success("Kund uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Kund borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  function openEdit(cust: Customer) {
    setEditData({
      id: cust.id,
      name: cust.name,
      orgnr: cust.orgnr ?? "",
      customerType: cust.customerType as "LOPANDE" | "FASTPRIS" | "BLANDAD",
      clientManagerId: cust.clientManagerId ?? "",
      segmentId: cust.segmentId ?? "",
      active: cust.active,
    });
    setEditDialogOpen(true);
  }

  const columns: ColumnDef<Customer, unknown>[] = [
    { accessorKey: "customerNumber", header: "KundID" },
    { accessorKey: "name", header: "Namn" },
    { accessorKey: "orgnr", header: "Org.nr" },
    {
      accessorKey: "customerType",
      header: "Typ",
      cell: ({ row }) => (
        <Badge variant="outline">
          {CUSTOMER_TYPE_LABELS[row.original.customerType as keyof typeof CUSTOMER_TYPE_LABELS]}
        </Badge>
      ),
    },
    {
      accessorKey: "manager",
      header: "Klientansvarig",
      cell: ({ row }) => row.original.manager?.name ?? "-",
    },
    {
      accessorKey: "segment",
      header: "Segment",
      cell: ({ row }) => row.original.segment?.name ?? "-",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            Redigera
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(row.original.id)}>
            Ta bort
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Kunder" description="Hantera kundregister">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny kund</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ny kund</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Organisationsnummer</Label>
                <Input value={orgnr} onChange={(e) => setOrgnr(e.target.value)} placeholder="XXXXXX-XXXX" />
              </div>
              <div className="space-y-2">
                <Label>Kundtyp</Label>
                <Select value={customerType} onValueChange={(v) => setCustomerType(v as typeof customerType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOPANDE">Löpande</SelectItem>
                    <SelectItem value="FASTPRIS">Fastpris</SelectItem>
                    <SelectItem value="BLANDAD">Blandad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Klientansvarig</Label>
                <Select value={clientManagerId} onValueChange={setClientManagerId}>
                  <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  name,
                  orgnr: orgnr || undefined,
                  customerType,
                  clientManagerId: clientManagerId || null,
                  segmentId: segmentId || null,
                })}
                disabled={!name || createMutation.isPending}
              >
                Skapa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redigera kund</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Organisationsnummer</Label>
                <Input value={editData.orgnr} onChange={(e) => setEditData({ ...editData, orgnr: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kundtyp</Label>
                <Select value={editData.customerType} onValueChange={(v) => setEditData({ ...editData, customerType: v as typeof editData.customerType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOPANDE">Löpande</SelectItem>
                    <SelectItem value="FASTPRIS">Fastpris</SelectItem>
                    <SelectItem value="BLANDAD">Blandad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Klientansvarig</Label>
                <Select value={editData.clientManagerId} onValueChange={(v) => setEditData({ ...editData, clientManagerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Aktiv</Label>
                <input
                  type="checkbox"
                  checked={editData.active}
                  onChange={(e) => setEditData({ ...editData, active: e.target.checked })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => updateMutation.mutate({
                  id: editData.id,
                  name: editData.name,
                  orgnr: editData.orgnr || null,
                  customerType: editData.customerType,
                  clientManagerId: editData.clientManagerId || null,
                  active: editData.active,
                })}
                disabled={!editData.name || updateMutation.isPending}
              >
                Spara
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DataTable data={customers ?? []} columns={columns} filterPlaceholder="Sök kund..." />
    </div>
  );
}
