-- Prisma 7 models implicit many-to-many join tables with a composite primary
-- key instead of the unique index emitted by the source Prisma 5 migration.
-- This adaptation preserves every relationship row while making the existing
-- next-keystone-starter database match the Prisma 7 physical schema.
DROP INDEX "_Todo_todoImages_AB_unique";

ALTER TABLE "_Todo_todoImages"
ADD CONSTRAINT "_Todo_todoImages_AB_pkey" PRIMARY KEY ("A", "B");
