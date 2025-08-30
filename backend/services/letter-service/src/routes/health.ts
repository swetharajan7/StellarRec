import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const activeLetters = await prisma.letters.count({
      where: { status: { not: 'deleted' as any } }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'letter-service',
      database: 'connected',
      active_letters: activeLetters,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'letter-service',
      error: error.message
    });
  }
});

export default router;