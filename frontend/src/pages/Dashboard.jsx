import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import TrackedProductCard from '../components/TrackedProductCard';
import SearchModal from '../components/SearchModal';
import ProductDetailModal from '../components/ProductDetailModal';
import FrequencyModal from '../components/FrequencyModal';

export default function Dashboard({ isSearchOpen, onCloseSearch, onOpenSearch }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'in_stock' | 'price_drops' | 'out_of_stock'
  const [localSearch, setLocalSearch] = useState('');

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [frequencyProduct, setFrequencyProduct] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTrackedProducts();
      if (res.success) {
        setProducts(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch tracked products');
    } finally {
      setLoading(false);
    }
  };

  // Metrics computation
  const totalCount = products.length;
  const inStockCount = products.filter(p => p.last_stock_status === 'IN STOCK').length;
  const outOfStockCount = products.filter(p => p.last_stock_status === 'OUT OF STOCK').length;
  const priceDropsCount = products.filter(p => p.is_price_drop).length;

  // Filter products
  const filteredProducts = products.filter(p => {
    // Category/status filter
    if (filter === 'in_stock' && p.last_stock_status !== 'IN STOCK') return false;
    if (filter === 'out_of_stock' && p.last_stock_status !== 'OUT OF STOCK') return false;
    if (filter === 'price_drops' && !p.is_price_drop) return false;

    // Search query filter
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      const matchName = p.product_name && p.product_name.toLowerCase().includes(q);
      const matchBrand = p.brand && p.brand.toLowerCase().includes(q);
      const matchSku = p.product_sku && p.product_sku.toLowerCase().includes(q);
      const matchCategory = p.category && p.category.toLowerCase().includes(q);
      return matchName || matchBrand || matchSku || matchCategory;
    }

    return true;
  });

  const trackedUrls = products.map(p => p.product_url);

  return (
    <div className="main-content">
      {/* Metrics Banner */}
      <div className="stats-grid">
        <StatCard 
          icon="📦" 
          value={totalCount} 
          label="Tracked Products" 
          color="var(--primary)" 
          bgGlow="rgba(99, 102, 241, 0.15)" 
        />
        <StatCard 
          icon="✓" 
          value={inStockCount} 
          label="Currently In Stock" 
          color="var(--emerald)" 
          bgGlow="rgba(16, 185, 129, 0.15)" 
        />
        <StatCard 
          icon="📉" 
          value={priceDropsCount} 
          label="Active Price Drops" 
          color="#38bdf8" 
          bgGlow="rgba(56, 189, 248, 0.15)" 
        />
        <StatCard 
          icon="⚠" 
          value={outOfStockCount} 
          label="Out of Stock" 
          color="var(--rose)" 
          bgGlow="rgba(244, 63, 94, 0.15)" 
        />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '16px 20px',
          background: 'var(--rose-bg)',
          border: '1px solid var(--rose-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--rose)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Error connecting to backend:</strong> {error}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadProducts}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="controls-bar">
        <div className="filter-pills">
          <button 
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Products ({totalCount})
          </button>
          <button 
            className={`filter-pill ${filter === 'in_stock' ? 'active' : ''}`}
            onClick={() => setFilter('in_stock')}
          >
            In Stock ({inStockCount})
          </button>
          <button 
            className={`filter-pill ${filter === 'price_drops' ? 'active' : ''}`}
            onClick={() => setFilter('price_drops')}
          >
            Price Drops ({priceDropsCount})
          </button>
          <button 
            className={`filter-pill ${filter === 'out_of_stock' ? 'active' : ''}`}
            onClick={() => setFilter('out_of_stock')}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Filter tracked list..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={loadProducts}
            title="Refresh list"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Products Grid / Empty States */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <div className="spin" style={{ display: 'inline-block', fontSize: '32px', marginBottom: '12px' }}>↻</div>
          <div>Loading tracked products…</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
            {products.length === 0 ? 'No products being tracked yet' : 'No products match your filter'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
            {products.length === 0
              ? 'Search INE’s mock store to discover products and automatically track live prices and availability every 2 hours.'
              : 'Try clearing your search query or switching to the "All Products" tab.'}
          </p>
          {products.length === 0 ? (
            <button className="btn btn-primary" onClick={onOpenSearch}>
              + Search & Track Your First Product
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => { setFilter('all'); setLocalSearch(''); }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((p) => (
            <TrackedProductCard
              key={p.id}
              product={p}
              onViewDetails={(prod) => setSelectedProduct(prod)}
              onFrequencyClick={(prod) => setFrequencyProduct(prod)}
              onProductUpdated={loadProducts}
              onProductDeleted={loadProducts}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={onCloseSearch}
        onProductTracked={loadProducts}
        trackedUrls={trackedUrls}
      />

      <ProductDetailModal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onProductUpdated={loadProducts}
        onProductDeleted={loadProducts}
        onOpenFrequency={(prod) => {
          setSelectedProduct(null);
          setFrequencyProduct(prod);
        }}
      />

      <FrequencyModal
        isOpen={Boolean(frequencyProduct)}
        onClose={() => setFrequencyProduct(null)}
        product={frequencyProduct}
        onFrequencyUpdated={loadProducts}
      />
    </div>
  );
}
