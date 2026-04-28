-- ============================================================
-- Migration: add_disputes_indexes
-- Run this SQL in your Render PostgreSQL console or via psql
-- ============================================================

-- 1. Add 'disputed' value to the OrderStatus enum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'disputed';

-- 2. Create the disputes table
CREATE TABLE IF NOT EXISTS "disputes" (
    "id"          TEXT         NOT NULL,
    "order_id"    TEXT         NOT NULL,
    "opened_by"   TEXT         NOT NULL,
    "reason"      TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'open',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- 3. Unique constraint: one dispute per order
CREATE UNIQUE INDEX IF NOT EXISTS "disputes_order_id_key"
    ON "disputes"("order_id");

-- 4. Foreign key to orders
ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_order_id_fkey"
    FOREIGN KEY ("order_id")
    REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Performance indexes on lots
CREATE INDEX IF NOT EXISTS "lots_created_at_idx" ON "lots"("created_at");
CREATE INDEX IF NOT EXISTS "lots_user_id_idx"    ON "lots"("user_id");
CREATE INDEX IF NOT EXISTS "lots_is_sold_idx"    ON "lots"("is_sold");

-- 6. Performance indexes on orders
CREATE INDEX IF NOT EXISTS "orders_status_idx"     ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");

-- 7. Performance indexes on messages
CREATE INDEX IF NOT EXISTS "messages_order_id_idx"   ON "messages"("order_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");

-- 8. Performance indexes on transactions
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx"   ON "transactions"("user_id");
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions"("created_at");
