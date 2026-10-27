import { chatService } from '../services/chat.service.js';
import { toast } from './toast.js';
import { escapeHTML } from '../utils/sanitize.js';
import { formatRelativeTime } from '../utils/dates.js';

export function createChatBox({ request, currentUser, otherUserName, onLocationClick, onHandoverClick }) {
  const container = document.createElement('div');
  container.className = 'chat-container';

  container.innerHTML = `
    <!-- Pinned Header with Quick Actions -->
    <div class="chat-header">
      <div>
        <h4 class="text-sm font-bold">${escapeHTML(otherUserName || 'Chat')}</h4>
        <span class="text-xs text-muted">Item: <strong>${escapeHTML(request.itemName)}</strong></span>
      </div>

      <div class="flex gap-2">
        <button id="chat-point-btn" class="btn btn-secondary btn-sm flex items-center gap-1" title="Pick Meeting Point on Map">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          Meeting Point
        </button>
      </div>
    </div>

    <!-- Messages List Container -->
    <div id="chat-messages" class="chat-messages">
      <div class="text-center text-xs text-muted" style="margin: auto 0;">
        Direct chat started for <strong>${escapeHTML(request.itemName)}</strong>. Coordinate your meeting details below.
      </div>
    </div>

    <!-- Message Input Bar -->
    <form id="chat-form" class="chat-input-bar">
      <label for="chat-file-input" class="btn btn-secondary btn-sm btn-icon" title="Attach image" style="cursor: pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
      </label>
      <input type="file" id="chat-file-input" accept="image/*" class="sr-only">

      <input type="text" id="chat-text-input" class="form-input flex-1" placeholder="Type a message..." autocomplete="off">
      <button type="submit" id="chat-send-btn" class="btn btn-primary btn-sm">Send</button>
    </form>
  `;

  const messagesContainer = container.querySelector('#chat-messages');
  const chatForm = container.querySelector('#chat-form');
  const textInput = container.querySelector('#chat-text-input');
  const fileInput = container.querySelector('#chat-file-input');
  const pointBtn = container.querySelector('#chat-point-btn');

  if (pointBtn && onLocationClick) pointBtn.addEventListener('click', onLocationClick);

  // Send Message Handler
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    const file = fileInput.files[0] || null;

    if (!text && !file) return;

    textInput.value = '';
    fileInput.value = '';

    try {
      await chatService.sendMessage(request.id, currentUser, text, file);
    } catch (err) {
      toast.error('Failed to send message: ' + err.message);
    }
  });

  // Subscribe to real-time messages
  const unsubscribe = chatService.subscribeMessages(request.id, (messages) => {
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center text-xs text-muted" style="margin: auto 0;">
          Direct chat started for <strong>${escapeHTML(request.itemName)}</strong>. Coordinate your meeting details below.
        </div>
      `;
      return;
    }

    messages.forEach(msg => {
      const isMe = msg.senderId === currentUser.uid;
      const isSeen = msg.seenBy && msg.seenBy.length > 1;

      // Mark seen if from other user
      if (!isMe && !msg.seenBy?.includes(currentUser.uid)) {
        chatService.markSeen(request.id, msg.id, currentUser.uid);
      }

      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}`;

      bubble.innerHTML = `
        ${!isMe ? `<div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">${escapeHTML(msg.senderName)}</div>` : ''}
        ${msg.imageURL ? `
          <div style="max-width: 200px; margin-bottom: 6px; border-radius: 6px; overflow: hidden;">
            <img src="${escapeHTML(msg.imageURL)}" alt="Shared photo" style="width: 100%; display: block;">
          </div>
        ` : ''}
        <div>${escapeHTML(msg.text)}</div>
        <div class="chat-bubble-time flex items-center justify-end gap-1">
          <span>${formatRelativeTime(msg.createdAt)}</span>
          ${isMe ? `<span title="${isSeen ? 'Seen' : 'Delivered'}">${isSeen ? '✓✓' : '✓'}</span>` : ''}
        </div>
      `;

      messagesContainer.appendChild(bubble);
    });

    // Auto-scroll to latest
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  container._unsubscribe = unsubscribe;
  return container;
}
