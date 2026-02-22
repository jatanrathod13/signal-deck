/**
 * MemoryPanel Component
 * Shared memory management UI with key-value listing, adding, and deleting
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Database,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { deleteMemory, getMemory, listMemory, setMemory } from '../lib/api';
import { cn } from '../lib/utils';

interface MemoryEntry {
  key: string;
  value: string | null;
}

interface MemoryPanelProps {
  className?: string;
}

export function MemoryPanel({ className }: MemoryPanelProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const selectedRequestIdRef = useRef(0);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newTtl, setNewTtl] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingValue, setIsLoadingValue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [filterText, setFilterText] = useState('');

  const fetchMemory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMemory();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const fetchSelectedValue = useCallback(
    async (key: string) => {
      const requestId = ++selectedRequestIdRef.current;
      setIsLoadingValue(true);
      setSelectedKey(key);
      try {
        const data = await getMemory(key);
        if (selectedRequestIdRef.current !== requestId) {
          return;
        }
        if (data) {
          setSelectedValue(String(data.value));
        } else {
          const entry = entries.find((e) => e.key === key);
          setSelectedValue(entry?.value || '');
        }
      } catch (_err) {
        if (selectedRequestIdRef.current !== requestId) {
          return;
        }
        const entry = entries.find((e) => e.key === key);
        setSelectedValue(entry?.value || '');
      } finally {
        if (selectedRequestIdRef.current === requestId) {
          setIsLoadingValue(false);
        }
      }
    },
    [entries]
  );

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newKey.trim()) {
      setError('Key is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const ttl = newTtl ? parseInt(newTtl, 10) : undefined;
      await setMemory(newKey.trim(), newValue, ttl);

      setSuccessMessage(`Entry "${newKey}" created`);
      setNewKey('');
      setNewValue('');
      setNewTtl('');

      await fetchMemory();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete "${key}"?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await deleteMemory(key);
      setSuccessMessage(`Entry "${key}" deleted`);

      if (selectedKey === key) {
        selectedRequestIdRef.current += 1;
        setSelectedKey(null);
        setSelectedValue(null);
        setIsLoadingValue(false);
      }

      await fetchMemory();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const entriesList = Array.isArray(entries) ? entries : [];
  const normalizedFilter = filterText.toLowerCase();
  const filteredEntries = entriesList.filter((entry) => {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    return key.toLowerCase().includes(normalizedFilter);
  });

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-teal-300/30 bg-teal-300/10 p-2">
            <Database className="h-4 w-4 text-teal-100" />
          </div>
          <div>
            <p className="kicker">Shared State</p>
            <h2 className="panel-title">Memory</h2>
          </div>
        </div>

        <button onClick={() => fetchMemory()} disabled={isLoading} className="btn-ghost rounded-xl px-3 py-2 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </span>
        </button>
      </header>

      <div className="glass-panel p-4">
        <h3 className="panel-title mb-3 text-sm">Add Memory Entry</h3>
        <form onSubmit={handleAddEntry} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
            <input
              type="text"
              placeholder="Key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="input-field"
              required
            />
            <input
              type="text"
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="input-field"
            />
            <input
              type="number"
              placeholder="TTL (sec)"
              value={newTtl}
              onChange={(e) => setNewTtl(e.target.value)}
              min="1"
              className="input-field"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn('btn-primary rounded-xl px-4 py-2 text-sm font-semibold', isSubmitting && 'opacity-60')}
            >
              <span className="inline-flex items-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-400">TTL is optional. Empty TTL uses the backend default.</p>
        </form>
      </div>

      {successMessage && (
        <div className="glass-panel flex items-center gap-2 border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="glass-panel flex items-center gap-2 border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by key..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {isLoading && (
        <div className="glass-panel flex items-center justify-center py-10 text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />
          Loading memory...
        </div>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="glass-panel p-8 text-center">
          <Database className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p className="font-medium text-slate-200">No memory entries yet</p>
          <p className="mt-1 text-sm text-slate-400">Create a key-value pair to populate shared memory.</p>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
              <Key className="h-4 w-4" />
              Keys ({filteredEntries.length})
            </div>
            <div className="stagger-list max-h-80 divide-y divide-white/5 overflow-y-auto">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.key}
                  onClick={() => fetchSelectedValue(entry.key)}
                  className={cn(
                    'surface-lift flex cursor-pointer items-center justify-between px-4 py-3 transition-colors',
                    'hover:bg-white/5',
                    selectedKey === entry.key && 'bg-white/10'
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-100">{entry.key}</p>
                    <p className="truncate text-xs text-slate-400">{entry.value ?? '(null)'}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(entry.key);
                    }}
                    className="rounded p-1 text-slate-400 transition-colors hover:text-rose-200"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
              <Clock className="h-4 w-4" />
              Value {selectedKey ? `- ${selectedKey}` : ''}
            </div>
            <div className="p-4">
              {isLoadingValue ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
                </div>
              ) : selectedKey ? (
                <pre className="code-block max-h-72 overflow-y-auto whitespace-pre-wrap break-all p-3 text-sm">
                  {selectedValue}
                </pre>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <Database className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                  <p className="text-sm">Select a key to inspect its value</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MemoryPanel;
