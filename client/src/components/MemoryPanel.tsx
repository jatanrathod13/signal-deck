/**
 * MemoryPanel Component
 * Shared memory management UI with key-value listing, adding, and deleting
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Key,
  Clock,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { listMemory, setMemory, deleteMemory, getMemory } from '../lib/api';
import { cn } from '../lib/utils';

interface MemoryEntry {
  key: string;
  value: string;
}

interface MemoryPanelProps {
  className?: string;
}

export function MemoryPanel({ className }: MemoryPanelProps) {
  // State for memory entries
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  // Form state for adding new entries
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newTtl, setNewTtl] = useState('');

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingValue, setIsLoadingValue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [filterText, setFilterText] = useState('');

  // Fetch all memory keys
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

  // Fetch memory on mount
  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  // Fetch selected key's full value
  const fetchSelectedValue = useCallback(async (key: string) => {
    setIsLoadingValue(true);
    setSelectedKey(key);
    try {
      const data = await getMemory(key);
      if (data) {
        setSelectedValue(String(data.value));
      } else {
        // Find in local entries as fallback
        const entry = entries.find((e) => e.key === key);
        setSelectedValue(entry?.value || '');
      }
    } catch (_err) {
      // Fallback to local value if API fails
      const entry = entries.find((e) => e.key === key);
      setSelectedValue(entry?.value || '');
    } finally {
      setIsLoadingValue(false);
    }
  }, [entries]);

  // Handle adding new memory entry
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

      setSuccessMessage(`Entry "${newKey}" created successfully`);
      setNewKey('');
      setNewValue('');
      setNewTtl('');

      // Refresh the list
      await fetchMemory();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a memory entry
  const handleDelete = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await deleteMemory(key);
      setSuccessMessage(`Entry "${key}" deleted successfully`);

      // Clear selection if deleted entry was selected
      if (selectedKey === key) {
        setSelectedKey(null);
        setSelectedValue(null);
      }

      // Refresh the list
      await fetchMemory();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  // Ensure entries is always an array before filtering
  const entriesList = Array.isArray(entries) ? entries : [];

  // Filter entries by key
  const filteredEntries = entriesList.filter((entry) =>
    entry.key.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Shared Memory</h2>
        </div>

        <button
          onClick={() => fetchMemory()}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
            'bg-gray-50 text-gray-700 hover:bg-gray-100',
            'transition-colors duration-200',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Add New Entry Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add New Entry
        </h3>
        <form onSubmit={handleAddEntry} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-md border text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
                required
              />
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-md border text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
              />
            </div>
            <div className="w-24">
              <input
                type="number"
                placeholder="TTL (sec)"
                value={newTtl}
                onChange={(e) => setNewTtl(e.target.value)}
                min="1"
                className={cn(
                  'w-full px-3 py-2 rounded-md border text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                'bg-gray-900 text-white hover:bg-gray-800',
                'transition-colors duration-200',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500">
            TTL is optional. Leave empty for default 1-hour expiration.
          </p>
        </form>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-green-800 text-sm">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-800 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by key..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className={cn(
            'w-full pl-10 pr-3 py-2 rounded-md border text-sm',
            'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
            'placeholder:text-gray-400'
          )}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Loading memory...</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && entries.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Failed to load memory</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchMemory()}
            className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && entries.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No memory entries</p>
          <p className="text-gray-500 text-sm mt-1">
            Add a new key-value pair above to get started
          </p>
        </div>
      )}

      {/* Memory List */}
      {!isLoading && entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Keys List */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Keys ({filteredEntries.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.key}
                  onClick={() => fetchSelectedValue(entry.key)}
                  className={cn(
                    'px-4 py-3 flex items-center justify-between cursor-pointer',
                    'hover:bg-gray-50 transition-colors duration-150',
                    selectedKey === entry.key && 'bg-gray-100'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-900 truncate">{entry.key}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(entry.key);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-150"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Value Display */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Value
                {selectedKey && <span className="text-gray-500">- {selectedKey}</span>}
              </h3>
            </div>
            <div className="p-4">
              {isLoadingValue ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : selectedKey ? (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap break-all bg-gray-50 rounded p-3 max-h-72 overflow-y-auto">
                  {selectedValue}
                </pre>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">Select a key to view its value</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryPanel;
