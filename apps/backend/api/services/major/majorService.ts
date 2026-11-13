import { prisma } from "../../prisma/client.js";

export default class MajorService {
    static listMajors() {
        return prisma.major.findMany();
    }
}
