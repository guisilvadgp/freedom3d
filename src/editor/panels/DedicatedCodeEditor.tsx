import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FileCode, Sparkles, Save, Code, Wand2, Check, Plus, Trash2
} from 'lucide-react';

interface ScriptItem {
  entityId: string;
  entityName: string;
  scriptId: string;
  scriptName: string;
  code: string;
  isAdditional?: boolean;
  variables?: any[];
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
    setLoadingModels(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }
      const response = await fetch('https://gen.pollinations.ai/v1/models', {
        headers
      });
      if (response.ok) {
        const json = await response.json();
        const chatModels = (json.data || []).filter((m: any) => {
          const id = m.id.toLowerCase();
          return !id.includes('flux') && !id.includes('diffusion') && !id.includes('dall-e') && !id.includes('midjourney') && !id.includes('audio') && !id.includes('tts') && !id.includes('whisper');
        });
        
        if (chatModels.length === 0) {
          setModels([
            { id: 'openai' },
            { id: 'mistral' },
            { id: 'qwen' }
          ]);
        } else {
          setModels(chatModels);
        }
        
        if (chatModels.length > 0 && !chatModels.some((m: any) => m.id === selectedModel)) {
          setSelectedModel(chatModels[0].id);
        }
      } else {
        setModels([
          { id: 'openai' },
          { id: 'mistral' },
          { id: 'qwen' }
        ]);
      }
    } catch (err) {
      console.error('Erro ao buscar modelos:', err);
      setModels([
        { id: 'openai' },
        { id: 'mistral' },
        { id: 'qwen' }
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModels(apiKey);
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
      // Coleta o script selecionado atualmente para passar seu contexto
      const activeScript = scripts.find(s => s.entityId === selectedEntityId && s.scriptId === selectedScriptId);
      
      // Constrói uma descrição de todas as entidades e scripts na cena para dar contexto do projeto à IA
      const sceneContext = scripts.map(s => {
        const varsText = (s.variables && s.variables.length > 0)
          ? ` (variáveis: ${s.variables.map((v: any) => `${v.name} [tipo: ${v.type}, valor: ${v.value || 'vazio'}]`).join(', ')})`
          : '';
        return `- Entidade: "${s.entityName}" / Script: "${s.scriptName}.js" (id: ${s.scriptId})${varsText}`;
      }).join('\n');

      const systemPrompt = `Você é um assistente de IA especialista em programação para o motor de jogo Freedom3D (que usa Three.js, React e Rapier Physics). 
Crie scripts Javascript compatíveis com as funções onAwake() e onUpdate(delta). 

API e Regras de Scripting Cruciais do Freedom3D:
1. ARQUITETURA ECS: A variável global 'entity' é apenas um objeto de dados JSON contendo as definições dos componentes (ex: 'entity.components.Transform', 'entity.components.MeshRenderer'). Mutações diretas na 'entity' (como 'entity.material = ...' ou 'entity.components.Transform.position = ...') NÃO FUNCIONAM e quebram a reatividade do motor.
2. COMO MUTAR COMPONENTES (OBRIGATÓRIO): Para atualizar propriedades de componentes da entidade (como cor, posição, luz, etc.), use SEMPRE a função utilitária global:
   updateComponent(entityId, componentName, updatedData)
   Exemplos:
   - Trocar a cor de um cubo/malha:
     updateComponent(entity.id, 'MeshRenderer', { color: '#ff0000' });
   - Ativar material emissivo (neon) e brilhar com alta intensidade:
     updateComponent(entity.id, 'MeshRenderer', { material: 'emissive', color: '#00ffff', emissiveIntensity: 5.0 });
   - Mover um objeto sem física (manual):
     updateComponent(entity.id, 'Transform', { position: [x, y, z] });
   - Alterar rotação de um objeto:
     updateComponent(entity.id, 'Transform', { rotation: [rx, ry, rz] });
   - Alterar intensidade/cor de uma luz:
     updateComponent(entity.id, 'Light', { intensity: 2.5, color: '#00ff00' });
3. FÍSICA (RAPIER): Se a entidade tiver um componente RigidBody e o jogo estiver rodando, a variável global 'rigidBody' (instância do Rapier) estará disponível. Use os métodos do Rapier para aplicar forças ou mover por física:
   - Mover/Teleportar fisicamente:
     rigidBody.setTranslation({ x: 1, y: 2, z: 3 }, true);
   - Aplicar velocidade linear:
     rigidBody.setLinvel({ x: 0, y: 5, z: 0 }, true);
   NUNCA use updateComponent para mover uma entidade dinâmica física, use sempre o 'rigidBody'.
4. INPUT: Use o objeto global 'Input' para verificar entradas (ex: 'Input.isKeyPressed("KeyW")', 'Input.isMouseButtonPressed(0)').
5. VARIÁVEIS DO INSPECTOR: Variáveis declaradas no painel são injetadas automaticamente no escopo do script com seus nomes globais (ex: se o script tem uma variável 'speed', você pode lê-la como 'speed').
6. MATEMÁTICA E THREE.JS: Você tem acesso completo ao objeto global 'THREE' (ex: 'new THREE.Vector3()').
7. PERSISTÊNCIA DE VARIÁVEIS LOCAIS: NÃO use 'this', 'globalThis', 'window' ou propriedades de funções (ex: 'onUpdate._t') para salvar estados e timers. Em vez disso, declare variáveis locais normais com 'let' no escopo externo do script (fora das funções). Elas persistirão isoladamente por closure.
   Exemplo de Estrutura Correta de Script:
   let meuTimer = 0;
   function onAwake() {
     // Inicialização
   }
   function onUpdate(delta) {
     meuTimer += delta;
     if (meuTimer >= 0.5) {
       meuTimer = 0;
       // Ação a cada 0.5 segundos...
     }
   }




Informações do Script Atual sendo Editado:
- Nome do Script: "${activeScript?.scriptName || 'Sem nome'}"
- Entidade Associada: "${activeScript?.entityName || 'Sem nome'}"
- Variáveis Declaradas para este Script:
${(activeScript?.variables || []).map((v: any) => `  * ${v.name} (tipo: ${v.type}, valor: ${v.value || 'vazio'})`).join('\n') || '  Nenhuma variável declarada.'}
- Código Atual do Script (LEIA E ALTERE ESTE CÓDIGO SE O USUÁRIO SOLICITAR COMPLEMENTOS, AJUSTES OU REFORMA):
\`\`\`javascript
${currentCode || '// Nenhum código inicial no script.'}
\`\`\`

Estrutura completa da cena atual (Entidades e Scripts disponíveis no projeto):
${sceneContext || 'Nenhuma outra entidade/script na cena.'}

Retorne APENAS o código JavaScript COMPLETO (aplicando as alterações diretamente sobre o código atual do script fornecido se aplicável), contendo as funções onAwake e/ou onUpdate. Não inclua explicações em markdown, sem delimitadores, sem tags, sem conversa inicial ou final. Apenas o JavaScript puro contendo a lógica correta respeitando o updateComponent.`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      let data = '';
      let success = false;

      // 1. Tenta por POST na rota recomendada (OpenAI-compatible)
      try {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: selectedModel || 'openai',
            messages: [
              { 
                role: 'system', 
                content: systemPrompt
              },
              { role: 'user', content: prompt }
            ]
          })
        });
        if (response.ok) {
          const json = await response.json();
          data = json.choices?.[0]?.message?.content || '';
          if (data) success = true;
        }
      } catch (postErr) {
        console.warn('POST para gen.pollinations.ai falhou, tentando fallback:', postErr);
      }

      // 2. Se falhar, tenta o POST na rota legada text.pollinations.ai
      if (!success) {
        try {
          const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: selectedModel || 'openai',
              messages: [
                { 
                  role: 'system', 
                  content: systemPrompt
                },
                { role: 'user', content: prompt }
              ]
            })
          });
          if (response.ok) {
            data = await response.text();
            if (data) success = true;
          }
        } catch (legacyPostErr) {
          console.warn('POST para text.pollinations.ai falhou:', legacyPostErr);
        }
      }

      // 3. Fallback final via GET (altamente resiliente, não exige chave, livre de CORS)
      if (!success) {
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(selectedModel || 'openai')}&system=${encodeURIComponent(systemPrompt)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Falha na resposta da API após tentar POST e GET');
        }
        data = await response.text();
      }

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

  const handleDeleteScript = (entityId: string, scriptId: string, scriptName: string) => {
    if (confirm(`Tem certeza que deseja excluir o script adicional "${scriptName}"?`)) {
      setScripts(prev => prev.filter(s => !(s.entityId === entityId && s.scriptId === scriptId)));
      if (selectedEntityId === entityId && selectedScriptId === scriptId) {
        setSelectedEntityId(null);
        setSelectedScriptId(null);
        setCurrentCode('');
        setCurrentScriptName('');
      }
      channelRef.current?.postMessage({
        type: 'DELETE_ADDITIONAL_SCRIPT',
        entityId,
        scriptId
      });
      channelRef.current?.postMessage({
        type: 'SAVE_PROJECT_SCENE'
      });
    }
  };

  const groupedScripts = scripts.reduce((acc, script) => {
    if (!acc[script.entityId]) {
      acc[script.entityId] = {
        entityName: script.entityName,
        items: []
      };
    }
    acc[script.entityId].items.push(script);
    return acc;
  }, {} as Record<string, { entityName: string, items: ScriptItem[] }>);

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
            {Object.keys(groupedScripts).map(entId => {
              const group = groupedScripts[entId];
              return (
                <div key={entId} className="entity-scripts-group" style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                  <div className="entity-group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={group.entityName}>{group.entityName}</span>
                    <button
                      onClick={() => {
                        const additionalCount = group.items.filter(i => i.isAdditional).length;
                        const newScriptName = window.prompt("Nome do script adicional:", `ScriptAdicional${additionalCount + 1}`);
                        if (!newScriptName) return;
                        
                        const newScriptId = Math.random().toString(36).substring(2, 9);
                        
                        channelRef.current?.postMessage({
                          type: 'CREATE_ADDITIONAL_SCRIPT',
                          entityId: entId,
                          scriptId: newScriptId,
                          scriptName: newScriptName
                        });
                      }}
                      title="Adicionar Script Adicional"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      className="hover-bright"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="group-items" style={{ paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {group.items.map(s => (
                      <div 
                        key={`${s.entityId}-${s.scriptId}`} 
                        className={`script-item-row ${selectedEntityId === s.entityId && selectedScriptId === s.scriptId ? 'active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: '4px',
                          background: selectedEntityId === s.entityId && selectedScriptId === s.scriptId ? 'var(--bg-selected)' : 'transparent'
                        }}
                      >
                        <button 
                          className="script-item-btn"
                          onClick={() => handleSelectScript(s.entityId, s.scriptId)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            textAlign: 'left',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            overflow: 'hidden'
                          }}
                        >
                          <FileCode size={13} style={{ color: s.isAdditional ? '#10b981' : '#60a5fa', flexShrink: 0 }} />
                          <span className="script-name" style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.scriptName}.js
                          </span>
                        </button>

                        {s.isAdditional && (
                          <button
                            onClick={() => handleDeleteScript(s.entityId, s.scriptId, s.scriptName)}
                            title="Excluir Script"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '6px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              opacity: 0.7
                            }}
                            className="hover-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
