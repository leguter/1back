const { z } = require('zod');
const { prisma } = require('../utils/prisma');
const { AppError } = require('../utils/AppError');

const COMMISSION_RATE = 0.10; // 10%

const createReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

async function createReview(orderId, reviewerId, { rating, comment }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { review: true },
  });

  if (!order) throw new AppError(404, 'Order not found');
  if (order.buyerId !== String(reviewerId)) throw new AppError(403, 'Only the buyer can leave a review');
  if (order.status !== 'completed') throw new AppError(400, 'Can only review completed orders');
  if (order.review) throw new AppError(409, 'You have already reviewed this order');

  const review = await prisma.review.create({
    data: {
      orderId,
      reviewerId: String(reviewerId),
      sellerId: order.sellerId,
      rating,
      comment: comment ?? null,
    },
  });

  return review;
}

async function getSellerReviews(sellerId) {
  const reviews = await prisma.review.findMany({
    where: { sellerId: String(sellerId) },
    orderBy: { createdAt: 'desc' },
    include: {
      reviewer: { select: { id: true, username: true, firstName: true, avatar: true } },
    },
  });

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return { reviews, averageRating: avg ? Math.round(avg * 10) / 10 : null, count: reviews.length };
}

module.exports = { createReview, getSellerReviews, createReviewBodySchema, COMMISSION_RATE };
