import FleetSchedule from "@/components/FleetSchedule";

export default function SchedulingPage() {
  return (
    <div className="space-y-6" data-testid="scheduling-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fleet Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage vehicle schedules and allocate bookings
          </p>
        </div>
      </div>

      {/* Fleet Schedule Component */}
      <FleetSchedule />
    </div>
  );
}
