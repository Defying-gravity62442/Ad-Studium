-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "calendarEventsPermission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calendarReadPermission" BOOLEAN NOT NULL DEFAULT false;
