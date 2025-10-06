import { useState } from "react";
import { format, addDays, startOfWeek, subWeeks, addWeeks, subMonths, addMonths } from "date-fns";
import { DateTile } from "./DateTile";
import { Deliverable } from "@/types/database";

interface DailyBoardProps {
  deliverables: Deliverable[];
  onDeliverableCreated: () => void; // kept for future extension (modal now in parent)
  onDeliverableUpdated: () => void;
  onDeliverableClick: (d: Deliverable) => void;
  onMobileAdd: (date: Date) => void;
}

export const DailyBoard = ({
  deliverables,
  onDeliverableCreated, // eslint-disable-line @typescript-eslint/no-unused-vars
  onDeliverableUpdated,
  onDeliverableClick,
  onMobileAdd,
}: DailyBoardProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleWeekChange = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const getDeliverablesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return deliverables.filter((d) => d.date === dateStr);
  };

  // click handler now provided by parent

  return (
    <div className="flex-1 p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Week {format(weekStart, "MMM d")} – {format(addDays(weekStart,6), "MMM d")} • {format(currentDate, "MMMM yyyy")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Drag future projects onto a date. Past days are disabled.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 bg-card border rounded-md p-1 shadow-sm">
            <button onClick={() => handleWeekChange("prev")} className="px-2 py-1 text-xs rounded hover:bg-accent/40">◀ Week</button>
            <span className="text-xs px-1 font-medium">{format(weekStart, "MMM d")} - {format(addDays(weekStart,6), "MMM d")}</span>
            <button onClick={() => handleWeekChange("next")} className="px-2 py-1 text-xs rounded hover:bg-accent/40">Week ▶</button>
          </div>
          <div className="flex items-center gap-1 bg-card border rounded-md p-1 shadow-sm">
            <button onClick={() => handleMonthChange("prev")} className="px-2 py-1 text-xs rounded hover:bg-accent/40">◀ {format(subMonths(currentDate,1), "MMM")}</button>
            <span className="text-xs px-1 font-medium">{format(currentDate, "MMMM yyyy")}</span>
            <button onClick={() => handleMonthChange("next")} className="px-2 py-1 text-xs rounded hover:bg-accent/40">{format(addMonths(currentDate,1), "MMM")} ▶</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-4">
        {weekDays.map((day) => (
          <DateTile
            key={day.toISOString()}
            date={day}
            deliverables={getDeliverablesForDate(day)}
            onDeliverableUpdated={onDeliverableUpdated}
            onDeliverableClick={onDeliverableClick}
            onMobileAdd={onMobileAdd}
          />
        ))}
      </div>
    </div>
  );
};
