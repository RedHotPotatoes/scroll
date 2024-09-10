import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ScrollViewProvider(context.extensionUri);

    vscode.window.onDidChangeActiveColorTheme(() => {
        sendThemeInfo();
    });

    const getThemeKind = () => {
        const kind = vscode.window.activeColorTheme.kind;
        if (kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast) {
            return 'dark';
        }
        return 'light';
    };

    const sendThemeInfo = () => {
        const themeKind = getThemeKind();
        provider.postMessage({ themeKind });
    };
    sendThemeInfo();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ScrollViewProvider.viewType,
            provider
        )
    );
}

class ScrollViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'scroll.scrollview';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        this._view.webview.options = {
            enableScripts: true,
        };
		
		const appPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'app.js');
		const appUri = this._view.webview.asWebviewUri(vscode.Uri.file(appPath.path));
        this._view.webview.html = this._getHtmlForWebview(appUri);
    }

    public postMessage(message: any) {
        this._view?.webview.postMessage(message);
    }

	private _getHtmlForWebview(appUri: vscode.Uri) {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Webview</title>
			</head>
			<body>
				<div id="root"></div>
				<script src="${appUri}"></script>
			</body>
			</html>`;
	}
}

export function deactivate() {
    // Clean up resources when the extension is deactivated
}
