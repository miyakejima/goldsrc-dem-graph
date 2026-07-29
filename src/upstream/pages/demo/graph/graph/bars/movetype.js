import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { movetype } from '../../consts';
import { getActiveFramesRanges } from '../utils';

export default class BarMovetype extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('movetype');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var flyGraphics = this.getFlyGraphics(),
            noClipGraphics = this.getNoClipGraphics(),
            noneGraphics = this.getNoneGraphics(),
            tossGraphics = this.getTossGraphics();

        this.addBarElement(flyGraphics);
        this.addBarElement(noClipGraphics);
        this.addBarElement(noneGraphics);
        this.addBarElement(tossGraphics);
    }

    getFlyGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isFly.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x00FFFF, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getNoClipGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isNoClip.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0xFF00FF, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getNoneGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isNone.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0xFF0000, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    getTossGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isToss.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x880000, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    isFly(frame) {
        return this.graph.data['esp']['movetype'].getAt(frame) === movetype.FLY;
    }

    isNoClip(frame) {
        return this.graph.data['esp']['movetype'].getAt(frame) === movetype.NOCLIP;
    }

    isNone(frame) {
        return this.graph.data['esp']['movetype'].getAt(frame) === movetype.NONE;
    }

    isToss(frame) {
        return this.graph.data['esp']['movetype'].getAt(frame) === movetype.TOSS;
    }
};

