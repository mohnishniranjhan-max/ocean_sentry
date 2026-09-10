import React, { useEffect } from 'react';
import { useHandGesture } from '../hooks/useHandGesture';

export default function GestureLab() {
  const {
    isEnabled,
    toggleEnabled,
    status,
    gesture,
    confidence,
    videoRef,
    canvasRef,
  } = useHandGesture();

  // Enable by default when entering the lab
  useEffect(() => {
    if (!isEnabled && status === 'disabled') {
      toggleEnabled();
    }
  }, [isEnabled, status, toggleEnabled]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000208',
      color: '#cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 40px',
        borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(2, 8, 20, 0.9)',
      }}>
        <div>
          <h1 style={{ color: '#22d3ee', margin: '0 0 8px 0', fontSize: '24px', letterSpacing: '0.1em' }}>
            AI GESTURE TELEMETRY LAB
          </h1>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>
            MediaPipe WebGL 2.0 Hand Landmarker Debugger
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>STATUS</div>
            <div style={{ 
              color: status === 'tracking' ? '#22c55e' : (status === 'loading' ? '#f59e0b' : '#ef4444'),
              fontWeight: 'bold',
              fontSize: '18px'
            }}>
              {status.toUpperCase()}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>CLASSIFICATION</div>
            <div style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '18px' }}>
              {gesture.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>CONFIDENCE</div>
            <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '18px' }}>
              {confidence.toFixed(1)}%
            </div>
          </div>
          
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginLeft: '20px'
            }}
          >
            RETURN TO GLOBE
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', padding: '40px', gap: '40px' }}>
        
        {/* Left Side: Instructions */}
        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'rgba(2, 8, 20, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '24px',
            borderRadius: '8px',
          }}>
            <h3 style={{ color: '#f8fafc', marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>GESTURE GUIDE</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ color: '#38bdf8' }}>✊ Closed Fist (1 Hand)</strong>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Triggers "ROTATE". Move fist to drag.</div>
              </div>
              
              <div>
                <strong style={{ color: '#38bdf8' }}>👐 Two Hands Open</strong>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Triggers "ZOOM/PAN". Move hands apart to zoom in.</div>
              </div>
              
              <div>
                <strong style={{ color: '#38bdf8' }}>✌ Left Air-Quote (Double Claw)</strong>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Triggers "SELECT/TAP".</div>
              </div>
              
              <div>
                <strong style={{ color: '#38bdf8' }}>✋ Open Palm</strong>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Hover / Neutral state.</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={toggleEnabled}
            style={{
              padding: '16px',
              background: isEnabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              border: `1px solid ${isEnabled ? '#ef4444' : '#22c55e'}`,
              color: isEnabled ? '#ef4444' : '#22c55e',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              transition: 'all 0.2s ease',
            }}
          >
            {isEnabled ? 'PAUSE TRACKING' : 'RESUME TRACKING'}
          </button>
        </div>

        {/* Right Side: Camera Viewfinder */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          background: 'rgba(2, 8, 20, 0.4)',
          border: '1px solid rgba(34, 211, 238, 0.3)',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 0 40px rgba(34, 211, 238, 0.05) inset'
        }}>
          {/* Hidden raw video feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ display: 'none' }}
          />

          {/* Rendered Canvas with Skeleton overlay */}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: isEnabled ? 'block' : 'none',
            }}
          />

          {/* Standby overlay */}
          {!isEnabled && (
            <div style={{ color: '#64748b', fontSize: '18px', letterSpacing: '0.1em' }}>
              CAMERA OFFLINE. CLICK "START TRACKING".
            </div>
          )}
          
          {status === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
              <div style={{ color: '#22d3ee', fontSize: '24px', letterSpacing: '0.15em', fontWeight: 'bold' }}>
                INITIALIZING AI MODEL...
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
