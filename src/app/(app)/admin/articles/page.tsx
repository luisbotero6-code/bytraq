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
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import { ARTICLE_GROUP_TYPE_LABELS } from "@/lib/constants";

type Article = NonNullable<ReturnType<typeof trpc.article.list.useQuery>["data"]>[number];

export default function ArticlesAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"ORDINARIE" | "TILLAGG" | "INTERNTID" | "OVRIGT">("ORDINARIE");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    code: string;
    name: string;
    articleGroupId: string;
    includedInFixedPrice: boolean;
    active: boolean;
  } | null>(null);

  const { data: articles, refetch: refetchArticles } = trpc.article.list.useQuery();
  const { data: groups, refetch: refetchGroups } = trpc.article.groups.useQuery();

  const createMutation = trpc.article.create.useMutation({
    onSuccess: () => { refetchArticles(); setDialogOpen(false); toast.success("Artikel skapad"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.article.update.useMutation({
    onSuccess: () => { refetchArticles(); setEditDialogOpen(false); toast.success("Artikel uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  const toggleFixedPriceMutation = trpc.article.update.useMutation({
    onSuccess: () => { refetchArticles(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.article.delete.useMutation({
    onSuccess: () => { refetchArticles(); toast.success("Artikel borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  const createGroupMutation = trpc.article.createGroup.useMutation({
    onSuccess: () => { refetchGroups(); setGroupDialogOpen(false); toast.success("Artikelgrupp skapad"); },
    onError: (err) => toast.error(err.message),
  });

  function openEdit(art: Article) {
    setEditData({
      id: art.id,
      code: art.code,
      name: art.name,
      articleGroupId: art.articleGroupId,
      includedInFixedPrice: art.includedInFixedPrice,
      active: art.active,
    });
    setEditDialogOpen(true);
  }

  const columns: ColumnDef<Article, unknown>[] = [
    { accessorKey: "code", header: "Kod" },
    { accessorKey: "name", header: "Namn" },
    {
      accessorKey: "articleGroup.name",
      header: "Grupp",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.articleGroup.name}</Badge>
      ),
    },
    {
      accessorKey: "includedInFixedPrice",
      header: "Fastpris",
      cell: ({ row }) => (
        <Checkbox
          checked={row.original.includedInFixedPrice}
          onCheckedChange={(checked) => {
            toggleFixedPriceMutation.mutate({
              id: row.original.id,
              includedInFixedPrice: !!checked,
            });
          }}
        />
      ),
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
      <PageHeader title="Artiklar" description="Artiklar och artikelgrupper">
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">+ Ny grupp</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny artikelgrupp</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select value={newGroupType} onValueChange={(v) => setNewGroupType(v as typeof newGroupType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ARTICLE_GROUP_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createGroupMutation.mutate({ name: newGroupName, type: newGroupType })} disabled={!newGroupName}>
                Skapa grupp
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny artikel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny artikel</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kod</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Artikelgrupp</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Välj grupp" /></SelectTrigger>
                  <SelectContent>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate({ code, name, articleGroupId: groupId })} disabled={!code || !name || !groupId}>
                Skapa artikel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redigera artikel</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kod</Label>
                <Input value={editData.code} onChange={(e) => setEditData({ ...editData, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Artikelgrupp</Label>
                <Select value={editData.articleGroupId} onValueChange={(v) => setEditData({ ...editData, articleGroupId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Ingår i fastpris</Label>
                <Checkbox
                  checked={editData.includedInFixedPrice}
                  onCheckedChange={(checked) => setEditData({ ...editData, includedInFixedPrice: !!checked })}
                />
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
                  code: editData.code,
                  name: editData.name,
                  articleGroupId: editData.articleGroupId,
                  includedInFixedPrice: editData.includedInFixedPrice,
                  active: editData.active,
                })}
                disabled={!editData.code || !editData.name || updateMutation.isPending}
              >
                Spara
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DataTable data={articles ?? []} columns={columns} filterPlaceholder="Sök artikel..." />
    </div>
  );
}
