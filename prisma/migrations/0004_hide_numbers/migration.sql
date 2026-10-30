-- F56: kalori ve makro sayılarını gizleme tercihi.
ALTER TABLE "UserProfile" ADD COLUMN "hideNumbers" BOOLEAN NOT NULL DEFAULT false;
