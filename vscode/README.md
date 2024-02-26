# react-intl-universal
## 使用方法
### 此插件需要配合`react-intl-universal`库使用
库地址： https://github.com/alibaba/react-intl-universal
### 在需要做国际化的文件夹(一般可以是项目跟目录)建立
intl.config.js 配置文件

返回一个函数, 函数返回config对象

可以在函数中访问vscode的api

## 配置示例
### 阿里内部
```
const path = require('path');
module.exports = ({vscode, utils}) => {
    return {
        localeDir: path.join(__dirname, 'src/locales'),
        skipFolderReg: /BaseChecker|locales/,
        mdsProjectName: 'XXX',// 参考文章：https://yuque.alibaba-inc.com/docs/share/69310a95-b3f1-4e77-a56c-2b0b2c82ae1c
        isAli: true,
        langKey: {
            en_US: '英语',
            zh_CN: '中文',
            zh_TW: '台湾',
        },
        ignoreCheckNode: (nodePath) => { // 自定义内容, 不需要可以不配置, 比如下面的代码，用来忽略console.error('这里有错误') 这类检查
            return nodePath.findParent(item => {
                const node = item.node;
                if (
                    (node.type === 'NewExpression'
                    && node.callee.name === 'Error')
                    || (
                        node.type === 'CallExpression'
                        && node.callee.type === 'MemberExpression'
                        && node.callee.object.name === 'console'
                    )
                ) {
                    return true;
                }
            });
        }
    }
}
```
### 阿里外部
```
const path = require('path');
module.exports = ({vscode, utils}) => {
    return {
        localeDir: path.join(__dirname, 'locales'),
        langKey: {
            zh_CN: '中文'
        }
    }
}
```

