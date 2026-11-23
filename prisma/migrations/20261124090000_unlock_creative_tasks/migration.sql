-- No lock on creative work any more (owner, Nov 2026): every task that is still waiting LOCKED becomes workable now.
-- Due date = the batch's due date if it has one, otherwise now + that task type's SLA (same rule as an unlock).
-- Data only, no schema change: older releases already handle TODO tasks.
UPDATE "Task" AS t
SET "status" = 'TODO',
    "unlockedAt" = NOW(),
    "dueAt" = COALESCE(
      t."dueAt",
      b."dueAt",
      CASE WHEN c."slaHours" > 0 THEN NOW() + make_interval(hours => c."slaHours") ELSE NULL END
    )
FROM "Task" AS t2
LEFT JOIN "CreativeBatch" AS b ON b."id" = t2."batchId"
LEFT JOIN "TaskTypeConfig" AS c ON c."taskType" = t2."type"
WHERE t."id" = t2."id" AND t."status" = 'LOCKED';
