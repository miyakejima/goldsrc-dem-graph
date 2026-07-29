import { Application, Container, Graphics, Point, Rectangle, Text, Color } from 'pixi.js';
import screenfull from 'screenfull';

import DeltaHelper from './delta-helper';
import Controls from './graph/controls';
import GraphicsEngineFps from './graph/graphics/engine-fps';
import GraphicsSwitcher from './graph/graphics-switcher';
import Information from './graph/information';
import Death from './graph/death';
import StartStopLines from './graph/start-stop-lines';
import Pauses from './graph/pauses';
import GraphicsRealFps from './graph/graphics/real-fps';
import GraphicsMouseX from './graph/graphics/mouse-x';
import GraphicsMouseXSpeed from './graph/graphics/mouse-x-speed';
import GraphicsJumpHeight from './graph/graphics/jump-height';
import * as Bars from './graph/bars';
import { EventEmitter } from 'events';

export default class Graph extends EventEmitter {
    constructor() {
        super();

        this.setMaxListeners(Infinity);

        this.programs = [];
        /**
         * @type {Application}
         */
        this.app = null;

        /**
         * @type {Renderer}
         */
        this.renderer = null;
        this.totalFrames = 0;
        this.data = null;
        this.controls = new Controls(this);
        this.graphicsSwitcher = new GraphicsSwitcher(this);

        this.scrollbar = new Graphics();
        this.scroller = new Graphics();
        this.gui = new Container();
        this.guiSystemElements = new Graphics();
        this.graphic = new Container();
        this.information = new Container();
        this.graphicWindow = new Container();
        this.barsContainer = new Container();
        this.barsLabels = new Container();
        this.barsLines = new Graphics();
        this.bars = [];
        this.activated = true;

        this.cursor = new Graphics();
        this.cursor.renderable = false;

        this.focus = new Graphics();
        this.marker1 = new Graphics();
        this.marker2 = new Graphics();

        this.cursorFrame = 1;
        this.focusFrame = void 0;
        this.marker1Frame = void 0;
        this.marker2Frame = void 0;
        this.graphicCursorPosition = void 0;

        this.barsDrawingHeight = 260;

        this.initBars();
        this.initGraphics();
    }

    destroy() {
        this.emit('destroy');

        this.app.destroy(false, { children: true});
        this.app = null;
    }

    init(view, frames, data) {
        globalThis.__PIXI_APP__ = this.app = new Application({
            width: view.clientWidth,
            height: view.clientHeight,
            view: view,
            resizeTo: view,
        });
        this.renderer = this.app.renderer;

        view.addEventListener('wheel', this.onWheel.bind(this));

        this.totalFrames = frames;

        this.graphicWindow.addChild(this.graphic);
        this.graphicWindow.position.set(80, 162);
        this.graphicWindow.mask = new Graphics();
        this.graphicWindow.addChildAt(this.graphicWindow.mask, 0);
        this.information.position.set(80, 0);

        this.app.stage.addChild(this.information);
        this.app.stage.addChild(this.gui);
        this.app.stage.addChild(this.graphicWindow);

        this.graphic.addChildAt(this.focus, 0);
        this.graphic.addChildAt(this.cursor, 0);
        this.graphic.addChildAt(this.marker1, 0);
        this.graphic.addChildAt(this.marker2, 0);

        this.drawGui();

        this.graphic.addChild(this.barsContainer);
        this.updateBarsElementsPosition();

        this.emit('init');

        this.graphicWindow.eventMode = 'static';
        this.graphicWindow.on('click', this.onGraphicClick, this);
        this.graphicWindow.on('rightclick', this.onGraphicClick, this);
        this.graphicWindow.on('pointermove', this.onGraphicMouseMove, this);

        this.updateBarsPositions();

        this.initData(data);
    }

    activate() {
        this.activated = true;

        this.emit('activated');
    }

    deactivate() {
        this.activated = false;

        this.emit('deactivated');
    }

    initBars() {
        const config = [
            {index: 3, bar: new Bars.BarBack(this)},
            {index: 6, bar: new Bars.BarDuck(this)},
            {index: 5, bar: new Bars.BarDuckState(this)},
            {index: 4, bar: new Bars.BarForward(this)},
            {index: 12, bar: new Bars.BarFreezeTime(this)},
            {index: 7, bar: new Bars.BarGround(this)},
            {index: 8, bar: new Bars.BarJump(this)},
            {index: 2, bar: new Bars.BarMoveLeft(this)},
            {index: 1, bar: new Bars.BarMoveRight(this)},
            {index: 11, bar: new Bars.BarMovetype(this)},
            // {index: 13, bar: new Bars.BarSlowMo(this)},
            {index: 9, bar: new Bars.BarTechniques(this)},
            {index: 10, bar: new Bars.BarUse(this)},
        ];

        config.forEach(({index, bar}) => {
            this.programs.push(bar);
            this.addBar(index, bar);
        });
    }

