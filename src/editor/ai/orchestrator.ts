import { parseIntent, type ParseResult } from './intentParser';
import { runSceneAgent, runGameplayAgent, runAIAgent, runScriptsAgent, runIntegrationAgent, type AgentResult, type ScenePatch } from './agents';
import { v4 as uuidv4 } from 'uuid';

export interface OrchestrationResult {
  objective: string;
  plan: string[];
  agentResults: AgentResult[];
  scenePatches: ScenePatch[];
  success: boolean;
  errorMessage?: string;
  parseResult: ParseResult;
}

// ─── Orquestrador principal ───────────────────────────────────────────────────

export async function orchestrate(
  prompt: string,
  apiKey?: string,
  selectedModel?: string
): Promise<OrchestrationResult> {

  // 1. Parseio de intenção local
  const parseResult = parseIntent(prompt);

  // 2. Se não entendeu nada, tenta via AI
  if (parseResult.intents.length === 0 && apiKey) {
    return await orchestrateViaAI(prompt, apiKey, selectedModel);
  }

  // 3. Sem intents mas sem API → retorna feedback
  if (parseResult.intents.length === 0) {
    return {
      objective: 'Comando não reconhecido',
      plan: ['Análise falhou — tente reformular o comando'],
      agentResults: [],
      scenePatches: [],
      success: false,
      errorMessage: 'Não consegui identificar a ação. Tente comandos como: "crie um cubo", "habilite o fog", "crie a movimentação do personagem".',
      parseResult,
    };
  }

  // 4. Executa agentes em sequência
  const agentResults: AgentResult[] = [];
  const allPatches: ScenePatch[] = [];

  for (const intent of parseResult.intents) {
    try {
      let result: AgentResult;
      switch (intent.agent) {
        case 'scene':       result = await runSceneAgent(intent); break;
        case 'gameplay':    result = await runGameplayAgent(intent); break;
        case 'ai':          result = await runAIAgent(intent); break;
        case 'scripts':     result = await runScriptsAgent(intent); break;
        case 'integration': result = await runIntegrationAgent(intent); break;
        default:            continue;
      }
      agentResults.push(result);
      if (result.scenePatches) allPatches.push(...result.scenePatches);
    } catch (err: any) {
      agentResults.push({
        agent: intent.agent, agentIcon: '⚠️',
        executed: `Erro ao executar: ${err.message}`,
        files: [], scripts: [], impacts: [], nextSteps: [],
      });
    }
  }

  return {
    objective: buildObjective(parseResult),
    plan: parseResult.suggestedPlan,
    agentResults,
    scenePatches: allPatches,
    success: agentResults.some(r => !r.executed.includes('Erro')),
    parseResult,
  };
}

// ─── Fallback via Pollinations AI ─────────────────────────────────────────────

async function orchestrateViaAI(prompt: string, apiKey: string, selectedModel = 'openai'): Promise<OrchestrationResult> {
  const systemPrompt = buildSystemPrompt();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  let dataText = '';
  try {
    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      dataText = json.choices?.[0]?.message?.content || '';
    }
  } catch (_) {}

  if (!dataText) {
    try {
      const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${selectedModel}&system=${encodeURIComponent(systemPrompt)}`;
      const res = await fetch(url);
      if (res.ok) dataText = await res.text();
    } catch (_) {}
  }

  if (!dataText) {
    return { objective: prompt, plan: ['Falha na API'], agentResults: [], scenePatches: [], success: false, errorMessage: 'Falha ao contactar a API de IA.', parseResult: { intents: [], isComplex: false, suggestedPlan: [], unknownParts: [prompt] } };
  }

  try {
    let clean = dataText.trim().replace(/^```json\n?|^```\n?/g, '').replace(/```$/g, '').trim();
    const parsed = JSON.parse(clean);
    const patches: ScenePatch[] = [];
    if (parsed.entities) {
      for (const entity of Object.values(parsed.entities) as any[]) {
        patches.push({ type: 'add_entity', data: entity });
      }
    }
    if (parsed.sceneSettings) {
      patches.push({ type: 'update_scene', data: parsed.sceneSettings });
    }
    return {
      objective: parsed.objective || prompt,
      plan: parsed.plan || ['Executado via IA'],
      agentResults: [{
        agent: 'IA Pollinations', agentIcon: '🤖',
        executed: parsed.executed || 'Cena gerada com sucesso',
        files: [], scripts: parsed.scripts || [], impacts: ['Cena modificada pela IA'],
        nextSteps: parsed.nextSteps || [],
        scenePatches: patches,
      }],
      scenePatches: patches,
      success: true,
      parseResult: { intents: [], isComplex: true, suggestedPlan: [], unknownParts: [] },
    };
  } catch (err: any) {
    return { objective: prompt, plan: [], agentResults: [], scenePatches: [], success: false, errorMessage: `Erro ao processar resposta da IA: ${err.message}`, parseResult: { intents: [], isComplex: false, suggestedPlan: [], unknownParts: [] } };
  }
}

