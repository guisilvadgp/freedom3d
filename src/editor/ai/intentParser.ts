// ─────────────────────────────────────────────────────────────────────────────
// intentParser.ts
// Parser de intenção NLP local — sem API, sem rede.
// Converte frases em linguagem natural para intents estruturados.
// ─────────────────────────────────────────────────────────────────────────────

export type AgentType = 'scene' | 'gameplay' | 'ai' | 'scripts' | 'assets' | 'integration' | 'orchestrator';

export interface Intent {
  agent: AgentType;
  action: string;
  params: Record<string, any>;
  confidence: number; // 0-1
  rawText: string;
}

export interface ParseResult {
  intents: Intent[];
  isComplex: boolean; // múltiplos agentes necessários
  suggestedPlan: string[];
  unknownParts: string[];
}

// ─── Dicionário de padrões ────────────────────────────────────────────────────

const SCENE_PATTERNS: Array<{ pattern: RegExp; action: string; extractParams: (m: RegExpMatchArray) => Record<string, any> }> = [
  // Criar primitivos
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(cubo|box|caixa)\b/i, action: 'create_entity', extractParams: () => ({ type: 'cube' }) },
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(esfera|sphere|bola)\b/i, action: 'create_entity', extractParams: () => ({ type: 'sphere' }) },
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(plano|plane|ch[aã]o|piso|ch\w+)\b/i, action: 'create_entity', extractParams: () => ({ type: 'plane' }) },
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(cilindro|cylinder)\b/i, action: 'create_entity', extractParams: () => ({ type: 'cylinder' }) },
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(torus|anel|argola)\b/i, action: 'create_entity', extractParams: () => ({ type: 'torus' }) },
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(c[aá]psula|capsule)\b/i, action: 'create_entity', extractParams: () => ({ type: 'capsule' }) },
  // VR Position / Teleport Point
  { pattern: /\b(cri[ae]|adicione?|coloque?|insira)\b.*\b(teleport|teleporte|vr\s+position|ponto\s+de\s+teleporte|ancora\s+de\s+teleporte)\b/i, action: 'create_teleport', extractParams: () => ({}) },
  // Fog / Neblina
  { pattern: /\b(habilit[ae]|ativ[ae]|ligue?|enable)\b.*\b(fog|neblina|n[eé]voa|bruma)\b/i, action: 'set_fog', extractParams: () => ({ enabled: true }) },
  { pattern: /\b(desabilit[ae]|desativ[ae]|desligue?|disable)\b.*\b(fog|neblina|n[eé]voa)\b/i, action: 'set_fog', extractParams: () => ({ enabled: false }) },
  // Background
  { pattern: /\b(fundo|background|cor\s+de\s+fundo|backgroud)\b.*\b(preto|black|escuro)\b/i, action: 'set_background', extractParams: () => ({ color: '#000000' }) },
  { pattern: /\b(fundo|background|cor\s+de\s+fundo)\b.*\b(branco|white)\b/i, action: 'set_background', extractParams: () => ({ color: '#ffffff' }) },
  { pattern: /\b(fundo|background|cor\s+de\s+fundo)\b.*\b(azul|blue)\b/i, action: 'set_background', extractParams: () => ({ color: '#1a1a3e' }) },
  { pattern: /\b(fundo|background|cor\s+de\s+fundo)\b.*\b(vermelho|red)\b/i, action: 'set_background', extractParams: () => ({ color: '#1a0000' }) },
  { pattern: /\b(fundo|background|cor\s+de\s+fundo)\b.*\b(verde|green)\b/i, action: 'set_background', extractParams: () => ({ color: '#001a00' }) },
  { pattern: /\b(fundo|background|cor\s+de\s+fundo)\b.*?(#[0-9a-fA-F]{3,6})\b/i, action: 'set_background', extractParams: (m) => ({ color: m[2] }) },
  // Luz
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(luz\s+direcional|directional\s+light)\b/i, action: 'create_entity', extractParams: () => ({ type: 'directional' }) },
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(luz\s+pontual|point\s+light|luz\s+ponto)\b/i, action: 'create_entity', extractParams: () => ({ type: 'point' }) },
  // Câmera
  { pattern: /\b(c[aâ]mera|camera)\b.*\b(terceira\s+pessoa|third.?person|3(rd|ª)\s*pessoa)\b/i, action: 'create_camera', extractParams: () => ({ mode: 'third-person' }) },
  { pattern: /\b(c[aâ]mera|camera)\b.*\b(primeira\s+pessoa|first.?person|fps|1(st|ª)\s*pessoa)\b/i, action: 'create_camera', extractParams: () => ({ mode: 'first-person' }) },
  { pattern: /\b(c[aâ]mera|camera)\b.*\b(vr|xr|webxr|imersiv[ao])\b/i, action: 'create_camera_vr', extractParams: () => ({}) },
  { pattern: /\b(adicione?|cri[ae])\b.*\b(c[aâ]mera|camera)\b/i, action: 'create_entity', extractParams: () => ({ type: 'camera' }) },
  // Ambiente
  { pattern: /\b(ambientIntensity|intensidade\s+ambiente|luz\s+ambiente)\b/i, action: 'set_ambient', extractParams: () => ({}) },
];

