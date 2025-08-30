import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface Letter {
  id: string;
  student_id: string;
  recommender_id: string;
  application_id?: string;
  university_id?: string;
  title: string;
  content: string;
  status: 'draft' | 'in_review' | 'approved' | 'submitted' | 'delivered';
  version: number;
  template_id?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface LetterVersion {
  id: string;
  letter_id: string;
  version_number: number;
  content: string;
  changes_summary?: string;
  created_by: string;
  created_at: Date;
}

export class LetterService {
  constructor(private prisma: PrismaClient) {}

  async createLetter(letterData: Omit<Letter, 'id' | 'version' | 'created_at' | 'updated_at'>) {
    try {
      const letter = await this.prisma.letters.create({
        data: {
          id: uuidv4(),
          student_id: letterData.student_id,
          recommender_id: letterData.recommender_id,
          application_id: letterData.application_id,
          university_id: letterData.university_id,
          title: letterData.title,
          content: letterData.content,
          status: letterData.status || 'draft',
          version: 1,
          template_id: letterData.template_id,
          metadata: letterData.metadata,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // Create initial version
      await this.createLetterVersion(letter.id, letter.content, 'Initial version', letterData.recommender_id);

      logger.info(`Letter created: ${letter.id} for student: ${letterData.student_id}`);
      return letter;
    } catch (error) {
      logger.error('Error creating letter:', error);
      throw error;
    }
  }

  async getLetter(letterId: string, userId?: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          recommender: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          },
          template: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          versions: {
            orderBy: { version_number: 'desc' },
            take: 5
          }
        }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      // Check access permissions
      if (userId && letter.student_id !== userId && letter.recommender_id !== userId) {
        throw new Error('Access denied');
      }

      return letter;
    } catch (error) {
      logger.error('Error fetching letter:', error);
      throw error;
    }
  }

  async updateLetter(letterId: string, updates: Partial<Letter>, userId: string) {
    try {
      const existingLetter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!existingLetter) {
        throw new Error('Letter not found');
      }

      // Check permissions
      if (existingLetter.recommender_id !== userId && existingLetter.student_id !== userId) {
        throw new Error('Access denied');
      }

      const shouldCreateVersion = updates.content && updates.content !== existingLetter.content;
      const newVersion = shouldCreateVersion ? existingLetter.version + 1 : existingLetter.version;

      const updatedLetter = await this.prisma.letters.update({
        where: { id: letterId },
        data: {
          ...updates,
          version: newVersion,
          updated_at: new Date()
        }
      });

      // Create new version if content changed
      if (shouldCreateVersion) {
        await this.createLetterVersion(
          letterId,
          updates.content!,
          'Content updated',
          userId
        );
      }

      logger.info(`Letter updated: ${letterId} by user: ${userId}`);
      return updatedLetter;
    } catch (error) {
      logger.error('Error updating letter:', error);
      throw error;
    }
  }

  async deleteLetter(letterId: string, userId: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      // Only student or recommender can delete
      if (letter.student_id !== userId && letter.recommender_id !== userId) {
        throw new Error('Access denied');
      }

      // Soft delete - mark as deleted instead of removing
      await this.prisma.letters.update({
        where: { id: letterId },
        data: {
          status: 'deleted' as any,
          updated_at: new Date()
        }
      });

      logger.info(`Letter deleted: ${letterId} by user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting letter:', error);
      throw error;
    }
  }

  async getLettersByUser(userId: string, role: 'student' | 'recommender') {
    try {
      const whereClause = role === 'student' 
        ? { student_id: userId }
        : { recommender_id: userId };

      const letters = await this.prisma.letters.findMany({
        where: {
          ...whereClause,
          status: {
            not: 'deleted' as any
          }
        },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          recommender: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        },
        orderBy: { updated_at: 'desc' }
      });

      return letters;
    } catch (error) {
      logger.error('Error fetching user letters:', error);
      throw error;
    }
  }

  async createLetterVersion(letterId: string, content: string, changesSummary: string, userId: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      const version = await this.prisma.letter_versions.create({
        data: {
          id: uuidv4(),
          letter_id: letterId,
          version_number: letter.version,
          content: content,
          changes_summary: changesSummary,
          created_by: userId,
          created_at: new Date()
        }
      });

      return version;
    } catch (error) {
      logger.error('Error creating letter version:', error);
      throw error;
    }
  }

  async getLetterVersions(letterId: string, userId: string) {
    try {
      // Verify access
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      if (letter.student_id !== userId && letter.recommender_id !== userId) {
        throw new Error('Access denied');
      }

      const versions = await this.prisma.letter_versions.findMany({
        where: { letter_id: letterId },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: { version_number: 'desc' }
      });

      return versions;
    } catch (error) {
      logger.error('Error fetching letter versions:', error);
      throw error;
    }
  }

  async revertToVersion(letterId: string, versionNumber: number, userId: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      // Only recommender can revert versions
      if (letter.recommender_id !== userId) {
        throw new Error('Access denied');
      }

      const version = await this.prisma.letter_versions.findFirst({
        where: {
          letter_id: letterId,
          version_number: versionNumber
        }
      });

      if (!version) {
        throw new Error('Version not found');
      }

      // Update letter with version content and increment version
      const updatedLetter = await this.prisma.letters.update({
        where: { id: letterId },
        data: {
          content: version.content,
          version: letter.version + 1,
          updated_at: new Date()
        }
      });

      // Create new version entry for the revert
      await this.createLetterVersion(
        letterId,
        version.content,
        `Reverted to version ${versionNumber}`,
        userId
      );

      logger.info(`Letter ${letterId} reverted to version ${versionNumber} by user: ${userId}`);
      return updatedLetter;
    } catch (error) {
      logger.error('Error reverting letter version:', error);
      throw error;
    }
  }

  async updateLetterStatus(letterId: string, status: Letter['status'], userId: string) {
    try {
      const letter = await this.prisma.letters.findUnique({
        where: { id: letterId }
      });

      if (!letter) {
        throw new Error('Letter not found');
      }

      // Check permissions based on status change
      const canUpdate = this.canUpdateStatus(letter, status, userId);
      if (!canUpdate) {
        throw new Error('Access denied for this status change');
      }

      const updatedLetter = await this.prisma.letters.update({
        where: { id: letterId },
        data: {
          status: status,
          updated_at: new Date()
        }
      });

      // Log status change
      await this.prisma.letter_activity_logs.create({
        data: {
          letter_id: letterId,
          user_id: userId,
          action: 'status_change',
          details: {
            from: letter.status,
            to: status
          },
          created_at: new Date()
        }
      });

      logger.info(`Letter ${letterId} status changed from ${letter.status} to ${status} by user: ${userId}`);
      return updatedLetter;
    } catch (error) {
      logger.error('Error updating letter status:', error);
      throw error;
    }
  }

  private canUpdateStatus(letter: any, newStatus: Letter['status'], userId: string): boolean {
    const isStudent = letter.student_id === userId;
    const isRecommender = letter.recommender_id === userId;

    switch (newStatus) {
      case 'draft':
        return isRecommender;
      case 'in_review':
        return isRecommender;
      case 'approved':
        return isStudent; // Student approves the letter
      case 'submitted':
        return isStudent; // Student submits the letter
      case 'delivered':
        return false; // System only
      default:
        return false;
    }
  }

  async getLetterAnalytics(letterId: string, userId: string) {
    try {
      const letter = await this.getLetter(letterId, userId);
      
      const analytics = {
        word_count: this.countWords(letter.content),
        character_count: letter.content.length,
        paragraph_count: letter.content.split('\n\n').length,
        version_count: letter.versions.length,
        days_since_created: Math.floor((Date.now() - letter.created_at.getTime()) / (1000 * 60 * 60 * 24)),
        last_updated: letter.updated_at,
        status: letter.status,
        readability_score: this.calculateReadabilityScore(letter.content)
      };

      return analytics;
    } catch (error) {
      logger.error('Error generating letter analytics:', error);
      throw error;
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified Flesch Reading Ease score
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const words = this.countWords(text);
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private countSyllables(text: string): number {
    // Simplified syllable counting
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    return words.reduce((total, word) => {
      const syllableCount = word.match(/[aeiouy]+/g)?.length || 1;
      return total + Math.max(1, syllableCount);
    }, 0);
  }

  async searchLetters(userId: string, query: string, filters?: any) {
    try {
      const searchConditions: any = {
        OR: [
          { student_id: userId },
          { recommender_id: userId }
        ],
        status: {
          not: 'deleted' as any
        }
      };

      if (query) {
        searchConditions.OR = [
          ...searchConditions.OR,
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } }
        ];
      }

      if (filters?.status) {
        searchConditions.status = filters.status;
      }

      if (filters?.university_id) {
        searchConditions.university_id = filters.university_id;
      }

      const letters = await this.prisma.letters.findMany({
        where: searchConditions,
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          recommender: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        },
        orderBy: { updated_at: 'desc' },
        take: filters?.limit || 50
      });

      return letters;
    } catch (error) {
      logger.error('Error searching letters:', error);
      throw error;
    }
  }
}