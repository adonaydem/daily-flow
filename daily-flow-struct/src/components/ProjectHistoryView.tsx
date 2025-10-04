import { useEffect, useState } from "react";
import { Project, Deliverable, Report } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { summarizeProject } from "@/lib/ai";
import ReactMarkdown from "react-markdown";

interface ProjectHistoryViewProps {
  project: Project;
  onClose: () => void;
}

export const ProjectHistoryView = ({ project, onClose }: ProjectHistoryViewProps) => {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [reports, setReports] = useState<Record<string, Report[]>>({});
  const [loading, setLoading] = useState(true);
  const [catchingUp, setCatchingUp] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectHistory();
  }, [project.id]);

  const fetchProjectHistory = async () => {
    try {
      setLoading(true);

      // Fetch deliverables for this project
      const { data: deliverablesData, error: deliverablesError } = await supabase
        .from("deliverables")
        .select("*")
        .eq("project_id", project.id)
        .order("date", { ascending: false });

      if (deliverablesError) throw deliverablesError;

      setDeliverables(deliverablesData || []);

      // Fetch reports for all deliverables
      if (deliverablesData && deliverablesData.length > 0) {
        const deliverableIds = deliverablesData.map((d) => d.id);
        const { data: reportsData, error: reportsError } = await supabase
          .from("reports")
          .select("*")
          .in("deliverable_id", deliverableIds)
          .order("created_at", { ascending: false });

        if (reportsError) throw reportsError;

        // Group reports by deliverable_id
        const reportsMap: Record<string, Report[]> = {};
        reportsData?.forEach((report) => {
          if (!reportsMap[report.deliverable_id]) {
            reportsMap[report.deliverable_id] = [];
          }
          reportsMap[report.deliverable_id].push(report);
        });
        setReports(reportsMap);
      }
    } catch (error) {
      console.error("Error fetching project history:", error);
      toast.error("Failed to load project history");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Board
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <h2 className="text-2xl font-bold">{project.name}</h2>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={catchingUp || loading || deliverables.length===0} onClick={async () => {
            setCatchingUp(true);
            setSummary(null);
            try {
              // Prepare tasks JSON for summarize-project function
              const recent = [...deliverables].slice(0,10);
              const tasks = recent.map(d => {
                const deliverableBody = (d.structured_text || d.raw_text || '').split(/\s+/).slice(0,500).join(' ');
                const reps = (reports[d.id]||[]).slice(0,3);
                const reportsConcat = reps.map(r => (r.structured_text || r.raw_text || '').split(/\s+/).slice(0,180).join(' ')).join('\n---\n');
                return {
                  task_title: d.title || d.structured_text?.split('\n')[0]?.slice(0,120) || 'Untitled',
                  deliverables: deliverableBody,
                  reports: reportsConcat
                };
              });
              const summaryText = await summarizeProject(project.name, tasks);
              setSummary(summaryText);
            } catch (e) {
              console.error('Summarize failed, using fallback:', e);
              toast.error('Failed to summarize (fallback used)');
              // Fallback: simple synthetic list
              const recent = [...deliverables].slice(0,10);
              const synthetic = recent.map(d => `- ${d.date}: ${(d.structured_text||d.raw_text||'').split('\n')[0].slice(0,120)}`).join('\n');
              setSummary(`### Catch Me Up (Fallback)\n\n${synthetic}`);
            } finally {
              setCatchingUp(false);
            }
          }}>{catchingUp ? 'Summarizing…' : 'Catch Me Up'}</Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="text-center text-muted-foreground">Loading history...</div>
        ) : deliverables.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No deliverables yet for this project</p>
            <p className="text-sm mt-1">
              Drag this project onto a date to create deliverables
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {summary && (
              <div className="p-4 rounded-lg border border-border bg-muted/30 prose prose-sm dark:prose-invert">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
            {deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {format(new Date(deliverable.date), "EEEE, MMMM d, yyyy")}
                    </div>
                    {deliverable.tag && (
                      <Badge variant="secondary" className="mt-1">
                        {deliverable.tag}
                      </Badge>
                    )}
                  </div>
                  {deliverable.is_done && (
                    <Badge variant="default" className="bg-green-500">
                      Done
                    </Badge>
                  )}
                </div>

                <div className="mb-3">
                  <h4 className="text-sm font-semibold mb-2">Deliverables:</h4>
                  <div className="prose prose-xs dark:prose-invert max-w-none text-muted-foreground">
                    <ReactMarkdown>{deliverable.structured_text || deliverable.raw_text || ''}</ReactMarkdown>
                  </div>
                </div>

                {reports[deliverable.id] && reports[deliverable.id].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-sm font-semibold mb-2">Reports:</h4>
                    <div className="space-y-2">
                      {reports[deliverable.id].map((report) => (
                        <div
                          key={report.id}
                          className="p-3 rounded-lg bg-muted/50 border border-border"
                        >
                          <div className="text-xs text-muted-foreground mb-1">
                            {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                          <div className="text-sm max-h-40 overflow-auto pr-1">
                            <div className="prose prose-xs dark:prose-invert max-w-none">
                              <ReactMarkdown>{report.structured_text || report.raw_text || ''}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
