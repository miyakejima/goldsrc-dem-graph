import { Container, Graphics } from 'pixi.js';
import GraphicsBase from './base';
import { buttons, flags, movetype } from '../../consts';
import _ from 'lodash';

const config = {
    drawingHeight: 180,
    height: [100, 75, 50, 25, 0, -25, -50],
};

export default class GraphicsJumpHeight extends GraphicsBase {
    constructor(graph) {
        super(graph);

        this.jumpHeightDemo = new Container();
        this.jumpHeightCalc = new Container();

        this.graphicsContainer.addChild(this.jumpHeightDemo);
        this.graphicsContainer.addChild(this.jumpHeightCalc);

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.dataLoaded());
        graph.on('resize', () => this.drawGui());
    }

    init() {
        this.drawGui();

        this.registerSwitcher('jump height');
    }

    dataLoaded() {
        this.drawJumpHeightDemo();
        this.drawJumpHeightCalc();
    }

    drawGui() {
        this.labelsContainer.removeChildren();
        this.lines.clear();

        const max = _.max(config.height);
        const minMaxDiff = max - _.min(config.height);

        config.height.forEach(height => {
            this.drawLabelAndLine(
                height + 'u',
                0x888888,
                0x444444,
                Math.round((max - height) / minMaxDiff * config.drawingHeight),
            );
        });
    }

    drawJumpHeightDemo() {
        const data = this.graph.data;

        const chunkSize = 2 ** 14 - 1;
        const totalChunks = Math.ceil(this.graph.totalFrames / chunkSize);

        const max = _.max(config.height);
        const min = _.min(config.height);
        const minMaxDiff = max - min;

        let originZ;
        let groundZ = 0;
        let heightChange = 0;

        for (let chunkNum = 0; chunkNum < totalChunks; chunkNum++) {
            const chunkEndFrame = Math.min((chunkNum + 1) * chunkSize - 1, this.graph.totalFrames);

            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize + 1;
            graphics.beginFill(0xAAAAAA, 1);

            for (let frame = chunkNum * chunkSize, offset = 0; frame <= chunkEndFrame; frame++, offset++) {
                if (frame === 0) {
                    continue;
                }

                originZ = data['cd']['origin[2]'].getAt(frame);
                const movetypeValue = data['esp']['movetype'].getAt(frame);

                if (
                    data['cd']['flags'].getAt(frame) & flags.ONGROUND &&
                    ~data['cd']['flags'].getAt(frame + 1) & flags.ONGROUND
                ) {
                    heightChange = 0;
                    groundZ = originZ + data['esp']['mins[2]'].getAt(frame);
                    if (
                        !data['cd']['bInDuck'].getAt(frame) &&
                        !!(data['cd']['flags'].getAt(frame) & flags.DUCKING) &&
                        !data['cd']['bInDuck'].getAt(frame + 1) &&
                        !!(data['cd']['flags'].getAt(frame + 1) & flags.DUCKING)
                    ) { // duck jump
                        groundZ -= 18;
                    }
                } else if (movetypeValue === movetype.FLY) {
                    heightChange = 0;
                } else if (data['cd']['flags'].getAt(frame) & flags.ONGROUND) {
                    heightChange = 0;
                } else {
                    originZ -= 36;
                    heightChange = originZ - groundZ;
                }

                if (heightChange > min) {
                    const y = (max - heightChange) / minMaxDiff * config.drawingHeight;

                    graphics.drawRect(offset, y, 1, 1);
                }
            }

            graphics.endFill();
            graphics.cacheAsBitmap = true;

            this.graphicsContainer.addChild(graphics);
        }
    }

    drawJumpHeightCalc() {
        const data = this.graph.data;

        const chunkSize = 2 ** 14 - 1;
        const totalChunks = Math.ceil(this.graph.totalFrames / chunkSize);

        const max = _.max(config.height);
        const min = _.min(config.height);
        const minMaxDiff = max - min;

        let heightChange = 0;
        let velocity = 0;
        let flagsValue = 0;
        let skip = false;

        for (let chunkNum = 0; chunkNum < totalChunks; chunkNum++) {
            const chunkEndFrame = Math.min((chunkNum + 1) * chunkSize - 1, this.graph.totalFrames);

            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize + 1;
            graphics.beginFill(0x00FFFF, 1);

            for (let frame = chunkNum * chunkSize, offset = 0; frame <= chunkEndFrame; frame++, offset++) {
                if (frame === 0) {
                    continue;
                }

                let movetypeValue = data['esp']['movetype'].getAt(frame);
                if (![movetype.WALK, movetype.FLY].includes(movetypeValue)) {
                    skip = true;
                }
                if (data['cd']['flags'].hasOwnProperty(frame)) {
                    flagsValue = data['cd']['flags'][frame];
                }
                if (flagsValue & flags.ONGROUND) {
                    skip = false;
                    heightChange = 0;
                    velocity = 0;
                    if (data['cd']['fuser2'].getAt(frame + 1) === 1315) {
                        velocity = Math.sqrt(2.0 * 800.0 * 45.0);
                        const fuser2 = data['cd']['fuser2'].getAt(frame);
                        if (fuser2 > 0) {
                            velocity *= (100.0 - fuser2 * 0.001 * 19.0) * 0.01;
                        }
                    }
                } else if (movetypeValue === movetype.FLY) {
                    skip = false;
                    heightChange = 0;
                    velocity = data['cd']['velocity[2]'].getAt(frame);
                } else {
                    if (
                        velocity == 0 &&
                        data['cmd']['buttons'][frame] & buttons.DUCK &&
                        ~data['cmd']['buttons'][frame - 1] & buttons.DUCK &&
                        ~data['cmd']['buttons'][frame + 1] & buttons.DUCK
                    ) {
                        heightChange += 18;
                    }
                    velocity -= 800 * 0.5 * data['frametime'][frame + 1];
                    heightChange += velocity * data['cmd']['msec'][frame + 1] * 0.001;
                    velocity -= 800 * 0.5 * data['frametime'][frame + 1];
                }

                if (skip) {
                    heightChange = 0;
                }
                if (heightChange > min) {
                    const y = (max - heightChange) / minMaxDiff * config.drawingHeight;

                    graphics.drawRect(offset, y, 1, 1);
                }
            }

            graphics.endFill();
            graphics.cacheAsBitmap = true;

            this.graphicsContainer.addChild(graphics);
        }
    }
};

