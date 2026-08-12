import { useEffect, useState } from 'react';
import { getSyncEngineState, subscribeSyncEngine } from './sync-engine';

export function useSyncEngine() {
  const [state, setState] = useState(getSyncEngineState());

  useEffect(() => subscribeSyncEngine(setState), []);

  return state;
}
