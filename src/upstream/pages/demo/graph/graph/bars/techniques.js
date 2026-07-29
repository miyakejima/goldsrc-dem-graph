import { Color, Container, Graphics, SCALE_MODES, Sprite, Text, TextStyle } from 'pixi.js';
import ClipboardJS from 'clipboard';
import IntervalTree from '@flatten-js/interval-tree';

import GraphBar from '../bar';
import Longjump from '@/pages/demo/graph/models/techniques/longjump';
import JumpBug from '@/pages/demo/graph/models/techniques/jumpbug';
import DuckBug from '@/pages/demo/graph/models/techniques/duckbug';
import SlideBug from '@/pages/demo/graph/models/techniques/slidebug';
import EdgeBug from '@/pages/demo/graph/models/techniques/edgebug';

const JUMP_TYPES = {
    LongJump: { text: 'lj', color: new Color('#228b22') },
    HighJump: { text: 'hj', color: new Color('#005500') },
    BhopJump: { text: 'bj', color: new Color('#36648b') },
    StandupBhopJump: { text: 'sbj', color: new Color('#00546e') },
    WeirdJump: { text: 'wj', color: new Color('#8b3a3a') },
    CountJump: { text: 'cj', color: new Color('#daa520') },
    StandupCountJump: { text: 'scj', color: new Color('#a0522d') },
    DoubleCountJump: { text: 'dcj', color: new Color('#ab7d0c') },
    DoubleStandupCountJump: { text: 'dscj', color: new Color('#844213') },
    LadderJump: { text: 'ldj', color: new Color('#1acdb7') },
    SlideLongJump: { text: 'slj', color: new Color('#1e7878') },
};

const BUGS_TYPES = {
    JumpBug: { text: 'jb', color: new Color('#ff4d4a') },
    EdgeBug: { text: 'eb', color: new Color('#d66223') },
    SlideBug: { text: 'sb', color: new Color('#b43f6c') },
    DuckBug: { text: 'db', color: new Color('#921ae3') },
};

const statsTextStyle = new TextStyle({
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 'bold',
    fill: new Color('#ffffff'),
});

const techniquesFullNameTextStyle = new TextStyle({
    fontFamily: 'Roboto',
    fontSize: 13,
    fontWeight: 'bold',
    fill: new Color('#ffff00'),
});

const copyDefaultText = 'Click on a bar to copy';
const copySuccessText = 'Copied!';

/**
 * @typedef {Longjump[]} this.graph.data.longjumps
 * @typedef {JumpBug[]} this.graph.data.kz_bugs.jump_bugs
 * @typedef {EdgeBug[]} this.graph.data.kz_bugs.edge_bugs
 * @typedef {SlideBug[]} this.graph.data.kz_bugs.slide_bugs
 * @typedef {DuckBug[]} this.graph.data.kz_bugs.duck_bugs
 */

export default class BarTechniques extends GraphBar {
    constructor(graph) {
        super(graph);

        graph.on('init', () => this.init());
        graph.on('dataLoaded', (data) => this.dataLoaded(data));
        graph.on('resize', () => this.resize());
        graph.on('moveCursor', (frame) => this.moveCursor(frame));

        this.intervalTree = new IntervalTree();

        this.statsContainer = new Container();
        this.statsContainerBackground = new Graphics();
        this.statsContainerBackground.name = 'background';
        this.statsContainerLabelsAndValues = new Container();
        this.statsContainerLabels = new Container();
        this.statsContainerValues = new Container();
        this.statsContainerTechniqueName = new Text('', techniquesFullNameTextStyle);
        this.statsContainerTechniqueName.anchor.set(0.5, 0);

        this.copyHintText = new Text(copyDefaultText, {
            fontFamily: 'Roboto',
            fontSize: 12,
            fontWeight: 'bold',
            fill: new Color('#ffff00'),
            align: 'center',
        });
        this.copyHintText.anchor.set(0.5, 0);

        this.statsContainer.visible = false;
        this.statsContainer.addChild(
            this.statsContainerBackground,
            this.statsContainerTechniqueName,
            this.statsContainerLabelsAndValues,
            this.copyHintText,
        );
        this.statsContainerLabelsAndValues.addChild(
            this.statsContainerLabels,
            this.statsContainerValues,
        );
        this.techniquesFullNameText = {};
    }