    initGraphics() {
        this.programs.push(this.graphicsSwitcher);
        this.programs.push(new GraphicsEngineFps(this));
        this.programs.push(new GraphicsRealFps(this));
        this.programs.push(new GraphicsMouseX(this));
        this.programs.push(new GraphicsMouseXSpeed(this));
        this.programs.push(new GraphicsJumpHeight(this));
        this.programs.push(new Information(this));
        this.programs.push(new Death(this));
        this.programs.push(new StartStopLines(this));
        this.programs.push(new Pauses(this));
    }

    initData(data) {
        this.data = data;
        this.canonical = data['graphCanonicalV1'] || null;

        ['cd', 'esp', 'wd'].forEach(key => {
            for (var deltaKey in this.data[key]) {
                if (!this.data[key].hasOwnProperty(deltaKey)) {
                    continue;
                }

                if (Object.prototype.toString.call(this.data[key][deltaKey]) === '[object Object]') {
                    this.data[key][deltaKey].__proto__ = DeltaHelper;
                }
            }
        });
        this.data['maxspeed'].__proto__ = DeltaHelper;

        this.emit('dataLoaded', this.data);
    }

    drawGui() {
        this.gui.removeChild(this.guiSystemElements);

        this.guiSystemElements = new Graphics();

        this.guiSystemElements.beginFill(0x7F7F7F, 1);
        this.guiSystemElements.drawRect(79, 0, 1, this.renderer.height);
        this.guiSystemElements.endFill();

        this.gui.addChildAt(this.guiSystemElements, 0);
        this.gui.addChild(this.barsLabels);
        this.gui.addChild(this.barsLines);

        this.drawScrollBar();
        this.drawGoFullScreenText();

        /** @type Graphics */
        let mask = this.graphicWindow.mask;
        let gwb = this.getGraphicWindowBounds();

        mask.clear();
        mask.beginFill(0, 1);
        mask.drawRect(0, 0, gwb.width, gwb.height);
        mask.endFill();

        this.graphicWindow.hitArea = new Rectangle(0, 0, gwb.width, gwb.height);
    }

    drawScrollBar() {
        if (this.scrollbar) {
            this.guiSystemElements.removeChild(this.scrollbar);
            this.scrollbar.destroy({ children: true });
            this.scrollbar = null;
            this.scroller = null;
        }

        this.scrollbar = new Graphics();
        this.scrollbar.eventMode = 'static';
        this.scrollbar.position.set(80, this.renderer.height - 20);
        this.scrollbar.beginFill(0x888888, 1);
        this.scrollbar.drawRect(0, 0, this.renderer.width - this.scrollbar.position.x, 20);
        this.scrollbar.endFill();

        this.scroller = new Graphics();
        this.scroller.renderable = this.totalFrames > this.getGraphicWindowBounds().width;
        this.scroller.beginFill(0x666666, 1);
        this.scroller.drawRect(0, 0, 100, 20);
        this.scroller.endFill();
        this.scroller.eventMode = 'static';
        this.scroller
            .on('pointerdown', this.onDragStart, this)
            .on('pointerup', this.onDragEnd, this)
            .on('pointerupoutside', this.onDragEnd, this);

        this.scrollbar.addChild(this.scroller);
        this.guiSystemElements.addChild(this.scrollbar);
    }

    drawGoFullScreenText() {
        this.fullScreen = new Text('Toggle fullscreen', {
            fontFamily: 'Roboto',
            fontSize: '14px',
            fontWeight: 'bold',
            fill: 0x88AA00,
            wordWrap: true,
            wordWrapWidth: 60,
            align: 'center',
        });

        this.fullScreen.position.set(Math.ceil((80 - this.fullScreen.width) / 2), 10);
        this.fullScreen.eventMode = 'static';
        this.fullScreen.cursor = 'pointer';
        this.fullScreen.on('click', this.onFullScreenClick, this);

        this.guiSystemElements.addChild(this.fullScreen);
    }

    onFullScreenClick() {
        // noinspection JSIgnoredPromiseFromCall
        screenfull.toggle(this.renderer.view);
    }

