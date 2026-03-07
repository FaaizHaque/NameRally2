import { Hono } from 'hono';
import { generateLevel, generateAllLevels, getAllBands, getBand, getLevelSummary } from '../lib/level-generator';
import type { LevelData, DifficultyBand } from '../lib/level-generator';

const levelsRouter = new Hono();

/**
 * GET /api/levels/:levelNumber
 * Get data for a specific level (1-500)
 */
levelsRouter.get('/:levelNumber', (c) => {
  const levelNumber = parseInt(c.req.param('levelNumber'), 10);

  if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 500) {
    return c.json({ error: 'Invalid level number. Must be between 1 and 500.' }, 400);
  }

  try {
    const level = generateLevel(levelNumber);
    return c.json(level);
  } catch (error) {
    return c.json({ error: 'Failed to generate level' }, 500);
  }
});

/**
 * GET /api/levels/bands/all
 * Get all difficulty bands metadata
 */
levelsRouter.get('/bands/all', (c) => {
  const bands = getAllBands();
  return c.json(bands);
});

/**
 * GET /api/levels/bands/:bandNumber
 * Get a specific band's metadata
 */
levelsRouter.get('/bands/:bandNumber', (c) => {
  const bandNumber = parseInt(c.req.param('bandNumber'), 10);

  if (isNaN(bandNumber) || bandNumber < 1 || bandNumber > 7) {
    return c.json({ error: 'Invalid band number. Must be between 1 and 7.' }, 400);
  }

  const band = getBand(bandNumber);
  if (!band) {
    return c.json({ error: 'Band not found' }, 404);
  }

  return c.json(band);
});

/**
 * GET /api/levels/range/:start/:end
 * Get levels in a range (useful for level selection UI)
 */
levelsRouter.get('/range/:start/:end', (c) => {
  const start = parseInt(c.req.param('start'), 10);
  const end = parseInt(c.req.param('end'), 10);

  if (isNaN(start) || isNaN(end) || start < 1 || end > 500 || start > end) {
    return c.json({ error: 'Invalid range. Must be between 1 and 500, with start <= end.' }, 400);
  }

  // Limit to 50 levels at a time to prevent large responses
  if (end - start > 50) {
    return c.json({ error: 'Range too large. Maximum 50 levels at a time.' }, 400);
  }

  try {
    const levels: LevelData[] = [];
    for (let i = start; i <= end; i++) {
      levels.push(generateLevel(i));
    }
    return c.json(levels);
  } catch (error) {
    return c.json({ error: 'Failed to generate levels' }, 500);
  }
});

/**
 * GET /api/levels/summary/:levelNumber
 * Get a human-readable summary of a level
 */
levelsRouter.get('/summary/:levelNumber', (c) => {
  const levelNumber = parseInt(c.req.param('levelNumber'), 10);

  if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 500) {
    return c.json({ error: 'Invalid level number. Must be between 1 and 500.' }, 400);
  }

  try {
    const summary = getLevelSummary(levelNumber);
    return c.json({ summary });
  } catch (error) {
    return c.json({ error: 'Failed to generate level summary' }, 500);
  }
});

export { levelsRouter };
