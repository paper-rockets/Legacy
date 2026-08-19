import { useEffect, useRef } from 'react';
import { GhibliGenerator } from './core/GhibliGenerator';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const generatorRef = useRef<GhibliGenerator | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (generatorRef.current) {
        generatorRef.current.destroy();
      }
      generatorRef.current = new GhibliGenerator(containerRef.current);
    }

    return () => {
      if (generatorRef.current) {
        generatorRef.current.destroy();
        generatorRef.current = null;
      }
    };
  }, []);

  const handleExportGLTF = () => {
    if (generatorRef.current) {
      generatorRef.current.exportToGLTF();
    }
  };

  const handleExportHTML = () => {
    if (generatorRef.current) {
      generatorRef.current.exportToHTML();
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, fontFamily: 'sans-serif', color: '#1e293b', pointerEvents: 'none', textShadow: '0 1px 4px rgba(255,255,255,0.9)' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: '#db2777', display: 'flex', alignItems: 'center', gap: '8px' }}>👑 Princess Fairytale & Magical Castle Studio</h1>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#831843', opacity: 0.9 }}>Live Custom Color Editor • Enchanted Spires • Starlight Sparkles • Gold Crowns</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button 
            onClick={handleExportGLTF}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ffffff',
              backgroundColor: '#7c3aed',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#6d28d9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#7c3aed';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            💾 Export 3D Model (.gltf)
          </button>
          <button 
            onClick={handleExportHTML}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ffffff',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            🌐 Export Standalone HTML
          </button>
        </div>
      </div>
    </div>
  );
}
