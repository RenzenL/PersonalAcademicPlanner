import React, { useEffect, useRef, useState } from 'react';
import { Cloud, LoaderCircle } from 'lucide-react';
import type {
  RealtimeChannel,
  Session,
} from '@supabase/supabase-js';
import type { FormEvent } from 'react';
import type { AcademicBackupPayload } from '../types/academic';
import { useAcademicStore } from '../store/useAcademicStore';
import { supabase } from '../lib/supabase';
import { ModalShell } from './ui';

type SyncStatus =
  | 'unconfigured'
  | 'signedOut'
  | 'loading'
  | 'synced'
  | 'syncing'
  | 'error'
  | 'conflict';

interface SyncConflict {
  local: AcademicBackupPayload;
  remote: AcademicBackupPayload;
}

function getLocalBackup(): AcademicBackupPayload {
  return JSON.parse(
    useAcademicStore.getState().exportBackupJSON()
  ) as AcademicBackupPayload;
}

function getBackupSignature(backup: AcademicBackupPayload): string {
  const { exportedAt: _exportedAt, ...data } = backup;
  return JSON.stringify(data);
}

function hasPlannerData(backup: AcademicBackupPayload): boolean {
  return Boolean(
    backup.courses.length ||
      backup.anchorEvents.length ||
      backup.taskBlocks.length ||
      backup.srCards.length ||
      backup.classSchedules?.length ||
      backup.studyLogs?.length ||
      backup.notes?.length
  );
}

function parseRemoteBackup(data: unknown): AcademicBackupPayload {
  if (!data || typeof data !== 'object') {
    throw new Error('The saved cloud data is not a valid planner backup.');
  }
  return data as AcademicBackupPayload;
}

