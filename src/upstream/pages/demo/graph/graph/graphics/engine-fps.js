import { Graphics } from 'pixi.js';
import _ from 'lodash';

import GraphicsBase from './base';

const config = {
    drawingHeight: 155,
    fpsPoints: [100, 83, 50, 25, 0],
    lineColorFn: fps => 0x444444,
    labelColorFn(fps) {
        var r, g, b;
        r = (0xFF - Math.max(fps - 50, 0) / 50 * 0xFF);
        g = (Math.max(fps - 50, 0) / 50 * 0xFF);
        b = 0;//(0x44 - Math.max(fps - 50, 0) / 50 * 0x44);

        return (Math.max(Math.min(Math.floor(r), 0xFF), 0) << 16) +
            (Math.max(Math.min(Math.floor(g), 0xFF), 0) << 8) +
            Math.max(Math.min(Math.floor(b), 0xFF), 0);
    },
};

export default class GraphicsEngineFps extends GraphicsBase {
    constructor(graph) {
        super(graph);

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.drawEngineFps());
        graph.on('resize', () => this.drawGui());
    }

    init() {
        this.drawGui();

        this.registerSwitcher('engine fps');
    }

    drawGui() {
        this.labelsContainer.removeChildren();
        this.lines.clear();

        this.drawLabelAndLine('> 100 fps', 0xFF0000, 0x444444, 0);

        config.fpsPoints.forEach(fps => {
            this.drawLabelAndLine(
                fps + ' fps',
                config.labelColorFn(fps),
                config.lineColorFn(fps),
                25 + Math.round((100 - fps) * config.drawingHeight / 100),
            );
        });
    }

    drawEngineFps() {
        const chunkSize = 2 ** 14 - 1;
        const chunks = _.chunk(this.graph.data['cmd']['msec'], chunkSize);

        for (let chunkNum in chunks) {
            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize;

            let fps, color;
            let y, height;

            for (let [msec, startFrame, endFrame] of this.getSequence(chunks[chunkNum])) {
                fps = msec === 0 ? 0 : 1000 / msec;

                if (fps > 100) {
                    y = 0;
                    height = 1;
                    color = 0xFF0000;
                } else if (fps < 4) {
                    y = 25 + config.drawingHeight - 5;
                    height = 10;
                    color = 0xFF0000;
                } else {
                    y = 25 + (100 - fps) * config.drawingHeight / 100;
                    height = 1;
                    color = 0xFF8000;
                }

                graphics.beginFill(color, 1);
                graphics.drawRect(startFrame, y, endFrame - startFrame + 1, height);
                graphics.endFill();
            }

            graphics.cacheAsBitmap = true;

            this.graphicsContainer.addChild(graphics);
        }
    }
};

