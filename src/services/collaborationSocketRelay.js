/**
 * Real-Time Collaboration Socket Relay
 * Broadcasts messages, notifications, typing indicators, comments, and calendar updates
 */

class CollaborationSocketRelay {
  constructor() {
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  getIO() {
    return this.io;
  }

  emitToTenant(tenantId, event, data) {
    if (!this.io || !tenantId) return;
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToUser(userId, event, data) {
    if (!this.io || !userId) return;
    this.io.to(`staff:${userId}`).emit(event, data);
  }

  emitToConversation(conversationId, event, data) {
    if (!this.io || !conversationId) return;
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

const collaborationSocketRelay = new CollaborationSocketRelay();
module.exports = collaborationSocketRelay;

