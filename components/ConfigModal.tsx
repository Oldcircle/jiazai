
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { ModelConfig, ProviderType, Language } from '../types';
import { getTranslation } from '../utils/translations';

interface ConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    configs: ModelConfig[];
    activeConfigId: string;
    onSave: (configs: ModelConfig[], activeId: string) => void;
    currentLang: Language;
    onLanguageChange: (lang: Language) => void;
}

const DEFAULT_PROVIDERS: Record<ProviderType, { baseUrl: string, defaultModel: string, label: string }> = {
    'google': { baseUrl: '', defaultModel: 'gemini-3-flash-preview', label: 'Google (Gemini)' },
    'openai': { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', label: 'OpenAI (GPT)' },
    'deepseek': { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', label: 'DeepSeek' },
    'anthropic': { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-sonnet-20240620', label: 'Anthropic (Claude)' },
    'ollama': { baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3', label: 'Ollama (Local)' },
    'custom': { baseUrl: '', defaultModel: '', label: 'Custom / Other' }
};

export const ConfigModal: React.FC<ConfigModalProps> = ({ 
    isOpen, onClose, configs, activeConfigId, onSave, currentLang, onLanguageChange 
}) => {
    const t = getTranslation(currentLang);
    const [localConfigs, setLocalConfigs] = useState<ModelConfig[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');
    const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null);

    // Sync props to local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalConfigs(JSON.parse(JSON.stringify(configs)));
            setSelectedConfigId(activeConfigId);
        }
    }, [isOpen, configs, activeConfigId]);

    // Update editing form when selection changes
    useEffect(() => {
        const found = localConfigs.find(c => c.id === selectedConfigId);
        if (found) {
            setEditingConfig({ ...found });
        }
    }, [selectedConfigId, localConfigs]);

    const handleAdd = () => {
        const newId = Date.now().toString();
        const newConfig: ModelConfig = {
            id: newId,
            name: 'New Config',
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            modelName: 'gpt-4o'
        };
        setLocalConfigs(prev => [...prev, newConfig]);
        setSelectedConfigId(newId);
    };

    const handleDelete = (id: string) => {
        if (localConfigs.length <= 1) return; // Prevent deleting last config
        if (!confirm(t.confirmDelete)) return;
        
        const newConfigs = localConfigs.filter(c => c.id !== id);
        setLocalConfigs(newConfigs);
        if (id === selectedConfigId) {
            setSelectedConfigId(newConfigs[0].id);
        }
    };

    const handleFieldChange = (field: keyof ModelConfig, value: string) => {
        if (!editingConfig) return;
        
        const updated = { ...editingConfig, [field]: value };
        
        // Auto-fill defaults if provider changes
        if (field === 'provider') {
            const defaults = DEFAULT_PROVIDERS[value as ProviderType];
            if (defaults) {
                updated.baseUrl = defaults.baseUrl;
                updated.modelName = defaults.defaultModel;
            }
        }

        setEditingConfig(updated);
        
        // Update list immediately for "name" changes to reflect in sidebar
        setLocalConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
    };

    const handleSave = () => {
        onSave(localConfigs, selectedConfigId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl h-[600px] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row text-neutral-800 font-sans">
                
                {/* SIDEBAR */}
                <div className="w-full md:w-1/3 bg-neutral-50 border-r border-neutral-200 flex flex-col">
                    <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-100">
                        <span className="font-bold text-sm text-neutral-700">{t.configList}</span>
                        <button 
                            onClick={handleAdd}
                            className="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-colors text-lg leading-none pb-1"
                        >
                            +
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {localConfigs.map(config => (
                            <div 
                                key={config.id}
                                onClick={() => setSelectedConfigId(config.id)}
                                className={`p-3 rounded cursor-pointer transition-all border-l-4 ${
                                    selectedConfigId === config.id 
                                    ? 'bg-white border-blue-500 shadow-sm' 
                                    : 'border-transparent hover:bg-neutral-100'
                                }`}
                            >
                                <div className="font-bold text-sm text-neutral-800 truncate">{config.name}</div>
                                <div className="text-xs text-neutral-500 truncate">{config.provider}</div>
                            </div>
                        ))}
                    </div>

                    {/* Language Switcher in Sidebar Footer */}
                    <div className="p-4 border-t border-neutral-200 bg-neutral-100 flex justify-center gap-2">
                         <button 
                            onClick={() => onLanguageChange('en')}
                            className={`px-3 py-1 text-xs font-bold rounded ${currentLang === 'en' ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-600 border'}`}
                         >
                            EN
                         </button>
                         <button 
                            onClick={() => onLanguageChange('zh')}
                            className={`px-3 py-1 text-xs font-bold rounded ${currentLang === 'zh' ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-600 border'}`}
                         >
                            中文
                         </button>
                    </div>
                </div>

                {/* MAIN FORM */}
                <div className="w-full md:w-2/3 bg-white flex flex-col">
                    <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <h2 className="font-bold text-lg text-neutral-800">
                             {t.configName}: {editingConfig?.name}
                        </h2>
                    </div>

                    {editingConfig ? (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Name Input */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{t.configName}</label>
                                <input 
                                    type="text" 
                                    value={editingConfig.name}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    className="w-full px-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Provider Select */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{t.provider}</label>
                                <div className="relative">
                                    <select 
                                        value={editingConfig.provider}
                                        onChange={(e) => handleFieldChange('provider', e.target.value)}
                                        className="w-full px-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white text-sm"
                                    >
                                        {Object.entries(DEFAULT_PROVIDERS).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>

                            {/* API Key */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{t.apiKey}</label>
                                <input 
                                    type="password" 
                                    value={editingConfig.apiKey}
                                    onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                                    placeholder={t.apiKeyPlaceholder}
                                    className="w-full px-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm tracking-tighter"
                                />
                                <p className="text-[10px] text-neutral-400">{t.apiKeyPlaceholder}</p>
                            </div>

                            {/* Base URL */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{t.baseUrl}</label>
                                <input 
                                    type="text" 
                                    value={editingConfig.baseUrl}
                                    onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full px-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm text-neutral-600"
                                />
                            </div>

                            {/* Model Name */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">{t.modelName}</label>
                                <input 
                                    type="text" 
                                    value={editingConfig.modelName}
                                    onChange={(e) => handleFieldChange('modelName', e.target.value)}
                                    className="w-full px-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                                />
                            </div>

                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
                            Select a config to edit
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-neutral-100 flex justify-between items-center bg-neutral-50">
                         <button 
                            onClick={() => handleDelete(selectedConfigId)}
                            className="px-4 py-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded text-sm font-medium transition-colors"
                         >
                            {t.delete}
                         </button>

                         <div className="flex gap-3">
                            <button 
                                onClick={onClose}
                                className="px-4 py-2 text-neutral-600 hover:bg-neutral-200 rounded text-sm font-medium border border-neutral-300 bg-white transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-6 py-2 bg-[#09090b] text-white hover:bg-neutral-800 rounded text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                {t.saveAndClose}
                            </button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
