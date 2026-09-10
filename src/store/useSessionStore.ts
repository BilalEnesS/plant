import { create } from 'zustand';
import type { IdentifiedPlant, SecondPhotoSession } from '@/services/types';

/**
 * Passes transient data between screens instead of serializing objects into
 * expo-router params. The router only passes id/route; data lives here.
 * lastResult's persistent form moves to useCollectionStore once Phase 4 adds it.
 */
interface SessionState {
  lastResult: IdentifiedPlant | null;
  secondPhotoSession: SecondPhotoSession | null;
  setLastResult: (plant: IdentifiedPlant) => void;
  setSecondPhotoSession: (session: SecondPhotoSession | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  lastResult: null,
  secondPhotoSession: null,
  setLastResult: (plant) => set({ lastResult: plant }),
  setSecondPhotoSession: (session) => set({ secondPhotoSession: session }),
}));
