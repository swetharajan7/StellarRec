import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { TemplateService } from '../services/templateService';

const router = Router();
const prisma = new PrismaClient();
const templateService = new TemplateService(prisma);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const category = req.query.category as string;
    const templates = await templateService.getTemplates(userId, category);
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

export default router;