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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

type Employee = NonNullable<ReturnType<typeof trpc.employee.list.useQuery>["data"]>[number];

export default function EmployeesAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [costPerHour, setCostPerHour] = useState("450");
  const [defaultPricePerHour, setDefaultPricePerHour] = useState("1200");
  const [weeklyHours, setWeeklyHours] = useState("40");
  const [targetUtilization, setTargetUtilization] = useState("0.75");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    costPerHour: string;
    defaultPricePerHour: string;
    weeklyHours: string;
    targetUtilization: string;
    active: boolean;
  } | null>(null);

  const { data: employees, refetch } = trpc.employee.list.useQuery();

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => { refetch(); setDialogOpen(false); toast.success("Medarbetare skapad"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => { refetch(); setEditDialogOpen(false); toast.success("Medarbetare uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Medarbetare borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  function openEdit(emp: Employee) {
    setEditData({
      id: emp.id,
      name: emp.name,
      costPerHour: String(Number(emp.costPerHour)),
      defaultPricePerHour: String(Number(emp.defaultPricePerHour)),
      weeklyHours: String(Number(emp.weeklyHours)),
      targetUtilization: String(Number(emp.targetUtilization)),
      active: emp.active,
    });
    setEditDialogOpen(true);
  }

  const columns: ColumnDef<Employee, unknown>[] = [
    { accessorKey: "name", header: "Namn" },
    {
      accessorKey: "costPerHour",
      header: "Kostnad/h",
      cell: ({ row }) => `${Number(row.original.costPerHour)} kr`,
    },
    {
      accessorKey: "defaultPricePerHour",
      header: "Pris/h",
      cell: ({ row }) => `${Number(row.original.defaultPricePerHour)} kr`,
    },
    {
      accessorKey: "weeklyHours",
      header: "Veckoarbetstid",
      cell: ({ row }) => `${Number(row.original.weeklyHours)}h`,
    },
    {
      accessorKey: "targetUtilization",
      header: "Målbeläggning",
      cell: ({ row }) => `${(Number(row.original.targetUtilization) * 100).toFixed(0)}%`,
    },
    {
      accessorKey: "userMapping",
      header: "Kopplad användare",
      cell: ({ row }) => row.original.userMapping?.user?.email ?? "-",
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? "Aktiv" : "Inaktiv"}
        </Badge>
      ),
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
      <PageHeader title="Medarbetare" description="Hantera medarbetare och kostnader">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny medarbetare</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny medarbetare</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kostnad/h (kr)</Label>
                  <Input type="number" value={costPerHour} onChange={(e) => setCostPerHour(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pris/h (kr)</Label>
                  <Input type="number" value={defaultPricePerHour} onChange={(e) => setDefaultPricePerHour(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veckoarbetstid (h)</Label>
                  <Input type="number" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Målbeläggning</Label>
                  <Input type="number" step="0.05" value={targetUtilization} onChange={(e) => setTargetUtilization(e.target.value)} />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  name,
                  costPerHour: parseFloat(costPerHour),
                  defaultPricePerHour: parseFloat(defaultPricePerHour),
                  weeklyHours: parseFloat(weeklyHours),
                  targetUtilization: parseFloat(targetUtilization),
                })}
                disabled={!name}
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
          <DialogHeader><DialogTitle>Redigera medarbetare</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kostnad/h (kr)</Label>
                  <Input type="number" value={editData.costPerHour} onChange={(e) => setEditData({ ...editData, costPerHour: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pris/h (kr)</Label>
                  <Input type="number" value={editData.defaultPricePerHour} onChange={(e) => setEditData({ ...editData, defaultPricePerHour: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veckoarbetstid (h)</Label>
                  <Input type="number" value={editData.weeklyHours} onChange={(e) => setEditData({ ...editData, weeklyHours: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Målbeläggning</Label>
                  <Input type="number" step="0.05" value={editData.targetUtilization} onChange={(e) => setEditData({ ...editData, targetUtilization: e.target.value })} />
                </div>
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
                  costPerHour: parseFloat(editData.costPerHour),
                  defaultPricePerHour: parseFloat(editData.defaultPricePerHour),
                  weeklyHours: parseFloat(editData.weeklyHours),
                  targetUtilization: parseFloat(editData.targetUtilization),
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

      <DataTable data={employees ?? []} columns={columns} filterPlaceholder="Sök medarbetare..." />
    </div>
  );
}
