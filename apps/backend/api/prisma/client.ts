import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);

export const prisma = new PrismaClient({ adapter }).$extends({
  result: {
    user: {
      password: {
        needs: {},
        compute() {
          return undefined;
        },
      },
    },
  },
});
