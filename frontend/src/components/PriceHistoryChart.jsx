import React, { useState } from 'react';

/**
 * Interactive Zero-Dependency SVG Line Chart with Tooltip and History Table
 */
export default function PriceHistoryChart({ history = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!history || history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        No price history recorded yet for this product. Trigger a scrape to log the first price point!
      </div>
    );
  }

  // Points sorted chronologically
  const sorted = [...history].sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at));

  // Compute SVG dimensions and scale
  const width = 700;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const prices = sorted.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice === minPrice ? 100 : maxPrice - minPrice;

  const yMin = Math.max(0, Math.floor((minPrice - priceRange * 0.1) / 100) * 100);
  const yMax = Math.ceil((maxPrice + priceRange * 0.1) / 100) * 100;
  const totalYRange = yMax - yMin || 1;

  const points = sorted.map((d, i) => {
    const x = padding.left + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW);
    const y = padding.top + chartH - ((d.price - yMin) / totalYRange) * chartH;
    return { ...d, x, y };
  });

  // Build SVG path
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Build closed area for gradient fill
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : '';

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Chart Card */}
      <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', position: 'relative' }}>
        
        {/* Header Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected Point</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'white' }}>
              ₹{activePoint.price.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(activePoint.scraped_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <div style={{ fontSize: '0.8rem', color: activePoint.stock_status === 'IN STOCK' ? 'var(--emerald)' : 'var(--rose)' }}>
              ● {activePoint.stock_status} {activePoint.stock_quantity !== null ? `(${activePoint.stock_quantity} left)` : ''}
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding.top + chartH * ratio;
            const val = Math.round(yMax - ratio * totalYRange);
            return (
              <g key={idx}>
                <line 
                  x1={padding.left} 
                  y1={y} 
                  x2={width - padding.right} 
                  y2={y} 
                  stroke="rgba(255, 255, 255, 0.06)" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={padding.left - 8} 
                  y={y + 4} 
                  fill="var(--text-muted)" 
                  fontSize="11" 
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  ₹{val.toLocaleString('en-IN')}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#priceGradient)" />

          {/* Line Path */}
          <path 
            d={pathD} 
            fill="none" 
            stroke="var(--primary)" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g 
              key={idx} 
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={hoverIndex === idx ? 6 : 4} 
                fill={hoverIndex === idx ? '#ffffff' : 'var(--primary)'} 
                stroke="var(--bg-secondary)" 
                strokeWidth="2" 
              />
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="14" 
                fill="transparent" 
              />
            </g>
          ))}

          {/* Active point indicator line */}
          {hoverIndex !== null && (
            <line 
              x1={activePoint.x} 
              y1={padding.top} 
              x2={activePoint.x} 
              y2={padding.top + chartH} 
              stroke="rgba(255, 255, 255, 0.25)" 
              strokeDasharray="2 2" 
            />
          )}

          {/* X Axis Labels */}
          {points.length > 1 && (
            <>
              <text 
                x={points[0].x} 
                y={height - 10} 
                fill="var(--text-muted)" 
                fontSize="11"
              >
                {new Date(points[0].scraped_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
              <text 
                x={points[points.length - 1].x} 
                y={height - 10} 
                fill="var(--text-muted)" 
                fontSize="11" 
                textAnchor="end"
              >
                {new Date(points[points.length - 1].scraped_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Historical Records Table */}
      <div>
        <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Price & Stock Records ({history.length})</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scraped Time</th>
                <th>Price</th>
                <th>Change</th>
                <th>Stock Status</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((rec, i, arr) => {
                const nextRec = arr[i + 1];
                let changeText = '—';
                let changeColor = 'var(--text-muted)';

                if (nextRec && nextRec.price) {
                  const diff = rec.price - nextRec.price;
                  if (diff < 0) {
                    changeText = `↓ ₹${Math.abs(diff).toLocaleString('en-IN')}`;
                    changeColor = 'var(--emerald)';
                  } else if (diff > 0) {
                    changeText = `↑ ₹${diff.toLocaleString('en-IN')}`;
                    changeColor = 'var(--rose)';
                  } else {
                    changeText = 'No change';
                  }
                }

                return (
                  <tr key={rec.id || i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {new Date(rec.scraped_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ₹{rec.price.toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: changeColor, fontWeight: 600 }}>
                      {changeText}
                    </td>
                    <td>
                      <span className={`badge ${rec.stock_status === 'IN STOCK' ? 'badge-in-stock' : 'badge-out-stock'}`}>
                        {rec.stock_status}
                      </span>
                    </td>
                    <td>
                      {rec.stock_quantity !== null ? `${rec.stock_quantity} left` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
