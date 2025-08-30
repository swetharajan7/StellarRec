import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const activeComments = await prisma.comments.count({
      where: { status: 'active' }
    });

    const recentOperations = await prisma.document_operations.count({
      where: {
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'collaboration-service',
      database: 'connected',
      active_comments: activeComments,
      recent_operations: recentOperations,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'collaboration-service',
      error: error.message
    });
  }
});

export default router;