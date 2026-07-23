import { useState, useMemo } from 'react';
import { useAppStore } from '../context/AppStore';
import {
  CalendarClock, Plus, Trash2, Play, Pause, Clock,
  AlertCircle, Bot, Calendar, Settings2, RefreshCw,
} from 'lucide-react';
import {
  Card, CardBody, Btn, Badge, PageHeader, SectionHeader, Divider,
  Stat, Input, EmptyState,
} from '../components/ui';

const SCHEDULE_PRESETS = [
  { label: 'Daily (9 AM UTC)', value: 'daily', cron: '0 9 * * *' },
  { label: 'Weekly (Mon 9 AM)', value: 'weekly', cron: '0 9 * * 1' },
  { label: 'Every 4 hours', value: '4h', cron: '0 */4 * * *' },
  { label: 'Every hour', value: '1h', cron: '0 * * * *' },
  { label: 'Custom cron', value: 'custom', cron: '' },
];

function computeNextRun(cronExpr) {
  if (!cronExpr) return '—';
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) return 'Invalid cron';
  const [min, hour, , , dow] = parts;
  if (hour === '*' && min === '*') return 'Every minute';
  if (hour === '*') return `Every hour at :${min.padStart(2, '0')}`;
  if (dow === '*') return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[parseInt(dow)] || dow} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
}

