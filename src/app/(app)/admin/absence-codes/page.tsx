"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ABSENCE_CODES, ABSENCE_CODE_TO_REASON, ABSENCE_REASON_LABELS } from "@/lib/constants";
import type { ColumnDef } from "@tanstack/react-table";

interface AbsenceCodeRow {
  code: string;
  label: string;
  reason: string;
}

const data: AbsenceCodeRow[] = ABSENCE_CODES.map((ac) => ({
  code: ac.code,
  label: ac.label,
  reason:
    ABSENCE_REASON_LABELS[
      ABSENCE_CODE_TO_REASON[ac.code] as keyof typeof ABSENCE_REASON_LABELS
    ] ?? "Övrigt",
}));

const columns: ColumnDef<AbsenceCodeRow>[] = [
  {
    accessorKey: "code",
    header: "Kod",
  },
  {
    accessorKey: "label",
    header: "Benämning",
  },
  {
    accessorKey: "reason",
    header: "Kategori",
  },
];

export default function AbsenceCodesPage() {
  return (
    <div>
      <PageHeader
        title="Frånvarokoder"
        description="Registreringskoder för frånvaro och lönearter"
      />
      <DataTable columns={columns} data={data} filterPlaceholder="Sök kod eller benämning..." />
    </div>
  );
}
