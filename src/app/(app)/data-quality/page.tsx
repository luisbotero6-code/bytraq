"use client";

import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS = {
  INFO: "bg-blue-100 text-blue-800",
  WARNING: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-red-100 text-red-800",
};

export default function DataQualityPage() {
  const { data: rules } = trpc.dataQuality.rules.useQuery();
  const { data: issues, refetch } = trpc.dataQuality.issues.useQuery();

  const runChecksMutation = trpc.dataQuality.runChecks.useMutation({
    onSuccess: (result) => {
      refetch();
      toast.success(`Kontroll klar: ${result.created} nya problem hittades`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateIssueMutation = trpc.dataQuality.updateIssue.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader title="Datakvalitet" description="Kontrollera och åtgärda datakvalitetsproblem">
        <Button
          size="sm"
          onClick={() => runChecksMutation.mutate()}
          disabled={runChecksMutation.isPending}
        >
          {runChecksMutation.isPending ? "Kontrollerar..." : "Kör kontroller"}
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {rules?.map((rule) => (
          <Card key={rule.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{rule.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge className={cn(SEVERITY_COLORS[rule.severity])}>
                  {rule.severity}
                </Badge>
                <span className="text-lg font-bold">{rule._count.issues}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">
        Öppna problem <Badge variant="secondary">{issues?.length ?? 0}</Badge>
      </h2>

      <div className="space-y-2">
        {issues?.map((issue) => (
          <Card key={issue.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Badge className={cn(SEVERITY_COLORS[issue.severity])}>
                  {issue.severity}
                </Badge>
                <div>
                  <div className="text-sm font-medium">{issue.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {issue.rule.name} — {issue.entityType} ({issue.entityId.slice(0, 8)}...)
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateIssueMutation.mutate({ id: issue.id, status: "RESOLVED" })}
                >
                  Åtgärdad
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateIssueMutation.mutate({ id: issue.id, status: "IGNORED" })}
                >
                  Ignorera
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {issues?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Inga öppna problem. Kör kontroller för att söka efter nya.
          </p>
        )}
      </div>
    </div>
  );
}
