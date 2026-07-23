import { useCallback, useRef } from 'react';
import { Download, FileText } from 'lucide-react';
import { Btn } from './ui';

/**
 * ExportPortfolio — CSV and PDF export buttons for portfolio data.
 * @param {{ positions: Array<{ pair: string, strategy: string, entry: number, current: number, size: number, pnl: number, pnlPct: number }> }} props
 */
export default function ExportPortfolio({ positions = [] }) {
  const iframeRef = useRef(null);

  const exportCSV = useCallback(() => {
    const headers = ['Bot Name', 'Coin', 'Invested', 'Current Value', 'P&L', 'Status', 'Created At'];
    const rows = positions.map(p => {
      const coin = p.pair?.split('/')[0] || p.pair;
      const invested = (p.entry * p.size).toFixed(2);
      const currentValue = (p.current * p.size).toFixed(2);
      const pnl = p.pnl?.toFixed(2) || '0.00';
      const status = p.pnl >= 0 ? 'Profit' : 'Loss';
      const createdAt = new Date().toISOString().slice(0, 10);
      return [p.strategy || p.name || 'Bot', coin, invested, currentValue, pnl, status, createdAt];
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradeflow-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [positions]);

  const exportPDF = useCallback(() => {
    const totalInvested = positions.reduce((s, p) => s + p.entry * p.size, 0);
    const totalValue = positions.reduce((s, p) => s + p.current * p.size, 0);
    const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

    const rows = positions.map(p => {
      const coin = p.pair?.split('/')[0] || p.pair;
      const invested = (p.entry * p.size).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const current = (p.current * p.size).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pnl = (p.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const color = p.pnl >= 0 ? '#22c55e' : '#ef4444';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${p.strategy || p.name || 'Bot'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${coin}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">$${invested}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">$${current}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${color}">${pnl >= 0 ? '+' : ''}$${pnl}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
          <span style="background:${pnl >= 0 ? '#dcfce7' : '#fee2e2'};color:${color};padding:2px 8px;border-radius:9999px;font-size:12px">${pnl >= 0 ? 'Profit' : 'Loss'}</span>
        </td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>TradeFlow Portfolio</title></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1f2937">
      <h1 style="font-size:24px;margin:0 0 4px">TradeFlow Portfolio Summary</h1>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <div style="display:flex;gap:24px;margin-bottom:24px">
        <div style="background:#f0fdf4;padding:16px 24px;border-radius:12px;flex:1">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase">Total Invested</div>
          <div style="font-size:20px;font-weight:700">$${totalInvested.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        <div style="background:#eff6ff;padding:16px 24px;border-radius:12px;flex:1">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase">Current Value</div>
          <div style="font-size:20px;font-weight:700">$${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        <div style="background:${totalPnl>=0?'#f0fdf4':'#fef2f2'};padding:16px 24px;border-radius:12px;flex:1">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase">Total P&L</div>
          <div style="font-size:20px;font-weight:700;color:${totalPnl>=0?'#22c55e':'#ef4444'}">${totalPnl>=0?'+':''}$${totalPnl.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f9fafb;text-align:left">
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb">Bot Name</th>
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb">Coin</th>
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:right">Invested</th>
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:right">Current Value</th>
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:right">P&L</th>
          <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:center">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    // Use hidden iframe + window.print()
    let iframe = iframeRef.current;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframeRef.current = iframe;
    }
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 300);
  }, [positions]);

  return (
    <div className="flex gap-2">
      <Btn variant="ghost" size="sm" onClick={exportCSV} title="Export portfolio as CSV">
        <Download className="w-4 h-4" />
        CSV
      </Btn>
      <Btn variant="ghost" size="sm" onClick={exportPDF} title="Export portfolio as PDF">
        <FileText className="w-4 h-4" />
        PDF
      </Btn>
    </div>
  );
}
