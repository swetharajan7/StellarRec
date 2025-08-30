import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const recentAnalyses = await prisma.writing_analyses.count({
      where: {
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ai-writing-assistant',
      database: 'connected',
      recent_analyses: recentAnalyses,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ai-writing-assistant',
      error: error.message
    });
  }
});

export default router;