import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="app-container">
      <Navbar 
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <Dashboard 
        isSearchOpen={isSearchOpen}
        onCloseSearch={() => setIsSearchOpen(false)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-color)',
        padding: '24px 20px',
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        background: 'rgba(11, 15, 25, 0.9)'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            INE Product Price Tracker • Software Engineer Intern Assignment
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a 
              href="https://demo.inelabteamdev.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline' }}
            >
              INE Mock Store ↗
            </a>
            <span>Playwright • Express • Supabase • React</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
