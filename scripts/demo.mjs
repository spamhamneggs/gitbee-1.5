// Local, isolated demo. Uses an installed MariaDB on Windows or Docker elsewhere.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = path.join(root, ".demo");
const backend = path.join(root, "apps/backend");
const frontend = path.join(root, "apps/frontend");
const children = [];
mkdirSync(state, { recursive: true });
const secretPath = path.join(state, "jwt-secret");
if (!existsSync(secretPath))
  writeFileSync(secretPath, randomBytes(32).toString("hex"));
const env = {
  ...process.env,
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  PORT: "5001",
  WEB_URL: "http://localhost:8000",
  JWT_SECRET: readFileSync(secretPath, "utf8"),
  COOKIE_NAME: "gitbee_demo_token",
  BYPASS_SSO: "false",
  NEXT_PUBLIC_COOKIE_NAME: "gitbee_demo_token",
  NEXT_PUBLIC_BACKEND_API: "http://localhost:5001/api/",
  NEXT_PUBLIC_BYPASS_SSO: "false",
  NEXT_PUBLIC_CACHE_LOCATION: "sessionStorage",
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw (
      result.error ??
      new Error(`${path.basename(command)} failed (${result.status})`)
    );
}
function node(script, args, cwd) {
  run(process.execPath, [script, ...args], cwd);
}
function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", (error) => {
    console.error(error);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (code && !stopping) {
      console.error(`Demo process exited (${code}).`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
}
function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await canConnect(3309)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Demo database did not start on port 3309.");
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

try {
  for (const [directory, module] of [
    [backend, "prisma"],
    [frontend, "next"],
  ]) {
    if (!existsSync(path.join(directory, "node_modules", module)))
      throw new Error(
        `Install dependencies first: npm --prefix apps/${directory === backend ? "backend" : "frontend"} install --ignore-scripts --package-lock=false`,
      );
  }
  for (const port of [5001, 8000])
    if (await canConnect(port))
      throw new Error(
        `Port ${port} is already in use. Stop the previous app before starting this demo.`,
      );
  if (process.env.DATABASE_URL) {
    env.DATABASE_URL = process.env.DATABASE_URL;
    if (
      !/^\/gitbee_demo(?:_[a-z0-9]+)?$/.test(new URL(env.DATABASE_URL).pathname)
    )
      throw new Error("Use a dedicated gitbee_demo database.");
  } else {
    const option = process.argv.indexOf("--mysql-bin");
    const mysqlBin =
      option >= 0
        ? process.argv[option + 1]
        : process.platform === "win32" &&
            existsSync("C:/xampp/mysql/bin/mysqld.exe")
          ? "C:/xampp/mysql/bin"
          : undefined;
    if (mysqlBin) {
      const data = path.join(state, "mysql");
      if (await canConnect(3309))
        throw new Error(
          "Port 3309 is in use. Set DATABASE_URL explicitly to an existing gitbee_demo database, or stop the previous demo.",
        );
      if (!existsSync(path.join(data, "my.ini")))
        run(path.join(mysqlBin, "mysql_install_db.exe"), [
          `--datadir=${data}`,
          "--port=3309",
        ]);
      start(
        path.join(mysqlBin, "mysqld.exe"),
        [
          `--defaults-file=${path.join(data, "my.ini")}`,
          "--bind-address=127.0.0.1",
          "--console",
        ],
        root,
      );
      await waitForDatabase();
      run(path.join(mysqlBin, "mysql.exe"), [
        "--host=127.0.0.1",
        "--port=3309",
        "--user=root",
        "-e",
        "CREATE DATABASE IF NOT EXISTS gitbee_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      ]);
      env.DATABASE_URL = "mysql://root@127.0.0.1:3309/gitbee_demo";
    } else {
      const existing = spawnSync("docker", ["inspect", "gitbee-demo-db"], {
        stdio: "ignore",
        windowsHide: true,
      });
      if (existing.status === 0) run("docker", ["start", "gitbee-demo-db"]);
      else
        run("docker", [
          "run",
          "-d",
          "--name",
          "gitbee-demo-db",
          "-p",
          "127.0.0.1:3309:3306",
          "-e",
          "MYSQL_ROOT_PASSWORD=gitbee-demo-local",
          "-e",
          "MYSQL_DATABASE=gitbee_demo",
          "-v",
          "gitbee_demo_data:/var/lib/mysql",
          "mysql:8.0",
        ]);
      env.DATABASE_URL =
        "mysql://root:gitbee-demo-local@127.0.0.1:3309/gitbee_demo";
      await waitForDatabase();
      // MySQL may open its TCP port before bootstrap has finished. Check auth.
      for (let attempt = 0; attempt < 60; attempt++) {
        const ping = spawnSync(
          "docker",
          [
            "exec",
            "gitbee-demo-db",
            "mysql",
            "-uroot",
            "-pgitbee-demo-local",
            "-e",
            "SELECT 1",
          ],
          { stdio: "ignore", windowsHide: true },
        );
        if (ping.status === 0) break;
        if (attempt === 59) throw new Error("Demo MySQL did not become ready.");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  node(
    "node_modules/prisma/build/index.js",
    ["generate", "--config", "api/prisma.config.ts"],
    backend,
  );
  node(
    "node_modules/prisma/build/index.js",
    ["migrate", "deploy", "--config", "api/prisma.config.ts"],
    backend,
  );
  node(
    "node_modules/tsx/dist/cli.mjs",
    ["api/prisma/demo/seedDemo.ts"],
    backend,
  );
  node(
    "node_modules/tsx/dist/cli.mjs",
    ["api/prisma/demo/generateSamples.ts"],
    backend,
  );
  start(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "watch", "api/index.ts"],
    backend,
  );
  start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "-p",
      "8000",
    ],
    frontend,
  );
  console.log(
    "\nGitBee demo: http://localhost:8000/demo-login\nAdmin: admin@example.test\nPassword: GitbeeDummy#2026\nDatabase: gitbee_demo on localhost:3309\nCtrl+C stops app processes. Docker data is retained.\n",
  );
} catch (error) {
  console.error(error.message);
  shutdown(1);
}
