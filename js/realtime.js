// Realtime: live messages (postgres_changes) + Presence for online count.
import { sb } from './supabase.js';
import { userId, nickname } from './auth.js';

let msgChannel = null;
let presenceChannel = null;
let pixelChannel = null;

// Subscribe to live pixel changes on the shared canvas. handlers = {onInsert,onUpdate,onDelete}.
export function subscribePixels(chatId, handlers) {
  unsubscribePixels();
  pixelChannel = sb
    .channel('icc-pixels-' + chatId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'icc_pixels', filter: `chat_id=eq.${chatId}` },
      (p) => handlers.onInsert?.(p.new))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'icc_pixels', filter: `chat_id=eq.${chatId}` },
      (p) => handlers.onUpdate?.(p.new, p.old))
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'icc_pixels', filter: `chat_id=eq.${chatId}` },
      (p) => handlers.onDelete?.(p.old))
    .subscribe();
  return pixelChannel;
}
export function unsubscribePixels() {
  if (pixelChannel) { sb.removeChannel(pixelChannel); pixelChannel = null; }
}

// Subscribe to new messages for a chat. onInsert(row) fires per new row.
export function subscribeMessages(chatId, onInsert) {
  unsubscribeMessages();
  msgChannel = sb
    .channel('icc-msgs-' + chatId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'icc_messages', filter: `chat_id=eq.${chatId}` },
      (payload) => onInsert(payload.new))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'icc_messages', filter: `chat_id=eq.${chatId}` },
      (payload) => onInsert(payload.new, true))
    .subscribe();
  return msgChannel;
}

export function unsubscribeMessages() {
  if (msgChannel) { sb.removeChannel(msgChannel); msgChannel = null; }
}

// Presence: track this user online, report count via onChange(count).
export function subscribePresence(chatId, onChange) {
  unsubscribePresence();
  presenceChannel = sb.channel('icc-presence-' + chatId, {
    config: { presence: { key: userId() || crypto.randomUUID() } },
  });
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onChange(Object.keys(state).length, state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ nickname: nickname(), at: Date.now() });
      }
    });
  return presenceChannel;
}

export function unsubscribePresence() {
  if (presenceChannel) { sb.removeChannel(presenceChannel); presenceChannel = null; }
}
