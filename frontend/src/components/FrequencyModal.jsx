import React, { useState } from 'react';
import api from '../api/client';

export default function FrequencyModal({ isOpen, onClose, product, onFrequencyUpdated }) {
  const [selectedFreq, setSelectedFreq] = useState(product?.scrape_frequency_minutes || 120);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) return null;

  const options = [
    { minutes: 60, label: 'Every 1 Hour', desc: 'Frequent checks for rapid flash sales' },
    { minutes: 120, label: 'Every 2 Hours (Assignment Default)', desc: 'Standard production frequency required by INE', isDefault: true },
    { minutes: 360, label: 'Every 6 Hours', desc: 'Moderate tracking interval' },
    { minutes: 720, label: 'Every 12 Hours', desc: 'Twice-daily checks' },
    { minutes: 1440, label: 'Every 24 Hours', desc: 'Once daily check' }
  ];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateFrequency(product.id, selectedFreq);
      if (onFrequencyUpdated) {
        onFrequencyUpdated(product.id, selectedFreq);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update frequency');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'white' }}>Scrape Frequency</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Configure how often Playwright scrapes {product.product_name}
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ padding: '10px', color: 'var(--rose)', backgroundColor: 'var(--rose-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {options.map((opt) => {
              const isSelected = selectedFreq === opt.minutes;
              return (
                <div
                  key={opt.minutes}
                  onClick={() => setSelectedFreq(opt.minutes)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-primary)' }}>
                      {opt.label}
                      {opt.isDefault && (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {opt.desc}
                    </div>
                  </div>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Frequency'}
          </button>
        </div>
      </div>
    </div>
  );
}
