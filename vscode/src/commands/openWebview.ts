import { ExtensionContext, commands, window, ViewColumn } from "vscode";
import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
var CRC32 = require('crc-32'); 
import EventConstants from "../constants/events";
import utils from "../utils";
import CommandConstants from "../constants/commands";
import Task from "../services/Task";
const http = require('request-promise');
class TransView {
    ctx: any;
    panel: any;
    lastParams: any;
    constructor(ctx: ExtensionContext) {
        this.ctx = ctx;
    }
    init() {
        this.ctx.subscriptions.push(commands.registerCommand(CommandConstants.OPEN_WEBVIEW, (params) => {
            params.text = params.text.replace(/^[`'"]|[`";\']$/g, '');
            this.lastParams = params;
            this.createPanel(params);
        }));
    }
    createPanel(params: any) {
        if (!this.panel) {
            this.panel = window.createWebviewPanel(
                'transView',
                '上传到服务器',
                ViewColumn.Beside,
                {
                    enableCommandUris: true,
                    enableScripts: true
                }
            );
            const {webview} = this.panel;
            try {
                vscode.workspace.fs.readFile(vscode.Uri.file(path.join(utils.extension.extensionPath, 'static/trans.html')))
                .then((data: any) => {
                    webview.html = data.toString();
                    this.panel.onDidChangeViewState((webview: any) => {
                        if (webview.webviewPanel.active) {
                            // this.panel.webview.postMessage({
                            //     type: EventConstants.ADD_TO_MEIDUSHA,
                            //     data: params
                            // });
                        }
                    });
                    this.panel.onDidDispose((webview: any) => {
                        this.panel = null;
                    });
                    webview.onDidReceiveMessage(this.onMessage.bind(this));
                });
            } catch (e) {
                console.log(e);
            }
        } else {
            this.panel.webview.postMessage({
                type: EventConstants.ADD_TO_MEIDUSHA,
                data: params
            });
        }
    }
    postmessage(params: any) {
        this.panel.webview.postMessage(params);
    }
    webviewReplace(params: any) {
        var text = '';
        const getMethod = params.getMethod || 'get';
        const getParams = params.hasParams ? ', ' + params.replaceParams : '';
        if (params.type === 'replaceKey') {
            text = `'${params.key}'`;
        } else if (params.type === 'replaceWhole' && !params.hasKuo) {
            text = `intl.${getMethod}('${params.key}'${getParams}).d('${params.text}')`;
        } else if (params.type === 'replaceWhole' && params.hasKuo) {
            text = `{intl.${getMethod}('${params.key}'${getParams}).d('${params.text}')}`;
        }
        vscode.commands.executeCommand(CommandConstants.AUTO_FILL_TEXT, {
            range: params.range,
            text: text
        });
    }
    onMessage({type, data}: any) {
        const task = new Task();
        const configObj = task.getConfig();
        switch(type) {
            case EventConstants.REQUEST_READY_INITDATA: {
                this.postmessage({
                    type: EventConstants.ADD_TO_MEIDUSHA,
                    data: this.lastParams
                });
                break;
            }
            case EventConstants.AUTO_CREATE_KEY: {
                var hashKey = CRC32.str(data.text);
                const langData = task.getLang();
                if (langData[configObj.defaultLang][hashKey]) {
                    hashKey = CRC32.str(data.text + '' + new Date().getTime().toString());
                }
                this.postmessage({
                    type: EventConstants.AUTO_TRANS_KEY,
                    data: hashKey
                });
                break;
            }
            case EventConstants.UPDATE_EDITOR_TEXT: {
                this.webviewReplace(data);
                break;
            }
            case EventConstants.SUBMIT_TO_MEIDUSHA: {
                const callback = () => {
                    if (data.isUpdate) {
                        this.webviewReplace(data);
                    }
                };
                if (configObj.isAli) {
                    utils.addToMeidusha(task, data.key, data.text, callback);
                } else {
                    configObj.uploadLang && configObj.uploadLang(task, data.key, data.text, callback);
                }
                
                break;
            }
        }
        
    }
}
export const createWebView = (ctx: ExtensionContext) => {
    return new TransView(ctx).init();
}