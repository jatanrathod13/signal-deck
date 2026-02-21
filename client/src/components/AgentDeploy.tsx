/**
 * AgentDeploy Component
 * Form for deploying new agents
 */
import { useState } from 'react';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { useDeployAgent } from '../hooks/useAgents';
import { cn } from '../lib/utils';

// Common agent types
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

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Agent name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Agent name must be less than 50 characters';
    }

    // Validate type
    if (!formData.type) {
      newErrors.type = 'Agent type is required';
    }

    // Validate config JSON
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

      // Reset form on success
      setFormData({
        name: '',
        type: '',
        config: '{}',
      });
      setSubmitSuccess(true);
      onSuccess?.();

      // Clear success message after 3 seconds
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

    // Clear error when user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const isSubmitting = deployAgent.isPending;

  return (
    <div className={cn(
      'bg-[#1e1e1e] rounded-lg border border-[#2a2a2a] p-6 carbon-overlay card-reveal speed-lines',
      'hover:border-[#ff2800]/40 transition-all duration-300',
      className
    )}>
      {/* Racing stripe accent */}
      <div className="h-0.5 bg-gradient-to-r from-[#ff2800] via-[#ffcc00] to-[#ff2800] rounded-full mb-4 opacity-60" />

      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-[#ff2800]" />
        <h2 className="text-lg font-semibold text-white">Deploy New Driver</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Success Message */}
        {submitSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-md glow-green">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-400 font-medium">
              Agent deployed successfully!
            </span>
          </div>
        )}

        {/* Error Message */}
        {deployAgent.isError && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-md glow-red">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400 font-medium">
              {deployAgent.error?.message || 'Failed to deploy agent'}
            </span>
          </div>
        )}

        {/* Name Field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Driver Name <span className="text-[#ff2800]">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="my-agent"
            disabled={isSubmitting}
            className={cn(
              'w-full px-3 py-2 border rounded-md text-sm bg-[#0a0a0a] text-white',
              'focus:outline-none focus:ring-2 focus:ring-[#ff2800] focus:border-transparent',
              'disabled:bg-[#1a1a1a] disabled:cursor-not-allowed',
              'placeholder:text-gray-600',
              errors.name
                ? 'border-red-500 text-red-400 placeholder-red-300 focus:ring-red-500'
                : 'border-[#2a2a2a]'
            )}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-400">{errors.name}</p>
          )}
        </div>

        {/* Type Field */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Agent Type <span className="text-[#ff2800]">*</span>
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className={cn(
              'w-full px-3 py-2 border rounded-md text-sm bg-[#0a0a0a] text-white',
              'focus:outline-none focus:ring-2 focus:ring-[#ff2800] focus:border-transparent',
              'disabled:bg-[#1a1a1a] disabled:cursor-not-allowed',
              errors.type
                ? 'border-red-500 text-red-400 focus:ring-red-500'
                : 'border-[#2a2a2a]'
            )}
          >
            <option value="">Select agent type</option>
            {agentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className="mt-1 text-xs text-red-400">{errors.type}</p>
          )}
        </div>

        {/* Config Field */}
        <div>
          <label
            htmlFor="config"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Configuration (JSON)
          </label>
          <textarea
            id="config"
            name="config"
            value={formData.config}
            onChange={handleInputChange}
            placeholder='{"key": "value"}'
            rows={4}
            disabled={isSubmitting}
            className={cn(
              'w-full px-3 py-2 border rounded-md text-sm font-mono bg-[#0a0a0a] text-white',
              'focus:outline-none focus:ring-2 focus:ring-[#ff2800] focus:border-transparent',
              'disabled:bg-[#1a1a1a] disabled:cursor-not-allowed',
              'placeholder:text-gray-600',
              errors.config
                ? 'border-red-500 text-red-400 placeholder-red-300 focus:ring-red-500'
                : 'border-[#2a2a2a]'
            )}
          />
          {errors.config && (
            <p className="mt-1 text-xs text-red-400">{errors.config}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Optional. Enter valid JSON configuration for the agent.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2',
            'bg-gradient-to-r from-[#ff2800] to-[#cc2000] text-white rounded-md text-sm font-semibold',
            'hover:from-[#ff4000] hover:to-[#ff2800]',
            'focus:outline-none focus:ring-2 focus:ring-[#ff2800] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]',
            'disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed',
            'transition-all duration-200',
            'btn-ferrari btn-ferrari-primary glow-red'
          )}
        >
          {isSubmitting ? (
            <>
              <div className="tachometer-spinner w-4 h-4" />
              Deploying...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Deploy Agent
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default AgentDeploy;
