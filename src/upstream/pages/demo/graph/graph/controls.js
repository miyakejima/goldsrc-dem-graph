export default class Controls {
    constructor(graph) {
        this.graph = graph;

        this.isPlayBack = false;
        this.playBackSpeed = 10;
        this.playBackTimer = null;

        this.onKeyDownListener = this.onKeyDown.bind(this);
        this.attachEventListeners();

        graph.on('activated', () => this.onGraphActivated());
        graph.on('deactivated', () => this.onGraphDeactivated());
        graph.on('setFocus', (frame) => this.onSetFocus(frame));
    }

    onGraphActivated() {
        this.attachEventListeners();
    }

    onGraphDeactivated() {
        this.stopPlayBack();
        this.detachEventListeners();
    }

    onSetFocus(frame) {
        if (frame !== undefined) {
            this.stopPlayBack();
        }
    }

    startPlayBack() {
        this.stopPlayBack();

        if (this.graph.focusFrame !== undefined) {
            return;
        }

        this.isPlayBack = true;

        this.playBackTimer = setInterval(() => {
            this.graph.moveCursor(this.graph.cursorFrame + 1, true);
            this.graph.scrollTo(Math.floor(this.graph.cursorFrame - this.graph.getGraphicWindowBounds().width * 0.2));

            if (this.graph.cursorFrame === this.graph.totalFrames) {
                this.stopPlayBack();
            }
        }, this.playBackSpeed);
    }

    stopPlayBack() {
        this.isPlayBack = false;

        if (this.playBackTimer) {
            clearInterval(this.playBackTimer);
            this.playBackTimer = null;
        }
    }

    togglePlayBack() {
        if (this.isPlayBack) {
            this.stopPlayBack();
        } else {
            this.startPlayBack();
        }
    }

    goForward(frames) {
        this.graph.moveCursor(this.graph.cursorFrame + frames);
    }

    goBackwards(frames) {
        this.graph.moveCursor(this.graph.cursorFrame - frames);
    }

    goStart() {
        this.graph.moveCursor(1);
    }

    goEnd() {
        this.graph.moveCursor(this.graph.totalFrames);
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.onKeyDownListener);
    }

    detachEventListeners() {
        document.removeEventListener('keydown', this.onKeyDownListener);
    }

    /**
     *  @param {KeyboardEvent} event
     *  */
    onKeyDown(event) {
        let framesToGo = 1;

        const keyMap = {
            ArrowLeft: () => this.goBackwards(framesToGo),
            KeyA: () => this.goBackwards(framesToGo),
            ArrowRight: () => this.goForward(framesToGo),
            KeyD: () => this.goForward(framesToGo),
            Home: () => this.goStart(),
            End: () => this.goEnd(),
            PageDown: () => this.goBackwards(this.graph.getGraphicWindowBounds().width),
            PageUp: () => this.goForward(this.graph.getGraphicWindowBounds().width),
        };

        if (event.code === 'Space') {
            this.togglePlayBack();
            event.preventDefault();
            return;
        }

        if (event.shiftKey) {
            framesToGo = 10;
        } else if (event.ctrlKey) {
            framesToGo = 100;
        }

        if (event.code in keyMap) {
            event.preventDefault();

            if (!this.isPlayBack) {
                keyMap[event.code]();

                this.graph.scrollTo(Math.floor(this.graph.cursorFrame - this.graph.getGraphicWindowBounds().width * 0.5));
            }
        }
    }
};

