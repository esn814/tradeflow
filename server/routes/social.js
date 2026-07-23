import { Router } from 'express';
import { authMiddleware, JWT_SECRET } from '../auth.js';
import { getDb } from '../db.js';
import jwt from 'jsonwebtoken';

const router = Router();

function formatStrategy(r, liked = false, forked = false) {
  return {
    id: r.id,
    authorId: r.author_id,
    authorAddress: r.author_address,
    name: r.name,
    description: r.description,
    strategyType: r.strategy_type,
    params: r.params ? JSON.parse(r.params) : {},
    riskLevel: r.risk_level,
    tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    likes: r.likes,
    forks: r.forks,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    liked,
    forked,
  };
}

// GET /api/social/leaderboard — top traders by P&L
router.get('/leaderboard', (req, res) => {
  try {
    const { period = 'all', limit = 25 } = req.query;
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    
    let dateFilter = '';
    let dateParam = null;
    const now = new Date();
    if (period === 'day') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      dateParam = d.toISOString();
      dateFilter = 'AND t.created_at >= ?';
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateParam = d.toISOString();
      dateFilter = 'AND t.created_at >= ?';
    } else if (period === 'month') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      dateParam = d.toISOString();
      dateFilter = 'AND t.created_at >= ?';
    }
    
    const rows = getDb().prepare(`
      SELECT 
        u.id as userId,
        u.address,
        COUNT(t.id) as tradeCount,
        SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winningTrades,
        SUM(t.pnl) as totalPnl,
        AVG(t.pnl) as avgPnl,
        MAX(t.pnl) as bestTrade,
        MIN(t.pnl) as worstTrade
      FROM users u
      INNER JOIN trades t ON t.user_id = u.id
      WHERE 1=1 ${dateFilter}
      GROUP BY u.id
      HAVING tradeCount > 0
      ORDER BY totalPnl DESC
      LIMIT ?
    `).all(...(dateParam ? [dateParam] : []), limitNum);
    
    res.json(rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      address: r.address,
      tradeCount: r.tradeCount,
      winningTrades: r.winningTrades,
      winRate: r.tradeCount > 0 ? (r.winningTrades / r.tradeCount * 100).toFixed(1) : 0,
      totalPnl: r.totalPnl,
      avgPnl: r.avgPnl,
      bestTrade: r.bestTrade,
      worstTrade: r.worstTrade,
    })));
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/social/strategies — list published strategies
router.get('/strategies', (req, res) => {
  try {
    const { type, risk, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNum - 1) * limitNum;
    
    let where = [];
    let params = [];
    
    if (type) {
      where.push('s.strategy_type = ?');
      params.push(type);
    }
    if (risk) {
      where.push('s.risk_level = ?');
      params.push(risk);
    }
    if (search) {
      where.push('(s.name LIKE ? OR s.description LIKE ? OR s.tags LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    
    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    
    const countRow = getDb().prepare(`
      SELECT COUNT(*) as total FROM shared_strategies s ${whereClause}
    `).get(...params);
    
    const rows = getDb().prepare(`
      SELECT 
        s.*,
        u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      ${whereClause}
      ORDER BY s.likes DESC, s.published_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);
    
    res.json({
      strategies: rows.map(r => ({
        id: r.id,
        authorId: r.author_id,
        authorAddress: r.author_address,
        name: r.name,
        description: r.description,
        strategyType: r.strategy_type,
        params: r.params ? JSON.parse(r.params) : {},
        riskLevel: r.risk_level,
        tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        likes: r.likes,
        forks: r.forks,
        publishedAt: r.published_at,
        updatedAt: r.updated_at,
      })),
      total: countRow.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countRow.total / limitNum),
    });
  } catch (err) {
    console.error('List strategies error:', err);
    res.status(500).json({ error: 'Failed to fetch strategies' });
  }
});

// GET /api/social/strategies/my — list current user's strategies (must be before :id)
router.get('/strategies/my', authMiddleware, (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT s.*, u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      WHERE s.author_id = ?
      ORDER BY s.published_at DESC
    `).all(req.userId);
    
    res.json(rows.map(r => ({
      id: r.id,
      authorId: r.author_id,
      authorAddress: r.author_address,
      name: r.name,
      description: r.description,
      strategyType: r.strategy_type,
      params: r.params ? JSON.parse(r.params) : {},
      riskLevel: r.risk_level,
      tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      likes: r.likes,
      forks: r.forks,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    console.error('My strategies error:', err);
    res.status(500).json({ error: 'Failed to fetch your strategies' });
  }
});

// POST /api/social/strategies — publish a new strategy
router.post('/strategies', authMiddleware, (req, res) => {
  try {
    const { name, description, strategyType, params, riskLevel, tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Strategy name is required' });
    
    const result = getDb().prepare(`
      INSERT INTO shared_strategies (author_id, name, description, strategy_type, params, risk_level, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      name,
      description || '',
      strategyType || 'custom',
      params ? JSON.stringify(params) : '{}',
      riskLevel || 'moderate',
      Array.isArray(tags) ? tags.join(', ') : (tags || '')
    );
    
    const strategy = getDb().prepare(`
      SELECT s.*, u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      id: strategy.id,
      authorId: strategy.author_id,
      authorAddress: strategy.author_address,
      name: strategy.name,
      description: strategy.description,
      strategyType: strategy.strategy_type,
      params: strategy.params ? JSON.parse(strategy.params) : {},
      riskLevel: strategy.risk_level,
      tags: strategy.tags ? strategy.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      likes: strategy.likes,
      forks: strategy.forks,
      publishedAt: strategy.published_at,
      updatedAt: strategy.updated_at,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'You already have a strategy with this name' });
    }
    console.error('Create strategy error:', err);
    res.status(500).json({ error: 'Failed to create strategy' });
  }
});

// GET /api/social/strategies/:id — get single strategy
router.get('/strategies/:id', (req, res) => {
  try {
    const strategy = getDb().prepare(`
      SELECT s.*, u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      WHERE s.id = ?
    `).get(req.params.id);
    
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    
    // Check if current user (if authenticated) has liked/forked
    let liked = false;
    let forked = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        liked = !!getDb().prepare('SELECT 1 FROM strategy_likes WHERE strategy_id = ? AND user_id = ?').get(strategy.id, payload.userId);
        forked = !!getDb().prepare('SELECT 1 FROM strategy_forks WHERE strategy_id = ? AND user_id = ?').get(strategy.id, payload.userId);
      } catch {
        // Token invalid — liked/forked stay false
      }
    }

    res.json(formatStrategy(strategy, liked, forked));
  } catch (err) {
    console.error('Get strategy error:', err);
    res.status(500).json({ error: 'Failed to fetch strategy' });
  }
});

// PUT /api/social/strategies/:id — update own strategy
router.put('/strategies/:id', authMiddleware, (req, res) => {
  try {
    const strategy = getDb().prepare('SELECT * FROM shared_strategies WHERE id = ?').get(req.params.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    if (strategy.author_id !== req.userId) return res.status(403).json({ error: 'You can only update your own strategies' });
    
    const { name, description, strategyType, params, riskLevel, tags } = req.body;
    
    getDb().prepare(`
      UPDATE shared_strategies SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        strategy_type = COALESCE(?, strategy_type),
        params = COALESCE(?, params),
        risk_level = COALESCE(?, risk_level),
        tags = COALESCE(?, tags),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? null,
      description ?? null,
      strategyType ?? null,
      params ? JSON.stringify(params) : null,
      riskLevel ?? null,
      tags !== undefined ? (Array.isArray(tags) ? tags.join(', ') : tags) : null,
      req.params.id
    );
    
    const updated = getDb().prepare(`
      SELECT s.*, u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      WHERE s.id = ?
    `).get(req.params.id);
    
    res.json({
      id: updated.id,
      authorId: updated.author_id,
      authorAddress: updated.author_address,
      name: updated.name,
      description: updated.description,
      strategyType: updated.strategy_type,
      params: updated.params ? JSON.parse(updated.params) : {},
      riskLevel: updated.risk_level,
      tags: updated.tags ? updated.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      likes: updated.likes,
      forks: updated.forks,
      publishedAt: updated.published_at,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'You already have a strategy with this name' });
    }
    console.error('Update strategy error:', err);
    res.status(500).json({ error: 'Failed to update strategy' });
  }
});

// DELETE /api/social/strategies/:id — delete own strategy
router.delete('/strategies/:id', authMiddleware, (req, res) => {
  try {
    const strategy = getDb().prepare('SELECT * FROM shared_strategies WHERE id = ?').get(req.params.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    if (strategy.author_id !== req.userId) return res.status(403).json({ error: 'You can only delete your own strategies' });
    
    getDb().prepare('DELETE FROM shared_strategies WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete strategy error:', err);
    res.status(500).json({ error: 'Failed to delete strategy' });
  }
});

// POST /api/social/strategies/:id/like — toggle like
router.post('/strategies/:id/like', authMiddleware, (req, res) => {
  try {
    const strategy = getDb().prepare('SELECT * FROM shared_strategies WHERE id = ?').get(req.params.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    
    const toggleLike = getDb().transaction(() => {
      const existing = getDb().prepare('SELECT * FROM strategy_likes WHERE strategy_id = ? AND user_id = ?').get(req.params.id, req.userId);
      
      if (existing) {
        getDb().prepare('DELETE FROM strategy_likes WHERE strategy_id = ? AND user_id = ?').run(req.params.id, req.userId);
        getDb().prepare('UPDATE shared_strategies SET likes = MAX(0, likes - 1) WHERE id = ?').run(req.params.id);
        return { liked: false, likes: strategy.likes - 1 };
      } else {
        getDb().prepare('INSERT INTO strategy_likes (strategy_id, user_id) VALUES (?, ?)').run(req.params.id, req.userId);
        getDb().prepare('UPDATE shared_strategies SET likes = likes + 1 WHERE id = ?').run(req.params.id);
        return { liked: true, likes: strategy.likes + 1 };
      }
    });
    
    res.json(toggleLike());
  } catch (err) {
    console.error('Toggle like error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST /api/social/strategies/:id/fork — fork a strategy
router.post('/strategies/:id/fork', authMiddleware, (req, res) => {
  try {
    const strategy = getDb().prepare('SELECT * FROM shared_strategies WHERE id = ?').get(req.params.id);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    
    // Check if already forked
    const existing = getDb().prepare('SELECT * FROM strategy_forks WHERE strategy_id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (existing) return res.status(409).json({ error: 'You already forked this strategy' });
    
    // Create fork record
    getDb().prepare('INSERT INTO strategy_forks (strategy_id, user_id) VALUES (?, ?)').run(req.params.id, req.userId);
    getDb().prepare('UPDATE shared_strategies SET forks = forks + 1 WHERE id = ?').run(req.params.id);
    
    // Copy strategy to user's strategies
    const forkName = `${strategy.name} (fork)`;
    const result = getDb().prepare(`
      INSERT INTO shared_strategies (author_id, name, description, strategy_type, params, risk_level, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      forkName,
      strategy.description,
      strategy.strategy_type,
      strategy.params,
      strategy.risk_level,
      strategy.tags
    );
    
    const forked = getDb().prepare(`
      SELECT s.*, u.address as author_address
      FROM shared_strategies s
      INNER JOIN users u ON u.id = s.author_id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      id: forked.id,
      authorId: forked.author_id,
      authorAddress: forked.author_address,
      name: forked.name,
      description: forked.description,
      strategyType: forked.strategy_type,
      params: forked.params ? JSON.parse(forked.params) : {},
      riskLevel: forked.risk_level,
      tags: forked.tags ? forked.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      likes: forked.likes,
      forks: forked.forks,
      publishedAt: forked.published_at,
      updatedAt: forked.updated_at,
    });
  } catch (err) {
    console.error('Fork strategy error:', err);
    res.status(500).json({ error: 'Failed to fork strategy' });
  }
});

export default router;
