-- CreateTable
CREATE TABLE "qwdtt_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT NOT NULL DEFAULT 'qWDTT',
    "listen_addr" TEXT NOT NULL DEFAULT '0.0.0.0:56000',
    "wg_port" INTEGER NOT NULL DEFAULT 56001,
    "dns" TEXT NOT NULL DEFAULT '8.8.8.8',
    "listen_raw" TEXT NOT NULL DEFAULT '0.0.0.0:56003',
    "listen_direct" TEXT NOT NULL DEFAULT '',
    "sub_host" TEXT NOT NULL DEFAULT '',
    "vk_hashes" TEXT NOT NULL DEFAULT '',
    "client_port" INTEGER NOT NULL DEFAULT 9000,
    "workers" INTEGER NOT NULL DEFAULT 16,
    "auto_vk_hash" BOOLEAN NOT NULL DEFAULT true,
    "main_password" TEXT NOT NULL DEFAULT '',
    "vk_cookies" TEXT NOT NULL DEFAULT '',
    "vk_calls" TEXT NOT NULL DEFAULT '',
    "remote_wdtt_url" TEXT NOT NULL DEFAULT '',
    "remote_wdtt_cookie" TEXT NOT NULL DEFAULT '',
    "remote_wdtt_csrf_token" TEXT NOT NULL DEFAULT '',
    "node_uuids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qwdtt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qwdtt_users" (
    "user_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT NOT NULL,
    "reported_up_bytes" BIGINT NOT NULL DEFAULT 0,
    "reported_down_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qwdtt_users_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "qwdtt_users" ADD CONSTRAINT "qwdtt_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
