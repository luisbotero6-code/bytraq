"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekView } from "@/modules/time-entry/components/week-view";
import { DayView } from "@/modules/time-entry/components/day-view";

export default function TimePage() {
  const [tab, setTab] = useState("week");

  return (
    <div>
      <PageHeader title="Tidredovisning" description="Registrera och hantera arbetstid" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="week">Veckovy</TabsTrigger>
          <TabsTrigger value="day">Dagvy</TabsTrigger>
        </TabsList>
        <TabsContent value="week" className="mt-4">
          <WeekView />
        </TabsContent>
        <TabsContent value="day" className="mt-4">
          <DayView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
