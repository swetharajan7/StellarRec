import { logger } from '../utils/logger';

export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

export interface DocumentState {
  content: string;
  version: number;
  operations: Operation[];
}

export class OperationalTransform {
  /**
   * Transform operation against another operation for conflict resolution
   * Based on Operational Transformation algorithms
   */
  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    // If operations are from the same user, no transformation needed
    if (op1.userId === op2.userId) {
      return [op1, op2];
    }

    const transformedOp1 = { ...op1 };
    const transformedOp2 = { ...op2 };

    // Transform based on operation types
    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(transformedOp1, transformedOp2);
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(transformedOp1, transformedOp2);
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      const [op2t, op1t] = this.transformInsertDelete(transformedOp2, transformedOp1);
      return [op1t, op2t];
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(transformedOp1, transformedOp2);
    }

    return [transformedOp1, transformedOp2];
  }

  private static transformInsertInsert(op1: Operation, op2: Operation): [Operation, Operation] {
    if (op1.position <= op2.position) {
      // op1 comes before op2, adjust op2's position
      op2.position += op1.content?.length || 0;
    } else {
      // op2 comes before op1, adjust op1's position
      op1.position += op2.content?.length || 0;
    }
    return [op1, op2];
  }

  private static transformInsertDelete(op1: Operation, op2: Operation): [Operation, Operation] {
    const insertPos = op1.position;
    const deleteStart = op2.position;
    const deleteEnd = deleteStart + (op2.length || 0);

    if (insertPos <= deleteStart) {
      // Insert comes before delete, adjust delete position
      op2.position += op1.content?.length || 0;
    } else if (insertPos >= deleteEnd) {
      // Insert comes after delete, adjust insert position
      op1.position -= op2.length || 0;
    } else {
      // Insert is within delete range, complex case
      // Split the delete operation
      const beforeLength = insertPos - deleteStart;
      const afterLength = deleteEnd - insertPos;
      
      // Adjust positions
      op1.position = deleteStart;
      op2.length = beforeLength + (op1.content?.length || 0) + afterLength;
    }

    return [op1, op2];
  }

  private static transformDeleteDelete(op1: Operation, op2: Operation): [Operation, Operation] {
    const delete1Start = op1.position;
    const delete1End = delete1Start + (op1.length || 0);
    const delete2Start = op2.position;
    const delete2End = delete2Start + (op2.length || 0);

    if (delete1End <= delete2Start) {
      // delete1 comes before delete2
      op2.position -= op1.length || 0;
    } else if (delete2End <= delete1Start) {
      // delete2 comes before delete1
      op1.position -= op2.length || 0;
    } else {
      // Overlapping deletes - complex resolution
      const overlapStart = Math.max(delete1Start, delete2Start);
      const overlapEnd = Math.min(delete1End, delete2End);
      const overlapLength = overlapEnd - overlapStart;

      // Adjust lengths to account for overlap
      op1.length = (op1.length || 0) - overlapLength;
      op2.length = (op2.length || 0) - overlapLength;

      // Adjust positions
      if (delete1Start < delete2Start) {
        op2.position = delete1Start;
      } else {
        op1.position = delete2Start;
      }
    }

    return [op1, op2];
  }

  /**
   * Apply operation to document content
   */
  static applyOperation(content: string, operation: Operation): string {
    try {
      switch (operation.type) {
        case 'insert':
          return content.slice(0, operation.position) + 
                 (operation.content || '') + 
                 content.slice(operation.position);
        
        case 'delete':
          return content.slice(0, operation.position) + 
                 content.slice(operation.position + (operation.length || 0));
        
        case 'retain':
          return content; // No change for retain operations
        
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      logger.error('Error applying operation:', error);
      throw error;
    }
  }

  /**
   * Compose multiple operations into a single operation
   */
  static compose(operations: Operation[]): Operation[] {
    if (operations.length === 0) return [];
    if (operations.length === 1) return operations;

    const composed: Operation[] = [];
    let currentOp = operations[0];

    for (let i = 1; i < operations.length; i++) {
      const nextOp = operations[i];
      
      // Try to merge operations if they're compatible
      if (this.canMerge(currentOp, nextOp)) {
        currentOp = this.merge(currentOp, nextOp);
      } else {
        composed.push(currentOp);
        currentOp = nextOp;
      }
    }
    
    composed.push(currentOp);
    return composed;
  }

  private static canMerge(op1: Operation, op2: Operation): boolean {
    // Can merge if same type, same user, and adjacent positions
    return op1.type === op2.type && 
           op1.userId === op2.userId &&
           op1.type === 'insert' && 
           op1.position + (op1.content?.length || 0) === op2.position;
  }

  private static merge(op1: Operation, op2: Operation): Operation {
    return {
      ...op1,
      content: (op1.content || '') + (op2.content || ''),
      timestamp: Math.max(op1.timestamp, op2.timestamp)
    };
  }

  /**
   * Generate diff operations between two text versions
   */
  static generateOperations(oldText: string, newText: string, userId: string): Operation[] {
    const operations: Operation[] = [];
    const timestamp = Date.now();

    // Simple diff algorithm - can be enhanced with more sophisticated algorithms
    let i = 0, j = 0;
    
    while (i < oldText.length || j < newText.length) {
      if (i >= oldText.length) {
        // Insert remaining characters
        operations.push({
          type: 'insert',
          position: i,
          content: newText.slice(j),
          userId,
          timestamp
        });
        break;
      } else if (j >= newText.length) {
        // Delete remaining characters
        operations.push({
          type: 'delete',
          position: i,
          length: oldText.length - i,
          userId,
          timestamp
        });
        break;
      } else if (oldText[i] === newText[j]) {
        // Characters match, continue
        i++;
        j++;
      } else {
        // Find the next matching character
        let nextMatch = this.findNextMatch(oldText, newText, i, j);
        
        if (nextMatch.oldIndex > i) {
          // Delete characters
          operations.push({
            type: 'delete',
            position: i,
            length: nextMatch.oldIndex - i,
            userId,
            timestamp
          });
        }
        
        if (nextMatch.newIndex > j) {
          // Insert characters
          operations.push({
            type: 'insert',
            position: i,
            content: newText.slice(j, nextMatch.newIndex),
            userId,
            timestamp
          });
        }
        
        i = nextMatch.oldIndex;
        j = nextMatch.newIndex;
      }
    }

    return operations;
  }

  private static findNextMatch(oldText: string, newText: string, oldStart: number, newStart: number): { oldIndex: number, newIndex: number } {
    // Simple implementation - find next matching character
    for (let i = oldStart; i < oldText.length; i++) {
      for (let j = newStart; j < newText.length; j++) {
        if (oldText[i] === newText[j]) {
          return { oldIndex: i, newIndex: j };
        }
      }
    }
    return { oldIndex: oldText.length, newIndex: newText.length };
  }
}