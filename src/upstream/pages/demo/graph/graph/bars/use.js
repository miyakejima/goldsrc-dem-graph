import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { buttons } from '../../consts';
import { getActiveFramesRanges, getCommandLinesFrames } from '../utils';

export default class BarUse extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('use');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var usingGraphics = this.getUsingGraphics(),
            usingCommandLines = this.getUsingCommandLines();

        this.addBarElement(usingGraphics);
        this.addBarElement(usingCommandLines);
    }

    getUsingGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isUsing.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x555555, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getUsingCommandLines() {
        var frames = getCommandLinesFrames(this.graph.totalFrames, this.getUsingCommandLineColor.bind(this)),
            graphics = new Graphics();

        frames.forEach(function (frameData) {
            graphics.beginFill(frameData[1], 1);
            graphics.drawRect(frameData[0], 0, 1, this.height);
            graphics.endFill();
        }, this);

        return graphics;
    }

    isUsing(frame) {
        return !!(this.graph.data['cmd']['buttons'][frame] & buttons.USE);
    }

    getUsingCommandLineColor(frame) {
        var commands = this.graph.data['commands'];
        if (!(frame in commands)) {
            return;
        }

        var commandsArr = commands[frame].toLowerCase().split(';').map(function (command) {
                return command.trim();
            }),
            isKeyDownIndex = commandsArr.indexOf('+use'),
            isKeyUpIndex = commandsArr.indexOf('-use'),
            color;

        if (isKeyDownIndex === -1 && isKeyUpIndex === -1) {
            return;
        }

        if (isKeyUpIndex !== -1 && isKeyDownIndex !== -1) {
            if (isKeyDownIndex + 1 === isKeyUpIndex) { // scroll use
                color = 0x00FF00;
            } else {
                color = 0xFF00FF; // +use is going after -use
            }
        } else if (isKeyDownIndex !== -1) { // +use
            color = 0xFF0000;
        } else if (isKeyUpIndex !== -1) { // -use
            color = 0x0000FF;
        }

        return color;
    }
};