export const CloudSyncControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(
    supabase ? 'signedOut' : 'unconfigured'
  );
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [conflict, setConflict] = useState<SyncConflict | null>(null);

  const userIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const lastSyncedSignatureRef = useRef('');
  const syncingRef = useRef(false);
  const syncAgainRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const conflictRef = useRef<SyncConflict | null>(null);
  const resolveConflictRef = useRef<
    ((choice: 'local' | 'remote') => Promise<void>) | null
  >(null);
  const retryConnectionRef = useRef<((session: Session) => void) | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let channel: RealtimeChannel | null = null;
    let storeUnsubscribe: (() => void) | null = null;

    const stopRealtime = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const saveLatestBackup = async (userId: string) => {
      if (
        !readyRef.current ||
        conflictRef.current ||
        userIdRef.current !== userId
      ) {
        return;
      }
      if (syncingRef.current) {
        syncAgainRef.current = true;
        return;
      }

      syncingRef.current = true;
      setStatus('syncing');
      try {
        do {
          syncAgainRef.current = false;
          const backup = getLocalBackup();
          const signature = getBackupSignature(backup);
          if (signature === lastSyncedSignatureRef.current) continue;

          const { error } = await supabase
            .from('kronos_data')
            .upsert(
              {
                user_id: userId,
                data: backup,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
          if (error) throw error;

          lastSyncedSignatureRef.current = signature;
        } while (
          active &&
          readyRef.current &&
          !conflictRef.current &&
          userIdRef.current === userId &&
          (syncAgainRef.current ||
            getBackupSignature(getLocalBackup()) !==
              lastSyncedSignatureRef.current)
        );

        if (active && userIdRef.current === userId) setStatus('synced');
      } catch (error) {
        if (active) {
          setStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Cloud sync failed.'
          );
        }
      } finally {
        syncingRef.current = false;
      }
    };

    const scheduleSave = (userId: string) => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;
        void saveLatestBackup(userId);
      }, 700);
    };

    const applyRemoteBackup = (backup: AcademicBackupPayload) => {
      const result = useAcademicStore
        .getState()
        .importBackupJSON(JSON.stringify(backup));
      if (!result.ok) {
        throw new Error(result.error || 'Could not load cloud planner data.');
      }
      lastSyncedSignatureRef.current = getBackupSignature(backup);
    };

    const resolveConflict = async (choice: 'local' | 'remote') => {
      const currentConflict = conflictRef.current;
      const userId = userIdRef.current;
      if (!currentConflict || !userId) return;

      setErrorMessage('');
      setStatus('syncing');
      try {
        if (choice === 'remote') {
          applyRemoteBackup(currentConflict.remote);
        } else {
          const local = getLocalBackup();
          const { error } = await supabase.from('kronos_data').upsert(
            {
              user_id: userId,
              data: local,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (error) throw error;
          lastSyncedSignatureRef.current = getBackupSignature(local);
        }

        conflictRef.current = null;
        setConflict(null);
        readyRef.current = true;
        setStatus('synced');
        attachRealtime(userId);
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not resolve sync conflict.'
        );
      }
    };
    resolveConflictRef.current = resolveConflict;

    function attachRealtime(userId: string) {
      stopRealtime();
      channel = supabase
        .channel(`kronos-data-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kronos_data',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!active || userIdRef.current !== userId || !payload.new) return;
            const row = payload.new as { data?: unknown };
            let remote: AcademicBackupPayload;
            try {
              remote = parseRemoteBackup(row.data);
            } catch (error) {
              setStatus('error');
              setErrorMessage(
                error instanceof Error ? error.message : 'Invalid cloud data.'
              );
              return;
            }

            const local = getLocalBackup();
            const localSignature = getBackupSignature(local);
            const remoteSignature = getBackupSignature(remote);
            if (remoteSignature === localSignature || conflictRef.current) {
              return;
            }

            if (localSignature === lastSyncedSignatureRef.current) {
              try {
                applyRemoteBackup(remote);
                setStatus('synced');
              } catch (error) {
                setStatus('error');
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : 'Could not load cloud planner data.'
                );
              }
              return;
            }

            const nextConflict = { local, remote };
            conflictRef.current = nextConflict;
            readyRef.current = false;
            setConflict(nextConflict);
            setStatus('conflict');
            setIsOpen(true);
          }
        )
        .subscribe((subscriptionStatus) => {
          if (
            active &&
            subscriptionStatus === 'CHANNEL_ERROR' &&
            userIdRef.current === userId
          ) {
            setErrorMessage(
              'Realtime updates could not connect. Cloud saves still work; reload to fetch newer data.'
            );
          }
        });
    }

    const initializeSession = async (nextSession: Session) => {
      const userId = nextSession.user.id;
      if (userIdRef.current === userId) return;

      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      userIdRef.current = userId;
      readyRef.current = false;
      conflictRef.current = null;
      setConflict(null);
      setErrorMessage('');
      setStatus('loading');
      stopRealtime();

      const localBeforeLoad = getLocalBackup();
      const { data, error } = await supabase
        .from('kronos_data')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (!active || userIdRef.current !== userId) return;
      if (error) {
        userIdRef.current = null;
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      try {
        const local = getLocalBackup();
        if (!data) {
          const { error: saveError } = await supabase.from('kronos_data').upsert(
            {
              user_id: userId,
              data: local,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (saveError) throw saveError;
          lastSyncedSignatureRef.current = getBackupSignature(local);
        } else {
          const remote = parseRemoteBackup(data.data);
          const localHasData = hasPlannerData(local);
          const remoteHasData = hasPlannerData(remote);
          const localSignature = getBackupSignature(local);
          const remoteSignature = getBackupSignature(remote);
          const changedDuringLoad =
            getBackupSignature(localBeforeLoad) !== localSignature;

          if (
            localSignature !== remoteSignature &&
            ((localHasData && remoteHasData) || changedDuringLoad)
          ) {
            const nextConflict = { local, remote };
            conflictRef.current = nextConflict;
            setConflict(nextConflict);
            setStatus('conflict');
            setIsOpen(true);
            return;
          }

          if (localHasData && !remoteHasData) {
            const { error: saveError } = await supabase.from('kronos_data').upsert(
              {
                user_id: userId,
                data: local,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
            if (saveError) throw saveError;
            lastSyncedSignatureRef.current = localSignature;
          } else {
            if (remoteSignature !== localSignature) applyRemoteBackup(remote);
            else lastSyncedSignatureRef.current = remoteSignature;
          }
        }

        if (!active || userIdRef.current !== userId) return;
        readyRef.current = true;
        setStatus('synced');
        attachRealtime(userId);
      } catch (error) {
        userIdRef.current = null;
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not initialize cloud sync.'
        );
      }
    };
    retryConnectionRef.current = (nextSession) => {
      userIdRef.current = null;
      void initializeSession(nextSession);
    };

    const handleSession = (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);

      if (!nextSession) {
        userIdRef.current = null;
        readyRef.current = false;
        conflictRef.current = null;
        setConflict(null);
        setStatus('signedOut');
        stopRealtime();
        return;
      }

      window.setTimeout(() => {
        void initializeSession(nextSession);
      }, 0);
    };

    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession);
    });

    storeUnsubscribe = useAcademicStore.subscribe(() => {
      const userId = userIdRef.current;
      if (!userId || !readyRef.current || conflictRef.current) return;
      if (
        getBackupSignature(getLocalBackup()) ===
        lastSyncedSignatureRef.current
      ) {
        return;
      }
      scheduleSave(userId);
    });

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
      if (storeUnsubscribe) storeUnsubscribe();
      stopRealtime();
      resolveConflictRef.current = null;
      retryConnectionRef.current = null;
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setAuthMessage('');
    setErrorMessage('');
    setStatus('loading');
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setStatus('signedOut');
      setErrorMessage(result.error.message);
      return;
    }

    if (isSignUp && !result.data.session) {
      setStatus('signedOut');
      setAuthMessage('Check your email to confirm your account, then sign in.');
      setPassword('');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    if (readyRef.current && !(await syncNow())) return;
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(error.message);
  };

  const syncNow = async (): Promise<boolean> => {
    if (!supabase || !session) return false;
    if (!readyRef.current) {
      retryConnectionRef.current?.(session);
      return false;
    }
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const userId = session.user.id;
    if (syncingRef.current) {
      syncAgainRef.current = true;
      return false;
    }

    syncingRef.current = true;
    setStatus('syncing');
    setErrorMessage('');
    let savedSuccessfully = false;
    try {
      const backup = getLocalBackup();
      const { error } = await supabase.from('kronos_data').upsert(
        {
          user_id: userId,
          data: backup,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      lastSyncedSignatureRef.current = getBackupSignature(backup);
      savedSuccessfully = true;
      setStatus('synced');
      return true;
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Cloud sync failed.'
      );
      return false;
    } finally {
      syncingRef.current = false;
      if (
        savedSuccessfully &&
        readyRef.current &&
        !conflictRef.current &&
        getBackupSignature(getLocalBackup()) !==
          lastSyncedSignatureRef.current
      ) {
        syncTimerRef.current = window.setTimeout(() => {
          syncTimerRef.current = null;
          if (userIdRef.current === userId && readyRef.current) {
            void syncNow();
          }
        }, 700);
      }
    }
  };

  const statusLabel: Record<SyncStatus, string> = {
    unconfigured: 'Setup needed',
    signedOut: 'Sign in to sync',
    loading: 'Connecting…',
    synced: 'Synced',
    syncing: 'Syncing…',
    error: 'Sync issue',
    conflict: 'Resolve data conflict',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn"
        title={statusLabel[status]}
      >
        {status === 'loading' || status === 'syncing' ? (
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Cloud className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {session ? statusLabel[status] : 'Cloud Sync'}
        </span>
      </button>

      {isOpen && (
        <ModalShell
          title="Cloud Sync"
          subtitle="Keep your planner available across devices."
          onClose={() => setIsOpen(false)}
          width="max-w-md"
        >
          <div className="p-5 space-y-4 text-xs">
            {!supabase ? (
              <p className="text-muted">
                Supabase is not configured yet. Add the project URL and public
                anon key as <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> environment variables, then
                rebuild the app.
              </p>
            ) : conflict ? (
              <>
                <p className="text-muted">
                  This device and your Supabase account both have different
                  planner data. Choose which copy to keep. Choosing one replaces
                  the other; export a backup first if you need both.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() =>
                      void resolveConflictRef.current?.('local')
                    }
                  >
                    Keep this device
                  </button>
                  <button
                    type="button"
                    className="btn-solid"
                    onClick={() =>
                      void resolveConflictRef.current?.('remote')
                    }
                  >
                    Use cloud copy
                  </button>
                </div>
              </>
            ) : session ? (
              <>
                <p className="text-muted">
                  Signed in as <span className="text-fg">{session.user.email}</span>
                  . Your planner changes sync to your account.
                </p>
                <p className="text-muted">{statusLabel[status]}</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-soft"
                    disabled={status === 'syncing' || status === 'loading'}
                    onClick={() => void handleSignOut()}
                  >
                    Sign out
                  </button>
                  <button
                    type="button"
                    className="btn-solid"
                    disabled={status === 'syncing' || status === 'loading'}
                    onClick={() => void syncNow()}
                  >
                    {status === 'error' && !readyRef.current
                      ? 'Retry connection'
                      : 'Sync now'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="seg w-full">
                  <button
                    type="button"
                    className={`seg-item flex-1 ${!isSignUp ? 'is-active' : ''}`}
                    onClick={() => {
                      setIsSignUp(false);
                      setErrorMessage('');
                      setAuthMessage('');
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`seg-item flex-1 ${isSignUp ? 'is-active' : ''}`}
                    onClick={() => {
                      setIsSignUp(true);
                      setErrorMessage('');
                      setAuthMessage('');
                    }}
                  >
                    Create account
                  </button>
                </div>
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <div>
                    <label className="label" htmlFor="cloud-email">Email</label>
                    <input
                      id="cloud-email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="cloud-password">Password</label>
                    <input
                      id="cloud-password"
                      className="input"
                      type="password"
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      minLength={6}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  {authMessage && <p className="text-success">{authMessage}</p>}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-solid"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading'
                        ? 'Please wait…'
                        : isSignUp
                          ? 'Create account'
                          : 'Sign in'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {errorMessage && (
              <p role="alert" className="text-danger">
                {errorMessage}
              </p>
            )}
          </div>
        </ModalShell>
      )}
    </>
  );
};
