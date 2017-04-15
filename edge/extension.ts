import * as fs from 'fs'
import * as fp from 'path'
import * as vscode from 'vscode'
import { format, createFormattingOptionsFromStylintOptions } from 'stylus-supremacy'

const defaultFormattingOptions = require('stylus-supremacy/edge/defaultFormattingOptions.json')

class Formatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    private workspaceFormattingOptions: object

    configure() {
        this.workspaceFormattingOptions = {}

        const config = vscode.workspace.getConfiguration('stylusSupremacy')
        for (let name in defaultFormattingOptions) {
            if (config.has(name)) {
                this.workspaceFormattingOptions[name] = config.get(name)
            }
        }
    }

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token)
    }

    provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token, range, true)
    }

    private findStylintOptions(document: vscode.TextDocument): object {
        let stylintPath = null
        if (!document.isUntitled && document.fileName.startsWith(vscode.workspace.rootPath)) {
            // Find `.stylintrc` starting from the current viewing document up to the working directory
            const pathList = document.fileName.substring(vscode.workspace.rootPath.length).split(/(\\|\/)/).filter(path => path.length > 0)
            pathList.pop() // Remove the file name
            while (pathList.length >= 0) {
                const workPath = fp.join(vscode.workspace.rootPath, ...pathList, '.stylintrc')
                if (fs.existsSync(workPath)) {
                    stylintPath = workPath
                    break
                }
                pathList.pop()
            }

        } else {
            // Find `.stylintrc` in the working directory
            const workPath = fp.join(vscode.workspace.rootPath, '.stylintrc')
            if (fs.existsSync(workPath) === false) {
                stylintPath = workPath
            }
        }

        if (stylintPath) {
            try {
                const stylintOptions = JSON.parse(fs.readFileSync(stylintPath, 'utf-8'))
                return createFormattingOptionsFromStylintOptions(stylintOptions)
            } catch (ex) {
                console.error(ex)
            }
        }

        return {}
    }

    private format(document: vscode.TextDocument, documentOptions: vscode.FormattingOptions, cancellationToken: vscode.CancellationToken, range?: vscode.Range, ignoreErrors: boolean = false): vscode.ProviderResult<vscode.TextEdit[]> {
        const formattingOptions = {
            ...this.workspaceFormattingOptions,
            ...this.findStylintOptions(document),
            tabStopChar: documentOptions.insertSpaces ? ' '.repeat(documentOptions.tabSize) : '\t',
            newLineChar: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
            wrapMode: !!range // true for partial formatting, otherwise false
        }
        console.log(formattingOptions);

        try {
            // Extend the selection range
            if (range && range.start.line !== range.end.line) {
                range = new vscode.Range(range.start.line, 0, range.end.line, Number.MAX_VALUE)
            }

            const content = document.getText(range)
            const result = format(content, formattingOptions)
            
            // Show a warning dialog
            if (result.warnings.length > 0 && ignoreErrors === false) {
                vscode.window.showWarningMessage(result.warnings[0].message)
                result.warnings.forEach(warn => {
                    console.warn(warn.message)
                })
            }

            if (cancellationToken.isCancellationRequested || result.text.length === 0) {
                return null
            } else if (range) {
                return [vscode.TextEdit.replace(range, result.text)]
            } else {
                return [vscode.TextEdit.replace(new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), result.text)]
            }

        } catch (ex) {
            if (ignoreErrors === false) {
                vscode.window.showWarningMessage(ex.message)
                console.error(ex)
            }

            return null
        }
    }
}

const formatter = new Formatter()

export function activate(context: vscode.ExtensionContext) {
    // Initialize settings
    formatter.configure()

    // Update settings
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        formatter.configure()
    }))

    // Subscribe "format document" event
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('stylus', formatter))

    // Subscribe "format selection" event
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider('stylus', formatter))
}

export function deactivate() { }