const GAMEPLAY_PATTERNS: Array<{ pattern: RegExp; action: string; extractParams: (m: RegExpMatchArray) => Record<string, any> }> = [
  // Movimentação
  { pattern: /\b(movimenta[cç][aã]o|movimento|move|mover|locomov)\b.*\b(personagem|player|jogador|herói)\b/i, action: 'create_movement', extractParams: () => ({ type: 'wasd' }) },
  { pattern: /\b(personagem|player|jogador)\b.*\b(movimenta[cç][aã]o|movimento|move|mover|anda)\b/i, action: 'create_movement', extractParams: () => ({ type: 'wasd' }) },
  { pattern: /\b(wasd|controle\s+wasd|movement\s+wasd)\b/i, action: 'create_movement', extractParams: () => ({ type: 'wasd' }) },
  // Pulo
  { pattern: /\b(sistema\s+de\s+pulo|pulo|salto|jump|pular)\b/i, action: 'add_jump', extractParams: () => ({}) },
  // Sprint
  { pattern: /\b(sprint|corrida|correr|run)\b/i, action: 'add_sprint', extractParams: () => ({}) },
  // Vida
  { pattern: /\b(sistema\s+de\s+vida|vida|health|hp|pontos\s+de\s+vida)\b/i, action: 'create_health', extractParams: () => ({}) },
  // Dano
  { pattern: /\b(sistema\s+de\s+dano|dano|damage)\b/i, action: 'create_damage', extractParams: () => ({}) },
  // Inventário
  { pattern: /\b(sistema\s+de\s+invent[aá]rio|invent[aá]rio|inventory)\b/i, action: 'create_inventory', extractParams: () => ({}) },
  // Player completo
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(jogador|player|personagem)\b.*\b(primeira\s+pessoa|fps|first.?person)\b/i, action: 'create_player', extractParams: () => ({ type: 'first-person' }) },
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(jogador|player|personagem)\b.*\b(terceira\s+pessoa|third.?person)\b/i, action: 'create_player', extractParams: () => ({ type: 'third-person' }) },
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(jogador|player|personagem)\b.*\b(vr|xr|webxr|imersiv[ao])\b/i, action: 'create_vr_player', extractParams: () => ({}) },
  { pattern: /\b(sistema\s+de\s+)?(teleporte|teleportation|locomocao\s+vr|locomocao\s+sem\s+fio)\b/i, action: 'create_teleport_system', extractParams: () => ({}) },
];

const AI_PATTERNS: Array<{ pattern: RegExp; action: string; extractParams: (m: RegExpMatchArray) => Record<string, any> }> = [
  // Chase
  { pattern: /\b(inimigo|enemy|bot)\b.*\b(segue|persegue|chase|seguir|perseguir)\b/i, action: 'create_enemy_chase', extractParams: () => ({}) },
  { pattern: /\b(segue|persegue|chase)\b.*\b(jogador|player|personagem)\b/i, action: 'create_enemy_chase', extractParams: () => ({}) },
  // Patrol
  { pattern: /\b(inimigo|enemy|bot)\b.*\b(patrulha|patrol|ronda)\b/i, action: 'create_enemy_patrol', extractParams: () => ({}) },
  // AI básica
  { pattern: /\b(ia|ai|intelig[eê]ncia\s+artificial)\b.*\b(b[aá]sica|basic|simples|simple)\b/i, action: 'create_ai_basic', extractParams: () => ({}) },
  { pattern: /\b(b[aá]sica|basic|simples)\b.*\b(ia|ai|inimigo|enemy)\b/i, action: 'create_ai_basic', extractParams: () => ({}) },
  // Ataque
  { pattern: /\b(inimigo|enemy)\b.*\b(ataca|attack|ataque)\b/i, action: 'create_enemy_attack', extractParams: () => ({}) },
  // FSM
  { pattern: /\b(m[aá]quina\s+de\s+estados?|fsm|state\s+machine)\b/i, action: 'create_fsm', extractParams: () => ({}) },
  // Visão
  { pattern: /\b(campo\s+de\s+vis[aã]o|vis[aã]o|field\s+of\s+view|fov\s+ia|vision)\b/i, action: 'create_vision', extractParams: () => ({}) },
  // Inimigo genérico
  { pattern: /\b(cri[ae]|adicione?)\b.*\b(inimigo|enemy|bot)\b/i, action: 'create_enemy_basic', extractParams: () => ({}) },
];

