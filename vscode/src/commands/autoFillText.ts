import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import * as vscode from "vscode";
import Commands from '../constants/commands';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import CheckFile from '../services/checkFiles'
class AutoFillText {
    ctx: any;
    panel: any;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    init() {
        this.ctx.subscriptions.push(commands.registerCommand(Commands.AUTO_FILL_TEXT, (params) => {
            // 获取当前文件路径, 然后根据路径获取配置文件
            const activeTextEditor = utils.getActiveEditor()
            activeTextEditor.edit((editBuilder: any) => {
                editBuilder.replace(new vscode.Range(
                    params.range.startLine,
                    params.range.startColumn,
                    params.range.endLine,
                    params.range.endColumn
                ), params.text);
            })
        }));
    }
    
}
export const createAutoFillText = (ctx: ExtensionContext) => {
    return new AutoFillText(ctx).init();
}