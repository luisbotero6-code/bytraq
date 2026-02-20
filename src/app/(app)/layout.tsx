import { Sidebar } from "@/components/shared/sidebar";
import { TimerBar } from "@/modules/time-entry/components/timer-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
      <TimerBar />
    </div>
  );
}
