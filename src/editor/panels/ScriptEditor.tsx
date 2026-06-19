import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../store/editorStore';
import type { ScriptComponent } from '../../engine/ecs/types';
import { FileCode, Plus, ExternalLink } from 'lucide-react';

const defaultCode = `// O objeto 'entity' contem a referencia para esta entidade.
// O objeto 'engine' contem referencias para cena e controle.

export function onAwake() {
  // Chamado na inicializacao
}

export function onUpdate(delta) {
  // Chamado a cada frame
  // Exemplo de rotacao:
  // if (entity.components.Transform) {
  //   entity.components.Transform.rotation[1] += 90 * delta;
  // }
}
`;

export function ScriptEditor() {
  const { selectedEntity, updateComponent } = useEditorStore();
  const entity = selectedEntity();
  
  const scriptComponent = entity?.components.Script as ScriptComponent | undefined;

  const [activeScriptId, setActiveScriptId] = useState<string>('main');
  const [code, setCode] = useState(defaultCode);

  // Reset para 'main' se mudar de entidade
  useEffect(() => {
    setActiveScriptId('main');
  }, [entity?.id]);

  // Carrega o código correto dependendo do script ativo
  useEffect(() => {
    if (scriptComponent) {
      if (activeScriptId === 'main') {
        setCode(scriptComponent.code || defaultCode);
      } else {
        const found = (scriptComponent.scripts || []).find(s => s.id === activeScriptId);
        setCode(found ? found.code || '' : '');
      }
    }
  }, [scriptComponent, activeScriptId]);

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (entity && scriptComponent) {
      if (activeScriptId === 'main') {
        updateComponent(entity.id, 'Script', { code: newCode });
      } else {
        const updated = (scriptComponent.scripts || []).map(s => {
          if (s.id === activeScriptId) {
            return { ...s, code: newCode };
          }
          return s;
        });
        updateComponent(entity.id, 'Script', { scripts: updated });
      }
    }
  };

  const handleRenameScript = (newName: string) => {
    if (entity && scriptComponent) {
      if (activeScriptId === 'main') {
        updateComponent(entity.id, 'Script', { scriptName: newName });
      } else {
        const updated = (scriptComponent.scripts || []).map(s => {
          if (s.id === activeScriptId) {
            return { ...s, scriptName: newName };
          }
          return s;
        });
        updateComponent(entity.id, 'Script', { scripts: updated });
      }
    }
  };

  if (!entity) {
    return (
      <div className="script-editor-empty">
        <p>Nenhuma entidade selecionada.</p>
      </div>
    );
  }

  if (!scriptComponent) {
    return (
      <div className="script-editor-empty">
        <p>A entidade "{entity.name}" nao possui um ScriptComponent.</p>
        <button 
          className="panel-btn primary"
          onClick={() => {
            useEditorStore.getState().addComponent(entity.id, {
              type: 'Script',
              scriptName: 'NewScript',
              code: defaultCode
            });
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}
        >
          <Plus size={14} /> Adicionar ScriptComponent
        </button>
      </div>
    );
  }

  // Encontra o script ativo atual
  const activeScript = activeScriptId === 'main'
    ? { scriptName: scriptComponent.scriptName || 'Main', code: scriptComponent.code || '' }
    : (scriptComponent.scripts || []).find(s => s.id === activeScriptId);

  const activeScriptName = activeScript ? activeScript.scriptName : 'Script';

  return (
    <div className="script-editor-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Abas de Navegação de Múltiplos Scripts */}
      <div style={{ display: 'flex', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', padding: '0 8px', overflowX: 'auto', gap: '4px', alignItems: 'center' }}>
        <button
          onClick={() => setActiveScriptId('main')}
          style={{
            padding: '8px 12px',
            background: activeScriptId === 'main' ? 'var(--bg-panel-alt)' : 'transparent',
            border: 'none',
            borderBottom: activeScriptId === 'main' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeScriptId === 'main' ? 'white' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: activeScriptId === 'main' ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <FileCode size={12} style={{ color: '#60a5fa' }} />
          {scriptComponent.scriptName || 'Main'}.js
        </button>
        
        {(scriptComponent.scripts || []).map(scr => (
          <button
            key={scr.id}
            onClick={() => setActiveScriptId(scr.id)}
            style={{
              padding: '8px 12px',
              background: activeScriptId === scr.id ? 'var(--bg-panel-alt)' : 'transparent',
              border: 'none',
              borderBottom: activeScriptId === scr.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeScriptId === scr.id ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: activeScriptId === scr.id ? 'bold' : 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FileCode size={12} style={{ color: '#10b981' }} />
            {scr.scriptName}.js
          </button>
        ))}

        {/* Botão para criar novo script adicional */}
        <button
          onClick={() => {
            const currentScripts = scriptComponent.scripts || [];
            const newId = Math.random().toString(36).substring(2, 9);
            const newScript = {
              id: newId,
              scriptName: `ScriptAdicional${currentScripts.length + 1}`,
              code: `// Comportamento adicional\nexport function onAwake() {\n  // Chamado na inicialização\n}\n\nexport function onUpdate(delta) {\n  // Chamado a cada frame\n}`,
              variables: []
            };
            updateComponent(entity.id, 'Script', { scripts: [...currentScripts, newScript] });
            setActiveScriptId(newId);
          }}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            marginLeft: '8px',
            opacity: 0.8
          }}
          className="hover-bright"
        >
          <Plus size={12} /> Novo Script
        </button>
      </div>

      <div className="script-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-panel-alt)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCode size={14} style={{ color: activeScriptId === 'main' ? '#60a5fa' : '#10b981' }} /> {entity.name} / {activeScriptName}.js
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="text" 
            value={activeScriptName}
            onChange={(e) => handleRenameScript(e.target.value)}
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-bright)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
          />

          {activeScriptId !== 'main' && (
            <button 
              className="panel-btn danger small"
              onClick={() => {
                if (confirm(`Tem certeza que deseja remover o script adicional "${activeScriptName}"?`)) {
                  const updated = (scriptComponent.scripts || []).filter(s => s.id !== activeScriptId);
                  updateComponent(entity.id, 'Script', { scripts: updated });
                  setActiveScriptId('main');
                }
              }}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              Remover Script
            </button>
          )}

          <button 
            className="panel-btn primary small"
            onClick={() => {
              window.open(`/code-editor?entityId=${entity.id}&scriptId=${activeScriptId}`, 'Freedom3DCodeEditor', 'width=1100,height=750');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 10px' }}
          >
            <ExternalLink size={12} /> Abrir Janela Externa
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
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
  );
}