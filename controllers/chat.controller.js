const { z } = require("zod");
const { listMessages, sendMessage } = require("../services/chat.service");

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
      req.validated.body.text
    );
    res.status(201).json({ success: true, message });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getOrderMessages,
  sendOrderMessage,
  sendMessageBodySchema,
};
