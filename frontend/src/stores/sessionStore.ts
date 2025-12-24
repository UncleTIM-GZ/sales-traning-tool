import { create } from "zustand";

interface Turn {
  turnNumber: number;
  role: "user" | "npc" | "coach";
  content: string;
  createdAt: string;
}

interface SessionState {
  sessionId: string | null;
  scenarioId: string | null;
  mode: "train" | "exam" | "replay" | null;
  status: "pending" | "active" | "completed" | "aborted" | null;
  turns: Turn[];
  isLoading: boolean;
  currentNpcMessage: string;
  coachHint: string | null;
  partialScore: Record<string, number> | null;

  // Actions
  initSession: (sessionId: string, scenarioId: string, mode: string) => void;
  addTurn: (turn: Turn) => void;
  setNpcMessage: (message: string) => void;
  setCoachHint: (hint: string | null) => void;
  setPartialScore: (score: Record<string, number>) => void;
  setStatus: (status: SessionState["status"]) => void;
  setLoading: (loading: boolean) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  scenarioId: null,
  mode: null,
  status: null,
  turns: [],
  isLoading: false,
  currentNpcMessage: "",
  coachHint: null,
  partialScore: null,

  initSession: (sessionId, scenarioId, mode) =>
    set({
      sessionId,
      scenarioId,
      mode: mode as SessionState["mode"],
      status: "active",
      turns: [],
      currentNpcMessage: "",
      coachHint: null,
      partialScore: null,
    }),

  addTurn: (turn) =>
    set((state) => ({
      turns: [...state.turns, turn],
    })),

  setNpcMessage: (message) =>
    set({ currentNpcMessage: message }),

  setCoachHint: (hint) =>
    set({ coachHint: hint }),

  setPartialScore: (score) =>
    set({ partialScore: score }),

  setStatus: (status) =>
    set({ status }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  clearSession: () =>
    set({
      sessionId: null,
      scenarioId: null,
      mode: null,
      status: null,
      turns: [],
      isLoading: false,
      currentNpcMessage: "",
      coachHint: null,
      partialScore: null,
    }),
}));
