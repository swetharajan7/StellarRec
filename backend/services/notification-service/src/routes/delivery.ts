import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { DeliveryTrackingService } from '../services/deliveryTrackingService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get delivery status
router.get('/status/:notificationId',
  [
    param('notificationId').isString().notEmpty().withMessage('Notification ID is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const deliveryService: DeliveryTrackingService = req.app.locals.services.deliveryTrackingService;
    const status = await deliveryService.getDeliveryStatus(req.params.notificationId);

    res.status(200).json({
      success: true,
      data: status
    });
  })
);

// Get delivery statistics (admin only)
router.get('/stats',
  requireRole(['admin', 'analyst']),
  [
    query('channel').optional().isIn(['email', 'sms', 'push']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const deliveryService: DeliveryTrackingService = req.app.locals.services.deliveryTrackingService;
    const stats = await deliveryService.getDeliveryStats(
      req.query.channel as any,
      req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      req.query.endDate ? new Date(req.query.endDate as string) : undefined
    );

    res.status(200).json({
      success: true,
      data: stats
    });
  })
);

// Get failed deliveries (admin only)
router.get('/failed',
  requireRole(['admin']),
  [
    query('channel').optional().isIn(['email', 'sms', 'push']),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const deliveryService: DeliveryTrackingService = req.app.locals.services.deliveryTrackingService;
    const failedDeliveries = await deliveryService.getFailedDeliveries(
      req.query.channel as any,
      req.query.limit as number || 100
    );

    res.status(200).json({
      success: true,
      data: failedDeliveries
    });
  })
);

export default router;