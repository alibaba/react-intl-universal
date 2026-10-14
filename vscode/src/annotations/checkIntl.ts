import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import * as vscode from "vscode";
import Commands from '../constants/commands';
import NodeConstants from '../constants/node';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import { debounce } from 'lodash'
import Task from '../services/Task';
import CheckFile from '../services/checkFiles';
const noKeyDecoration = vscode.window.createTextEditorDecorationType(
    {
        color: 'red'
    }
);
const hasKeyDecoration = vscode.window.createTextEditorDecorationType({
    opacity: '1',
    color: 'yellow',
    borderWidth: '10px'
});
class CheckAnnotation {
    ctx: ExtensionContext;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    debounceUpdate = debounce(() => this.update(), 500);
    update() {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (!activeTextEditor) return;
        const { document } = activeTextEditor;
        const task = new Task();
        const configObj = task.getConfig();
        if (!configObj.checkFileReg.test(document.fileName)) {
            return;
        }
        const checkFileService = new CheckFile({
            task: task
        });
        activeTextEditor.setDecorations(hasKeyDecoration, [])
        activeTextEditor.setDecorations(noKeyDecoration, [])
        const filepath = utils.getCurrentFilePath();
        checkFileService.checkFile(filepath).then((data: any) => {
            const noKeyRanges: any = [];
            const hasKeyRanges: any = [];
            data.forEach((item: any) => {
                const range = new vscode.Range(
                    document.positionAt(item.data.start),
                    document.positionAt(item.data.end),
                );
                if (item.type === NodeConstants.HAS_KEY) {
                    if (task.isError(item.trans)) {
                        noKeyRanges.push({
                            range,
                        });
                    } else if (task.isWarn(item.trans)){
                        hasKeyRanges.push({
                            range,
                            renderOptions: {
                                after: {
                                    color: 'rgba(153, 153, 153, .7)',
                                    contentText: checkFileService.getStatusText(
                                        item.trans,
                                        task.getConfig().displayWarnLangs
                                    ),
                                    fontWeight: 'normal',
                                    fontStyle: 'normal'
                                }
                            }
                        });
                    }
                } else {
                    noKeyRanges.push({
                        range,
                    });
                }
            });
            activeTextEditor.setDecorations(hasKeyDecoration, hasKeyRanges)
            activeTextEditor.setDecorations(noKeyDecoration, noKeyRanges)
        })
     }
    init() {
        this.ctx.subscriptions.push(window.onDidChangeActiveTextEditor(() => {
            this.debounceUpdate();
        }));
        this.ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
            this.debounceUpdate();
        }));
    }
    
}
export const createCheckAnnotation = (ctx: ExtensionContext) => {
    return new CheckAnnotation(ctx).init();
}