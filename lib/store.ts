"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Project } from "./types";
import { SAMPLE_PROJECTS } from "./mock-data";

interface ProjectStore {
  projects: Project[];
  upsertProject: (p: Project) => void;
  patchProject: (id: string, partial: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: SAMPLE_PROJECTS,
      upsertProject: (p) =>
        set((s) => {
          const idx = s.projects.findIndex((x) => x.id === p.id);
          const next = [...s.projects];
          if (idx >= 0) next[idx] = p;
          else next.unshift(p);
          return { projects: next };
        }),
      patchProject: (id, partial) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...partial } : p)),
        })),
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      getProject: (id) => get().projects.find((p) => p.id === id),
    }),
    { name: "ai-canvas-store-v1" },
  ),
);
