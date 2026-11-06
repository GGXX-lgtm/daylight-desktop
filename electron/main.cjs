const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const dev = process.argv.includes("--dev");
const testDir = process.env.DAYLIGHT_TEST_DATA;
if (testDir) app.setPath("userData", testDir);
let win,
  model,
  writeQueue = Promise.resolve();
const dataPath = () => path.join(app.getPath("userData"), "daylight.json");
async function readData() {
  try {
    return {
      data: model.validateData(
        JSON.parse(await fs.readFile(dataPath(), "utf8")),
      ),
    };
  } catch (error) {
    if (error.code === "ENOENT")
      return { data: { ...model.EMPTY_DATA, tasks: [] } };
    try {
      return {
        data: model.validateData(
          JSON.parse(await fs.readFile(`${dataPath()}.bak`, "utf8")),
        ),
        warning: "主数据文件异常，已恢复上一次备份。",
      };
    } catch {
      throw new Error(
        "数据文件无法读取。请先保留数据文件，并从设置导入有效备份。",
      );
    }
  }
}
async function atomicWrite(data) {
  await fs.mkdir(path.dirname(dataPath()), { recursive: true });
  const temp = `${dataPath()}.tmp`;
  // Back up validated content only; never overwrite a good backup with corrupt JSON.
  try {
    const old = await fs.readFile(dataPath(), "utf8");
    model.validateData(JSON.parse(old));
    await fs.writeFile(`${dataPath()}.bak`, old, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT" && e.code !== undefined && e.name !== "SyntaxError")
      throw e;
  }
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temp, dataPath());
}
function saveData(data) {
  const clean = model.validateData(data);
  const job = writeQueue.then(() => atomicWrite(clean));
  writeQueue = job.catch(() => {});
  return job;
}
function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw new Error("不受信任的请求");
    return handler(...args);
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      model = await import("../shared/model.js");
      Menu.setApplicationMenu(null);
      win = new BrowserWindow({
        width: 1320,
        height: 900,
        minWidth: 1050,
        minHeight: 700,
        show: false,
        backgroundColor: "#f8f8f4",
        title: "今日 · Daylight",
        icon: path.join(__dirname, "../dist/daylight.png"),
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#f8f8f4",
          symbolColor: "#345347",
          height: 42,
        },
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          devTools: dev || Boolean(testDir),
        },
      });
      register("data:load", readData);
      register("data:save", async (data) => {
        await saveData(data);
        return true;
      });
      register("data:export", async () => {
        await writeQueue;
        const { data } = await readData();
        const result = await dialog.showSaveDialog(win, {
          title: "导出任务备份",
          defaultPath: `Daylight-${model.localDate()}.json`,
          filters: [{ name: "JSON 备份", extensions: ["json"] }],
        });
        if (result.canceled) return false;
        await fs.writeFile(
          result.filePath,
          JSON.stringify(data, null, 2),
          "utf8",
        );
        return true;
      });
      register("data:import", async () => {
        const result = await dialog.showOpenDialog(win, {
          title: "导入任务备份",
          properties: ["openFile"],
          filters: [{ name: "JSON 备份", extensions: ["json"] }],
        });
        if (result.canceled) return null;
        const file = result.filePaths[0];
        if ((await fs.stat(file)).size > 5 * 1024 * 1024)
          throw new Error("备份文件不能超过 5 MB");
        const data = model.validateData(
          JSON.parse(await fs.readFile(file, "utf8")),
        );
        const answer = await dialog.showMessageBox(win, {
          type: "question",
          title: "替换现有任务？",
          message: `将导入 ${data.tasks.length} 个任务并替换当前任务。现有数据会自动备份。`,
          buttons: ["取消", "导入并替换"],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer.response !== 1) return null;
        await saveData(data);
        return data;
      });
      const entry = pathToFileURL(
        path.join(__dirname, "../dist/index.html"),
      ).href;
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e, url) => {
        if (url !== (dev ? "http://127.0.0.1:5173/" : entry))
          e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      let allowClose = false;
      win.on("close", (event) => {
        if (!allowClose) {
          event.preventDefault();
          writeQueue.finally(() => {
            allowClose = true;
            win.close();
          });
        }
      });
      win.once("ready-to-show", () => win.show());
      if (dev) await win.loadURL("http://127.0.0.1:5173/");
      else await win.loadFile(path.join(__dirname, "../dist/index.html"));
    })
    .catch((e) => {
      dialog.showErrorBox("Daylight 启动失败", e.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
