"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

const COLUMNS = [
  { status: "BACKLOG" as const, label: "Att göra" },
  { status: "IN_PROGRESS" as const, label: "Pågående" },
  { status: "DONE" as const, label: "Klart" },
];

const PRIORITY_COLORS = {
  LOW: "bg-slate-100 text-slate-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

export default function TasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  const { data: tasks, refetch } = trpc.task.list.useQuery();
  const { data: employees } = trpc.employee.list.useQuery();

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      refetch();
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      toast.success("Åtgärd skapad");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Åtgärd borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  function moveTask(taskId: string, newStatus: "BACKLOG" | "IN_PROGRESS" | "DONE") {
    updateMutation.mutate({ id: taskId, status: newStatus });
  }

  return (
    <div>
      <PageHeader title="Åtgärdslistor" description="Hantera uppgifter och åtgärder">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Ny åtgärd</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ny åtgärd</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as typeof newPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Låg</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">Hög</SelectItem>
                    <SelectItem value="URGENT">Brådskande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ title: newTitle, description: newDescription, priority: newPriority })}
                disabled={!newTitle || createMutation.isPending}
              >
                Skapa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks?.filter((t) => t.status === col.status) ?? [];
          return (
            <div key={col.status} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {col.label}
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </h3>
              <div className="space-y-2 min-h-[200px] rounded-lg bg-muted/50 p-2">
                {columnTasks.map((task) => (
                  <Card key={task.id} className="cursor-pointer">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium">{task.title}</span>
                        <Badge className={cn("text-[10px]", PRIORITY_COLORS[task.priority])}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      {task.assignee && (
                        <div className="text-xs text-muted-foreground">{task.assignee.name}</div>
                      )}
                      {task.customer && (
                        <div className="text-xs text-muted-foreground">{task.customer.name}</div>
                      )}
                      <div className="flex gap-1">
                        {col.status !== "BACKLOG" && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => moveTask(task.id, "BACKLOG")}>
                            &larr;
                          </Button>
                        )}
                        {col.status !== "DONE" && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => moveTask(task.id, col.status === "BACKLOG" ? "IN_PROGRESS" : "DONE")}>
                            &rarr;
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto text-destructive" onClick={() => deleteMutation.mutate(task.id)}>
                          Ta bort
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
