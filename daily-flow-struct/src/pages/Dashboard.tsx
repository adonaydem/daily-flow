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
import { LogOut, Settings, Menu, Wand2 } from "lucide-react";
import { Project, Deliverable, Report } from "@/types/database";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { useWhisper } from "@/hooks/useWhisper";
import { structureText } from "@/lib/ai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [projectPickerForDate, setProjectPickerForDate] = useState<Date | null>(null);
  const [viewDeliverable, setViewDeliverable] = useState<Deliverable | null>(null);
  const [deliverableReports, setDeliverableReports] = useState<Report[]>([]);
  const [completionReport, setCompletionReport] = useState("");
  const [completionSaving, setCompletionSaving] = useState(false);
  const [completionAiLoading, setCompletionAiLoading] = useState(false);
  const [completionAiPreview, setCompletionAiPreview] = useState<string | null>(null);
  const [appliedCompletionStructured, setAppliedCompletionStructured] = useState<string | null>(null);
  const [editedRaw, setEditedRaw] = useState<string>("");
  const [editedNotes, setEditedNotes] = useState<string>("");
  const [savingEdits, setSavingEdits] = useState(false);
  const { start: startCompRec, stop: stopCompRec, recording: compRecording, uploading: compUploading, result: compResult, reset: resetComp } = useWhisper({ autoStopMs: 60000 });
  useEffect(() => {
    if (compResult.transcript && !viewDeliverable?.is_done) {
      setCompletionReport(prev => prev ? prev + "\n" + compResult.transcript : compResult.transcript);
    }
  }, [compResult.transcript, viewDeliverable]);

  // Clear AI preview when deliverable changes or modal closes
  useEffect(() => {
    setCompletionAiPreview(null);
    setAppliedCompletionStructured(null);
  }, [viewDeliverable]);
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
    if (viewDeliverable) {
      setEditedRaw(viewDeliverable.raw_text || "");
      // Notes may be undefined on type; normalize to '' for controlled input
      setEditedNotes((viewDeliverable as any).notes || "");
    } else {
      setEditedRaw("");
      setEditedNotes("");
    }
  }, [viewDeliverable]);

  const handleViewDialogOpenChange = async (open: boolean) => {
    // If closing and a deliverable is open, save edits
    if (!open && viewDeliverable) {
      const nextRaw = editedRaw;
      const nextNotes = editedNotes;
      const changed = nextRaw !== (viewDeliverable.raw_text || "") || (nextNotes || null) !== ((viewDeliverable as any).notes || null);
      if (changed) {
        try {
          setSavingEdits(true);
          const { error } = await supabase
            .from('deliverables')
            .update({ raw_text: nextRaw, notes: nextNotes || null })
            .eq('id', viewDeliverable.id);
          if (error) throw error;
          toast.success('Saved changes');
          await fetchDeliverables();
        } catch (e) {
          console.error(e);
          toast.error('Failed to save changes');
        } finally {
          setSavingEdits(false);
        }
      }
      setViewDeliverable(null);
    } else if (!open) {
      // just close
      setViewDeliverable(null);
    }
  };

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
        <div className="hidden md:block">
          <ProjectsSidebar
            projects={projects}
            onProjectSelect={setSelectedProject}
            onProjectCreate={fetchProjects}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <SheetHeader className="p-4 pb-2">
                    <SheetTitle>Projects</SheetTitle>
                  </SheetHeader>
                  <ProjectsSidebar
                    projects={projects}
                    onProjectSelect={(p)=>{ setSelectedProject(p); }}
                    onProjectCreate={fetchProjects}
                  />
                </SheetContent>
              </Sheet>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Peacable
              </h1>
            </div>
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
                onMobileAdd={(date)=>{
                  if (projects.length === 0) { toast.error('Create a project first'); return; }
                  setProjectPickerForDate(date);
                }}
              />
            )}
          </div>
        </div>
      </div>
      {(pendingProject && pendingDate) || editingDeliverable ? (
        <DeliverableModal
          open={modalOpen}
          onOpenChange={(open)=>{
            setModalOpen(open);
            if (!open) {
              setPendingProject(null);
              setPendingDate(null);
              setEditingDeliverable(null);
            }
          }}
          project={(editingDeliverable?.project as Project) || (pendingProject as Project)}
          date={editingDeliverable ? new Date(editingDeliverable.date) : (pendingDate as Date)}
          onDeliverableCreated={() => {
            fetchDeliverables();
            setPendingProject(null);
            setPendingDate(null);
            setEditingDeliverable(null);
          }}
          existingDeliverable={editingDeliverable ? {
            id: editingDeliverable.id,
            raw_text: editingDeliverable.raw_text,
            structured_text: editingDeliverable.structured_text,
            title: editingDeliverable.title ?? null,
            notes: editingDeliverable.notes ?? null,
            tag: editingDeliverable.tag,
            color_override: editingDeliverable.color_override,
          } : undefined}
        />
      ) : null}

      <Dialog open={!!projectPickerForDate} onOpenChange={(o)=>{ if (!o) setProjectPickerForDate(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select a project</DialogTitle>
            <DialogDescription>Choose a project to schedule on {projectPickerForDate?.toLocaleDateString()}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {projects.map(p => (
              <Button key={p.id} variant="outline" className="justify-start" onClick={()=>{
                setPendingProject(p);
                setPendingDate(projectPickerForDate as Date);
                setProjectPickerForDate(null);
                setModalOpen(true);
              }}>
                <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: p.color }} />{p.name}</span>
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={()=>setProjectPickerForDate(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewDeliverable} onOpenChange={handleViewDialogOpenChange}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-card/95 backdrop-blur">
          {viewDeliverable && (() => {
            const accent = viewDeliverable.project?.color || viewDeliverable.color_override || '#2563eb';
            return (
              <div className="flex flex-col h-full max-h-[85vh]">
                <div className="h-2 w-full" style={{ background: accent }} />
                <div className="flex-1 overflow-auto px-6 md:px-8 py-4 md:py-6 space-y-6 md:space-y-8">
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
                      {savingEdits && <><span>•</span><span>Saving…</span></>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Deliverables</Label>
                    <Textarea
                      value={editedRaw}
                      onChange={(e)=>setEditedRaw(e.target.value)}
                      rows={8}
                      className="resize-none text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
                      placeholder="Edit your deliverables…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Notes</Label>
                    <Textarea
                      value={editedNotes}
                      onChange={(e)=>setEditedNotes(e.target.value)}
                      rows={4}
                      className="resize-none text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
                      placeholder="Notes…"
                    />
                  </div>
                  {deliverableReports.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Reports</h3>
                      <ul className="grid sm:grid-cols-2 gap-3 max-h-60 md:max-h-72 overflow-auto">
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
                        <div className="relative">
                          <Textarea
                            id="completion-report"
                            placeholder="Describe the outcome, what was achieved, blockers, next steps..."
                            value={completionReport}
                            onChange={(e) => setCompletionReport(e.target.value)}
                            rows={4}
                            className="resize-none text-sm pr-24"
                          />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (completionAiPreview) {
                                  setAppliedCompletionStructured(completionAiPreview);
                                  setCompletionAiPreview(null);
                                  toast.success('AI result applied');
                                } else {
                                  // request preview
                                  (async () => {
                                    try {
                                      setCompletionAiLoading(true);
                                      const structured = await structureText(completionReport);
                                      setCompletionAiPreview(structured || '');
                                    } catch (e) {
                                      console.error(e);
                                      toast.error('AI preview failed');
                                    } finally {
                                      setCompletionAiLoading(false);
                                    }
                                  })();
                                }
                              }}
                              disabled={completionAiLoading}
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shadow-sm transition ${completionAiLoading ? 'bg-secondary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                              title={completionAiPreview ? 'Apply AI preview' : 'Preview with AI'}
                            >
                              {completionAiLoading ? '…' : <Wand2 className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={compRecording ? stopCompRec : startCompRec}
                              disabled={compUploading}
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-medium shadow-sm transition
                                ${compRecording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary hover:bg-secondary/80'}`}
                              aria-label={compRecording ? 'Stop recording' : 'Start recording'}
                            >
                              {compRecording ? '◼' : (compUploading ? '…' : '🎤')}
                            </button>
                          </div>
                        </div>
                        {completionAiPreview !== null && (
                          <div className="mt-2 border rounded-md p-3 bg-muted/40">
                            <div className="text-xs font-medium mb-2">AI Preview</div>
                            <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto">{completionAiPreview}</pre>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={() => { setAppliedCompletionStructured(completionAiPreview); setCompletionAiPreview(null); toast.success('AI result applied'); }}>Apply</Button>
                              <Button size="sm" variant="outline" onClick={() => setCompletionAiPreview(null)}>Dismiss</Button>
                            </div>
                          </div>
                        )}
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
                          // Use applied AI result if present; otherwise save raw text (no automatic structuring)
                          const structuredText = appliedCompletionStructured ?? completionReport;
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
                          setAppliedCompletionStructured(null);
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
                    <Button size="sm" variant="outline" onClick={() => handleViewDialogOpenChange(false)}>Close</Button>
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
