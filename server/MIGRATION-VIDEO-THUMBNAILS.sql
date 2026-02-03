-- 🎬 Video Thumbnail URLs Migration
-- Add thumbnailUrl columns to support video thumbnails

-- 1. VerificationVideo table
ALTER TABLE "VerificationVideo"
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- 2. FriendChatMessage table
ALTER TABLE "FriendChatMessage"
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- 3. Message table (chat sessions)
ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Indexes (optional - for faster queries)
CREATE INDEX IF NOT EXISTS "Message_thumbnailUrl_idx" ON "Message"("thumbnailUrl");
CREATE INDEX IF NOT EXISTS "FriendChatMessage_thumbnailUrl_idx" ON "FriendChatMessage"("thumbnailUrl");