function formatAmount(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Scheduler({ onNavigate: _onNavigate }) {
  const { bots, schedules, addSchedule, updateSchedule, removeSchedule } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    botId: '',
    schedulePreset: 'daily',
    cronExpr: '0 9 * * *',
    amount: '',
    label: '',
  });
  const [cronError, setCronError] = useState('');

  const activeCount = useMemo(() => schedules.filter(s => s.enabled).length, [schedules]);
  const totalAmount = useMemo(
    () => schedules.filter(s => s.enabled).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0),
    [schedules],
  );

  const handlePresetChange = (preset) => {
    const p = SCHEDULE_PRESETS.find(sp => sp.value === preset);
    setForm(f => ({
      ...f,
      schedulePreset: preset,
      cronExpr: p?.cron || f.cronExpr,
    }));
    setCronError('');
  };

  const validateCron = (expr) => {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return 'Cron must have 5 fields: min hour day month weekday';
    return '';
  };

  const handleSubmit = () => {
    const bot = bots.find(b => b.id === form.botId);
    if (!bot) return;
    const cronExpr = form.schedulePreset === 'custom' ? form.cronExpr.trim() : (SCHEDULE_PRESETS.find(p => p.value === form.schedulePreset)?.cron || '');
    const err = validateCron(cronExpr);
    if (err) { setCronError(err); return; }
    addSchedule({
      botId: bot.id,
      botName: bot.name,
      botCoin: bot.coin,
      schedule: form.schedulePreset === 'custom' ? cronExpr : SCHEDULE_PRESETS.find(p => p.value === form.schedulePreset)?.label || cronExpr,
      cronExpr,
      amount: parseFloat(form.amount) || 0,
      label: form.label || `${bot.name} run`,
      enabled: true,
      nextRun: computeNextRun(cronExpr),
      lastRun: null,
      runCount: 0,
    });
    setForm({ botId: '', schedulePreset: 'daily', cronExpr: '0 9 * * *', amount: '', label: '' });
    setShowForm(false);
    setCronError('');
  };

  const toggleSchedule = (id, current) => updateSchedule(id, { enabled: !current });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon={CalendarClock}
        title="Bot Scheduler"
        subtitle="Automate your bots with scheduled tasks and recurring runs"
      >
        <Btn onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4" /> New Task
        </Btn>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Active Tasks" value={activeCount} color="text-[var(--color-accent)]" sub={`${schedules.length} total`} />
        <Stat label="Scheduled Amount" value={formatAmount(totalAmount)} color="text-[var(--color-text-primary)]" sub="Per cycle (active)" />
        <Stat label="Next Run" value={schedules.find(s => s.enabled)?.nextRun || '—'} color="text-[var(--color-info)]" sub={schedules.find(s => s.enabled)?.botName || 'No tasks'} />
      </div>

      <Divider />

      {/* Create Form */}
      {showForm && (
        <Card accent>
          <CardBody className="space-y-4">
            <SectionHeader icon={Settings2} title="New Scheduled Task" />

            <div>
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Bot</label>
              <select
                value={form.botId}
                onChange={e => setForm(f => ({ ...f, botId: e.target.value }))}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30"
              >
                <option value="">Select a bot…</option>
                {bots.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.coin})</option>
                ))}
              </select>
            </div>

            <Input
              label="Task Label"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Morning DCA run"
            />

            <div>
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Schedule</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SCHEDULE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => handlePresetChange(p.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      form.schedulePreset === p.value
                        ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {form.schedulePreset === 'custom' && (
              <div>
                <Input
                  label="Cron Expression"
                  value={form.cronExpr}
                  onChange={e => { setForm(f => ({ ...f, cronExpr: e.target.value })); setCronError(''); }}
                  placeholder="0 9 * * *"
                  hint="Format: minute hour day-of-month month day-of-week"
                />
                {cronError && (
                  <p className="text-[var(--color-danger)] text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {cronError}
                  </p>
                )}
                {form.cronExpr && !cronError && (
                  <p className="text-[var(--color-accent)] text-xs mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Next: {computeNextRun(form.cronExpr)}
                  </p>
                )}
              </div>
            )}

            <Input
              label="Amount (USD)"
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="100"
              hint="Amount to trade per scheduled run"
            />

            <div className="flex gap-2 pt-1">
              <Btn onClick={handleSubmit} disabled={!form.botId || !form.amount}>Create Task</Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setCronError(''); }}>Cancel</Btn>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Scheduled Tasks Table */}
      <Card>
        <CardBody>
          <SectionHeader
            icon={Clock}
            title="Scheduled Tasks"
            badge={`${schedules.length} tasks`}
            action={
              <Btn variant="ghost" size="sm" onClick={() => {}}>
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Btn>
            }
          />

          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled tasks"
              desc="Create a task to automate your bots on a schedule"
              action={<Btn onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Create Task</Btn>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-strong)]">
                    <th className="text-left text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Task</th>
                    <th className="text-left text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Bot</th>
                    <th className="text-left text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Schedule</th>
                    <th className="text-right text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Amount</th>
                    <th className="text-left text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Next Run</th>
                    <th className="text-center text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Status</th>
                    <th className="text-right text-[var(--color-text-muted)] text-xs font-medium py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(sch => (
                    <tr key={sch.id} className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-surface-2)]/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="text-[var(--color-text-primary)] font-medium text-sm">{sch.label}</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                          <span className="text-[var(--color-text-primary)] text-sm">{sch.botName}</span>
                          <Badge variant="info">{sch.botCoin}</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                          <span className="text-[var(--color-text-secondary)] text-xs font-mono">{sch.schedule}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-[var(--color-text-primary)] font-semibold text-sm">{formatAmount(sch.amount)}</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[var(--color-info)]" />
                          <span className="text-[var(--color-text-secondary)] text-xs">{sch.nextRun}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={sch.enabled ? 'success' : 'warning'}>
                          {sch.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSchedule(sch.id, sch.enabled)}
                            title={sch.enabled ? 'Pause' : 'Resume'}
                          >
                            {sch.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </Btn>
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSchedule(sch.id)}
                            title="Delete"
                            className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Divider />

      {/* Info */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[var(--color-info)] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            <strong className="text-[var(--color-text-secondary)]">How scheduling works:</strong> Scheduled tasks run your bots automatically at the configured time with the specified amount.
            Tasks are paused when a bot is stopped. Cron expressions use UTC timezone. Enable/disable tasks without deleting them.
          </div>
        </div>
      </Card>
    </div>
  );
}
