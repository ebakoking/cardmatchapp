import { Server } from 'socket.io';

// Global socket.io instance - index.ts'de set edilir
let io: Server | null = null;

export function setIO(ioInstance: Server) {
  io = ioInstance;
}

export function getIO(): Server | null {
  return io;
}

// Helper: Belirli bir kullanıcıya event gönder
export function emitToUser(userId: string, event: string, payload: any) {
  if (!io) {
    console.warn('[Socket] IO not initialized, cannot emit to user:', userId);
    return false;
  }
  
  io.to(userId).emit(event, payload);
  console.log(`[Socket] Emitted ${event} to user ${userId}:`, payload);
  return true;
}
