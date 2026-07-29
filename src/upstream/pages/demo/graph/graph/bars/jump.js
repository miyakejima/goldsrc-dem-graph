import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { buttons, flags } from '../../consts';
import { getActiveFramesRanges, getCommandLinesFrames } from '../utils';

export default class BarJump extends GraphBar {
    constructor(graph) {
        super(graph);

        this.height = 22;
        this.setLabel('jump');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var jumpingCommandLines = this.getJumpingCommandLines();
        this.addBarElement(jumpingCommandLines);
    }

    getJumpingGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isJumping.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x555555, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getJumpingCommandLines() {
        const canonicalFrames = this.getCanonicalJumpCommandLineFrames();
        var frames = canonicalFrames || getCommandLinesFrames(this.graph.totalFrames, this.getJumpingCommandLineColor.bind(this)),
            graphics = new Graphics(),
            isCheated;

        frames.forEach(function (frameData) {
            isCheated = ([0x00FF00, 0x008800, 0xFF0000, 0x0000FF].indexOf(frameData[1]) === -1);
            graphics.beginFill(frameData[1], 1);
            graphics.drawRect(frameData[0], isCheated ? 2.5 : 0, 1, this.height - 2 * (isCheated ? 2.5 : 0));
            graphics.endFill();
        }, this);

        return graphics;
    }

    getCanonicalJumpCommandLineFrames() {
        const events = this.graph.canonical?.events;
        if (!Array.isArray(events) || events.length === 0) {
            return null;
        }

        const out = [];
        for (const event of events) {
            if (event?.kind !== 'jump_command_line') {
                continue;
            }

            const frame = Number(event.frame);
            if (!Number.isFinite(frame) || frame < 1 || frame > this.graph.totalFrames) {
                continue;
            }

            const color = this.parseColorHex(event.colorHex);
            if (color === undefined) {
                continue;
            }

            out.push([frame, color]);
        }

        out.sort((a, b) => a[0] - b[0]);
        return out;
    }

    parseColorHex(value) {
        if (typeof value !== 'string') {
            return undefined;
        }

        const normalized = value.trim().replace(/^#/, '');
        if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
            return undefined;
        }

        return Number.parseInt(normalized, 16);
    }

    isJumping(frame) {
        if (~this.graph.data['cmd']['buttons'][frame + 1] & buttons.JUMP) {
            return false;
        }

        var commands = (this.graph.data['commands'][frame] || '').toLowerCase().split(';').map(function (command) {
            return command.trim();
        });

        return commands.indexOf('+jump') === -1 || commands.indexOf('-jump') === -1;
    }

    getJumpingCommandLineColor(frame) {
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
            pressedIndex = currentCommands.indexOf('+jump'),
            releasedIndex = currentCommands.indexOf('-jump'),
            color;

        if (pressedIndex === -1 && releasedIndex === -1) {
            return;
        }

        if (releasedIndex !== -1 && pressedIndex !== -1) { // +jump and -jump in one frame
            if (releasedIndex > pressedIndex) { // scroll jump
                if (this.graph.data['cd']['fuser2'].getAt(frame + 1) == 1315) {
                    color = 0x00FF00; // highlight actual jumpoff frame
                } else {
                    color = 0x008800;
                }
            } else if (nextCommands.indexOf('-jump') !== -1 && nextCommands.indexOf('+jump') === -1) {
                color = 0xFF00FF; // alias
            } else {
                color = 0x00FFFF; // +jump is going after -jump
            }
        } else if (pressedIndex !== -1) { // +jump
            color = 0xFF0000;
        } else if (releasedIndex !== -1) { // -jump
            color = 0x0000FF;
        }

        if (pressedIndex !== -1 && ~this.graph.data['cmd']['buttons'][frame + 1] & buttons.JUMP) {
            color = 0xFFFFFF;
        }

        if (
            this.graph.data['cd']['fuser2'].getAt(frame + 1) === 1315 &&
            this.graph.data['cmd']['buttons'][frame] & buttons.JUMP
        ) {
            color = 0xFFAA00;
        }

        if (currentCommands.indexOf('+jump', pressedIndex + 1) !== -1 && currentCommands.indexOf('-jump', releasedIndex + 1) !== -1) {
            color = 0xFF00FF; // +jump or -jump twice in a frame
        }

        // Legacy fallback kept for non-canonical payloads.
        if ([0xFFFFFF, 0xFF0000, 0x0000FF, 0x00FFFF, 0xFF00FF].indexOf(color) !== -1) {
            if (this.isJumpPulse(frame)) {
                color = this.isLikelyJumpoffFrame(frame) ? 0x00FF00 : 0x008800;
            } else {
                return;
            }
        }

        return color;
    }

    isJumpPulse(frame) {
        const currentButtons = this.graph.data['cmd']['buttons'][frame] || 0;
        const nextButtons = this.graph.data['cmd']['buttons'][frame + 1] || 0;

        return !!(currentButtons & buttons.JUMP) && !(nextButtons & buttons.JUMP);
    }

    isLikelyJumpoffFrame(frame) {
        if (this.graph.data['cd']['fuser2'].getAt(frame + 1) === 1315) {
            return true;
        }

        // Fallback when local fuser2 reconstruction is incomplete.
        return !!(this.graph.data['cd']['flags'].getAt(frame + 1) & flags.ONGROUND);
    }
};

