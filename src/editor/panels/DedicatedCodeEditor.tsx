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
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('pollinations_selected_model') || 'openai');
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

      const systemPrompt = `You are a Senior Game Systems Engineer specializing in the Freedom3D (Orion) Engine, which is built upon Three.js, React, and Rapier Physics.
Your task is to write high-performance, robust, and clean JavaScript scripts containing the lifecycles: onAwake() and/or onUpdate(delta).

CRITICAL ENGINE API & ARCHITECTURE GUIDELINES:
1. ECS PATTERN: The global 'entity' object is read-only metadata (e.g. 'entity.components.Transform', 'entity.components.MeshRenderer'). Directly mutating 'entity' properties will fail and break reactivity.
2. COMPONENT MUTATION (MANDATORY): Always use the global helper:
   updateComponent(entityId, componentName, updatedData)
   Examples:
   - Changing Mesh color:
     updateComponent(entity.id, 'MeshRenderer', { color: '#ff0000' });
   - Enabling emissive material (neon glow):
     updateComponent(entity.id, 'MeshRenderer', { material: 'emissive', color: '#00ffff', emissiveIntensity: 5.0 });
   - Manual transform movement (non-physics only):
     updateComponent(entity.id, 'Transform', { position: [x, y, z] });
   - Changing light intensity:
     updateComponent(entity.id, 'Light', { intensity: 2.5, color: '#00ff00' });
3. RAPIER PHYSICS & RIGIDBODY (CRITICAL): If the entity has a 'RigidBody' component, the global 'rigidBody' instance is automatically available during play. Use Rapier methods for all physics-based movement and rotations:
   - Teleport: rigidBody.setTranslation({ x, y, z }, true);
   - Linear velocity: rigidBody.setLinvel({ x, y, z }, true);
   - Angular velocity: rigidBody.setAngvel({ x, y, z }, true);
   - Check linear velocity: const vel = rigidBody.linvel(); (returns {x, y, z})
   - Check quaternion rotation: const rot = rigidBody.rotation(); (returns {x, y, z, w})
   - Set quaternion rotation: rigidBody.setRotation({ x, y, z, w }, true);
   AVISO CRÍTICO: NUNCA chame 'updateComponent(entity.id, "Transform", ...)' em entidades que possuam um componente 'RigidBody' ativo. Isso causa um conflito direto entre a simulação física do Rapier e o React, resultando em tremores intensos e física quebrada (jitter). Deixe o RigidBody gerenciar a rotação e a posição. Se desejar girar a física usando Euler/graus, converta para quaternion usando a classe THREE injetada globalmente e chame rigidBody.setRotation.
4. INPUT & CONTROLS (CRITICAL):
   - Keyboard checks: Input.getKey("KeyName") (e.g., Input.getKey("Space"), Input.getKey("KeyW"), Input.getKey("ArrowUp"), Input.getKey("KeyE")).
   - Mouse buttons: Input.getMouseButton(index) (0 = Left, 1 = Middle, 2 = Right).
   - Mouse Lock: To lock the mouse in FPS mode, chame Input.lockMouse() (normalmente ativado se Input.getMouseButton(0) for true). Destrave com Input.unlockMouse(). Use Input.mouse.isLocked (boolean) e acumule o movimento relativo via Input.mouse.movementX e Input.mouse.movementY.
   - Gamepad/VR buttons: Input.getGamepadButton("ButtonName"). Valid buttons are: "A", "B", "C", "D", "L1", "R1", "L2", "R2", "L3", "R3", "Share", "Options".
   - Gamepad analog sticks (eixos): Input.getGamepadAxis(axisIdx). Apenas os índices numéricos de 0 a 3 são válidos:
     * 0: Analógico Esquerdo - Eixo Horizontal (X) [Esquerda/Direita]
     * 1: Analógico Esquerdo - Eixo Vertical (Y) [Frente/Trás]
     * 2: Analógico Direito - Eixo Horizontal (X) [Snap/Smooth Turn]
     * 3: Analógico Direito - Eixo Vertical (Y)
     Exemplo: const stickX = Input.getGamepadAxis(0);
   - NEVER use non-existent methods like 'Input.isKeyPressed', 'Input.isMouseButtonPressed', 'Input.getKeyPressed', etc. Only 'getKey', 'getMouseButton', and 'getGamepadButton' are valid.
5. DEGREES TO RADIANS CONVERSION (CRITICAL): The entity's 'Transform.rotation' components are stored in DEGREES (e.g. [pitch, yaw, roll] in degrees). JavaScript trigonometric functions (Math.sin, Math.cos, and Euler rotations) expect RADIANS. You MUST convert degrees to radians:
   const yawRad = yawDeg * (Math.PI / 180);
   Then use Math.sin(yawRad) and Math.cos(yawRad).
6. THREE.JS & MATH GLOBALS (CRITICAL): The Three.js library ('THREE') and the JavaScript 'Math' object are injected directly into the script scope as globals. You DO NOT need to write any import statements (like 'import * as THREE') or access 'window.THREE'.
   Use 'new THREE.Vector3()', 'new THREE.Quaternion()', etc. directly.
7. REAL-TIME ENTITY POSITIONING (CRITICAL): To query the current position of another entity in real-time (especially those that move with Rapier Physics), ALWAYS use the global function:
   getEntityPosition(entityId)
   It returns an array '[x, y, z]' representing the real-time physical position of that entity. Avoid reading 'otherEntity.components.Transform.position' directly if it moves via physics, as React ECS stores do not mutate positions per-frame for performance reasons.
   Example:
   const playerPos = getEntityPosition(playerEntity.id);
   if (playerPos) {
     const dist = new THREE.Vector3().fromArray(playerPos).distanceTo(myPos);
   }
8. REAL-TIME PLAYER VIEW DIRECTION / RAYCASTING (CRITICAL): To determine where the player is looking (in both desktop mode and WebXR/VR immersive headset mode), ALWAYS use the global Three.js camera instance:
   threeCamera
   - To get camera position:
     const camPos = new THREE.Vector3();
     threeCamera.getWorldPosition(camPos);
   - To get gaze/look direction (forward vector):
     const viewDir = new THREE.Vector3();
     threeCamera.getWorldDirection(viewDir);
   - To spawn or position an object 2 meters directly in front of the player's eyes:
     const spawnPos = new THREE.Vector3().copy(camPos).addScaledVector(viewDir, 2.0);
9. DYNAMIC AUDIO ASSET SELECTORS: If your script needs to trigger audio clips (sound effects, background music, etc.), declare a public variable ending with 'Sound', 'Audio', or 'Clip' (e.g. 'export let jumpSound = "";' or 'export let shootClip = "";').
    - The Freedom3D Inspector will automatically detect this naming convention and render a drop-down selector listing all audio files inside the project folders.
    - Inside the script, you can trigger these sounds dynamically at runtime by instantiating the native browser Audio player using the variable value.
    - Example:
      export let hitSound = "";
      // ... later inside onUpdate:
      if (hasHit && hitSound) {
        new Audio(hitSound).play().catch(e => {});
      }
10. MULTIPLAYER NETWORKING (CRITICAL): If your script requires real-time network synchronizations or handles multiplayer games, use 'engine.network':
    - Check network state: engine.network.isConnected()
    - Get local player identity: engine.network.getPlayerId()
    - Send packets to room participants: engine.network.send({ type: 'your-event-name', ... })
    - Retrieve custom packets received from other players via the global buffer: 'window.soccerMultiplayerState' (e.g. check for incoming ball physics updates using 'window.soccerMultiplayerState["ball-sync"]').
11. HUD VISOR EVENT INTERACTION (CRITICAL): To update game stats, timers, goals, and alerts on both desktop (HUD2D overlay) and immersive VR environments (HUD3D spatial panel), dispatch global CustomEvents on the 'window' object:
    - Displaying an on-screen overlay notification:
      window.dispatchEvent(new CustomEvent('hud-notification', { detail: { text: "Alert Message!" } }));
    - Modifying scores and label identifiers (e.g. for Home/Away teams):
      window.dispatchEvent(new CustomEvent('soccer-score-updated', { detail: { home: 3, away: 2, labelHome: "RED", labelAway: "BLU" } }));
    - Transitioning between match states:
      window.dispatchEvent(new CustomEvent('soccer-phase', { detail: { phase: "goal", winner: "home" } })); // Valid phases: 'waiting', 'countdown', 'match', 'goal', 'endgame'
    - Formatting and synchronizing the clock countdown/timer:
      window.dispatchEvent(new CustomEvent('soccer-timer-updated', { detail: { formattedTime: "04:30" } }));

WEBXR & VR/AR COMPATIBILITY GUIDELINES (MANDATORY, BASED ON IMMERSIVE-WEB/WEBXR-SAMPLES):
1. DYNAMIC XR MODE CHECK: Check if the user is in WebXR/VR/AR immersive session using the global flag 'window.isVRActive'. If 'window.isVRActive === true', bypass desktop-specific controls (like mouse locking, direct screen-space DOM overlays, or WASD-only keys) which break inside the headset.

   CAMERA CONTROL (Scriptable VR): When the main Camera component has 'cameraType' = 'Scriptable' (or 'useGyroscope' = false), YOUR SCRIPT fully owns the VR view. Use the global 'window.Camera' API to drive it (Roblox-like):
   - window.Camera.setCFrame(x, y, z, rotX=0, rotY=0, rotZ=0): set camera position/rotation (degrees).
   - window.Camera.getCFrame(): returns { position:[x,y,z], rotation:[x,y,z] }.
   - window.Camera.setFOV(deg) / getFOV(): control field of view (note: headset-native FOV may override in immersive VR).
   - window.Camera.cameraType / .headsetOffset: read or set the mode ('Headset' | 'Scriptable') and whether the headset pose is applied as a local offset over the script camera.
   - window.Camera.getHeadsetCFrame(): returns the live headset pose { position, rotation } so you can blend it (e.g., look-around on a 3rd-person rig).
   - window.Camera.isVRActive(): true while an immersive XR session is active.
   Example (drone/3rd-person that still lets the head look around): set cameraType='Scriptable' and headsetOffset=true, then each frame setCFrame(drone pos) and read getHeadsetCFrame() to aim a turret.
2. XR CONTROLLER GAMEPAD INPUTS: When in XR mode, use gamepad mappings for the WebXR input sources. Mapped inputs via 'Input' or direct controller gamepad polling:
   - Stick Left (axes 0 & 1): Smooth translation/movement relative to the viewer direction.
   - Stick Right (axes 2 & 3): Rotation. Support "Snap Turn" (instant rotation of 30 or 45 degrees when tilting horizontal axis > 0.7 or < -0.7) or "Smooth Turn" to prevent motion sickness.
   - Trigger ('select' event / primary button): Triggering actions like firing weapons, clicking VR buttons, UI selection.
   - Grip Button ('squeeze' event / secondary button): Grabbing objects physically, anchoring, or picking up items.
3. TELEPORTATION SYSTEM: For comfortable locomotion in VR, implement a raycast from the active XR controller pointing forward and slightly down (parabolic arc). If it hits a collider or plane with the "teleport" tag:
   - Render a circular reticle (or torus) on the ground at the hit position.
   - Upon releasing the trigger (selectend event), teleport the player by setting the translation of the dynamic 'rigidBody' or updating the 'Transform' component of the player root entity to the hit position:
     rigidBody.setTranslation({ x: hitX, y: hitY + 0.1, z: hitZ }, true);
4. HAND TRACKING (ARTICULATIONS): For hand-based input sources without controllers, use the joint poses ('XRHand' joint array in WebXR). Keep interactions boundingbox-based (proximity touch) to press 3D floating buttons or pinch to grab.
5. AR SPATIAL HIT-TESTING & DOM OVERLAYS:
   - In 'immersive-ar', support hit-testing where you cast a ray from the screen/headset center to find intersection with physical surfaces (plane detection). Position virtual objects at the hit-test result matrix.
   - Ensure interfaces are placed in World Space (Spatial UI floating cards in 3D) rather than 2D viewport space so they are readable in XR. Use Three.js meshes or canvases for spatial text.

Script Context:
- Active Script Name: "${activeScript?.scriptName || 'Unnamed'}"
- Associated Entity: "${activeScript?.entityName || 'None'}"
- Exposed Variables:
${(activeScript?.variables || []).map((v: any) => `  * ${v.name} (type: ${v.type}, value: ${v.value || 'empty'})`).join('\n') || '  None.'}
- Current Script Code:
\`\`\`javascript
${currentCode || '// No starting code.'}
\`\`\`

Current Scene Context (Entities & Scripts):
${sceneContext || 'No other entities/scripts in scene.'}

OUTPUT FORMAT:
Return ONLY the complete, raw JavaScript code containing the lifecycles. Do NOT include markdown code blocks, explanations, chat, tags, or delimiters. Start directly with the code.`;

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
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      localStorage.setItem('pollinations_selected_model', e.target.value);
                    }}
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
