import { prisma } from "../../prisma/client.js";

export default class TechnologyService {
    static listTechnologies() {
        return prisma.technology.findMany();
    }

    static createTechnology(name: string) {
        return prisma.technology.create({ data: { name } });
    }

    static updateTechnology(id: number, name: string) {
        return prisma.technology.update({
            where: { id },
            data: { name }
        });
    }
}
