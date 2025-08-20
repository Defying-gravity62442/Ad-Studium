-- Deactivate the extra tutorial steps (8, 9, 10)
UPDATE "TutorialStep" SET
    "isActive" = false,
    "updatedAt" = NOW()
WHERE "stepNumber" IN (8, 9, 10);
