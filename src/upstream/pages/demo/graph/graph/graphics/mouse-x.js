import { Container, Graphics, Text } from 'pixi.js';
import { sprintf } from 'sprintf-js';

import GraphicsBase from './base';

const config = {
    drawingHeight: 180,
    mouseXPoints: [360, 270, 180, 90, 0],
};

const mouseXToGraphicsY = function (mouseX) {
    return (360 - mouseX) / 360 * config.drawingHeight;
};

export default class GraphicsMouseX extends GraphicsBase {
    constructor(graph) {
        super(graph);

        this.createStatsContainer();

        graph.on('init', () => this.init());
        graph.on('dataLoaded', (data) => this.onDataLoaded(data));
        graph.on('dataLoaded', () => this.drawMouseX());
        graph.on('resize', () => this.drawGui());
        graph.on('moveCursor', (frame) => this.tryShowStatsContainer(frame));
        graph.on('setFocus', (frame) => this.tryShowStatsContainer(frame));
    }

    init() {
        this.drawGui();

        this.registerSwitcher('mouseX');
    }

    onDataLoaded(data) {
        this.mouseXData = new Float32Array(this.graph.totalFrames);

        const anglesData = data['esp']['angles[1]'];

        let mouseX = 0;

        for (let frame = 0; frame < this.mouseXData.length; frame++) {
            mouseX = anglesData[frame] || mouseX;

            this.mouseXData[frame] = mouseX;
        }
    }

    showStatsContainer() {
        this.graph.graphic.addChild(this.statsContainer);
    }

    hideStatsContainer() {
        this.graph.graphic.removeChild(this.statsContainer);
    }

    tryShowStatsContainer(frame) {
        if (!this.active || !this.mouseXData || !Number.isInteger(frame)) {
            return;
        }

        if (frame < this.mouseXData.length) {
            if (!this.statsContainer.parent) {
                this.showStatsContainer();
            }
            this.updateStatsContainer(frame);
        } else {
            this.hideStatsContainer();
        }
    }

    onActivate() {
        this.tryShowStatsContainer(this.graph.focusFrame || this.graph.cursorFrame);
    }

    onDeactivate() {
        this.hideStatsContainer();
    }

    updateStatsContainer(frame) {
        const statsContainerMargin = 5;
        const prevMouseX = this.mouseXData[frame - 1];
        const mouseX = this.mouseXData[frame];
        let deltaMouseX = mouseX - prevMouseX;

        if (deltaMouseX < -180) {
            deltaMouseX += 360;
        } else if (deltaMouseX > 180) {
            deltaMouseX -= 360;
        }

        this.mouseXValueText.text = sprintf('%.3f', mouseX);
        this.deltaMouseXValueText.text = sprintf('%.3f', deltaMouseX);

        let y = Math.round(this.graph.graphicCursorPosition
            ? this.graph.graphicCursorPosition.y
            : mouseXToGraphicsY(mouseX)
        );

        y -= this.statsContainer.height;

        this.statsContainer.position.y = Math.min(config.drawingHeight - this.statsContainer.height + this.graphicsContainer.position.y, Math.max(0, y));
        this.statsContainer.position.x = frame + statsContainerMargin + this.statsContainer.width < this.graph.totalFrames || frame + statsContainerMargin < this.statsContainer.width
            ? frame + statsContainerMargin
            : frame - statsContainerMargin - this.statsContainer.width;
    }

    drawGui() {
        this.labelsContainer.removeChildren();
        this.lines.clear();

        config.mouseXPoints.forEach(mouseX => {
            this.drawLabelAndLine(
                mouseX + '°',
                0x888888,
                0x444444,
                Math.round((360 - mouseX) / 360 * config.drawingHeight),
            );
        });
    }

    drawMouseX() {
        const chunkSize = 2 ** 14 - 1;
        const totalChunks = Math.ceil(this.mouseXData.length / chunkSize);

        for (let chunkNum = 0; chunkNum < totalChunks; chunkNum++) {
            const chunkEndFrame = Math.min((chunkNum + 1) * chunkSize, this.mouseXData.length);

            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize + 1;
            graphics.beginFill(0xAAAAAA, 1);

            for (let frame = chunkNum * chunkSize, offset = 0; frame < chunkEndFrame; frame++, offset++) {
                const y = mouseXToGraphicsY(this.mouseXData[frame]);

                graphics.drawRect(offset, y, 1, 1);
            }

            graphics.endFill();
            graphics.cacheAsBitmap = true;

            this.graphicsContainer.addChild(graphics);
        }
    }

    createStatsContainer() {
        const fontConfig = {
            fontFamily: 'Roboto',
            fontSize: '12px',
            fontWeight: 'bold',
            fill: 0xFFFFFF,
        };

        this.mouseXValueText = new Text('000.000', fontConfig);
        this.deltaMouseXValueText = new Text('000.000', fontConfig);

        const labelsAndValues = [
            [
                new Text('Angle:', fontConfig),
                this.mouseXValueText,
            ],
            [
                new Text('YawSpeed:', fontConfig),
                this.deltaMouseXValueText,
            ],
        ];

        const labelsContainer = new Container();
        const valuesContainer = new Container();
        labelsAndValues.forEach(function (labelAndValue) {
            labelAndValue[1].anchor.x = 1;

            labelsContainer.addChild(labelAndValue[0]);
            valuesContainer.addChild(labelAndValue[1]);
        });

        for (var i = 0, y = 5; i < labelsAndValues.length; i++, y += 15) {
            labelsAndValues[i][0].position.y = labelsAndValues[i][1].position.y = y;
        }

        labelsContainer.position.x = 5;
        valuesContainer.position.x = 120;

        this.statsContainer = new Container();
        this.statsContainer.addChild(labelsContainer, valuesContainer);

        const background = new Graphics();
        background.beginFill(0x666666, 0.75);
        background.drawRoundedRect(0, 0, this.statsContainer.width + 10, this.statsContainer.height + 10, 5);
        background.endFill();

        this.statsContainer.addChildAt(background, 0);
    }
};

