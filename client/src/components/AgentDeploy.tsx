/**
 * AgentDeploy Component
 * Form for deploying new agents
 */
import { useState } from 'react';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { useDeployAgent } from '../hooks/useAgents';
import { cn } from '../lib/utils';

const agentTypes = [
  { value: 'worker', label: 'Worker Agent' },
  { value: 'coordinator', label: 'Coordinator Agent' },
  { value: 'monitor', label: 'Monitor Agent' },
  { value: 'processor', label: 'Processor Agent' },
];

interface DeployFormData {
  name: string;
  type: string;
  config: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  config?: string;
}

interface AgentDeployProps {
  className?: string;
  onSuccess?: () => void;
}

export function AgentDeploy({ className, onSuccess }: AgentDeployProps) {
  const [formData, setFormData] = useState<DeployFormData>({
    name: '',
    type: '',
    config: '{}',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const deployAgent = useDeployAgent();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Agent name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Agent name must be less than 50 characters';
    }

    if (!formData.type) {
      newErrors.type = 'Agent type is required';
    }

    try {
      JSON.parse(formData.config);
    } catch {
      newErrors.config = 'Invalid JSON format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);

    if (!validateForm()) {
      return;
    }

    try {
      const parsedConfig = JSON.parse(formData.config);
      await deployAgent.mutateAsync({
        name: formData.name.trim(),
        type: formData.type,
        config: parsedConfig,
      });

      setFormData({ name: '', type: '', config: '{}' });
      setSubmitSuccess(true);
      onSuccess?.();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to deploy agent:', error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const isSubmitting = deployAgent.isPending;

  return (
    <section className={cn('glass-panel p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Provisioning</p>
          <h2 className="panel-title">Deploy Agent</h2>
        </div>
        <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-2">
          <Plus className="h-4 w-4 text-cyan-200" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {submitSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
            <CheckCircle className="h-4 w-4" />
            Agent deployed successfully
          </div>
        )}

        {deployAgent.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">
            <AlertCircle className="h-4 w-4" />
            {deployAgent.error?.message || 'Failed to deploy agent'}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="research-agent"
              disabled={isSubmitting}
              className={cn('input-field', errors.name && 'border-rose-400/60 text-rose-100')}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-300">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Type
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className={cn('input-field', errors.type && 'border-rose-400/60 text-rose-100')}
            >
              <option value="">Select agent type</option>
              {agentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.type && <p className="mt-1 text-xs text-rose-300">{errors.type}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="config" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
            Configuration JSON
          </label>
          <textarea
            id="config"
            name="config"
            value={formData.config}
            onChange={handleInputChange}
            placeholder='{"model":"gpt-4.1"}'
            rows={4}
            disabled={isSubmitting}
            className={cn('input-field font-mono text-sm', errors.config && 'border-rose-400/60 text-rose-100')}
          />
          {errors.config && <p className="mt-1 text-xs text-rose-300">{errors.config}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
            isSubmitting && 'cursor-not-allowed opacity-60'
          )}
        >
          <Plus className="h-4 w-4" />
          {isSubmitting ? 'Deploying...' : 'Deploy Agent'}
        </button>
      </form>
    </section>
  );
}

export default AgentDeploy;