    init() {
        this.setLabel('techniques');
        this.initLabels();

        this.graph.graphic.addChild(this.statsContainer);

        this.copyBtnElement = this.createCopyBtnElement();
        this.clipboard = new ClipboardJS(this.copyBtnElement, {
            text: () => this.getLongJumpDataText(),
        });

        this.clipboard.on('success', () => {
            this.copyHintText.text = copySuccessText;
            this.copyHintText.pivot.x = this.copyHintText.width & 1 ? -0.5 : 0;
        });
    }

    initLabels() {
        let labelTextConfig = new TextStyle({
            fontFamily: 'Roboto',
            fontSize: 12,
            fontWeight: 'bold',
            fill: new Color('#ffffff'),
            lineHeight: this.height,
        });

        for (const jumpTypeConfig of Object.values(JUMP_TYPES)) {
            let text = new Text(jumpTypeConfig.text, labelTextConfig);
            text.render(this.graph.renderer);
            jumpTypeConfig.label = this.graph.renderer.generateTexture(text, {
                scaleMode: SCALE_MODES.LINEAR,
            });

            text.destroy();
        }

        for (const bugTypeConfig of Object.values(BUGS_TYPES)) {
            let text = new Text(bugTypeConfig.text, labelTextConfig);
            text.render(this.graph.renderer);
            bugTypeConfig.label = this.graph.renderer.generateTexture(text, {
                scaleMode: SCALE_MODES.LINEAR,
            });

            text.destroy();
        }
    }

    dataLoaded(data) {
        const canonicalTechniques = data?.graphCanonicalV1?.techniques;
        if (Array.isArray(canonicalTechniques) && canonicalTechniques.length) {
            const longjumps = [];
            const edgeBugs = [];
            for (const event of canonicalTechniques) {
                if (!event || typeof event !== 'object') continue;
                if (event.category === 'longjump' && event.payload) {
                    longjumps.push(event.payload);
                } else if (event.category === 'edge_bug' && event.payload) {
                    edgeBugs.push(event.payload);
                }
            }

            if (longjumps.length) {
                data['longjumps'] = longjumps;
            }
            if (!data['kz_bugs']) {
                data['kz_bugs'] = {};
            }
            if (edgeBugs.length) {
                data['kz_bugs']['edge_bugs'] = edgeBugs;
            }
        }

        data['longjumps'] = (data['longjumps'] || []).map(data => new Longjump(data));
        data['kz_bugs']['edge_bugs'] = (data['kz_bugs']['edge_bugs'] || []).map(data => new EdgeBug(data));
        data['kz_bugs']['jump_bugs'] = (data['kz_bugs']['jump_bugs'] || []).map(data => new JumpBug(data));
        data['kz_bugs']['slide_bugs'] = (data['kz_bugs']['slide_bugs'] || []).map(data => new SlideBug(data));
        data['kz_bugs']['duck_bugs'] = (data['kz_bugs']['duck_bugs'] || []).map(data => new DuckBug(data));

        let allTechniques = []
            .concat(data['longjumps'])
            .concat(data['kz_bugs']['edge_bugs'])
            .concat(data['kz_bugs']['jump_bugs'])
            .concat(data['kz_bugs']['slide_bugs'])
            .concat(data['kz_bugs']['duck_bugs']);

        allTechniques.forEach(technique => this.intervalTree.insert([technique.getStartFrame(), technique.getEndFrame()], technique));

        this.drawJumps();
    }

    resize() {
        this.updateStatsContainerPosition();
    }

