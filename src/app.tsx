import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';

import assistantLogo from './assets/assistant-logo.png';
import dislikeButton from './assets/dislike-button.png';
import goButton from './assets/go-button.png';
import likeButton from './assets/like-button.png';

const SERVER_ADDRESS = 'https://446c-109-236-92-134.ngrok-free.app';

interface ResizableSearchBarProps {
    onRequestClick: (text: string) => void;
}

interface ResizableSearchBarState {
    text: string;
}

class ResizableSearchBar extends React.Component<ResizableSearchBarProps, ResizableSearchBarState> {
    private inputRef: React.RefObject<HTMLTextAreaElement>;
    private divRef: React.RefObject<HTMLDivElement>;
    private searchBarStyle: React.CSSProperties;
    private inputStyle: React.CSSProperties;
    private trailingIconStyle: React.CSSProperties;

    private maxHeight: number = 150;

    constructor(props: any) {
        super(props);
        this.state = {
            text: '',
        };
        this.inputRef = React.createRef();
        this.divRef = React.createRef();

        this.searchBarStyle = {
            width: '95%',
            backgroundColor: 'var(--vscode-editor-background)',
            borderRadius: '7px',
            left: '2.5%',
            display: 'flex',
            alignItems: 'center',
            border: '0.5px solid',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            resize: 'none',
            paddingBottom: '15px',
            position: 'absolute',
            bottom: '12px'
        };

        this.inputStyle = {
            width: '85%',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--vscode-editor-foreground)',
            opacity: 0.7,
            outline: 'none',
            resize: 'none',
            maxHeight: `${this.maxHeight}px`,
            fontSize: '95%',
            marginLeft: '10px',
            marginTop: '15px',
        };

        this.trailingIconStyle = {
            position: 'absolute',
            right: '-7px',
            top: '-7px',
            transform: 'scale(0.8)',
        };
    }

    adjustHeight = () => {
        const inputElement = this.inputRef.current;
        const divElement = this.divRef.current;

        if (inputElement) {
            inputElement.style.height = 'auto';
            const scrollHeight = inputElement.scrollHeight;
            inputElement.style.height = `${scrollHeight}px`;
            if (divElement) {
                divElement.style.height = `${Math.min(scrollHeight, this.maxHeight)}px`;
            }
        }
    };

    handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ text: e.target.value });
        this.adjustHeight();
    };

    handleClick = () => {
        const text = this.state.text;
        if (text.length === 0) {
            return;
        }
        this.setState({ text: '' });
        this.props.onRequestClick(text);
    };

    componentDidMount() {
        this.adjustHeight();
    }

    render(): React.ReactNode {
        const buttonStyle = {
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            outline: 'none',
            padding: '0',
            margin: '0',
        };

        return (
            <div style={this.searchBarStyle} ref={this.divRef}>
                <textarea
                    placeholder='Paste error message...'
                    ref={this.inputRef}
                    style={this.inputStyle}
                    value={this.state.text}
                    onChange={this.handleChange}
                />
                <button style={buttonStyle}>
                    <img src={goButton} style={this.trailingIconStyle} onClick={this.handleClick}/>
                </button>
            </div>
        );
    }
}

interface AssistantResponseProps {
    text: string;
}

class AssistantResponse extends React.Component<AssistantResponseProps, {}> {
    private containerStyle: React.CSSProperties;
    private assistantTextStyle: React.CSSProperties;
    private topRowStyle: React.CSSProperties;

    constructor(props: any) {
        super(props);

        this.containerStyle = {
            width: '95%',
            left: '2.5%',
            backgroundColor: 'transparent',
            color: 'var(--vscode-editor-foreground)',
            position: 'absolute',
        };

        this.assistantTextStyle = {
            color: 'var(--vscode-editor-foreground)',
            fontSize: 'x-small',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center'
        };

        this.topRowStyle = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        };
    }

    render() {
        return (
            <div style={this.containerStyle}>
                <div style={this.topRowStyle}>
                    <div style={{ display: 'flex'}}>
                        <img src={assistantLogo} style={{width: '24px', height: '24px', marginRight: '10px'}} />
                        <div style={this.assistantTextStyle}>Scroll Assistant</div>
                    </div>
                    <div style={{ display: 'flex'}}>
                        <img src={likeButton} style={{width: '15px', height: '12px', marginRight: '5px'}} />
                        <img src={dislikeButton} style={{width: '15px', height: '12px'}} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
                    <div style={{ flex: '1 1 auto', maxHeight: '85vh', overflowY: 'auto' }}>
                        <ReactMarkdown>{this.props.text}</ReactMarkdown>
                    </div>
                </div>
            </div>
        );
    }
}

interface MainViewState {
    text: string;
}

class MainView extends React.Component<{}, MainViewState> {
    constructor(props: any) {
        super(props);
        this.state = {
            text: '',
        };
        this.handleRequest = this.handleRequest.bind(this);
    }
    
    handleRequest = (text: string) => {
        this.streamingRequest(text);
    };

    streamingRequest(errorMessageText: string): void {
        const errorMessage = encodeURIComponent(`${errorMessageText}`);

        this.setState({ text: `**Fetching response...**` });
        const url = `${SERVER_ADDRESS}/generate_solution?error_message=${errorMessage}`;
        fetch(url, {
            method: 'post'
        })
            .then(response => {
                if (!response.ok) {
                    this.setState({ text: 'Error fetching response' });
                } else {
                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder('utf-8');

                    var firstTokenReceived: boolean = false;
                    const readStream = (): void => {
                        reader?.read().then(({ done, value }) => {
                            if (done) {
                                return;
                            }
                            if (!firstTokenReceived) {
                                this.setState({ text: '' });
                                firstTokenReceived = true;
                            }
                            const text = decoder.decode(value, { stream: true });
                            this.setState({ text: this.state.text + text });
                            readStream();
                        });
                    };
                    readStream();
                }
            })
            .catch((error) => this.setState({ text: `Cathing error during fetching response ${error}` }));
    }

    render() {
        return (
            <div>
                <AssistantResponse text={this.state.text}/>
                <ResizableSearchBar onRequestClick={this.handleRequest}/>
            </div>
        );
    }
}

const App = () => {
    return <MainView />;
};

ReactDOM.render(<App />, document.getElementById('root'));
