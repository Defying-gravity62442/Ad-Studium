-- Completely delete the extra tutorial steps (8, 9, 10)
DELETE FROM "TutorialStep" WHERE "stepNumber" IN (8, 9, 10);