    moveCursor(frame) {
        if (this.currentTechnique) {
            if (frame >= this.currentTechnique.getStartFrame() && frame <= this.currentTechnique.getEndFrame()) {
                return;
            }

            this.currentTechnique = null;
            this.statsContainer.visible = false;

            this.statsContainerLabels.removeChildren().forEach(displayObject => displayObject.destroy());
            this.statsContainerValues.removeChildren().forEach(displayObject => displayObject.destroy());
            this.statsContainerBackground.clear();

            this.statsContainerTechniqueName.text = '';
            this.statsContainerTechniqueName.position.set(0, 0);
            this.statsContainerLabelsAndValues.position.set(0, 0);
            this.statsContainerBackground.position.set(0, 0);
            this.copyHintText.text = copyDefaultText;
            this.copyHintText.position.set(0, 0);
            this.statsContainer.position.set(0, 0);
        }

        this.currentTechnique = this.findTechniqueByFrame(frame);
        if (!this.currentTechnique) {
            return;
        }

        this.updateStatsContainer(this.currentTechnique);

        let bounds = this.statsContainer.getLocalBounds();

        if (this.currentTechnique.getEndFrame() + bounds.width <= this.graph.totalFrames || this.currentTechnique.getStartFrame() < bounds.width) {
            this.statsContainer.position.x = this.currentTechnique.getEndFrame() - bounds.left;
        } else {
            this.statsContainer.position.x = this.currentTechnique.getStartFrame() - bounds.right;
        }

        this.updateStatsContainerPosition();
        this.statsContainer.visible = true;
    }

    updateStatsContainerPosition() {
        const point = this.graph.graphic.toLocal(this.bar.position, this.bar.parent);

        this.statsContainer.position.y = point.y - this.statsContainer.getLocalBounds().bottom - 6;
    }

    /**
     * @param {Technique} technique
     * @returns {PIXI.Container}
     */
    updateStatsContainer(technique) {
        this.statsContainerTechniqueName.text = technique.getFullName();

        let labelsAndValues = technique.getTechniqueData().map(labelValue => ({
            label: new Text(labelValue.label, statsTextStyle),
            value: new Text(labelValue.value, statsTextStyle),
        }));

        labelsAndValues.forEach(function (labelValue, index) {
            labelValue.value.anchor.x = 1;
            labelValue.label.position.y = labelValue.value.position.y = index * 15;
        });

        this.statsContainerLabels.addChild(...labelsAndValues.map(labelValue => labelValue.label));
        this.statsContainerValues.addChild(...labelsAndValues.map(labelValue => labelValue.value));

        // final positioning
        const minWidth = Math.ceil(Math.max(
            this.statsContainerLabels.width + this.statsContainerValues.width + 15,
            this.statsContainerTechniqueName.width,
            this.copyHintText.width,
        ));
        this.statsContainerValues.position.x = minWidth;

        // y-positioning
        let y = 0;

        this.statsContainerTechniqueName.position.y = y;
        y += this.statsContainerTechniqueName.height;

        this.statsContainerLabelsAndValues.position.y = y;
        y += this.statsContainerLabelsAndValues.height;

        y += 7;
        this.copyHintText.position.y = y;
        y += this.copyHintText.height;

        // x-positioning
        this.copyHintText.position.x = Math.floor(minWidth / 2);
        this.copyHintText.pivot.x = this.copyHintText.width & 1 ? -0.5 : 0;

        this.statsContainerTechniqueName.position.x = Math.floor(minWidth / 2);
        this.statsContainerTechniqueName.pivot.x = this.statsContainerTechniqueName.width & 1 ? -0.5 : 0;

        // background
        this._fillStatsContainerBackground();
    }

    _fillStatsContainerBackground() {
        const { x, y, width, height } = this.statsContainer.getLocalBounds();
        const padding = 5;

        this.statsContainer.children.forEach(child => {
            if (child.name === 'background') {
                return;
            }

            const { x, y } = child.position;
            child.position.set(x + padding, y + padding);
        });

        this.statsContainerBackground.beginFill(0x666666, 0.75);
        this.statsContainerBackground.drawRoundedRect(x, y, width + padding * 2, height + padding * 2, padding);
        this.statsContainerBackground.endFill();
    }

    /**
     * @param {Number} frame
     * @returns {?Technique}
     */
    findTechniqueByFrame(frame) {
        if (!this.graph.data) {
            return null;
        }

        let [technique] = this.intervalTree.search([frame, frame]);

        return technique;
    }

    drawJumps() {
        var techniquesGraphics = this.getTechniquesGraphics(),
            successBhopMarkers = this.getSuccessBhopMarkers();

        this.addBarElement(techniquesGraphics);
        this.addBarElement(successBhopMarkers);
    }

