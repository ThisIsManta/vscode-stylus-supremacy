import * as fs from 'fs'
import * as fp from 'path'
import * as vscode from 'vscode'
import { format, createFormattingOptions, createFormattingOptionsFromStylint } from 'stylus-supremacy'

class Formatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider, vscode.OnTypeFormattingEditProvider {
    private workspaceFormattingOptions: object
    private formatOnSaveEnabled: boolean

    configure() {
        this.workspaceFormattingOptions = {}

        const config = vscode.workspace.getConfiguration('stylusSupremacy')
        for (let name in createFormattingOptions.schema) {
            if (config.has(name)) {
                this.workspaceFormattingOptions[name] = config.get(name)
            }
        }

        this.formatOnSaveEnabled = vscode.workspace.getConfiguration('editor').get('formatOnSave', false)
    }

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token)
    }

    provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token, range, true)
    }

    provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token, null, true)
    }

    provideOnSaveFormattingEdits(event: vscode.TextDocumentWillSaveEvent) {
        if (this.formatOnSaveEnabled && event.document.languageId === 'stylus' && event.reason === vscode.TextDocumentSaveReason.Manual) {
            const documentOptions = {
                insertSpaces: vscode.window.activeTextEditor.options.insertSpaces as boolean,
                tabSize: vscode.window.activeTextEditor.options.tabSize as number,
            }
            event.waitUntil((async () => {
                return this.format(event.document, documentOptions)
            })())
        }
    }

    private findStylintOptions(document: vscode.TextDocument): object {
        let stylintPath = null

        // Skip if there is no working directories (anonymous window)
        if (vscode.workspace.rootPath !== undefined) {
            if (document.isUntitled === false && document.fileName.startsWith(vscode.workspace.rootPath)) {
                // Find `.stylintrc` starting from the current active document up to the working directory
                const pathList = document.fileName.substring(vscode.workspace.rootPath.length).split(/(\\|\/)/).filter(path => path.length > 0)
                pathList.pop() // Remove the file name
                while (pathList.length >= 0) {
                    const workPath = fp.join(vscode.workspace.rootPath, ...pathList, '.stylintrc')
                    if (fs.existsSync(workPath)) {
                        stylintPath = workPath
                        break
                    } else if (pathList.length === 0) {
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
        }

        // Read `.stylintrc` and convert it to the standard formatting options
        if (stylintPath) {
            try {
                const stylintOptions = JSON.parse(fs.readFileSync(stylintPath, 'utf-8'))
                return createFormattingOptionsFromStylint(stylintOptions)
            } catch (ex) {
                console.error(ex)
            }
        }

        return {}
    }

    private format(document: vscode.TextDocument, documentOptions: vscode.FormattingOptions, cancellationToken?: vscode.CancellationToken, originalRange?: vscode.Range, ignoreErrors: boolean = false): vscode.TextEdit[] | null {
        const formattingOptions = {
            ...this.workspaceFormattingOptions,
            ...this.findStylintOptions(document),
            tabStopChar: documentOptions.insertSpaces ? ' '.repeat(documentOptions.tabSize) : '\t',
            newLineChar: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
            wrapMode: !!originalRange // True for partial formatting, otherwise false
        }

        try {
            let modifiedRange: vscode.Range
            let insertNewLineAtFirst = false
            let insertNewLineAtLast = false
            if (!originalRange) {
                // Expand the selection to cover the whole file
                modifiedRange = new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE)

            } else if (originalRange.start.line !== originalRange.end.line) {
                // Expand the selection to match the nearest closing braces
                let start: vscode.Position
                if (document.getText(new vscode.Range(originalRange.start.line, originalRange.start.character, originalRange.start.line + 1, 0)).trim().length === 0) {
                    start = new vscode.Position(originalRange.start.line + 1, 0)

                } else {
                    const remainingText = document.getText(new vscode.Range(originalRange.start.line, 0, originalRange.start.line, originalRange.start.character))
                    if (remainingText.includes('}')) {
                        start = new vscode.Position(originalRange.start.line, remainingText.lastIndexOf('}') + 1)
                        insertNewLineAtFirst = true

                    } else {
                        start = new vscode.Position(originalRange.start.line, 0)
                    }
                }

                let end: vscode.Position
                if (document.lineAt(originalRange.end.line).text.substring(originalRange.end.character).trim().charAt(0) === '}') {
                    end = new vscode.Position(originalRange.end.line, document.lineAt(originalRange.end.line).text.indexOf('}', originalRange.end.character) + 1)
                    insertNewLineAtLast = true

                } else if (originalRange.end.character === 0) {
                    end = new vscode.Position(originalRange.end.line - 1, Number.MAX_VALUE)

                } else {
                    const remainingText = document.lineAt(originalRange.end.line).text
                    if (remainingText.substring(0, originalRange.end.character).includes('}')) {
                        end = new vscode.Position(originalRange.end.line, remainingText.indexOf('}') + 1)
                        insertNewLineAtLast = true

                    } else if (remainingText.substring(originalRange.end.character).includes('}')) {
                        end = new vscode.Position(originalRange.end.line, remainingText.indexOf('}', originalRange.end.character) + 1)
                        insertNewLineAtLast = true

                    } else {
                        end = new vscode.Position(originalRange.end.line, Number.MAX_VALUE)
                    }
                }

                modifiedRange = new vscode.Range(start, end)

            } else {
                // Use the original selection
                modifiedRange = originalRange
            }

            // Stop processing if the selection range is not valid
            modifiedRange = document.validateRange(modifiedRange)
            if (modifiedRange.isEmpty) {
                return null
            }

            // Stop processing if the input content is empty
            const inputContent = document.getText(modifiedRange)
            if (inputContent.trim().length === 0) {
                return null
            }

            const outputContent = format(inputContent, formattingOptions)

            // Stop processing if it is cancelled or the output content is empty
            if (cancellationToken && cancellationToken.isCancellationRequested === true || outputContent.length === 0) {
                return null

            } else {
                // Replace with the output content
                return [vscode.TextEdit.replace(modifiedRange,
                    (insertNewLineAtFirst ? formattingOptions.newLineChar : '') +
                    outputContent +
                    (insertNewLineAtLast ? formattingOptions.newLineChar : '')
                )]
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

    // Subscribe "format document on type" event
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider('stylus', formatter, '}', ';', '\n'))

    // Subscribe "format document on save" event
    context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(event => formatter.provideOnSaveFormattingEdits(event)))
}

export function deactivate() { }