## 原理
根据当前文件位置, 向上查找配置文件, 直到找到的第一个为止
然后根据配置文件, 对当前文件进行国际化分析
## 功能
### 功能一, 自动查找已有Key, 并自动补全
#### 替换全部
![](https://img.alicdn.com/tfs/TB1gpdtCVP7gK0jSZFjXXc5aXXa-666-298.gif)

#### 只替换key
![](https://gw.alicdn.com/tfs/TB1jFsrcAcx_u4jSZFlXXXnUFXa-666-298.gif)

#### 处理html
![](https://gw.alicdn.com/tfs/TB1g9kJPAT2gK0jSZFkXXcIQFXa-899-529.gif)

#### 处理动态变量
![](https://gw.alicdn.com/tfs/TB1rUMMPxv1gK0jSZFFXXb0sXXa-962-502.gif)

### 提示是否有英文, 繁体(颜色标识黄色)
![](https://gw.alicdn.com/tfs/TB1dkHudIVl614jSZKPXXaGjpXa-926-236.gif)

### 功能二, 没有翻译的自动提交服务器(内部使用美杜莎)翻译(可定制翻译逻辑), 并直接替换, 支持自动生成key

![](https://gw.alicdn.com/tfs/TB1yegJPrr1gK0jSZFDXXb9yVXa-1090-648.gif)
### 支持查看所有文件, 标识出那些文案未翻译, 并自动标红, 自动跳转

![](https://gw.alicdn.com/tfs/TB1HT.UPpP7gK0jSZFjXXc5aXXa-1348-820.gif)

## 配置
### localeDir
备注: 如果没提供getLang, 此字段必填

说明: 配置国际化语言文件所在目录

类型: 字符串

default: 无

此参数和getLang必选其一
### getLang
说明: 可以自定义获取语言Map的逻辑

类型: 函数

返回: 返回一个跟langKey对应的Map, 比如{zh_CN: {key: value}, en_US: {key: value}, zh_TW: {key, value}}
default: 默认是读取localeDir目录中的所有文件, 并配置的langKey构建一个语言Map
```
getLang: (configObj: any) => {
    const localeDir = utils.getLocalDir(configObj);
    if (!fs.existsSync(localeDir)) {
        vscode.window.showWarningMessage('当前文件父目录中, 找不到locales目录, 请确定是否有locales目录');
        throw(new Error('找不到locales目录, 请至少选择src下面一个文件并打开'))
    }
    try {
        const langMap: any = {}
        Object.keys(configObj.langKey).forEach(key => {
            langMap[key] = JSON.parse(fs.readFileSync(`${localeDir}/${key}.json`).toString())
        });
        return langMap;
    } catch (e) {
        console.log(e);
        vscode.window.showWarningMessage(e);
    }
}
```
### langKey
说明: 表示本项目要支持哪些语言, 以及国际化文件夹中语言文件的名称映射, 用于在vscode中进行提示

类型: Object

default:
```
{
    zh_CN: '中文',
    en_US: '英文',
}
```
### defaultLang
说明: 默认语言, react-intl-universal .d函数中包裹的语言

类型: string

default: zh_CN

### displayErrorLangs
说明: 配置当缺少哪些语言时, 在编辑器中显示红色

类型: array

default: [defaultLang的值] // 表示, 如果没有汉语, 就会显示

### displayWarnLangs
说明: 配置当缺少哪些语言时, 在编辑器中显示黄色, 表示警告

类型: array

default: [langKey中的所有key值, NodeConstants.KEY_SAME] // 表示, 如果没有汉语, 英语, 繁体, 以及如果.d('')中的文案和localeDir文件夹中文案不一样 就会显示黄色警告

### fileCheckLangs
说明: 批量检测时候, 哪些不符合会显示警告

类型: 数组

default: [langKey中的所有key值]

### getFuncNameReg
说明: 配置intl.get().d() 中get 名称

类型: 正则

default: /^get|getHTML$/

### defaultFuncNameReg
说明: 配置intl.get().d() 中d 名称

类型: 正则

default: /^d|defaultMessage$/

### skipFolderReg
说明: 批量检测时候, 跳过哪些文件

类型: 正则

default: /(?:locales|intl\.config)/

### checkFileReg
说明: 批量检测时候, 要检测哪些文件

类型: 正则

default: /\.(?:ts|js|jsx|tsx)$/

### notSameText
说明: 配置文案, 提示不一致的时候, '不一致' 文案自定义

类型: string

default: '不一致'

### prefixStatusText
说明: 配置文案, 批量检测, 提示错误的时候, '缺少' 文案

类型: string

default: '缺少'

### isAli
说明: 配置是否是阿里内部, 如果为true, 将默认上传到美杜莎, 如果配置为true, 必须配置mdsProjectName

类型: boolean

default: false

### mdsProjectName
说明: 美杜莎的项目名称, 请一定注意让美杜沙项目owner到 https://acl.alibaba-inc.com/my/owner/permission/manage.htm?key=${appName} 将应用「修改」、「审核」权限授权给「one_box」帐号

类型: string

default: 无

### ignoreCheckNode
说明: 自定义语法分析逻辑, 哪些汉语会被忽略, 比如`console.error('这里有错误');` 这种汉子是不需要翻译的

类型: function

default:
```
ignoreCheckNode: (node: any) => {
    return false;
}
```
示例: 不提示 console.error('这里有错误') 的错误
```
ignoreCheckNode: (nodePath) => {
    return nodePath.findParent(item => {
        const node = item.node;
        if (
            (node.type === 'NewExpression'
            && node.callee.name === 'Error')
            || (
                node.type === 'CallExpression'
                && node.callee.type === 'MemberExpression'
                && node.callee.object.name === 'console'
            )
        ) {
            return true;
        }
    });
}
```
### uploadLang
说明: 自定义上传逻辑, 点击上传到语言服务器的时候, 执行的逻辑

类型: function

default:
```
uploadLang: (task: any, key: any, text: any, callback: any) => {
    task.updateLocals({
        [task.configObj.defaultLang]: [
            {
                key: key,
                text: text
            }
        ]
    });
    callback && callback();
    // callback 用来将key, text更新到编辑器
}
```
## 内置服务
### utils
#### getConfig
获取当前配置
### task
当前进行中的task, 主要免去重复的查找
可以直接使用一些已经存在的变量
#### langMap
当前的国际化文件, getLang() 返回内容
#### getConfig()
获取当前配置项
#### updateLocals
更新key, text到locale文件夹
参数实例:
```
{
    zh_CN: [
        {
            key: key,
            text: text
        }
    ],
    zh_EN: [
        {
            key: key,
            text: text
        }
    ]
}
```
## 交流
钉钉群: 32965438