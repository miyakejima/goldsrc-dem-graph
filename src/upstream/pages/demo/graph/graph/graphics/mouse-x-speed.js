import { Container, Graphics, Text } from 'pixi.js';
import { sprintf } from 'sprintf-js';

import GraphicsBase from './base';

const config = {
    drawingHeight: 180,
    deltaMouseX: [180, 90, 0, -90, -180],
    scale: 16,
};

const mouseXSpeedToGraphicsY = function (deltaMouseX) {
    return (180 / config.scale - deltaMouseX) / (360 / config.scale) * config.drawingHeight;
};

export default class GraphicsMouseXSpeed extends GraphicsBase {
    constructor(graph) {
        super(graph);

        this.createStatsContainer();

        graph.on('init', () => this.init());
        graph.on('dataLoaded', (data) => this.onDataLoaded(data));
        graph.on('dataLoaded', () => this.drawDeltaMouseX());
        graph.on('resize', () => this.drawGui());
        graph.on('moveCursor', (frame) => this.tryShowStatsContainer(frame));
        graph.on('setFocus', (frame) => this.tryShowStatsContainer(frame));
    }

    init() {
        this.drawGui();

        this.registerSwitcher('mouseX speed');
    }

    onDataLoaded(data) {
        this.mouseXSpeedData = new Float32Array(this.graph.totalFrames);

        const anglesData = data['esp']['angles[1]'];

        let mouseX;
        let prevMouseX = anglesData[0] || 0;
        let deltaMouseX;

        for (let frame = 1; frame < this.mouseXSpeedData.length; frame++) {
            mouseX = anglesData[frame] || prevMouseX;
            deltaMouseX = mouseX - prevMouseX;

            if (deltaMouseX < -180) {
                deltaMouseX += 360;
            } else if (deltaMouseX > 180) {
                deltaMouseX -= 360;
            }

            this.mouseXSpeedData[frame] = deltaMouseX;

            prevMouseX = mouseX;
        }
    }

    showStatsContainer() {
        this.graph.graphic.addChild(this.statsContainer);
    }

    hideStatsContainer() {
        this.graph.graphic.removeChild(this.statsContainer);
    }

    tryShowStatsContainer(frame) {
        if (!this.active || !this.mouseXSpeedData || !Number.isInteger(frame)) {
            return;
        }

        if (frame < this.mouseXSpeedData.length) {
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
        const deltaMouseX = this.mouseXSpeedData[frame];
        const mouseX = this.graph.data['esp']['angles[1]'].getAt(frame);

        this.mouseXValueText.text = sprintf('%.3f', mouseX);
        this.deltaMouseXValueText.text = sprintf('%.3f', deltaMouseX);

        let y = Math.round(this.graph.graphicCursorPosition
            ? this.graph.graphicCursorPosition.y
            : mouseXSpeedToGraphicsY(deltaMouseX)
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

        config.deltaMouseX.forEach(deltaMouseX => {
            this.drawLabelAndLine(
                sprintf('%.01f°', deltaMouseX / config.scale),
                0x888888,
                0x444444,
                Math.round((180 - deltaMouseX) / 360 * config.drawingHeight),
            );
        });
    }

    drawDeltaMouseX() {
        const chunkSize = 2 ** 14 - 1;
        const totalChunks = Math.ceil(this.mouseXSpeedData.length / chunkSize);

        for (let chunkNum = 0; chunkNum < totalChunks; chunkNum++) {
            const chunkEndFrame = Math.min((chunkNum + 1) * chunkSize, this.mouseXSpeedData.length);

            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize + 1;
            graphics.beginFill(0xAAAAAA, 1);

            for (let frame = chunkNum * chunkSize, offset = 0; frame < chunkEndFrame; frame++, offset++) {
                if (frame === 0) {
                    continue;
                }

                const y = mouseXSpeedToGraphicsY(this.mouseXSpeedData[frame]);

                if (y > 0 && y < config.drawingHeight) {
                    graphics.drawRect(offset, y, 1, 1);
                }
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

