import { useEffect, useState, useRef } from 'react';
import './DiscoverPage.css';

interface RoomInfo {
  roomId: string;
  name: string;
  coverImage: string;
  savedAt: number;
  entityCount: number;
}

export function DiscoverPage() {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [heroRoom, setHeroRoom] = useState<RoomInfo | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/rooms')
      .then(r => r.json())
      .then((data: RoomInfo[]) => {
        setRooms(data);
        if (data.length > 0) setHeroRoom(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (rooms.length > 0) {
      setHeroRoom(rooms[focusedIndex]);
    }
  }, [focusedIndex, rooms]);

  const handleCardFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleEnterRoom = (room: RoomInfo) => {
    window.location.href = `/room/${encodeURIComponent(room.roomId)}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setFocusedIndex(i => Math.min(i + 1, rooms.length - 1));
    } else if (e.key === 'ArrowLeft') {
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && heroRoom) {
      handleEnterRoom(heroRoom);
    }
  };

  const formatDate = (ts: number) => {
    if (!ts) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(ts));
  };

  const getCoverUrl = (room: RoomInfo) => {
    if (room.coverImage) return room.coverImage;
    return '';
  };

  if (loading) {
    return (
      <div className="discover-loading">
        <div className="discover-spinner" />
        <p>Carregando salas…</p>
      </div>
    );
  }

  return (
    <div className="discover-root" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <header className="discover-header">
        <div className="discover-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">Freedom<span className="logo-accent">3D</span></span>
        </div>
        <nav className="discover-nav">
          <a href="/" className="discover-nav-link">Editor</a>
          <a href="/discover" className="discover-nav-link active">Discover</a>
        </nav>
        <div className="discover-header-right">
          <span className="room-count">{rooms.length} {rooms.length === 1 ? 'sala' : 'salas'}</span>
        </div>
      </header>

      {/* Hero — Projeto em destaque */}
      {heroRoom && (
        <section className="discover-hero">
          <div
            className="hero-backdrop"
            style={{
              backgroundImage: getCoverUrl(heroRoom)
                ? `url(${getCoverUrl(heroRoom)})`
                : 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
            }}
          >
            <div className="hero-overlay" />
          </div>
          <div className="hero-content">
            <div className="hero-badge">VR ROOM</div>
            <h1 className="hero-title">{heroRoom.name}</h1>
            <div className="hero-meta">
              <span className="hero-stat">
                <span className="stat-icon">⬡</span>
                {heroRoom.entityCount} entidades
              </span>
              <span className="hero-dot">·</span>
              <span className="hero-stat">
                <span className="stat-icon">◷</span>
                {formatDate(heroRoom.savedAt)}
              </span>
            </div>
            <p className="hero-room-id">ID: {heroRoom.roomId}</p>
            <div className="hero-actions">
              <button
                className="hero-btn-primary"
                onClick={() => handleEnterRoom(heroRoom)}
              >
                <span>▶</span> Entrar na Sala
              </button>
              <button
                className="hero-btn-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/room/${heroRoom.roomId}`);
                }}
              >
                <span>⎘</span> Copiar Link
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Carrossel de Salas */}
      <section className="discover-shelf">
        <div className="shelf-header">
          <h2 className="shelf-title">Todas as Salas</h2>
          <span className="shelf-hint">← → para navegar · Enter para entrar</span>
        </div>

        {rooms.length === 0 ? (
          <div className="discover-empty">
            <div className="empty-icon">◈</div>
            <p className="empty-title">Nenhuma sala encontrada</p>
            <p className="empty-sub">Crie seu primeiro projeto no <a href="/">Editor</a>.</p>
          </div>
        ) : (
          <div className="shelf-carousel" ref={carouselRef}>
            {rooms.map((room, index) => (
              <button
                key={room.roomId}
                className={`room-card ${index === focusedIndex ? 'focused' : ''}`}
                onMouseEnter={() => handleCardFocus(index)}
                onFocus={() => handleCardFocus(index)}
                onClick={() => handleEnterRoom(room)}
                title={room.name}
              >
                {/* Thumbnail / Capa */}
                <div className="card-thumbnail">
                  {getCoverUrl(room) ? (
                    <img
                      src={getCoverUrl(room)}
                      alt={room.name}
                      className="card-cover-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="card-cover-placeholder">
                      <span className="placeholder-icon">◈</span>
                    </div>
                  )}
                  <div className="card-overlay">
                    <span className="card-play-icon">▶</span>
                  </div>
                  {index === focusedIndex && (
                    <div className="card-focus-ring" />
                  )}
                </div>

                {/* Info */}
                <div className="card-info">
                  <p className="card-name">{room.name}</p>
                  <p className="card-meta">{room.entityCount} entidades</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="discover-footer">
        <span>Freedom3D Platform · Sistema de Salas VR</span>
      </footer>
    </div>
  );
}
