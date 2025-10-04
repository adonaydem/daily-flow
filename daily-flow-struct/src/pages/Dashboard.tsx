import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { DailyBoard } from "@/components/DailyBoard";
import { DeliverableModal } from "@/components/DeliverableModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProjectHistoryView } from "@/components/ProjectHistoryView";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Settings } from "lucide-react";
import { Project, Deliverable, Report } from "@/types/database";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { useWhisper } from "@/hooks/useWhisper";
import { structureText } from "@/lib/ai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [viewDeliverable, setViewDeliverable] = useState<Deliverable | null>(null);
  const [deliverableReports, setDeliverableReports] = useState<Report[]>([]);
  const [completionReport, setCompletionReport] = useState("");
  const [completionSaving, setCompletionSaving] = useState(false);
  const { start: startCompRec, stop: stopCompRec, recording: compRecording, uploading: compUploading, result: compResult, reset: resetComp } = useWhisper({ autoStopMs: 60000 });
  useEffect(() => {
    if (compResult.transcript && !viewDeliverable?.is_done) {
      setCompletionReport(prev => prev ? prev + "\n" + compResult.transcript : compResult.transcript);
    }
  }, [compResult.transcript, viewDeliverable]);
  useEffect(() => {
    const loadReports = async () => {
      if (!viewDeliverable) return;
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("deliverable_id", viewDeliverable.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load reports", error);
      } else {
        setDeliverableReports(data || []);
      }
    };
    loadReports();
  }, [viewDeliverable]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchProjects();
        fetchDeliverables();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    }
  };

  const fetchDeliverables = async () => {
    try {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*, project:projects(*)")
        .order("date", { ascending: true });

      if (error) throw error;
      setDeliverables(data || []);
    } catch (error) {
      console.error("Error fetching deliverables:", error);
      toast.error("Failed to load deliverables");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.data.current) {
      const project = active.data.current as Project;
      const date = new Date(over.id as string);

      // Prevent dragging into past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of the day
      if (date < today) {
        return; // Ignore drops on past dates
      }

      setPendingProject(project);
      setPendingDate(date);
      setModalOpen(true);
    }
  };

  const handleDeliverableCompletion = async (deliverable: Deliverable) => {
    const { error } = await supabase
      .from("deliverables")
      .update({ is_done: true })
      .eq("id", deliverable.id);
    if (error) {
      toast.error("Failed to mark deliverable as complete");
    } else {
      toast.success("Deliverable marked as complete");
      fetchDeliverables();
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen flex">
        <ProjectsSidebar
          projects={projects}
          onProjectSelect={setSelectedProject}
          onProjectCreate={fetchProjects}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between flex-shrink-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Peace
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/settings")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {selectedProject ? (
              <ProjectHistoryView
                project={selectedProject}
                onClose={() => setSelectedProject(null)}
              />
            ) : (
              <DailyBoard
                deliverables={deliverables}
                onDeliverableCreated={() => {
                  fetchDeliverables();
                }}
                onDeliverableUpdated={() => {
                  fetchDeliverables();
                }}
                onDeliverableClick={(d) => setViewDeliverable(d)}
              />
            )}
          </div>
        </div>
      </div>
      {pendingProject && pendingDate && (
        <DeliverableModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          project={pendingProject}
          date={pendingDate}
          onDeliverableCreated={() => {
            fetchDeliverables();
            setPendingProject(null);
            setPendingDate(null);
          }}
        />
      )}
      <Dialog open={!!viewDeliverable} onOpenChange={(o) => !o && setViewDeliverable(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-card/95 backdrop-blur">
          {viewDeliverable && (() => {
            const accent = viewDeliverable.project?.color || viewDeliverable.color_override || '#2563eb';
            return (
              <div className="flex flex-col h-full max-h-[80vh]">
                <div className="h-2 w-full" style={{ background: accent }} />
                <div className="flex-1 overflow-auto px-8 py-6 space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight leading-snug">
                      {viewDeliverable.title || viewDeliverable.structured_text.split('\n')[0].slice(0,120)}
                    </h2>
                    <div className="text-xs text-muted-foreground flex gap-2 items-center flex-wrap">
                      <span>{viewDeliverable.date}</span>
                      {viewDeliverable.project?.name && <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: accent }} />{viewDeliverable.project.name}</span>
                      </>}
                      <span>•</span>
                      <span>{viewDeliverable.is_done ? 'Completed' : 'Pending'}</span>
                    </div>
                  </div>
                  {viewDeliverable.structured_text && (
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {viewDeliverable.structured_text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {!viewDeliverable.structured_text && viewDeliverable.raw_text && (
                    <div className="text-sm whitespace-pre-wrap text-muted-foreground">{viewDeliverable.raw_text}</div>
                  )}
                  {deliverableReports.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Reports</h3>
                      <ul className="grid sm:grid-cols-2 gap-3 max-h-60 overflow-auto">
                        {deliverableReports.map(r => (
                          <li key={r.id} className="p-3 rounded-md border bg-background/60 hover:bg-background/80 transition flex flex-col gap-1">
                            <div className="text-xs font-semibold truncate">{r.structured_text.split('\n')[0].slice(0,64)}</div>
                            <div className="text-[11px] text-muted-foreground max-h-28 overflow-auto pr-1 custom-scroll-thin prose prose-xs dark:prose-invert max-w-none">
                              <ReactMarkdown>{r.structured_text || r.raw_text || ''}</ReactMarkdown>
                            </div>
                            <div className="mt-auto pt-1 text-[10px] opacity-60">{new Date(r.created_at).toLocaleString()}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!viewDeliverable.is_done && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label htmlFor="completion-report" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completion Report (required to complete)</Label>
                      <div className="relative">
                        <Textarea
                          id="completion-report"
                          placeholder="Describe the outcome, what was achieved, blockers, next steps... (AI will structure it)"
                          value={completionReport}
                          onChange={(e) => setCompletionReport(e.target.value)}
                          rows={4}
                          className="resize-none text-sm pr-12"
                        />
                        <button
                          type="button"
                          onClick={compRecording ? stopCompRec : startCompRec}
                          disabled={compUploading}
                          className={`absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-medium shadow-sm transition
                            ${compRecording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary hover:bg-secondary/80'}`}
                          aria-label={compRecording ? 'Stop recording' : 'Start recording'}
                        >
                          {compRecording ? '◼' : (compUploading ? '…' : '🎤')}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{compRecording ? 'Recording…' : compUploading ? 'Transcribing…' : 'Mic (Whisper)'}</span>
                        {compResult.transcript && <button type="button" onClick={resetComp} className="underline hover:text-foreground">Clear</button>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">This short report is mandatory before marking the deliverable complete.</p>
                    </div>
                  )}
                </div>
                <div className="border-t px-6 py-3 flex items-center justify-between bg-card/80 backdrop-blur-sm">
                  <div className="text-xs font-medium flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: accent }} />Status:</span>
                    <span>{viewDeliverable.is_done ? 'Done' : 'Pending'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={viewDeliverable.is_done ? 'secondary' : 'default'} disabled={completionSaving || (!viewDeliverable.is_done && !completionReport.trim())} onClick={async () => {
                      const newVal = !viewDeliverable.is_done;
                      if (newVal) {
                        if (!completionReport.trim()) {
                          toast.error('Completion report required');
                          return;
                        }
                        setCompletionSaving(true);
                        try {
                          // First structure the report text
                          const structuredText = await structureText(completionReport);
                          const { error: repErr } = await supabase.from('reports').insert({
                            deliverable_id: viewDeliverable.id,
                            raw_text: completionReport,
                            structured_text: structuredText
                          });
                          if (repErr) throw repErr;
                          const { error } = await supabase.from('deliverables').update({ is_done: true }).eq('id', viewDeliverable.id);
                          if (error) throw error;
                          toast.success('Marked complete');
                          setViewDeliverable({ ...viewDeliverable, is_done: true });
                          setCompletionReport("");
                          fetchDeliverables();
                        } catch (e) {
                          console.error(e);
                          toast.error('Failed to complete');
                        } finally {
                          setCompletionSaving(false);
                        }
                      } else {
                        // Undo completion
                        const { error } = await supabase.from('deliverables').update({ is_done: false }).eq('id', viewDeliverable.id);
                        if (error) {
                          toast.error('Update failed');
                          return;
                        }
                        toast.success('Reopened');
                        setViewDeliverable({ ...viewDeliverable, is_done: false });
                        fetchDeliverables();
                      }
                    }}>{completionSaving ? 'Saving…' : viewDeliverable.is_done ? 'Undo' : 'Complete'}</Button>
                    <Button size="sm" variant="outline" onClick={() => setViewDeliverable(null)}>Close</Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

export default Dashboard;
