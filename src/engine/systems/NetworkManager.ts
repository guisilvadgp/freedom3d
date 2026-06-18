import { useEditorStore } from '../../editor/store/editorStore';
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

  constructor() {}

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
    useEditorStore.getState().addLog('info', `Conectando ao multiplayer como ${this.playerId}...`);

    try {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        this.connected = true;
        console.log(`[Network] Conectado com sucesso!`);
        useEditorStore.getState().addLog('info', `Multiplayer: Conectado ao servidor.`);

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
          name: `Player_${this.playerId}`
        }));
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
        useEditorStore.getState().addLog('error', `Multiplayer: Erro de conexão`);
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
      useEditorStore.getState().addLog('warn', `Multiplayer: Desconectado.`);
      
      // Remove todos os ghosts do jogador remoto da cena para limpar
      this.removeAllGhosts();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  // Envia a posição e rotação local a cada tick se necessário (com throttle)
  sendState(_entityId: string, transform: { position: [number, number, number]; rotation: [number, number, number] }) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    // Limita o envio de rede de acordo com a taxa desejada (ex: máximo 20 Hz, ou seja, a cada 50ms)
    const now = performance.now();
    if (now - this.lastSentTime < 50) return;
    this.lastSentTime = now;

    const packet = {
      type: 'move',
      playerId: this.playerId,
      position: transform.position,
      rotation: transform.rotation
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

    const store = useEditorStore.getState();
    const scene = store.activeScene();
    if (!scene) return;

    switch (packet.type) {
      case 'room-players':
        // Recebe a lista dos outros que já estavam na sala
        if (packet.players && Array.isArray(packet.players)) {
          packet.players.forEach((p: any) => {
            this.createOrUpdateGhost(p.playerId, p.position, p.rotation);
          });
        }
        break;

      case 'player-joined':
        // Outro jogador entrou
        useEditorStore.getState().addLog('info', `Jogador ${packet.playerId} entrou no jogo.`);
        this.createOrUpdateGhost(packet.playerId, packet.position, packet.rotation);
        break;

      case 'player-moved':
        // Movimento de outro jogador
        this.createOrUpdateGhost(packet.playerId, packet.position, packet.rotation);
        break;

      case 'player-left':
        // Outro jogador saiu
        useEditorStore.getState().addLog('warn', `Jogador ${packet.playerId} saiu do jogo.`);
        this.removeGhost(packet.playerId);
        break;
    }
  }

  private createOrUpdateGhost(remotePlayerId: string, position: [number, number, number], rotation: [number, number, number]) {
    const store = useEditorStore.getState();
    const scene = store.activeScene();
    if (!scene) return;

    const ghostId = `ghost-${remotePlayerId}`;
    const existingGhost = scene.entities[ghostId];

    if (!existingGhost) {
      // Cria a entidade ghost
      const ghostEntity: Entity = {
        id: ghostId,
        name: `Ghost_${remotePlayerId.substring(0, 6)}`,
        parentId: null,
        childrenIds: [],
        active: true,
        tags: ['multiplayer-ghost'],
        components: {
          Transform: {
            type: 'Transform',
            position: position,
            rotation: rotation,
            scale: [1, 1, 1]
          },
          MeshRenderer: {
            type: 'MeshRenderer',
            geometry: 'cylinder',
            material: 'phong',
            color: '#ec4899', // Rosa vibrante premium
            castShadow: true,
            receiveShadow: true
          },
          Network: {
            type: 'Network',
            isLocal: false,
            syncPosition: true,
            syncRotation: true,
            syncAnimation: false,
            sendRate: 20
          }
        }
      };

      useEditorStore.setState((s) => ({
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
      // Atualiza a posição e rotação
      store.updateComponent(ghostId, 'Transform', {
        position,
        rotation
      });
    }
  }

  private removeGhost(remotePlayerId: string) {
    const store = useEditorStore.getState();
    const scene = store.activeScene();
    if (!scene) return;

    const ghostId = `ghost-${remotePlayerId}`;
    if (!scene.entities[ghostId]) return;

    const newEntities = { ...scene.entities };
    delete newEntities[ghostId];

    useEditorStore.setState((s) => ({
      scenes: {
        ...s.scenes,
        [scene.id]: {
          ...scene,
          entities: newEntities,
          rootEntityIds: scene.rootEntityIds.filter(id => id !== ghostId)
        }
      }
    }));
  }

  private removeAllGhosts() {
    const store = useEditorStore.getState();
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
      useEditorStore.setState((s) => ({
        scenes: {
          ...s.scenes,
          [scene.id]: {
            ...scene,
            entities: newEntities,
            rootEntityIds: scene.rootEntityIds.filter(id => !id.startsWith('ghost-'))
          }
        }
      }));
    }
  }

  private findLocalPlayerTransform(): { id: string; position: [number, number, number]; rotation: [number, number, number] } | null {
    const store = useEditorStore.getState();
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
