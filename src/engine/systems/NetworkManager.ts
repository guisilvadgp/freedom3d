import { Entity } from '../ecs/types';
import { useEditorStore } from '../../editor/store/editorStore';

export interface NetworkConfig {
  serverUrl: string;
  roomName: string;
}

export class NetworkManager {
  private socket: WebSocket | null = null;
  private connected: boolean = false;
  private serverUrl: string = 'ws://localhost:3000';
  private roomId: string = 'default-room';
  private playerId: string = '';

  constructor() {}

  connect(config?: Partial<NetworkConfig>) {
    if (config?.serverUrl) this.serverUrl = config.serverUrl;
    if (config?.roomName) this.roomId = config.roomName;

    // TODO: Implementar conexão WebSocket real ou Colyseus client
    console.log(`[Network] Conectando a ${this.serverUrl} (Room: ${this.roomId})...`);
    
    // Simulação de conexão local
    setTimeout(() => {
      this.connected = true;
      this.playerId = 'player-' + Math.floor(Math.random() * 1000);
      console.log(`[Network] Conectado! PlayerID: ${this.playerId}`);
      useEditorStore.getState().addLog('info', `Conectado ao servidor multiplayer como ${this.playerId}`);
    }, 1000);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this.connected = false;
    console.log('[Network] Desconectado.');
    useEditorStore.getState().addLog('info', `Desconectado do servidor multiplayer`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Replicação (Enviar estado local)
  sendState(entityId: string, transform: any) {
    if (!this.connected) return;
    const packet = {
      type: 'SYNC_TRANSFORM',
      playerId: this.playerId,
      entityId,
      position: transform.position,
      rotation: transform.rotation,
      timestamp: Date.now()
    };
    // this.socket.send(JSON.stringify(packet));
  }

  // Receber estado remoto (Mock)
  onReceiveState(packet: any) {
    if (packet.playerId === this.playerId) return; // Ignora o próprio state

    // Matchmaking / Sync logic
    // const { activeScene, updateComponent } = useEditorStore.getState();
    // const entity = activeScene().entities[packet.entityId];
    // if (entity) {
    //   updateComponent(entity.id, 'Transform', {
    //     position: packet.position,
    //     rotation: packet.rotation
    //   });
    // }
  }
}

export const Network = new NetworkManager();
