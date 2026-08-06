'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DemoState } from './types';
import { load, save, recordInteraction as recordInteractionOnState } from './store';

interface DemoSessionContextValue {
  state: DemoState;
  /** Re-reads sessionStorage — call after any fake-API mutation so the shell's
   * own view of meta (interaction count, etc.) stays current. */
  refresh: () => void;
  recordInteraction: () => void;
  businessName: string;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);

  useEffect(() => {
    setState(load());
  }, []);

  const refresh = () => setState(load());

  const recordInteraction = () => {
    const current = load();
    recordInteractionOnState(current);
    save(current);
    setState(current);
  };

  if (!state) return null; // avoids a hydration mismatch flash before sessionStorage is read

  return (
    <DemoSessionContext.Provider value={{ state, refresh, recordInteraction, businessName: state.business.name }}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession(): DemoSessionContextValue {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error('useDemoSession must be used within DemoSessionProvider');
  return ctx;
}
