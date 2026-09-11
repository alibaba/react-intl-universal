import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import Commands from '../constants/commands';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import Task from '../services/Task';
import CheckFile from '../services/checkFiles'
import NodeConstants from "../constants/node";
class CheckFiles {
    ctx: any;
    panel: any;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    init() {
        this.ctx.subscriptions.push(commands.registerCommand(Commands.CHECK_ALL_FILES, () => {
            // 获取当前文件路径, 然后根据路径获取配置文件
            const currentDir = utils.getCurrentFilePath()
            window.showInputBox({
                prompt: '请输入要check的文件夹路径',
                value: currentDir,
                valueSelection: [currentDir.lastIndexOf('/'), currentDir.length]
            }).then((dir: any) => {
                const task = new Task();
                const checkFileService = new CheckFile({
                    task: task
                });
                const consoleErrors = (ferrors: any) => {
                    if (task.getConfig().errorHandle) {
                        task.configObj.errorHandle(ferrors);
                    }
                    utils.clearOutput();
                    ferrors = ferrors.filter((item: any) => {
                        if (item.type === NodeConstants.HAS_KEY) {
                            return task.isCheck(item.trans);
                        } else if (item.type === NodeConstants.NO_KEY) {
                            return true;
                        }
                    });
                    
                    if (ferrors.length > 0) {
                        ferrors.forEach((item: any) => {
                            const filePath = item.filePath;
                            const consolePath = `${filePath}:${item.data.startNode.line}:${item.data.startNode.column}`;
                            if (item.type === NodeConstants.HAS_KEY) {
                                checkFileService.consolePath(consolePath, item.trans);
                            } else if (item.type === NodeConstants.NO_KEY) {
                                checkFileService.consolePath(consolePath, {
                                    [task.configObj.defaultLang]: false,
                                });
                            }
                        });
                    } else {
                        utils.appendOutputLine('此文件正常, 没有国际化问题');
                    }
                    utils.showOutput();
                }
                if (fs.statSync(dir).isFile()) {
                    checkFileService.checkFile(dir).then(consoleErrors)
                } else {
                    checkFileService.getFiles(dir).then(consoleErrors)
                }
            });
        }));
    }
    
}
export const createCheckFiles = (ctx: ExtensionContext) => {
    return new CheckFiles(ctx).init();
}