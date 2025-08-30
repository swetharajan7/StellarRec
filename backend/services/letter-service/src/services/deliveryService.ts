import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export class DeliveryService {
  constructor(private prisma: PrismaClient) {}

  async deliverLetter(letterId: string, userId: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId },
        include: {
          university: true,
          student: true,
          recommender: true
        }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      if (letter.status !== 'approved') {
        throw new Error('Letter must be approved before delivery');
      }

      // Create delivery record
      const delivery = await this.prisma.letter_deliveries.create({
        data: {
          letter_id: letterId,
          delivered_by: userId,
          delivery_method: 'email', // or 'api', 'upload'
          delivery_status: 'pending',
          created_at: new Date()
        }
      });

      // Update letter status
      await this.prisma.letters.update({
        where: { id: letterId },
        data: {
          status: 'delivered',
          updated_at: new Date()
        }
      });

      logger.info(`Letter delivered: ${letterId}`);
      return delivery;
    } catch (error) {
      logger.error('Error delivering letter:', error);
      throw error;
    }
  }
}