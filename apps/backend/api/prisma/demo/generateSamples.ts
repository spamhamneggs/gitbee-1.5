import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sampleFile } from "../../utils/demo/sampleFiles.js";

const output = path.resolve(process.argv[2] ?? "samples/demo");
await mkdir(output, { recursive: true });
for (const type of ["student", "staff"] as const) {
  for (const format of ["csv", "xlsx"] as const) {
    for (const broken of [false, true]) {
      const name = `${type}${broken ? "-with-errors" : "-sample"}.${format}`;
      await writeFile(
        path.join(output, name),
        sampleFile(type, format, broken),
      );
    }
  }
}
console.log(`Eight sample files written to ${output}`);
