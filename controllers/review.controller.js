const { createReview, getSellerReviews, createReviewBodySchema } = require('../services/review.service');

async function submitReview(req, res, next) {
  try {
    const reviewerId = req.user.sub || req.user.id;
    const review = await createReview(req.params.orderId, reviewerId, req.validated.body);
    res.status(201).json({ success: true, review });
  } catch (e) {
    next(e);
  }
}

async function sellerReviews(req, res, next) {
  try {
    const data = await getSellerReviews(req.params.sellerId);
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

module.exports = { submitReview, sellerReviews, createReviewBodySchema };