    getSuccessBhopMarkers() {
        let graphics = new Graphics();

        for (/** @type {Longjump} */ let longjump of this.graph.data['longjumps']) {
            if (longjump.type !== 2) {
                continue;
            }

            graphics.beginFill(0x444444, 1);
            graphics.drawCircle(longjump.getStartFrame(), Math.round(this.height / 2), Math.round((this.height - 5) / 2) + 1);
            graphics.endFill();

            graphics.beginFill(/*longjump.isJumpBug ? 0xFF8800 :*/ (longjump.isIdealBhop ? 0x008800 : 0x880000), 1);
            graphics.drawCircle(longjump.getStartFrame(), Math.round(this.height / 2), Math.round((this.height - 5) / 2));
            graphics.endFill();
        }

        return graphics;
    }

    getTechniquesGraphics() {
        var graphics = new Graphics(),
            labelSprite,
            labelData;

        /**
         * @param {Technique} technique
         */
        var getTechniqueGraphics = function (technique) {
            labelData = this.getTechniqueLabelData(technique);

            graphics.beginFill(labelData.color, 1);
            graphics.drawRect(technique.getStartFrame(), 0, technique.getEndFrame() - technique.getStartFrame() + 1, this.height);
            graphics.endFill();

            labelSprite = new Sprite(labelData.label);
            labelSprite.position.x = technique.getStartFrame() + Math.ceil((technique.getEndFrame() - technique.getStartFrame() + 1 - labelSprite.width) / 2);
            labelSprite.position.y = 1;

            graphics.addChild(labelSprite);
        }.bind(this);

        this.graph.data['longjumps'].forEach(getTechniqueGraphics);
        this.graph.data['kz_bugs']['jump_bugs'].forEach(getTechniqueGraphics);
        this.graph.data['kz_bugs']['edge_bugs'].forEach(getTechniqueGraphics);
        this.graph.data['kz_bugs']['slide_bugs'].forEach(getTechniqueGraphics);
        this.graph.data['kz_bugs']['duck_bugs'].forEach(getTechniqueGraphics);

        graphics.eventMode = 'static';
        graphics.cursor = 'pointer';
        graphics.on('click', this.copyTechniqueData, this);

        return graphics;
    }

    getTechniqueLabelData(technique) {
        if (technique instanceof Longjump) {
            switch (technique.type) {
                case 0:
                    return JUMP_TYPES.LongJump;
                case 1:
                    return JUMP_TYPES.HighJump;
                case 2:
                    return technique.isStandup ? JUMP_TYPES.StandupBhopJump : JUMP_TYPES.BhopJump;
                case 3:
                    return JUMP_TYPES.WeirdJump;
                case 4:
                    if (technique.doubleDucks > 1) {
                        return technique.isStandup ? JUMP_TYPES.DoubleStandupCountJump : JUMP_TYPES.DoubleCountJump;
                    }

                    return technique.isStandup ? JUMP_TYPES.StandupCountJump : JUMP_TYPES.CountJump;
                case 6:
                    return JUMP_TYPES.LadderJump;
                case 7:
                    return JUMP_TYPES.SlideLongJump;
            }
        }

        if (technique instanceof JumpBug) {
            return BUGS_TYPES.JumpBug;
        }

        if (technique instanceof EdgeBug) {
            return BUGS_TYPES.EdgeBug;
        }

        if (technique instanceof SlideBug) {
            return BUGS_TYPES.SlideBug;
        }

        if (technique instanceof DuckBug) {
            return BUGS_TYPES.DuckBug;
        }
    }

    getLongJumpDataText() {
        if (!this.currentTechnique) {
            return false;
        }

        var data = this.currentTechnique.getTechniqueData();

        data = data.map(function (labelValue) {
            return labelValue.label + ' ' + labelValue.value;
        });

        data.unshift(this.currentTechnique.getFullName());

        return data.join('\r\n');
    }

    /**
     * @private
     * @returns {Element|HTMLButtonElement}
     */
    createCopyBtnElement() {
        return document.createElement('button');
    }

    /**
     * @private
     */
    copyTechniqueData() {
        this.copyBtnElement.click();
    }
};

