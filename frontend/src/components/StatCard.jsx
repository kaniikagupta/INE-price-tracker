import React from 'react';

export default function StatCard({ icon, value, label, color = 'var(--primary)', bgGlow = 'rgba(99, 102, 241, 0.12)' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon-wrap" style={{ background: bgGlow, color: color, fontSize: '1.25rem' }}>
        {icon}
      </div>
      <div>
        <div className="stat-val" style={{ color: 'white' }}>
          {value}
        </div>
        <div className="stat-label">
          {label}
        </div>
      </div>
    </div>
  );
}
