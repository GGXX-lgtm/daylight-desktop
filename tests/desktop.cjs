const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
async function run() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daylight-e2e-"));
  const errors = [];
  let app;
  const launch = async () => {
    const env = { ...process.env, DAYLIGHT_TEST_DATA: dir };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      executablePath: process.env.DAYLIGHT_EXECUTABLE || undefined,
      args: process.env.DAYLIGHT_EXECUTABLE ? [] : [path.join(__dirname, "..")],
      env,
    });
    const page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: /新建任务/ }).waitFor();
    return page;
  };
  try {
    let page = await launch();
    await page.getByRole("button", { name: /新建任务/ }).click();
    await page.getByLabel("任务名称").fill("完成产品设计初稿");
    await page
      .getByRole("button", { name: "重点", exact: true })
      .last()
      .click();
    await page.getByLabel("预计时长（分钟）").fill("60");
    await page.getByLabel("安排一个时间区块").check();
    await page.getByLabel("开始时间").fill("09:00");
    await page
      .getByRole("button", { name: "添加任务", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "编辑 完成产品设计初稿" }).waitFor();
    assert.equal(await page.locator(".time-block").count(), 1);
    await page.getByRole("button", { name: /新建任务/ }).click();
    await page.getByLabel("任务名称").fill("重叠的任务");
    await page.getByLabel("安排一个时间区块").check();
    await page
      .getByRole("button", { name: "添加任务", exact: true })
      .last()
      .click();
    await page.getByRole("alert").filter({ hasText: "已有安排" }).waitFor();
    await page.getByLabel("开始时间").fill("10:00");
    await page
      .getByRole("button", { name: "添加任务", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "编辑 重叠的任务" }).waitFor();
    await page.getByRole("button", { name: "编辑 重叠的任务" }).click();
    await page.getByLabel("任务名称").fill("阅读与整理笔记");
    await page.getByRole("button", { name: "保存更改" }).click();
    await page
      .getByRole("button", { name: "完成任务 阅读与整理笔记", exact: true })
      .click();
    await page
      .getByRole("button", { name: "恢复任务 阅读与整理笔记", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "专注 完成产品设计初稿", exact: true })
      .click();
    await page.getByRole("button", { name: "开始专注", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".timer").innerText !== "25:00",
    );
    assert.notEqual(await page.locator(".timer").innerText(), "25:00");
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await page.getByRole("button", { name: "重置专注计时" }).click();
    await page.getByRole("button", { name: "后一天", exact: true }).click();
    assert.equal(await page.locator(".task-card").count(), 0);
    await page.getByRole("button", { name: "回到今天" }).click();
    assert.equal(await page.locator(".task-card").count(), 2);
    await page.getByText("数据已保存在本机", { exact: true }).waitFor();
    await fs.mkdir(path.join(__dirname, "../test-results"), {
      recursive: true,
    });
    if (await page.getByRole("button", { name: "关闭提示" }).count())
      await page.getByRole("button", { name: "关闭提示" }).click();
    await page.screenshot({
      path: path.join(__dirname, "../test-results/desktop.png"),
      fullPage: true,
    });
    await app.evaluate(
      ({ dialog }, exportPath) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: exportPath,
        });
      },
      path.join(dir, "export.json"),
    );
    await page.getByRole("button", { name: "设置与备份", exact: true }).click();
    await page.getByRole("button", { name: /导出任务备份/ }).click();
    await page.getByText("任务备份已导出", { exact: true }).waitFor();
    assert.equal(
      JSON.parse(await fs.readFile(path.join(dir, "export.json"), "utf8")).tasks
        .length,
      2,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => typeof window.require), "undefined");
    assert.equal(await page.evaluate(() => typeof window.process), "undefined");
    await app.close();
    app = null;
    page = await launch();
    assert.equal(await page.locator(".task-card").count(), 2);
    assert.equal(await page.locator(".task-card.completed").count(), 1);
    await page.getByRole("button", { name: "编辑 阅读与整理笔记" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "删除任务", exact: true }).click();
    await page.getByText("数据已保存在本机", { exact: true }).waitFor();
    assert.equal(await page.locator(".task-card").count(), 1);
    const stored = JSON.parse(
      await fs.readFile(path.join(dir, "daylight.json"), "utf8"),
    );
    assert.equal(stored.tasks.length, 1);
    assert.equal(stored.tasks[0].title, "完成产品设计初稿");
    await app.evaluate(
      ({ dialog }, importPath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [importPath],
        });
        dialog.showMessageBox = async () => ({ response: 1 });
      },
      path.join(dir, "export.json"),
    );
    await page.getByRole("button", { name: "设置与备份", exact: true }).click();
    await page.getByRole("button", { name: /导入任务备份/ }).click();
    await page.getByText("备份已导入", { exact: true }).waitFor();
    assert.equal(await page.locator(".task-card").count(), 2);
    await app.close();
    app = null;
    await fs.writeFile(path.join(dir, "daylight.json"), "{broken");
    page = await launch();
    await page
      .getByText("主数据文件异常，已恢复上一次备份。", { exact: true })
      .waitFor();
    assert.equal(await page.locator(".task-card").count(), 1);
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS: create, edit, complete, overlap prevention, date navigation, focus timer, restart persistence, deletion, export, import, corrupt-file recovery, sandbox",
    );
    console.log("Screenshot: test-results/desktop.png");
  } finally {
    if (app) await app.close();
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith("daylight-e2e-"));
    await fs.rm(dir, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
