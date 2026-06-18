import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../store/editorStore';
import type { ScriptComponent } from '../../engine/ecs/types';
import { FileCode, Plus } from 'lucide-react';

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

  const [code, setCode] = useState(defaultCode);

  useEffect(() => {
    if (scriptComponent) {
      setCode(scriptComponent.code || defaultCode);
    }
  }, [scriptComponent?.code]);

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (entity && scriptComponent) {
      updateComponent(entity.id, 'Script', { code: newCode });
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

  return (
    <div className="script-editor-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="script-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-panel-alt)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCode size={14} /> {entity.name} / {scriptComponent.scriptName}.js
        </span>
        <input 
          type="text" 
          value={scriptComponent.scriptName}
          onChange={(e) => updateComponent(entity.id, 'Script', { scriptName: e.target.value })}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-bright)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
        />
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