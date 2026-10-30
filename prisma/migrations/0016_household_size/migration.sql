-- F31: alışveriş listesi için hane büyüklüğü.
ALTER TABLE "UserProfile" ADD COLUMN "householdSize" INTEGER NOT NULL DEFAULT 1;
