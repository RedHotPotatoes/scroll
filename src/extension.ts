import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ScrollViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ScrollViewProvider.viewType,
            provider
        )
    );

	console.log('Congratulations, your extension "scroll" is now active!');
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
        this._view.webview.html = this._getHtmlForWebview();
    }

	private _getHtmlForWebview() {
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body>
				<!-- Create search bar of the width of 0.95 of the webview and height of 30px.
				The search bar has the fill color D9D9D9 and the opacity 10% and corner radius 7px. 
				The position of the search bar is on the center of the webview horizontally and 2% from the bottom of the webview. 
				The text color is white and opacity is 100%. 
				Add border of white color and width of 0.5px to the search bar. The borders' opacity should be different from the seach bar and 
				should be equal to 1. Add trailing element button with icon static/Trailing-Elements.png-->			
				<style>
					.search-bar {
						width: 95%;
						height: 30px;
						background-color: #D9D9D9;
						opacity: 0.1;
						border-radius: 7px;
						position: absolute;
						left: 2.5%;
						bottom: 2%;
					}
				</style>
				<div class="search-bar">
					<input type="text" placeholder="Search" style="width: 90%; height: 100%; background-color: transparent; border: none;">
					<img src="./static/Trailing-Elements.png" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%);" />
				</div>
			</body>
			</html>
		`;
	}
}

export function deactivate() {
    // Clean up resources when the extension is deactivated
}
