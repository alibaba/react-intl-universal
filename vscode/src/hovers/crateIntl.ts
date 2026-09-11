import { ExtensionContext, commands, window, HoverProvider, ViewColumn } from "vscode";
import Commands from '../constants/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import utils from "../utils";
import { debounce } from 'lodash'
import CheckFile from '../services/checkFiles';
import NodeConstants from "../constants/node";
import Task from "../services/Task";
var CRC32 = require('crc-32');
class CodeHover implements HoverProvider {
    task: any = null;
    configObj: any = {};
    constructor() {
    }
    getKeyByFileAndText(text: any) {
        const currentFilePath = utils.getCurrentFilePath();
        const relativePath = path.relative(this.configObj.baseDir, currentFilePath);
        const dirName = path.dirname(relativePath);
        const fileName = path.basename(relativePath, path.extname(relativePath));
        return dirName.split(/\/|\\/g).slice(-1).concat(fileName, CRC32.str(text)).join('_');
    }
    checkHasCn(cnText: string) {
        const langData = this.task.getLang();
        for (var i in langData[this.configObj.defaultLang]) {
            if (langData[this.configObj.defaultLang].hasOwnProperty(i)) {
                const text = langData[this.configObj.defaultLang][i];
                if (text === cnText) {
                    return i;
                }
            }
        }
        return false;
    }
    getCommandUrl(commandKey: any, params: any) {
        return `command:${commandKey}?${encodeURIComponent(JSON.stringify(params))}`
    }
    getHoverValue (commands: any) {
        const textArr: any = [];
        commands.forEach((command: any) => {
            textArr.push(`- [${command[0]}](${this.getCommandUrl(command[1], command[2])})`);
        });
        const markdown = new vscode.MarkdownString(textArr.join('\n'));
        markdown.isTrusted = true;
        return new vscode.Hover(markdown)
    }
    getHoverMarkDown(info: any) {
        if (info.type === NodeConstants.NO_KEY) {
            const startNode = info.data.startNode;
            const endNode = info.data.endNode;
            const range = {
                startLine: startNode.line - 1,
                startColumn: startNode.column,
                endLine: endNode.line - 1,
                endColumn: endNode.column
            };
            const resultKey = this.checkHasCn(info.intlText)
            if (resultKey) {
                return this.getHoverValue([
                    [
                        '已经存在Key, 自动填充',
                        Commands.AUTO_FILL_TEXT,
                        {
                            range: range,
                            text: `intl.get('${resultKey}').d('${info.intlText}')`
                        }
                    ],
                    [
                        '已经存在Key, 自动填充, 加大括号',
                        Commands.AUTO_FILL_TEXT,
                        {
                            range: range,
                            text: `{intl.get('${resultKey}').d('${info.intlText}')}`
                        }
                    ]
                ]);
            } else {
                return this.getHoverValue([
                    [
                        '添加到服务器',
                        Commands.OPEN_WEBVIEW,
                        {
                            replaceParams: info.data.replaceParams,
                            hasParams: info.data.hasParams,
                            getMethod: info.data.getMethod,
                            range: range,
                            text: info.intlText,
                            key: this.getKeyByFileAndText(info.intlText),
                            type: 'replaceWhole'
                        }
                    ]
                ]);
            }
        } else if (info.type === NodeConstants.HAS_KEY) {
            const trans = info.trans;
            const keyLocNode = info.data.keyLocNode;
            const startNode = keyLocNode.start;
            const endNode = keyLocNode.end;
            const range = {
                startLine: startNode.line - 1,
                startColumn: startNode.column,
                endLine: endNode.line - 1,
                endColumn: endNode.column
            }
            if (this.task.hasFalse(trans)) {
                if (trans[this.configObj.defaultLang]) {
                    if (trans[NodeConstants.KEY_SAME] === false) {
                        const textLocNode = info.data.textLocNode;
                        if (textLocNode) {
                            const startNode = textLocNode.start;
                            const endNode = textLocNode.end;
                            const range = {
                                startLine: startNode.line - 1,
                                startColumn: startNode.column,
                                endLine: endNode.line - 1,
                                endColumn: endNode.column
                            }
                            const langData = this.task.getLang();
                            return this.getHoverValue([
                                [
                                    '不一致, 自动更新',
                                    Commands.AUTO_FILL_TEXT,
                                    {
                                        range: range,
                                        text: `'${langData[this.configObj.defaultLang][info.intlKey]}'`
                                    }
                                ]
                            ]);
                        }
                    } else {
                        return this.getHoverValue([
                            [
                                '已经添加到服务器, 但是缺少英文, 或者繁体',
                                Commands.OPEN_WEBVIEW,
                                {
                                    range: range,
                                    text: info.intlText,
                                    key: this.getKeyByFileAndText(info.intlText),
                                    type: 'replaceWhole'
                                }
                            ]
                        ]);
                    }
                } else {
                    const resultKey = this.checkHasCn(info.intlText);
                    if (resultKey) {
                        return this.getHoverValue([
                            [
                                '已经存在Key, 自动填充',
                                Commands.AUTO_FILL_TEXT,
                                {
                                    range: range,
                                    text: `'${resultKey}'`
                                }
                            ]
                        ]);
                    } else {
                        return this.getHoverValue([
                            [
                                '不存在Key, 添加到服务器',
                                Commands.OPEN_WEBVIEW,
                                {
                                    range: range,
                                    text: info.intlText,
                                    key: info.intlKey,
                                    type: 'replaceKey'
                                }
                            ]
                        ]);
                    }
                }
            }
        }
    }
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const info = utils.globalFileInfo[document.fileName];
        if (info) {
            this.task = new Task();
            this.configObj = this.task.getConfig();
            const infoAtPositon = Object.values(info).find((item: any) => {
                const offset = document.offsetAt(position);
                return offset >= item.data.start && offset <= item.data.end;
            });
            if (infoAtPositon) {
                return this.getHoverMarkDown(infoAtPositon);
            }
        }
        return;
    }
}
export const createCodeHover = (ctx: ExtensionContext) => {
    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { pattern: '**/*.{ts,js,tsx,jsx}' },
            new CodeHover()
        )
    );
}