"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const adminLinks = [
  { href: "/admin/customers", title: "Kunder", description: "Hantera kunder och kundsegment" },
  { href: "/admin/articles", title: "Artiklar", description: "Artiklar och artikelgrupper" },
  { href: "/admin/employees", title: "Medarbetare", description: "Medarbetare och kostnader" },
  { href: "/admin/users", title: "Användare", description: "Användarkonton och roller" },
  { href: "/admin/pricing-rules", title: "Prisregler", description: "Prisregler och prissättning" },
  { href: "/admin/periods", title: "Perioder", description: "Periodlåsning" },
  { href: "/admin/calendar", title: "Kalender", description: "Helgdagar och arbetstider" },
  { href: "/admin/audit-log", title: "Revisionslogg", description: "Spårbarhet och ändringslogg" },
  { href: "/admin/import", title: "Dataimport", description: "Importera historisk data från Excel/CSV" },
];

export default function AdminPage() {
  return (
    <div>
      <PageHeader title="Administration" description="Systemadministration och masterdata" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{link.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
