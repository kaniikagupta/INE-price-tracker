import React, { useState, useEffect } from 'react';
import api from '../api/client';

export default function Navbar({ onOpenSearch, onRefreshAll }) {
  const [health, setHealth] = useState(null);
  const [runningCron, setRunningCron] = useState(false);

  useEffect(() => {
    checkBackendHealth();
    const timer = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await api.checkHealth();
      setHealth(res.status === 'OK' ? 'online' : 'degraded');
    } catch {
      setHealth('offline');
    }
  };

  const handleRunCron = async () => {
    const secret = window.prompt("Enter x-cron-secret to trigger scheduled scraper:", "test_cron_secret_ine_123");
    if (!secret) return;

    setRunningCron(true);
    try {
      const res = await api.triggerCronRun(secret);
      alert(`Cron run completed!\n${res.message || ''}`);
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      alert(`Cron trigger failed: ${err.message}`);
    } finally {
      setRunningCron(false);
    }
  };

  return (
    <header className="navbar">
      <div className="nav-inner">
        <div className="brand-logo">
          <div className="brand-icon">◧</div>
          <div>
            <div>INE Price Tracker</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
              Autonomous Scraping & Price History
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {/* Health Indicator */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.78rem', 
              padding: '4px 10px', 
              borderRadius: '9999px',
              background: health === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              color: health === 'online' ? 'var(--emerald)' : 'var(--rose)',
              border: `1px solid ${health === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
            }}
            title="Backend Server Status"
          >
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: health === 'online' ? 'var(--emerald)' : 'var(--rose)',
              display: 'inline-block'
            }} />
            {health === 'online' ? 'API Online' : health === 'offline' ? 'API Offline' : 'Connecting…'}
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleRunCron}
            disabled={runningCron}
            title="Simulate 2-Hour Cron Run Trigger"
          >
            <span className={runningCron ? 'spin' : ''}>⏱</span> {runningCron ? 'Running Cron…' : 'Trigger Due Scrapes'}
          </button>

          <button 
            className="btn btn-primary"
            onClick={onOpenSearch}
          >
            + Search & Track
          </button>
        </div>
      </div>
    </header>
  );
}
