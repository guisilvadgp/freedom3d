import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  Sparkles, Send, Loader2, Settings, Rocket, Target,
  CheckCircle, AlertTriangle, Bot, Clapperboard, Gamepad2, Brain, ScrollText, Package, Link2, ChevronRight, X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { orchestrate, applyScenePatches } from '../ai/orchestrator';
import type { OrchestrationResult } from '../ai/orchestrator';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  content: string;
  result?: OrchestrationResult;
  timestamp: number;
}

const AGENT_INFO = [
  { id: 'scene',       icon: Clapperboard, label: 'Cena',        color: '#3b82f6', desc: 'Objetos, fog, fundo, luzes, câmeras' },
  { id: 'gameplay',    icon: Gamepad2,     label: 'Gameplay',    color: '#10b981', desc: 'Movimento, pulo, vida, inventário' },
  { id: 'ai',          icon: Brain,        label: 'IA',          color: '#f59e0b', desc: 'Inimigos, perseguição, patrulha' },
  { id: 'scripts',     icon: ScrollText,   label: 'Scripts',     color: '#8b5cf6', desc: 'Arma, munição, interação' },
  { id: 'assets',      icon: Package,      label: 'Assets',      color: '#ec4899', desc: 'Materiais, texturas, modelos' },
  { id: 'integration', icon: Link2,        label: 'Integração',  color: '#06b6d4', desc: 'Conectar sistemas' },
];

const SUGGESTION_CHIPS = [
  'Crie um cubo na cena',
  'Altere o fundo para preto',
  'Habilite o fog',
  'Crie a movimentação do personagem',
  'Crie a IA básica do inimigo',
  'Câmera em terceira pessoa',
  'Sistema de vida do jogador',
  'Preciso de dois scripts: arma e inimigo',
];

// ─── Gerador offline de templates ─────────────────────────────────────────────