    /**
     * @param {WheelEvent} event
     */
    onWheel(event) {
        event.preventDefault();

        if (this.controls.isPlayBack) {
            return;
        }

        // noinspection JSUnresolvedVariable
        const delta = event.deltaY || event.deltaX;
        const frame = -this.graphic.position.x;

        if (delta < 0) {
            this.scrollTo(Math.max(frame - 200, 1));
        } else if (delta > 0) {
            this.scrollTo(Math.min(frame + 200, this.totalFrames));
        }
    }

    onDragStart(event) {
        if (this.controls.isPlayBack) {
            event.stopPropagation();

            return;
        }

        this.graphicWindow.on('pointermove', this.onDragMove, this);
        this.scrollbar.on('pointermove', this.onDragMove, this);
    }

    onDragEnd() {
        this.graphicWindow.off('pointermove', this.onDragMove, this);
        this.scrollbar.off('pointermove', this.onDragMove, this);
    }

    onDragMove(event) {
        if (this.controls.isPlayBack) {
            event.stopPropagation();

            return;
        }

        let scroller = this.scroller;
        let newPosition = scroller.parent.toLocal(event.global);
        let xMax = scroller.parent.width - scroller.width;

        newPosition.x -= scroller.width / 2; // normalize x position
        newPosition.x = Math.max(Math.min(newPosition.x, xMax), 0);

        if (scroller.position.x !== newPosition.x) {
            this.scrollTo(Math.floor(((newPosition.x) / xMax) * (this.totalFrames - this.getGraphicVisibleWidth())) + 1);
        }
    }

    onGraphicClick(event) {
        if (event.target !== event.currentTarget) {
            return;
        }

        event.stopPropagation();

        if (this.controls.isPlayBack) {
            return;
        }

        let graphicCursorPosition = this.graphic.toLocal(event.global);
        let frame = Math.max(Math.min(Math.floor(graphicCursorPosition.x), this.totalFrames), 1);

        if (event.originalEvent.button === 0) {
            switch (true) {
                case this.focusFrame !== undefined:
                    break;
                case this.marker1Frame === undefined:
                    this.setMarker1(frame);
                    break;
                case this.marker2Frame === undefined:
                    this.setMarker2(frame);
                    break;
            }
        }

        if (event.originalEvent.button === 2) {
            switch (true) {
                case this.focusFrame !== undefined:
                    this.setFocus(undefined);
                    this.moveCursor(frame);
                    break;
                case this.marker2Frame !== undefined:
                    this.setMarker2(undefined);
                    this.moveCursor(frame);
                    break;
                case this.marker1Frame !== undefined:
                    this.setMarker1(undefined);
                    break;
            }
        }
    }

    onGraphicMouseMove(event) {
        if (this.controls.isPlayBack || this.focusFrame !== undefined) {
            return;
        }

        if (!this.graphicWindow.getBounds().contains(event.global.x, event.global.y)) {
            return;
        }

        if (!this.graphicCursorPosition) {
            this.graphicCursorPosition = new Point();
        }

        this.graphic.toLocal(event.global, null, this.graphicCursorPosition);

        let frame = Math.max(Math.min(Math.floor(this.graphicCursorPosition.x), this.totalFrames), 1);

        if (this.marker2Frame === undefined) {
            this.moveCursor(frame);
        }
    }

    /**
     * @param {Number} frame
     * @param {Boolean} [playBack=false]
     */
    moveCursor(frame, playBack) {
        if (this.controls.isPlayBack && !playBack) {
            return;
        }

        this.cursorFrame = Math.min(Math.max(frame, 1), this.totalFrames);
        this.cursor.renderable = this.focusFrame === undefined && this.marker2Frame === undefined;

        this.drawCursor();

        this.emit('moveCursor', this.cursorFrame, this.cursor);
    }

    /**
     * @param {Number} [frame]
     */
    setMarker1(frame) {
        if (this.controls.isPlayBack) {
            return;
        }

        this.marker1Frame = frame;
        this.drawMarker1();

        this.emit('setMarker1', this.marker1Frame, this.marker1);
    }

    /**
     * @param {Number} [frame]
     */
    setMarker2(frame) {
        if (this.controls.isPlayBack) {
            return;
        }

        this.marker2Frame = frame;
        this.drawMarker2();

        this.cursor.renderable = this.focusFrame === undefined && this.marker2Frame === undefined;

        this.emit('setMarker2', this.marker2Frame, this.marker2);
    }

