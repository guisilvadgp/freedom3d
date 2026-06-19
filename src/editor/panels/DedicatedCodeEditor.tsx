import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FileCode, Sparkles, Save, Code, Wand2, Check 
} from 'lucide-react';

interface ScriptItem {
  entityId: string;
  entityName: string;
  scriptId: string;
  scriptName: string;
  code: string;
  isAdditional?: boolean;
}

export function DedicatedCodeEditor() {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [currentScriptName, setCurrentScriptName] = useState('');
  
  // IA State
  const [prompt, setPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPanel] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('pollinations_api_key') || '');
  const [models, setModels] = useState<{ id: string; type?: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('openai');
  const [loadingModels, setLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('pollinations_api_key', val);
  };

  const fetchModels = async (key: string) => {
    if (!key) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      };
      const response = await fetch('https://gen.pollinations.ai/v1/models', {
        headers
      });
      if (response.ok) {
        const json = await response.json();
        const chatModels = (json.data || []).filter((m: any) => {
          const id = m.id.toLowerCase();
          return !id.includes('flux') && !id.includes('diffusion') && !id.includes('dall-e') && !id.includes('midjourney') && !id.includes('audio') && !id.includes('tts') && !id.includes('whisper');
        });
        setModels(chatModels);
        
        if (chatModels.length > 0 && !chatModels.some((m: any) => m.id === selectedModel)) {
          setSelectedModel(chatModels[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar modelos:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      fetchModels(apiKey);
    } else {
      setModels([]);
    }
  }, [apiKey]);
  
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel('freedom3d-editor-sync');
    channelRef.current = channel;

    // Pedir dados iniciais
    channel.postMessage({ type: 'REQUEST_INITIAL_DATA' });

    const handleMessage = (event: MessageEvent) => {
      const { type, scriptsList, currentScript } = event.data;
      if (type === 'INITIAL_DATA') {
        setScripts(scriptsList || []);
        
        // Se houver script na URL
        const params = new URLSearchParams(window.location.search);
        const urlEntityId = params.get('entityId');
        const urlScriptId = params.get('scriptId') || 'main';
        
        if (urlEntityId) {
          const target = (scriptsList || []).find((s: ScriptItem) => s.entityId === urlEntityId && s.scriptId === urlScriptId);
          if (target) {
            setSelectedEntityId(target.entityId);
            setSelectedScriptId(target.scriptId);
            setCurrentCode(target.code);
            setCurrentScriptName(target.scriptName);
            return;
          }
        }

        if (currentScript) {
          setSelectedEntityId(currentScript.entityId);
          setSelectedScriptId(currentScript.scriptId || 'main');
          setCurrentCode(currentScript.code);
          setCurrentScriptName(currentScript.scriptName);
        } else if (scriptsList && scriptsList.length > 0) {
          setSelectedEntityId(scriptsList[0].entityId);
          setSelectedScriptId(scriptsList[0].scriptId);
          setCurrentCode(scriptsList[0].code);
          setCurrentScriptName(scriptsList[0].scriptName);
        }
      } else if (type === 'SCRIPT_UPDATED_IN_EDITOR') {
        setScripts(prev => prev.map(s => {
          if (s.entityId === event.data.entityId && s.scriptId === event.data.scriptId) {
            if (selectedEntityId === event.data.entityId && selectedScriptId === event.data.scriptId) {
              setCurrentCode(event.data.code);
            }
            return { ...s, code: event.data.code };
          }
          return s;
        }));
      }
    };

    channel.addEventListener('message', handleMessage);

    // Periodicamente pedir dados se nada for carregado
    const checkInterval = setInterval(() => {
      if (scripts.length === 0) {
        channel.postMessage({ type: 'REQUEST_INITIAL_DATA' });
      }
    }, 2000);

    return () => {
      channel.removeEventListener('message', handleMessage);
      clearInterval(checkInterval);
      channel.close();
    };
  }, [selectedEntityId, selectedScriptId, scripts.length]);

  const handleSelectScript = (entityId: string, scriptId: string) => {
    const script = scripts.find(s => s.entityId === entityId && s.scriptId === scriptId);
    if (script) {
      setSelectedEntityId(entityId);
      setSelectedScriptId(scriptId);
      setCurrentCode(script.code);
      setCurrentScriptName(script.scriptName);
    }
  };

  const handleSave = () => {
    if (!selectedEntityId || !selectedScriptId) return;
    
    setSaveStatus('saving');
    
    // Atualiza a lista local
    setScripts(prev => prev.map(s => {
      if (s.entityId === selectedEntityId && s.scriptId === selectedScriptId) {
        return { ...s, code: currentCode, scriptName: currentScriptName };
      }
      return s;
    }));

    // Avisa a janela principal para atualizar a store
    channelRef.current?.postMessage({
      type: 'UPDATE_SCRIPT',
      entityId: selectedEntityId,
      scriptId: selectedScriptId,
      patch: {
        code: currentCode,
        scriptName: currentScriptName
      }
    });

    // Enviar mensagem de salvamento da cena para persistência no disco
    channelRef.current?.postMessage({
      type: 'SAVE_PROJECT_SCENE'
    });

    setSaveStatus('saved');
    
    // Voltar para o estado normal após 2 segundos
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  const handleGenerateAI = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setAiResponse('');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { 
              role: 'system', 
              content: 'Você é um assistente de IA especialista em programação para o motor de jogo Freedom3D (que usa Three.js e React). Crie scripts Javascript compatíveis com as funções onAwake() e onUpdate(delta). Retorne SOMENTE o código JavaScript puro, sem explicações ou introduções. Apenas o código JavaScript pronto.' 
            },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!response.ok) throw new Error('Falha na resposta da API');
      const data = await response.text();
      // Remover blocos de código markdown se gerados
      const cleanedCode = data.replace(/^```javascript\n|^```js\n|^```\n|```$/g, '');
      setAiResponse(cleanedCode.trim());
    } catch (err) {
      setAiResponse('Erro ao gerar código: ' + String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAiCode = () => {
    if (!aiResponse) return;
    setCurrentCode(aiResponse);
  };

  return (
    <div className="dedicated-editor-root">
      {/* Header */}
      <header className="dedicated-editor-header">
        <div className="header-left">
          <Code className="logo-icon" size={18} />
          <h1>Freedom3D Script Editor</h1>
          <span className="editor-badge">Unity Mode</span>
        </div>
        <div className="header-actions">
          <button 
            className={`editor-save-btn ${saveStatus === 'saved' ? 'success' : ''}`} 
            onClick={handleSave} 
            disabled={!selectedEntityId || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' && <span>Salvando...</span>}
            {saveStatus === 'saved' && (
              <>
                <Check size={14} /> Salvo!
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <Save size={14} /> Salvar e Sincronizar
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Panel Area */}
      <div className="dedicated-editor-body">
        {/* Left Sidebar: Scripts List */}
        <aside className="dedicated-editor-sidebar">
          <div className="sidebar-section-title">Scripts na Cena</div>
          <div className="scripts-list">
            {scripts.map(s => (
              <button 
                key={`${s.entityId}-${s.scriptId}`} 
                className={`script-item-btn ${selectedEntityId === s.entityId && selectedScriptId === s.scriptId ? 'active' : ''}`}
                onClick={() => handleSelectScript(s.entityId, s.scriptId)}
              >
                <FileCode size={14} style={{ color: s.isAdditional ? '#10b981' : 'inherit' }} />
                <span className="script-name">
                  {s.entityName} / {s.scriptName}.js {s.isAdditional && <span style={{ fontSize: '8px', opacity: 0.6, background: '#10b981', color: 'black', padding: '1px 3px', borderRadius: '2px', marginLeft: '4px' }}>ADD</span>}
                </span>
              </button>
            ))}
            {scripts.length === 0 && (
              <div className="no-scripts-hint">Nenhum script na cena. Crie ou selecione uma entidade no editor e adicione um ScriptComponent.</div>
            )}
          </div>
        </aside>

        {/* Center: Monaco Editor */}
        <main className="dedicated-editor-main">
          {selectedEntityId ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="editor-toolbar-bar">
                <span className="file-info-label">Editando: {currentScriptName}.js</span>
                <div className="rename-script-wrapper">
                  <label>Nome do Script:</label>
                  <input 
                    type="text" 
                    value={currentScriptName} 
                    onChange={(e) => setCurrentScriptName(e.target.value)} 
                  />
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={currentCode}
                  onChange={(v) => setCurrentCode(v || '')}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    formatOnPaste: true,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="no-script-selected-pane">
              <Code size={48} style={{ opacity: 0.2 }} />
              <p>Selecione um script na barra lateral para começar a editar.</p>
            </div>
          )}
        </main>

        {/* Right Sidebar: Pollinations AI */}
        {showAiPanel && (
          <aside className="dedicated-editor-ai-panel">
            <div className="ai-panel-header">
              <Sparkles size={16} className="ai-icon" />
              <h2>Assistente IA (Pollinations)</h2>
            </div>
            <div className="ai-key-section" style={{ padding: '0 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Chave de API Pollinations (Opcional):</label>
              <input 
                type="password" 
                placeholder="sk_..."
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-bright)',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  outline: 'none'
                }}
              />
            </div>
            {apiKey && (
              <div className="ai-key-section" style={{ padding: '0 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Modelo de IA:</label>
                {loadingModels ? (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Carregando modelos...</span>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-bright)',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      outline: 'none',
                      width: '100%'
                    }}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                    {models.length === 0 && (
                      <option value="openai">openai (Padrão)</option>
                    )}
                  </select>
                )}
              </div>
            )}
            <div className="ai-panel-body">
              <textarea 
                className="ai-prompt-input"
                placeholder="Ex: Crie um script para rotacionar o objeto suavemente e fazê-lo subir e descer como se estivesse flutuando..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button 
                className="ai-generate-btn" 
                onClick={handleGenerateAI}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <span>Gerando Código...</span>
                ) : (
                  <>
                    <Wand2 size={14} /> Gerar com IA
                  </>
                )}
              </button>

              {aiResponse && (
                <div className="ai-response-container">
                  <div className="ai-response-header">
                    <span>Sugestão da IA</span>
                    <button className="apply-ai-btn" onClick={handleApplyAiCode}>
                      Aplicar no Editor
                    </button>
                  </div>
                  <pre className="ai-response-pre">
                    <code>{aiResponse}</code>
                  </pre>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
