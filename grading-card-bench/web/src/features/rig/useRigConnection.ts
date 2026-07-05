/**
 * useRigConnection — React binding for the RigClient singleton.
 */

import { useCallback, useEffect, useState } from "react";
import { rigClient } from "./rigClient";
import type { RigState, SerialPortInfo } from "./rig.types";

export interface UseRigConnection {
  rig: RigState;
  ports: SerialPortInfo[];
  busy: boolean;
  refreshPorts: () => Promise<void>;
  connect: (portPath?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  ping: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  emergencyStop: () => Promise<void>;
  actionError?: string;
}

export function useRigConnection(): UseRigConnection {
  const [rig, setRig] = useState<RigState>(rigClient.getState());
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  useEffect(() => rigClient.subscribe(setRig), []);

  // Try to reach the bridge on mount (non-fatal if it's not running yet).
  useEffect(() => {
    rigClient.connectBridge().catch(() => undefined);
  }, []);

  const wrap = useCallback(
    (fn: () => Promise<unknown>) => async () => {
      setBusy(true);
      setActionError(undefined);
      try {
        await fn();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const refreshPorts = useCallback(async () => {
    setActionError(undefined);
    try {
      setPorts(await rigClient.listPorts());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return {
    rig,
    ports,
    busy,
    actionError,
    refreshPorts,
    connect: useCallback(
      async (portPath?: string) => {
        setBusy(true);
        setActionError(undefined);
        try {
          await rigClient.connectRig(portPath);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      },
      []
    ),
    disconnect: wrap(() => rigClient.disconnectRig()),
    ping: wrap(() => rigClient.ping()),
    refreshStatus: wrap(() => rigClient.refreshStatus()),
    emergencyStop: wrap(() => rigClient.emergencyStop()),
  };
}