const SCRIPT_PATTERNS: Array<{ pattern: RegExp; action: string; extractParams: (m: RegExpMatchArray) => Record<string, any> }> = [
  // Arma
  { pattern: /\b(script|arquivo)\b.*\b(arma|arma\s+de\s+fogo|gun|weapon|pistola|rifle|espada)\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'weapon' }) },
  { pattern: /\b(arma|weapon|gun)\b.*\bscript\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'weapon' }) },
  // Munição
  { pattern: /\b(script|arquivo)\b.*\b(muni[cç][aã]o|ammo|bala|projétil|bullet)\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'ammo' }) },
  // Inimigo script
  { pattern: /\b(script|arquivo)\b.*\b(inimigo|enemy)\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'enemy' }) },
  // Interação
  { pattern: /\b(script|arquivo)\b.*\b(intera[cç][aã]o|interact|interagir)\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'interaction' }) },
  // Coletor
  { pattern: /\b(script|arquivo)\b.*\b(coletor|collectable|item)\b/i, action: 'create_script', extractParams: () => ({ scriptType: 'collectable' }) },
  // Múltiplos scripts
  { pattern: /(\d+|dois|três|tres|two|three)\s+scripts?\b/i, action: 'create_multiple_scripts', extractParams: (m) => {
    const countWord = m[1].toLowerCase();
    const count = { 'dois': 2, 'two': 2, 'três': 3, 'tres': 3, 'three': 3 }[countWord] ?? parseInt(countWord) ?? 2;
    return { count };
  }},
];

