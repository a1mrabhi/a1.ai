-- CreateTable
CREATE TABLE "AnalystDataset" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "sheetName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "columns" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystConversation" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalystMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalystDataset_userId_idx" ON "AnalystDataset"("userId");

-- CreateIndex
CREATE INDEX "AnalystConversation_datasetId_idx" ON "AnalystConversation"("datasetId");

-- CreateIndex
CREATE INDEX "AnalystMessage_conversationId_idx" ON "AnalystMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "AnalystDataset" ADD CONSTRAINT "AnalystDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystConversation" ADD CONSTRAINT "AnalystConversation_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AnalystDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystMessage" ADD CONSTRAINT "AnalystMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AnalystConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
