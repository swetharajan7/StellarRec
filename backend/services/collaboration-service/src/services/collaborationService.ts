import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { OperationalTransform, Operation } from './operationalTransform';

export interface CollaborationSession {
  id: string;
  document_id: string;
  document_type: 'letter' | 'essay' | 'application';
  participants: string[];
  created_at: Date;
  last_activity: Date;
}

export interface UserPresence {
  userId: string;
  documentId: string;
  cursor_position: number;
  selection_start?: number;
  selection_end?: number;
  last_seen: Date;
}

export interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  position: number;
  thread_id?: string;
  status: 'active' | 'resolved' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

export class CollaborationService {
  private activeSessions: Map<string, CollaborationSession> = new Map();
  private userPresence: Map<string, UserPresence[]> = new Map();

  constructor(private prisma: PrismaClient, private io: Server) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.userId}`);

      socket.on('join-document', async (data) => {
        await this.handleJoinDocument(socket, data);
      });

      socket.on('leave-document', async (data) => {
        await this.handleLeaveDocument(socket, data);
      });

      socket.on('document-operation', async (data) => {
        await this.handleDocumentOperation(socket, data);
      });

      socket.on('cursor-update', async (data) => {
        await this.handleCursorUpdate(socket, data);
      });

      socket.on('add-comment', async (data) => {
        await this.handleAddComment(socket, data);
      });

      socket.on('resolve-comment', async (data) => {
        await this.handleResolveComment(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async handleJoinDocument(socket: any, data: { documentId: string; documentType: string }) {
    try {
      const { documentId, documentType } = data;
      const userId = socket.userId;

      // Verify user has access to document
      const hasAccess = await this.verifyDocumentAccess(userId, documentId, documentType);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to document' });
        return;
      }

      // Join socket room
      socket.join(`doc-${documentId}`);

      // Get or create collaboration session
      let session = this.activeSessions.get(documentId);
      if (!session) {
        session = {
          id: uuidv4(),
          document_id: documentId,
          document_type: documentType as any,
          participants: [userId],
          created_at: new Date(),
          last_activity: new Date()
        };
        this.activeSessions.set(documentId, session);
      } else if (!session.participants.includes(userId)) {
        session.participants.push(userId);
        session.last_activity = new Date();
      }

      // Add user presence
      const presence: UserPresence = {
        userId,
        documentId,
        cursor_position: 0,
        last_seen: new Date()
      };

      const documentPresence = this.userPresence.get(documentId) || [];
      const existingIndex = documentPresence.findIndex(p => p.userId === userId);
      if (existingIndex >= 0) {
        documentPresence[existingIndex] = presence;
      } else {
        documentPresence.push(presence);
      }
      this.userPresence.set(documentId, documentPresence);

      // Notify other users
      socket.to(`doc-${documentId}`).emit('user-joined', {
        userId,
        documentId,
        timestamp: new Date()
      });

      // Send current participants to new user
      socket.emit('collaboration-state', {
        session,
        participants: await this.getParticipantDetails(session.participants),
        presence: documentPresence
      });

      logger.info(`User ${userId} joined document ${documentId}`);
    } catch (error) {
      logger.error('Error handling join document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  async handleLeaveDocument(socket: any, data: { documentId: string }) {
    try {
      const { documentId } = data;
      const userId = socket.userId;

      socket.leave(`doc-${documentId}`);

      // Remove from session
      const session = this.activeSessions.get(documentId);
      if (session) {
        session.participants = session.participants.filter(id => id !== userId);
        if (session.participants.length === 0) {
          this.activeSessions.delete(documentId);
        }
      }

      // Remove presence
      const documentPresence = this.userPresence.get(documentId) || [];
      const filteredPresence = documentPresence.filter(p => p.userId !== userId);
      if (filteredPresence.length === 0) {
        this.userPresence.delete(documentId);
      } else {
        this.userPresence.set(documentId, filteredPresence);
      }

      // Notify other users
      socket.to(`doc-${documentId}`).emit('user-left', {
        userId,
        documentId,
        timestamp: new Date()
      });

      logger.info(`User ${userId} left document ${documentId}`);
    } catch (error) {
      logger.error('Error handling leave document:', error);
    }
  }

  async handleDocumentOperation(socket: any, data: { documentId: string; operation: Operation; version: number }) {
    try {
      const { documentId, operation, version } = data;
      const userId = socket.userId;

      // Verify user has edit access
      const hasEditAccess = await this.verifyEditAccess(userId, documentId);
      if (!hasEditAccess) {
        socket.emit('error', { message: 'No edit permission' });
        return;
      }

      // Get current document state
      const currentDocument = await this.getDocumentState(documentId);
      if (!currentDocument) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      // Check version conflict
      if (version !== currentDocument.version) {
        // Transform operation against newer operations
        const transformedOp = await this.transformOperation(operation, currentDocument, version);
        if (!transformedOp) {
          socket.emit('operation-rejected', { reason: 'Conflict resolution failed' });
          return;
        }
        operation = transformedOp;
      }

      // Apply operation
      const newContent = OperationalTransform.applyOperation(currentDocument.content, operation);
      const newVersion = currentDocument.version + 1;

      // Save to database
      await this.saveDocumentState(documentId, newContent, newVersion, operation);

      // Broadcast to other users
      socket.to(`doc-${documentId}`).emit('document-updated', {
        documentId,
        operation,
        version: newVersion,
        userId,
        timestamp: new Date()
      });

      // Confirm to sender
      socket.emit('operation-applied', {
        documentId,
        version: newVersion,
        timestamp: new Date()
      });

      logger.info(`Operation applied to document ${documentId} by user ${userId}`);
    } catch (error) {
      logger.error('Error handling document operation:', error);
      socket.emit('error', { message: 'Failed to apply operation' });
    }
  }

  async handleCursorUpdate(socket: any, data: { documentId: string; position: number; selection?: { start: number; end: number } }) {
    try {
      const { documentId, position, selection } = data;
      const userId = socket.userId;

      // Update presence
      const documentPresence = this.userPresence.get(documentId) || [];
      const userPresenceIndex = documentPresence.findIndex(p => p.userId === userId);
      
      if (userPresenceIndex >= 0) {
        documentPresence[userPresenceIndex].cursor_position = position;
        documentPresence[userPresenceIndex].selection_start = selection?.start;
        documentPresence[userPresenceIndex].selection_end = selection?.end;
        documentPresence[userPresenceIndex].last_seen = new Date();
      }

      // Broadcast cursor update to other users
      socket.to(`doc-${documentId}`).emit('cursor-updated', {
        userId,
        documentId,
        position,
        selection,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error handling cursor update:', error);
    }
  }

  async handleAddComment(socket: any, data: { documentId: string; content: string; position: number; threadId?: string }) {
    try {
      const { documentId, content, position, threadId } = data;
      const userId = socket.userId;

      const comment = await this.prisma.comments.create({
        data: {
          id: uuidv4(),
          document_id: documentId,
          user_id: userId,
          content,
          position,
          thread_id: threadId,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });

      // Broadcast to all users in document
      this.io.to(`doc-${documentId}`).emit('comment-added', {
        comment,
        documentId,
        timestamp: new Date()
      });

      logger.info(`Comment added to document ${documentId} by user ${userId}`);
    } catch (error) {
      logger.error('Error adding comment:', error);
      socket.emit('error', { message: 'Failed to add comment' });
    }
  }

  async handleResolveComment(socket: any, data: { commentId: string; documentId: string }) {
    try {
      const { commentId, documentId } = data;
      const userId = socket.userId;

      const comment = await this.prisma.comments.update({
        where: { id: commentId },
        data: {
          status: 'resolved',
          updated_at: new Date()
        }
      });

      // Broadcast to all users in document
      this.io.to(`doc-${documentId}`).emit('comment-resolved', {
        commentId,
        documentId,
        resolvedBy: userId,
        timestamp: new Date()
      });

      logger.info(`Comment ${commentId} resolved by user ${userId}`);
    } catch (error) {
      logger.error('Error resolving comment:', error);
      socket.emit('error', { message: 'Failed to resolve comment' });
    }
  }

  private handleDisconnect(socket: any) {
    const userId = socket.userId;
    
    // Remove user from all document presence
    for (const [documentId, presence] of this.userPresence.entries()) {
      const filteredPresence = presence.filter(p => p.userId !== userId);
      if (filteredPresence.length === 0) {
        this.userPresence.delete(documentId);
      } else {
        this.userPresence.set(documentId, filteredPresence);
      }

      // Notify other users if user was present
      if (presence.some(p => p.userId === userId)) {
        socket.to(`doc-${documentId}`).emit('user-left', {
          userId,
          documentId,
          timestamp: new Date()
        });
      }
    }

    logger.info(`User disconnected: ${userId}`);
  }

  private async verifyDocumentAccess(userId: string, documentId: string, documentType: string): Promise<boolean> {
    try {
      switch (documentType) {
        case 'letter':
          const letter = await this.prisma.letters.findUnique({
            where: { id: documentId }
          });
          return letter && (letter.student_id === userId || letter.recommender_id === userId);
        
        case 'essay':
          const essay = await this.prisma.essays.findUnique({
            where: { id: documentId }
          });
          return essay && essay.student_id === userId;
        
        default:
          return false;
      }
    } catch (error) {
      logger.error('Error verifying document access:', error);
      return false;
    }
  }

  private async verifyEditAccess(userId: string, documentId: string): Promise<boolean> {
    // For now, same as read access - can be enhanced with more granular permissions
    return this.verifyDocumentAccess(userId, documentId, 'letter');
  }

  private async getDocumentState(documentId: string): Promise<{ content: string; version: number } | null> {
    try {
      // Try letter first
      const letter = await this.prisma.letters.findUnique({
        where: { id: documentId }
      });
      
      if (letter) {
        return {
          content: letter.content,
          version: letter.version
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting document state:', error);
      return null;
    }
  }

  private async saveDocumentState(documentId: string, content: string, version: number, operation: Operation): Promise<void> {
    try {
      // Update document content and version
      await this.prisma.letters.update({
        where: { id: documentId },
        data: {
          content,
          version,
          updated_at: new Date()
        }
      });

      // Save operation history
      await this.prisma.document_operations.create({
        data: {
          document_id: documentId,
          user_id: operation.userId,
          operation_type: operation.type,
          operation_data: operation,
          version,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error saving document state:', error);
      throw error;
    }
  }

  private async transformOperation(operation: Operation, currentDocument: any, clientVersion: number): Promise<Operation | null> {
    try {
      // Get operations since client version
      const recentOperations = await this.prisma.document_operations.findMany({
        where: {
          document_id: currentDocument.id,
          version: {
            gt: clientVersion
          }
        },
        orderBy: { version: 'asc' }
      });

      let transformedOp = operation;

      // Transform against each recent operation
      for (const recentOp of recentOperations) {
        const [transformed] = OperationalTransform.transform(transformedOp, recentOp.operation_data as Operation);
        transformedOp = transformed;
      }

      return transformedOp;
    } catch (error) {
      logger.error('Error transforming operation:', error);
      return null;
    }
  }

  private async getParticipantDetails(participantIds: string[]) {
    try {
      const users = await this.prisma.users.findMany({
        where: {
          id: { in: participantIds }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true
        }
      });
      return users;
    } catch (error) {
      logger.error('Error getting participant details:', error);
      return [];
    }
  }

  // Public API methods
  async getDocumentComments(documentId: string, userId: string) {
    try {
      // Verify access
      const hasAccess = await this.verifyDocumentAccess(userId, documentId, 'letter');
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      const comments = await this.prisma.comments.findMany({
        where: {
          document_id: documentId,
          status: { not: 'deleted' }
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: { created_at: 'asc' }
      });

      return comments;
    } catch (error) {
      logger.error('Error getting document comments:', error);
      throw error;
    }
  }

  async getCollaborationHistory(documentId: string, userId: string) {
    try {
      const hasAccess = await this.verifyDocumentAccess(userId, documentId, 'letter');
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      const operations = await this.prisma.document_operations.findMany({
        where: { document_id: documentId },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 100
      });

      return operations;
    } catch (error) {
      logger.error('Error getting collaboration history:', error);
      throw error;
    }
  }
}