function generateOfflineTemplate(templateType: 'race' | 'fps' | 'platform' | 'coins'): Record<string, any>[] {
  const id = (n: string) => `${n}-${uuidv4().slice(0,6)}`;
  if (templateType === 'fps') {
    const groundId = id('ground'), playerId = id('player'), lightId = id('light');
    return [
      { type: 'update_scene', data: { backgroundColor: '#0d0d12', fogEnabled: true, fogColor: '#0d0d12', fogNear: 15, fogFar: 80 }},
      { type: 'add_entity', data: { id: lightId, name: 'Luz Direcional', parentId:null, childrenIds:[], active:true, tags:[], components:{ Transform:{type:'Transform',position:[10,20,10],rotation:[0,0,0],scale:[1,1,1]}, Light:{type:'Light',lightType:'directional',color:'#ffffff',intensity:1.2,castShadow:true}}}},
      { type: 'add_entity', data: { id: groundId, name: 'Chão', parentId:null, childrenIds:[], active:true, tags:[], components:{ Transform:{type:'Transform',position:[0,0,0],rotation:[-90,0,0],scale:[60,60,1]}, MeshRenderer:{type:'MeshRenderer',geometry:'plane',material:'standard',color:'#1e2022',castShadow:false,receiveShadow:true}, RigidBody:{type:'RigidBody',mass:0,isStatic:true,useGravity:false,collider:'cuboid'}}}},
      { type: 'add_entity', data: { id: playerId, name: 'JogadorFPS', parentId:null, childrenIds:[], active:true, tags:['player'], components:{ Transform:{type:'Transform',position:[0,1.5,0],rotation:[0,0,0],scale:[1,2,1]}, MeshRenderer:{type:'MeshRenderer',geometry:'capsule',material:'standard',color:'#16a085',castShadow:true,receiveShadow:true}, RigidBody:{type:'RigidBody',mass:1,isStatic:false,useGravity:true,collider:'none'}, Camera:{type:'Camera',fov:75,near:0.1,far:1000,isMain:true,offset:[0,0.8,0]}, Script:{type:'Script',scriptName:'FPSController',code:`export let speed=10;export let jumpForce=7;export let mouseSensitivity=0.002;\nlet rotX=0,rotY=0;\nexport function onUpdate(delta){\n  if(Input.getMouseButton(0))Input.lockMouse();\n  if(Input.mouse.isLocked){rotY-=Input.mouse.movementX*mouseSensitivity;rotX-=Input.mouse.movementY*mouseSensitivity;rotX=Math.max(-1.4,Math.min(1.4,rotX));}\n  if(camera)camera.rotation=[rotX,0,0];\n  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rotY,0));\n  if(rigidBody){rigidBody.setRotation(q,true);const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(q);const right=new THREE.Vector3(1,0,0).applyQuaternion(q);const vel=new THREE.Vector3(0,rigidBody.linvel().y,0);let f=0,r=0;if(Input.getKey('KeyW'))f+=1;if(Input.getKey('KeyS'))f-=1;if(Input.getKey('KeyA'))r-=1;if(Input.getKey('KeyD'))r+=1;if(f||r){const mv=new THREE.Vector3().add(fwd.multiplyScalar(f)).add(right.multiplyScalar(r)).normalize();vel.add(mv.multiplyScalar(speed));}if(Input.getKey('Space')&&Math.abs(rigidBody.linvel().y)<0.1)vel.y=jumpForce;rigidBody.setLinvel(vel,true);}}`}}}}
    ];
  }
  // race (default)
  const lightId=id('light'), runwayId=id('runway'), playerId=id('player'), camId=id('cam');
  return [
    { type:'update_scene', data:{backgroundColor:'#020208',fogEnabled:true,fogColor:'#020208',fogNear:15,fogFar:220}},
    { type:'add_entity', data:{id:lightId,name:'Luz Direcional',parentId:null,childrenIds:[],active:true,tags:[],components:{Transform:{type:'Transform',position:[10,30,10],rotation:[0,0,0],scale:[1,1,1]},Light:{type:'Light',lightType:'directional',color:'#ffffff',intensity:1.5,castShadow:true}}}},
    { type:'add_entity', data:{id:runwayId,name:'Pista',parentId:null,childrenIds:[],active:true,tags:[],components:{Transform:{type:'Transform',position:[0,0,-100],rotation:[-90,0,0],scale:[25,300,1]},MeshRenderer:{type:'MeshRenderer',geometry:'plane',material:'standard',color:'#090912',castShadow:false,receiveShadow:true},RigidBody:{type:'RigidBody',mass:0,isStatic:true,useGravity:false,collider:'cuboid'}}}},
    { type:'add_entity', data:{id:playerId,name:'Nave',parentId:null,childrenIds:[],active:true,tags:['player'],components:{Transform:{type:'Transform',position:[0,2,10],rotation:[0,180,0],scale:[1.2,0.6,2]},MeshRenderer:{type:'MeshRenderer',geometry:'cone',material:'standard',color:'#00e5ff',castShadow:true,receiveShadow:true},RigidBody:{type:'RigidBody',mass:1,isStatic:false,useGravity:false,collider:'cuboid'},Script:{type:'Script',scriptName:'NaveController',code:`export let speed=35;let lastCamPos=null;\nexport function onUpdate(delta){\n  const pos=getEntityPosition(entity.id)||[0,2,10];\n  let ax=0,ay=0,az=0;\n  if(Input.getKey('KeyW')||Input.getKey('ArrowUp'))az-=1;\n  if(Input.getKey('KeyS')||Input.getKey('ArrowDown'))az+=1;\n  if(Input.getKey('KeyA')||Input.getKey('ArrowLeft'))ax-=1;\n  if(Input.getKey('KeyD')||Input.getKey('ArrowRight'))ax+=1;\n  if(Input.getKey('Space'))ay+=0.8;\n  if(Input.getKey('ShiftLeft'))ay-=0.8;\n  const mv=new THREE.Vector3(ax,ay,az).multiplyScalar(speed*delta);\n  updateComponent(entity.id,'Transform',{position:[Math.max(-12,Math.min(12,pos[0]+mv.x)),Math.max(1,Math.min(15,pos[1]+mv.y)),pos[2]+mv.z],rotation:[0,180,ax*-15]});\n  const cam=engine.find('Main Camera');\n  if(cam){const np=getEntityPosition(entity.id);const t=new THREE.Vector3(np[0],np[1]+2.5,np[2]+9);const cp=cam.components.Transform.position;const lp=lastCamPos?lastCamPos.clone().lerp(t,delta*8):t;lastCamPos=lp.clone();engine.updateComponent(cam.id,'Transform',{position:[lp.x,lp.y,lp.z],rotation:[-10,180,0]});}}`}}}},
    { type:'add_entity', data:{id:camId,name:'Main Camera',parentId:null,childrenIds:[],active:true,tags:[],components:{Transform:{type:'Transform',position:[0,4,19],rotation:[-10,180,0],scale:[1,1,1]},Camera:{type:'Camera',fov:65,near:0.1,far:1000,isMain:true,offset:[0,0,0]}}}},
  ];
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AIAssistantPanel() {
  const { activeScene, saveCurrentScene, addLog, showToast, activeSceneId } = useEditorStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('pollinations_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('pollinations_selected_model') || 'openai');
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    fetch('https://gen.pollinations.ai/v1/models')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const chat = (json.data || []).filter((m: any) => {
          const id = m.id.toLowerCase();
          return !['flux','diffusion','dall-e','audio','tts','whisper'].some(k => id.includes(k));
        });
        setModels(chat.length ? chat : [{ id: 'openai' }, { id: 'mistral' }]);
      })
      .catch(() => setModels([{ id: 'openai' }, { id: 'mistral' }]));
  }, []);

  const addMessage = (role: 'user' | 'system', content: string, result?: OrchestrationResult) => {
    setMessages(prev => [...prev, { id: uuidv4(), role, content, result, timestamp: Date.now() }]);
  };

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;
    const userPrompt = prompt.trim();
    setPrompt('');
    addMessage('user', userPrompt);
    setIsLoading(true);
    setActiveAgents(new Set());

    const scene = activeScene();
    if (!scene) { addMessage('system', 'Nenhuma cena ativa.'); setIsLoading(false); return; }

    try {
      const result = await orchestrate(userPrompt, apiKey || undefined, selectedModel);

      // Mostra agentes ativos
      const involvedAgents = new Set(result.agentResults.map(r => {
        const found = AGENT_INFO.find(a => r.agent.toLowerCase().includes(a.label.toLowerCase()) || r.agent.toLowerCase().includes(a.id));
        return found?.id || '';
      }).filter(Boolean));
      setActiveAgents(involvedAgents);

      // Aplica patches na cena
      if (result.scenePatches.length > 0) {
        applyScenePatches(result.scenePatches, scene, activeSceneId, useEditorStore.setState);
        await saveCurrentScene();
      }

      addMessage('system', '', result);
      addLog('info', `Multiagente executou: "${userPrompt}"`);
      if (result.success) showToast('Tarefa executada com sucesso!');
    } catch (err: any) {
      addMessage('system', `Erro: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setActiveAgents(new Set()), 3000);
    }
  };

  const handleQuickTemplate = async (type: 'race' | 'fps') => {
    setIsLoading(true);
    const scene = activeScene();
    if (!scene) { setIsLoading(false); return; }
    addMessage('user', type === 'fps' ? 'Gerar Arena FPS' : 'Gerar Corrida de Nave');
    try {
      const patches = generateOfflineTemplate(type);
      applyScenePatches(patches as any, scene, activeSceneId, useEditorStore.setState);
      await saveCurrentScene();
      addMessage('system', '', {
        objective: type === 'fps' ? 'Arena FPS gerada' : 'Corrida de Nave gerada',
        plan: ['Cena construída com template offline'],
        agentResults: [{ agent: 'Templates Offline', agentIcon: '', executed: 'Cena completa gerada', files: [], scripts: [], impacts: ['Cena substituída'], nextSteps: ['Pressione Play para testar', 'Ajuste velocidade no Inspector'] }],
        scenePatches: [],
        success: true,
        parseResult: { intents: [], isComplex: false, suggestedPlan: [], unknownParts: [] },
      });
      showToast('Template gerado com sucesso!');
    } catch (err: any) {
      addMessage('system', `Erro: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-assistant-panel">
      {/* ── Header ── */}
      <div className="ai-header">
        <div className="header-title">
          <Bot size={16} className="neon-text-icon" />
          <h3>Sistema Multiagente 3D</h3>
          {isLoading && <span className="agent-pulse" />}
        </div>
        <div className="header-actions">
          <button className={`settings-btn ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(s => !s)} title="Configurações">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ── Agentes ── */}
      <div className="agent-sidebar">
        {AGENT_INFO.map(ag => {
          const Icon = ag.icon;
          const isActive = activeAgents.has(ag.id);
          return (
            <div key={ag.id} className={`agent-chip ${isActive ? 'active' : ''}`} title={`${ag.label}: ${ag.desc}`} style={{ '--agent-color': ag.color } as any}>
              <Icon size={12} />
              <span>{ag.label}</span>
              {isActive && <span className="agent-dot" />}
            </div>
          );
        })}
      </div>

      {/* ── Settings ── */}
      {showSettings && (
        <div className="api-settings-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Configurações da IA</h4>
            <button className="settings-btn" onClick={() => setShowSettings(false)}><X size={12} /></button>
          </div>
          <div className="api-input-group">
            <input type="password" placeholder="Pollinations API Key (opcional)..." value={apiKey}
              onChange={e => setApiKey(e.target.value)} />
            <button onClick={() => { localStorage.setItem('pollinations_api_key', apiKey.trim()); showToast('API Key salva!'); setShowSettings(false); }}>Salvar</button>
          </div>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>Modelo:</label>
          <select value={selectedModel} onChange={e => { setSelectedModel(e.target.value); localStorage.setItem('pollinations_selected_model', e.target.value); }}
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-bright)', color: 'white', padding: '5px 8px', borderRadius: 4, fontSize: 11, width: '100%' }}>
            {models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
          </select>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 8 }}>
            Sem API Key: modo local (regex + templates). Com API Key: IA generativa completa.
          </p>
        </div>
      )}

      {/* ── Chat ── */}
      <div className="ai-body">
        <div className="ai-chat-area">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <Bot size={36} className="welcome-icon" />
              <h4>Sistema Multiagente de Jogos 3D</h4>
              <p>Faça solicitações diretas. O orquestrador identifica a tarefa e delega ao agente especializado.</p>
              <div className="quick-templates">
                <span>Templates rápidos:</span>
                <div className="template-buttons">
                  <button onClick={() => handleQuickTemplate('race')}><Rocket size={12} /> Corrida de Nave</button>
                  <button onClick={() => handleQuickTemplate('fps')}><Target size={12} /> Arena FPS</button>
                </div>
              </div>
              <div className="suggestion-chips-grid">
                {SUGGESTION_CHIPS.map(chip => (
                  <button key={chip} className="suggestion-chip" onClick={() => { setPrompt(chip); inputRef.current?.focus(); }}>
                    <ChevronRight size={10} />{chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.role}`}>
                  {msg.role === 'user' ? (
                    <div className="user-bubble">{msg.content}</div>
                  ) : msg.result ? (
                    <OrchestrationReport result={msg.result} />
                  ) : (
                    <div className="system-text">{msg.content}</div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="chat-message system">
                  <div className="thinking-indicator">
                    <div className="thinking-dot" /><div className="thinking-dot" /><div className="thinking-dot" />
                    <span>Orquestrador analisando...</span>
                  </div>
                </div>
              )}
              <div ref={msgEndRef} />
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="ai-input-bar">
          <div className="prompt-input-wrapper">
            <Sparkles className="input-glow-icon" size={14} />
            <input ref={inputRef} type="text"
              placeholder="Ex: 'Crie um cubo', 'IA do inimigo', 'câmera terceira pessoa'..."
              value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
              disabled={isLoading} />
            <button className="send-btn" onClick={handleSend} disabled={isLoading || !prompt.trim()}>
              {isLoading ? <Loader2 className="spinner" size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de relatório ──────────────────────────────────────────────────

function OrchestrationReport({ result }: { result: OrchestrationResult }) {
  return (
    <div className="orchestration-report">
      <div className="report-section orchestrator-section">
        <div className="report-label"><Bot size={12} /> ORQUESTRADOR</div>
        <div className="report-objective"><strong>Objetivo:</strong> {result.objective}</div>
        {result.plan.length > 0 && (
          <div className="report-plan">
            <strong>Plano:</strong>
            {result.plan.map((step, i) => <div key={i} className="plan-step">{step}</div>)}
          </div>
        )}
        {!result.success && result.errorMessage && (
          <div className="report-error"><AlertTriangle size={12} /> {result.errorMessage}</div>
        )}
      </div>

      {result.agentResults.map((ar, i) => (
        <div key={i} className="report-section agent-section">
          <div className="report-label">{ar.agentIcon} {ar.agent.toUpperCase()}</div>
          <div className="report-executed">
            <strong>Executando:</strong> {ar.executed}
          </div>
          {ar.scripts.length > 0 && (
            <div className="report-scripts">
              {ar.scripts.map(s => <span key={s} className="script-badge">{s}</span>)}
            </div>
          )}
          {ar.impacts.length > 0 && (
            <div className="report-impacts">
              {ar.impacts.map(imp => <div key={imp} className="impact-item">→ {imp}</div>)}
            </div>
          )}
          <div className="report-validation">
            <CheckCircle size={12} className="check-icon" /> <strong>Validação:</strong> ✓ Concluído
          </div>
          {ar.nextSteps.length > 0 && (
            <div className="report-next">
              <strong>Próximos passos:</strong>
              {ar.nextSteps.map((s, j) => <div key={j} className="next-step">→ {s}</div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
