-- CreateTable
CREATE TABLE "awg_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT NOT NULL DEFAULT 'AmneziaWG',
    "default_version" TEXT NOT NULL DEFAULT '2.0',
    "dns" TEXT NOT NULL DEFAULT '1.1.1.1, 8.8.8.8',
    "keepalive" INTEGER NOT NULL DEFAULT 25,
    "allowed_ips" TEXT NOT NULL DEFAULT '0.0.0.0/0, ::/0',
    "mtu" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awg_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awg_instances" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "node_uuid" UUID NOT NULL,
    "listen_port" INTEGER NOT NULL DEFAULT 51820,
    "listen" TEXT NOT NULL DEFAULT '::',
    "subnet" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "mtu" INTEGER NOT NULL DEFAULT 0,
    "dns" TEXT NOT NULL DEFAULT '1.1.1.1, 8.8.8.8',
    "keepalive" INTEGER NOT NULL DEFAULT 25,
    "allowed_ips" TEXT NOT NULL DEFAULT '0.0.0.0/0, ::/0',
    "endpoint" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '2.0',
    "jc" INTEGER NOT NULL DEFAULT 0,
    "jmin" INTEGER NOT NULL DEFAULT 0,
    "jmax" INTEGER NOT NULL DEFAULT 0,
    "s1" INTEGER NOT NULL DEFAULT 0,
    "s2" INTEGER NOT NULL DEFAULT 0,
    "s3" INTEGER NOT NULL DEFAULT 0,
    "s4" INTEGER NOT NULL DEFAULT 0,
    "h1" TEXT NOT NULL DEFAULT '',
    "h2" TEXT NOT NULL DEFAULT '',
    "h3" TEXT NOT NULL DEFAULT '',
    "h4" TEXT NOT NULL DEFAULT '',
    "i1" TEXT NOT NULL DEFAULT '',
    "i2" TEXT NOT NULL DEFAULT '',
    "i3" TEXT NOT NULL DEFAULT '',
    "i4" TEXT NOT NULL DEFAULT '',
    "i5" TEXT NOT NULL DEFAULT '',
    "header_protection_key" TEXT NOT NULL DEFAULT '',
    "content_padding_addition" TEXT NOT NULL DEFAULT '',
    "rekey_after_time" TEXT NOT NULL DEFAULT '',
    "rekey_timeout" TEXT NOT NULL DEFAULT '',
    "reject_after_time" TEXT NOT NULL DEFAULT '',
    "keepalive_timeout" TEXT NOT NULL DEFAULT '',
    "max_handshake_attempts" TEXT NOT NULL DEFAULT '',
    "random_trailers" BOOLEAN NOT NULL DEFAULT false,
    "disable_cookies" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awg_instances_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "awg_peers" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instance_uuid" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "bound" BOOLEAN NOT NULL DEFAULT true,
    "granted_manually" BOOLEAN NOT NULL DEFAULT true,
    "private_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "preshared_key" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awg_peers_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "awg_instances_node_uuid_key" ON "awg_instances"("node_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "awg_peers_instance_uuid_user_id_key" ON "awg_peers"("instance_uuid", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "awg_peers_instance_uuid_address_key" ON "awg_peers"("instance_uuid", "address");

-- CreateIndex
CREATE INDEX "awg_peers_user_id_idx" ON "awg_peers"("user_id");

-- AddForeignKey
ALTER TABLE "awg_instances" ADD CONSTRAINT "awg_instances_node_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awg_peers" ADD CONSTRAINT "awg_peers_instance_uuid_fkey" FOREIGN KEY ("instance_uuid") REFERENCES "awg_instances"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awg_peers" ADD CONSTRAINT "awg_peers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
