import * as vscode from 'vscode';
import NodeConstants from "../constants/node";
const fs = require('fs');
import utils from "../utils"
export default class {
    configObj: any = null;
    langMap: any = null;
    getConfig() {
        if (!this.configObj) {
            this.configObj = utils.getConfig();
        }
        return this.configObj;
    }
    updateLocals(params: any) {
        const configObj: any = this.getConfig();
        const localdir = utils.getLocalDir(configObj);
        const langData = this.getLang()
        Object.keys(params).forEach((locKey) => {
            const originData = langData[locKey];
            params[locKey].forEach((item: any) => {
                originData[item.key] = item.text;
            });
            fs.writeFileSync(`${localdir}/${locKey}.json`,
                JSON.stringify(originData, null, 4));
        });
    }
    checkKey(key: string, nodeValue: string) {
        const langMap = this.getLang();
        const configObj = this.getConfig();
        const result: any = {};
        Object.keys(configObj.langKey).forEach((langKey: any) => {
            result[langKey] = langMap[langKey][key];
            if (result[langKey]) {
                if (langKey === configObj.defaultLang) {
                    // 如果有模板操作符, 就不做检查, 因为本来就不一致
                    result[NodeConstants.KEY_SAME] = langMap[langKey][key] === nodeValue.replace(/\$\{/g, '{');
                }
            }
        });
        return result;
    }
    isError(result: any) {
        const configObj = this.getConfig();
        return configObj.displayErrorLangs.find((item: any) => {
            return !result[item];
        });
    }
    isWarn(result: any) {
        const configObj = this.getConfig();
        return configObj.displayWarnLangs.find((item: any) => {
            return !result[item];
        });
    }
    isCheck(result: any) {
        const configObj = this.getConfig();
        return configObj.fileCheckLangs.find((item: any) => {
            return !result[item];
        });
    }
    hasFalse(result: any) {
        return Object.keys(result).find((item: any) => {
            return !result[item];
        });
    }
    getLang() {
        if (!this.langMap) {
            const configObj = this.getConfig();
            this.langMap = configObj.getLang(configObj);
            return this.langMap;
        } else {
            return this.langMap;
        }
    }
} 