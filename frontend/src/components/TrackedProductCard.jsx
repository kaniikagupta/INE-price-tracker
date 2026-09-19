import React, { useState } from 'react';
import api from '../api/client';

export default function TrackedProductCard({ product, onViewDetails, onFrequencyClick, onProductUpdated, onProductDeleted }) {
  const [scraping, setScraping] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleScrapeNow = async (e) => {
    e.stopPropagation();
    setScraping(true);
    setErrorMsg(null);
    try {
      await api.scrapeNow(product.id);
      if (onProductUpdated) onProductUpdated();
    } catch (err) {
      setErrorMsg(err.data?.message || err.message || 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Stop tracking "${product.product_name}"?`)) return;
    try {
      await api.deleteProduct(product.id);
      if (onProductDeleted) onProductDeleted(product.id);
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const hours = Math.round((product.scrape_frequency_minutes || 120) / 60);

  return (
    <div className="product-card" onClick={() => onViewDetails(product)}>
      <div>
        {/* Category, SKU, and Badges */}
        <div className="product-meta-header">
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.07)', color: 'var(--text-secondary)' }}>
            {product.category || 'Peripherals'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            SKU: {product.product_sku || 'N/A'}
          </span>
        </div>

        {/* Title and Brand */}
        <h3 className="product-title" title={product.product_name}>
          {product.product_name}
        </h3>
        <div className="product-sub">
          Brand: <strong style={{ color: 'var(--text-primary)' }}>{product.brand || 'Unknown'}</strong>
        </div>

        {/* Alerts: Price Drop and Back in Stock */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {product.is_price_drop && (
            <span className="price-drop-badge">
              ↓ ₹{product.price_drop_amount?.toLocaleString('en-IN')} ({Math.abs(product.price_change_percent)}%)
            </span>
          )}
          {product.is_back_in_stock && (
            <span className="back-in-stock-badge">
              ★ Back in Stock!
            </span>
          )}
        </div>
      </div>

      {/* Pricing & Stock Row */}
      <div>
        <div className="product-pricing-row">
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Price</span>
            <div className="price-display">
              {product.last_price !== null && product.last_price !== undefined
                ? `₹${product.last_price.toLocaleString('en-IN')}`
                : <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Pending Scrape</span>
              }
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
            <div>
              <span className={`badge ${product.last_stock_status === 'IN STOCK' ? 'badge-in-stock' : 'badge-out-stock'}`}>
                {product.last_stock_status || 'PENDING'} 
                {product.last_stock_quantity !== null && product.last_stock_quantity !== undefined ? ` · ${product.last_stock_quantity}` : ''}
              </span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '8px' }}>
            {errorMsg}
          </div>
        )}

        {/* Timing info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          <span>
            {product.last_scraped_at ? `Scraped ${new Date(product.last_scraped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not scraped yet'}
          </span>
          <span 
            onClick={(e) => { e.stopPropagation(); onFrequencyClick(product); }}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            title="Click to change frequency"
          >
            ⏱ Every {hours}h
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="product-card-actions">
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={(e) => { e.stopPropagation(); onViewDetails(product); }}
        >
          View Details
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleScrapeNow}
            disabled={scraping}
            title="Trigger live scrape immediately"
          >
            <span className={scraping ? 'spin' : ''}>↻</span> {scraping ? 'Scraping…' : 'Scrape'}
          </button>

          <button 
            className="btn btn-secondary btn-sm btn-icon" 
            onClick={handleDelete}
            title="Stop tracking"
            style={{ color: 'var(--rose)' }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
