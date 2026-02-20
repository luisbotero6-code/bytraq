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
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/generated/prisma";

type User = NonNullable<ReturnType<typeof trpc.user.list.useQuery>["data"]>[number];

export default function UsersAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("MEDARBETARE");
  const [employeeId, setEmployeeId] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    password: string;
  } | null>(null);

  const { data: users, refetch } = trpc.user.list.useQuery();
  const { data: employees } = trpc.employee.list.useQuery();

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => { refetch(); setDialogOpen(false); toast.success("Användare skapad"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => { refetch(); setEditDialogOpen(false); toast.success("Användare uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Användare borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  function handleDelete(user: User) {
    if (!confirm(`Är du säker på att du vill ta bort "${user.name}"?`)) return;
    deleteMutation.mutate({ id: user.id });
  }

  function openEdit(user: User) {
    setEditData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      active: user.active,
      password: "",
    });
    setEditDialogOpen(true);
  }

  const columns: ColumnDef<User, unknown>[] = [
    { accessorKey: "name", header: "Namn" },
    { accessorKey: "email", header: "E-post" },
    {
      accessorKey: "role",
      header: "Roll",
      cell: ({ row }) => (
        <Badge variant="outline">{ROLE_LABELS[row.original.role as Role]}</Badge>
      ),
    },
    {
      accessorKey: "employeeMapping",
      header: "Medarbetare",
      cell: ({ row }) => row.original.employeeMapping?.employee?.name ?? "-",
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
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(row.original)}>
            Ta bort
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Användare" description="Hantera användarkonton och roller">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny användare</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny användare</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lösenord</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Roll</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Koppla till medarbetare</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
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
                  email, name, password, role,
                  employeeId: employeeId || undefined,
                })}
                disabled={!name || !email || !password}
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
          <DialogHeader><DialogTitle>Redigera användare</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nytt lösenord (lämna tomt för att behålla)</Label>
                <Input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>Roll</Label>
                <Select value={editData.role} onValueChange={(v) => setEditData({ ...editData, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
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
                  email: editData.email,
                  role: editData.role,
                  active: editData.active,
                  ...(editData.password ? { password: editData.password } : {}),
                })}
                disabled={!editData.name || !editData.email || updateMutation.isPending}
              >
                Spara
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DataTable data={users ?? []} columns={columns} filterPlaceholder="Sök användare..." />
    </div>
  );
}
