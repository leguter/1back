const { z } = require('zod');
const {
  listMessages,
  sendMessage,
  getChatList,
  markTyping,
  getOtherTyping,
} = require('../services/chat.service');

const sendMessageBodySchema = z.object({
  text: z.string().min(1).max(5000),
});

async function getOrderMessages(req, res, next) {
  try {
    const messages = await listMessages(req.params.orderId, req.user.sub || req.user.id);
    res.json({ success: true, messages });
  } catch (e) {
    next(e);
  }
}

async function sendOrderMessage(req, res, next) {
  try {
    const message = await sendMessage(
      req.params.orderId,
      req.user.sub || req.user.id,
      req.validated.body.text,
    );
    res.status(201).json({ success: true, message });
  } catch (e) {
    next(e);
  }
}

async function getChats(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const chats = await getChatList(userId);
    res.json({ success: true, chats });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/chat/:orderId/typing
 * Called by the frontend whenever the user is actively typing.
 * No body required. Always responds 200 immediately.
 */
async function setTyping(req, res) {
  try {
    const userId = req.user.sub || req.user.id;
    markTyping(req.params.orderId, userId);
  } catch (_) {
    // silently ignore — typing is best-effort
  }
  res.json({ ok: true });
}

/**
 * GET /api/chat/:orderId/typing
 * Returns whether the other participant in this order is currently typing.
 * Response: { typing: boolean }
 */
async function getTyping(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const otherId = await getOtherTyping(req.params.orderId, userId);
    res.json({ typing: otherId !== null });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getOrderMessages,
  sendOrderMessage,
  getChats,
  setTyping,
  getTyping,
  sendMessageBodySchema,
};
