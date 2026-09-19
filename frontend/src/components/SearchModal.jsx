import React, { useState, useEffect } from 'react';
import api from '../api/client';

export default function SearchModal({ isOpen, onClose, onProductTracked, trackedUrls = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingUrl, setTrackingUrl] = useState(null);
  const [trackMessage, setTrackMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setTrackMessage(null);
      return;
    }

    // Load initial recommendations or top products
    handleSearch('');
  }, [isOpen]);

  const handleSearch = async (searchTerm) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchProducts(searchTerm);
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to search mock store catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleTrack = async (item) => {
    setTrackingUrl(item.url);
    setTrackMessage(null);
    try {
      await api.trackProduct({
        product_name: item.name,
        product_url: item.url,
        product_sku: item.sku,
        brand: item.brand,
        category: item.category,
        scrape_frequency_minutes: 120,
        scrape_now: true
      });

      setTrackMessage({ type: 'success', text: `Successfully tracked ${item.name}!` });
      if (onProductTracked) {
        onProductTracked();
      }
    } catch (err) {
      setTrackMessage({
        type: 'error',
        text: err.status === 409 ? 'This product is already being tracked!' : (err.message || 'Failed to track product')
      });
    } finally {
      setTrackingUrl(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'white' }}>Search INE Mock Store</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Search across ~1,000 products by partial name, brand, or SKU
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {trackMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.875rem',
              backgroundColor: trackMessage.type === 'success' ? 'var(--emerald-bg)' : 'var(--rose-bg)',
              color: trackMessage.type === 'success' ? 'var(--emerald)' : 'var(--rose)',
              border: `1px solid ${trackMessage.type === 'success' ? 'var(--emerald-border)' : 'var(--rose-border)'}`
            }}>
              {trackMessage.text}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="search-input-wrap">
            <span className="search-icon-left">🔍</span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="e.g. Cobalt Trackpad, Keyboard, Peripherals, DOM-10039..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ position: 'absolute', right: '6px', top: '6px', bottom: '6px' }}
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && (
            <div style={{ padding: '12px', color: 'var(--rose)', backgroundColor: 'var(--rose-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <div className="spin" style={{ display: 'inline-block', fontSize: '24px', marginBottom: '8px' }}>↻</div>
              <div>Searching products in mock store catalog…</div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No products found matching "{query}". Try a different keyword like "Pro", "Dock", or "Domus".
            </div>
          ) : (
            <div className="search-results-list">
              {results.map((item) => {
                const isTracked = trackedUrls.includes(item.url);
                const isThisTracking = trackingUrl === item.url;

                return (
                  <div key={item.id} className="search-result-item">
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.07)', fontSize: '0.6875rem' }}>
                          {item.category || 'General'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          SKU: {item.sku}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        Brand: <span style={{ color: 'var(--text-primary)' }}>{item.brand}</span>
                      </div>
                    </div>

                    <div>
                      {isTracked ? (
                        <button className="btn btn-secondary btn-sm" disabled style={{ color: 'var(--emerald)' }}>
                          ✓ Tracked
                        </button>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => handleTrack(item)}
                          disabled={isThisTracking}
                        >
                          {isThisTracking ? 'Tracking…' : '+ Track Product'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
