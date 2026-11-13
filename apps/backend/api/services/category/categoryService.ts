import { prisma } from "../../prisma/client.js";

export default class CategoryService {
    static listCategories() {
        return prisma.category.findMany();
    }

    static createCategory(name: string) {
        return prisma.category.create({ data: { name } });
    }

    static updateCategory(id: number, name: string) {
        return prisma.category.update({
            where: { id },
            data: { name }
        });
    }
}
