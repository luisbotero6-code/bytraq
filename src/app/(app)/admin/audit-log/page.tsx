"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const { data } = trpc.audit.list.useQuery({
    ...(entityType ? { entityType } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit: 50,
    offset,
  });

  return (
    <div>
      <PageHeader title="Revisionslogg" description="Spårbarhet och ändringslogg" />

      <div className="flex gap-4 mb-6">
        <div className="space-y-1">
          <Label className="text-xs">Entitetstyp</Label>
          <Input
            className="w-40"
            placeholder="t.ex. TimeEntry"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Från</Label>
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Till</Label>
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {data?.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{item.action}</Badge>
              <div>
                <span className="text-sm font-medium">{item.entityType}</span>
                <span className="text-xs text-muted-foreground ml-2">({item.entityId.slice(0, 8)}...)</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm">{item.user.name}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(item.timestamp), "yyyy-MM-dd HH:mm", { locale: sv })}
              </div>
            </div>
          </div>
        ))}

        {data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Inga loggposter</p>
        )}
      </div>

      {data && data.total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
            Föregående
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            {offset + 1}-{Math.min(offset + 50, data.total)} av {data.total}
          </span>
          <Button variant="outline" size="sm" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>
            Nästa
          </Button>
        </div>
      )}
    </div>
  );
}
