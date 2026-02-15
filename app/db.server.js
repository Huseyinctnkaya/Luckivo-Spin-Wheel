import { PrismaClient } from "@prisma/client";

// Forced fresh instance to resolve schema sync issues
const prisma = new PrismaClient();

export default prisma;
