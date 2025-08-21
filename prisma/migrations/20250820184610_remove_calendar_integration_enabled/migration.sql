/*
  Warnings:

  - You are about to drop the column `calendarIntegrationEnabled` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "calendarIntegrationEnabled";
