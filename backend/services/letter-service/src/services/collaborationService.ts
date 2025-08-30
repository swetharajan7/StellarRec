import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { logger } from '../utils/logger';

export class CollaborationService {
  constructor(private prisma: PrismaClient, private io: Server) {}

  async handleLetterEdit(userId: string, editData: any) {
    try {
      const { letterId, content, operation } = editData;

      // Verify user has access to letter
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      if (letter.student_id !== userId && letter.recommender_id !== userId) {
        throw new Error('Access denied');
      }

      // Save edit to database
      await this.prisma.letter_edits.create({
        data: {
          letter_id: letterId,
          user_id: userId,
          operation: operation,
          content_delta: content,
          created_at: new Date()
        }
      });

      // Broadcast to other users in the letter room
      this.io.to(`letter-${letterId}`).emit('letter-edit', {
        userId,
        letterId,
        content,
        operation,
        timestamp: new Date()
      });

      logger.info(`Letter edit processed: ${letterId} by user: ${userId}`);
    } catch (error) {
      logger.error('Error handling letter edit:', error);
      throw error;
    }
  }
}