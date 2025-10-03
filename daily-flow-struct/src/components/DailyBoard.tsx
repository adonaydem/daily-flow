import { format, addDays, startOfWeek } from "date-fns";
import { DateTile } from "./DateTile";
import { Deliverable } from "@/types/database";

interface DailyBoardProps {
  deliverables: Deliverable[];
  onDeliverableCreated: () => void; // kept for future extension (modal now in parent)
  onDeliverableUpdated: () => void;
}

export const DailyBoard = ({
  deliverables,
  onDeliverableCreated, // eslint-disable-line @typescript-eslint/no-unused-vars
  onDeliverableUpdated,
}: DailyBoardProps) => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getDeliverablesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return deliverables.filter((d) => d.date === dateStr);
  };

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          This Week
        </h1>
        <p className="text-muted-foreground mt-1">
          Drag projects onto dates to plan your deliverables
        </p>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => (
          <DateTile
            key={day.toISOString()}
            date={day}
            deliverables={getDeliverablesForDate(day)}
            onDeliverableUpdated={onDeliverableUpdated}
          />
        ))}
      </div>
    </div>
  );
};
