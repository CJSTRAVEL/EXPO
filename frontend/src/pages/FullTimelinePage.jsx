import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import FleetSchedule from "@/components/FleetSchedule";

export default function FullTimelinePage() {
  return (
    <div className="space-y-4" data-testid="full-timeline-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/scheduling">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Scheduling
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Full 24-Hour Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Complete daily view of all vehicle schedules
          </p>
        </div>
      </div>

      {/* Full Timeline Component */}
      <FleetSchedule fullView={true} />
    </div>
  );
}