// ─── Aplicação dos patches na store ──────────────────────────────────────────

export function applyScenePatches(
  patches: ScenePatch[],
  activeScene: any,
  activeSceneId: string,
  setState: (fn: any) => void
) {
  let scene = { ...activeScene };
  let entities = { ...scene.entities };
  let rootEntityIds = [...scene.rootEntityIds];
  let sceneUpdates: any = {};

  for (const patch of patches) {
    if (patch.type === 'add_entity') {
      const entity = patch.data;
      if (!entity.id) entity.id = uuidv4();
      entities[entity.id] = entity;
      if (!rootEntityIds.includes(entity.id)) rootEntityIds.push(entity.id);
    } else if (patch.type === 'update_scene') {
      sceneUpdates = { ...sceneUpdates, ...patch.data };
    }
    // add_script: ação informativa, não adiciona entidade diretamente
  }

  setState((s: any) => ({
    scenes: {
      ...s.scenes,
      [activeSceneId]: { ...scene, ...sceneUpdates, entities, rootEntityIds },
    },
    hasUnpublishedChanges: true,
  }));
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function buildObjective(parseResult: ParseResult): string {
  if (parseResult.intents.length === 0) return 'Comando desconhecido';
  const agentLabels: Record<string, string> = {
    scene: 'modificação de cena', gameplay: 'sistema de gameplay',
    ai: 'inteligência artificial', scripts: 'scripts', assets: 'assets', integration: 'integração',
  };
  const unique = [...new Set(parseResult.intents.map(i => agentLabels[i.agent] || i.agent))];
  return `Executar: ${unique.join(', ')}`;
}

function buildSystemPrompt(): string {
  return `Você é o Orquestrador Avançado da Orion Engine (um motor de jogos 3D com suporte nativo a WebXR/VR/AR baseado em Three.js, React e Rapier Physics). Retorne APENAS JSON puro sem markdown ou blocos de código:
{
  "objective": "descrição do objetivo",
  "plan": ["passo 1", "passo 2"],
  "executed": "o que foi feito",
  "scripts": ["NomeScript.js"],
  "nextSteps": ["próximo passo 1"],
  "entities": { 
    "<uuid>": { 
      "id": "<uuid>",
      "name": "nome_do_objeto",
      "parentId": null,
      "childrenIds": [],
      "active": true,
      "tags": ["player", "teleport", "interactable"],
      "components": { 
        "Transform": { "type": "Transform", "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] },
        "MeshRenderer": { "type": "MeshRenderer", "geometry": "box", "material": "standard", "color": "#ffffff" },
        "RigidBody": { "type": "RigidBody", "mass": 1, "isStatic": false, "useGravity": true, "collider": "cuboid" },
        "Camera": { "type": "Camera", "fov": 75, "near": 0.1, "far": 1000, "isMain": true, "offset": [0,1.6,0] }
      } 
    } 
  },
  "sceneSettings": { "backgroundColor": "#hex", "fogEnabled": false, "fogColor": "#hex", "fogNear": 10, "fogFar": 100 }
}

CRITICAL INSTRUCTION: You must strictly escape all newlines in your string values as \\n. DO NOT use literal newlines inside JSON string values.

DIRETRIZES E REFERÊNCIAS NATIVAS DA ENGINE PARA GERAÇÃO DE SCRIPTS E CENAS:
1. PADRÃO ECS E MUTAÇÃO: O objeto 'entity' exposto em runtime é somente-leitura. Modificar propriedades diretamente falhará e quebrará a reatividade. Use obrigatoriamente a função global helper 'updateComponent(entityId, componentName, data)'.
   Exemplo: updateComponent(entity.id, 'MeshRenderer', { color: '#ff3300' });
2. FÍSICA RAPIER (CRÍTICO): Se a entidade possuir corpo rígido físico ativo (componente 'RigidBody' ativo), a variável global 'rigidBody' estará disponível. Use os métodos Rapier para toda movimentação e rotação baseada em física:
   - Posicionar/Teletransporte: rigidBody.setTranslation({ x, y, z }, true);
   - Velocidade Linear: rigidBody.setLinvel({ x, y, z }, true);
   - Velocidade Angular: rigidBody.setAngvel({ x, y, z }, true);
   - Obter velocidade linear: rigidBody.linvel(); (retorna objeto {x, y, z}).
   - Obter rotação (quaternion): rigidBody.rotation(); (retorna objeto {x, y, z, w}).
   - Definir rotação (quaternion): rigidBody.setRotation({ x, y, z, w }, true);
   *AVISO CRÍTICO*: NUNCA utilize 'updateComponent' para alterar o Transform (position ou rotation) de entidades com RigidBody ativo. Isso causará conflitos severos entre a simulação física do Rapier e o React, resultando em tremores e física quebrada (jitter). Deixe o RigidBody controlar a rotação e a posição da entidade. Para girar, converta graus/Euler para quaternion usando a classe THREE (injetada de forma global) e chame rigidBody.setRotation.
3. CLASSES E LIBS INJETADAS DIRETAMENTE (THREE.JS):
   - A biblioteca 'THREE' (Three.js) está disponível diretamente no escopo global de todos os scripts de runtime. NÃO tente fazer imports ou acessá-la de 'window.THREE'.
   - Use 'new THREE.Vector3()', 'new THREE.Quaternion().setFromEuler(new THREE.Euler(...))', etc., diretamente no código do script.
4. BUSCA E POSICIONAMENTO DE OUTRAS ENTIDADES EM TEMPO REAL:
   - Para ler a posição de outras entidades (especialmente se moverem via física), use: const pos = getEntityPosition(entityId); (retorna array [x, y, z] ou null). NUNCA leia 'otherEntity.components.Transform.position' diretamente em loop pois ela não é atualizada por frame devido a performance reativa.
   - Para buscar entidades por nome, use: const ent = engine.find("NomeDaEntidade");
   - Para buscar entidade por tag, use: const ent = engine.findByTag("tag");
   - Para buscar todas as entidades com uma tag, use: const list = engine.findAllByTag("tag");
   *NUNCA utilize 'engine.entities.find' ou 'engine.getEntities', pois essas propriedades/métodos NÃO existem na API global.*
5. CÂMERA E DIREÇÃO DE OLHAR: A variável global 'threeCamera' (instância do Three.js) representa a câmera ativa.
   - Posição da câmera: const cp = new THREE.Vector3(); threeCamera.getWorldPosition(cp);
   - Direção de olhar (vetor forward): const vd = new THREE.Vector3(); threeCamera.getWorldDirection(vd);
6. CONTROLES E INPUTS: Use a API global 'Input' para verificar entradas de teclado, mouse ou gamepad/VR:
   - Teclado: Input.getKey("KeyW"), Input.getKey("Space"), Input.getKey("ArrowUp") (use códigos de teclas padrão KeyW, KeyS, KeyA, KeyD, Space, etc.).
   - Mouse: Input.getMouseButton(index) (0=esquerdo, 1=meio, 2=direito), Input.mouse.isLocked (boolean), Input.mouse.movementX e Input.mouse.movementY (movimentos relativos). Para travar, use Input.lockMouse().
   - Gamepad/VR: Input.getGamepadButton("NomeBotao") - botões válidos suportados: "A", "B", "C", "D", "L1", "R1", "L2", "R2", "L3", "R3", "Share", "Options".
   - Gamepad Eixos Analógicos (CRÍTICO): Input.getGamepadAxis(index). Os índices numéricos são:
     - 0: Analógico Esquerdo - Eixo Horizontal (X) [Esquerda/Direita]
     - 1: Analógico Esquerdo - Eixo Vertical (Y) [Frente/Trás]
     - 2: Analógico Direito - Eixo Horizontal (X) [Snap/Smooth Turn]
     - 3: Analógico Direito - Eixo Vertical (Y)
     Exemplo: const stickX = Input.getGamepadAxis(0);
7. REDE E MULTIPLAYER: Utilize 'engine.network' para conexões multiplayer em tempo real:
   - engine.network.isConnected(): checa se está em rede.
   - engine.network.getPlayerId(): ID do jogador local.
   - engine.network.send(packet): envia pacote customizado para a sala.
   - Os pacotes customizados recebidos de outros jogadores ficam salvos no barramento global 'window.gameMultiplayerState[packetType]'.
8. ÁUDIO DINÂMICO: Declare variáveis públicas exportadas terminando em 'Sound', 'Audio' ou 'Clip' (ex: export let shootSound = "";). O Inspector do editor gerará um dropdown seletor de arquivos de som do projeto automaticamente. Para tocar no script: if (shootSound) new Audio(shootSound).play().catch(e=>{});
9. SUPORTE A WEBXR (VR/AR):
   - Escala física realista de 1:1 (1 unidade = 1 metro). Câmeras em primeira pessoa/headsets devem iniciar em uma altura de olhos correspondente a ~1.6m.
   - Use 'window.isVRActive' para verificar dinamicamente se o headset WebXR está imersivo, habilitando controles espaciais 3D/gamepads e contornando controles restritos a 2D (como WASD ou lockMouse).
   - Para locomoção confortável (Teleport), marque entidades com a tag "teleport" e teletransporte alterando a translação do 'rigidBody' ou 'Transform' do jogador.
10. TRIGONOMETRIA E ROTAÇÕES: Rotações de componentes do ECS estão em GRAUS, enquanto funções do JavaScript (Math.sin, Math.cos, Euler do Three.js) esperam RADIANOS. Converta usando: rad = deg * (Math.PI / 180).
11. PERSISTÊNCIA DE ESTADO: Declare variáveis locais no escopo do arquivo principal do script, fora das funções 'onAwake' ou 'onUpdate', para que persistam reativamente entre frames. Não utilize 'this', 'globalThis' ou propriedades vinculadas às funções.
12. HUD VISOR (PLACAR E NOTIFICAÇÕES): Para interagir com o HUD Visor (HUD2D na tela ou HUD3D em VR/MR), envie CustomEvents globais no objeto 'window':
    - Disparar Notificação: window.dispatchEvent(new CustomEvent('hud-notification', { detail: { text: 'Alerta/Mensagem!' } }));
    - Atualizar Placar: window.dispatchEvent(new CustomEvent('game-score-updated', { detail: { home: 1, away: 0, labelHome: 'P1', labelAway: 'P2' } }));
    - Alterar Fase de Jogo: window.dispatchEvent(new CustomEvent('game-phase-changed', { detail: { phase: 'match', winner: undefined } })); // Fases: 'waiting' | 'countdown' | 'match' | 'goal' | 'endgame'
    - Atualizar Tempo de Jogo: window.dispatchEvent(new CustomEvent('game-timer-updated', { detail: { formattedTime: '00:00' } }));`;
}