const INTEGRATION_PATTERNS: Array<{ pattern: RegExp; action: string; extractParams: (m: RegExpMatchArray) => Record<string, any> }> = [
  { pattern: /\b(conect[ae]|link[ae]|integre?|vínculo)\b.*\b(arma|weapon)\b.*\b(jogador|player)\b/i, action: 'connect_weapon_player', extractParams: () => ({}) },
  { pattern: /\b(conect[ae]|link[ae]|integre?)\b.*\b(ia|ai|inimigo)\b.*\b(vida|health)\b/i, action: 'connect_ai_health', extractParams: () => ({}) },
  { pattern: /\b(conect[ae]|link[ae]|integre?)\b.*\b(invent[aá]rio)\b.*\b(coleta|collect)\b/i, action: 'connect_inventory_collect', extractParams: () => ({}) },
];

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseIntent(prompt: string): ParseResult {
  const intents: Intent[] = [];
  const unknownParts: string[] = [];
  const lower = prompt.toLowerCase().trim();

  // Testa padrões de CENA
  for (const p of SCENE_PATTERNS) {
    const m = lower.match(p.pattern);
    if (m) {
      intents.push({
        agent: 'scene',
        action: p.action,
        params: p.extractParams(m),
        confidence: 0.9,
        rawText: prompt,
      });
    }
  }

  // Testa padrões de GAMEPLAY
  for (const p of GAMEPLAY_PATTERNS) {
    const m = lower.match(p.pattern);
    if (m) {
      intents.push({
        agent: 'gameplay',
        action: p.action,
        params: p.extractParams(m),
        confidence: 0.85,
        rawText: prompt,
      });
    }
  }

  // Testa padrões de IA
  for (const p of AI_PATTERNS) {
    const m = lower.match(p.pattern);
    if (m) {
      intents.push({
        agent: 'ai',
        action: p.action,
        params: p.extractParams(m),
        confidence: 0.85,
        rawText: prompt,
      });
    }
  }

  // Testa padrões de SCRIPTS
  for (const p of SCRIPT_PATTERNS) {
    const m = lower.match(p.pattern);
    if (m) {
      // Extrai nomes de scripts citados no texto
      const scriptNames = extractScriptNames(prompt);
      intents.push({
        agent: 'scripts',
        action: p.action,
        params: { ...p.extractParams(m), scriptNames },
        confidence: 0.85,
        rawText: prompt,
      });
    }
  }

  // Testa padrões de INTEGRAÇÃO
  for (const p of INTEGRATION_PATTERNS) {
    const m = lower.match(p.pattern);
    if (m) {
      intents.push({
        agent: 'integration',
        action: p.action,
        params: p.extractParams(m),
        confidence: 0.8,
        rawText: prompt,
      });
    }
  }

  // Remove intents duplicados (mesmo agent+action)
  const unique = deduplicateIntents(intents);

  // Gera plano de execução sugerido
  const suggestedPlan = buildPlan(unique);

  // Se não encontrou nada, delega para AI
  if (unique.length === 0) {
    unknownParts.push(prompt);
  }

  return {
    intents: unique,
    isComplex: unique.length > 1,
    suggestedPlan,
    unknownParts,
  };
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function extractScriptNames(text: string): string[] {
  const names: string[] = [];
  // Detecta "script de X e Y" ou "scripts: X, Y"
  const listMatch = text.match(/scripts?\s*[:\-]?\s*(.+)/i);
  if (listMatch) {
    const parts = listMatch[1].split(/\s+e\s+|,\s*|\s+e\s*/i);
    parts.forEach(p => {
      const clean = p.trim().replace(/\.$/, '');
      if (clean.length > 1) names.push(clean);
    });
  }
  return names;
}

function deduplicateIntents(intents: Intent[]): Intent[] {
  const seen = new Set<string>();
  return intents.filter(i => {
    const key = `${i.agent}:${i.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPlan(intents: Intent[]): string[] {
  const agentNames: Record<AgentType, string> = {
    scene: '🎬 Agente de Cena',
    gameplay: '🎮 Agente de Gameplay',
    ai: '🤖 Agente de IA',
    scripts: '📜 Agente de Scripts',
    assets: '🎨 Agente de Assets',
    integration: '🔗 Agente de Integração',
    orchestrator: '🧠 Orquestrador',
  };

  const actionLabels: Record<string, string> = {
    create_entity: 'Criar entidade na cena',
    set_fog: 'Configurar neblina (fog)',
    set_background: 'Alterar cor de fundo',
    create_camera: 'Configurar câmera',
    create_camera_vr: 'Configurar câmera para VR/WebXR',
    set_ambient: 'Ajustar iluminação ambiente',
    create_movement: 'Gerar script de movimentação WASD',
    add_jump: 'Adicionar mecânica de pulo',
    add_sprint: 'Adicionar mecânica de sprint',
    create_health: 'Criar sistema de vida',
    create_damage: 'Criar sistema de dano',
    create_inventory: 'Criar sistema de inventário',
    create_player: 'Criar entidade do jogador',
    create_vr_player: 'Criar jogador imersivo VR',
    create_teleport: 'Criar ponto de teleporte VR',
    create_teleport_system: 'Gerar sistema de teleporte VR',
    create_enemy_chase: 'Criar IA de perseguição',
    create_enemy_patrol: 'Criar IA de patrulha',
    create_ai_basic: 'Criar IA básica do inimigo',
    create_enemy_attack: 'Criar mecânica de ataque do inimigo',
    create_enemy_basic: 'Criar entidade inimigo',
    create_fsm: 'Criar máquina de estados',
    create_vision: 'Criar sistema de visão',
    create_script: 'Gerar script especializado',
    create_multiple_scripts: 'Gerar múltiplos scripts',
    connect_weapon_player: 'Conectar arma ao jogador',
    connect_ai_health: 'Integrar IA com sistema de vida',
    connect_inventory_collect: 'Integrar inventário com coleta',
  };

  return intents.map((intent, i) => {
    const agentName = agentNames[intent.agent] || intent.agent;
    const actionLabel = actionLabels[intent.action] || intent.action;
    return `${i + 1}. ${agentName} → ${actionLabel}`;
  });
}
