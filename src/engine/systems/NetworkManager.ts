import { getEngineStore } from '../runtime/runtimeStore';
import type { Entity } from '../ecs/types';

export interface NetworkConfig {
  serverUrl: string;
  roomName: string;
}

export class NetworkManager {
  private socket: WebSocket | null = null;
  private connected: boolean = false;
  private serverUrl: string = '';
  private roomId: string = 'default-room';
  private playerId: string = '';
  private lastSentTime: number = 0;

  constructor() { }

  connect(config?: Partial<NetworkConfig>) {
    if (this.socket) {
      this.disconnect();
    }

    if (config?.roomName) this.roomId = config.roomName;

    // Constrói a URL do WebSocket automaticamente com base no host atual do navegador
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';

    this.serverUrl = config?.serverUrl || `${wsProtocol}//${host}/api/multiplayer`;
    this.playerId = 'player-' + Math.floor(Math.random() * 10000);

    console.log(`[Network] Conectando a ${this.serverUrl} (Room: ${this.roomId}) como ${this.playerId}...`);
    getEngineStore().getState().addLog('info', `Conectando ao multiplayer como ${this.playerId}...`);

    try {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        this.connected = true;
        console.log(`[Network] Conectado com sucesso!`);
        getEngineStore().getState().addLog('info', `Multiplayer: Conectado ao servidor.`);

        // Busca posição/rotação do jogador local para enviar no join
        const localData = this.findLocalPlayerTransform();

        const initialPos = localData?.position || [0, 1.5, 0];
        const initialRot = localData?.rotation || [0, 0, 0];

        // Envia mensagem de Join
        this.socket?.send(JSON.stringify({
          type: 'join',
          playerId: this.playerId,
          roomId: this.roomId,
          position: initialPos,
          rotation: initialRot,
          name: `Player_${this.playerId}`,
          role: window.playerRole || 'red'
        }));

        window.dispatchEvent(new CustomEvent('multiplayer-players-update'));
      };

      this.socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.onReceiveState(packet);
        } catch (e) {
          console.error('[Network] Erro ao decodificar mensagem:', e);
        }
      };

      this.socket.onclose = () => {
        this.handleDisconnect();
      };

      this.socket.onerror = (err) => {
        console.error('[Network] WebSocket error:', err);
        getEngineStore().getState().addLog('error', `Multiplayer: Erro de conexão`);
      };

    } catch (err) {
      console.error('[Network] Erro ao instanciar WebSocket:', err);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.handleDisconnect();
  }

  private handleDisconnect() {
    if (this.connected) {
      this.connected = false;
      console.log('[Network] Desconectado do servidor.');
      getEngineStore().getState().addLog('warn', `Multiplayer: Desconectado.`);

      // Remove todos os ghosts do jogador remoto da cena para limpar
      this.removeAllGhosts();
      window.dispatchEvent(new CustomEvent('multiplayer-players-update'));
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  // Método genérico para scripts enviarem pacotes personalizados
  send(packet: any) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      if (!packet.playerId) {
        packet.playerId = this.playerId;
      }
      this.socket.send(JSON.stringify(packet));
    } catch (e) {
      console.error('[Network] Erro ao enviar pacote genérico:', e);
    }
  }

  // Envia a posição e rotação local a cada tick se necessário (com throttle)
  sendState(_entityId: string, transform: { position: [number, number, number]; rotation: [number, number, number] }) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    // Limita o envio de rede de acordo com a taxa desejada (ex: máximo 20 Hz, ou seja, a cada 50ms)
    const now = performance.now();
    if (now - this.lastSentTime < 50) return;
    this.lastSentTime = now;

    const store = getEngineStore().getState();
    const scene = store.activeScene();
    let playbackRate: number | undefined;
    let volume: number | undefined;
    if (scene) {
      const localPlayerEntity = Object.values(scene.entities).find((e) => 
        e.components.Network && e.components.Network.isLocal
      );
      if (localPlayerEntity && localPlayerEntity.components.Audio) {
        playbackRate = localPlayerEntity.components.Audio.playbackRate;
        volume = localPlayerEntity.components.Audio.volume;
      }
    }

    const packet = {
      type: 'move',
      playerId: this.playerId,
      position: transform.position,
      rotation: transform.rotation,
      role: window.playerRole || 'red',
      playbackRate,
      volume
    };

    try {
      this.socket.send(JSON.stringify(packet));
    } catch (e) {
      // Ignorar erros ocasionais de send durante desconexão
    }
  }

  // Trata a entrada de mensagens de outros jogadores
  private onReceiveState(packet: any) {
    if (!packet || packet.playerId === this.playerId) return;

    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return;

    switch (packet.type) {
      case 'room-players':
        // Recebe a lista dos outros que já estavam na sala
        if (packet.players && Array.isArray(packet.players)) {
          packet.players.forEach((p: any) => {
            this.createOrUpdateGhost(p.playerId, p.position, p.rotation, p.role || 'red', p.ready || false, p.playbackRate, p.volume);
          });
        }
        break;

      case 'player-joined':
        // Outro jogador entrou
        getEngineStore().getState().addLog('info', `Jogador ${packet.playerId} entrou no jogo como ${packet.role || 'red'}.`);
        this.createOrUpdateGhost(packet.playerId, packet.position, packet.rotation, packet.role || 'red', packet.ready || false, packet.playbackRate, packet.volume);
        break;

      case 'player-moved':
        // Movimento de outro jogador
        this.createOrUpdateGhost(packet.playerId, packet.position, packet.rotation, packet.role || 'red', packet.ready || false, packet.playbackRate, packet.volume);
        break;

      case 'role-update':
        // Outro jogador mudou de papel
        getEngineStore().getState().addLog('info', `Jogador ${packet.playerId} mudou para o time ${packet.role}.`);
        this.createOrUpdateGhost(packet.playerId, packet.position || [0, 1.5, 0], packet.rotation || [0, 0, 0], packet.role, packet.ready || false, packet.playbackRate, packet.volume);
        break;

      case 'player-ready':
        // Outro jogador mudou seu status de pronto
        this.updateGhostReadyStatus(packet.playerId, packet.ready);
        break;

      case 'player-left':
        // Outro jogador saiu
        getEngineStore().getState().addLog('warn', `Jogador ${packet.playerId} saiu do jogo.`);
        this.removeGhost(packet.playerId);
        break;

      default:
        // Qualquer outro tipo de pacote (ball-sync, score-sync, etc.)
        if (typeof window !== 'undefined') {
          if (!window.soccerMultiplayerState) {
            window.soccerMultiplayerState = {};
          }
          window.soccerMultiplayerState[packet.type] = packet;

          // Dispara um evento global com o conteúdo do pacote para extensibilidade
          window.dispatchEvent(new CustomEvent('network-packet', { detail: packet }));
          window.dispatchEvent(new CustomEvent(`network-packet-${packet.type}`, { detail: packet }));
        }
        break;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('multiplayer-players-update'));
    }
  }

  private createOrUpdateGhost(
    remotePlayerId: string, 
    position: [number, number, number], 
    rotation: [number, number, number], 
    role: string, 
    ready = false,
    playbackRate?: number,
    volume?: number
  ) {
    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return;

    const ghostId = `ghost-${remotePlayerId}`;
    const existingGhost = scene.entities[ghostId];

    // Define cor do time do Ghost
    // Vermelho: #f43f5e (Home) | Azul: #3b82f6 (Away) | Jogador Genérico: #10b981 | Espectador: Invisível
    const color = role === 'blue' ? '#3b82f6' : role === 'player' ? '#10b981' : role === 'spectator' ? '#ffffff' : '#f43f5e';
    const active = role !== 'spectator'; // Se for espectador, desativa visualização dele no campo

    if (!existingGhost) {
      // Tenta encontrar o modelo 3D GLTF e o componente de Audio do jogador local na cena para copiar no ghost
      let playerGltfModel: any = null;
      let playerAnimator: any = null;
      let playerAudio: any = null;
      for (const [id, entity] of Object.entries(scene.entities) as [string, any][]) {
        if (!id.startsWith('ghost-')) {
          if (entity.components.GLTFModel) {
            playerGltfModel = entity.components.GLTFModel;
            playerAnimator = entity.components.Animator;
          }
          if (entity.components.Audio) {
            playerAudio = entity.components.Audio;
          }
        }
      }

      const ghostComponents: any = {
        Transform: {
          type: 'Transform',
          position: position,
          rotation: rotation,
          scale: [1, 1, 1]
        },
        Network: {
          type: 'Network',
          isLocal: false,
          syncPosition: true,
          syncRotation: true,
          syncAnimation: false,
          sendRate: 20,
          role: role,
          ready: ready
        }
      };

      if (playerAudio) {
        ghostComponents.Audio = {
          ...playerAudio,
          is3D: true
        };
        if (typeof playbackRate === 'number') {
          ghostComponents.Audio.playbackRate = playbackRate;
        }
        if (typeof volume === 'number') {
          ghostComponents.Audio.volume = volume;
        }
      }

      if (playerGltfModel) {
        ghostComponents.GLTFModel = {
          ...playerGltfModel
        };
        if (playerAnimator) {
          ghostComponents.Animator = {
            ...playerAnimator
          };
        }
      } else {
        ghostComponents.MeshRenderer = {
          type: 'MeshRenderer',
          geometry: 'capsule',
          material: 'standard',
          color: color,
          castShadow: true,
          receiveShadow: true
        };
        ghostComponents.Transform.scale = [1.2, 1.2, 1.2];
      }

      // Cria a entidade ghost
      const ghostEntity: Entity = {
        id: ghostId,
        name: `Ghost_${remotePlayerId.substring(0, 6)}`,
        parentId: null,
        childrenIds: [],
        active: active,
        tags: ['multiplayer-ghost'],
        components: ghostComponents
      };

      getEngineStore().setState((s: any) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: { ...scene.entities, [ghostId]: ghostEntity },
            rootEntityIds: [...scene.rootEntityIds, ghostId]
          }
        }
      }));
    } else {
      // Atualiza a posição, rotação
      store.updateComponent(ghostId, 'Transform', {
        position,
        rotation
      });

      // Atualiza o estado ativo se necessário
      if (existingGhost.active !== active) {
        getEngineStore().setState((s: any) => {
          const currentScene = s.scenes[scene.id];
          if (!currentScene) return {};
          const currentGhost = currentScene.entities[ghostId];
          if (!currentGhost) return {};
          return {
            scenes: {
              ...s.scenes,
              [scene.id]: {
                ...currentScene,
                entities: {
                  ...currentScene.entities,
                  [ghostId]: { ...currentGhost, active: active }
                }
              }
            }
          };
        });
      }

      // Atualiza a cor se necessário
      const currentMeshRenderer = existingGhost.components.MeshRenderer;
      if (currentMeshRenderer && currentMeshRenderer.color !== color) {
        store.updateComponent(ghostId, 'MeshRenderer', { color });
      }

      // Atualiza o papel e o status ready no componente Network se necessário
      const currentNetwork = existingGhost.components.Network;
      if (currentNetwork) {
        const updates: Partial<import('../ecs/types').NetworkComponent> = {};
        if (currentNetwork.role !== role) updates.role = role;
        if (currentNetwork.ready !== ready) updates.ready = ready;
        if (Object.keys(updates).length > 0) {
          store.updateComponent(ghostId, 'Network', updates);
        }
      }

      // Atualiza o componente de Audio do ghost se necessário
      const currentAudio = existingGhost.components.Audio;
      if (currentAudio) {
        const audioUpdates: any = {};
        if (typeof playbackRate === 'number' && currentAudio.playbackRate !== playbackRate) {
          audioUpdates.playbackRate = playbackRate;
        }
        if (typeof volume === 'number' && currentAudio.volume !== volume) {
          audioUpdates.volume = volume;
        }
        if (Object.keys(audioUpdates).length > 0) {
          store.updateComponent(ghostId, 'Audio', audioUpdates);
        }
      }
    }
  }

  private updateGhostReadyStatus(remotePlayerId: string, ready: boolean) {
    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return;

    const ghostId = `ghost-${remotePlayerId}`;
    const existingGhost = scene.entities[ghostId];
    if (existingGhost) {
      store.updateComponent(ghostId, 'Network', { ready });
    }
  }

  private removeGhost(remotePlayerId: string) {
    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return;

    const ghostId = `ghost-${remotePlayerId}`;
    if (!scene.entities[ghostId]) return;

    const newEntities = { ...scene.entities };
    delete newEntities[ghostId];

    getEngineStore().setState((s) => ({
      scenes: {
        ...s.scenes,
        [scene.id]: {
          ...scene,
          entities: newEntities,
          rootEntityIds: scene.rootEntityIds.filter((id) => id !== ghostId)
        }
      }
    }));
  }

  private removeAllGhosts() {
    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return;

    const newEntities = { ...scene.entities };
    let changed = false;

    Object.keys(newEntities).forEach((id) => {
      if (id.startsWith('ghost-')) {
        delete newEntities[id];
        changed = true;
      }
    });

    if (changed) {
      getEngineStore().setState((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: newEntities,
            rootEntityIds: scene.rootEntityIds.filter((id) => !id.startsWith('ghost-'))
          }
        }
      }));
    }
  }

  private findLocalPlayerTransform(): { id: string; position: [number, number, number]; rotation: [number, number, number] } | null {
    const store = getEngineStore().getState();
    const scene = store.activeScene();
    if (!scene) return null;

    // Procura por entidade local que represente o jogador
    for (const entity of Object.values(scene.entities)) {
      if (entity.components.Network?.isLocal || entity.tags?.includes('player') || entity.components.Camera?.isMain) {
        return {
          id: entity.id,
          position: entity.components.Transform?.position || [0, 0, 0],
          rotation: entity.components.Transform?.rotation || [0, 0, 0]
        };
      }
    }
    return null;
  }
}

export const Network = new NetworkManager();
