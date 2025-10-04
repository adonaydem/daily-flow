import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Project } from "@/types/database";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { useDraggable } from "@dnd-kit/core";

interface ProjectsSidebarProps {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  onProjectCreate: () => void;
}

const DraggableProject = ({ project, onProjectSelect }: { project: Project; onProjectSelect: (project: Project) => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    data: project,
  });

  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
    >
      <div
        className="h-6 w-3 flex flex-col justify-between mr-1 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80"
        {...listeners}
        {...attributes}
      >
        <span className="block h-[2px] rounded bg-current" />
        <span className="block h-[2px] rounded bg-current" />
        <span className="block h-[2px] rounded bg-current" />
      </div>
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
        style={{ backgroundColor: project.color }}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate text-card-foreground">{project.name}</h4>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate">{project.description}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onProjectSelect(project);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <FolderOpen className="w-4 h-4" />
      </Button>
    </div>
  );
};

export const ProjectsSidebar = ({
  projects,
  onProjectSelect,
  onProjectCreate,
}: ProjectsSidebarProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
  <div className="w-60 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Projects
        </h2>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="w-full"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No projects yet</p>
              <p className="text-xs mt-1">Create your first project to get started</p>
            </div>
          ) : (
            projects.map((project) => (
              <DraggableProject
                key={project.id}
                project={project}
                onProjectSelect={onProjectSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onProjectCreated={onProjectCreate}
      />
    </div>
  );
};
