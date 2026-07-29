import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { buttons, flags } from '../../consts';
import { getActiveFramesRanges, getCommandLinesFrames } from '../utils';

export default class BarDuck extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('duck');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var duckingGraphics = this.getDuckingGraphics(),
            duckingCommandLines = this.getDuckingCommandLines();

        this.addBarElement(duckingGraphics);
        this.addBarElement(duckingCommandLines);
    }

    getDuckingGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isDucking.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x555555, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getDuckingCommandLines() {
        var frames = getCommandLinesFrames(this.graph.totalFrames, this.getDuckingCommandLineColor.bind(this)),
            graphics = new Graphics(),
            isCheated;

        frames.forEach(function (frameData) {
            isCheated = ([0x00FF00, 0x006600, 0xFF0000, 0x0000FF].indexOf(frameData[1]) === -1);
            graphics.beginFill(frameData[1], 1);
            graphics.drawRect(frameData[0], isCheated ? -2.5 : 0, 1, isCheated ? this.height + 2.5 : this.height);
            graphics.endFill();
        }, this);

        return graphics;
    }

    isDucking(frame) {
        // do not display bar after scroll duck
        if (~this.graph.data['cmd']['buttons'][frame + 1] & buttons.DUCK) {
            return false;
        }

        var commands = (this.graph.data['commands'][frame] || '').toLowerCase().split(';').map(function (command) {
            return command.trim();
        });

        // do not display bar if +duck or -duck occurred
        return commands.indexOf('+duck') === -1 || commands.indexOf('-duck') === -1;
    }

    getDuckingCommandLineColor(frame) {
        var commands = this.graph.data['commands'];
        if (!(frame in commands)) {
            return;
        }

        var currentCommands = commands[frame].toLowerCase().split(';').map(function (command) {
                return command.trim();
            }),
            nextCommands = (commands[frame + 1] || '').toLowerCase().split(';').map(function (command) {
                return command.trim();
            }),
            pressedIndex = currentCommands.indexOf('+duck'),
            releasedIndex = currentCommands.indexOf('-duck'),
            color;

        if (pressedIndex === -1 && releasedIndex === -1) {
            return;
        }

        if (releasedIndex !== -1 && pressedIndex !== -1) {
            if (pressedIndex + 1 === releasedIndex) { // scroll duck
                if (this.graph.data['cd']['flags'].getAt(frame) & flags.ONGROUND) {
                    color = 0x00FF00;
                } else {
                    color = 0x006600;
                }
            } else if (nextCommands.indexOf('-duck') !== -1 && nextCommands.indexOf('+duck') === -1) {
                color = 0xFF00FF; // alias
            }
        } else if (pressedIndex !== -1) { // +duck
            color = 0xFF0000;
        } else if (releasedIndex !== -1) { // -duck
            color = 0x0000FF;
        }

        if (pressedIndex !== -1 && ~this.graph.data['cmd']['buttons'][frame + 1] & buttons.DUCK) {
            color = 0xFFFFFF;
        }

        if (currentCommands.indexOf('+duck', pressedIndex + 1) !== -1 && currentCommands.indexOf('-duck', releasedIndex + 1) !== -1) {
            color = 0xFF00FF; // +duck and -duck twice in a frame
        }

        return color;
    }
};

