import { useState } from 'react';
import type { LLMConfig } from '../../../shared/types';

interface ConfigProps {
  config: LLMConfig | null;
  onSave: (config: LLMConfig) => void;
  onCancel: () => void;
}

export default function Config({ config, onSave, onCancel }: ConfigProps) {
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'glm' | 'custom'>(config?.provider || 'openai');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [endpoint, setEndpoint] = useState(config?.endpoint || '');
  const [model, setModel] = useState(config?.model || 'gpt-4o-mini');
  const [maxTokens, setMaxTokens] = useState(config?.maxTokens || 2048);
  const [temperature, setTemperature] = useState(config?.temperature || 0.7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      alert('API key is required');
      return;
    }
    onSave({
      provider,
      apiKey: apiKey.trim(),
      endpoint: endpoint.trim() || undefined,
      model,
      maxTokens,
      temperature
    });
  };

  const defaultModels: Record<string, string[]> = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    glm: ['glm-5', 'glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-3-turbo'],
    custom: []
  };

  const handleProviderChange = (newProvider: 'openai' | 'anthropic' | 'glm' | 'custom') => {
    setProvider(newProvider);
    const models = defaultModels[newProvider];
    if (models.length > 0) {
      setModel(models[0]);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">LLM Configuration</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'anthropic' | 'glm' | 'custom')}
            className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="glm">GLM (智谱AI)</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'glm' ? 'Enter your GLM API key from bigmodel.cn' : 'Enter your API key'}
            className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          {provider === 'glm' && (
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from <a href="https://bigmodel.cn/usercenter/proj-mgmt/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">bigmodel.cn</a>
            </p>
          )}
        </div>

        {provider === 'custom' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Custom Endpoint</label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1/chat/completions"
              className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Model</label>
          {provider !== 'custom' ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {defaultModels[provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model-name"
              className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              min={100}
              max={32000}
              className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Temperature</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              min={0}
              max={2}
              step={0.1}
              className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
