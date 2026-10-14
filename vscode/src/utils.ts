import {extensions, window} from 'vscode';
import * as vscode from 'vscode';
import * as fs from 'fs';
import defaultConfig from './defaultConfig';
import NodeConstants from './constants/node';
const path = require('path');
const http = require('request-promise');
class Utils {
    publisher = 'rongpingli';
    name = 'react-intl-universal';
    vsConfigFile = vscode.workspace.getConfiguration(this.name);
    lastConfig: any = {};
    globalFileInfo: any = {};
    lastActiveTextEditor: any = null;
    outputChannel = vscode.window.createOutputChannel('react-intl-universal');
    getConfig() {
        var localConfigFileName = this.vsConfigFile.get('localConfigFileName');
        const src = this.getCurrentFileDir();
        const findConfigFile = (fileDir: any): any => {
            if (!path.isAbsolute(fileDir)) {
                return null;
                // fileDir = path.resolve(__dirname, fileDir);
            }
            if (fileDir == '/') {
                return null;
            } else if (
                !fs.existsSync(`${fileDir}/${localConfigFileName}`)
            ) {
                return findConfigFile(
                    path.dirname(fileDir)
                    // fileDir.substr(0, fileDir.lastIndexOf('/'))
                );
            } else {
                return `${fileDir}/${localConfigFileName}`;
            }
        }
        const configFile = findConfigFile(src);
        var configFileObj: any = {};
        if (configFile) {
            configFileObj = require(configFile);
            delete require.cache[configFile];
            const userConfig = configFileObj({
                vscode,
                defaultConfig: defaultConfig,
                utils: this,
                constants: {
                    ...NodeConstants
                }
            });
            const lastConfig = {
                ...defaultConfig,
                ...userConfig,
                baseDir: path.dirname(configFile)
            }
            // 默认lang 是否在langKey定义
            if (!lastConfig.langKey[lastConfig.defaultLang]) {
                vscode.window.showErrorMessage(`defaultLang: ${lastConfig.defaultLang} 默认语言, 在langKey中不存在`);
                return null;
            }
            if (!lastConfig.displayErrorLangs) {
                lastConfig.displayErrorLangs = [lastConfig.defaultLang];
            }
            if (!lastConfig.displayWarnLangs) {
                lastConfig.displayWarnLangs = [...Object.keys(lastConfig.langKey), NodeConstants.KEY_SAME];
            }
            if (!lastConfig.fileCheckLangs) {
                lastConfig.fileCheckLangs = [...Object.keys(lastConfig.langKey), NodeConstants.KEY_SAME];
            }
            this.lastConfig = lastConfig;
            return this.lastConfig;
        } else {
            // vscode.window.showErrorMessage(`请提供${localConfigFileName}配置文件`);
            throw(new Error('需要提供配置文件'));
        }
    }
    get extensionId() {
        return `${this.publisher}.${this.name}`;
    }
    get extension() {
        return extensions.getExtension(this.extensionId) as any;
    }
    appendOutputLine(str: string) {
        this.outputChannel.appendLine(str);
    }
    clearOutput() {
        this.outputChannel.clear();
    }
    showOutput() {
        this.outputChannel.show(true);
    }
    get intlConfigFile() {
        const activeTextEditor = window.activeTextEditor;
        if (!activeTextEditor) return;
        return '';
    }
    getCurrentFilePath() {
        const activeTextEditor = this.getActiveEditor();
        return activeTextEditor.document.fileName;
    }
    get getProjectSrc() {
        const activeTextEditor = this.getActiveEditor;
        return `${this.intlConfigFile}/src`;
    }
    getActiveEditor(): any {
        const activeTextEditor = window.activeTextEditor as any;
        if (activeTextEditor) {
            this.lastActiveTextEditor = activeTextEditor;
            return activeTextEditor;
        } else if (this.lastActiveTextEditor) {
            return this.lastActiveTextEditor;
        } else {
            window.showInformationMessage('请选择一个文件');
            throw new Error('请选择一个文件');
        }
    }
    getCurrentFileDir() {
        const activeTextEditor = this.getActiveEditor();
        return path.dirname(activeTextEditor.document.fileName);
    }
    addToMeidusha(task: any, key: string, text: string, callback: any) {
        const configObj = task.getConfig();
        if (!configObj.mdsProjectName) {
            vscode.window.showErrorMessage('需要提供美杜莎项目名称: mdsProjectName');
            return;
        }
        http({
            method: 'POST',
            uri: 'http://mcms.alibaba-inc.com/api/batchInsertOrUpdate',
            form: {
                userId: "960582",
                fromAppName: 'onebox',
                writeDTOs: JSON.stringify(
                    [
                        {
                            "appName": configObj.mdsProjectName,
                            "key": key,
                            "tagDTOList":[{"tagName":"tnpm"}],
                            "i18n":{
                                "zh_CN": text
                            }
                        }
                    ]
                )
            },
            json: true,
        }).then((body: any) => {
            if (body.resultCode && body.resultCode.message === 'success') {
                vscode.window.showInformationMessage(`美杜莎${configObj.mdsProjectName}提交${key}成功`);
                task.updateLocals({
                    [configObj.defaultLang]: [
                        {
                            key: key,
                            text: text
                        }
                    ]
                });
                callback && callback();
            } else {
                vscode.window.showWarningMessage(`美杜莎提交失败: ${body.errorDetail}`);
            }
        }).catch((err: any) => {
            console.log(err);
        });
    }
    getLocalDir(configObj: any) {
        if (!configObj.localeDir) {
            vscode.window.showErrorMessage(`请提供localeDir`);
            throw(new Error('需要提供localeDir'));
        }
        return configObj.localeDir;
    }
}
export default new Utils();