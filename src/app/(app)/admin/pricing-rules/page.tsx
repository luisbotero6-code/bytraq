"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type PricingRule = NonNullable<ReturnType<typeof trpc.pricing.list.useQuery>["data"]>[number];

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: "Global",
  ARTICLE_GROUP: "Artikelgrupp",
  ARTICLE: "Artikel",
  CUSTOMER: "Kund",
  CUSTOMER_ARTICLE: "Kund+Artikel",
};

export default function PricingRulesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    scope: "GLOBAL" as "GLOBAL" | "ARTICLE_GROUP" | "ARTICLE" | "CUSTOMER" | "CUSTOMER_ARTICLE",
    priority: 0,
    pricePerHour: "",
    discount: "",
    markup: "",
    fixedPriceComponent: "",
    minimumCharge: "",
    validFrom: "",
    validTo: "",
    articleGroupId: "",
    articleId: "",
    customerId: "",
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    priority: number;
    pricePerHour: string;
    discount: string;
    markup: string;
    fixedPriceComponent: string;
    minimumCharge: string;
    validFrom: string;
    validTo: string;
    active: boolean;
  } | null>(null);

  const [previewCustomerId, setPreviewCustomerId] = useState("");
  const [previewArticleId, setPreviewArticleId] = useState("");

  const { data: rules, refetch } = trpc.pricing.list.useQuery();
  const { data: customers } = trpc.customer.list.useQuery();
  const { data: articles } = trpc.article.list.useQuery();
  const { data: groups } = trpc.article.groups.useQuery();

  const { data: preview } = trpc.pricing.preview.useQuery(
    { customerId: previewCustomerId, articleId: previewArticleId },
    { enabled: !!previewCustomerId && !!previewArticleId }
  );

  const createMutation = trpc.pricing.create.useMutation({
    onSuccess: () => { refetch(); setDialogOpen(false); toast.success("Prisregel skapad"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.pricing.update.useMutation({
    onSuccess: () => { refetch(); setEditDialogOpen(false); toast.success("Prisregel uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  function openEdit(rule: PricingRule) {
    setEditData({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      pricePerHour: rule.pricePerHour ? String(Number(rule.pricePerHour)) : "",
      discount: rule.discount ? String(Number(rule.discount)) : "",
      markup: rule.markup ? String(Number(rule.markup)) : "",
      fixedPriceComponent: rule.fixedPriceComponent ? String(Number(rule.fixedPriceComponent)) : "",
      minimumCharge: rule.minimumCharge ? String(Number(rule.minimumCharge)) : "",
      validFrom: rule.validFrom ? new Date(rule.validFrom).toISOString().slice(0, 10) : "",
      validTo: rule.validTo ? new Date(rule.validTo).toISOString().slice(0, 10) : "",
      active: rule.active,
    });
    setEditDialogOpen(true);
  }

  const columns: ColumnDef<PricingRule, unknown>[] = [
    { accessorKey: "name", header: "Namn" },
    {
      accessorKey: "scope",
      header: "Scope",
      cell: ({ row }) => <Badge variant="outline">{SCOPE_LABELS[row.original.scope] ?? row.original.scope}</Badge>,
    },
    { accessorKey: "priority", header: "Prioritet" },
    {
      accessorKey: "pricePerHour",
      header: "Pris/h",
      cell: ({ row }) => row.original.pricePerHour ? `${Number(row.original.pricePerHour)} kr` : "-",
    },
    {
      accessorKey: "discount",
      header: "Rabatt",
      cell: ({ row }) => row.original.discount ? `${(Number(row.original.discount) * 100).toFixed(0)}%` : "-",
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
        <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
          Redigera
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Prisregler" description="Hantera prissättningsregler">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny prisregel</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Ny prisregel</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v as typeof formData.scope })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioritet</Label>
                  <Input type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              {(formData.scope === "ARTICLE_GROUP") && (
                <div className="space-y-2">
                  <Label>Artikelgrupp</Label>
                  <Select value={formData.articleGroupId} onValueChange={(v) => setFormData({ ...formData, articleGroupId: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                    <SelectContent>
                      {groups?.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formData.scope === "ARTICLE" || formData.scope === "CUSTOMER_ARTICLE") && (
                <div className="space-y-2">
                  <Label>Artikel</Label>
                  <Select value={formData.articleId} onValueChange={(v) => setFormData({ ...formData, articleId: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                    <SelectContent>
                      {articles?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formData.scope === "CUSTOMER" || formData.scope === "CUSTOMER_ARTICLE") && (
                <div className="space-y-2">
                  <Label>Kund</Label>
                  <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pris/h (kr)</Label>
                  <Input type="number" value={formData.pricePerHour} onChange={(e) => setFormData({ ...formData, pricePerHour: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Rabatt (0-1)</Label>
                  <Input type="number" step="0.01" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giltig från</Label>
                  <Input type="date" value={formData.validFrom} onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Giltig till</Label>
                  <Input type="date" value={formData.validTo} onChange={(e) => setFormData({ ...formData, validTo: e.target.value })} />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  name: formData.name,
                  scope: formData.scope,
                  priority: formData.priority,
                  pricePerHour: formData.pricePerHour ? parseFloat(formData.pricePerHour) : null,
                  discount: formData.discount ? parseFloat(formData.discount) : null,
                  markup: formData.markup ? parseFloat(formData.markup) : null,
                  fixedPriceComponent: formData.fixedPriceComponent ? parseFloat(formData.fixedPriceComponent) : null,
                  minimumCharge: formData.minimumCharge ? parseFloat(formData.minimumCharge) : null,
                  validFrom: formData.validFrom || null,
                  validTo: formData.validTo || null,
                  articleGroupId: formData.articleGroupId || null,
                  articleId: formData.articleId || null,
                  customerId: formData.customerId || null,
                })}
                disabled={!formData.name}
              >
                Skapa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Redigera prisregel</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Input type="number" value={editData.priority} onChange={(e) => setEditData({ ...editData, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pris/h (kr)</Label>
                  <Input type="number" value={editData.pricePerHour} onChange={(e) => setEditData({ ...editData, pricePerHour: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Rabatt (0-1)</Label>
                  <Input type="number" step="0.01" value={editData.discount} onChange={(e) => setEditData({ ...editData, discount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Markup (0-1)</Label>
                  <Input type="number" step="0.01" value={editData.markup} onChange={(e) => setEditData({ ...editData, markup: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fast priskomponent (kr)</Label>
                  <Input type="number" value={editData.fixedPriceComponent} onChange={(e) => setEditData({ ...editData, fixedPriceComponent: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minimidebitering (kr)</Label>
                <Input type="number" value={editData.minimumCharge} onChange={(e) => setEditData({ ...editData, minimumCharge: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giltig från</Label>
                  <Input type="date" value={editData.validFrom} onChange={(e) => setEditData({ ...editData, validFrom: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Giltig till</Label>
                  <Input type="date" value={editData.validTo} onChange={(e) => setEditData({ ...editData, validTo: e.target.value })} />
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
                  priority: editData.priority,
                  pricePerHour: editData.pricePerHour ? parseFloat(editData.pricePerHour) : null,
                  discount: editData.discount ? parseFloat(editData.discount) : null,
                  markup: editData.markup ? parseFloat(editData.markup) : null,
                  fixedPriceComponent: editData.fixedPriceComponent ? parseFloat(editData.fixedPriceComponent) : null,
                  minimumCharge: editData.minimumCharge ? parseFloat(editData.minimumCharge) : null,
                  validFrom: editData.validFrom || null,
                  validTo: editData.validTo || null,
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

      {/* Price preview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Prisförhandsvisning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Kund</Label>
              <Select value={previewCustomerId} onValueChange={setPreviewCustomerId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Välj kund" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Artikel</Label>
              <Select value={previewArticleId} onValueChange={setPreviewArticleId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Välj artikel" /></SelectTrigger>
                <SelectContent>
                  {articles?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preview?.rule && (
              <div className="text-sm">
                <span className="text-muted-foreground">Tillämplig regel: </span>
                <span className="font-medium">{preview.rule.name}</span>
                {preview.rule.pricePerHour && (
                  <span className="ml-2 text-muted-foreground">({Number(preview.rule.pricePerHour)} kr/h)</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DataTable data={rules ?? []} columns={columns} filterPlaceholder="Sök prisregel..." />
    </div>
  );
}
