import { store } from './store.js';

class ChatService {
  async sendMessage(requestId, user, text, imageFile = null) {
    if (!text && !imageFile) return null;

    const id = 'msg_' + Math.random().toString(36).substring(2, 9);
    let imageURL = null;

    if (imageFile) {
      imageURL = await store.uploadFile(imageFile, `requests/${requestId}/chat_${id}_${imageFile.name}`);
    }

    const message = {
      id,
      requestId,
      senderId: user.uid,
      senderName: user.name || user.email.split('@')[0],
      text: text ? text.trim() : '',
      imageURL,
      seenBy: [user.uid],
      createdAt: new Date().toISOString()
    };

    await store.setDoc(`messages_${requestId}`, id, message);
    return message;
  }

  subscribeMessages(requestId, callback) {
    return store.subscribe(`messages_${requestId}`, null, (messages) => {
      const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      callback(sorted);
    });
  }

  async markSeen(requestId, messageId, userId) {
    const msg = await store.getDoc(`messages_${requestId}`, messageId);
    if (msg && !msg.seenBy.includes(userId)) {
      await store.updateDoc(`messages_${requestId}`, messageId, {
        seenBy: [...msg.seenBy, userId]
      });
    }
  }
}

export const chatService = new ChatService();
