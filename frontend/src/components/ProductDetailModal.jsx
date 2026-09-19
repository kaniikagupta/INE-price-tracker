import React, { useState, useEffect } from 'react';
import api from '../api/client';
import PriceHistoryChart from './PriceHistoryChart';
import ScrapeLogsTable from './ScrapeLogsTable';

export default function ProductDetailModal({ isOpen, onClose, product, onProductUpdated, onProductDeleted, onOpenFrequency }) {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'logs'
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isOpen || !product) return;
    loadData();
  }, [isOpen, product]);

  const loadData = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const [histRes, logsRes] = await Promise.all([
        api.getPriceHistory(product.id),
        api.getScrapeLogs(product.id)
      ]);
      if (histRes.success) setHistory(histRes.data || []);
      if (logsRes.success) setLogs(logsRes.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load details' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualScrape = async () => {
    setScraping(true);
    setMessage(null);
    try {
      const res = await api.scrapeNow(product.id);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Scrape successful! Extracted live price ₹${res.data.scrape.price} (${res.data.scrape.stockStatus})`
        });
        await loadData();
        if (onProductUpdated) onProductUpdated();
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.data?.message || err.message || 'Manual scrape failed'
      });
      await loadData(); // Reload logs to display the failure log
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to stop tracking "${product.product_name}"?`)) return;
    try {
      await api.deleteProduct(product.id);
      if (onProductDeleted) onProductDeleted(product.id);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                {product.category || 'General'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                SKU: {product.product_sku || 'N/A'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                • Brand: <strong style={{ color: 'white' }}>{product.brand || 'N/A'}</strong>
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'white' }}>{product.product_name}</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Product Overview Ribbon */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Price</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'white' }}>
                {product.last_price ? `₹${product.last_price.toLocaleString('en-IN')}` : 'Not scraped yet'}
              </div>
            </div>

            {product.is_price_drop && (
              <div className="price-drop-badge" style={{ alignSelf: 'center' }}>
                ↓ Price dropped by ₹{product.price_drop_amount?.toLocaleString('en-IN')} ({Math.abs(product.price_change_percent)}%)
              </div>
            )}

            {product.is_back_in_stock && (
              <div className="back-in-stock-badge" style={{ alignSelf: 'center' }}>
                ★ BACK IN STOCK!
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Availability</span>
              <div>
                <span className={`badge ${product.last_stock_status === 'IN STOCK' ? 'badge-in-stock' : 'badge-out-stock'}`}>
                  {product.last_stock_status || 'UNKNOWN'} {product.last_stock_quantity !== null ? `· ${product.last_stock_quantity} left` : ''}
                </span>
              </div>
            </div>

            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              title="View on Mock Store"
            >
              Store Link ↗
            </a>
          </div>
        </div>

        {/* Actions Bar */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`filter-pill ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📈 Price & Stock History ({history.length})
            </button>
            <button
              className={`filter-pill ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              📋 Scrape Logs ({logs.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleManualScrape}
              disabled={scraping}
            >
              <span className={scraping ? 'spin' : ''}>↻</span> {scraping ? 'Scraping Live Store…' : 'Scrape Now'}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenFrequency(product)}
            >
              ⏱ Every {Math.round((product.scrape_frequency_minutes || 120) / 60)}h
            </button>
            <button 
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              title="Stop tracking and delete"
            >
              Stop Tracking
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              fontSize: '0.875rem',
              backgroundColor: message.type === 'success' ? 'var(--emerald-bg)' : 'var(--rose-bg)',
              color: message.type === 'success' ? 'var(--emerald)' : 'var(--rose)',
              border: `1px solid ${message.type === 'success' ? 'var(--emerald-border)' : 'var(--rose-border)'}`
            }}>
              {message.text}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              <div className="spin" style={{ display: 'inline-block', fontSize: '28px', marginBottom: '8px' }}>↻</div>
              <div>Loading product records…</div>
            </div>
          ) : activeTab === 'history' ? (
            <PriceHistoryChart history={history} />
          ) : (
            <ScrapeLogsTable logs={logs} />
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
            Last Scraped: {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleString() : 'Never'}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
