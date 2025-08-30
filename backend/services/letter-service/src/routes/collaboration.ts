import { Router, Request, Response } from 'express';

const router = Router();

router.get('/status', (req: Request, res: Response) => {
  res.json({ status: 'collaboration service ready' });
});

export default router;