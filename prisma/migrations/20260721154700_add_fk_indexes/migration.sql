-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderDocument_orderId_idx" ON "OrderDocument"("orderId");

-- CreateIndex
CREATE INDEX "Request_companyId_idx" ON "Request"("companyId");

-- CreateIndex
CREATE INDEX "RequestMessage_requestId_idx" ON "RequestMessage"("requestId");
