import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { DailyBoard } from "@/components/DailyBoard";
import { DeliverableModal } from "@/components/DeliverableModal";
import { ProjectHistoryView } from "@/components/ProjectHistoryView";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { Project, Deliverable } from "@/types/database";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";

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
      setPendingProject(project);
      setPendingDate(date);
      setModalOpen(true);
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
              DailyFlow
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
    </DndContext>
  );
};

export default Dashboard;
