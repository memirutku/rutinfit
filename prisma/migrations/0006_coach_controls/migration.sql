-- F58: koçu aç/kapa ve üslup seçimi.
ALTER TABLE "AISettings" ADD COLUMN "coachEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AISettings" ADD COLUMN "tone" TEXT NOT NULL DEFAULT 'supportive';