    /**
     * @param {Number} [frame]
     */
    setFocus(frame) {
        this.focusFrame = frame;
        this.drawFocus();

        this.cursor.renderable = this.focusFrame === undefined && this.marker2Frame === undefined;

        this.emit('setFocus', this.focusFrame, this.focus);
    }

    drawCursor() {
        this.cursor.clear();

        this.cursor.beginFill(0x00FFFF, 1);
        this.cursor.drawRect(this.cursorFrame, 0, 1, this.getGraphicWindowBounds().height);
        this.cursor.endFill();
    }

    drawMarker1() {
        this.marker1.clear();

        if (this.marker1Frame === undefined) {
            return;
        }

        this.marker1.beginFill(0xFFFF00, 1);
        this.marker1.drawRect(this.marker1Frame, 0, 1, this.getGraphicWindowBounds().height);
        this.marker1.endFill();
    }

    drawMarker2() {
        this.marker2.clear();

        if (this.marker2Frame === undefined) {
            return;
        }

        this.marker2.beginFill(0xFFFF00, 1);
        this.marker2.drawRect(this.marker2Frame, 0, 1, this.getGraphicWindowBounds().height);
        this.marker2.endFill();
    }

    drawFocus() {
        this.focus.clear();

        if (this.focusFrame !== undefined) {
            this.focus.beginFill(new Color('#fa70ff'), 1);
            this.focus.drawRect(this.focusFrame, 0, 1, this.getGraphicWindowBounds().height);
            this.focus.endFill();
        }
    }

    /**
     * @param {Number} frame
     * @param {Boolean} center
     */
    scrollTo(frame, center = false) {
        frame = Math.max(1, Math.min(frame - (center ? this.getGraphicVisibleWidth() / 2 : 0), this.totalFrames));

        this.graphic.position.x = -Math.max(1, Math.min(frame, this.totalFrames - this.getGraphicVisibleWidth())); // here we skip 0 frame
        this.scroller.position.x = Math.floor(Math.min((frame - 1) / (this.totalFrames - this.getGraphicVisibleWidth()), 1) * (this.scrollbar.width - this.scroller.width));
    }

    getGraphicVisibleWidth() {
        return this.renderer.width - 81;
    }

    resize(width, height) {
        this.renderer.resize(width, height);
        this.drawGui();
        this.updateBarsElementsPosition();
        this.updateBarsPositions();

        this.drawCursor();
        this.drawMarker1();
        this.drawMarker2();
        this.drawFocus();

        this.scrollTo(-this.graphic.position.x);

        this.emit('resize', width, height);
    }

    /**
     * @returns {Rectangle}
     */
    getGraphicWindowBounds() {
        let { x, y } = this.graphicWindow.toGlobal(this.app.stage);

        return new Rectangle(
            x,
            y,
            this.renderer.width - x,
            this.scrollbar.position.y - y,
        );
    }

    /**
     * @param {Number} index
     * @param {GraphBar|*} bar
     */
    addBar(index, bar) {
        this.bars.push({
            index: index,
            bar: bar,
        });
        this.barsContainer.addChild(bar.bar);
        this.barsLabels.addChild(bar.label);
    }

    updateBarsPositions() {
        this.bars.sort(function (bar1, bar2) {
            return bar1.index - bar2.index;
        });

        this.barsLines.clear();
        this.barsLines.lineStyle(1, 0x666666, 1);

        var y = this.barsDrawingHeight - 5,
            marginBottom = 2,
            marginTop = 3,
            i, bar;

        for (i = 0; i < this.bars.length; i++) {
            bar = this.bars[i].bar;

            y -= marginBottom;

            bar.label.canvas.height = bar.height;
            bar.label.anchor.set(1, 1);
            bar.label.position.set(75, Math.floor(y));

            y -= bar.height;
            bar.bar.position.y = y;
            y -= marginTop;

            if (i < this.bars.length - 1) {
                this.barsLines.moveTo(0, y);
                this.barsLines.lineTo(this.renderer.width, y);
            }
        }
    }

    updateBarsElementsPosition() {
        this.barsContainer.position.y = Math.round(this.getGraphicWindowBounds().height - this.barsDrawingHeight);
        this.barsLabels.position.y = this.barsContainer.toGlobal(this.app.stage, this.barsLabels.position).y;
        this.barsLabels.position.x = 0;
        this.barsLines.position.y = this.barsContainer.toGlobal(this.app.stage, this.barsLines.position).y;
        this.barsLines.position.x = 0;
    }
}


