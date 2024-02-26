// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// "react-intl-universal.globalConfigType": {
// "type": "string",
// "default": "npm",
// "description": "配置类型, 是文件路径, 还是npm包, 值有:npm 或者 file"
// },
// "react-intl-universal.globalConfig": {
// "type": "string",
// "default": "",
// "description": "配置文件地址, JS文件, 可以使用nodejs API"
// },
import * as vscode from 'vscode';
import * as actionModules from './actions/codeAction';
import * as annotationModules from './annotations/checkIntl';
import * as hoverModules from './hovers/crateIntl';
import * as customCommands from './commands/index';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "react-intl-universal" is now active!');
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
	});
	Object.values({
		...actionModules, 
		...annotationModules,
		...hoverModules,
		...customCommands
	}).forEach((module: any) => {
		module(context);
	})
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
