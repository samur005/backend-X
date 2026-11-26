-- AlterTable
ALTER TABLE "internal_squads" ADD COLUMN "include_qwdtt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "qwdtt_users" ADD COLUMN "granted_manually" BOOLEAN NOT NULL DEFAULT true;
