import React from 'react';

export default function ScrapeLogsTable({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
        No scrape attempts logged yet.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="badge badge-success">✓ SUCCESS</span>;
      case 'RETRY':
        return <span className="badge badge-retry">↻ RETRY</span>;
      case 'FAILED':
        return <span className="badge badge-failed">✕ FAILED</span>;
      case 'STRUCTURE_CHANGED':
        return <span className="badge badge-structure">⚠ STRUCTURE CHANGED</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Attempt</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Log Message</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td style={{ fontWeight: 600 }}>
                #{log.attempt_number}
              </td>
              <td>
                {getStatusBadge(log.status)}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {log.duration_ms ? `${log.duration_ms} ms` : '—'}
              </td>
              <td style={{ fontSize: '0.875rem', maxWidth: '400px' }}>
                {log.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
